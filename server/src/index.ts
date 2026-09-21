import http from 'http';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { CONFIG } from './config.js';
import { initDatabase } from './db/database.js';
import { setupSignaling } from './services/signaling.js';
import { authRouter } from './routes/auth.js';
import { meetingsRouter } from './routes/meetings.js';
import { uploadsRouter } from './routes/uploads.js';
import { adminRouter } from './routes/admin.js';

const app = express();
const server = http.createServer(app);

// Configure Socket.io with permissive CORS for real-time WebRTC signaling
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e8, // 100MB for continuous media streaming chunks
});

// Express middlewares
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Initialize DB schema & seeds
initDatabase();

// Setup real-time WebSockets & WebRTC signaling
setupSignaling(io);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'TutorPlug Video Conferencing & Automatic Continuous Recording Engine',
    uptimeSeconds: Math.round(process.uptime()),
  });
});

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/meetings', meetingsRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/admin', adminRouter);

// Serve built frontend static assets if available
const clientDistCandidates = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(__dirname, '../../client/dist'),
];

let clientDistPath: string | null = null;
for (const candidate of clientDistCandidates) {
  if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
    clientDistPath = candidate;
    break;
  }
}

if (clientDistPath) {
  console.log(`📦 Serving compiled TutorPlug client from: ${clientDistPath}`);
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath!, 'index.html'));
  });
}

// Start server
server.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TutorPlug Server listening on http://localhost:${CONFIG.PORT}`);
  console.log(`🎥 WebRTC Signaling & Automatic Continuous Recording Active`);
  console.log(`📁 Uploads Directory: ${CONFIG.UPLOADS_DIR}`);
  console.log(`⏺ Recordings Directory: ${CONFIG.RECORDINGS_DIR}`);
  console.log(`====================================================`);
});

export { app, server, io };
