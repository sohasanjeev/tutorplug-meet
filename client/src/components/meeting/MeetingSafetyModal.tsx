import React, { useState, useEffect } from 'react';
import { Shield, Sparkles, Heart, CheckCircle, Video, MessageSquare, Lock } from 'lucide-react';

interface MeetingSafetyModalProps {
  onDismiss: () => void;
}

export const MeetingSafetyModal: React.FC<MeetingSafetyModalProps> = ({ onDismiss }) => {
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#18191d] border border-amber-500/30 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center relative overflow-hidden">
        {/* Top ambient glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b from-amber-500/20 to-orange-500/0 rounded-full blur-2xl pointer-events-none" />

        {/* Icon Header */}
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black mx-auto flex items-center justify-center shadow-lg shadow-orange-500/30 ring-4 ring-orange-500/20">
            <Shield className="w-8 h-8 fill-black/10 stroke-[2.2]" />
          </div>
          <div className="absolute -bottom-1 right-1/2 translate-x-7 bg-amber-400 text-black rounded-full p-1 shadow">
            <Heart className="w-3.5 h-3.5 fill-current" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
            Safe Learning & Quality Assurance
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>Welcome to TutorPlug Classroom!</span>
            <Sparkles className="w-5 h-5 text-amber-400" />
          </h2>
          <p className="text-xs text-gray-300">
            We are dedicated to providing a safe, joyful, and world-class educational space for both our wonderful tutors and students.
          </p>
        </div>

        {/* Policy Cards */}
        <div className="space-y-3 text-left">
          {/* 1. Full Recording Disclosure */}
          <div className="bg-[#202124] border border-[#3c4043] rounded-2xl p-3.5 flex items-start space-x-3 shadow-inner">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 mt-0.5">
              <Video className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <div className="font-bold text-white flex items-center space-x-1.5">
                <span>Complete Session & Chat Recording</span>
                <span className="text-[9px] bg-red-500/20 text-red-400 px-1.5 py-0.2 rounded font-bold">LIVE REC</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                For educational continuity, student protection, and quality review, this entire session — including video, audio, and all chat interactions — is securely recorded and archived for your revision.
              </p>
            </div>
          </div>

          {/* 2. Privacy & Safety Protection Rule */}
          <div className="bg-[#202124] border border-[#3c4043] rounded-2xl p-3.5 flex items-start space-x-3 shadow-inner">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-4 h-4" />
            </div>
            <div className="space-y-0.5 text-xs">
              <p className="font-bold text-white">Community Privacy & Safety Commitment</p>
              <p className="text-[11px] text-gray-300 leading-relaxed">
                To safeguard everyone&apos;s privacy, all interactions must remain on TutorPlug. Please do not share or ask for personal phone numbers, private social media, home addresses, or direct offline payments.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button & Auto-countdown */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onDismiss}
            className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-yellow-500 hover:from-orange-400 hover:to-amber-400 text-black font-extrabold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" />
            <span>I Agree & Start Class</span>
            <span className="text-xs bg-black/10 px-2 py-0.5 rounded-full font-mono font-bold">
              ({countdown}s)
            </span>
          </button>

          <p className="text-[10px] text-gray-400">
            Window will automatically close in <strong className="text-amber-400">{countdown} seconds</strong>. Happy learning! 📚✨
          </p>
        </div>
      </div>
    </div>
  );
};
