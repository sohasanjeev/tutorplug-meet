import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { db, generateTutorPlugCode, ensureUserPersonalRoom, getOrCreateHostForCode } from '../db/database.js';
import { StorageService } from '../services/storage.js';
import { RecordingManager } from '../services/recordingManager.js';

import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.js';

export const meetingsRouter = Router();

function getAuthUser(req: Request): any {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      return jwt.verify(token, CONFIG.JWT_SECRET);
    } catch {}
  }
  const queryUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  if (queryUserId) {
    return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(queryUserId);
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
    let meetings: any[] = [];

    if (authUser && authUser.role === 'admin') {
      // Administrator: full visibility into all clients, students, and teachers' classes and recordings
      meetings = db.prepare(`
        SELECT 
          m.*,
          u.name AS host_name,
          u.email AS host_email,
          r.id AS recording_id,
          r.file_name AS recording_file_name,
          r.duration_seconds AS recording_duration,
          r.size_bytes AS recording_size_bytes,
          r.status AS recording_status,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM meetings m
        LEFT JOIN users u ON u.id = m.host_id
        LEFT JOIN recordings r ON r.id = (
          SELECT id FROM recordings WHERE meeting_id = m.id ORDER BY created_at DESC LIMIT 1
        )
        ORDER BY m.created_at DESC
      `).all();
    } else if (authUser && authUser.id) {
      // Regular User (Teacher or Student): see all meetings hosted or attended
      meetings = db.prepare(`
        SELECT 
          m.*,
          u.name AS host_name,
          u.email AS host_email,
          r.id AS recording_id,
          r.file_name AS recording_file_name,
          r.duration_seconds AS recording_duration,
          r.size_bytes AS recording_size_bytes,
          r.status AS recording_status,
          (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) AS participant_count,
          (SELECT COUNT(*) FROM messages WHERE meeting_id = m.id) AS message_count
        FROM meetings m
        LEFT JOIN users u ON u.id = m.host_id
        LEFT JOIN recordings r ON r.id = (
          SELECT id FROM recordings WHERE meeting_id = m.id ORDER BY created_at DESC LIMIT 1
        )
        WHERE m.host_id = ?
           OR m.id IN (SELECT meeting_id FROM meeting_participants WHERE user_id = ? OR LOWER(display_name) = LOWER(?))
           OR m.id IN (SELECT meeting_id FROM messages WHERE sender_id = ?)
           OR m.code = (SELECT personal_meeting_code FROM users WHERE id = ?)
        ORDER BY m.created_at DESC
      `).all(authUser.id, authUser.id, authUser.name || '', authUser.id, authUser.id);
    } else {
      // Anonymous / Unauthenticated: return empty list
      meetings = [];
    }

    res.json({ meetings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch meeting history' });
  }
});

// 6. Meeting Detail (recording, participants, chat transcript, shared media)
meetingsRouter.get('/detail/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const meeting: any = db.prepare('SELECT * FROM meetings WHERE id = ? OR code = ?').get(id, id);

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    const authUser = getAuthUser(req);
    if (authUser && authUser.role !== 'admin' && meeting.host_id && meeting.host_id !== authUser.id) {
      // Check if user was an attendee/participant or sent messages in this meeting
      const isParticipant = db.prepare(`
        SELECT 1 FROM meeting_participants 
        WHERE meeting_id = ? AND (user_id = ? OR LOWER(display_name) = LOWER(?))
      `).get(meeting.id, authUser.id, authUser.name || '');

      const isSender = db.prepare(`
        SELECT 1 FROM messages WHERE meeting_id = ? AND sender_id = ?
      `).get(meeting.id, authUser.id);

      if (!isParticipant && !isSender) {
        res.status(403).json({ error: 'Access denied: You can only view recordings for classes you hosted or attended.' });
        return;
      }
    }

    const recording: any = db.prepare('SELECT * FROM recordings WHERE meeting_id = ? ORDER BY created_at DESC LIMIT 1').get(meeting.id);
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
    const meeting: any = db.prepare('SELECT * FROM meetings WHERE id = ? OR code = ?').get(id, id);
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


// 7. Stream Recording Video
meetingsRouter.get('/:id/recording/stream', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recording: any = db.prepare('SELECT * FROM recordings WHERE id = ? OR meeting_id = ?').get(id, id);

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

// 8. Direct Download Recording
meetingsRouter.get('/:id/recording/download', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recording: any = db.prepare('SELECT * FROM recordings WHERE id = ? OR meeting_id = ?').get(id, id);

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
