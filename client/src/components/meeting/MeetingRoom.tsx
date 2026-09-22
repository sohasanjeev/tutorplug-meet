import React from 'react';
import { useMeeting } from '../../context/MeetingContext.js';
import { RecordingBadge } from './RecordingBadge.js';
import { ConsentBanner } from './ConsentBanner.js';
import { VideoGrid } from './VideoGrid.js';
import { MeetingControls } from './MeetingControls.js';
import { ChatPanel } from './ChatPanel.js';
import { ParticipantsPanel } from './ParticipantsPanel.js';
import { MeetingInfoDrawer } from './MeetingInfoDrawer.js';
import { HostControlsDrawer } from './HostControlsDrawer.js';
import { AdmissionPrompt } from './AdmissionPrompt.js';

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

  const hashMeetingCode = (window.location.hash.split('/meeting/')[1] || '').split('?')[0];
  const displayCode = meetingCode || hashMeetingCode;
  const displayTitle = meetingTitle || (displayCode ? `Tutoring Room (${displayCode})` : 'TutorPlug Session');

  return (
    <div className="relative w-screen h-screen bg-[#131314] flex flex-col overflow-hidden select-none">
      {/* Host Admission Notification Modal / Toast */}
      <AdmissionPrompt />

      {/* 1. Privacy Recording Consent Banner (Top) */}
      {!hasRecordedNoticeDismissed && (
        <ConsentBanner onDismiss={() => setHasRecordedNoticeDismissed(true)} />
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

        {/* Right: Security info */}
        <div className="flex items-center space-x-2 text-xs text-gray-400">
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
        {activeDrawer === 'people' && <ParticipantsPanel />}
        {activeDrawer === 'info' && <MeetingInfoDrawer />}
        {activeDrawer === 'host' && <HostControlsDrawer />}
      </div>

      {/* 4. Google Meet Floating Pill Controls Dock */}
      <MeetingControls />
    </div>
  );
};
