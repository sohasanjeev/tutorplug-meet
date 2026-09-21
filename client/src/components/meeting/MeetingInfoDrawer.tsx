import React, { useState } from 'react';
import { X, Copy, Check, ShieldCheck, Video } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';

export const MeetingInfoDrawer: React.FC = () => {
  const { meetingCode, meetingTitle, setActiveDrawer } = useMeeting();
  const [copied, setCopied] = useState(false);

  const fullUrl = `${window.location.origin}/#/meeting/${meetingCode}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside className="w-full sm:w-80 h-full bg-[#202124] border-l border-[#3c4043] flex flex-col z-40 select-none shadow-2xl">
      <div className="h-16 px-5 border-b border-[#3c4043] flex items-center justify-between shrink-0">
        <h3 className="text-base font-semibold text-white">Meeting details</h3>
        <button
          onClick={() => setActiveDrawer('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto">
        <div>
          <h4 className="text-sm font-semibold text-gray-200">{meetingTitle || 'AuraMeet Video Call'}</h4>
          <p className="text-xs font-mono text-gray-400 mt-0.5">Code: {meetingCode}</p>
        </div>

        <div className="bg-[#2d2e30] border border-[#3c4043] rounded-2xl p-4 space-y-3">
          <div className="flex items-center space-x-2 text-blue-400 text-xs font-semibold">
            <Video className="w-4 h-4" />
            <span>Joining info</span>
          </div>
          <p className="text-xs text-gray-300 break-all font-mono bg-black/30 p-2 rounded-lg border border-white/5">
            {fullUrl}
          </p>
          <button
            onClick={handleCopy}
            className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center justify-center space-x-2 transition-colors shadow"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link copied to clipboard!' : 'Copy joining link'}</span>
          </button>
        </div>

        <div className="bg-gradient-to-br from-red-950/40 to-[#202124] border border-red-500/30 rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-red-400 text-xs font-bold uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-red-500 rec-dot" />
            <span>Automatic Continuous Recording</span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">
            This conference is automatically and continuously recorded from start to finish. You do not need to start or stop recording manually.
          </p>
          <p className="text-[10px] text-gray-400 pt-1">
            The recording file and chat transcript will be immediately accessible in the Meeting History hub once the meeting ends.
          </p>
        </div>

        <div className="bg-[#2d2e30] border border-[#3c4043] rounded-2xl p-4 space-y-2">
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>Security & Privacy</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            Audio and video are encrypted in transit via WebRTC DTLS/SRTP. Only participants with the meeting code can access the session.
          </p>
        </div>
      </div>
    </aside>
  );
};
