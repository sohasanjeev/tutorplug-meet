// TutorPlug Real-Time Meeting Composite Recording Streamer
// Captures composite video (camera / screen share / branded avatar card) + mixed audio
// and streams real WebM chunks over Socket.io every 1000ms to the server.

import type { Socket } from 'socket.io-client';

export class RecordingStreamer {
  private socket: Socket;
  private mediaRecorder: MediaRecorder | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private animFrameId: number | null = null;
  private audioContext: AudioContext | null = null;
  private audioDestination: MediaStreamAudioDestinationNode | null = null;
  private isRunning = false;

  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private tutorName: string = 'Tutor';
  private meetingTitle: string = 'TutorPlug Class';

  // Video elements to draw video frames onto canvas
  private localVideoEl: HTMLVideoElement;
  private screenVideoEl: HTMLVideoElement;

  constructor(socket: Socket) {
    this.socket = socket;

    // Create offscreen canvas for composite rendering (1280x720 HD)
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1280;
    this.canvas.height = 720;
    this.ctx = this.canvas.getContext('2d');

    this.localVideoEl = document.createElement('video');
    this.localVideoEl.muted = true;
    this.localVideoEl.playsInline = true;
    this.localVideoEl.autoplay = true;

    this.screenVideoEl = document.createElement('video');
    this.screenVideoEl.muted = true;
    this.screenVideoEl.playsInline = true;
    this.screenVideoEl.autoplay = true;
  }

  public updateMedia(params: {
    localStream?: MediaStream | null;
    screenStream?: MediaStream | null;
    remoteStreams?: Map<string, MediaStream>;
    tutorName?: string;
    meetingTitle?: string;
  }) {
    if (params.localStream !== undefined) {
      this.localStream = params.localStream;
      if (params.localStream && params.localStream.getVideoTracks().length > 0) {
        this.localVideoEl.srcObject = params.localStream;
        this.localVideoEl.play().catch(() => {});
      }
      this.reconnectAudio();
    }

    if (params.screenStream !== undefined) {
      this.screenStream = params.screenStream;
      if (params.screenStream && params.screenStream.getVideoTracks().length > 0) {
        this.screenVideoEl.srcObject = params.screenStream;
        this.screenVideoEl.play().catch(() => {});
      }
    }

    if (params.remoteStreams !== undefined) {
      this.remoteStreams = params.remoteStreams;
      this.reconnectAudio();
    }

    if (params.tutorName) this.tutorName = params.tutorName;
    if (params.meetingTitle) this.meetingTitle = params.meetingTitle;
  }

  private reconnectAudio() {
    try {
      if (!this.audioContext) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        this.audioDestination = this.audioContext.createMediaStreamDestination();
      }

      // Add local audio
      if (this.localStream && this.localStream.getAudioTracks().length > 0) {
        const audioTrack = this.localStream.getAudioTracks()[0];
        if (audioTrack && audioTrack.enabled) {
          const micStream = new MediaStream([audioTrack]);
          const source = this.audioContext.createMediaStreamSource(micStream);
          source.connect(this.audioDestination!);
        }
      }

      // Add remote audio
      this.remoteStreams.forEach((stream) => {
        if (stream.getAudioTracks().length > 0) {
          const remoteAudio = stream.getAudioTracks()[0];
          if (remoteAudio && remoteAudio.enabled) {
            const rStream = new MediaStream([remoteAudio]);
            const rSource = this.audioContext!.createMediaStreamSource(rStream);
            rSource.connect(this.audioDestination!);
          }
        }
      });
    } catch (e) {
      console.warn('[RecordingStreamer] Audio mixing note:', e);
    }
  }

  public start() {
    if (this.isRunning) return;
    this.isRunning = true;

    // Start render loop
    this.startCanvasRenderLoop();

    // Capture canvas video stream
    const canvasStream = (this.canvas as any).captureStream ? this.canvas.captureStream(25) : null;
    if (!canvasStream) {
      console.warn('[RecordingStreamer] captureStream not supported in this browser');
      return;
    }

    // Combine video with mixed audio
    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach((vt: MediaStreamTrack) => combinedStream.addTrack(vt));

    if (this.audioDestination && this.audioDestination.stream.getAudioTracks().length > 0) {
      this.audioDestination.stream.getAudioTracks().forEach((at: MediaStreamTrack) => combinedStream.addTrack(at));
    } else if (this.localStream && this.localStream.getAudioTracks().length > 0) {
      combinedStream.addTrack(this.localStream.getAudioTracks()[0]);
    }

    // Determine supported mimeType
    const mimeTypes = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];
    let selectedMime = '';
    for (const m of mimeTypes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
        selectedMime = m;
        break;
      }
    }

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMime || undefined,
        videoBitsPerSecond: 1500000,
      });

      this.mediaRecorder.ondataavailable = async (event: BlobEvent) => {
        if (event.data && event.data.size > 0 && this.socket && this.socket.connected) {
          try {
            const buffer = await event.data.arrayBuffer();
            this.socket.emit('recording-chunk', buffer);
          } catch (err) {
            console.error('[RecordingStreamer] Error transmitting chunk:', err);
          }
        }
      };

      this.mediaRecorder.start(1000); // 1-second chunks
      console.log(`[RecordingStreamer] 🎥 Live session recording active (${selectedMime || 'default'})`);
    } catch (err) {
      console.error('[RecordingStreamer] Failed to initialize MediaRecorder:', err);
    }
  }

  private startCanvasRenderLoop() {
    let tick = 0;

    const render = () => {
      if (!this.isRunning || !this.ctx) return;
      tick++;

      const w = this.canvas.width;
      const h = this.canvas.height;

      // 1. Check if screen share is active
      const hasScreen = Boolean(this.screenStream && this.screenStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'));
      const hasCamera = Boolean(this.localStream && this.localStream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live'));

      if (hasScreen && this.screenVideoEl.videoWidth > 0) {
        // Render screen share with preserved aspect ratio
        this.ctx.fillStyle = '#0a0b0e';
        this.ctx.fillRect(0, 0, w, h);

        const sw = this.screenVideoEl.videoWidth || w;
        const sh = this.screenVideoEl.videoHeight || h;
        const scale = Math.min(w / sw, h / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = (w - dw) / 2;
        const dy = (h - dh) / 2;

        try {
          this.ctx.drawImage(this.screenVideoEl, dx, dy, dw, dh);
        } catch (e) {}

        // Small PiP camera in bottom right if camera active
        if (hasCamera && this.localVideoEl.videoWidth > 0) {
          const pipW = 260;
          const pipH = 150;
          const pipX = w - pipW - 24;
          const pipY = h - pipH - 24;
          this.ctx.save();
          this.ctx.fillStyle = '#000';
          this.ctx.strokeStyle = '#f97316';
          this.ctx.lineWidth = 3;
          this.ctx.strokeRect(pipX, pipY, pipW, pipH);
          this.ctx.fillRect(pipX, pipY, pipW, pipH);
          try {
            this.ctx.drawImage(this.localVideoEl, pipX, pipY, pipW, pipH);
          } catch (e) {}
          this.ctx.restore();
        }
      } else if (hasCamera && this.localVideoEl.videoWidth > 0) {
        // Render full camera video
        this.ctx.fillStyle = '#0a0b0e';
        this.ctx.fillRect(0, 0, w, h);
        try {
          this.ctx.drawImage(this.localVideoEl, 0, 0, w, h);
        } catch (e) {}
      } else {
        // When camera is off: Render clean branded TutorPlug class card (NEVER black/dark!)
        // Background gradient
        const bgGrad = this.ctx.createLinearGradient(0, 0, w, h);
        bgGrad.addColorStop(0, '#0c0d12');
        bgGrad.addColorStop(0.5, '#12141c');
        bgGrad.addColorStop(1, '#08090c');
        this.ctx.fillStyle = bgGrad;
        this.ctx.fillRect(0, 0, w, h);

        // Top right ambient glow
        const glowGrad = this.ctx.createRadialGradient(w * 0.85, 0, 10, w * 0.85, 0, 450);
        glowGrad.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
        glowGrad.addColorStop(1, 'transparent');
        this.ctx.fillStyle = glowGrad;
        this.ctx.fillRect(0, 0, w, h);

        // Center Tutor Avatar Circle
        const cx = w / 2;
        const cy = h / 2 - 30;
        const radius = 64;

        // Glowing outer ring
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius + 8 + Math.sin(tick * 0.08) * 4, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(249, 115, 22, 0.4)';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Inner Avatar Circle
        const avGrad = this.ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
        avGrad.addColorStop(0, '#f97316');
        avGrad.addColorStop(1, '#ea580c');
        this.ctx.fillStyle = avGrad;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        this.ctx.fill();

        // Initial letter
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 54px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const initial = (this.tutorName || 'T').charAt(0).toUpperCase();
        this.ctx.fillText(initial, cx, cy);

        // Tutor Name & Meeting Title Text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 28px sans-serif';
        this.ctx.fillText(this.tutorName, cx, cy + radius + 40);

        this.ctx.fillStyle = '#94a3b8';
        this.ctx.font = '16px sans-serif';
        this.ctx.fillText(this.meetingTitle, cx, cy + radius + 70);

        // Simulated speaking sound wave bars below avatar
        const barCount = 18;
        const barWidth = 4;
        const spacing = 8;
        const startX = cx - ((barCount * (barWidth + spacing)) / 2);
        this.ctx.fillStyle = '#f97316';
        for (let i = 0; i < barCount; i++) {
          const barH = 10 + Math.abs(Math.sin((tick * 0.1) + i * 0.5)) * 26;
          this.ctx.fillRect(startX + i * (barWidth + spacing), cy + radius + 95 - barH / 2, barWidth, barH);
        }
      }

      // Watermark in top left
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.font = 'bold 15px sans-serif';
      this.ctx.textAlign = 'left';
      this.ctx.fillText('⚡ TutorPlug Class Recording', 28, 36);

      // Live recording timestamp in top right
      const nowStr = new Date().toLocaleTimeString();
      this.ctx.fillStyle = '#f97316';
      this.ctx.fillRect(w - 180, 22, 10, 10);
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      this.ctx.font = '13px monospace';
      this.ctx.fillText(`REC • ${nowStr}`, w - 162, 32);

      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {}
      this.mediaRecorder = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }

    console.log('[RecordingStreamer] ⏹ Session recording streamer stopped and flushed');
  }
}
