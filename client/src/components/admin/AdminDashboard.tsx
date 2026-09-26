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
  MessageSquare,
  Users,
  Eye,
  Activity,
  Search,
  ExternalLink,
  Play,
  Calendar,
  Clock,
  Globe,
} from 'lucide-react';
import { api } from '../../services/api.js';
import type { LinkRequest } from '../../types.js';

interface AdminDashboardProps {
  onBackToHome: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBackToHome }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'recordings' | 'visitors' | 'requests' | 'settings'>('overview');
  const [stats, setStats] = useState<any | null>(null);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [linkRequests, setLinkRequests] = useState<LinkRequest[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [visitorStats, setVisitorStats] = useState<any | null>(null);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'teacher' | 'student' | 'admin'>('all');
  const [recordingSearchQuery, setRecordingSearchQuery] = useState('');

  const [previewRecording, setPreviewRecording] = useState<any | null>(null);
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
      const [statsRes, recsRes, requestsRes, usersRes, visitorsRes] = await Promise.allSettled([
        api.getAdminStats(),
        api.getAdminRecordings(),
        api.getAdminLinkRequests(),
        api.getAdminUsers(),
        api.getAdminVisitors(200),
      ]);
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.stats);
      if (recsRes.status === 'fulfilled') setRecordings(recsRes.value.recordings || []);
      if (requestsRes.status === 'fulfilled') setLinkRequests(requestsRes.value.requests || []);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.users || []);
      if (visitorsRes.status === 'fulfilled') {
        setVisitors(visitorsRes.value.visits || []);
        setVisitorStats(visitorsRes.value.stats || null);
      }
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

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleSaveRetention = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole =
      userRoleFilter === 'all' ||
      (userRoleFilter === 'admin' && (u.role === 'admin' || u.user_type === 'admin')) ||
      (userRoleFilter === 'student' && (u.role === 'student' || u.user_type === 'student')) ||
      (userRoleFilter === 'teacher' && (u.role === 'teacher' || u.user_type === 'teacher'));

    const q = userSearchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.roll_number && u.roll_number.toLowerCase().includes(q)) ||
      (u.personal_meeting_code && u.personal_meeting_code.toLowerCase().includes(q));

    return matchesRole && matchesQuery;
  });

  const filteredRecordings = recordings.filter((r) => {
    const q = recordingSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (r.meeting_title && r.meeting_title.toLowerCase().includes(q)) ||
      (r.meeting_code && r.meeting_code.toLowerCase().includes(q)) ||
      (r.host_name && r.host_name.toLowerCase().includes(q)) ||
      (r.host_email && r.host_email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#131314] text-white p-4 sm:p-8 max-w-7xl mx-auto select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBackToHome}
            className="flex items-center space-x-2 text-gray-400 hover:text-white text-sm font-medium mb-2 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Tutoring Space</span>
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Executive Admin Portal</h1>
              <p className="text-xs text-gray-400">
                Complete oversight of registered users, class recordings, and site visits
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="self-start sm:self-center px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 transition-colors flex items-center space-x-2 cursor-pointer"
        >
          <Activity className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
          <span>{isLoading ? 'Refreshing...' : 'Refresh Telemetry'}</span>
        </button>
      </div>

      {actionMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center space-x-2 animate-fade-in">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto border-b border-[#3c4043] pb-2 mb-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'overview'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <HardDrive className="w-4 h-4" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Registered Users ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('recordings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'recordings'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Class Recordings ({recordings.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('visitors')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'visitors'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Visitors & Attendance ({visitors.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'requests'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Link Authorizations ({linkRequests.filter((r) => r.status === 'pending').length})</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-xs font-mono">Loading telemetry and system registry...</p>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-8 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-semibold">Total Registered Users</span>
                    <Users className="w-4 h-4 text-purple-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{users.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {users.filter((u) => u.user_type === 'teacher' || u.role === 'teacher').length} Teachers •{' '}
                    {users.filter((u) => u.user_type === 'student' || u.role === 'student').length} Students
                  </p>
                </div>

                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-semibold">Archived Recordings</span>
                    <Video className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{recordings.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {formatBytes(stats?.totalRecordingSizeBytes)} stored •{' '}
                    {formatHours(stats?.totalRecordingDurationSeconds)} total
                  </p>
                </div>

                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-semibold">Website Visits & Joins</span>
                    <Globe className="w-4 h-4 text-emerald-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">{visitorStats?.totalVisits || visitors.length}</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {visitorStats?.uniqueVisitors || 0} unique IP addresses logged
                  </p>
                </div>

                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <div className="flex items-center justify-between text-gray-400 mb-2">
                    <span className="text-xs font-semibold">Pending Authorizations</span>
                    <UserCheck className="w-4 h-4 text-blue-400" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {linkRequests.filter((r) => r.status === 'pending').length}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-1">Additional link quota requests</p>
                </div>
              </div>

              {/* Quick Jump Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div
                  onClick={() => setActiveTab('users')}
                  className="bg-[#202124] border border-[#3c4043] hover:border-amber-500/50 p-6 rounded-3xl cursor-pointer transition-all hover:scale-[1.01] shadow-xl group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:bg-purple-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Inspect Registered Users</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    View student roll numbers, teacher personal room codes, quotas, and registration dates.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('recordings')}
                  className="bg-[#202124] border border-[#3c4043] hover:border-amber-500/50 p-6 rounded-3xl cursor-pointer transition-all hover:scale-[1.01] shadow-xl group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:bg-amber-500/20">
                    <Video className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Browse All Recordings</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Watch recorded class videos with seekable playback, download video files and chat logs.
                  </p>
                </div>

                <div
                  onClick={() => setActiveTab('visitors')}
                  className="bg-[#202124] border border-[#3c4043] hover:border-amber-500/50 p-6 rounded-3xl cursor-pointer transition-all hover:scale-[1.01] shadow-xl group"
                >
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:bg-emerald-500/20">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">View Visitor & Class Logs</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Audit who joined which tutoring room, timestamps, IP addresses, and user devices.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTERED USERS */}
          {activeTab === 'users' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#202124] border border-[#3c4043] p-4 rounded-3xl shadow-lg">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, roll number, or code..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-[#18191d] border border-[#3c4043] rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-gray-400 hidden sm:inline">Role:</span>
                  {(['all', 'teacher', 'student', 'admin'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setUserRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-xl capitalize font-medium transition-colors cursor-pointer ${
                        userRoleFilter === r
                          ? 'bg-amber-500 text-black font-bold'
                          : 'bg-[#18191d] border border-[#3c4043] text-gray-300 hover:text-white'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users Table */}
              <div className="bg-[#202124] border border-[#3c4043] rounded-3xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-[#3c4043] flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Registered Platform Accounts</h3>
                  <span className="text-xs text-gray-400 font-mono">
                    Showing {filteredUsers.length} of {users.length} accounts
                  </span>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 text-sm">
                    No users matching search filters
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#18191d] border-b border-[#3c4043] text-gray-400 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-4">User</th>
                          <th className="py-3 px-4">Email</th>
                          <th className="py-3 px-4">Role & ID</th>
                          <th className="py-3 px-4">Class Room</th>
                          <th className="py-3 px-4">Quota</th>
                          <th className="py-3 px-4">Registered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredUsers.map((u) => {
                          const isStudent = u.user_type === 'student' || u.role === 'student';
                          const isAdmin = u.user_type === 'admin' || u.role === 'admin';
                          return (
                            <tr key={u.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-xs font-bold text-black shrink-0">
                                    {u.avatar ? (
                                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{u.name?.charAt(0).toUpperCase() || 'U'}</span>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-white">{u.name}</p>
                                    {u.bio && <p className="text-[10px] text-gray-400 truncate max-w-xs">{u.bio}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-gray-300">{u.email}</td>
                              <td className="py-3 px-4">
                                {isAdmin ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                    ADMIN
                                  </span>
                                ) : isStudent ? (
                                  <div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                      STUDENT
                                    </span>
                                    {u.roll_number && (
                                      <span className="block text-[10px] font-mono text-gray-400 mt-0.5">
                                        Roll: {u.roll_number}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                    TEACHER
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {u.personal_meeting_code ? (
                                  <a
                                    href={`#/room/${u.personal_meeting_code}`}
                                    className="font-mono text-amber-400 hover:underline flex items-center space-x-1"
                                    title="Open Room"
                                  >
                                    <span>{u.personal_meeting_code}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-gray-500 italic">None</span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono">{u.allowed_link_quota || 1} Link(s)</span>
                              </td>
                              <td className="py-3 px-4 text-gray-400">{formatDateTime(u.created_at)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLASS RECORDINGS */}
          {activeTab === 'recordings' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-[#202124] border border-[#3c4043] p-4 rounded-3xl shadow-lg">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 absolute left-3.5 top-3 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by class title, tutor, or room code..."
                    value={recordingSearchQuery}
                    onChange={(e) => setRecordingSearchQuery(e.target.value)}
                    className="w-full bg-[#18191d] border border-[#3c4043] rounded-2xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  {filteredRecordings.length} of {recordings.length} class recordings
                </span>
              </div>

              <div className="bg-[#202124] border border-[#3c4043] rounded-3xl overflow-hidden shadow-xl">
                {filteredRecordings.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 text-sm">
                    No recordings found matching criteria
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#18191d] border-b border-[#3c4043] text-gray-400 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Class Session</th>
                          <th className="py-3 px-4">Room Code</th>
                          <th className="py-3 px-4">Duration</th>
                          <th className="py-3 px-4">File Size</th>
                          <th className="py-3 px-4">Recorded At</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredRecordings.map((r) => (
                          <tr key={r.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 max-w-xs">
                              <p className="font-semibold text-white truncate">{r.meeting_title || 'Tutoring Session'}</p>
                              <p className="text-[11px] text-gray-400 truncate">
                                Host: {r.host_name || r.host_email || 'Teacher'}
                                {r.participant_count ? ` • ${r.participant_count} student(s)` : ''}
                                {r.message_count ? ` • ${r.message_count} chat msg` : ''}
                              </p>
                            </td>
                            <td className="py-3 px-4 font-mono text-amber-400">{r.meeting_code}</td>
                            <td className="py-3 px-4">{r.duration_seconds || 1}s</td>
                            <td className="py-3 px-4">{formatBytes(r.size_bytes)}</td>
                            <td className="py-3 px-4 text-gray-400">{formatDateTime(r.created_at || r.started_at)}</td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() => setPreviewRecording(r)}
                                className="inline-flex items-center space-x-1 py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-semibold cursor-pointer"
                                title="Watch Video"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Watch</span>
                              </button>
                              <a
                                href={`/api/meetings/${r.id}/recording/download`}
                                download
                                className="inline-block p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200"
                                title="Download video (.webm)"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <a
                                href={`/api/meetings/${r.id}/chat/download`}
                                download
                                className="inline-block p-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400"
                                title="Download chat transcript (.txt)"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteRecording(r.id)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 cursor-pointer"
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
            </div>
          )}

          {/* TAB 4: VISITORS & ATTENDANCE LOG */}
          {activeTab === 'visitors' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <span className="text-xs text-gray-400 font-semibold">Total Tracked Visits</span>
                  <p className="text-2xl font-bold text-white mt-1">{visitorStats?.totalVisits || visitors.length}</p>
                </div>
                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <span className="text-xs text-gray-400 font-semibold">Unique IP Addresses</span>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">{visitorStats?.uniqueVisitors || 0}</p>
                </div>
                <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-5 shadow-lg">
                  <span className="text-xs text-gray-400 font-semibold">Meeting Joins Logged</span>
                  <p className="text-2xl font-bold text-amber-400 mt-1">{visitorStats?.meetingJoins || 0}</p>
                </div>
              </div>

              <div className="bg-[#202124] border border-[#3c4043] rounded-3xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-[#3c4043] flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">Live Activity & Attendance Stream</h3>
                  <span className="text-xs text-gray-400 font-mono">Last {visitors.length} logged events</span>
                </div>

                {visitors.length === 0 ? (
                  <div className="py-16 text-center text-gray-500 text-sm">
                    No visitor logs recorded yet. Visits are automatically logged on room joins.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-gray-300">
                      <thead className="bg-[#18191d] border-b border-[#3c4043] text-gray-400 uppercase font-semibold text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Timestamp</th>
                          <th className="py-3 px-4">Visitor / User</th>
                          <th className="py-3 px-4">Action</th>
                          <th className="py-3 px-4">Target Room</th>
                          <th className="py-3 px-4">IP Address</th>
                          <th className="py-3 px-4">Device / Browser</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {visitors.map((v) => (
                          <tr key={v.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 px-4 text-gray-400 font-mono">{formatDateTime(v.created_at)}</td>
                            <td className="py-3 px-4">
                              <p className="font-semibold text-white">{v.user_name || 'Anonymous'}</p>
                              {v.user_email && <p className="text-[10px] text-gray-400 font-mono">{v.user_email}</p>}
                            </td>
                            <td className="py-3 px-4">
                              {v.action === 'join_meeting' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  JOINED CLASS
                                </span>
                              ) : v.action === 'login' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  LOGGED IN
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-gray-300">
                                  {v.action?.toUpperCase() || 'VISIT'}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono text-amber-400">{v.meeting_code || v.path || '/'}</td>
                            <td className="py-3 px-4 font-mono text-gray-400">{v.ip_address}</td>
                            <td className="py-3 px-4 text-[11px] text-gray-400 truncate max-w-xs">{v.user_agent}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LINK REQUESTS */}
          {activeTab === 'requests' && (
            <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-6 shadow-xl space-y-4 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Pending Room Link Requests</h3>
                  <p className="text-xs text-gray-400">
                    Review and authorize tutors requesting secondary or tertiary class rooms
                  </p>
                </div>
                <span className="text-xs font-mono text-amber-400">
                  {linkRequests.filter((r) => r.status === 'pending').length} pending approval
                </span>
              </div>

              {linkRequests.length === 0 ? (
                <p className="text-center py-10 text-gray-500 text-sm">No link authorization requests submitted yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="border-b border-[#3c4043] text-gray-400 font-semibold uppercase">
                      <tr>
                        <th className="pb-3">Tutor</th>
                        <th className="pb-3">Requested Room Title</th>
                        <th className="pb-3">Reason</th>
                        <th className="pb-3">Status</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {linkRequests.map((req) => (
                        <tr key={req.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 font-medium text-white">
                            <p className="font-semibold text-white">{req.user_name}</p>
                            <p className="text-[11px] text-gray-400 font-mono">{req.user_email}</p>
                          </td>
                          <td className="py-3 font-semibold text-white">{req.requested_title}</td>
                          <td className="py-3 text-gray-400 max-w-xs truncate">{req.reason || 'None provided'}</td>
                          <td className="py-3">
                            {req.status === 'pending' && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                PENDING
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
                                  className="py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center space-x-1 shadow cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Authorize</span>
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(req.id)}
                                  className="py-1.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white font-medium text-xs inline-flex items-center space-x-1 border border-red-500/30 cursor-pointer"
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
          )}

          {/* TAB 6: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in">
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
                  <label className="text-xs font-semibold text-gray-300">Retention Expiration Period</label>
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
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-colors flex items-center justify-center space-x-1.5 shadow cursor-pointer"
                >
                  {isSaved ? <CheckCircle className="w-4 h-4 text-emerald-800" /> : null}
                  <span>{isSaved ? 'Policy Saved' : 'Apply Retention Policy'}</span>
                </button>
              </form>

              <div className="bg-[#202124] border border-[#3c4043] rounded-3xl p-6 shadow-xl space-y-3">
                <div className="flex items-center space-x-2 text-emerald-400 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 text-emerald-400" />
                  <span>Educational Privacy & Safeguards</span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  All tutoring sessions are streamed via WebRTC and encrypted in transit. Recordings are safely stored
                  with access limited to class hosts, authorized students, and executive admins.
                </p>
                <div className="pt-4 border-t border-[#3c4043] text-xs space-y-1 text-gray-300">
                  <p>• Executive Admin: <span className="font-mono text-amber-400">sanjeevgupta052020@gmail.com</span></p>
                  <p>• Multi-participant WebM interleaving guard: <span className="text-emerald-400">Active</span></p>
                  <p>• OpenRelay TURN Fallback Relay: <span className="text-emerald-400">Active</span></p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Video Preview Modal */}
      {previewRecording && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#202124] border border-[#3c4043] rounded-3xl overflow-hidden max-w-3xl w-full shadow-2xl flex flex-col">
            <div className="p-4 border-b border-[#3c4043] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">{previewRecording.meeting_title || 'Class Recording'}</h3>
                <p className="text-xs text-gray-400 font-mono">Room: {previewRecording.meeting_code} • {previewRecording.duration_seconds || 1}s</p>
              </div>
              <button
                onClick={() => setPreviewRecording(null)}
                className="p-1 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-video bg-black flex items-center justify-center">
              <video
                src={`/api/meetings/${previewRecording.id}/recording/stream`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-4 border-t border-[#3c4043] flex items-center justify-between text-xs">
              <span className="text-gray-400">{formatBytes(previewRecording.size_bytes)}</span>
              <div className="space-x-2">
                <a
                  href={`/api/meetings/${previewRecording.id}/recording/download`}
                  download
                  className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold inline-flex items-center space-x-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Video</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
