import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { db, generateTutorPlugCode, ensureUserPersonalRoom, getOrCreateHostForCode } from '../db/database.js';
import { StorageService } from '../services/storage.js';
import { RecordingManager } from '../services/recordingManager.js';

import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.js';

export const meetingsRouter = Router();

const ADMIN_EMAILS = ['admin@tutorplug.com', 'sanjeev@tutorplug.com', 'sanjeevgupta052020@gmail.com'];

function getAuthUser(req: Request): any {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.verify(token, CONFIG.JWT_SECRET);
      if (decoded && ADMIN_EMAILS.includes((decoded.email || '').toLowerCase())) {
        decoded.role = 'admin';
        decoded.userType = 'admin';
      }
      return decoded;
    } catch {}
  }
  const queryUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (queryUserId) {
    const user: any = db.prepare('SELECT id, name, email, role, user_type, personal_meeting_code FROM users WHERE id = ?').get(queryUserId);
    if (user && ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      user.role = 'admin';
      user.user_type = 'admin';
    }
    return user;
  }
  return null;
}

// 1. Create a new meeting (Enforces single permanent link by default; extra links require admin authorization)
meetingsRouter.post('/', (req: Request, res: Response) => {
  try {
    const { title, description, hostId, scheduledStartTime } = req.body;
    const meetingId = uuidv4();

    let effectiveHostId = hostId;
    if (!effectiveHostId) {
      effectiveHostId = 'host_' + uuidv4().slice(0, 8);
    }

    // Ensure host user exists in DB
    let hostUser: any = db.prepare('SELECT * FROM users WHERE id = ?').get(effectiveHostId);
    if (!hostUser) {
      try {
        db.prepare(`
          INSERT INTO users (id, name, email, password_hash, role, allowed_link_quota)
          VALUES (?, ?, ?, ?, 'user', 1)
        `).run(effectiveHostId, 'Tutor', `${effectiveHostId}@tutorplug.local`, 'guest_pwd');
        ensureUserPersonalRoom(effectiveHostId, 'Tutor');
        hostUser = db.prepare('SELECT * FROM users WHERE id = ?').get(effectiveHostId);
      } catch {}
    }

    // Check link quota for non-admin users
    if (hostUser && hostUser.role !== 'admin') {
      const activeRoomsCount: any = db.prepare(
        'SELECT COUNT(*) as count FROM meetings WHERE host_id = ?'
      ).get(effectiveHostId);

      const quota = hostUser.allowed_link_quota || 1;
      if (activeRoomsCount.count >= quota) {
        res.status(403).json({
          error: `Meeting link quota reached (${activeRoomsCount.count}/${quota}). Each tutor has 1 permanent meeting link by default. Please request additional links through the admin authorization panel.`,
          quotaReached: true,
          currentQuota: quota,
          existingMeetingCode: hostUser.personal_meeting_code,
        });
        return;
      }
    }

    let code = generateTutorPlugCode();
    let tries = 0;
    while (db.prepare('SELECT id FROM meetings WHERE code = ?').get(code) && tries < 10) {
      code = generateTutorPlugCode();
      tries++;
    }

    const effectiveTitle = title?.trim() || `Tutoring Session (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`;

    db.prepare(`
      INSERT INTO meetings (
        id, code, title, description, host_id, scheduled_start_time,
        started_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), 'active')
    `).run(
      meetingId,
      code,
      effectiveTitle,
      description || null,
      effectiveHostId,
      scheduledStartTime || null
    );

    const created = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
    res.status(201).json({ meeting: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to create meeting' });
  }
});

// 2. Request an additional meeting link (for admin authorization)
meetingsRouter.post('/request-link', (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, requestedTitle, reason } = req.body;
    if (!userId || !requestedTitle) {
      res.status(400).json({ error: 'User ID and requested meeting title are required' });
      return;
    }

    const requestId = uuidv4();
    db.prepare(`
      INSERT INTO link_requests (
        id, user_id, user_name, user_email, requested_title, reason, status
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      requestId,
      userId,
      userName || 'Tutor',
      userEmail || 'tutor@tutorplug.com',
      requestedTitle.trim(),
      reason?.trim() || 'Additional course room needed'
    );

    res.status(201).json({
      success: true,
      message: 'Your meeting link request has been submitted to the TutorPlug Administrator for authorization.',
      requestId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to submit link request' });
  }
});

// 3. Get user's authorized meeting rooms & pending requests
meetingsRouter.get('/user/:userId/links', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Ensure permanent room is ready
    const personalRoom = ensureUserPersonalRoom(user.id, user.name);

    const meetings = db.prepare(`
      SELECT * FROM meetings WHERE host_id = ? ORDER BY is_permanent DESC, created_at DESC
    `).all(userId);

    const pendingRequests = db.prepare(`
      SELECT * FROM link_requests WHERE user_id = ? ORDER BY created_at DESC
    `).all(userId);

    res.json({
      personalRoomCode: personalRoom.code,
      allowedQuota: user.allowed_link_quota || 1,
      meetings,
      pendingRequests,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user links' });
  }
});

// 4. Lookup meeting by code (validate before join)
meetingsRouter.get('/code/:code', (req: Request, res: Response) => {
  try {
    const code = req.params.code.toLowerCase().trim();
    const authUser = getAuthUser(req);
    let meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(code);

    // 1. If not found in meetings table, check if any user owns this permanent room code
    if (!meeting) {
      const userWithCode: any = db.prepare('SELECT * FROM users WHERE LOWER(personal_meeting_code) = ?').get(code);
      if (userWithCode) {
        const ensured = ensureUserPersonalRoom(userWithCode.id, userWithCode.name);
        meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(ensured.meetingId);
      }
    }

    // 2. If still not found, check if requesting user is authenticated or if it's a valid tp-* permanent room code
    if (!meeting) {
      if (authUser && code.startsWith('tp-')) {
        const meetingId = uuidv4();
        const roomTitle = `${authUser.name}'s Permanent Tutoring Room`;
        db.prepare(`
          INSERT INTO meetings (id, code, title, description, host_id, status, is_permanent)
          VALUES (?, ?, ?, 'Permanent Tutoring Room for TutorPlug', ?, 'active', 1)
        `).run(meetingId, code, roomTitle, authUser.id);
        meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
      } else if (code.startsWith('tp-')) {
        // Auto-provision permanent room for tutor by name slug so students can join reliably
        const { hostId, hostName } = getOrCreateHostForCode(code, undefined, authUser?.id);
        const meetingId = uuidv4();

        db.prepare(`
          INSERT INTO meetings (id, code, title, description, host_id, status, is_permanent)
          VALUES (?, ?, ?, 'Permanent Tutoring Room for TutorPlug', ?, 'active', 1)
        `).run(meetingId, code, `${hostName}'s Tutoring Room`, hostId);
        meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(meetingId);
      }
    }

    // 3. Ensure host_id continuity: If authenticated user is the owner or matched tutor, update host_id
    if (meeting && authUser) {
      const codeSlug = (code.split('-')[1] || '').toLowerCase();
      const isOwner = Boolean(
        authUser.role === 'admin' ||
        (authUser.personal_meeting_code && authUser.personal_meeting_code.toLowerCase() === code) ||
        (codeSlug.length >= 3 && authUser.name && authUser.name.toLowerCase().includes(codeSlug))
      );
      if (isOwner && meeting.host_id !== authUser.id) {
        try {
          db.prepare('UPDATE meetings SET host_id = ? WHERE id = ?').run(authUser.id, meeting.id);
          meeting.host_id = authUser.id;
        } catch {}
      }
    }

    if (!meeting) {
      res.status(404).json({ error: 'Meeting code not found. Please verify the link or code.' });
      return;
    }

    // If permanent room or active room, ensure status is active so it can be used perpetually
    if (meeting.is_permanent && meeting.status !== 'active') {
      db.prepare("UPDATE meetings SET status = 'active' WHERE id = ?").run(meeting.id);
      meeting.status = 'active';
    }

    const recording = db.prepare('SELECT * FROM recordings WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1').get(meeting.id);

    res.json({
      meeting,
      recording,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting' });
  }
});

// 5. Meeting History (Teachers & Students see their participated/hosted classes; Admin sees all platform recordings)
meetingsRouter.get('/history/all', (req: Request, res: Response) => {
  try {
    const authUser = getAuthUser(req);
    let items: any[] = [];

    const isAdmin = Boolean(
      authUser && (
        authUser.role === 'admin' ||
        ADMIN_EMAILS.includes((authUser.email || '').toLowerCase())
      )
    );

    if (isAdmin) {
      // Administrator: full visibility into all clients, students, and teachers' classes and recordings
      // 1. All actual recording sessions
      const recordingsWithMeetings: any[] = db.prepare(`
        SELECT 
          r.id AS id,
          r.id AS recording_id,
          r.meeting_id,
          r.file_name AS recording_file_name,
          r.duration_seconds AS recording_duration,
          r.size_bytes AS recording_size_bytes,
          r.status AS recording_status,
          COALESCE(r.started_at, r.created_at, m.created_at) AS created_at,
          r.started_at,
          r.ended_at,
          m.code,
          m.title,
          m.description,
          m.host_id,
          m.is_permanent,
          u.name AS host_name,
          u.email AS host_email,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM recordings r
        JOIN meetings m ON m.id = r.meeting_id
        LEFT JOIN users u ON u.id = m.host_id
        WHERE (r.duration_seconds >= 2 OR r.size_bytes > 5000 OR r.status = 'recording')
        ORDER BY COALESCE(r.started_at, r.created_at) DESC
      `).all();

      // 2. Any scheduled or active rooms that have no recordings yet
      const meetingsWithoutRec: any[] = db.prepare(`
        SELECT 
          m.id AS id,
          NULL AS recording_id,
          m.id AS meeting_id,
          NULL AS recording_file_name,
          0 AS recording_duration,
          0 AS recording_size_bytes,
          'none' AS recording_status,
          m.created_at AS created_at,
          m.started_at,
          m.ended_at,
          m.code,
          m.title,
          m.description,
          m.host_id,
          m.is_permanent,
          u.name AS host_name,
          u.email AS host_email,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM meetings m
        LEFT JOIN users u ON u.id = m.host_id
        WHERE m.id NOT IN (
          SELECT DISTINCT meeting_id FROM recordings 
          WHERE duration_seconds >= 2 OR size_bytes > 5000 OR status = 'recording'
        )
        ORDER BY m.created_at DESC
      `).all();

      items = [...recordingsWithMeetings, ...meetingsWithoutRec];
    } else if (authUser && authUser.id) {
      // Regular User (Teacher or Student): see all recording sessions for meetings they hosted, attended, or own
      const recordingsWithMeetings: any[] = db.prepare(`
        SELECT 
          r.id AS id,
          r.id AS recording_id,
          r.meeting_id,
          r.file_name AS recording_file_name,
          r.duration_seconds AS recording_duration,
          r.size_bytes AS recording_size_bytes,
          r.status AS recording_status,
          COALESCE(r.started_at, r.created_at, m.created_at) AS created_at,
          r.started_at,
          r.ended_at,
          m.code,
          m.title,
          m.description,
          m.host_id,
          m.is_permanent,
          u.name AS host_name,
          u.email AS host_email,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM recordings r
        JOIN meetings m ON m.id = r.meeting_id
        LEFT JOIN users u ON u.id = m.host_id
        WHERE (r.duration_seconds >= 2 OR r.size_bytes > 5000 OR r.status = 'recording')
          AND (
            m.host_id = ?
            OR m.id IN (SELECT meeting_id FROM meeting_participants WHERE user_id = ? OR LOWER(display_name) = LOWER(?))
            OR m.id IN (SELECT meeting_id FROM messages WHERE sender_id = ?)
            OR m.code = (SELECT personal_meeting_code FROM users WHERE id = ?)
          )
        ORDER BY COALESCE(r.started_at, r.created_at) DESC
      `).all(authUser.id, authUser.id, authUser.name || '', authUser.id, authUser.id);

      const meetingsWithoutRec: any[] = db.prepare(`
        SELECT 
          m.id AS id,
          NULL AS recording_id,
          m.id AS meeting_id,
          NULL AS recording_file_name,
          0 AS recording_duration,
          0 AS recording_size_bytes,
          'none' AS recording_status,
          m.created_at AS created_at,
          m.started_at,
          m.ended_at,
          m.code,
          m.title,
          m.description,
          m.host_id,
          m.is_permanent,
          u.name AS host_name,
          u.email AS host_email,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM meetings m
        LEFT JOIN users u ON u.id = m.host_id
        WHERE m.id NOT IN (
          SELECT DISTINCT meeting_id FROM recordings 
          WHERE duration_seconds >= 2 OR size_bytes > 5000 OR status = 'recording'
        )
        AND (
          m.host_id = ?
          OR m.id IN (SELECT meeting_id FROM meeting_participants WHERE user_id = ? OR LOWER(display_name) = LOWER(?))
          OR m.id IN (SELECT meeting_id FROM messages WHERE sender_id = ?)
          OR m.code = (SELECT personal_meeting_code FROM users WHERE id = ?)
        )
        ORDER BY m.created_at DESC
      `).all(authUser.id, authUser.id, authUser.name || '', authUser.id, authUser.id);

      items = [...recordingsWithMeetings, ...meetingsWithoutRec];
    } else {
      // Anonymous / Unauthenticated: return empty list
      items = [];
    }

    res.json({ meetings: items });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting history' });
  }
});

// 6. Meeting Detail (recording, participants, chat transcript, shared media)
// Accepts either recording.id OR meeting.id / code
meetingsRouter.get('/detail/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let recording: any = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    let meeting: any = null;

    if (recording) {
      meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(recording.meeting_id);
    } else {
      meeting = db.prepare('SELECT * FROM meetings WHERE id = ? OR LOWER(code) = ?').get(id, id.toLowerCase());
      if (meeting) {
        recording = db.prepare(`
          SELECT * FROM recordings 
          WHERE meeting_id = ? AND (duration_seconds >= 2 OR size_bytes > 5000 OR status = 'recording')
          ORDER BY created_at DESC LIMIT 1
        `).get(meeting.id);
        if (!recording) {
          recording = db.prepare('SELECT * FROM recordings WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1').get(meeting.id);
        }
      }
    }

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const authUser = getAuthUser(req);
    const isAdmin = Boolean(
      authUser && (
        authUser.role === 'admin' ||
        ADMIN_EMAILS.includes((authUser.email || '').toLowerCase())
      )
    );

    if (authUser && !isAdmin && meeting.host_id && meeting.host_id !== authUser.id) {
      // Check if user was an attendee/participant, sent messages, or owns room code
      const isParticipant = db.prepare(`
        SELECT 1 FROM meeting_participants 
        WHERE meeting_id = ? AND (user_id = ? OR LOWER(display_name) = LOWER(?))
      `).get(meeting.id, authUser.id, authUser.name || '');

      const isSender = db.prepare(`
        SELECT 1 FROM messages WHERE meeting_id = ? AND sender_id = ?
      `).get(meeting.id, authUser.id);

      const isRoomOwner = db.prepare(`
        SELECT 1 FROM users WHERE id = ? AND LOWER(personal_meeting_code) = LOWER(?)
      `).get(authUser.id, meeting.code);

      if (!isParticipant && !isSender && !isRoomOwner) {
        res.status(403).json({ error: 'Access denied: You can only view recordings for classes you hosted or attended.' });
        return;
      }
    }

    const participants: any[] = db.prepare('SELECT * FROM meeting_participants WHERE meeting_id = ? ORDER BY joined_at ASC').all(meeting.id);
    const messages: any[] = db.prepare('SELECT * FROM messages WHERE meeting_id = ? ORDER BY created_at ASC').all(meeting.id);
    const files: any[] = db.prepare('SELECT * FROM uploaded_files WHERE meeting_id = ? ORDER BY created_at ASC').all(meeting.id);

    res.json({
      meeting,
      recording,
      participants,
      messages,
      files,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting detail' });
  }
});

// 6b. Download In-Class Chat Transcript
meetingsRouter.get('/:id/chat/download', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let meeting: any = db.prepare('SELECT * FROM meetings WHERE id = ? OR LOWER(code) = ?').get(id, id.toLowerCase());
    if (!meeting) {
      const rec: any = db.prepare('SELECT meeting_id FROM recordings WHERE id = ?').get(id);
      if (rec) {
        meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(rec.meeting_id);
      }
    }

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const messages: any[] = db.prepare('SELECT * FROM messages WHERE meeting_id = ? ORDER BY created_at ASC').all(meeting.id);
    const lines = [
      '========================================================================',
      `TUTORPLUG CLASS CHAT RECORDING TRANSCRIPT`,
      `Room / Code: ${meeting.code}`,
      `Title: ${meeting.title}`,
      `Session Date: ${meeting.created_at}`,
      `Total Messages: ${messages.length}`,
      '========================================================================',
      '',
    ];

    if (messages.length === 0) {
      lines.push('(No chat messages recorded during this session)');
    } else {
      for (const m of messages) {
        const time = new Date(m.created_at).toLocaleTimeString();
        let line = `[${time}] ${m.sender_name}: ${m.content || ''}`;
        if (m.file_url) {
          line += ` [Attachment: ${m.file_name || 'File'} - ${m.file_url}]`;
        }
        lines.push(line);
      }
    }

    lines.push('');
    lines.push('========================================================================');
    lines.push('End of Recorded Chat Transcript • TutorPlug Quality & Safety Records');

    const fileContent = lines.join('\r\n');
    const filename = `TutorPlug_Chat_${meeting.code}_${Date.now()}.txt`;

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileContent);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate chat transcript' });
  }
});


// 7. Stream Recording Video (accepts recording.id OR meeting.id)
meetingsRouter.get('/:id/recording/stream', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let recording: any = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    if (!recording) {
      recording = db.prepare(`
        SELECT * FROM recordings 
        WHERE meeting_id = ? AND (duration_seconds >= 2 OR size_bytes > 5000 OR status = 'recording')
        ORDER BY created_at DESC LIMIT 1
      `).get(id);
      if (!recording) {
        recording = db.prepare('SELECT * FROM recordings WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
      }
    }

    if (!recording) {
      res.status(404).json({ error: 'Recording not found for this meeting' });
      return;
    }

    if (!fs.existsSync(recording.file_path)) {
      res.status(404).json({ error: 'Recording media file not found on disk' });
      return;
    }

    // Ensure WebM is seekable before streaming
    if (recording.duration_seconds && recording.duration_seconds > 0) {
      try {
        RecordingManager.patchWebmFileDuration(recording.file_path, recording.duration_seconds * 1000);
      } catch (patchErr) {
        console.warn('Could not pre-patch WebM duration before stream:', patchErr);
      }
    }

    StorageService.streamMediaFile(req, res, recording.file_path, recording.mime_type || 'video/webm');
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to stream recording' });
  }
});

// 8. Direct Download Recording (accepts recording.id OR meeting.id)
meetingsRouter.get('/:id/recording/download', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let recording: any = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);
    if (!recording) {
      recording = db.prepare(`
        SELECT * FROM recordings 
        WHERE meeting_id = ? AND (duration_seconds >= 2 OR size_bytes > 5000 OR status = 'recording')
        ORDER BY created_at DESC LIMIT 1
      `).get(id);
      if (!recording) {
        recording = db.prepare('SELECT * FROM recordings WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1').get(id);
      }
    }

    if (!recording || !fs.existsSync(recording.file_path)) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    // Ensure WebM has seekable duration header before downloading
    if (recording.duration_seconds && recording.duration_seconds > 0) {
      try {
        RecordingManager.patchWebmFileDuration(recording.file_path, recording.duration_seconds * 1000);
      } catch (patchErr) {
        console.warn('Could not pre-patch WebM duration before download:', patchErr);
      }
    }

    const downloadName = `TutorPlug_${recording.file_name}`;
    res.download(recording.file_path, downloadName);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to download recording' });
  }
});

// 9. Delete Meeting & Recording
meetingsRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recording: any = db.prepare('SELECT * FROM recordings WHERE meeting_id = ?').get(id);

    if (recording && fs.existsSync(recording.file_path)) {
      StorageService.deleteFile(recording.file_path);
    }

    db.prepare('DELETE FROM meetings WHERE id = ?').run(id);
    res.json({ success: true, message: 'Meeting and recording deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete meeting' });
  }
});
