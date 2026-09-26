import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Pin, Hand, Info } from 'lucide-react';
import type { Participant } from '../../types.js';

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
  onOpenProfile?: (participant: Participant) => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal = false,
  isActiveSpeaker = false,
  isPinned = false,
  onTogglePin,
  onOpenProfile,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [, setTrackRevision] = React.useState(0);

  // Dedicated remote audio receiver - plays continuously regardless of camera state
  useEffect(() => {
    if (!audioRef.current) return;
    if (!stream || isLocal) {
      audioRef.current.srcObject = null;
      return;
    }
    if (audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }
    audioRef.current.play().catch(() => {});
  }, [stream, isLocal]);

  // Video element stream handler
  useEffect(() => {
    if (!stream) {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    if (videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
      }
      videoRef.current.play().catch(() => {});
    }

    const handleTracksChanged = () => {
      setTrackRevision((r) => r + 1);
      if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }
      if (audioRef.current && !isLocal) {
        audioRef.current.play().catch(() => {});
      }
    };

    stream.addEventListener('addtrack', handleTracksChanged);
    stream.addEventListener('removetrack', handleTracksChanged);

    return () => {
      stream.removeEventListener('addtrack', handleTracksChanged);
      stream.removeEventListener('removetrack', handleTracksChanged);
    };
  }, [stream, isLocal, participant.isScreenSharing]);

  const isSharing = Boolean(participant.isScreenSharing);
  const videoTracks = stream ? stream.getVideoTracks() : [];
  const hasLiveVideoTrack = videoTracks.some((t) => t.readyState !== 'ended');
  const hasVideo = isSharing || (participant.videoEnabled && hasLiveVideoTrack);

  return (
    <div
      className={`relative w-full h-full bg-[#18191d] rounded-2xl overflow-hidden border border-[#3c4043] flex items-center justify-center transition-all duration-200 group select-none shadow-md ${
        isActiveSpeaker ? 'active-speaker-ring ring-offset-2 ring-offset-[#131314]' : ''
      }`}
    >
      {/* Dedicated always-on audio element for remote participants - independent of video visibility */}
      {!isLocal && (
        <audio
          ref={audioRef}
          autoPlay
          playsInline
          muted={false}
          className="sr-only"
        />
      )}

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full ${
          isSharing ? 'object-contain bg-black' : 'object-cover'
        } ${
          isLocal && !isSharing ? 'mirror' : ''
        } ${hasVideo ? 'block' : 'hidden'}`}
      />

      {!hasVideo && (
        <div
          onClick={() => onOpenProfile?.(participant)}
          className={`flex flex-col items-center justify-center space-y-3 z-0 ${onOpenProfile ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
          title={onOpenProfile ? `Click to view ${participant.displayName}'s profile` : undefined}
        >
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 p-1 shadow-xl ring-4 ring-white/10 overflow-hidden">
            {participant.avatar ? (
              <img
                src={participant.avatar}
                alt={participant.displayName}
                className="w-full h-full object-cover rounded-full bg-[#18191d]"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-[#202124] flex items-center justify-center text-2xl sm:text-4xl font-extrabold text-amber-400">
                {participant.displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="text-center px-3">
            <span className="text-sm sm:text-base font-semibold text-gray-200 block">
              {participant.displayName} {isLocal && '(You)'}
            </span>
            {participant.rollNumber && (
              <span className="text-[11px] font-mono text-blue-400 font-medium block">
                Roll ID: {participant.rollNumber}
              </span>
            )}
            {participant.bio && (
              <p className="text-[11px] text-gray-400 max-w-[200px] truncate mx-auto mt-0.5">
                {participant.bio}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 flex items-center space-x-1.5 z-10">
        {onOpenProfile && (
          <button
            onClick={() => onOpenProfile(participant)}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white transition-all shadow"
            title={`View ${participant.displayName}'s profile`}
          >
            <Info className="w-4 h-4" />
          </button>
        )}
        {participant.isHandRaised && (
          <div className="flex items-center space-x-1 bg-yellow-500/90 text-black px-2 py-1 rounded-full text-xs font-bold shadow-lg animate-bounce">
            <Hand className="w-3.5 h-3.5" />
            <span>Raised</span>
          </div>
        )}
        {onTogglePin && (
          <button
            onClick={onTogglePin}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isPinned
                ? 'bg-blue-600 text-white'
                : 'bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-black/80 hover:text-white'
            }`}
            title={isPinned ? 'Unpin' : 'Pin to main screen'}
          >
            <Pin className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-medium text-white shadow max-w-[80%] truncate">
          <span className="truncate">{participant.displayName} {isLocal && '(You)'}</span>
          {participant.role === 'host' ? (
            <span className="text-[9px] bg-blue-500/30 text-blue-300 px-1 py-0.5 rounded font-semibold shrink-0">
              Host
            </span>
          ) : participant.userType === 'student' ? (
            <span className="text-[9px] bg-blue-600/30 text-blue-300 px-1 py-0.5 rounded font-semibold shrink-0 font-mono">
              {participant.rollNumber || 'Student'}
            </span>
          ) : (
            <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 py-0.5 rounded font-semibold shrink-0">
              Teacher
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="text-[9px] bg-emerald-500/30 text-emerald-300 px-1 py-0.5 rounded font-semibold shrink-0">
              Sharing
            </span>
          )}
        </div>

        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shadow shrink-0 ${
            participant.audioEnabled
              ? 'bg-black/50 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {participant.audioEnabled ? (
            <Mic className="w-3.5 h-3.5" />
          ) : (
            <MicOff className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
};
