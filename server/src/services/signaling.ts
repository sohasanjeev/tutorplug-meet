import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { db, getOrCreateHostForCode } from '../db/database.js';
import { RecordingManager } from './recordingManager.js';

interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  role: 'host' | 'cohost' | 'participant';
  userType?: 'teacher' | 'student' | 'admin';
  rollNumber?: string;
  bio?: string;
  classGrade?: string;
  avatar?: string;
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
  // Map of meetingCode -> Map<socketId, WaitingParticipant>
  const waitingRooms: Map<string, Map<string, {
    socketId: string;
    userId: string;
    displayName: string;
    role: string;
    userType?: string;
    rollNumber?: string;
    classGrade?: string;
    avatar?: string;
    bio?: string;
    requestedAt: string;
    socket: Socket;
  }>> = new Map();
  // Map of socketId -> meetingCode
  const socketToRoomMap: Map<string, string> = new Map();
  // Map of socketId -> meetingId
  const socketToMeetingIdMap: Map<string, string> = new Map();
  // Map of meetingCode -> socketId of the active designated streamer
  const roomStreamerMap: Map<string, string> = new Map();

  const getSocketRoom = (s: Socket): string | null => (s as any).currentMeetingCode || socketToRoomMap.get(s.id) || null;
  const getSocketMeetingId = (s: Socket): string | null => (s as any).currentMeetingId || socketToMeetingIdMap.get(s.id) || null;

  function broadcastWaitingList(meetingCode: string) {
    const waitingMap = waitingRooms.get(meetingCode);
    const waitingList = waitingMap ? Array.from(waitingMap.values()).map(w => ({
      socketId: w.socketId,
      userId: w.userId,
      displayName: w.displayName,
      userType: w.userType,
      rollNumber: w.rollNumber,
      classGrade: w.classGrade,
      avatar: w.avatar,
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
    // Helper: Execute complete admission into meeting room
    const admitUserToRoom = (
      targetSocket: Socket,
      meeting: any,
      userId: string,
      displayName: string,
      role: 'host' | 'participant',
      profileMeta?: {
        userType?: 'teacher' | 'student' | 'admin';
        rollNumber?: string;
        bio?: string;
        classGrade?: string;
        avatar?: string;
      }
    ) => {
      const meetingCode = meeting.code;
      (targetSocket as any).currentMeetingCode = meetingCode;
      (targetSocket as any).currentMeetingId = meeting.id;
      socketToRoomMap.set(targetSocket.id, meetingCode);
      socketToMeetingIdMap.set(targetSocket.id, meeting.id);
      meetingIdMap.set(meetingCode, meeting.id);

      targetSocket.join(meetingCode);

      if (!rooms.has(meetingCode)) {
        rooms.set(meetingCode, new Map());
      }
      const roomParticipants = rooms.get(meetingCode)!;

      const userRecord: any = userId ? db.prepare('SELECT * FROM users WHERE id = ?').get(userId) : null;
      const userType: 'teacher' | 'student' | 'admin' = (
        profileMeta?.userType ||
        userRecord?.user_type ||
        (userRecord?.role === 'admin' ? 'admin' : (role === 'host' ? 'teacher' : 'student'))
      );
      const rollNumber = profileMeta?.rollNumber || userRecord?.roll_number || (userType === 'student' ? `TP-STU-${userId.slice(0, 4).toUpperCase()}` : undefined);
      const classGrade = profileMeta?.classGrade || userRecord?.class_grade || undefined;
      const bio = profileMeta?.bio || userRecord?.bio || undefined;
      const avatar = profileMeta?.avatar || userRecord?.avatar || undefined;

      const newParticipant: Participant = {
        socketId: targetSocket.id,
        userId,
        displayName: displayName || (userRecord?.name) || 'Guest Participant',
        role,
        userType,
        rollNumber,
        classGrade,
        bio,
        avatar,
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        isHandRaised: false,
        joinedAt: new Date().toISOString(),
      };

      roomParticipants.set(targetSocket.id, newParticipant);

      try {
        const userExists = userId ? db.prepare('SELECT id FROM users WHERE id = ?').get(userId) : null;
        db.prepare(`
          INSERT INTO meeting_participants (id, meeting_id, user_id, display_name, role)
          VALUES (?, ?, ?, ?, ?)
        `).run(uuidv4(), meeting.id, userExists ? userId : null, newParticipant.displayName, newParticipant.role);
      } catch (err) {
        console.error('Error logging participant:', err);
      }

      // Ensure meeting status is active so permanent rooms can be reused perpetually
      if (meeting.status !== 'active') {
        try {
          db.prepare("UPDATE meetings SET status = 'active' WHERE id = ?").run(meeting.id);
          meeting.status = 'active';
        } catch {}
      }

      // Automatically start continuous recording on first join
      const recordingStatus = RecordingManager.startRecording(meeting.id);

      // Designate active recorder streamer (host preferred)
      if (role === 'host' || !roomStreamerMap.has(meetingCode)) {
        roomStreamerMap.set(meetingCode, targetSocket.id);
      }

      const existingParticipants = Array.from(roomParticipants.values()).filter((p) => p.socketId !== targetSocket.id);

      targetSocket.emit('room-joined', {
        meetingId: meeting.id,
        meetingCode: meeting.code,
        meetingTitle: meeting.title,
        self: newParticipant,
        participants: existingParticipants,
        isStreamer: roomStreamerMap.get(meetingCode) === targetSocket.id,
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
      try {
        const meetingCode = (data?.meetingCode || data?.roomId || '').trim();
        const displayName = data?.displayName || data?.userName || 'Participant';
        const userId = data?.userId || uuidv4();
        const requestedRole = (data?.role as any) || (data?.isHost ? 'host' : 'participant');
        const profileMeta = {
          userType: data?.userType,
          rollNumber: data?.rollNumber,
          classGrade: data?.classGrade,
          bio: data?.bio,
          avatar: data?.avatar,
        };

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
            const { hostId, hostName } = getOrCreateHostForCode(meetingCode.toLowerCase(), displayName, userId);
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

        // Determine Host Authority:
        const codeSlug = (meetingCode.split('-')[1] || '').toLowerCase();
        const nameMatchesSlug = Boolean(
          codeSlug.length >= 3 && displayName.toLowerCase().includes(codeSlug)
        );

        const ADMIN_EMAILS = ['admin@tutorplug.com', 'sanjeev@tutorplug.com', 'sanjeevgupta052020@gmail.com'];

        // Check user record in database
        const userInDb: any = userId ? db.prepare('SELECT id, name, email, role, personal_meeting_code FROM users WHERE id = ?').get(userId) : null;
        const ownsMeetingCode = Boolean(
          userInDb && userInDb.personal_meeting_code && userInDb.personal_meeting_code.toLowerCase() === meetingCode.toLowerCase()
        );
        const isDbAdmin = Boolean(
          (userInDb && (userInDb.role === 'admin' || ADMIN_EMAILS.includes((userInDb.email || '').toLowerCase()))) ||
          (data?.email && ADMIN_EMAILS.includes(data.email.toLowerCase()))
        );

        // Check current room occupancy
        const currentParticipants = rooms.get(meetingCode);
        const hasActiveHostInRoom = Boolean(
          currentParticipants && Array.from(currentParticipants.values()).some((p) => p.role === 'host')
        );
        const isRoomEmpty = !currentParticipants || currentParticipants.size === 0;

        const isHost =
          requestedRole === 'host' ||
          meeting.host_id === userId ||
          isDbAdmin ||
          ownsMeetingCode ||
          (!hasActiveHostInRoom && (
            nameMatchesSlug ||
            isRoomEmpty ||
            requestedRole !== 'student'
          ));

        if (isHost) {
          // Ensure meeting record reflects this host if needed
          if (meeting.host_id !== userId && (ownsMeetingCode || requestedRole === 'host' || isDbAdmin || nameMatchesSlug)) {
            try {
              db.prepare('UPDATE meetings SET host_id = ? WHERE id = ?').run(userId, meeting.id);
              meeting.host_id = userId;
            } catch {}
          }

          // Clean up from waiting room if this socket was pending
          const waitingMap = waitingRooms.get(meetingCode);
          if (waitingMap && waitingMap.has(socket.id)) {
            waitingMap.delete(socket.id);
          }

          // HOST BYPASSES WAITING ROOM & ENTERS IMMEDIATELY
          admitUserToRoom(socket, meeting, userId, displayName, 'host', profileMeta);

          // Check if students are waiting for this host to start the class
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
                userType: waitingUser.userType,
                rollNumber: waitingUser.rollNumber,
                classGrade: waitingUser.classGrade,
                avatar: waitingUser.avatar,
                requestedAt: waitingUser.requestedAt,
              });
            });
            broadcastWaitingList(meetingCode);
          }
        } else {
          // NON-HOST PARTICIPANT (STUDENT / GUEST): ENTERS WAITING ROOM (KNOCKING)
          (socket as any).currentMeetingCode = meetingCode;
          socketToRoomMap.set(socket.id, meetingCode);

          if (!waitingRooms.has(meetingCode)) {
            waitingRooms.set(meetingCode, new Map());
          }
          waitingRooms.get(meetingCode)!.set(socket.id, {
            socketId: socket.id,
            userId,
            displayName: displayName || 'Student',
            role: 'participant',
            userType: profileMeta.userType || 'student',
            rollNumber: profileMeta.rollNumber,
            classGrade: profileMeta.classGrade,
            bio: profileMeta.bio,
            avatar: profileMeta.avatar,
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
              userType: profileMeta.userType || 'student',
              rollNumber: profileMeta.rollNumber,
              classGrade: profileMeta.classGrade,
              avatar: profileMeta.avatar,
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
      } catch (err: any) {
        console.error('[Signaling] Error in join-room handler:', err);
        socket.emit('error', { message: err?.message || 'Error processing meeting join request' });
      }
    });

    // --- Host Admission Control Handlers ---
    socket.on('admit-participant', (data: any) => {
      const roomCode = getSocketRoom(socket);
      const targetId = data?.targetSocketId || data?.participantSocketId || data?.socketId;
      if (!roomCode || !targetId) return;
      const waitingMap = waitingRooms.get(roomCode);
      if (!waitingMap || !waitingMap.has(targetId)) return;

      const waitingUser = waitingMap.get(targetId)!;
      waitingMap.delete(targetId);

      const meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(roomCode.toLowerCase());
      if (meeting) {
        admitUserToRoom(waitingUser.socket, meeting, waitingUser.userId, waitingUser.displayName, 'participant', {
          userType: waitingUser.userType as any,
          rollNumber: waitingUser.rollNumber,
          classGrade: waitingUser.classGrade,
          bio: waitingUser.bio,
          avatar: waitingUser.avatar,
        });
      }
      broadcastWaitingList(roomCode);
    });

    socket.on('deny-participant', (data: any) => {
      const roomCode = getSocketRoom(socket);
      const targetId = data?.targetSocketId || data?.participantSocketId || data?.socketId;
      if (!roomCode || !targetId) return;
      const waitingMap = waitingRooms.get(roomCode);
      if (!waitingMap || !waitingMap.has(targetId)) return;

      const waitingUser = waitingMap.get(targetId)!;
      waitingMap.delete(targetId);

      waitingUser.socket.emit('join-denied', {
        reason: data?.reason || 'The host did not admit you to the session.',
        message: data?.reason || 'The host did not admit you to this class.',
      });
      broadcastWaitingList(roomCode);
    });

    socket.on('admit-all', () => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode) return;
      const waitingMap = waitingRooms.get(roomCode);
      if (!waitingMap) return;

      const meeting: any = db.prepare('SELECT * FROM meetings WHERE LOWER(code) = ?').get(roomCode.toLowerCase());
      if (!meeting) return;

      waitingMap.forEach((waitingUser) => {
        admitUserToRoom(waitingUser.socket, meeting, waitingUser.userId, waitingUser.displayName, 'participant', {
          userType: waitingUser.userType as any,
          rollNumber: waitingUser.rollNumber,
          classGrade: waitingUser.classGrade,
          bio: waitingUser.bio,
          avatar: waitingUser.avatar,
        });
      });
      waitingMap.clear();
      broadcastWaitingList(roomCode);
    });

    // --- Profile Updates in Meeting ---
    socket.on('update-profile', (data: {
      displayName?: string;
      bio?: string;
      avatar?: string;
      rollNumber?: string;
      classGrade?: string;
      userType?: 'teacher' | 'student';
    }) => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode || !rooms.has(roomCode)) return;
      const participant = rooms.get(roomCode)!.get(socket.id);
      if (participant) {
        if (data.displayName) participant.displayName = data.displayName;
        if (data.bio !== undefined) participant.bio = data.bio;
        if (data.avatar !== undefined) participant.avatar = data.avatar;
        if (data.rollNumber !== undefined) participant.rollNumber = data.rollNumber;
        if (data.classGrade !== undefined) participant.classGrade = data.classGrade;
        if (data.userType !== undefined) participant.userType = data.userType;

        if (participant.userId) {
          try {
            db.prepare(`
              UPDATE users
              SET name = COALESCE(?, name),
                  bio = COALESCE(?, bio),
                  avatar = COALESCE(?, avatar),
                  roll_number = COALESCE(?, roll_number),
                  class_grade = COALESCE(?, class_grade)
              WHERE id = ?
            `).run(data.displayName || null, data.bio || null, data.avatar || null, data.rollNumber || null, data.classGrade || null, participant.userId);
          } catch (e) {
            console.error('Error updating user in DB from socket:', e);
          }
        }

        io.to(roomCode).emit('participant-profile-updated', {
          socketId: socket.id,
          participant,
        });
      }
    });

    socket.on('cancel-waiting', () => {
      const roomCode = getSocketRoom(socket);
      if (roomCode && waitingRooms.has(roomCode)) {
        waitingRooms.get(roomCode)!.delete(socket.id);
        broadcastWaitingList(roomCode);
      }
      for (const [wCode, wMap] of waitingRooms.entries()) {
        if (wMap.has(socket.id)) {
          wMap.delete(socket.id);
          broadcastWaitingList(wCode);
        }
      }
      socketToRoomMap.delete(socket.id);
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
      const roomCode = getSocketRoom(socket);
      if (!roomCode || !rooms.has(roomCode)) return;
      const participant = rooms.get(roomCode)!.get(socket.id);
      if (participant) {
        if (data.audioEnabled !== undefined) participant.audioEnabled = data.audioEnabled;
        if (data.videoEnabled !== undefined) participant.videoEnabled = data.videoEnabled;
        if (data.isScreenSharing !== undefined) participant.isScreenSharing = data.isScreenSharing;

        socket.to(roomCode).emit('participant-media-changed', {
          socketId: socket.id,
          ...data,
        });
      }
    });

    // --- 4. Active Speaker Volume Level Meter ---
    socket.on('audio-level', (data: { level: number }) => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode) return;
      socket.to(roomCode).emit('active-speaker', {
        socketId: socket.id,
        level: data.level,
      });
    });

    // --- 5. Hand Raise ---
    socket.on('hand-raise', (data: { isRaised: boolean }) => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode || !rooms.has(roomCode)) return;
      const participant = rooms.get(roomCode)!.get(socket.id);
      if (participant) {
        participant.isHandRaised = data.isRaised;
        io.to(roomCode).emit('hand-raise-updated', {
          socketId: socket.id,
          displayName: participant.displayName,
          isRaised: data.isRaised,
        });
      }
    });

    // --- 6. Live Emoji Reactions ---
    socket.on('send-reaction', (data: { emoji: string }) => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode || !rooms.has(roomCode)) return;
      const participant = rooms.get(roomCode)!.get(socket.id);
      const senderName = participant ? participant.displayName : 'Participant';
      io.to(roomCode).emit('reaction-received', {
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
      const roomCode = getSocketRoom(socket);
      const mId = getSocketMeetingId(socket);
      if (!roomCode || !mId || !rooms.has(roomCode)) return;
      const participant = rooms.get(roomCode)!.get(socket.id);
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
          mId,
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
        meetingId: mId,
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

      io.to(roomCode).emit('chat-message', chatPayload);
    });

    // --- 8. Continuous Server-Side Recording Ingest ---
    socket.on('recording-chunk', (chunk: ArrayBuffer | Buffer) => {
      const roomCode = getSocketRoom(socket);
      const mId = getSocketMeetingId(socket);
      if (!roomCode || !mId) return;

      const designated = roomStreamerMap.get(roomCode);
      if (!designated) {
        roomStreamerMap.set(roomCode, socket.id);
      } else if (designated !== socket.id) {
        // Drop chunks from secondary participants to avoid WebM container interleaving corruption
        return;
      }

      RecordingManager.appendChunk(mId, chunk);
    });

    // --- 9. Host Moderation Controls ---
    socket.on('host-mute-participant', (data: { targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-instructed-mute');
    });

    socket.on('host-mute-all', () => {
      const roomCode = getSocketRoom(socket);
      if (!roomCode) return;
      socket.to(roomCode).emit('host-instructed-mute');
    });

    socket.on('host-kick-participant', (data: { targetSocketId: string }) => {
      io.to(data.targetSocketId).emit('host-kicked-you');
    });

    socket.on('host-end-meeting-all', async () => {
      const roomCode = getSocketRoom(socket);
      const mId = getSocketMeetingId(socket);
      if (!roomCode || !mId) return;

      console.log(`[Signaling] Host initiated End Meeting For All in ${roomCode}`);

      // Update meeting status in DB
      db.prepare(`
        UPDATE meetings
        SET status = 'ended', ended_at = datetime('now')
        WHERE id = ?
      `).run(mId);

      // Stop continuous recording and seal file
      const recordingRecord = await RecordingManager.stopRecording(mId);

      // Notify all users in room
      io.to(roomCode).emit('meeting-ended-by-host', {
        recording: recordingRecord,
      });

      // Clear memory room & streamer
      rooms.delete(roomCode);
      roomStreamerMap.delete(roomCode);
    });

    // --- 10. Disconnect Handling ---
    socket.on('disconnect', async () => {
      const roomCode = getSocketRoom(socket);
      const mId = getSocketMeetingId(socket);

      // Clean up from all waiting rooms
      if (roomCode && waitingRooms.has(roomCode)) {
        if (waitingRooms.get(roomCode)!.delete(socket.id)) {
          broadcastWaitingList(roomCode);
        }
      }
      for (const [wCode, wMap] of waitingRooms.entries()) {
        if (wMap.has(socket.id)) {
          wMap.delete(socket.id);
          broadcastWaitingList(wCode);
        }
      }
      socketToRoomMap.delete(socket.id);
      socketToMeetingIdMap.delete(socket.id);

      if (roomCode && roomStreamerMap.get(roomCode) === socket.id) {
        roomStreamerMap.delete(roomCode);
      }

      if (roomCode && rooms.has(roomCode)) {
        const roomParticipants = rooms.get(roomCode)!;
        const participant = roomParticipants.get(socket.id);
        roomParticipants.delete(socket.id);

        if (participant) {
          socket.to(roomCode).emit('user-disconnected', {
            socketId: socket.id,
            displayName: participant.displayName,
          });
        }

        // If last participant left room, automatically stop and seal recording
        if (roomParticipants.size === 0) {
          rooms.delete(roomCode);
          roomStreamerMap.delete(roomCode);
          if (mId) {
            console.log(`[Signaling] Room ${roomCode} is empty. Sealing continuous recording.`);
            await RecordingManager.stopRecording(mId);
            db.prepare(`
              UPDATE meetings
              SET status = 'ended', ended_at = datetime('now')
              WHERE id = ? AND status = 'active'
            `).run(mId);
          }
        } else {
          // If the designated streamer left but others remain, designate next participant
          if (!roomStreamerMap.has(roomCode)) {
            const nextHost = Array.from(roomParticipants.values()).find((p) => p.role === 'host');
            const nextSocketId = nextHost ? nextHost.socketId : roomParticipants.keys().next().value;
            if (nextSocketId) {
              roomStreamerMap.set(roomCode, nextSocketId);
              io.to(nextSocketId).emit('designated-streamer-assigned');
            }
          }
        }
      }

      socketToRoomMap.delete(socket.id);
      socketToMeetingIdMap.delete(socket.id);
    });
  });
}
