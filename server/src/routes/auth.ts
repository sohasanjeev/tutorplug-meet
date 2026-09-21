import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db, ensureUserPersonalRoom } from '../db/database.js';
import { CONFIG } from '../config.js';

export const authRouter = Router();

// 1. Google / Gmail Sign-In Endpoint
authRouter.post('/google', (req: Request, res: Response) => {
  try {
    const { email, name, googleId, avatar } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email is required for Google Sign-In' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: any = db.prepare('SELECT * FROM users WHERE email = ? OR google_id = ?').get(cleanEmail, googleId || '');

    if (!user) {
      // Create new user with Google credentials
      const userId = uuidv4();
      const displayName = name || cleanEmail.split('@')[0];
      const randomPassword = bcrypt.hashSync(uuidv4(), 10);

      db.prepare(`
        INSERT INTO users (id, name, email, password_hash, avatar, role, google_id, allowed_link_quota)
        VALUES (?, ?, ?, ?, ?, 'user', ?, 1)
      `).run(userId, displayName, cleanEmail, randomPassword, avatar || null, googleId || uuidv4());

      // Assign permanent personal room
      ensureUserPersonalRoom(userId, displayName);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      // Ensure user has their permanent room
      ensureUserPersonalRoom(user.id, user.name);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      personalMeetingCode: user.personal_meeting_code,
      allowedLinkQuota: user.allowed_link_quota || 1,
    };

    const token = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user: userProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Google authentication failed' });
  }
});

// 2. Standard Register
authRouter.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;
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

    const userId = uuidv4();
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, allowed_link_quota)
      VALUES (?, ?, ?, ?, 'user', 1)
    `).run(userId, name, cleanEmail, passwordHash);

    // Assign permanent personal meeting room
    const personalRoom = ensureUserPersonalRoom(userId, name);

    const user = {
      id: userId,
      name,
      email: cleanEmail,
      role: 'user',
      personalMeetingCode: personalRoom.code,
      allowedLinkQuota: 1,
    };

    const token = jwt.sign(user, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user, token });
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

    // Ensure permanent meeting room is initialized
    ensureUserPersonalRoom(user.id, user.name);
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      personalMeetingCode: user.personal_meeting_code,
      allowedLinkQuota: user.allowed_link_quota || 1,
    };

    const token = jwt.sign(userProfile, CONFIG.JWT_SECRET, { expiresIn: '14d' });
    res.json({ user: userProfile, token });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed' });
  }
});

// 4. Quick Guest Session
authRouter.post('/guest', (req: Request, res: Response) => {
  try {
    const { displayName } = req.body;
    const name = displayName?.trim() || 'Guest Student';
    const guestId = 'guest_' + uuidv4().slice(0, 8);

    const guestProfile = {
      id: guestId,
      name,
      email: `${guestId}@guest.local`,
      role: 'guest',
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

    const userProfile = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      personalMeetingCode: user.personal_meeting_code,
      allowedLinkQuota: user.allowed_link_quota || 1,
    };

    res.json({ user: userProfile });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});
