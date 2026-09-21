import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const ROOT_DIR = fs.existsSync(path.resolve(process.cwd(), 'server/data'))
  ? path.resolve(process.cwd(), 'server')
  : path.resolve(process.cwd());
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const RECORDINGS_DIR = path.join(DATA_DIR, 'recordings');

// Ensure directories exist
[DATA_DIR, UPLOADS_DIR, RECORDINGS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '5000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'tutorplug-super-secret-jwt-key-2026',
  DATA_DIR,
  UPLOADS_DIR,
  RECORDINGS_DIR,
  DB_PATH: path.join(DATA_DIR, 'aurameet.db'),
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  RETENTION_DAYS: parseInt(process.env.RETENTION_DAYS || '90', 10),
};
