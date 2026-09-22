export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  avatar?: string;
  googleId?: string;
  personalMeetingCode?: string;
  allowedLinkQuota?: number;
}

export interface WaitingParticipant {
  socketId: string;
  userId: string;
  displayName: string;
  requestedAt: string;
}

export interface Participant {
  socketId: string;
  userId: string;
  displayName: string;
  role: 'host' | 'cohost' | 'participant';
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  joinedAt: string;
  stream?: MediaStream;
}

export interface Meeting {
  id: string;
  code: string;
  title: string;
  description?: string;
  host_id: string;
  status: 'scheduled' | 'active' | 'ended';
  scheduled_start_time?: string;
  started_at?: string;
  ended_at?: string;
  is_locked?: number;
  waiting_room_enabled?: number;
  is_permanent?: number;
  created_at: string;
}

export interface LinkRequest {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  requested_title: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_meeting_code?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  allowed_link_quota?: number;
  personal_meeting_code?: string;
}

export interface Recording {
  id: string;
  meeting_id: string;
  file_name: string;
  file_path?: string;
  duration_seconds: number;
  size_bytes: number;
  mime_type: string;
  status: 'recording' | 'ready' | 'failed';
  started_at: string;
  ended_at?: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  meetingId: string;
  senderId: string;
  senderName: string;
  content?: string;
  messageType: 'text' | 'image' | 'video' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileMimeType?: string;
  createdAt: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  x: number;
}

export type LayoutMode = 'grid' | 'speaker' | 'sidebar';
