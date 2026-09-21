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
    const filePath = path.join(CONFIG.RECORDINGS_DIR, fileName);
    const writeStream = fs.createWriteStream(filePath, { flags: 'a' });

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

    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    session.writeStream.write(buffer);
    session.totalBytes += buffer.length;
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
