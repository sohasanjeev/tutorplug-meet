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

import { useAuth } from './context/AuthContext.js';
import { UserProfileModal } from './components/meeting/UserProfileModal.js';
import { Shield } from 'lucide-react';
import { api } from './services/api.js';

const AdminSecurityGate: React.FC<{ onBackToHome: () => void }> = ({ onBackToHome }) => {
  const { user, login, logout } = useAuth();
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      await login(adminEmail.trim(), adminPassword);
    } catch (err: any) {
      setError(err.message || 'Administrative login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#18191d] border border-slate-200 dark:border-[#3c4043] rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 mx-auto flex items-center justify-center shadow-lg">
          <Shield className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Admin Authorization Required
          </h2>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            This management console is strictly restricted to Sanjeev and the TutorPlug executive administration team.
          </p>
        </div>

        {user && user.role !== 'admin' && !['admin@tutorplug.com', 'sanjeev@tutorplug.com', 'sanjeevgupta052020@gmail.com'].includes((user.email || '').toLowerCase()) && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-500 text-xs text-left space-y-2">
            <div>
              ⚠️ You are currently signed in as <strong>{user.email}</strong>, which does not have executive administrator privileges.
            </div>
            <button
              onClick={logout}
              className="text-xs font-bold text-amber-400 underline hover:text-amber-300 block"
            >
              Sign out and sign in with Admin Account →
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-500 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
              Admin Email
            </label>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="sanjeev@tutorplug.com"
              className="w-full bg-slate-50 dark:bg-[#202124] border border-slate-300 dark:border-[#3c4043] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
              Admin Password
            </label>
            <input
              type="password"
              required
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 dark:bg-[#202124] border border-slate-300 dark:border-[#3c4043] rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm transition-all shadow-lg shadow-red-500/20 cursor-pointer"
          >
            {isLoading ? 'Verifying Credentials...' : 'Unlock Admin Portal'}
          </button>
        </form>

        <button
          onClick={onBackToHome}
          className="text-xs text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          ← Return to TutorPlug Home
        </button>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { isInMeeting } = useMeeting();
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<'home' | 'lobby' | 'meeting' | 'history' | 'admin'>('home');
  const [activeCode, setActiveCode] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Automatically log platform visit for executive admin tracking
  useEffect(() => {
    api.logVisit({
      userId: user?.id,
      userName: user?.name,
      userEmail: user?.email,
      path: window.location.pathname + window.location.hash,
      action: 'visit',
    });
  }, [user]);

  // Handle URL hash and pathname changes for robust deep linking across /admin, /history, and meeting rooms
  useEffect(() => {
    const handleNavigationCheck = () => {
      const hash = (window.location.hash || '').toLowerCase();
      const path = (window.location.pathname || '').toLowerCase();

      // Admin routes: #/admin, #admin, /admin, /admin/
      if (
        hash.startsWith('#/admin') ||
        hash === '#admin' ||
        path.startsWith('/admin')
      ) {
        setCurrentView('admin');
        return;
      }

      // History / Recordings routes: #/history, #history, /history, /history/
      if (
        hash.startsWith('#/history') ||
        hash === '#history' ||
        path.startsWith('/history')
      ) {
        setCurrentView('history');
        return;
      }

      // Meeting deep links: #/meeting/code or /meeting/code
      if (hash.startsWith('#/meeting/') || path.startsWith('/meeting/')) {
        const rawCode = (hash.replace('#/meeting/', '') || path.replace('/meeting/', '')).split('?')[0].split('/')[0];
        if (rawCode) {
          setActiveCode(rawCode);
          if (!isInMeeting) {
            setCurrentView('lobby');
          } else {
            setCurrentView('meeting');
          }
          return;
        }
      }

      if (hash.startsWith('#/join/') || path.startsWith('/join/')) {
        const rawCode = (hash.replace('#/join/', '') || path.replace('/join/', '')).split('?')[0].split('/')[0];
        if (rawCode) {
          setActiveCode(rawCode);
          setCurrentView('lobby');
          return;
        }
      }

      if (!isInMeeting) {
        setCurrentView('home');
      }
    };

    handleNavigationCheck();
    window.addEventListener('hashchange', handleNavigationCheck);
    window.addEventListener('popstate', handleNavigationCheck);
    return () => {
      window.removeEventListener('hashchange', handleNavigationCheck);
      window.removeEventListener('popstate', handleNavigationCheck);
    };
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
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
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
          (user?.role === 'admin' || (user?.email && ['admin@tutorplug.com', 'sanjeev@tutorplug.com', 'sanjeevgupta052020@gmail.com'].includes(user.email.toLowerCase()))) ? (
            <AdminDashboard onBackToHome={() => handleNavigate('home')} />
          ) : (
            <AdminSecurityGate onBackToHome={() => handleNavigate('home')} />
          )
        )}
      </main>

      {/* Gmail / Google / User Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {/* Standalone Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={user}
        isSelf={true}
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
