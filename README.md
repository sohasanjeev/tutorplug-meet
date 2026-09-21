# 🔌 TutorPlug — Real-Time Tutoring Video Conferencing Platform

TutorPlug is a high-performance, real-time video conferencing platform purpose-built for tutors, academies, and students. Inspired by Google Meet and designed with cutting-edge GCORE infrastructure aesthetics, TutorPlug provides seamless continuous recording, permanent meeting rooms, strict teacher-student privacy, and one-click Google/Gmail authentication.

---

## ⚡ Core Features

- **🔗 One Permanent Room Per Tutor**: Every tutor gets a persistent, reusable personal room link (e.g. `tp-yourname-1234`) that never expires.
- **🛡️ Admin Authorization for Extra Links**: Need separate rooms for different subjects? Submit a request to the admin panel with 1 click.
- **🎥 Automatic Continuous Recording**: Every session records from start to finish automatically.
  - **No Dark/Blank Recordings**: Features an intelligent canvas compositor and live audio equalizer ensuring dynamic visuals even when cameras are turned off.
  - Built-in video player with scrubbing and variable playback speed (`0.5x` - `2x`).
- **🔒 Privacy Isolation & Admin Oversight**: Teachers strictly see only their own classes and recordings (`WHERE host_id = ?`). The academy administrator has full 360° oversight across all sessions.
- **🎨 GCORE Radiant UI with Dark/Light Switch**: High-contrast dark mode and crisp light mode with instant navbar toggle and localStorage persistence.
- **📧 One-Click Google / Gmail Sign-in**: Fast, zero-hassle authentication for tutors and students.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons
- **Backend**: Node.js, Express, Socket.io, WebRTC (Mesh Signaling)
- **Database**: SQLite (Zero-configuration persistent SQL storage)
- **Recording Engine**: Client-side composite canvas streamer + Web Audio mixer + WebSocket chunk ingestion + server-side WebM indexing

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
# Install root, client, and server dependencies
npm install
npm --prefix client install
npm --prefix server install
```

### 2. Build and Start
```bash
# Build both frontend and backend
npm --prefix client run build
npm --prefix server run build

# Start the unified server on port 5000
npm --prefix server start
```

Open your browser to `http://localhost:5000`.

---

## ☁️ Deployment Guide

### Frontend on Vercel
1. Import this repository into your Vercel dashboard.
2. Vercel automatically reads `vercel.json` and builds `client/dist`.
3. Set environment variable `VITE_API_URL` to your backend URL.

### Backend on Render / Railway / Cloud VPS
Because TutorPlug utilizes persistent WebSockets for live video signaling and continuous recording streaming, the backend runs seamlessly on any persistent container host like [Render](https://render.com) or [Railway](https://railway.app).
- **Build Command**: `npm --prefix server install && npm --prefix server run build`
- **Start Command**: `npm --prefix server start`
- **Port**: `5000` (or `$PORT`)

---

## 🔑 Default Admin Credentials
- **Email**: `admin@tutorplug.com`
- **Password**: `Admin@123456`
