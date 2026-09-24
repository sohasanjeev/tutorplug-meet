const BACKEND_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const API_BASE = `${BACKEND_URL}/api`;

export const api = {
  // --- Auth ---
  async login(email: string, password: string, userType?: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, userType }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Login failed');
    }
    return res.json();
  },

  async register(params: {
    name: string;
    email: string;
    password: string;
    userType?: 'teacher' | 'student';
    rollNumber?: string;
    classGrade?: string;
    bio?: string;
    avatar?: string;
  }) {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Registration failed');
    }
    return res.json();
  },

  async loginWithGoogle(email: string, name?: string, googleId?: string, avatar?: string, userType?: string, rollNumber?: string, classGrade?: string) {
    const res = await fetch(`${API_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, googleId, avatar, userType, rollNumber, classGrade }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Google Sign-In failed');
    }
    return res.json();
  },

  async updateProfile(token: string, profile: { name?: string; bio?: string; avatar?: string; rollNumber?: string; classGrade?: string; userType?: string }) {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(profile),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to update profile');
    }
    return data;
  },

  async guestLogin(displayName: string) {
    const res = await fetch(`${API_BASE}/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to initialize guest session');
    }
    return res.json();
  },

  async getMe(token: string) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  },

  // --- Meetings ---
  async createMeeting(params: { title?: string; scheduledStartTime?: string; hostId?: string }) {
    const res = await fetch(`${API_BASE}/meetings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create meeting');
    }
    return data;
  },

  async requestAdditionalLink(params: {
    userId: string;
    userName: string;
    userEmail: string;
    requestedTitle: string;
    reason?: string;
  }) {
    const res = await fetch(`${API_BASE}/meetings/request-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit link request');
    }
    return data;
  },

  async getUserLinks(userId: string) {
    const res = await fetch(`${API_BASE}/meetings/user/${userId}/links`);
    if (!res.ok) throw new Error('Failed to fetch user links');
    return res.json();
  },

  async getMeetingByCode(code: string, token?: string | null, userId?: string | null) {
    const cleanCode = code.trim().toLowerCase();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['x-user-id'] = userId;
    const res = await fetch(`${API_BASE}/meetings/code/${cleanCode}`, { headers });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Meeting not found');
    }
    return res.json();
  },

  async getMeetingHistory(userId?: string, token?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['x-user-id'] = userId;
    const url = userId ? `${API_BASE}/meetings/history/all?userId=${encodeURIComponent(userId)}` : `${API_BASE}/meetings/history/all`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch history');
    }
    return res.json();
  },

  async getMeetingDetail(id: string, token?: string, userId?: string) {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (userId) headers['x-user-id'] = userId;
    const res = await fetch(`${API_BASE}/meetings/detail/${id}`, { headers });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to fetch meeting detail');
    }
    return res.json();
  },

  getChatDownloadUrl(meetingId: string) {
    return `${API_BASE}/meetings/${meetingId}/chat/download`;
  },


  // --- Uploads ---
  uploadFile(
    file: File,
    meetingId: string,
    senderName: string,
    onProgress?: (percent: number) => void
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('meetingId', meetingId);
      formData.append('senderName', senderName);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && onProgress) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Invalid response from server'));
          }
        } else {
          reject(new Error('Upload failed'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));

      xhr.open('POST', `${API_BASE}/uploads/chat`);
      xhr.send(formData);
    });
  },

  // --- Admin ---
  async getAdminStats() {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/stats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch admin stats');
    return res.json();
  },

  async getAdminRecordings() {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/recordings`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch admin recordings');
    return res.json();
  },

  async getAdminLinkRequests() {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/link-requests`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fetch link requests');
    return res.json();
  },

  async approveLinkRequest(id: string, reviewerName?: string) {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/link-requests/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ reviewerName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to approve request');
    return data;
  },

  async rejectLinkRequest(id: string, reviewerName?: string, reason?: string) {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/link-requests/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ reviewerName, reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reject request');
    return data;
  },

  async deleteRecording(id: string) {
    const token = localStorage.getItem('tutorplug_token') || localStorage.getItem('aurameet_token');
    const res = await fetch(`${API_BASE}/admin/recordings/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete recording');
    return res.json();
  },
};
