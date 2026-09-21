import fs from 'fs';
import path from 'path';
import { Response, Request } from 'express';
import { CONFIG } from '../config.js';

export interface StorageFileMeta {
  key: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  filePath: string;
}

export class StorageService {
  /**
   * Save a buffer or file stream into local storage
   */
  static saveFile(subDir: 'uploads' | 'recordings', fileName: string, data: Buffer): string {
    const targetDir = subDir === 'uploads' ? CONFIG.UPLOADS_DIR : CONFIG.RECORDINGS_DIR;
    const filePath = path.join(targetDir, fileName);
    fs.writeFileSync(filePath, data);
    return filePath;
  }

  /**
   * Stream a media file supporting HTTP Range headers for seeking/scrubbing
   */
  static streamMediaFile(req: Request, res: Response, filePath: string, defaultMime = 'video/webm'): void {
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Range header format: "bytes=0-1024"
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(416).header('Content-Range', `bytes */${fileSize}`).send();
        return;
      }

      const chunksize = end - start + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': defaultMime,
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': defaultMime,
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  }

  /**
   * Delete an object from disk
   */
  static deleteFile(filePath: string): boolean {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (e) {
      console.error('Failed to delete file:', e);
    }
    return false;
  }
}
