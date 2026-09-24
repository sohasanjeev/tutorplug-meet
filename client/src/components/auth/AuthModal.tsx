import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, Zap, Sparkles, GraduationCap, BookOpen, Hash } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [userType, setUserType] = useState<'teacher' | 'student'>('teacher');
  const [rollNumber, setRollNumber] = useState('');
  const [classGrade, setClassGrade] = useState('');
  const [showGoogleInput, setShowGoogleInput] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const generateRollNumber = () => {
    const rand = Math.floor(1000 + Math.random() * 9000);
    setRollNumber(`TP-STU-${rand}`);
  };

  const handleGoogleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      setError('Please enter your Google / Gmail address');
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const studentRoll = userType === 'student' ? (rollNumber.trim() || `TP-STU-${Math.floor(1000 + Math.random() * 9000)}`) : undefined;
      await loginWithGoogle(
        googleEmail.trim(),
        googleName.trim() || undefined,
        undefined,
        undefined,
        userType,
        studentRoll,
        userType === 'student' ? classGrade.trim() || undefined : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google Sign-In failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      setError(null);
      if (mode === 'signup') {
        if (!name.trim()) {
          setError('Please enter your full name');
          return;
        }
        const studentRoll = userType === 'student' ? (rollNumber.trim() || `TP-STU-${Math.floor(1000 + Math.random() * 9000)}`) : undefined;
        await register(
          name.trim(),
          email.trim(),
          password,
          userType,
          studentRoll,
          userType === 'student' ? classGrade.trim() || undefined : undefined
        );
      } else {
        await login(email.trim(), password, userType);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#202124] border border-[#3c4043] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Zap className="w-6 h-6 text-black fill-current" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {mode === 'signin' ? 'Sign in to ' : 'Create your account on '}
            Tutor<span className="text-amber-400">Plug</span>
          </h2>
          <p className="text-xs text-gray-400">
            {mode === 'signin'
              ? 'Access your permanent tutoring room and continuous session recordings.'
              : 'Claim your permanent tutoring room link that never expires.'}
          </p>
        </div>

        {/* Role Selector: Teacher vs Student */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-300 block uppercase tracking-wider">
            I am joining as:
          </label>
          <div className="grid grid-cols-2 gap-2 bg-[#1b1c1e] p-1.5 rounded-2xl border border-[#3c4043]">
            <button
              type="button"
              onClick={() => setUserType('teacher')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                userType === 'teacher'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Teacher / Tutor</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setUserType('student');
                if (!rollNumber) generateRollNumber();
              }}
              className={`py-2 px-3 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold transition-all ${
                userType === 'student'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Student</span>
            </button>
          </div>
        </div>

        {/* Student Specific ID / Roll Number & Class Info */}
        {userType === 'student' && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl space-y-2.5 animate-in fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-blue-300 flex items-center space-x-1.5">
                <Hash className="w-3.5 h-3.5" />
                <span>Student Roll Number / User ID</span>
              </label>
              <button
                type="button"
                onClick={generateRollNumber}
                className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium cursor-pointer"
              >
                Auto Generate
              </button>
            </div>
            <input
              type="text"
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              placeholder="e.g. TP-STU-4821 or 2026-CS-042"
              className="w-full bg-[#202124] border border-blue-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
            />

            <div>
              <label className="text-[11px] text-gray-400 block mb-1">Class / Grade / Semester (Optional)</label>
              <input
                type="text"
                value={classGrade}
                onChange={(e) => setClassGrade(e.target.value)}
                placeholder="e.g. Grade 10-A or B.Tech CS Sem 3"
                className="w-full bg-[#202124] border border-[#3c4043] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-400 focus:outline-none"
              />
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs text-center animate-in fade-in">
            {error}
          </div>
        )}

        {/* 1. Google / Gmail Sign-In Section */}
        <div className="space-y-3">
          {!showGoogleInput ? (
            <button
              type="button"
              onClick={() => {
                setShowGoogleInput(true);
                setError(null);
              }}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-gray-100 text-gray-900 font-semibold text-sm transition-all flex items-center justify-center space-x-3 shadow-md"
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
              <span>Continue with Google as {userType === 'student' ? 'Student' : 'Teacher'}</span>
            </button>
          ) : (
            <form onSubmit={handleGoogleSubmit} className="bg-[#2d2e30] border border-[#3c4043] p-4 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-200">
                <div className="flex items-center space-x-2">
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
                  <span>Google Sign-In ({userType === 'student' ? 'Student' : 'Teacher'})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGoogleInput(false)}
                  className="text-gray-400 hover:text-white text-[11px]"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Your Gmail Address</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full bg-[#202124] border border-[#3c4043] rounded-xl px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-gray-400 block mb-1">Full Name (Optional)</label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  placeholder={userType === 'student' ? 'Alex Kumar' : 'Prof. John Doe'}
                  className="w-full bg-[#202124] border border-[#3c4043] rounded-xl px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Verifying Google Account...' : `Continue as ${userType === 'student' ? 'Student' : 'Teacher'}`}</span>
              </button>
            </form>
          )}
        </div>

        {/* Divider */}
        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#3c4043] w-full"></div>
          <span className="bg-[#202124] px-3 text-[11px] text-gray-400 uppercase tracking-wider shrink-0">
            or with email
          </span>
        </div>

        {/* 2. Standard Email Authentication Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="text-xs text-gray-400 block mb-1">Full Name</label>
              <div className="flex items-center bg-[#2d2e30] border border-[#3c4043] focus-within:border-amber-400 rounded-xl px-3 py-2 transition-colors">
                <UserIcon className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={userType === 'student' ? 'Alex Kumar' : 'Prof. Jane Doe'}
                  className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-400 block mb-1">Email Address</label>
            <div className="flex items-center bg-[#2d2e30] border border-[#3c4043] focus-within:border-amber-400 rounded-xl px-3 py-2 transition-colors">
              <Mail className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={userType === 'student' ? 'student@school.org' : 'teacher@school.org'}
                className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 block mb-1">Password</label>
            <div className="flex items-center bg-[#2d2e30] border border-[#3c4043] focus-within:border-amber-400 rounded-xl px-3 py-2 transition-colors">
              <Lock className="w-4 h-4 text-gray-400 mr-2 shrink-0" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-colors shadow-lg ${
              userType === 'student'
                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
                : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
            }`}
          >
            {isLoading
              ? 'Please wait...'
              : mode === 'signup'
              ? (userType === 'student' ? 'Create Student Account' : 'Create Teacher Account')
              : `Sign In as ${userType === 'student' ? 'Student' : 'Teacher'}`}
          </button>
        </form>

        {/* Mode Toggle Footer */}
        <div className="text-center pt-2 border-t border-[#3c4043]">
          {mode === 'signin' ? (
            <p className="text-xs text-gray-400">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 ml-1"
              >
                Create a tutor account
              </button>
            </p>
          ) : (
            <p className="text-xs text-gray-400">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2 ml-1"
              >
                Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
