import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/database.js';
import { RecordingManager } from './recordingManager.js';

interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  role: 'host' | 'cohost' | 'participant';
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: string;
}

export function setupSignaling(io: Server) {
  // Map of meetingCode -> Map<socketId, Participant>
  const rooms: Map<string, Map<string, Participant>> = new Map();
  // Map of meetingCode -> meetingId (database UUID)
  const meetingIdMap: Map<string, string> = new Map();

  io.on('connection', (socket: Socket) => {
    let currentMeetingCode: string | null = null;
    let currentMeetingId: string | null = null;

    // --- 1. Join Room ---
    socket.on('join-room', (data: { meetingCode: string; userId?: string; displayName: string; role?: string }) => {
      const { meetingCode, displayName } = data;
      const userId = data.userId || uuidv4();
      const role = (data.role as any) || 'participant';

      // Check meeting in DB
      let meeting: any = db.prepare('SELECT * FROM meetings WHERE code = ?').get(meetingCode);
      if (!meeting) {
        socket.emit('error', { message: 'Meeting not found' });
        return;
      }

      if (meeting.status === 'ended') {
        socket.emit('meeting:already-ended', { message: 'This meeting has already ended.' });
        return;
      }

      currentMeetingCode = meetingCode;
      currentMeetingId = meeting.id;
      meetingIdMap.set(meetingCode, meeting.id);

      socket.join(meetingCode);

      // Create room in memory if not exists
      if (!rooms.has(meetingCode)) {
        rooms.set(meetingCode, new Map());
      }
      const roomParticipants = rooms.get(meetingCode)!;

      const newParticipant: Participant = {
        socketId: socket.id,
        userId,
        displayName: displayName || 'Guest Participant',
        role: meeting.host_id === userId || role === 'host' ? 'host' : 'participant',
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      };

      roomParticipants.set(socket.id, newParticipant);

      // Log participant in DB
      try {
        db.prepare(`
          INSERT INTO meeting_participants (id, meeting_id, user_id, display_name, role)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), meeting.id, userId, newParticipant.displayName, newParticipant.role);
      } catch (err) {
        console.error('Error logging participant:', err);
      }

      // CRITICAL FEATURE: Automatically start recording continuously on first join
      const recordingStatus = RecordingManager.startRecording(meeting.id);

      // Notify the joining user of existing participants and recording status
      const existingParticipants = Array.from(roomParticipants.values()).filter((p) => p.socketId !== socket.id);

      socket.emit('room-joined', {
        meetingId: meeting.id,
        meetingCode: meeting.code,
        meetingTitle: meeting.title,
        self: newParticipant,
        participants: existingParticipants,
        recording: {
          isRecording: true,
          recordingId: recordingStatus.recordingId,
          startedAt: recordingStatus.startedAt,
        },
      });

      // Announce new participant to everyone else in the room
      socket.to(meetingCode).emit('user-connected', newParticipant);

      // Broadcast recording status to the room
      io.to(meetingCode).emit('recording:status', {
        isRecording: true,
        recordingId: recordingStatus.recordingId,
        startedAt: recordingStatus.startedAt,
      });

      console.log(`[Signaling] Participant ${newParticipant.displayName} (${socket.id}) joined room ${meetingCode}`);
    });

    // --- 2. WebRTC Peer Signaling Relay (Offer, Answer, ICE Candidate) ---
    socket.on('signal', (data: { to: string; signal: any }) => {
      io.to(data.to).emit('signal', {
        from: socket.id,
        signal: data.signal,
      });
    });

    // --- 3. Media State Updates (Mute/Camera/Screen Share) ---
    socket.on('media-state', (data: { audioEnabled?: boolean; videoEnabled?: boolean; isScreenSharing?: boolean }) => {
      if (!currentMeetingCode || !rooms.has(currentMeetingCode)) return;
      const participant = rooms.get(currentMeetingCode)!.get(socket.id);
      if (participant) {
        if (data.audioEnabled !== undefined) participant.audioEnabled = data.audioEnabled;
        if (data.videoEnabled !== undefined) participant.videoEnabled = data.videoEnabled;
        if (data.isScreenSharing !== undefined) participant.isScreenSharing = data.isScreenSharing;

        socket.to(currentMeetingCode).emit('participant-media-changed', {
          socketId: socket.id,
          ...data,
        });
      }
    });

    // --- 4. Active Speaker Volume Level Meter ---
    socket.on('audio-level', (data: { level: number }) => {
      if (!currentMeetingCode) return;
      socket.to(currentMeetingCode).emit('active-speaker', {
        socketId: socket.id,
        level: data.level,
      });
    });

    // --- 5. Hand Raise ---
    socket.on('hand-raise', (data: { isRaised: boolean }) => {
      if (!currentMeetingCode || !rooms.has(currentMeetingCode)) return;
      const participant = rooms.get(currentMeetingCode)!.get(socket.id);
      if (participant) {
        participant.isHandRaised = data.isRaised;
        io.to(currentMeetingCode).emit('hand-raise-updated', {
          socketId: socket.id,
          displayName: participant.displayName,
          isRaised: data.isRaised,
        });
      }
    });

    // --- 6. Live Emoji Reactions ---
    socket.on('send-reaction', (data: { emoji: string }) => {
      if (!currentMeetingCode || !rooms.has(currentMeetingCode)) return;
      const participant = rooms.get(currentMeetingCode)!.get(socket.id);
      const senderName = participant ? participant.displayName : 'Participant';
      io.to(currentMeetingCode).emit('reaction-received', {
        emoji: data.emoji,
        senderName,
        id: uuidv4(),
      });
    });

    // --- 7. Real-Time Chat & File Attachments ---
    socket.on('send-chat', (data: {
      content?: string;
      messageType?: 'text' | 'image' | 'video' | 'file';
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
      fileMimeType?: string;
    }) => {
      if (!currentMeetingCode || !currentMeetingId || !rooms.has(currentMeetingCode)) return;
      const participant = rooms.get(currentMeetingCode)!.get(socket.id);
      const senderName = participant ? participant.displayName : 'Anonymous';
      const senderId = participant ? participant.userId : socket.id;

      const messageId = uuidv4();
      const messageType = data.messageType || 'text';
      const content = data.content || '';

      // Persist in DB
      try {
        db.prepare(`
          INSERT INTO messages (
            id, meeting_id, sender_id, sender_name, content, message_type,
            file_url, file_name, file_size, file_mime_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          messageId,
          currentMeetingId,
          senderId,
          senderName,
          content,
          messageType,
          data.fileUrl || null,
          data.fileName || null,
          data.fileSize || null,
          data.fileMimeType || null
        );
      } catch (err) {
        console.error('Error saving chat message:', err);
      }

      const chatPayload = {
        id: messageId,
        meetingId: currentMeetingId,
        senderId,
        senderName,
        content,
        messageType,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileSize: data.fileSize,
        fileMimeType: data.fileMimeType,
        createdAt: new Date().toISOString(),
      };

      io.to(currentMeetingCode).emit('chat-message', chatPayload);
    });

    // --- 8. Continuous Server-Side Recording Ingest ---
    socket.on('recording-chunk', (chunk: ArrayBuffer | Buffer) => {
      if (currentMeetingId) {
        RecordingManager.appendChunk(currentMeetingId, chunk);
      }
    });

    // --- 9. Host Moderation Controls ---
    socket.on('host-mute-participant', (data: { targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-instructed-mute');
    });

    socket.on('host-mute-all', () => {
      if (!currentMeetingCode) return;
      socket.to(currentMeetingCode).emit('host-instructed-mute');
    });

    socket.on('host-kick-participant', (data: { targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-kicked-you');
    });

    socket.on('host-end-meeting-all', async () => {
      if (!currentMeetingCode || !currentMeetingId) return;

      console.log(`[Signaling] Host initiated End Meeting For All in ${currentMeetingCode}`);

      // Update meeting status in DB
      db.prepare(`
        UPDATE meetings
        SET status = 'ended', ended_at = datetime('now')
        WHERE id = ?
      `).run(currentMeetingId);

      // Stop continuous recording and seal file
      const recordingRecord = await RecordingManager.stopRecording(currentMeetingId);

      // Notify all users in room
      io.to(currentMeetingCode).emit('meeting-ended-by-host', {
        recording: recordingRecord,
      });

      // Clear memory room
      rooms.delete(currentMeetingCode);
    });

    // --- 10. Disconnect Handling ---
    socket.on('disconnect', async () => {
      if (currentMeetingCode && rooms.has(currentMeetingCode)) {
        const roomParticipants = rooms.get(currentMeetingCode)!;
        const participant = roomParticipants.get(socket.id);
        roomParticipants.delete(socket.id);

        if (participant) {
          socket.to(currentMeetingCode).emit('user-disconnected', {
            socketId: socket.id,
            displayName: participant.displayName,
          });
        }

        // If last participant left room, automatically stop and seal recording
        if (roomParticipants.size === 0) {
          rooms.delete(currentMeetingCode);
          if (currentMeetingId) {
            console.log(`[Signaling] Room ${currentMeetingCode} is empty. Sealing continuous recording.`);
            await RecordingManager.stopRecording(currentMeetingId);
            db.prepare(`
              UPDATE meetings
              SET status = 'ended', ended_at = datetime('now')
              WHERE id = ? AND status = 'active'
            `).run(currentMeetingId);
          }
        }
      }
    });
  });
}
