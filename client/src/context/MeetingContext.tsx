import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Participant, ChatMessage, FloatingReaction, LayoutMode, WaitingParticipant } from '../types.js';
import { WebRTCManager } from '../services/webrtc.js';
import { RecordingStreamer } from '../services/recordingStreamer.js';
import { useAuth } from './AuthContext.js';

interface MeetingContextType {
  socket: Socket | null;
  meetingCode: string | null;
  meetingTitle: string | null;
  isInMeeting: boolean;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  participants: Participant[];
  selfParticipant: Participant | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  activeSpeakerId: string | null;
  isRecording: boolean;
  recordingDuration: number;
  messages: ChatMessage[];
  unreadMessageCount: number;
  reactions: FloatingReaction[];
  activeDrawer: 'none' | 'chat' | 'people' | 'info' | 'host';
  layoutMode: LayoutMode;
  pinnedId: string | null;
  hasRecordedNoticeDismissed: boolean;
  waitingStatus: 'none' | 'asking_to_join' | 'host_not_present' | 'denied';
  waitingParticipants: WaitingParticipant[];
  setHasRecordedNoticeDismissed: (val: boolean) => void;
  setActiveDrawer: (drawer: 'none' | 'chat' | 'people' | 'info' | 'host') => void;
  setLayoutMode: (mode: LayoutMode) => void;
  setPinnedId: (id: string | null) => void;
  joinRoom: (
    code: string,
    displayName: string,
    role?: string,
    initialMedia?: { audio: boolean; video: boolean },
    customUserId?: string
  ) => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => Promise<void>;
  toggleHandRaise: () => void;
  sendReaction: (emoji: string) => void;
  sendChatMessage: (content?: string, fileData?: any) => void;
  admitParticipant: (socketId: string) => void;
  denyParticipant: (socketId: string, reason?: string) => void;
  admitAll: () => void;
  cancelWaiting: () => void;
  hostMuteUser: (targetSocketId: string) => void;
  hostMuteAll: () => void;
  hostKickUser: (targetSocketId: string) => void;
  hostEndMeetingForAll: () => void;
  leaveMeeting: () => void;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [meetingCode, setMeetingCode] = useState<string | null>(null);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selfParticipant, setSelfParticipant] = useState<Participant | null>(null);

  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);

  // Waiting room & Host Admission State
  const [waitingStatus, setWaitingStatus] = useState<'none' | 'asking_to_join' | 'host_not_present' | 'denied'>('none');
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([]);

  // Automatic Continuous Recording State
  const [isRecording, setIsRecording] = useState(true);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasRecordedNoticeDismissed, setHasRecordedNoticeDismissed] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [activeDrawer, setActiveDrawer] = useState<'none' | 'chat' | 'people' | 'info' | 'host'>('none');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const webrtcManagerRef = useRef<WebRTCManager | null>(null);
  const recordingTimerRef = useRef<any>(null);
  const recordingStreamerRef = useRef<RecordingStreamer | null>(null);

  // Recording timer ticker
  useEffect(() => {
    if (isRecording && isInMeeting) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordingTimerRef.current);
    }
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording, isInMeeting]);

  // Clean unread count when chat is opened
  useEffect(() => {
    if (activeDrawer === 'chat') {
      setUnreadMessageCount(0);
    }
  }, [activeDrawer]);

  const joinRoom = async (
    code: string,
    displayName: string,
    role = 'participant',
    initialMedia = { audio: true, video: true },
    customUserId?: string
  ) => {
    // 1. Initialize user media
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
    } catch {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        stream = new MediaStream();
      }
    }

    if (!initialMedia.audio) {
      stream.getAudioTracks().forEach((t) => (t.enabled = false));
      setIsAudioMuted(true);
    } else {
      setIsAudioMuted(false);
    }

    if (!initialMedia.video) {
      stream.getVideoTracks().forEach((t) => (t.enabled = false));
      setIsVideoOff(true);
    } else {
      setIsVideoOff(false);
    }

    setLocalStream(stream);

    // 2. Connect Socket.io
    const socketServerUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const newSocket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
    });
    setSocket(newSocket);

    // 3. Setup WebRTC Manager
    const rtcManager = new WebRTCManager(
      newSocket,
      (socketId, remoteStream) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev).set(socketId, remoteStream);
          recordingStreamerRef.current?.updateMedia({ remoteStreams: next });
          return next;
        });
      },
      (socketId) => {
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(socketId);
          recordingStreamerRef.current?.updateMedia({ remoteStreams: next });
          return next;
        });
      }
    );
    rtcManager.setLocalStream(stream);
    webrtcManagerRef.current = rtcManager;

    // 4. Socket Listeners
    newSocket.on('connect', () => {
      newSocket.emit('join-room', {
        meetingCode: code,
        displayName,
        role,
        userId: customUserId || user?.id,
      });
    });

    newSocket.on('room-joined', (data) => {
      setWaitingStatus('none');
      setMeetingCode(data.meetingCode);
      setMeetingTitle(data.meetingTitle);
      setSelfParticipant(data.self);
      setParticipants(data.participants);
      setIsInMeeting(true);

      if (data.recording?.isRecording) {
        setIsRecording(true);
      }

      // Initialize live composite recording stream to server
      const streamer = new RecordingStreamer(newSocket);
      streamer.updateMedia({
        localStream: stream,
        tutorName: displayName,
        meetingTitle: data.meetingTitle,
      });
      recordingStreamerRef.current = streamer;
      streamer.start();

      data.participants.forEach((p: Participant) => {
        rtcManager.createPeerConnection(p.socketId, true);
      });
    });

    newSocket.on('user-connected', (participant: Participant) => {
      setParticipants((prev) => [...prev.filter((p) => p.socketId !== participant.socketId), participant]);
    });

    newSocket.on('signal', (data) => {
      rtcManager.handleSignal(data.from, data.signal);
    });

    newSocket.on('participant-media-changed', (data) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === data.socketId ? { ...p, ...data } : p))
      );
    });

    newSocket.on('active-speaker', (data) => {
      if (data.level > 15) {
        setActiveSpeakerId(data.socketId);
      } else {
        setActiveSpeakerId((current) => (current === data.socketId ? null : current));
      }
    });

    newSocket.on('hand-raise-updated', (data) => {
      setParticipants((prev) =>
        prev.map((p) => (p.socketId === data.socketId ? { ...p, isHandRaised: data.isRaised } : p))
      );
    });

    newSocket.on('reaction-received', (data) => {
      const newReaction: FloatingReaction = {
        id: data.id,
        emoji: data.emoji,
        senderName: data.senderName,
        x: Math.floor(Math.random() * 60) + 20,
      };
      setReactions((prev) => [...prev, newReaction]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== data.id));
      }, 2500);
    });

    newSocket.on('chat-message', (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      setActiveDrawer((currentDrawer) => {
        if (currentDrawer !== 'chat') {
          setUnreadMessageCount((c) => c + 1);
        }
        return currentDrawer;
      });
    });

    newSocket.on('recording:status', (status) => {
      setIsRecording(status.isRecording);
    });

    newSocket.on('host-instructed-mute', () => {
      if (stream) {
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
        setIsAudioMuted(true);
        newSocket.emit('media-state', { audioEnabled: false });
      }
    });

    newSocket.on('host-kicked-you', () => {
      alert('You have been removed from the meeting by the host.');
      leaveMeeting();
    });

    newSocket.on('meeting-ended-by-host', () => {
      alert('The host has ended the meeting for everyone.');
      leaveMeeting();
    });

    newSocket.on('user-disconnected', (data) => {
      rtcManager.closePeer(data.socketId);
      setParticipants((prev) => prev.filter((p) => p.socketId !== data.socketId));
      setActiveSpeakerId((curr) => (curr === data.socketId ? null : curr));
    });

    // --- Waiting Room / Admission Handlers ---
    newSocket.on('waiting-admission', (data: { status: string; meetingTitle: string }) => {
      if (data.status === 'host_not_present') {
        setWaitingStatus('host_not_present');
      } else {
        setWaitingStatus('asking_to_join');
      }
      setMeetingTitle(data.meetingTitle);
    });

    newSocket.on('join-denied', () => {
      setWaitingStatus('denied');
    });

    newSocket.on('join-request', (data: WaitingParticipant) => {
      setWaitingParticipants((prev) => {
        if (prev.some((p) => p.socketId === data.socketId)) return prev;
        return [...prev, data];
      });
    });

    newSocket.on('waiting-list-updated', (list: WaitingParticipant[]) => {
      setWaitingParticipants(list);
    });
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const newState = !isAudioMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !newState));
    setIsAudioMuted(newState);
    recordingStreamerRef.current?.updateMedia({ localStream });
    if (socket) {
      socket.emit('media-state', { audioEnabled: !newState });
    }
  };

  const toggleVideo = () => {
    if (!localStream) return;
    const newState = !isVideoOff;
    localStream.getVideoTracks().forEach((t) => (t.enabled = !newState));
    setIsVideoOff(newState);
    recordingStreamerRef.current?.updateMedia({ localStream });
    if (socket) {
      socket.emit('media-state', { videoEnabled: !newState });
    }
  };

  const toggleScreenShare = async () => {
    if (!webrtcManagerRef.current) return;

    if (!isScreenSharing) {
      try {
        const stream = await webrtcManagerRef.current.startScreenShare();
        setIsScreenSharing(true);
        setScreenStream(stream);
        setSelfParticipant((prev) => (prev ? { ...prev, isScreenSharing: true } : null));
        recordingStreamerRef.current?.updateMedia({ screenStream: stream });
        if (socket) socket.emit('media-state', { isScreenSharing: true });

        stream.getVideoTracks()[0].onended = () => {
          webrtcManagerRef.current?.stopScreenShare();
          setIsScreenSharing(false);
          setScreenStream(null);
          setSelfParticipant((prev) => (prev ? { ...prev, isScreenSharing: false } : null));
          recordingStreamerRef.current?.updateMedia({ screenStream: null });
          if (socket) socket.emit('media-state', { isScreenSharing: false });
        };
      } catch (err) {
        console.warn('Screen share cancelled or failed:', err);
      }
    } else {
      webrtcManagerRef.current.stopScreenShare();
      setIsScreenSharing(false);
      setScreenStream(null);
      setSelfParticipant((prev) => (prev ? { ...prev, isScreenSharing: false } : null));
      recordingStreamerRef.current?.updateMedia({ screenStream: null });
      if (socket) socket.emit('media-state', { isScreenSharing: false });
    }
  };

  const toggleHandRaise = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    if (socket) {
      socket.emit('hand-raise', { isRaised: newState });
    }
  };

  const sendReaction = (emoji: string) => {
    if (socket) {
      socket.emit('send-reaction', { emoji });
    }
  };

  const sendChatMessage = (content?: string, fileData?: any) => {
    if (socket) {
      socket.emit('send-chat', {
        content,
        ...fileData,
      });
    }
  };

  const hostMuteUser = (targetSocketId: string) => {
    if (socket) socket.emit('host-mute-participant', { targetSocketId });
  };

  const hostMuteAll = () => {
    if (socket) socket.emit('host-mute-all');
  };

  const hostKickUser = (targetSocketId: string) => {
    if (socket) socket.emit('host-kick-participant', { targetSocketId });
  };

  const admitParticipant = (targetSocketId: string) => {
    if (socket) {
      socket.emit('admit-participant', { targetSocketId });
      setWaitingParticipants((prev) => prev.filter((p) => p.socketId !== targetSocketId));
    }
  };

  const denyParticipant = (targetSocketId: string, reason?: string) => {
    if (socket) {
      socket.emit('deny-participant', { targetSocketId, reason });
      setWaitingParticipants((prev) => prev.filter((p) => p.socketId !== targetSocketId));
    }
  };

  const admitAll = () => {
    if (socket) {
      socket.emit('admit-all');
      setWaitingParticipants([]);
    }
  };

  const cancelWaiting = () => {
    if (socket) {
      socket.emit('cancel-waiting');
      socket.disconnect();
      setSocket(null);
    }
    setWaitingStatus('none');
  };

  const hostEndMeetingForAll = () => {
    if (socket) socket.emit('host-end-meeting-all');
    leaveMeeting();
  };

  const leaveMeeting = () => {
    if (recordingStreamerRef.current) {
      recordingStreamerRef.current.stop();
      recordingStreamerRef.current = null;
    }
    if (webrtcManagerRef.current) {
      webrtcManagerRef.current.destroy();
      webrtcManagerRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
    }
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setIsInMeeting(false);
    setWaitingStatus('none');
    setWaitingParticipants([]);
    setParticipants([]);
    setRemoteStreams(new Map());
    setMeetingCode(null);
    setMeetingTitle(null);
    setIsRecording(false);
    setRecordingDuration(0);
    setActiveDrawer('none');
    window.location.hash = '#/';
  };

  return (
    <MeetingContext.Provider
      value={{
        socket,
        meetingCode,
        meetingTitle,
        isInMeeting,
        localStream,
        screenStream,
        remoteStreams,
        participants,
        selfParticipant,
        isAudioMuted,
        isVideoOff,
        isScreenSharing,
        isHandRaised,
        activeSpeakerId,
        isRecording,
        recordingDuration,
        messages,
        unreadMessageCount,
        reactions,
        activeDrawer,
        layoutMode,
        pinnedId,
        hasRecordedNoticeDismissed,
        waitingStatus,
        waitingParticipants,
        setHasRecordedNoticeDismissed,
        setActiveDrawer,
        setLayoutMode,
        setPinnedId,
        joinRoom,
        toggleAudio,
        toggleVideo,
        toggleScreenShare,
        toggleHandRaise,
        sendReaction,
        sendChatMessage,
        admitParticipant,
        denyParticipant,
        admitAll,
        cancelWaiting,
        hostMuteUser,
        hostMuteAll,
        hostKickUser,
        hostEndMeetingForAll,
        leaveMeeting,
      }}
    >
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (!context) throw new Error('useMeeting must be used within MeetingProvider');
  return context;
};
