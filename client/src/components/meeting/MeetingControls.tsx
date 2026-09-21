import React, { useState, useEffect } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  Hand,
  Smile,
  PhoneOff,
  Info,
  Users,
  MessageSquare,
  Shield,
  LayoutGrid,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';

export const MeetingControls: React.FC = () => {
  const {
    meetingCode,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    isHandRaised,
    participants,
    unreadMessageCount,
    activeDrawer,
    layoutMode,
    selfParticipant,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleHandRaise,
    sendReaction,
    setActiveDrawer,
    setLayoutMode,
    leaveMeeting,
    hostEndMeetingForAll,
  } = useMeeting();

  const [showReactionsMenu, setShowReactionsMenu] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const update = () => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const isHost = selfParticipant?.role === 'host';
  const totalPeopleCount = participants.length + 1; // self + remote

  const handleDrawerToggle = (drawer: 'chat' | 'people' | 'info' | 'host') => {
    setActiveDrawer(activeDrawer === drawer ? 'none' : drawer);
  };

  const reactions = ['👍', '👏', '❤️', '💡', '😂', '🔥', '🎉'];

  return (
    <>
      <footer className="h-20 bg-[#1e1f20] border-t border-[#3c4043] px-4 sm:px-6 flex items-center justify-between z-30 select-none">
        {/* Left: Meeting code & clock */}
        <div className="hidden sm:flex items-center space-x-3 text-sm text-gray-300 font-medium w-1/4">
          <span>{currentTime}</span>
          <span className="text-gray-500">|</span>
          <span className="tracking-wide font-mono text-gray-400">{meetingCode}</span>
        </div>

        {/* Center: Main call action buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3 justify-center flex-1">
          {/* Audio toggle */}
          <button
            onClick={toggleAudio}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
              !isAudioMuted
                ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
            }`}
            title={!isAudioMuted ? 'Turn off microphone' : 'Turn on microphone'}
          >
            {!isAudioMuted ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Video toggle */}
          <button
            onClick={toggleVideo}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
              !isVideoOff
                ? 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
                : 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
            }`}
            title={!isVideoOff ? 'Turn off camera' : 'Turn on camera'}
          >
            {!isVideoOff ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg ring-2 ring-blue-400'
                : 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
            }`}
            title={isScreenSharing ? 'Stop sharing screen' : 'Share entire screen or window'}
          >
            <MonitorUp className="w-5 h-5" />
          </button>

          {/* Raise Hand */}
          <button
            onClick={toggleHandRaise}
            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
              isHandRaised
                ? 'bg-yellow-500 hover:bg-yellow-600 text-black shadow-lg font-bold'
                : 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
            }`}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand className="w-5 h-5" />
          </button>

          {/* Emoji Reactions Picker */}
          <div className="relative">
            <button
              onClick={() => setShowReactionsMenu(!showReactionsMenu)}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all ${
                showReactionsMenu
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#3c4043] hover:bg-[#4a4e52] text-white'
              }`}
              title="Send a reaction"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Reactions Popover Bar */}
            {showReactionsMenu && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-[#2d2e30] border border-[#3c4043] rounded-full px-3 py-2 flex items-center space-x-2 shadow-2xl z-50 animate-in fade-in zoom-in duration-150">
                {reactions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      sendReaction(emoji);
                      setShowReactionsMenu(false);
                    }}
                    className="text-2xl hover:scale-125 transition-transform p-1 focus:outline-none"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Leave Call (Red Pill Button) */}
          <button
            onClick={() => setShowLeaveModal(true)}
            className="h-11 sm:h-12 px-5 sm:px-6 rounded-full bg-red-600 hover:bg-red-700 text-white font-medium flex items-center space-x-2 shadow-lg transition-all"
            title="Leave call"
          >
            <PhoneOff className="w-5 h-5" />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        {/* Right: Drawer toggles */}
        <div className="flex items-center space-x-1 sm:space-x-2 justify-end w-1/4">
          {/* Layout switcher */}
          <button
            onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              layoutMode === 'speaker' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title={`Switch to ${layoutMode === 'grid' ? 'Speaker View' : 'Grid View'}`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 rounded-full hidden sm:flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          {/* Meeting Info drawer */}
          <button
            onClick={() => handleDrawerToggle('info')}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              activeDrawer === 'info' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Meeting details"
          >
            <Info className="w-5 h-5" />
          </button>

          {/* People drawer */}
          <button
            onClick={() => handleDrawerToggle('people')}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              activeDrawer === 'people' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="People"
          >
            <Users className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {totalPeopleCount}
            </span>
          </button>

          {/* Chat drawer */}
          <button
            onClick={() => handleDrawerToggle('chat')}
            className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              activeDrawer === 'chat' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
            }`}
            title="Chat with everyone"
          >
            <MessageSquare className="w-5 h-5" />
            {unreadMessageCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                {unreadMessageCount}
              </span>
            )}
          </button>

          {/* Host Controls Drawer */}
          {isHost && (
            <button
              onClick={() => handleDrawerToggle('host')}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                activeDrawer === 'host' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Host management controls"
            >
              <Shield className="w-5 h-5" />
            </button>
          )}
        </div>
      </footer>

      {/* Leave Call Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#2d2e30] border border-[#3c4043] rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
              <PhoneOff className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Leave the meeting?</h3>
            <p className="text-sm text-gray-300 mb-6">
              {isHost
                ? 'As the host, you can leave or end the call for all participants. The meeting recording will be automatically finalized.'
                : 'You can rejoin anytime using the meeting code or link.'}
            </p>

            <div className="flex flex-col space-y-2.5">
              {isHost && (
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    hostEndMeetingForAll();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors shadow"
                >
                  End meeting for all
                </button>
              )}
              <button
                onClick={() => {
                  setShowLeaveModal(false);
                  leaveMeeting();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-sm transition-colors"
              >
                Just leave the call
              </button>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
