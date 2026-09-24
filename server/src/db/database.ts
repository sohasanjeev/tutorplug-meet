import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { CONFIG } from '../config.js';


export const db = new DatabaseSync(CONFIG.DB_PATH);

// Helper to generate TutorPlug formatted meeting code
export function generateTutorPlugCode(prefix?: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const randSegment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const cleanPrefix = prefix ? prefix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6) : 'tp';
  return `tp-${cleanPrefix}-${randSegment(4)}`;
}

// Initialize database schema and migrations
export function initDatabase() {
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');

  // 1. Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      google_id TEXT UNIQUE,
      personal_meeting_code TEXT UNIQUE,
      personal_meeting_id TEXT,
      allowed_link_quota INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Safe migrations for existing SQLite databases
  const userColumns = db.prepare('PRAGMA table_info(users)').all() as any[];
  const userColumnNames = userColumns.map((c) => c.name);

  if (!userColumnNames.includes('google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT;');
  }
  if (!userColumnNames.includes('personal_meeting_code')) {
    db.exec('ALTER TABLE users ADD COLUMN personal_meeting_code TEXT;');
  }
  if (!userColumnNames.includes('personal_meeting_id')) {
    db.exec('ALTER TABLE users ADD COLUMN personal_meeting_id TEXT;');
  }
  if (!userColumnNames.includes('allowed_link_quota')) {
    db.exec('ALTER TABLE users ADD COLUMN allowed_link_quota INTEGER NOT NULL DEFAULT 1;');
  }
  if (!userColumnNames.includes('user_type')) {
    db.exec("ALTER TABLE users ADD COLUMN user_type TEXT NOT NULL DEFAULT 'teacher';");
  }
  if (!userColumnNames.includes('roll_number')) {
    db.exec('ALTER TABLE users ADD COLUMN roll_number TEXT;');
  }
  if (!userColumnNames.includes('bio')) {
    db.exec('ALTER TABLE users ADD COLUMN bio TEXT;');
  }
  if (!userColumnNames.includes('class_grade')) {
    db.exec('ALTER TABLE users ADD COLUMN class_grade TEXT;');
  }

  // 2. Meetings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      host_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', -- 'scheduled', 'active', 'ended'
      scheduled_start_time TEXT,
      started_at TEXT,
      ended_at TEXT,
      is_locked INTEGER NOT NULL DEFAULT 0,
      waiting_room_enabled INTEGER NOT NULL DEFAULT 0,
      is_permanent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const meetingColumns = db.prepare('PRAGMA table_info(meetings)').all() as any[];
  const meetingColumnNames = meetingColumns.map((c) => c.name);
  if (!meetingColumnNames.includes('is_permanent')) {
    db.exec('ALTER TABLE meetings ADD COLUMN is_permanent INTEGER NOT NULL DEFAULT 0;');
  }

  // 3. Participants table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      user_id TEXT,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'participant',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      left_at TEXT,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `);

  // 4. Automatic Continuous Recordings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      size_bytes INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT NOT NULL DEFAULT 'video/webm',
      status TEXT NOT NULL DEFAULT 'recording',
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `);

  // 5. In-Meeting Chat Messages & Shared Media table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      content TEXT,
      message_type TEXT NOT NULL DEFAULT 'text',
      file_url TEXT,
      file_name TEXT,
      file_size INTEGER,
      file_mime_type TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    );
  `);

  // 6. Stored Media / Uploaded Files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      meeting_id TEXT,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_url TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // 7. Additional Meeting Link Authorization Requests table
  db.exec(`
    CREATE TABLE IF NOT EXISTS link_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT NOT NULL,
      requested_title TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      approved_meeting_code TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create indexes for fast lookup
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meetings_code ON meetings(code);
    CREATE INDEX IF NOT EXISTS idx_recordings_meeting_id ON recordings(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_messages_meeting_id ON messages(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_participants_meeting_id ON meeting_participants(meeting_id);
    CREATE INDEX IF NOT EXISTS idx_link_requests_user ON link_requests(user_id);
    CREATE INDEX IF NOT EXISTS idx_link_requests_status ON link_requests(status);
  `);

  // Seed default admin and demo user
  seedDefaultUsers();
}

/**
 * Ensures a user has an active permanent personal meeting room
 */
export function ensureUserPersonalRoom(userId: string, userName: string): { code: string; meetingId: string } {
  const user: any = db.prepare('SELECT personal_meeting_code, personal_meeting_id FROM users WHERE id = ?').get(userId);

  if (user?.personal_meeting_code && user?.personal_meeting_id) {
    // Check if the meeting record exists
    const meeting = db.prepare('SELECT id FROM meetings WHERE id = ?').get(user.personal_meeting_id);
    if (meeting) {
      return { code: user.personal_meeting_code, meetingId: user.personal_meeting_id };
    }
  }

  const meetingId = uuidv4();
  const firstName = userName.split(' ')[0] || 'tutor';
  const code = generateTutorPlugCode(firstName);
  const title = `${userName}'s Permanent Tutoring Room`;

  db.prepare(`
    INSERT INTO meetings (
      id, code, title, description, host_id, status, is_permanent
    ) VALUES (?, ?, ?, 'Personal Permanent Meeting Room for TutorPlug', ?, 'active', 1)
  `).run(meetingId, code, title, userId);

  db.prepare(`
    UPDATE users
    SET personal_meeting_code = ?, personal_meeting_id = ?
    WHERE id = ?
  `).run(code, meetingId, userId);

  return { code, meetingId };
}

/**
 * Resolves or safely provisions a valid user ID for a meeting code, guaranteeing foreign key integrity
 */
export function getOrCreateHostForCode(
  meetingCode: string,
  preferredName?: string,
  userIdCandidate?: string
): { hostId: string; hostName: string } {
  // 1. If candidate ID exists in users table, use it
  if (userIdCandidate) {
    const candidateUser: any = db.prepare('SELECT id, name FROM users WHERE id = ?').get(userIdCandidate);
    if (candidateUser) {
      return { hostId: candidateUser.id, hostName: candidateUser.name };
    }
  }

  // 2. Check if a user owns this personal meeting code
  const codeOwner: any = db.prepare('SELECT id, name FROM users WHERE LOWER(personal_meeting_code) = ?').get(meetingCode.toLowerCase());
  if (codeOwner) {
    return { hostId: codeOwner.id, hostName: codeOwner.name };
  }

  // 3. Check if any user matches the code slug (e.g. "sanjee" from tp-sanjee-rb27)
  const parts = meetingCode.split('-');
  const rawSlug = (parts[1] || 'tutor').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (rawSlug.length >= 3) {
    const matchedUser: any = db.prepare('SELECT id, name FROM users WHERE LOWER(name) LIKE ? LIMIT 1').get(`%${rawSlug}%`);
    if (matchedUser) {
      return { hostId: matchedUser.id, hostName: matchedUser.name };
    }
  }

  // 4. Formulate clean name
  const cleanName = preferredName?.trim() || (rawSlug.charAt(0).toUpperCase() + rawSlug.slice(1));
  const tutorEmail = `${rawSlug || 'tutor'}_${meetingCode.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase()}@tutorplug.com`;

  // 5. Check if user with this email already exists
  const existingByEmail: any = db.prepare('SELECT id, name FROM users WHERE email = ?').get(tutorEmail);
  if (existingByEmail) {
    return { hostId: existingByEmail.id, hostName: existingByEmail.name };
  }

  // 6. Create valid user in DB so foreign key is guaranteed
  try {
    const newUserId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Tutor@123456', salt);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, personal_meeting_code)
      VALUES (?, ?, ?, ?, 'user', ?)
    `).run(newUserId, cleanName, tutorEmail, hash, meetingCode.toLowerCase());
    return { hostId: newUserId, hostName: cleanName };
  } catch {
    // Fallback to admin if collision
    const admin: any = db.prepare("SELECT id, name FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      return { hostId: admin.id, hostName: cleanName };
    }
    const anyUser: any = db.prepare('SELECT id, name FROM users LIMIT 1').get();
    return { hostId: anyUser ? anyUser.id : uuidv4(), hostName: cleanName };
  }
}

function seedDefaultUsers() {
  const checkAdmin: any = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@tutorplug.com');
  if (!checkAdmin) {
    const adminId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Admin@123456', salt);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, user_type, allowed_link_quota)
      VALUES (?, ?, ?, ?, 'admin', 'admin', 10)
    `).run(adminId, 'TutorPlug Administrator', 'admin@tutorplug.com', hash);
    ensureUserPersonalRoom(adminId, 'TutorPlug Admin');
  }

  const checkDemo: any = db.prepare('SELECT id FROM users WHERE email = ?').get('tutor@tutorplug.com');
  if (!checkDemo) {
    const demoId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Tutor@123456', salt);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, user_type, allowed_link_quota)
      VALUES (?, ?, ?, ?, 'teacher', 'teacher', 1)
    `).run(demoId, 'Sarah Jenkins (Tutor)', 'tutor@tutorplug.com', hash);
    ensureUserPersonalRoom(demoId, 'Sarah');
  }

  // Pre-seed Sanjeev's permanent room
  const checkSanjeev: any = db.prepare('SELECT id FROM users WHERE email = ? OR LOWER(personal_meeting_code) = ?').get('sanjeev@tutorplug.com', 'tp-sanjee-rb27');
  if (!checkSanjeev) {
    const sanjeevId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('Sanjeev@123', salt);
    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, user_type, allowed_link_quota, personal_meeting_code)
      VALUES (?, ?, ?, ?, 'admin', 'admin', 10, 'tp-sanjee-rb27')
    `).run(sanjeevId, 'Sanjeev', 'sanjeev@tutorplug.com', hash);

    const existingMeeting: any = db.prepare('SELECT id FROM meetings WHERE LOWER(code) = ?').get('tp-sanjee-rb27');
    if (!existingMeeting) {
      const meetingId = uuidv4();
      db.prepare(`
        INSERT INTO meetings (id, code, title, description, host_id, status, is_permanent)
        VALUES (?, 'tp-sanjee-rb27', 'Sanjeev''s Tutoring Room', 'Permanent Tutoring Room for TutorPlug', ?, 'active', 1)
      `).run(meetingId, sanjeevId);
      db.prepare('UPDATE users SET personal_meeting_id = ? WHERE id = ?').run(meetingId, sanjeevId);
    } else {
      db.prepare('UPDATE meetings SET host_id = ? WHERE id = ?').run(sanjeevId, existingMeeting.id);
      db.prepare('UPDATE users SET personal_meeting_id = ? WHERE id = ?').run(existingMeeting.id, sanjeevId);
    }
  }

  // Enforce strict admin isolation: only designated admin emails retain admin role
  db.prepare("UPDATE users SET role = 'admin', user_type = 'admin' WHERE LOWER(email) IN ('admin@tutorplug.com', 'sanjeev@tutorplug.com')").run();
  db.prepare("UPDATE users SET role = 'teacher', user_type = 'teacher' WHERE LOWER(email) NOT IN ('admin@tutorplug.com', 'sanjeev@tutorplug.com') AND role = 'admin'").run();

  // Finalize any dangling recordings from previous sessions so they appear ready
  try {
    const danglingRecordings: any[] = db.prepare("SELECT * FROM recordings WHERE status = 'recording'").all();
    for (const rec of danglingRecordings) {
      if (fs.existsSync(rec.file_path)) {
        const stats = fs.statSync(rec.file_path);
        db.prepare(`
          UPDATE recordings
          SET status = 'ready',
              size_bytes = ?,
              duration_seconds = MAX(duration_seconds, 1),
              ended_at = datetime('now')
          WHERE id = ?
        `).run(stats.size, rec.id);
      } else {
        db.prepare("UPDATE recordings SET status = 'ready', ended_at = datetime('now') WHERE id = ?").run(rec.id);
      }
    }
  } catch (e) {
    console.error('Error finalizing dangling recordings:', e);
  }
}

