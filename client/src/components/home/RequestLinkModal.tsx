import React, { useState } from 'react';
import { X, PlusCircle, CheckCircle, ShieldAlert, BookOpen } from 'lucide-react';
import { api } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';

interface RequestLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSubmitted: () => void;
}

export const RequestLinkModal: React.FC<RequestLinkModalProps> = ({
  isOpen,
  onClose,
  onRequestSubmitted,
}) => {
  const { user } = useAuth();
  const [requestedTitle, setRequestedTitle] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedTitle.trim()) {
      setError('Please provide a title for the requested meeting link.');
      return;
    }

    if (!user) {
      setError('You must be signed in to request an additional meeting link.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await api.requestAdditionalLink({
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        requestedTitle: requestedTitle.trim(),
        reason: reason.trim(),
      });
      setIsSuccess(true);
      onRequestSubmitted();
      setTimeout(() => {
        setIsSuccess(false);
        setRequestedTitle('');
        setReason('');
        onClose();
      }, 2200);
    } catch (err: any) {
      setError(err.message || 'Failed to submit link request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 select-none">
      <div className="bg-[#202124] border border-[#3c4043] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-6">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Request Additional Meeting Link
            </h2>
            <p className="text-xs text-gray-400">
              Admin Authorization Required for Extra Meeting Rooms
            </p>
          </div>
        </div>

        {/* Policy notice */}
        <div className="bg-[#2d2e30] border border-[#3c4043] p-3.5 rounded-2xl flex items-start space-x-2.5 text-xs text-gray-300">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white mr-1">TutorPlug Policy:</span>
            <span>
              Each tutor receives 1 permanent room by default. If you need distinct links for separate classes, courses, or student cohorts, submit an authorization request below for admin approval.
            </span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
            {error}
          </div>
        )}

        {isSuccess ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
            <h3 className="text-lg font-semibold text-white">Request Submitted!</h3>
            <p className="text-xs text-gray-300">
              Your request has been placed in the Admin authorization queue. Once approved, the new link will appear on your dashboard.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Requested Room Name / Subject
              </label>
              <div className="flex items-center bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3 py-2">
                <BookOpen className="w-4 h-4 text-gray-400 mr-2" />
                <input
                  type="text"
                  required
                  value={requestedTitle}
                  onChange={(e) => setRequestedTitle(e.target.value)}
                  placeholder="e.g. AP Chemistry - Spring Batch"
                  className="w-full bg-transparent border-none outline-none text-sm text-white placeholder-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-300 block mb-1">
                Reason / Student Cohort
              </label>
              <textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why a distinct room is needed for this class..."
                className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 px-4 rounded-xl text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Authorization Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
