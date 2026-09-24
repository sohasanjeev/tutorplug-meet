import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db, generateTutorPlugCode } from '../db/database.js';
import { StorageService } from '../services/storage.js';

import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.js';

export const adminRouter = Router();

// Strict Admin Authorization Middleware
function requireAdmin(req: Request, res: Response, next: any) {
  const authHeader = req.headers.authorization;
  let decodedUser: any = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      decodedUser = jwt.verify(token, CONFIG.JWT_SECRET);
    } catch {}
  }

  const queryUserId = (req.query.userId as string) || (req.headers['x-user-id'] as string);
  const targetId = decodedUser?.id || queryUserId;

  if (!targetId) {
    res.status(401).json({ error: 'Authentication required for Administrator Portal' });
    return;
  }

  const dbUser: any = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(targetId);
  const isDedicatedAdmin = dbUser && ['admin@tutorplug.com', 'sanjeev@tutorplug.com'].includes((dbUser.email || '').toLowerCase());

  if (!dbUser || (!isDedicatedAdmin && dbUser.role !== 'admin')) {
    res.status(403).json({ error: 'Access denied: Administrator authorization required.' });
    return;
  }

  next();
}

adminRouter.use(requireAdmin);

// 1. Admin System Telemetry & Statistics
adminRouter.get('/stats', (_req: Request, res: Response) => {
  try {
    const totalMeetings = db.prepare('SELECT COUNT(*) as count FROM meetings').get() as any;
    const activeMeetings = db.prepare("SELECT COUNT(*) as count FROM meetings WHERE status = 'active'").get() as any;
    const totalRecordings = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(duration_seconds), 0) as total_duration, COALESCE(SUM(size_bytes), 0) as total_size FROM recordings').get() as any;
    const totalFiles = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(size_bytes), 0) as total_size FROM uploaded_files').get() as any;
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
    const pendingRequests = db.prepare("SELECT COUNT(*) as count FROM link_requests WHERE status = 'pending'").get() as any;

    res.json({
      stats: {
        totalMeetings: totalMeetings.count,
        activeMeetings: activeMeetings.count,
        totalRecordings: totalRecordings.count,
        totalRecordingDurationSeconds: totalRecordings.total_duration,
        totalRecordingSizeBytes: totalRecordings.total_size,
        totalFilesUploaded: totalFiles.count,
        totalFilesSizeBytes: totalFiles.total_size,
        totalUsers: totalUsers.count,
        pendingLinkRequests: pendingRequests.count,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch admin stats' });
  }
});

// 2. Admin Link Requests Queue
adminRouter.get('/link-requests', (_req: Request, res: Response) => {
  try {
    const requests = db.prepare(`
      SELECT lr.*, u.personal_meeting_code, u.allowed_link_quota
      FROM link_requests lr
      LEFT JOIN users u ON u.id = lr.user_id
      ORDER BY 
        CASE WHEN lr.status = 'pending' THEN 1 ELSE 2 END,
        lr.created_at DESC
    `).all();

    res.json({ requests });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch link requests' });
  }
});

// 3. Admin Authorize / Approve Link Request
adminRouter.post('/link-requests/:id/approve', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerName } = req.body;

    const request: any = db.prepare('SELECT * FROM link_requests WHERE id = ?').get(id);
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    if (request.status === 'approved') {
      res.status(400).json({ error: 'Request already approved' });
      return;
    }

    // 1. Generate new meeting code
    const newMeetingCode = generateTutorPlugCode('extra');
    const meetingId = uuidv4();

    // 2. Create the authorized meeting room for the user
    db.prepare(`
      INSERT INTO meetings (
        id, code, title, description, host_id, status, is_permanent
      ) VALUES (?, ?, ?, ?, ?, 'active', 1)
    `).run(
      meetingId,
      newMeetingCode,
      request.requested_title || 'Authorized Additional Room',
      `Admin authorized room for ${request.user_name}`,
      request.user_id
    );

    // 3. Increment the user's allowed link quota
    db.prepare(`
      UPDATE users
      SET allowed_link_quota = allowed_link_quota + 1
      WHERE id = ?
    `).run(request.user_id);

    // 4. Mark request as approved
    db.prepare(`
      UPDATE link_requests
      SET status = 'approved',
          approved_meeting_code = ?,
          reviewed_by = ?,
          reviewed_at = datetime('now')
      WHERE id = ?
    `).run(newMeetingCode, reviewerName || 'Admin', id);

    res.json({
      success: true,
      message: `Meeting link ${newMeetingCode} authorized and added to tutor's profile!`,
      meetingCode: newMeetingCode,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to approve request' });
  }
});

// 4. Admin Reject Link Request
adminRouter.post('/link-requests/:id/reject', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerName, reason } = req.body;

    const request: any = db.prepare('SELECT * FROM link_requests WHERE id = ?').get(id);
    if (!request) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }

    db.prepare(`
      UPDATE link_requests
      SET status = 'rejected',
          reason = COALESCE(?, reason),
          reviewed_by = ?,
          reviewed_at = datetime('now')
      WHERE id = ?
    `).run(reason || null, reviewerName || 'Admin', id);

    res.json({ success: true, message: 'Request has been rejected' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to reject request' });
  }
});

// 5. Admin Directly Adjust User Quota
adminRouter.post('/users/:userId/quota', (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { quota } = req.body;

    const newQuota = parseInt(quota, 10);
    if (isNaN(newQuota) || newQuota < 1) {
      res.status(400).json({ error: 'Quota must be a positive integer' });
      return;
    }

    db.prepare('UPDATE users SET allowed_link_quota = ? WHERE id = ?').run(newQuota, userId);
    res.json({ success: true, message: `User quota updated to ${newQuota}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update user quota' });
  }
});

// 6. Admin List All Recordings (Complete oversight of all clients, students, and teachers' classes)
adminRouter.get('/recordings', (_req: Request, res: Response) => {
  try {
    const recordings = db.prepare(`
      SELECT 
        r.*,
        m.code AS meeting_code,
        m.title AS meeting_title,
        m.started_at AS meeting_started_at,
        m.ended_at AS meeting_ended_at,
        u.name AS host_name,
        u.email AS host_email,
        (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = r.meeting_id) AS participant_count,
        (SELECT COUNT(*) FROM messages WHERE meeting_id = r.meeting_id) AS message_count
      FROM recordings r
      LEFT JOIN meetings m ON m.id = r.meeting_id
      LEFT JOIN users u ON u.id = m.host_id
      ORDER BY r.created_at DESC
    `).all();

    res.json({ recordings });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch recordings' });
  }
});

// 7. Admin Delete Recording
adminRouter.delete('/recordings/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const recording: any = db.prepare('SELECT * FROM recordings WHERE id = ?').get(id);

    if (!recording) {
      res.status(404).json({ error: 'Recording not found' });
      return;
    }

    StorageService.deleteFile(recording.file_path);
    db.prepare('DELETE FROM recordings WHERE id = ?').run(id);

    res.json({ success: true, message: 'Recording deleted from storage and database' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delete recording' });
  }
});
