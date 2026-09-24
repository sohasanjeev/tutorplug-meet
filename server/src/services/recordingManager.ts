import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { CONFIG } from '../config.js';

interface ActiveRecordingSession {
  recordingId: string;
  meetingId: string;
  fileName: string;
  filePath: string;
  writeStream: fs.WriteStream;
  startedAtMs: number;
  totalBytes: number;
  headerWritten: boolean;
}

export class RecordingManager {
  private static sessions: Map<string, ActiveRecordingSession> = new Map();

  /**
   * Automatically starts continuous recording for a meeting if not already recording
   */
  static startRecording(meetingId: string): { recordingId: string; startedAt: string } {
    const existing = this.sessions.get(meetingId);
    if (existing) {
      return {
        recordingId: existing.recordingId,
        startedAt: new Date(existing.startedAtMs).toISOString(),
      };
    }

    const recordingId = uuidv4();
    const fileName = `rec_${meetingId}_${Date.now()}.webm`;
    if (!fs.existsSync(CONFIG.RECORDINGS_DIR)) {
      fs.mkdirSync(CONFIG.RECORDINGS_DIR, { recursive: true });
    }
    const filePath = path.join(CONFIG.RECORDINGS_DIR, fileName);
    const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
    writeStream.on('error', (err) => {
      console.error(`[RecordingManager] Stream error for meeting ${meetingId}:`, err);
    });

    const session: ActiveRecordingSession = {
      recordingId,
      meetingId,
      fileName,
      filePath,
      writeStream,
      startedAtMs: Date.now(),
      totalBytes: 0,
      headerWritten: false,
    };

    this.sessions.set(meetingId, session);

    // Record entry in database
    db.prepare(`
      INSERT INTO recordings (
        id, meeting_id, file_name, file_path, duration_seconds, size_bytes,
        mime_type, status, started_at
      ) VALUES (?, ?, ?, ?, 0, 0, 'video/webm', 'recording', datetime('now'))
    `).run(recordingId, meetingId, fileName, filePath);

    console.log(`[RecordingManager] ⏺ Auto-recording initiated for meeting ${meetingId} -> ${fileName}`);

    return {
      recordingId,
      startedAt: new Date(session.startedAtMs).toISOString(),
    };
  }

  /**
   * Appends an audio/video media chunk directly to the continuous recording file
   */
  static appendChunk(meetingId: string, chunk: Buffer | ArrayBuffer): void {
    const session = this.sessions.get(meetingId);
    if (!session) return;

    try {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      session.writeStream.write(buffer);
      session.totalBytes += buffer.length;
    } catch (err) {
      console.error(`[RecordingManager] Error writing chunk for ${meetingId}:`, err);
    }
  }

  /**
   * Checks if a meeting is actively being recorded
   */
  static isRecording(meetingId: string): boolean {
    return this.sessions.has(meetingId);
  }

  /**
   * Retrieves live recording metrics
   */
  static getLiveMetrics(meetingId: string) {
    const session = this.sessions.get(meetingId);
    if (!session) return null;

    const durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000));
    return {
      recordingId: session.recordingId,
      durationSeconds,
      sizeBytes: session.totalBytes,
      startedAt: new Date(session.startedAtMs).toISOString(),
    };
  }

  /**
   * Patches the WebM file's EBML Info header with an accurate Duration element
   * so media players and browsers can seek/scrub across the entire video.
   */
  static patchWebmFileDuration(filePath: string, durationMs: number): boolean {
    try {
      if (!fs.existsSync(filePath)) return false;
      const buffer = fs.readFileSync(filePath);
      if (buffer.length < 50) return false;

      const infoHeader = Buffer.from([0x15, 0x49, 0xa9, 0x66]);
      const durationHeader = Buffer.from([0x44, 0x89]);

      const infoPos = buffer.indexOf(infoHeader);
      if (infoPos === -1) return false;

      // Check if Duration (0x44 0x89) is already present in Info
      const searchLimit = Math.min(buffer.length, infoPos + 300);
      const existingDurationPos = buffer.indexOf(durationHeader, infoPos);

      if (existingDurationPos !== -1 && existingDurationPos < searchLimit) {
        const lenByte = buffer[existingDurationPos + 2];
        if (lenByte === 0x84) {
          const durBuf = Buffer.alloc(4);
          durBuf.writeFloatBE(durationMs, 0);
          durBuf.copy(buffer, existingDurationPos + 3);
          fs.writeFileSync(filePath, buffer);
          return true;
        } else if (lenByte === 0x88) {
          const durBuf = Buffer.alloc(8);
          durBuf.writeDoubleBE(durationMs, 0);
          durBuf.copy(buffer, existingDurationPos + 3);
          fs.writeFileSync(filePath, buffer);
          return true;
        }
      }

      // If Duration is not in Info, parse Info length vint and insert Duration element
      const infoLenPos = infoPos + 4;
      const firstByte = buffer[infoLenPos];
      let vintLen = 1;
      let mask = 0x80;
      while (!(firstByte & mask) && vintLen < 8) {
        mask >>= 1;
        vintLen++;
      }

      let infoDataLen = firstByte & (mask - 1);
      for (let i = 1; i < vintLen; i++) {
        infoDataLen = (infoDataLen << 8) | buffer[infoLenPos + i];
      }

      const infoDataStart = infoLenPos + vintLen;
      const timecodeScaleHeader = Buffer.from([0x2a, 0xd7, 0xb1]);
      const tcPos = buffer.indexOf(timecodeScaleHeader, infoDataStart);

      let insertPos = infoDataStart;
      if (tcPos !== -1 && tcPos < infoDataStart + 50) {
        const tcValLen = buffer[tcPos + 3] & 0x7f;
        insertPos = tcPos + 4 + tcValLen;
      }

      // Build Duration element: ID (0x44, 0x89) + length (0x88 = 8 bytes float) + 8-byte double
      const durationElem = Buffer.alloc(11);
      durationElem[0] = 0x44;
      durationElem[1] = 0x89;
      durationElem[2] = 0x88;
      durationElem.writeDoubleBE(durationMs, 3);

      const newInfoDataLen = infoDataLen + durationElem.length;
      const newBuffer = Buffer.concat([
        buffer.subarray(0, insertPos),
        durationElem,
        buffer.subarray(insertPos),
      ]);

      if (vintLen === 1 && newInfoDataLen < 127) {
        newBuffer[infoLenPos] = 0x80 | newInfoDataLen;
      } else {
        const updatedVint = Buffer.alloc(vintLen);
        let temp = newInfoDataLen;
        for (let i = vintLen - 1; i >= 0; i--) {
          updatedVint[i] = temp & 0xff;
          temp >>= 8;
        }
        updatedVint[0] |= (0x80 >> (vintLen - 1));
        updatedVint.copy(newBuffer, infoLenPos);
      }

      fs.writeFileSync(filePath, newBuffer);
      console.log(`[RecordingManager] ⏱ Successfully injected ${durationMs}ms duration into ${filePath}`);
      return true;
    } catch (err) {
      console.warn('[RecordingManager] Failed to patch WebM duration:', err);
      return false;
    }
  }

  /**
   * Stops recording and finalizes the recording file and database record
   */
  static stopRecording(meetingId: string): Promise<any> {
    return new Promise((resolve) => {
      const session = this.sessions.get(meetingId);
      if (!session) {
        resolve(null);
        return;
      }

      this.sessions.delete(meetingId);

      const durationSeconds = Math.max(1, Math.round((Date.now() - session.startedAtMs) / 1000));

      session.writeStream.end(() => {
        try {
          // Patch EBML duration header so video is fully seekable/scrubbable
          RecordingManager.patchWebmFileDuration(session.filePath, durationSeconds * 1000);

          const stats = fs.existsSync(session.filePath) ? fs.statSync(session.filePath) : null;
          const finalSize = stats ? stats.size : session.totalBytes;

          // If no chunks were received, mark accordingly
          if (finalSize === 0) {
            console.warn(`[RecordingManager] Warning: 0 bytes recorded for meeting ${meetingId}`);
          }

          db.prepare(`
            UPDATE recordings
            SET duration_seconds = ?,
                size_bytes = ?,
                status = 'ready',
                ended_at = datetime('now')
            WHERE id = ?
          `).run(durationSeconds, Math.max(finalSize, 1024), session.recordingId);

          console.log(`[RecordingManager] ⏹ Recording completed for meeting ${meetingId}. Duration: ${durationSeconds}s, Size: ${finalSize} bytes`);

          const record = db.prepare('SELECT * FROM recordings WHERE id = ?').get(session.recordingId);
          resolve(record);
        } catch (err) {
          console.error('[RecordingManager] Error finalizing recording:', err);
          resolve(null);
        }
      });
    });
  }
}
