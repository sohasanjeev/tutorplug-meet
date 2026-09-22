import React from 'react';
import { UserCheck, UserX, Users, Bell } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';

export const AdmissionPrompt: React.FC = () => {
  const { waitingParticipants, admitParticipant, denyParticipant, admitAll, selfParticipant } = useMeeting();

  // Only the host sees the admission prompt
  if (!selfParticipant || selfParticipant.role !== 'host' || waitingParticipants.length === 0) {
    return null;
  }

  const latest = waitingParticipants[0];
  const count = waitingParticipants.length;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full px-4 animate-bounce-short">
      <div className="bg-[#1e2330]/95 backdrop-blur-xl border border-orange-500/40 shadow-2xl rounded-2xl p-4 text-white flex flex-col sm:flex-row items-center justify-between gap-3 ring-1 ring-white/10">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center shrink-0 shadow-lg text-black font-bold">
            <Bell className="w-5 h-5 animate-pulse text-black" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-100 truncate">
              {latest.displayName}
              {count > 1 ? ` and ${count - 1} other${count > 2 ? 's' : ''}` : ''}
            </p>
            <p className="text-xs text-orange-300/90 font-medium">
              Wants to join this class
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          {count > 1 ? (
            <>
              <button
                onClick={admitAll}
                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Admit All ({count})</span>
              </button>
              <button
                onClick={() => denyParticipant(latest.socketId)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-red-500/30 text-gray-300 hover:text-red-400 text-xs transition-all cursor-pointer"
                title="Deny latest"
              >
                <UserX className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => denyParticipant(latest.socketId)}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-white/10 hover:bg-red-500/30 text-gray-300 hover:text-red-400 text-xs font-medium transition-all cursor-pointer"
              >
                <UserX className="w-3.5 h-3.5" />
                <span>Deny</span>
              </button>
              <button
                onClick={() => admitParticipant(latest.socketId)}
                className="flex items-center space-x-1 px-4 py-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Admit</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};