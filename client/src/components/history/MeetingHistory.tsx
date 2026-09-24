import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  Users,
  Video,
  Play,
  Download,
  FileText,
  Search,
  ArrowLeft,
  X,
  Film,
  MessageSquare,
  Shield,
  Lock,
} from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';

interface MeetingHistoryProps {
  onBackToHome: () => void;
  onJoinMeeting?: (code: string) => void;
}

export const MeetingHistory: React.FC<MeetingHistoryProps> = ({ onBackToHome }) => {
  const { user, token } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeetingDetail, setSelectedMeetingDetail] = useState<any | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    loadMeetings();
  }, [user]);

  const loadMeetings = async () => {
    try {
      setIsLoading(true);
      const res = await api.getMeetingHistory(user?.id, token || undefined);
      setMeetings(res.meetings || []);
    } catch (err) {
      console.error('Failed to load meeting history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDetail = async (meetingId: string) => {
    try {
      const res = await api.getMeetingDetail(meetingId, token || undefined, user?.id);
      setSelectedMeetingDetail(res);
    } catch (err: any) {
      alert(`Error loading meeting detail: ${err.message}`);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}h ${remMins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    const q = searchQuery.toLowerCase();
    return (
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.code && m.code.toLowerCase().includes(q))
    );
  });

  const isAdmin = user?.role === 'admin';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 select-none transition-colors duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white text-sm font-medium mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tutoring Space</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center space-x-3">
            <span>{isAdmin ? 'All Platform Class Recordings' : 'My Class Recordings'}</span>
            <span className={`text-xs px-3 py-1 rounded-full font-semibold flex items-center space-x-1.5 ${
              isAdmin 
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20' 
                : 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20'
            }`}>
              {isAdmin ? <Shield className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
              <span>{isAdmin ? 'Administrator Oversight' : 'Strictly Private to You'}</span>
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
            {isAdmin 
              ? 'Administrator view: Oversee, inspect, and audit all recorded classes and storage telemetry.' 
              : 'Your past tutoring sessions and automatic continuous recordings. Strictly isolated and private to your account.'}
          </p>
        </div>

        <div className="flex items-center bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] rounded-full px-4 py-2.5 w-full sm:w-72 text-sm focus-within:border-orange-500 transition-colors shadow-sm">
          <Search className="w-4 h-4 text-slate-400 dark:text-gray-400 mr-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search classes or code..."
            className="bg-transparent border-none outline-none text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 w-full"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-20 text-center text-slate-500 dark:text-gray-400">Loading your recordings...</div>
      ) : !user ? (
        <div className="py-20 text-center bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] rounded-3xl p-8 max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Account Sign-In Required</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
            Please sign in with your Teacher or Student account to view your recorded classes, continuous video recordings, and chat history.
          </p>
          <button
            onClick={onBackToHome}
            className="py-2.5 px-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
          >
            Sign In on Home
          </button>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="py-20 text-center bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] rounded-3xl p-8 max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto mb-3">
            <Video className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">No recorded classes found</h3>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-6">
            When you hold or attend a class in a TutorPlug room, its continuous recording and in-class chat transcript will automatically appear here.
          </p>
          <button
            onClick={onBackToHome}
            className="py-2.5 px-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-bold shadow-md transition-all hover:scale-[1.02] cursor-pointer"
          >
            Go to Tutoring Space
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMeetings.map((meeting) => {
            const hasRecording = meeting.recording_file_name;
            const duration = meeting.recording_duration || 0;

            return (
              <div
                key={meeting.id}
                className="bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] hover:border-orange-500/50 dark:hover:border-orange-500/50 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 font-bold border border-orange-500/20">
                      {meeting.code}
                    </span>

                    {hasRecording ? (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Recording Ready</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-full font-medium">
                        No recording
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-orange-500 transition-colors line-clamp-1">
                    {meeting.title}
                  </h3>

                  {meeting.host_name && (
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                      Tutor: {meeting.host_name}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4 text-xs text-slate-500 dark:text-gray-400">
                    <div className="flex items-center space-x-1.5 truncate">
                      <Calendar className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{formatDateTime(meeting.created_at)}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>{formatDuration(duration)}</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span>{meeting.participant_count || 1} participant(s)</span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>{meeting.message_count || 0} message(s)</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => handleOpenDetail(meeting.id)}
                    className="flex-1 py-2 px-4 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs flex items-center justify-center space-x-2 transition-colors mr-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-orange-500" />
                    <span>View Class & Recording</span>
                  </button>

                  {hasRecording && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {formatBytes(meeting.recording_size_bytes)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED REPLAY & TRANSCRIPT MODAL */}
      {selectedMeetingDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-in fade-in">
          <div className="bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-[#23252a] flex items-center justify-between bg-slate-50 dark:bg-[#0c0d12]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                  Recorded Tutoring Session
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                  {selectedMeetingDetail.meeting.title}
                </h2>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  Code: <span className="font-mono text-orange-600 dark:text-orange-400">{selectedMeetingDetail.meeting.code}</span> • Held on {formatDateTime(selectedMeetingDetail.meeting.created_at)}
                </p>
              </div>

              <button
                onClick={() => setSelectedMeetingDetail(null)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              {/* VIDEO PLAYER SECTION */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider mb-3 flex items-center space-x-2">
                  <Film className="w-4 h-4 text-orange-500" />
                  <span>Session Video Replay (Continuous Recording)</span>
                </h4>

                {selectedMeetingDetail.recording ? (
                  <div className="bg-black rounded-3xl overflow-hidden border border-slate-200 dark:border-[#23252a] shadow-lg">
                    <div className="aspect-video w-full bg-black relative flex items-center justify-center">
                      <video
                        ref={videoRef}
                        src={`/api/meetings/${selectedMeetingDetail.meeting.id}/recording/stream`}
                        controls
                        playsInline
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Custom Player Controls Bar */}
                    <div className="p-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-400">Playback Speed:</span>
                        {[0.5, 1, 1.25, 1.5, 2].map((speed) => (
                          <button
                            key={speed}
                            onClick={() => handleSpeedChange(speed)}
                            className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                              playbackSpeed === speed
                                ? 'bg-orange-500 text-white'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300'
                            }`}
                          >
                            {speed}x
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center space-x-3">
                        <span className="text-gray-400 font-mono text-[11px]">
                          {formatDuration(selectedMeetingDetail.recording.duration_seconds)} • {formatBytes(selectedMeetingDetail.recording.size_bytes)}
                        </span>

                        <a
                          href={`/api/meetings/${selectedMeetingDetail.meeting.id}/recording/download`}
                          download
                          className="py-1.5 px-3.5 rounded-full bg-orange-500 hover:bg-orange-400 text-white font-bold text-xs flex items-center space-x-1.5 transition-colors shadow"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download .webm</span>
                        </a>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-xs text-slate-500 dark:text-gray-400">
                    No recording file available for this session.
                  </div>
                )}
              </div>

              {/* CHAT TRANSCRIPT SECTION */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-orange-500" />
                    <span>In-Class Chat Transcript ({selectedMeetingDetail.messages?.length || 0})</span>
                  </h4>

                  {selectedMeetingDetail.messages && selectedMeetingDetail.messages.length > 0 && (
                    <a
                      href={`/api/meetings/${selectedMeetingDetail.meeting.id}/chat/download`}
                      download
                      className="py-1 px-3 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                      title="Download recorded chat transcript as a text file"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Chat (.txt)</span>
                    </a>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-[#16181f] border border-slate-200 dark:border-[#23252a] rounded-2xl p-4 max-h-60 overflow-y-auto space-y-3 text-xs">
                  {!selectedMeetingDetail.messages || selectedMeetingDetail.messages.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">No chat messages were sent during this class.</div>
                  ) : (
                    selectedMeetingDetail.messages.map((msg: any) => (
                      <div key={msg.id} className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-orange-600 dark:text-orange-400">{msg.sender_name}</span>
                          <span className="text-slate-400 text-[10px]">{formatDateTime(msg.created_at)}</span>
                        </div>
                        {msg.content && <p className="text-slate-700 dark:text-gray-200">{msg.content}</p>}
                        {msg.file_url && (
                          <a
                            href={msg.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1.5 p-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-orange-600 dark:text-orange-400 hover:underline"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{msg.file_name} ({formatBytes(msg.file_size)})</span>
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
