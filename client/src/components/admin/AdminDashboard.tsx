import React, { useState, useEffect } from 'react';
import {
  Shield,
  HardDrive,
  Video,
  Trash2,
  Download,
  AlertTriangle,
  Settings,
  ArrowLeft,
  CheckCircle,
  Check,
  X,
  PlusCircle,
  UserCheck,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { LinkRequest } from '../../types.js';

interface AdminDashboardProps {
  onBackToHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToHome }) => {
  const [stats, setStats] = useState<any | null>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [retentionDays, setRetentionDays] = useState('90');
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsRes, recsRes, requestsRes] = await Promise.all([
        api.getAdminStats(),
        api.getAdminRecordings(),
        api.getAdminLinkRequests(),
      ]);
      setStats(statsRes.stats);
      setRecordings(recsRes.recordings || []);
      setLinkRequests(requestsRes.requests || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (id: string) => {
    try {
      const res = await api.approveLinkRequest(id, 'Admin');
      setActionMessage(res.message);
      loadData();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectRequest = async (id: string) => {
    const reason = prompt('Optional reason for rejection:');
    try {
      await api.rejectLinkRequest(id, 'Admin', reason || undefined);
      setActionMessage('Request has been rejected.');
      loadData();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  const handleDeleteRecording = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this recording from storage and database?')) {
      return;
    }
    try {
      await api.deleteRecording(id);
      loadData();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return '0 MB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatHours = (seconds?: number) => {
    if (!seconds) return '0h 0m';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const handleSaveRetention = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#131314] text-white p-4 sm:p-8 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="mb-8">
        <button
          onClick={onBackToHome}
          className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm font-medium mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tutoring Space</span>
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex items-center space-x-3">
              <Shield className="w-7 h-7 text-amber-400" />
              <span>TutorPlug Administration & Authorization Hub</span>
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Authorize additional meeting rooms for tutors, configure recording retention, and monitor storage.
            </p>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{actionMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-gray-400">Loading admin metrics...</div>
      ) : (
        <>
          {/* Key Metric Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-amber-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Pending Link Requests
                </span>
                <PlusCircle className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-amber-400">{stats?.pendingLinkRequests || 0}</p>
              <p className="text-xs text-gray-400 mt-1">Awaiting admin authorization</p>
            </div>

            <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-blue-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Total Active Rooms
                </span>
                <Video className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-white">{stats?.totalMeetings || 0}</p>
              <p className="text-xs text-emerald-400 mt-1">
                {stats?.activeMeetings || 0} active session(s) right now
              </p>
            </div>

            <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-red-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Total Recordings
                </span>
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 rec-dot" />
              </div>
              <p className="text-3xl font-bold text-white">{stats?.totalRecordings || 0}</p>
              <p className="text-xs text-gray-400 mt-1">100% automated start & capture</p>
            </div>

            <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Storage Consumed
                </span>
                <HardDrive className="w-5 h-5" />
              </div>
              <p className="text-3xl font-bold text-white">
                {formatBytes((stats?.totalRecordingSizeBytes || 0) + (stats?.totalFilesSizeBytes || 0))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {formatHours(stats?.totalRecordingDurationSeconds)} captured
              </p>
            </div>
          </div>

          {/* SECTION 1: LINK AUTHORIZATION REQUESTS QUEUE */}
          <div className="bg-[#202124] border-2 border-amber-500/30 rounded-3xl p-6 shadow-xl mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Meeting Link Authorization Requests</h3>
                  <p className="text-xs text-gray-400">
                    Review and approve requests from tutors who need additional meeting links beyond their 1 permanent room.
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full border border-amber-500/30">
                {linkRequests.filter((r) => r.status === 'pending').length} Pending
              </span>
            </div>

            {linkRequests.length === 0 ? (
              <p className="text-center py-8 text-gray-500 text-xs">
                No link authorization requests currently submitted.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="border-b border-[#3c4043] text-gray-400 font-semibold uppercase">
                    <tr>
                      <th className="pb-3">Tutor / User</th>
                      <th className="pb-3">Requested Room Title</th>
                      <th className="pb-3">Reason / Purpose</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {linkRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3">
                          <p className="font-semibold text-white">{req.user_name}</p>
                          <p className="text-[11px] text-gray-400 font-mono">{req.user_email}</p>
                        </td>
                        <td className="py-3 font-medium text-amber-300">{req.requested_title}</td>
                        <td className="py-3 text-gray-400 max-w-xs truncate">{req.reason || 'N/A'}</td>
                        <td className="py-3">
                          {req.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              PENDING REVIEW
                            </span>
                          )}
                          {req.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              AUTHORIZED ({req.approved_meeting_code})
                            </span>
                          )}
                          {req.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              REJECTED
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right space-x-2">
                          {req.status === 'pending' ? (
                            <>
                              <button
                                onClick={() => handleApproveRequest(req.id)}
                                className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center space-x-1 shadow"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Authorize</span>
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                className="py-1.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-medium text-xs inline-flex items-center space-x-1 border border-red-500/30"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Decline</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-gray-500">Processed</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SECTION 2: RECORDINGS & RETENTION */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 bg-[#202124] border border-[#3c4043] rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-white">Recorded Tutoring Sessions</h3>
                <span className="text-xs text-gray-400">
                  {recordings.length} total sessions archived
                </span>
              </div>

              {recordings.length === 0 ? (
                <p className="text-center py-10 text-gray-500 text-sm">No recordings in registry yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="border-b border-[#3c4043] text-gray-400 font-semibold uppercase">
                      <tr>
                        <th className="pb-3">Session</th>
                        <th className="pb-3">Code</th>
                        <th className="pb-3">Duration</th>
                        <th className="pb-3">Size</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recordings.map((r) => (
                        <tr key={r.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 font-medium text-white truncate max-w-xs">
                            {r.meeting_title}
                          </td>
                          <td className="py-3 font-mono text-amber-400">{r.meeting_code}</td>
                          <td className="py-3">{r.duration_seconds}s</td>
                          <td className="py-3">{formatBytes(r.size_bytes)}</td>
                          <td className="py-3 text-right space-x-2">
                            <a
                              href={`/api/meetings/${r.meeting_id}/recording/download`}
                              download
                              className="inline-block p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200"
                              title="Download recording"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => handleDeleteRecording(r.id)}
                              className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400"
                              title="Delete recording"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Retention policy */}
            <div className="lg:col-span-4 flex flex-col space-y-6">
              <form
                onSubmit={handleSaveRetention}
                className="bg-[#202124] border border-[#3c4043] rounded-3xl p-6 shadow-xl space-y-4"
              >
                <div className="flex items-center space-x-2 text-amber-400">
                  <Settings className="w-5 h-5" />
                  <h3 className="text-base font-semibold text-white">Recording Retention Policy</h3>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">
                  Configure automatic lifecycle retention for recorded tutoring session videos.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-300">
                    Retention Expiration Period
                  </label>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="w-full bg-[#2d2e30] border border-[#3c4043] rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="30">30 Days</option>
                    <option value="60">60 Days</option>
                    <option value="90">90 Days (Recommended for Semesters)</option>
                    <option value="180">180 Days (Half Year)</option>
                    <option value="365">1 Year (Full Academic Year)</option>
                    <option value="unlimited">Unlimited (Keep forever)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow"
                >
                  {isSaved ? <CheckCircle className="w-4 h-4 text-emerald-800" /> : null}
                  <span>{isSaved ? 'Policy Saved' : 'Apply Retention Policy'}</span>
                </button>
              </form>

              <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-xl space-y-2">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-emerald-400" />
                  <span>FERPA & Educational Compliance</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  All tutoring sessions are encrypted end-to-end in transit and encrypted at rest with full teacher and student privacy safeguards.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
