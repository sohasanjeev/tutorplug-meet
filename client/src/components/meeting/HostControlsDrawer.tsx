import React, { useState } from 'react';
import { X, Shield, Monitor, MessageSquare, Volume2, PhoneOff } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';

export const HostControlsDrawer: React.FC = () => {
  const { setActiveDrawer, hostEndMeetingForAll } = useMeeting();
  const [allowScreenShare, setAllowScreenShare] = useState(true);
  const [allowChat, setAllowChat] = useState(true);
  const [allowUnmute, setAllowUnmute] = useState(true);

  return (
    <aside className="w-full sm:w-80 h-full bg-[#202124] border-l border-[#3c4043] flex flex-col z-40 select-none shadow-2xl">
      <div className="h-16 px-5 border-b border-[#3c4043] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-blue-400" />
          <h3 className="text-base font-semibold text-white">Host management</h3>
        </div>
        <button
          onClick={() => setActiveDrawer('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-6 flex-1 overflow-y-auto">
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Meeting Permissions
          </h4>
          <p className="text-xs text-gray-400 mb-4 leading-relaxed">
            Let participants interact freely or restrict specific privileges during the call.
          </p>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-[#2d2e30] border border-[#3c4043]">
              <div className="flex items-center space-x-3">
                <Monitor className="w-4 h-4 text-gray-300" />
                <span className="text-xs font-medium text-gray-200">Share their screen</span>
              </div>
              <input
                type="checkbox"
                checked={allowScreenShare}
                onChange={(e) => setAllowScreenShare(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#2d2e30] border border-[#3c4043]">
              <div className="flex items-center space-x-3">
                <MessageSquare className="w-4 h-4 text-gray-300" />
                <span className="text-xs font-medium text-gray-200">Send chat messages</span>
              </div>
              <input
                type="checkbox"
                checked={allowChat}
                onChange={(e) => setAllowChat(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-[#2d2e30] border border-[#3c4043]">
              <div className="flex items-center space-x-3">
                <Volume2 className="w-4 h-4 text-gray-300" />
                <span className="text-xs font-medium text-gray-200">Turn on microphone</span>
              </div>
              <input
                type="checkbox"
                checked={allowUnmute}
                onChange={(e) => setAllowUnmute(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-gray-700 border-gray-600"
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#3c4043]">
          <h4 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-3">
            Host Termination
          </h4>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to end this meeting for all participants? The recording will be saved.')) {
                hostEndMeetingForAll();
              }
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-xs font-medium flex items-center justify-center space-x-2 transition-colors"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End meeting for all participants</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
