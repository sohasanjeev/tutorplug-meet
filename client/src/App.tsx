import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext.js';
import { MeetingProvider, useMeeting } from './context/MeetingContext.js';
import { ThemeProvider } from './context/ThemeContext.js';
import { Navbar } from './components/layout/Navbar.js';
import { LandingPage } from './components/home/LandingPage.js';
import { PreJoinLobby } from './components/meeting/PreJoinLobby.js';
import { MeetingRoom } from './components/meeting/MeetingRoom.js';
import { MeetingHistory } from './components/history/MeetingHistory.js';
import { AdminDashboard } from './components/admin/AdminDashboard.js';
import { AuthModal } from './components/auth/AuthModal.js';

const AppContent: React.FC = () => {
  const { isInMeeting } = useMeeting();
  const [currentView, setCurrentView] = useState<'home' | 'lobby' | 'meeting' | 'history' | 'admin'>('home');
  const [activeCode, setActiveCode] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Handle URL hash changes for deep linking (e.g., direct join links: /#/meeting/tp-xxx-yyyy)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/meeting/')) {
        const code = hash.replace('#/meeting/', '').split('?')[0];
        if (code) {
          setActiveCode(code);
          if (!isInMeeting) {
            setCurrentView('lobby');
          } else {
            setCurrentView('meeting');
          }
        }
      } else if (hash.startsWith('#/join/')) {
        const code = hash.replace('#/join/', '').split('?')[0];
        if (code) {
          setActiveCode(code);
          setCurrentView('lobby');
        }
      } else if (hash === '#/history') {
        setCurrentView('history');
      } else if (hash === '#/admin') {
        setCurrentView('admin');
      } else {
        if (!isInMeeting) {
          setCurrentView('home');
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [isInMeeting]);

  const handleJoinRequested = (code: string, isHost = false) => {
    const clean = code.trim().toLowerCase();
    setActiveCode(clean);
    window.location.hash = isHost ? `#/meeting/${clean}?role=host` : `#/meeting/${clean}`;
    setCurrentView('lobby');
  };

  const handleNavigate = (view: 'home' | 'history' | 'admin') => {
    setCurrentView(view);
    if (view === 'home') window.location.hash = '#/';
    if (view === 'history') window.location.hash = '#/history';
    if (view === 'admin') window.location.hash = '#/admin';
  };

  // Strictly render MeetingRoom only when room-joined has populated the call state
  if (isInMeeting) {
    return <MeetingRoom />;
  }

  if ((currentView === 'lobby' || window.location.hash.startsWith('#/meeting/') || window.location.hash.startsWith('#/join/')) && activeCode) {
    return (
      <PreJoinLobby
        meetingCode={activeCode}
        onJoinComplete={() => {}}
        onBack={() => handleNavigate('home')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090a0f] text-slate-900 dark:text-white flex flex-col font-sans transition-colors duration-200">
      <Navbar
        currentView={currentView === 'lobby' ? 'home' : (currentView as 'home' | 'history' | 'admin')}
        onNavigate={handleNavigate}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <LandingPage
            onJoinMeeting={handleJoinRequested}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}
        {currentView === 'history' && (
          <MeetingHistory
            onBackToHome={() => handleNavigate('home')}
            onJoinMeeting={handleJoinRequested}
          />
        )}
        {currentView === 'admin' && (
          <AdminDashboard onBackToHome={() => handleNavigate('home')} />
        )}
      </main>

      {/* Gmail / Google / User Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MeetingProvider>
          <AppContent />
        </MeetingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
