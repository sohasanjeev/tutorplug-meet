import React, { useState } from 'react';
import { useMeeting } from '../../context/MeetingContext.js';
import type { Participant } from '../../types.js';
import { RecordingBadge } from './RecordingBadge.js';
import { MeetingSafetyModal } from './MeetingSafetyModal.js';
import { VideoGrid } from './VideoGrid.js';
import { MeetingControls } from './MeetingControls.js';
import { ChatPanel } from './ChatPanel.js';
import { ParticipantsPanel } from './ParticipantsPanel.js';
import { MeetingInfoDrawer } from './MeetingInfoDrawer.js';
import { HostControlsDrawer } from './HostControlsDrawer.js';
import { AdmissionPrompt } from './AdmissionPrompt.js';
import { UserProfileModal } from './UserProfileModal.js';

export const MeetingRoom: React.FC = () => {
  const {
    meetingTitle,
    meetingCode,
    selfParticipant,
    localStream,
    screenStream,
    participants,
    remoteStreams,
    activeSpeakerId,
    layoutMode,
    pinnedId,
    setPinnedId,
    recordingDuration,
    reactions,
    activeDrawer,
    hasRecordedNoticeDismissed,
    setHasRecordedNoticeDismissed,
  } = useMeeting();

  const [inspectingParticipant, setInspectingParticipant] = useState<Participant | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isInspectingSelf, setIsInspectingSelf] = useState(false);

  const hashMeetingCode = (window.location.hash.split('/meeting/')[1] || '').split('?')[0];
  const displayCode = meetingCode || hashMeetingCode;
  const displayTitle = meetingTitle || (displayCode ? `Tutoring Room (${displayCode})` : 'TutorPlug Session');

  const handleOpenProfile = (p: Participant) => {
    setInspectingParticipant(p);
    setIsInspectingSelf(p.socketId === selfParticipant?.socketId || p.socketId === 'self');
    setIsProfileModalOpen(true);
  };

  const handleOpenMyProfile = () => {
    setInspectingParticipant(selfParticipant);
    setIsInspectingSelf(true);
    setIsProfileModalOpen(true);
  };

  return (
    <div className="relative w-screen h-screen bg-[#131314] flex flex-col overflow-hidden select-none">
      {/* Host Admission Notification Modal / Toast */}
      <AdmissionPrompt />

      {/* 1. Polite 4-Second Learning & Recording Safety Notice Modal */}
      {!hasRecordedNoticeDismissed && (
        <MeetingSafetyModal onDismiss={() => setHasRecordedNoticeDismissed(true)} />
      )}

      {/* 2. Top Meeting Header */}
      <header className="h-14 px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
        {/* Left: Recording Indicator Badge + Title */}
        <div className="flex items-center space-x-3">
          {/* CRITICAL: Continuous Recording Badge */}
          <RecordingBadge durationSeconds={recordingDuration} />

          <div className="hidden sm:flex items-center space-x-2 pl-2 border-l border-[#3c4043]">
            <h2 className="text-sm font-semibold text-gray-200 truncate max-w-xs">
              {displayTitle}
            </h2>
            {displayCode && <span className="text-xs font-mono text-gray-400">({displayCode})</span>}
          </div>
        </div>

        {/* Right: Security info & My Profile quick trigger */}
        <div className="flex items-center space-x-3 text-xs text-gray-400">
          <button
            onClick={handleOpenMyProfile}
            className="flex items-center space-x-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full text-xs text-gray-200 transition-colors cursor-pointer"
            title="View or edit your permanent profile & photo"
          >
            <div className="w-5 h-5 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-[10px] font-bold text-black shrink-0">
              {selfParticipant?.avatar ? (
                <img src={selfParticipant.avatar} alt="Me" className="w-full h-full object-cover" />
              ) : (
                <span>{selfParticipant?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
              )}
            </div>
            <span className="hidden sm:inline font-medium">My Profile</span>
          </button>

          <span className="hidden md:inline bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-[11px] text-gray-300">
            🔒 Encrypted Call
          </span>
        </div>
      </header>

      {/* 3. Main Video Stage & Slide-over Drawers */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Video Grid Canvas */}
        <main className="flex-1 h-full min-h-0 relative overflow-hidden">
          <VideoGrid
            selfParticipant={selfParticipant}
            localStream={localStream}
            screenStream={screenStream}
            participants={participants}
            remoteStreams={remoteStreams}
            activeSpeakerId={activeSpeakerId}
            layoutMode={layoutMode}
            pinnedId={pinnedId}
            onTogglePin={setPinnedId}
            onOpenProfile={handleOpenProfile}
          />

          {/* Floating Emoji Reactions Stream Overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {reactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-20 animate-float-up text-4xl select-none"
                style={{ left: `${r.x}%` }}
              >
                {r.emoji}
              </div>
            ))}
          </div>
        </main>

        {/* Drawers (Chat, People, Info, Host) */}
        {activeDrawer === 'chat' && <ChatPanel />}
        {activeDrawer === 'people' && <ParticipantsPanel onOpenProfile={handleOpenProfile} />}
        {activeDrawer === 'info' && <MeetingInfoDrawer />}
        {activeDrawer === 'host' && <HostControlsDrawer />}
      </div>

      {/* 4. Google Meet Floating Pill Controls Dock */}
      <MeetingControls onOpenProfile={handleOpenMyProfile} />

      {/* 5. In-Meeting User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        participant={inspectingParticipant}
        isSelf={isInspectingSelf}
      />
    </div>
  );
};
