import React, { useState } from 'react';
import { X, Mic, MicOff, Video, VideoOff, Shield, UserX, Search, VolumeX } from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';

interface ParticipantsPanelProps {
  onOpenProfile?: (participant: Participant) => void;
}

export const ParticipantsPanel: React.FC<ParticipantsPanelProps> = ({ onOpenProfile }) => {
  const {
    participants,
    selfParticipant,
    setActiveDrawer,
    hostMuteUser,
    hostMuteAll,
    hostKickUser,
  } = useMeeting();

  const [searchTerm, setSearchTerm] = useState('');

  const isHost = selfParticipant?.role === 'host';
  const allParticipants = selfParticipant ? [selfParticipant, ...participants] : participants;

  const filtered = allParticipants.filter((p) =>
    p.displayName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <aside className="w-full sm:w-80 h-full bg-[#202124] border-l border-[#3c4043] flex flex-col z-40 select-none shadow-2xl">
      {/* Header */}
      <div className="h-16 px-5 border-b border-[#3c4043] flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <h3 className="text-base font-semibold text-white">People</h3>
          <span className="text-xs font-semibold bg-white/10 px-2 py-0.5 rounded-full text-gray-300">
            {allParticipants.length}
          </span>
        </div>
        <button
          onClick={() => setActiveDrawer('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Host Controls Action: Mute All */}
      {isHost && (
        <div className="p-3 border-b border-[#3c4043] bg-[#1e1f20]">
          <button
            onClick={hostMuteAll}
            className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-medium flex items-center justify-center space-x-2 transition-colors"
          >
            <VolumeX className="w-4 h-4 text-red-400" />
            <span>Mute everyone</span>
          </button>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-[#3c4043]">
        <div className="flex items-center bg-[#2d2e30] rounded-xl px-3 py-1.5 border border-[#3c4043] text-xs">
          <Search className="w-3.5 h-3.5 text-gray-400 mr-2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search for people..."
            className="bg-transparent border-none outline-none text-gray-200 w-full placeholder-gray-500"
          />
        </div>
      </div>

      {/* Participants List */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {filtered.map((p) => {
          const isSelf = p.socketId === selfParticipant?.socketId;

          return (
            <div key={p.socketId} className="p-3.5 flex items-center justify-between hover:bg-white/5 transition-colors">
              <button
                type="button"
                onClick={() => onOpenProfile?.(p)}
                className="flex items-center space-x-3 truncate text-left flex-1 hover:opacity-85 transition-opacity cursor-pointer"
                title={`Click to view ${p.displayName}'s profile`}
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 p-0.5 shrink-0 overflow-hidden">
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.displayName} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#202124] flex items-center justify-center text-xs font-bold text-amber-400">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="truncate">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="text-sm font-medium text-gray-200 truncate">
                      {p.displayName} {isSelf && '(You)'}
                    </span>
                    {p.role === 'host' && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-semibold flex items-center space-x-0.5 shrink-0">
                        <Shield className="w-2.5 h-2.5 mr-0.5" />
                        Host
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 text-[11px] text-gray-400 truncate">
                    {p.userType === 'student' ? (
                      <span className="text-blue-400 font-mono font-medium truncate">
                        {p.rollNumber || 'Student'} {p.classGrade ? `• ${p.classGrade}` : ''}
                      </span>
                    ) : (
                      <span>{isSelf ? 'Meeting organizer (You)' : (p.role === 'host' ? 'Host Teacher' : 'Teacher')}</span>
                    )}
                  </div>
                </div>
              </button>

              {/* Status Icons and Host Actions */}
              <div className="flex items-center space-x-1 shrink-0">
                {/* Audio Status */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    p.audioEnabled ? 'text-gray-400' : 'text-red-400 bg-red-500/10'
                  }`}
                  title={p.audioEnabled ? 'Microphone on' : 'Microphone muted'}
                >
                  {p.audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                </div>

                {/* Video Status */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center ${
                    p.videoEnabled ? 'text-gray-400' : 'text-red-400 bg-red-500/10'
                  }`}
                  title={p.videoEnabled ? 'Camera on' : 'Camera turned off'}
                >
                  {p.videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                </div>

                {/* Host Moderation Controls for remote participants */}
                {isHost && !isSelf && (
                  <div className="flex items-center space-x-0.5 ml-1 pl-1 border-l border-white/10">
                    {p.audioEnabled && (
                      <button
                        onClick={() => hostMuteUser(p.socketId)}
                        className="w-7 h-7 rounded-full hover:bg-white/10 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                        title="Mute participant"
                      >
                        <MicOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${p.displayName} from this meeting?`)) {
                          hostKickUser(p.socketId);
                        }
                      }}
                      className="w-7 h-7 rounded-full hover:bg-red-500/20 text-gray-400 hover:text-red-400 flex items-center justify-center transition-colors"
                      title="Remove participant"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
