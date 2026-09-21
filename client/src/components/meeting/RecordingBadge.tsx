import React, { useState } from 'react';
import { ShieldCheck, Info } from 'lucide-react';

interface RecordingBadgeProps {
  durationSeconds: number;
}

export const RecordingBadge: React.FC<RecordingBadgeProps> = ({ durationSeconds }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative inline-flex items-center">
      <div
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-red-500/40 shadow-lg cursor-pointer hover:bg-black/80 transition-all"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 rec-dot" />
        <span className="text-xs font-bold tracking-wider text-red-400 uppercase">REC</span>
        <span className="text-xs font-mono font-medium text-gray-200">
          {formatTimer(durationSeconds)}
        </span>
        <Info className="w-3.5 h-3.5 text-gray-400 hover:text-white ml-0.5" />
      </div>

      {/* Floating Info Tooltip */}
      {showTooltip && (
        <div className="absolute top-10 left-0 w-72 bg-[#28292a] border border-[#3c4043] text-gray-200 text-xs rounded-xl shadow-2xl p-3.5 z-50 animate-in fade-in zoom-in duration-150">
          <div className="flex items-center space-x-1.5 text-red-400 font-semibold mb-1">
            <span className="w-2 h-2 rounded-full bg-red-500 rec-dot" />
            <span>Automatic Continuous Recording</span>
          </div>
          <p className="text-gray-300 leading-relaxed text-[11px] mb-2">
            This meeting is automatically recorded from start to finish. Audio, video, and screen sharing are preserved in cloud/local storage.
          </p>
          <div className="flex items-center space-x-1 text-emerald-400 text-[10px] font-medium pt-1.5 border-t border-[#3c4043]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Encrypted at rest • Accessible in History</span>
          </div>
        </div>
      )}
    </div>
  );
};
