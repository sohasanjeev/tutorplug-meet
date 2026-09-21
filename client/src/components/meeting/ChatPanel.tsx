import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Send,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Film,
  Download,
  CheckCheck,
} from 'lucide-react';
import { useMeeting } from '../../context/MeetingContext.js';
import { api } from '../../services/api.js';

export const ChatPanel: React.FC = () => {
  const { messages, selfParticipant, sendChatMessage, setActiveDrawer } = useMeeting();
  const [text, setText] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedImageModal, setSelectedImageModal] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, uploadProgress]);

  const handleSendText = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) return;

    sendChatMessage(text.trim());
    setText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so same file can be re-uploaded if desired
    e.target.value = '';

    // Validate size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert('File is too large. Maximum permitted file size is 50MB.');
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);

      const res = await api.uploadFile(
        file,
        selfParticipant?.userId || 'meeting',
        selfParticipant?.displayName || 'Participant',
        (percent) => {
          setUploadProgress(percent);
        }
      );

      // Send chat message with file payload
      sendChatMessage(undefined, {
        messageType: res.messageType,
        fileUrl: res.fileUrl,
        fileName: res.fileName,
        fileSize: res.fileSize,
        fileMimeType: res.fileMimeType,
      });
    } catch (err: any) {
      alert(`Upload error: ${err.message || 'Failed to upload file'}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (isoString: string) => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <aside className="w-full sm:w-96 h-full bg-[#202124] border-l border-[#3c4043] flex flex-col z-40 select-none shadow-2xl">
      {/* Header */}
      <div className="h-16 px-5 border-b border-[#3c4043] flex items-center justify-between shrink-0">
        <h3 className="text-base font-semibold text-white">In-call messages</h3>
        <button
          onClick={() => setActiveDrawer('none')}
          className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Notice Banner */}
      <div className="bg-[#2d2e30] px-4 py-2.5 text-xs text-gray-300 border-b border-[#3c4043] flex items-center justify-between">
        <span>Messages and shared files are preserved in the meeting recording history.</span>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6 space-y-2">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-500">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-gray-300">No messages yet</p>
            <p className="text-xs text-gray-500">
              Send messages, share images, videos, or documents with everyone in this call.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === selfParticipant?.userId;

            return (
              <div key={msg.id} className="flex flex-col space-y-1">
                <div className="flex items-baseline justify-between text-xs">
                  <span className={`font-semibold ${isSelf ? 'text-blue-400' : 'text-gray-300'}`}>
                    {msg.senderName} {isSelf && '(You)'}
                  </span>
                  <span className="text-[10px] text-gray-500">{formatTime(msg.createdAt)}</span>
                </div>

                {/* Text Message */}
                {msg.messageType === 'text' && (
                  <div className="bg-[#2d2e30] text-gray-100 px-3.5 py-2 rounded-2xl rounded-tl-sm text-sm break-words border border-white/5 shadow-sm leading-relaxed">
                    {msg.content}
                  </div>
                )}

                {/* Image Message */}
                {msg.messageType === 'image' && msg.fileUrl && (
                  <div className="rounded-xl overflow-hidden border border-[#3c4043] bg-black/40 group relative max-w-xs cursor-pointer">
                    <img
                      src={msg.fileUrl}
                      alt={msg.fileName || 'Shared image'}
                      className="max-h-56 w-full object-cover group-hover:opacity-90 transition-opacity"
                      onClick={() => setSelectedImageModal(msg.fileUrl!)}
                    />
                    <div className="p-2 flex items-center justify-between text-xs bg-[#202124]">
                      <div className="flex items-center space-x-1.5 truncate">
                        <ImageIcon className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate text-gray-300 text-[11px]">{msg.fileName}</span>
                      </div>
                      <a
                        href={msg.fileUrl}
                        download={msg.fileName}
                        className="text-gray-400 hover:text-white p-1"
                        title="Download image"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}

                {/* Video Message */}
                {msg.messageType === 'video' && msg.fileUrl && (
                  <div className="rounded-xl overflow-hidden border border-[#3c4043] bg-black max-w-xs">
                    <video
                      src={msg.fileUrl}
                      controls
                      playsInline
                      className="w-full max-h-56 bg-black"
                    />
                    <div className="p-2 flex items-center justify-between text-xs bg-[#202124]">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Film className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate text-gray-300 text-[11px]">{msg.fileName}</span>
                      </div>
                      <span className="text-[10px] text-gray-500">{formatFileSize(msg.fileSize)}</span>
                    </div>
                  </div>
                )}

                {/* Document / File Message */}
                {msg.messageType === 'file' && msg.fileUrl && (
                  <div className="bg-[#2d2e30] border border-[#3c4043] p-3 rounded-xl flex items-center justify-between max-w-xs shadow-sm">
                    <div className="flex items-center space-x-2.5 truncate">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-medium text-gray-200 truncate">{msg.fileName}</p>
                        <p className="text-[10px] text-gray-400">{formatFileSize(msg.fileSize)}</p>
                      </div>
                    </div>
                    <a
                      href={msg.fileUrl}
                      download={msg.fileName}
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-gray-200 flex items-center justify-center transition-colors shrink-0 ml-2"
                      title="Download file"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-1 text-[10px] text-gray-500 pt-0.5">
                  <CheckCheck className="w-3 h-3 text-blue-400" />
                  <span>Delivered</span>
                </div>
              </div>
            );
          })
        )}

        {/* Upload Progress Indicator */}
        {isUploading && uploadProgress !== null && (
          <div className="bg-[#2d2e30] border border-blue-500/40 p-3 rounded-xl animate-pulse">
            <div className="flex justify-between text-xs text-blue-300 font-medium mb-1.5">
              <span>Uploading attachment...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-150"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendText} className="p-3 bg-[#1e1f20] border-t border-[#3c4043] shrink-0">
        <div className="flex items-center bg-[#2d2e30] rounded-2xl px-3 py-1.5 border border-[#3c4043] focus-within:border-blue-500 transition-colors">
          {/* File Upload Attachment Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-gray-400 hover:text-blue-400 p-1.5 rounded-full hover:bg-white/5 transition-colors disabled:opacity-50"
            title="Attach image, video, PDF or document"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message to everyone..."
            className="flex-1 bg-transparent border-none outline-none px-2.5 py-1 text-sm text-gray-100 placeholder-gray-500"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || isUploading}
            className="text-gray-400 hover:text-blue-400 disabled:opacity-30 p-1.5 rounded-full transition-colors"
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Fullscreen Image Preview Lightbox */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh]">
            <img
              src={selectedImageModal}
              alt="Preview"
              className="max-h-[80vh] w-auto rounded-xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setSelectedImageModal(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
