import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ArrowLeft,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useMeeting } from '../../context/MeetingContext.js';
import { api } from '../../services/api.js';

interface PreJoinLobbyProps {
  meetingCode: string;
  onJoinComplete: () => void;
  onBack: () => void;
}

export const PreJoinLobby: React.FC<PreJoinLobbyProps> = ({
  meetingCode,
  onJoinComplete,
  onBack,
}) => {
  const { user, token } = useAuth();
  const { joinRoom, waitingStatus, cancelWaiting } = useMeeting();

  const [displayName, setDisplayName] = useState(user?.name || '');
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [meetingTitle, setMeetingTitle] = useState('Loading conference...');
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [meetingHostId, setMeetingHostId] = useState<string | null>(null);
  const [isHostOverride, setIsHostOverride] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    async function checkMeeting() {
      try {
        const res = await api.getMeetingByCode(meetingCode, token, user?.id);
        setMeetingTitle(res.meeting.title || 'TutorPlug Tutoring Room');
        setMeetingHostId(res.meeting.host_id || null);
        setErrorMessage(null);
      } catch (err: any) {
        // For any tp-* format code, provide a friendly default title and NEVER show red error
        if (meetingCode.toLowerCase().startsWith('tp-')) {
          const rawName = meetingCode.split('-')[1] || 'Tutor';
          const cleanName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
          setMeetingTitle(`${cleanName}'s Tutoring Room`);
          setErrorMessage(null);
        } else {
          setErrorMessage(err.message || 'Meeting code invalid or expired');
        }
      }
    }
    checkMeeting();
  }, [meetingCode, token, user?.id]);

  useEffect(() => {
    let localMediaStream: MediaStream | null = null;
    let audioContext: AudioContext | null = null;

    async function initPreview() {
      try {
        localMediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        });

        setPreviewStream(localMediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = localMediaStream;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContext = new AudioCtx();
        const source = audioContext.createMediaStreamSource(localMediaStream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = Math.min(100, Math.round((sum / dataArray.length) * 1.5));
          setAudioLevel(avg);
          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        animFrameRef.current = requestAnimationFrame(checkLevel);
      } catch (e) {
        console.warn('Media preview permission denied or unavailable:', e);
      }
    }

    initPreview();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioContext) audioContext.close();
      if (localMediaStream) {
        localMediaStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const toggleMic = () => {
    if (previewStream) {
      previewStream.getAudioTracks().forEach((t) => (t.enabled = !isAudioEnabled));
    }
    setIsAudioEnabled(!isAudioEnabled);
  };

  const toggleCam = () => {
    if (previewStream) {
      previewStream.getVideoTracks().forEach((t) => (t.enabled = !isVideoEnabled));
    }
    setIsVideoEnabled(!isVideoEnabled);
  };

  // 1. Owns this personal room
  const ownsRoom = Boolean(
    user?.personalMeetingCode &&
    user.personalMeetingCode.toLowerCase() === meetingCode.toLowerCase()
  );

  // 2. Direct host ID match from DB
  const isDirectHostId = Boolean(
    user && meetingHostId && user.id === meetingHostId
  );

  // 3. User is an admin
  const isAdmin = Boolean(user && user.role === 'admin');

  // 4. URL explicitly has role=host
  const hashOrSearch = (window.location.hash || '') + (window.location.search || '');
  const hasHostUrlParam = hashOrSearch.includes('role=host');

  // 5. Slug match (e.g. tp-sanjee-rb27 has slug "sanjee", user name is "Sanjeev")
  const codeSlug = (meetingCode.split('-')[1] || '').toLowerCase();
  const slugMatchesUser = Boolean(
    codeSlug && codeSlug.length >= 3 && (
      (user?.name && user.name.toLowerCase().includes(codeSlug)) ||
      (displayName && displayName.trim().toLowerCase().includes(codeSlug))
    )
  );

  // Auto-calculated host status
  const calculatedIsHost = ownsRoom || isDirectHostId || isAdmin || hasHostUrlParam || slugMatchesUser;

  // Effective isHost
  const isHost = isHostOverride !== null ? isHostOverride : calculatedIsHost;

  const handleJoin = async (forceHostRole?: boolean) => {
    const effectiveIsHost = forceHostRole !== undefined ? forceHostRole : isHost;
    const finalName = displayName.trim() || (effectiveIsHost ? (user?.name || 'Tutor') : 'Guest Participant');
    const role = effectiveIsHost ? 'host' : 'participant';
    try {
      setIsJoining(true);
      if (previewStream) {
        previewStream.getTracks().forEach((t) => t.stop());
      }
      await joinRoom(meetingCode, finalName, role, {
        audio: isAudioEnabled,
        video: isVideoEnabled,
      }, user?.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to enter conference');
      setIsJoining(false);
    }
  };

  const handleJoinAsHost = () => {
    setIsHostOverride(true);
    cancelWaiting();
    handleJoin(true);
  };

  return (
    <div className="min-h-screen bg-[#131314] text-white flex flex-col justify-between p-4 sm:p-8 select-none">
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Return home</span>
        </button>
        <span className="text-sm font-mono text-gray-500 tracking-wider">
          {meetingCode}
        </span>
      </div>

      <div className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto py-6">
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-[#202124] rounded-3xl overflow-hidden border border-[#3c4043] shadow-2xl flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover mirror ${
                isVideoEnabled && previewStream ? 'block' : 'hidden'
              }`}
            />

            {(!isVideoEnabled || !previewStream) && (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-800 text-3xl font-bold flex items-center justify-center shadow-xl ring-4 ring-white/10">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'A'}
                </div>
                <p className="text-sm text-gray-400 font-medium">Camera is off</p>
              </div>
            )}

            <div className="absolute bottom-4 inset-x-0 flex items-center justify-center space-x-3 z-10">
              <button
                onClick={toggleMic}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isAudioEnabled
                    ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white shadow'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                }`}
                title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
              </button>

              <button
                onClick={toggleCam}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                  isVideoEnabled
                    ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white shadow'
                    : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            </div>

            {isAudioEnabled && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center space-x-2 border border-white/10">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-75"
                    style={{ width: `${Math.max(5, audioLevel)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col space-y-6 max-w-md mx-auto lg:mx-0 w-full">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
              {waitingStatus !== 'none' ? 'Tutoring Room' : 'Ready to join?'}
            </h1>
            <p className="text-base text-gray-300 font-medium">{meetingTitle}</p>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs leading-relaxed">
              {errorMessage}
            </div>
          )}

          {waitingStatus === 'asking_to_join' && (
            <div className="bg-[#1a1f2c] border border-orange-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Asking to join...</h2>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  You will enter the tutoring session automatically as soon as the host admits you.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleJoinAsHost}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-bold text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>I am the Host (Enter Directly)</span>
                </button>
                <button
                  onClick={() => {
                    cancelWaiting();
                    setIsJoining(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          {waitingStatus === 'host_not_present' && (
            <div className="bg-[#1a1f2c] border border-amber-500/30 rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Waiting for Host...</h2>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  The host has not started the session yet. If you are the tutor, click below to start class immediately.
                </p>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <button
                  onClick={handleJoinAsHost}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-bold text-xs shadow-lg flex items-center justify-center space-x-1.5 transition-all cursor-pointer hover:scale-105"
                >
                  <Sparkles className="w-4 h-4 fill-current text-black" />
                  <span>I am the Host / Tutor — Start Class Now</span>
                </button>
                <button
                  onClick={() => {
                    cancelWaiting();
                    setIsJoining(false);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel Request
                </button>
              </div>
            </div>
          )}

          {waitingStatus === 'denied' && (
            <div className="bg-red-950/40 border border-red-500/40 rounded-3xl p-6 text-center space-y-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-red-300">Admission Denied</h2>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                  The host did not admit you to this tutoring session.
                </p>
              </div>
              <button
                onClick={onBack}
                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-semibold transition-all cursor-pointer"
              >
                Return Home
              </button>
            </div>
          )}

          {waitingStatus === 'none' && (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Your Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What's your name?"
                  className="w-full bg-[#202124] border border-[#3c4043] rounded-2xl px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Host/Student Role Indicator and Mode Switch */}
              {isHost ? (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-xs">
                  <div className="flex items-center space-x-2 text-orange-400 font-semibold">
                    <span>👑</span>
                    <span>Host / Tutor Mode Active (Direct Entry)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsHostOverride(false)}
                    className="text-[11px] text-gray-400 hover:text-gray-200 underline cursor-pointer"
                  >
                    Join as Student
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-gray-400">Joining as Student / Participant</span>
                  <button
                    type="button"
                    onClick={() => setIsHostOverride(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 font-semibold flex items-center space-x-1 cursor-pointer"
                  >
                    <span>I am the Tutor / Host</span>
                    <Sparkles className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div className="bg-gradient-to-br from-red-950/40 via-red-900/20 to-[#202124] border border-red-500/40 rounded-2xl p-4 space-y-2 shadow-lg">
                <div className="flex items-center space-x-2 text-red-400 text-xs font-bold uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 rec-dot" />
                  <span>Automatic Recording Active</span>
                </div>
                <p className="text-xs text-gray-200 leading-relaxed font-medium">
                  "This meeting is automatically recorded and the recording will be stored for future access."
                </p>
                <p className="text-[11px] text-gray-400">
                  Audio, video, chat transcript, and shared files will be archived securely.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={() => handleJoin()}
                  disabled={isJoining}
                  className="flex-1 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black font-bold text-sm transition-all shadow-lg hover:shadow-orange-500/30 disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>
                    {isJoining
                      ? 'Connecting...'
                      : isHost
                      ? 'Start Meeting as Host'
                      : 'Ask to Join Class'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="text-center text-xs text-gray-500 max-w-6xl mx-auto w-full pt-4">
        TutorPlug • Permanent 1-Link Rooms & Continuous Automatic Storage Engine
      </div>
    </div>
  );
};
