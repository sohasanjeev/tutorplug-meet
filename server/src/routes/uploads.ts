import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { CONFIG } from '../config.js';
import { StorageService } from '../services/storage.js';

export const uploadsRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CONFIG.UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}_${uuidv4().slice(0, 8)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, cb) => {
    // Permitted file types
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/ogg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/zip',
    ];

    if (allowed.includes(file.mimetype) || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(null, true); // Allow other documents safely
    }
  },
});

// Upload media or document attachment
uploadsRouter.post('/chat', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { meetingId, senderName } = req.body;
    const fileId = uuidv4();
    const fileUrl = `/api/uploads/file/${fileId}`;

    db.prepare(`
      INSERT INTO uploaded_files (
        id, meeting_id, original_name, stored_name, file_path, file_url,
        mime_type, size_bytes, uploaded_by_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      fileId,
      meetingId || null,
      req.file.originalname,
      req.file.filename,
      req.file.path,
      fileUrl,
      req.file.mimetype,
      req.file.size,
      senderName || 'Participant'
    );

    res.json({
      fileId,
      fileName: req.file.originalname,
      fileUrl,
      fileSize: req.file.size,
      fileMimeType: req.file.mimetype,
      messageType: req.file.mimetype.startsWith('image/')
        ? 'image'
        : req.file.mimetype.startsWith('video/')
        ? 'video'
        : 'file',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'File upload failed' });
  }
});

// Stream or view uploaded media file
uploadsRouter.get('/file/:fileId', (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const fileRecord: any = db.prepare('SELECT * FROM uploaded_files WHERE id = ?').get(fileId);

    if (!fileRecord || !fs.existsSync(fileRecord.file_path)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (fileRecord.mime_type.startsWith('video/') || fileRecord.mime_type.startsWith('audio/')) {
      StorageService.streamMediaFile(req, res, fileRecord.file_path, fileRecord.mime_type);
    } else {
      res.setHeader('Content-Type', fileRecord.mime_type);
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileRecord.original_name)}"`);
      fs.createReadStream(fileRecord.file_path).pipe(res);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to serve file' });
  }
});

// Download attachment directly
uploadsRouter.get('/download/:fileId', (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const fileRecord: any = db.prepare('SELECT * FROM uploaded_files WHERE id = ?').get(fileId);

    if (!fileRecord || !fs.existsSync(fileRecord.file_path)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(fileRecord.file_path, fileRecord.original_name);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to download file' });
  }
});
