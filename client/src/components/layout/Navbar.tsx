import React, { useState, useEffect } from 'react';
import { History, Shield, LogOut, HelpCircle, Settings, Zap, Key, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';
import { useTheme } from '../../context/ThemeContext.js';

interface NavbarProps {
  currentView: 'home' | 'history' | 'admin';
  onNavigate: (view: 'home' | 'history' | 'admin') => void;
  onOpenAuthModal?: () => void;
  onOpenProfileModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenAuthModal, onOpenProfileModal }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      setDate(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-slate-200/80 dark:border-[#23252a] bg-white/80 dark:bg-[#0c0d12]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 select-none transition-colors duration-200">
      {/* Brand */}
      <div className="flex items-center space-x-4 sm:space-x-6">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center space-x-2.5 group focus:outline-none"
        >
          {/* TutorPlug Electric Icon */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 text-black fill-current stroke-1" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
            Tutor<span className="text-orange-500 font-extrabold">Plug</span>
            <span className="ml-2 px-1.5 py-0.5 text-[9px] font-black bg-orange-500/10 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded-full border border-orange-500/30">
              PERMANENT ROOMS
            </span>
          </span>
        </button>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1 ml-4">
          <button
            onClick={() => onNavigate('home')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${
              currentView === 'home'
                ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/5'
            }`}
          >
            My Tutoring Space
          </button>
          <button
            onClick={() => onNavigate('history')}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium flex items-center space-x-1.5 transition-colors ${
              currentView === 'history'
                ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Class Recordings</span>
          </button>
          {user?.role === 'admin' && (
            <button
              onClick={() => onNavigate('admin')}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium flex items-center space-x-1.5 transition-colors ${
                currentView === 'admin'
                  ? 'bg-amber-500 text-black font-semibold'
                  : 'text-amber-500 hover:text-amber-400 hover:bg-amber-500/10'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Admin Portal</span>
            </button>
          )}
        </nav>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Clock */}
        <div className="hidden lg:flex items-center space-x-1 text-xs text-slate-500 dark:text-gray-400 font-medium">
          <span>{time}</span>
          <span className="mx-1">•</span>
          <span>{date}</span>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10 border border-slate-200 dark:border-[#3c4043] transition-colors"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        <div className="flex items-center space-x-1 text-slate-500 dark:text-gray-400">
          <button
            onClick={() => onNavigate('admin')}
            title="Admin Portal (Executive Authorization)"
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              currentView === 'admin'
                ? 'bg-amber-500 text-black shadow'
                : 'hover:bg-amber-500/10 hover:text-amber-500'
            }`}
            aria-label="Admin Portal"
          >
            <Shield className="w-4 h-4" />
          </button>
          <button
            title="Help & Guidelines"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            title="Settings"
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* User / Gmail Login */}
        {user ? (
          <div className="flex items-center space-x-3 pl-2 border-l border-slate-200 dark:border-[#3c4043]">
            <button
              onClick={onOpenProfileModal}
              title="View & Edit Profile"
              className="text-right hidden sm:block hover:opacity-80 transition-opacity text-left cursor-pointer"
            >
              <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-end space-x-1.5">
                <span>{user.name}</span>
                {user.role === 'admin' ? (
                  <span className="text-[9px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.2 rounded font-black tracking-wide">
                    ADMIN
                  </span>
                ) : user.userType === 'student' ? (
                  <span className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/40 px-1.5 py-0.2 rounded font-bold">
                    STUDENT {user.rollNumber ? `• ${user.rollNumber}` : ''}
                  </span>
                ) : (
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded font-bold">
                    TEACHER
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-gray-400 font-mono">
                {user.personalMeetingCode ? `Room: ${user.personalMeetingCode}` : user.email}
              </div>
            </button>

            <button
              onClick={onOpenProfileModal}
              title={`${user.name} (Click to edit profile)`}
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-extrabold flex items-center justify-center text-sm shadow ring-2 ring-orange-400/40 overflow-hidden cursor-pointer hover:ring-amber-300 transition-all"
            >
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <span>{user.name.charAt(0).toUpperCase()}</span>
              )}
            </button>

            <button
              onClick={logout}
              title="Sign Out"
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenAuthModal}
              className="py-1.5 px-3.5 rounded-full bg-white dark:bg-white/10 hover:bg-slate-100 dark:hover:bg-white/20 text-slate-800 dark:text-white font-medium text-xs flex items-center space-x-2 border border-slate-300 dark:border-white/10 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Gmail Login</span>
            </button>
            <button
              onClick={onOpenAuthModal}
              className="py-1.5 px-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md shadow-orange-500/20"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
