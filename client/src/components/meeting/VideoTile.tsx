import React, { useRef, useEffect } from 'react';
import { Mic, MicOff, Pin, Hand } from 'lucide-react';
import type { Participant } from '../../types.js';

interface VideoTileProps {
  participant: Participant;
  stream?: MediaStream | null;
  isLocal?: boolean;
  isActiveSpeaker?: boolean;
  isPinned?: boolean;
  onTogglePin?: () => void;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  stream,
  isLocal = false,
  isActiveSpeaker = false,
  isPinned = false,
  onTogglePin,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  const isSharing = Boolean(participant.isScreenSharing);
  const hasLiveVideoTrack = Boolean(stream && stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'));
  const hasVideo = (participant.videoEnabled || isSharing) && hasLiveVideoTrack;

  return (
    <div
      className={`relative w-full h-full bg-[#18191d] rounded-2xl overflow-hidden border border-[#3c4043] flex items-center justify-center transition-all duration-200 group select-none shadow-md ${
        isActiveSpeaker ? 'active-speaker-ring ring-offset-2 ring-offset-[#131314]' : ''
      }`}
    >
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
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full bg-gradient-to-br from-blue-700 to-indigo-900 text-white font-bold text-2xl sm:text-4xl flex items-center justify-center shadow-xl ring-4 ring-white/10">
            {participant.displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm sm:text-base font-medium text-gray-300">
            {participant.displayName} {isLocal && '(You)'}
          </span>
        </div>
      )}

      <div className="absolute top-3 right-3 flex items-center space-x-1.5 z-10">
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
        <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-medium text-white shadow">
          <span>{participant.displayName} {isLocal && '(You)'}</span>
          {participant.role === 'host' && (
            <span className="text-[10px] bg-blue-500/30 text-blue-300 px-1 rounded font-semibold">
              Host
            </span>
          )}
          {participant.isScreenSharing && (
            <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-1 rounded font-semibold">
              Sharing
            </span>
          )}
        </div>

        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center shadow ${
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
