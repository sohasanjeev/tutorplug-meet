import React, { useState, useEffect } from 'react';
import {
  Video,
  Link as LinkIcon,
  Keyboard,
  Copy,
  Check,
  Sparkles,
  Shield,
  Film,
  Zap,
  PlusCircle,
  Clock,
  ExternalLink,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { api } from '../../services/api.js';
import { RequestLinkModal } from './RequestLinkModal.js';

interface LandingPageProps {
  onJoinMeeting: (code: string, isHost?: boolean) => void;
  onOpenAuthModal: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onJoinMeeting,
  onOpenAuthModal,
}) => {
  const { user } = useAuth();
  const [meetingCodeInput, setMeetingCodeInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [userRooms, setUserRooms] = useState<any[]>([]);
  const [userQuota, setUserQuota] = useState(1);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Load user's authorized links and pending requests
  const loadUserRooms = async () => {
    if (user?.id) {
      try {
        const res = await api.getUserLinks(user.id);
        setUserRooms(res.meetings || []);
        setUserQuota(res.allowedQuota || 1);
        setPendingRequests(res.pendingRequests || []);
      } catch (err) {
        console.error('Failed to load user rooms:', err);
      }
    }
  };

  useEffect(() => {
    loadUserRooms();
  }, [user]);

  const handleCopyLink = (code: string) => {
    const fullUrl = `${window.location.origin}/#/meeting/${code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleJoinByCode = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = meetingCodeInput.trim().replace(/^https?:\/\/.*\/#\/meeting\//, '');
    if (!clean) return;
    onJoinMeeting(clean);
  };

  const permanentRoom =
    userRooms.find((r) => r.is_permanent) ||
    (user?.personalMeetingCode
      ? { code: user.personalMeetingCode, title: `${user.name}'s Permanent Room` }
      : null);
  const additionalRooms = userRooms.filter((r) => !r.is_permanent);

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-grid-pattern orange-beam flex flex-col justify-start px-4 sm:px-8 py-8 select-none transition-colors duration-200">
      {/* Top Floating Announcement Pill */}
      <div className="max-w-7xl mx-auto w-full flex justify-center mb-6">
        <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-900/5 dark:bg-white/5 border border-orange-500/30 text-xs font-semibold backdrop-blur-md shadow-sm">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
          <span className="text-orange-600 dark:text-orange-400 font-bold">TutorPlug 2.0</span>
          <span className="text-slate-500 dark:text-gray-400">• Permanent 1-Link Rooms with Continuous Automatic Recording</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-500" />
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left Column (7 cols): Hero & Permanent Room Section */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          {/* Header Typography */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] text-slate-900 dark:text-white">
              Tutoring at the <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-400">
                Speed of Light.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-gray-300 leading-relaxed max-w-xl">
              Permanent meeting rooms for every tutor. Every session is automatically and continuously recorded, stored securely with teacher-only privacy, and managed seamlessly with admin quota controls.
            </p>
          </div>

          {/* PERMANENT MEETING LINK CARD (Logged In) */}
          {user ? (
            <div className="bg-white/90 dark:bg-[#121316]/90 backdrop-blur-xl border-2 border-orange-500/40 rounded-3xl p-6 sm:p-7 shadow-2xl shadow-orange-500/10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-orange-600 dark:text-orange-400 uppercase bg-orange-500/10 px-2.5 py-0.5 rounded-full border border-orange-500/20">
                      Your Permanent Tutoring Room
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {permanentRoom?.title || `${user.name}'s Permanent Tutoring Room`}
                    </h3>
                  </div>
                </div>

                <span className="text-xs font-mono bg-slate-100 dark:bg-black/50 text-slate-700 dark:text-gray-300 px-3 py-1.5 rounded-full border border-slate-200 dark:border-white/10 self-start sm:self-center">
                  Link Quota: {userRooms.length || 1} / {userQuota} Authorized
                </span>
              </div>

              {/* URL Display & One-Click Copy */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-black/60 border border-slate-200 dark:border-[#2a2c33] rounded-2xl p-3 sm:p-3.5">
                <div className="flex items-center space-x-2 truncate mr-3">
                  <LinkIcon className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-xs sm:text-sm font-mono text-slate-800 dark:text-gray-200 truncate">
                    {window.location.origin}/#/meeting/{permanentRoom?.code || user.personalMeetingCode || 'tp-room'}
                  </span>
                </div>

                <button
                  onClick={() => handleCopyLink(permanentRoom?.code || user.personalMeetingCode || 'tp-room')}
                  className="py-1.5 px-4 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shrink-0 shadow-md shadow-orange-500/20"
                >
                  {copiedCode === (permanentRoom?.code || user.personalMeetingCode) ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-1">
                <button
                  onClick={() => onJoinMeeting(permanentRoom?.code || user.personalMeetingCode || 'tp-room', true)}
                  className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/30 transition-all hover:scale-[1.01]"
                >
                  <Video className="w-4 h-4" />
                  <span>Start Class in Your Permanent Room</span>
                </button>

                <button
                  onClick={() => setIsRequestModalOpen(true)}
                  className="py-3 px-5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-gray-200 font-medium text-xs flex items-center justify-center space-x-1.5 transition-colors border border-slate-200 dark:border-white/10"
                >
                  <PlusCircle className="w-4 h-4 text-orange-500" />
                  <span>Request Extra Link</span>
                </button>
              </div>
            </div>
          ) : (
            /* Get Started CTA Card (Logged Out) */
            <div className="bg-white/90 dark:bg-[#121316]/90 backdrop-blur-xl border border-slate-200 dark:border-[#23252a] rounded-3xl p-6 sm:p-7 shadow-xl space-y-5">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20">
                  <Zap className="w-6 h-6 fill-current" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Get Your Permanent Tutoring Link</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400">
                    Sign in with your Gmail or create a tutor account to receive your persistent room link.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={onOpenAuthModal}
                  className="flex-1 py-3.5 px-6 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.01]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Get Started for Free</span>
                </button>

                <button
                  onClick={onOpenAuthModal}
                  className="py-3 px-6 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-white font-semibold text-xs flex items-center justify-center space-x-2 border border-slate-200 dark:border-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Sign In with Gmail</span>
                </button>
              </div>
            </div>
          )}

          {/* ADDITIONAL AUTHORIZED ROOMS (If User Has Extra Links Approved) */}
          {additionalRooms.length > 0 && (
            <div className="bg-white/90 dark:bg-[#121316]/90 backdrop-blur-md border border-slate-200 dark:border-[#23252a] rounded-3xl p-5 space-y-3 shadow-md">
              <h4 className="text-xs font-bold text-slate-700 dark:text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                <span>Admin Authorized Additional Rooms ({additionalRooms.length})</span>
              </h4>

              <div className="space-y-2">
                {additionalRooms.map((room) => (
                  <div
                    key={room.id}
                    className="p-3 bg-slate-50 dark:bg-[#1a1c22] rounded-2xl flex items-center justify-between border border-slate-200 dark:border-white/5"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">{room.title}</p>
                      <p className="text-[11px] font-mono text-orange-600 dark:text-orange-400">Code: {room.code}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleCopyLink(room.code)}
                        className="p-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-gray-300 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                        title="Copy link"
                      >
                        {copiedCode === room.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => onJoinMeeting(room.code, true)}
                        className="py-1.5 px-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs flex items-center space-x-1 shadow-sm"
                      >
                        <span>Join</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending Link Requests Banner */}
          {pendingRequests.filter((r) => r.status === 'pending').length > 0 && (
            <div className="bg-orange-500/10 border border-orange-500/20 p-3.5 rounded-2xl flex items-center justify-between text-xs text-orange-600 dark:text-orange-400">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-orange-500" />
                <span>You have an additional meeting link request awaiting Admin Authorization.</span>
              </div>
            </div>
          )}

          {/* Join Another Meeting / Room by Code */}
          <div className="pt-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-gray-400 block mb-2">
              Join another teacher's class or meeting:
            </span>
            <form onSubmit={handleJoinByCode} className="flex items-center gap-2">
              <div className="flex-1 relative flex items-center bg-white dark:bg-[#121316] border border-slate-200 dark:border-[#23252a] focus-within:border-orange-500 rounded-full px-4 h-12 transition-colors shadow-sm">
                <Keyboard className="w-4 h-4 text-slate-400 dark:text-gray-400 mr-2.5 shrink-0" />
                <input
                  type="text"
                  value={meetingCodeInput}
                  onChange={(e) => setMeetingCodeInput(e.target.value)}
                  placeholder="Enter a room code (e.g. tp-sarah-4821)"
                  className="bg-transparent border-none outline-none text-sm text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 w-full"
                />
              </div>

              <button
                type="submit"
                disabled={!meetingCodeInput.trim()}
                className="h-12 px-7 rounded-full bg-slate-900 text-white dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 disabled:opacity-30 font-semibold text-sm transition-colors shrink-0 shadow"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (5 cols): GCORE Architecture Visual Microchip & Benefits */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          {/* GCORE-Style Microchip / Node System Graphic */}
          <div className="bg-white/90 dark:bg-[#121316]/90 backdrop-blur-xl border border-slate-200 dark:border-[#23252a] rounded-3xl p-6 shadow-2xl relative overflow-hidden">
            <div className="text-center space-y-1 mb-6">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                Connected Infrastructure
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                The TutorPlug Architecture
              </h3>
            </div>

            {/* Central Node Graphic */}
            <div className="relative py-4 flex flex-col items-center">
              {/* Central Microchip */}
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-black dark:from-[#181a20] dark:to-[#0f1013] border-2 border-orange-500/50 flex flex-col items-center justify-center z-10 shadow-xl shadow-orange-500/20">
                <Zap className="w-7 h-7 text-orange-500 fill-current" />
                <span className="text-[9px] font-black text-white tracking-widest mt-1">HUB</span>
              </div>

              {/* Glowing Traces */}
              <div className="w-full max-w-sm grid grid-cols-2 gap-4 mt-6">
                {/* Node 1 */}
                <div className="p-3 bg-slate-50 dark:bg-[#16181f] rounded-2xl border border-slate-200 dark:border-[#23252a] flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Permanent Link</h5>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">Never expires</p>
                  </div>
                </div>

                {/* Node 2 */}
                <div className="p-3 bg-slate-50 dark:bg-[#16181f] rounded-2xl border border-slate-200 dark:border-[#23252a] flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Auto Recording</h5>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">Always recorded</p>
                  </div>
                </div>

                {/* Node 3 */}
                <div className="p-3 bg-slate-50 dark:bg-[#16181f] rounded-2xl border border-slate-200 dark:border-[#23252a] flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Teacher Privacy</h5>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">Strictly isolated</p>
                  </div>
                </div>

                {/* Node 4 */}
                <div className="p-3 bg-slate-50 dark:bg-[#16181f] rounded-2xl border border-slate-200 dark:border-[#23252a] flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white">Admin Control</h5>
                    <p className="text-[10px] text-slate-500 dark:text-gray-400">Quota review</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Privacy Feature Callout */}
            <div className="mt-4 p-3.5 bg-orange-500/5 dark:bg-orange-500/10 rounded-2xl border border-orange-500/20 text-xs text-slate-600 dark:text-gray-300 flex items-center space-x-2.5">
              <Shield className="w-4 h-4 text-orange-500 shrink-0" />
              <span>
                <strong>Strict Class Isolation:</strong> Only you and platform administrators can view or access your recorded sessions.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Request Additional Link Modal */}
      <RequestLinkModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onRequestSubmitted={loadUserRooms}
      />
    </div>
  );
};
