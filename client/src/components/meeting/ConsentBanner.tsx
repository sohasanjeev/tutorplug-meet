import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConsentBannerProps {
  onDismiss: () => void;
}

export const ConsentBanner: React.FC<ConsentBannerProps> = ({ onDismiss }) => {
  return (
    <div className="bg-gradient-to-r from-blue-900/80 via-indigo-900/80 to-blue-900/80 border-b border-blue-500/30 px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm text-blue-100 z-40 shadow-md">
      <div className="flex items-center space-x-2.5 max-w-4xl mx-auto">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
        <div>
          <span className="font-semibold text-white mr-1.5">Recording Disclosure:</span>
          <span>This meeting is automatically recorded from start to finish and will be stored for future access and review.</span>
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="text-blue-300 hover:text-white p-1 rounded hover:bg-blue-800/50 transition-colors ml-2 shrink-0"
        title="Dismiss notice"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
