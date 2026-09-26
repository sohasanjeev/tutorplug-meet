import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, ensureUserPersonalRoom } from '../db/database.js';
import { CONFIG } from '../config.js';

export const authRouter = Router();

export const ADMIN_EMAILS = ['admin@tutorplug.com', 'sanjeev@tutorplug.com', 'sanjeevgupta052020@gmail.com'];

function buildUserProfile(user: any) {
  const isDedicatedAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase()) || user.role === 'admin';
  const effectiveRole = isDedicatedAdmin ? 'admin' : (user.role === 'admin' ? 'teacher' : (user.role || (user.user_type === 'student' ? 'student' : 'teacher')));
  const effectiveUserType = isDedicatedAdmin ? 'admin' : (user.user_type || (effectiveRole === 'student' ? 'student' : 'teacher'));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: effectiveRole,
    userType: effectiveUserType,
    rollNumber: user.roll_number || (effectiveUserType === 'student' ? `TP-STU-${user.id.slice(0, 4).toUpperCase()}` : undefined),
    bio: user.bio || '',
    classGrade: user.class_grade || '',
    avatar: user.avatar || '',
    personalMeetingCode: user.personal_meeting_code || '',
    allowedLinkQuota: user.allowed_link_quota || 1,
  };
}

// 1. Google / Gmail Sign-In Endpoint
authRouter.post('/google', (req: Request, res: Response) => {
  try {
    const { email, name, googleId, avatar, userType, rollNumber, classGrade } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required for Google Sign-In' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: any = db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?').get(cleanEmail, googleId || '');

    const isDedicatedAdmin = ADMIN_EMAILS.includes(cleanEmail);
    const assignedUserType = isDedicatedAdmin ? 'admin' : (userType === 'student' ? 'student' : 'teacher');
    const assignedRole = assignedUserType;

    if (!user) {
      // Create new user with Google credentials
      const userId = uuidv4();
      const displayName = name || cleanEmail.split('@')[0];
      const randomPassword = bcrypt.hashSync(uuidv4(), 10);
      const assignedRollNumber = assignedUserType === 'student' 
        ? (rollNumber?.trim() || `TP-STU-${Math.floor(1000 + Math.random() * 9000)}`)
        : null;

      db.prepare(`
        INSERT INTO users (
          id, name, email, password_hash, avatar, role, user_type,
          roll_number, class_grade, google_id, allowed_link_quota
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `).run(
        userId,
        displayName,
        cleanEmail,
        randomPassword,
        avatar || null,
        assignedRole,
        assignedUserType,
        assignedRollNumber,
        classGrade || null,
        googleId || uuidv4()
      );

      // Only assign permanent personal room to teachers & admins
      if (assignedUserType !== 'student') {
        ensureUserPersonalRoom(userId, displayName);
      }

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      // Ensure user has their permanent room if teacher/admin
      if (user.user_type !== 'student' && user.role !== 'student') {
        ensureUserPersonalRoom(user.id, user.name);
      }
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const userProfile = buildUserProfile(user);
    const token = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user: userProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Google authentication failed' });
  }
});

// 2. Standard Register (Teacher vs Student)
authRouter.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, userType, rollNumber, classGrade, bio, avatar } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email, and password are required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'Email already registered. Please sign in or continue with Google.' });
      return;
    }

    const isDedicatedAdmin = ADMIN_EMAILS.includes(cleanEmail);
    const assignedUserType = isDedicatedAdmin ? 'admin' : (userType === 'student' ? 'student' : 'teacher');
    const assignedRole = assignedUserType;
    const assignedRollNumber = assignedUserType === 'student'
      ? (rollNumber?.trim() || `TP-STU-${Math.floor(1000 + Math.random() * 9000)}`)
      : null;

    const userId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    db.prepare(`
      INSERT INTO users (
        id, name, email, password_hash, role, user_type,
        roll_number, class_grade, bio, avatar, allowed_link_quota
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      userId,
      name.trim(),
      cleanEmail,
      passwordHash,
      assignedRole,
      assignedUserType,
      assignedRollNumber,
      classGrade?.trim() || null,
      bio?.trim() || null,
      avatar || null
    );

    // Only teachers receive personal permanent meeting rooms
    if (assignedUserType !== 'student') {
      ensureUserPersonalRoom(userId, name);
    }

    const createdUser: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const userProfile = buildUserProfile(createdUser);

    const token = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user: userProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// 3. Standard Login
authRouter.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: any = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Ensure permanent meeting room is initialized for teachers
    if (user.user_type !== 'student' && user.role !== 'student') {
      ensureUserPersonalRoom(user.id, user.name);
    }
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

    const userProfile = buildUserProfile(user);
    const token = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user: userProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// 4. Quick Guest Session
authRouter.post('/guest', (req: Request, res: Response) => {
  try {
    const { displayName, rollNumber, classGrade, avatar } = req.body;
    const name = displayName?.trim() || 'Guest Student';
    const guestId = 'guest_' + uuidv4().slice(0, 8);
    const guestRollNumber = rollNumber?.trim() || `TP-GUEST-${Math.floor(1000 + Math.random() * 9000)}`;

    const guestProfile = {
      id: guestId,
      name,
      email: `${guestId}@guest.local`,
      role: 'guest' as const,
      userType: 'student' as const,
      rollNumber: guestRollNumber,
      classGrade: classGrade?.trim() || '',
      avatar: avatar || '',
      allowedLinkQuota: 1,
    };

    const token = jwt.sign(guestProfile, CONFIG.JWT_SECRET, { expiresIn: '1d' });
    res.json({ user: guestProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to initialize guest session' });
  }
});

// 5. Current User Profile
authRouter.get('/me', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, CONFIG.JWT_SECRET);
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      res.json({ user: decoded });
      return;
    }

    const userProfile = buildUserProfile(user);
    res.json({ user: userProfile });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// 6. Update Permanent User Profile (Photo, Bio, Class/Grade, Roll Number)
authRouter.put('/profile', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, CONFIG.JWT_SECRET);
    const { name, avatar, bio, classGrade, rollNumber } = req.body;
    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updatedName = name?.trim() || user.name;
    const updatedAvatar = avatar !== undefined ? avatar : user.avatar;
    const updatedBio = bio !== undefined ? bio : user.bio;
    const updatedClassGrade = classGrade !== undefined ? classGrade : user.class_grade;
    const updatedRollNumber = rollNumber !== undefined ? rollNumber : user.roll_number;

    db.prepare(`
      UPDATE users
      SET name = ?, avatar = ?, bio = ?, class_grade = ?, roll_number = ?
      WHERE id = ?
    `).run(updatedName, updatedAvatar, updatedBio, updatedClassGrade, updatedRollNumber, user.id);

    const refreshed: any = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    const userProfile = buildUserProfile(refreshed);
    const newToken = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });

    res.json({ user: userProfile, token: newToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update profile' });
  }
});

// 7. Log Site Visit / Attendance
authRouter.post('/log-visit', (req: Request, res: Response) => {
  try {
    const { userId, userName, userEmail, path, action, meetingCode } = req.body;
    const ip = ((req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const userAgent = (req.headers['user-agent'] || 'browser').slice(0, 255);
    const id = uuidv4();

    db.prepare(`
      INSERT INTO site_visits (
        id, user_id, user_name, user_email, ip_address, user_agent, path, action, meeting_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId || null,
      userName || 'Anonymous Visitor',
      userEmail || null,
      ip,
      userAgent,
      path || '/',
      action || 'visit',
      meetingCode || null
    );

    res.json({ success: true, visitId: id });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to log visit' });
  }
});
