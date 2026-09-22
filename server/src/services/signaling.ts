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
  // Map of meetingCode -> Map<socketId, Participant>
  const rooms: Map<string, Map<string, Participant>> = new Map();
  // Map of meetingCode -> meetingId (database UUID)
  const meetingIdMap: Map<string, string> = new Map();
  // Map of meetingCode -> Map<socketId, WaitingParticipant>
  const waitingRooms: Map<string, Map<string, { socketId: string; userId: string; displayName: string; role: string; requestedAt: string; socket: Socket }>> = new Map();

  function broadcastWaitingList(meetingCode: string) {
    const waitingMap = waitingRooms.get(meetingCode);
    const waitingList = waitingMap ? Array.from(waitingMap.values()).map(w => ({
      socketId: w.socketId,
      userId: w.userId,
      displayName: w.displayName,
      requestedAt: w.requestedAt,
    })) : [];

    const roomParticipants = rooms.get(meetingCode);
    if (roomParticipants) {
      roomParticipants.forEach((p, sId) => {
        if (p.role === 'host') {
          io.to(sId).emit('waiting-list-updated', waitingList);
        }
      });
    }
  }

  io.on('connection', (socket: Socket) => {
    let currentMeetingCode: string | null = null;
    let currentMeetingId: string | null = null;

    // Helper: Execute complete admission into meeting room
    const admitUserToRoom = (targetSocket: Socket, meeting: any, userId: string, displayName: string, role: 'host' | 'participant') => {
      const meetingCode = meeting.code;
      currentMeetingCode = meetingCode;
      currentMeetingId = meeting.id;
      meetingIdMap.set(meetingCode, meeting.id);

      targetSocket.join(meetingCode);

      if (!rooms.has(meetingCode)) {
        rooms.set(meetingCode, new Map());
      }
      const roomParticipants = rooms.get(meetingCode)!;

      const newParticipant: Participant = {
        socketId: targetSocket.id,
        userId,
        displayName: displayName || 'Guest Participant',
        role,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      };

      roomParticipants.set(targetSocket.id, newParticipant);

      try {
        db.prepare(`
          INSERT INTO meeting_participants (id, meeting_id, user_id, display_name, role)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), meeting.id, userId, newParticipant.displayName, newParticipant.role);
      } catch (err) {
        console.error('Error logging participant:', err);
      }

      // Automatically start continuous recording on first join
      const recordingStatus = RecordingManager.startRecording(meeting.id);

      const existingParticipants = Array.from(roomParticipants.values()).filter((p) => p.socketId !== targetSocket.id);

      targetSocket.emit('room-joined', {
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

      targetSocket.to(meetingCode).emit('user-connected', newParticipant);

      io.to(meetingCode).emit('recording:status', {
        isRecording: true,
        recordingId: recordingStatus.recordingId,
        startedAt: recordingStatus.startedAt,
      });

      console.log(`[Signaling] Admitted participant ${newParticipant.displayName} (${targetSocket.id}) into ${meetingCode}`);
    };

    // --- 1. Join Room (With Host Admission & Knocking Control) ---
    socket.on('join-room', (data: any) => {
      const meetingCode = (data?.meetingCode || data?.roomId || '').trim();
      const displayName = data?.displayName || data?.userName || 'Participant';
      const userId = data?.userId || uuidv4();
      const requestedRole = (data?.role as any) || (data?.isHost ? 'host' : 'participant');

      if (!meetingCode) {
        socket.emit('error', { message: 'Meeting code is required' });
        return;
      }

      let meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(meetingCode.toLowerCase());
      if (!meeting) {
        // Auto-provision if it's a personal or valid code
        const user = db.prepare('SELECT * FROM users WHERE LOWER(personal_meeting_code) = ?').get(meetingCode.toLowerCase()) as any;
        if (user) {
          const newId = uuidv4();
          db.prepare(`
            INSERT INTO meetings (id, code, title, description, host_id, status, is_permanent)
            VALUES (?, ?, ?, ?, ?, 'active', 1)
          `).run(newId, user.personal_meeting_code, `${user.name}'s Tutoring Room`, 'Permanent Tutoring Room for TutorPlug', user.id);
          meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(newId);
        } else if (meetingCode.toLowerCase().startsWith('tp-')) {
          const firstUser = db.prepare('SELECT id, name FROM users LIMIT 1').get() as any;
          const hostId = firstUser ? firstUser.id : uuidv4();
          const hostName = firstUser ? firstUser.name : 'TutorPlug Tutor';
          const newId = uuidv4();
          db.prepare(`
            INSERT INTO meetings (id, code, title, description, host_id, status, is_permanent)
            VALUES (?, ?, ?, ?, ?, 'active', 1)
          `).run(newId, meetingCode.toLowerCase(), `${hostName}'s Room`, 'Tutoring Session on TutorPlug', hostId);
          meeting = db.prepare('SELECT * FROM meetings WHERE id = ?').get(newId);
        }
      }

      if (!meeting) {
        socket.emit('error', { message: 'Meeting not found' });
        return;
      }

      if (meeting.status === 'ended' && !meeting.is_permanent) {
        socket.emit('meeting:already-ended', { message: 'This meeting has already ended.' });
        return;
      }

      const isHost = meeting.host_id === userId || requestedRole === 'host';

      if (isHost) {
        // HOST BYPASSES WAITING ROOM & ENTERS IMMEDIATELY
        admitUserToRoom(socket, meeting, userId, displayName, 'host');

        // Check if students are waiting for this host to start the class
        const waitingMap = waitingRooms.get(meetingCode);
        if (waitingMap && waitingMap.size > 0) {
          waitingMap.forEach((waitingUser) => {
            waitingUser.socket.emit('waiting-admission', {
              status: 'waiting_for_host_approval',
              meetingTitle: meeting.title,
            });
            socket.emit('join-request', {
              socketId: waitingUser.socketId,
              userId: waitingUser.userId,
              displayName: waitingUser.displayName,
              requestedAt: waitingUser.requestedAt,
            });
          });
          broadcastWaitingList(meetingCode);
        }
      } else {
        // NON-HOST PARTICIPANT (STUDENT / GUEST): ENTERS WAITING ROOM (KNOCKING)
        if (!waitingRooms.has(meetingCode)) {
          waitingRooms.set(meetingCode, new Map());
        }
        waitingRooms.get(meetingCode)!.set(socket.id, {
          socketId: socket.id,
          userId,
          displayName: displayName || 'Student',
          role: 'participant',
          requestedAt: new Date().toISOString(),
          socket,
        });

        const roomParticipants = rooms.get(meetingCode);
        const hostParticipant = roomParticipants ? Array.from(roomParticipants.values()).find((p) => p.role === 'host') : null;

        if (hostParticipant) {
          socket.emit('waiting-admission', {
            status: 'waiting_for_host_approval',
            meetingTitle: meeting.title,
          });

          // Send real-time knock toast to the host
          io.to(hostParticipant.socketId).emit('join-request', {
            socketId: socket.id,
            userId,
            displayName: displayName || 'Student',
            requestedAt: new Date().toISOString(),
          });
          broadcastWaitingList(meetingCode);
        } else {
          // Host has not joined yet
          socket.emit('waiting-admission', {
            status: 'host_not_present',
            meetingTitle: meeting.title,
          });
        }
      }
    });

    // --- Host Admission Control Handlers ---
    socket.on('admit-participant', (data: any) => {
      const targetId = data?.targetSocketId || data?.participantSocketId || data?.socketId;
      if (!currentMeetingCode || !targetId) return;
      const waitingMap = waitingRooms.get(currentMeetingCode);
      if (!waitingMap || !waitingMap.has(targetId)) return;

      const waitingUser = waitingMap.get(targetId)!;
      waitingMap.delete(targetId);

      const meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(currentMeetingCode.toLowerCase());
      if (meeting) {
        admitUserToRoom(waitingUser.socket, meeting, waitingUser.userId, waitingUser.displayName, 'participant');
      }
      broadcastWaitingList(currentMeetingCode);
    });

    socket.on('deny-participant', (data: any) => {
      const targetId = data?.targetSocketId || data?.participantSocketId || data?.socketId;
      if (!currentMeetingCode || !targetId) return;
      const waitingMap = waitingRooms.get(currentMeetingCode);
      if (!waitingMap || !waitingMap.has(targetId)) return;

      const waitingUser = waitingMap.get(targetId)!;
      waitingMap.delete(targetId);

      waitingUser.socket.emit('join-denied', {
        reason: data?.reason || 'The host did not admit you to the session.',
        message: data?.reason || 'The host did not admit you to this class.',
      });
      broadcastWaitingList(currentMeetingCode);
    });

    socket.on('admit-all', () => {
      if (!currentMeetingCode) return;
      const waitingMap = waitingRooms.get(currentMeetingCode);
      if (!waitingMap) return;

      const meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(currentMeetingCode.toLowerCase());
      if (!meeting) return;

      waitingMap.forEach((waitingUser, sId) => {
        admitUserToRoom(waitingUser.socket, meeting, waitingUser.userId, waitingUser.displayName, 'participant');
      });
      waitingMap.clear();
      broadcastWaitingList(currentMeetingCode);
    });

    socket.on('cancel-waiting', () => {
      if (currentMeetingCode && waitingRooms.has(currentMeetingCode)) {
        waitingRooms.get(currentMeetingCode)!.delete(socket.id);
        broadcastWaitingList(currentMeetingCode);
      }
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
      // Check if user was waiting in waiting room
      if (currentMeetingCode && waitingRooms.has(currentMeetingCode)) {
        if (waitingRooms.get(currentMeetingCode)!.delete(socket.id)) {
          broadcastWaitingList(currentMeetingCode);
        }
      }

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
