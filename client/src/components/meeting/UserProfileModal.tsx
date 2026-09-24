import React, { useState } from 'react';
import { X, User as UserIcon, BookOpen, GraduationCap, Shield, Hash, Camera, Save, Check } from 'lucide-react';
import type { Participant, User } from '../../types.js';
import { useAuth } from '../../context/AuthContext.js';
import { useMeeting } from '../../context/MeetingContext.js';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  participant?: Participant | null;
  currentUser?: User | null;
  isSelf?: boolean;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
];

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  participant,
  currentUser,
  isSelf = false,
}) => {
  const { user, updateProfile } = useAuth();
  const meetingContext = useMeeting();

  const activeParticipant = participant || meetingContext?.selfParticipant;
  const targetUser = currentUser || user;

  const [name, setName] = useState(activeParticipant?.displayName || targetUser?.name || '');
  const [avatar, setAvatar] = useState(activeParticipant?.avatar || targetUser?.avatar || '');
  const [bio, setBio] = useState(activeParticipant?.bio || targetUser?.bio || '');
  const [userType, setUserType] = useState<'teacher' | 'student' | 'admin'>(
    activeParticipant?.userType || targetUser?.userType || (activeParticipant?.role === 'host' ? 'teacher' : 'student')
  );
  const [rollNumber, setRollNumber] = useState(activeParticipant?.rollNumber || targetUser?.rollNumber || '');
  const [classGrade, setClassGrade] = useState(activeParticipant?.classGrade || targetUser?.classGrade || '');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  if (!isOpen) return null;

  // Handle local file image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      alert('Avatar image must be under 3MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setAvatar(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const updatedProfile = {
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        bio: bio.trim() || undefined,
        userType: userType === 'admin' ? undefined : userType,
        rollNumber: rollNumber.trim() || undefined,
        classGrade: classGrade.trim() || undefined,
      };

      // 1. If in a meeting room, broadcast to all participants in real time
      if (meetingContext?.updateInMeetingProfile) {
        meetingContext.updateInMeetingProfile({
          displayName: updatedProfile.name,
          avatar: updatedProfile.avatar,
          bio: updatedProfile.bio,
          userType: updatedProfile.userType as any,
          rollNumber: updatedProfile.rollNumber,
          classGrade: updatedProfile.classGrade,
        });
      }

      // 2. Persist to DB if logged in
      if (user) {
        await updateProfile(updatedProfile);
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const displayAvatar = isSelf ? avatar : (activeParticipant?.avatar || targetUser?.avatar);
  const displayName = isSelf ? name : (activeParticipant?.displayName || targetUser?.name || 'Participant');
  const displayBio = isSelf ? bio : (activeParticipant?.bio || targetUser?.bio);
  const displayRoll = isSelf ? rollNumber : (activeParticipant?.rollNumber || targetUser?.rollNumber);
  const displayClass = isSelf ? classGrade : (activeParticipant?.classGrade || targetUser?.classGrade);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#202124] border border-[#3c4043] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <UserIcon className="w-5 h-5 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {isSelf ? 'My Permanent Profile' : `${displayName}'s Profile`}
            </h2>
            <p className="text-xs text-gray-400">
              {isSelf ? 'Visible to participants when your camera is turned off.' : 'Participant details in this session.'}
            </p>
          </div>
        </div>

        {/* Avatar Display & Picker */}
        <div className="flex flex-col items-center justify-center space-y-3 pt-2">
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-400 p-1 shadow-xl ring-4 ring-white/10 overflow-hidden">
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-full h-full object-cover rounded-full bg-[#18191d]"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#202124] flex items-center justify-center text-3xl font-extrabold text-amber-400">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {isSelf && (
              <label
                htmlFor="avatar-upload"
                className="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity text-white text-xs font-semibold"
              >
                <Camera className="w-6 h-6 mb-1" />
                <span>Upload Photo</span>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Role Badge */}
          <div className="flex items-center space-x-2">
            {userType === 'admin' || targetUser?.role === 'admin' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-500/20 text-red-400 border border-red-500/40 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 mr-1" />
                ADMINISTRATOR
              </span>
            ) : userType === 'student' ? (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40 flex items-center space-x-1">
                <GraduationCap className="w-3.5 h-3.5 mr-1" />
                STUDENT
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                <BookOpen className="w-3.5 h-3.5 mr-1" />
                TEACHER / TUTOR
              </span>
            )}

            {displayRoll && (
              <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-white/10 text-gray-300 border border-white/10 flex items-center">
                <Hash className="w-3 h-3 mr-0.5 text-gray-400" />
                {displayRoll}
              </span>
            )}
          </div>

          {displayClass && (
            <p className="text-xs text-amber-300/90 font-medium">
              Class: {displayClass}
            </p>
          )}
        </div>

        {/* Preset Avatars for Self */}
        {isSelf && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Choose from photo presets:</span>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="text-amber-400 hover:text-amber-300 underline"
              >
                {showUrlInput ? 'Hide URL' : 'Use Image URL'}
              </button>
            </div>
            <div className="flex items-center justify-center space-x-2">
              {PRESET_AVATARS.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAvatar(url)}
                  className={`w-10 h-10 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 ${
                    avatar === url ? 'border-amber-400 scale-105' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Preset ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>

            {showUrlInput && (
              <div className="pt-2 animate-in fade-in">
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={avatarUrlInput}
                    onChange={(e) => setAvatarUrlInput(e.target.value)}
                    placeholder="https://example.com/my-photo.jpg"
                    className="flex-1 bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarUrlInput.trim()) {
                        setAvatar(avatarUrlInput.trim());
                        setAvatarUrlInput('');
                        setShowUrlInput(false);
                      }
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold"
                  >
                    Set
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit Form or View Details */}
        {isSelf ? (
          <form onSubmit={handleSave} className="space-y-4 pt-1 border-t border-[#3c4043]">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </div>

            {userType === 'student' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Student Roll Number</label>
                  <input
                    type="text"
                    value={rollNumber}
                    onChange={(e) => setRollNumber(e.target.value)}
                    placeholder="e.g. TP-STU-4821"
                    className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-2 text-xs text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Class / Grade</label>
                  <input
                    type="text"
                    value={classGrade}
                    onChange={(e) => setClassGrade(e.target.value)}
                    placeholder="e.g. Grade 10-A"
                    className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-2 text-xs text-white focus:border-blue-400 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 block mb-1">Bio / About Me</label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={userType === 'student' ? 'e.g. Preparing for CBSE Board exams & Physics enthusiast.' : 'e.g. High school mathematics instructor with 8 years of tutoring experience.'}
                className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-colors flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20"
            >
              {saveSuccess ? (
                <>
                  <Check className="w-4 h-4 text-black" />
                  <span>Profile Updated!</span>
                </>
              ) : isSaving ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Profile</span>
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4 pt-1 border-t border-[#3c4043]">
            <div className="bg-[#2d2e30] rounded-2xl p-4 space-y-2 border border-[#3c4043]">
              <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold block">
                About {displayName}
              </span>
              <p className="text-xs text-gray-200 leading-relaxed">
                {displayBio || 'No bio provided by this participant.'}
              </p>
            </div>

            {displayClass && (
              <div className="flex items-center justify-between text-xs px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                <span className="text-gray-400">Class / Grade:</span>
                <span className="font-semibold text-white">{displayClass}</span>
              </div>
            )}

            {displayRoll && (
              <div className="flex items-center justify-between text-xs px-3 py-2 bg-white/5 rounded-xl border border-white/5">
                <span className="text-gray-400">Student ID / Roll No:</span>
                <span className="font-mono font-semibold text-blue-300">{displayRoll}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
