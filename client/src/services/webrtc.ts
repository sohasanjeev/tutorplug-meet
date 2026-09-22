import { Socket } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

function createBlankTrack(kind: 'audio' | 'video'): MediaStreamTrack {
  if (kind === 'video') {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#18191d';
      ctx.fillRect(0, 0, 640, 360);
    }
    const stream = canvas.captureStream(5);
    const track = stream.getVideoTracks()[0];
    track.enabled = false;
    return track;
  } else {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    osc.connect(dst);
    osc.start();
    const track = dst.stream.getAudioTracks()[0];
    track.enabled = false;
    return track;
  }
}

export class WebRTCManager {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private remoteStreamsMap: Map<string, MediaStream> = new Map();
  private onRemoteStreamCallback: (socketId: string, stream: MediaStream) => void;
  private onRemoteStreamRemovedCallback: (socketId: string) => void;
  private audioAnalyser: AnalyserNode | null = null;
  private audioContext: AudioContext | null = null;
  private animFrameId: number | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(
    socket: Socket,
    onRemoteStream: (socketId: string, stream: MediaStream) => void,
    onRemoteStreamRemoved: (socketId: string) => void
  ) {
    this.socket = socket;
    this.onRemoteStreamCallback = onRemoteStream;
    this.onRemoteStreamRemovedCallback = onRemoteStreamRemoved;
  }

  setLocalStream(stream: MediaStream) {
    // Ensure stream has both audio and video tracks for transceiver pre-allocation
    if (stream.getAudioTracks().length === 0) {
      try { stream.addTrack(createBlankTrack('audio')); } catch {}
    }
    if (stream.getVideoTracks().length === 0) {
      try { stream.addTrack(createBlankTrack('video')); } catch {}
    }

    this.localStream = stream;
    this.setupAudioAnalysis(stream);
    this.setupContinuousRecordingIngest(stream);

    // Update existing peer connections with new tracks
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          try { pc.addTrack(track, stream); } catch {}
        }
      });
    });
  }

  /**
   * Set up audio frequency analysis to broadcast active speaker volume
   */
  private setupAudioAnalysis(stream: MediaStream) {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      if (this.audioContext) {
        this.audioContext.close();
      }

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass();
      const source = this.audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 64;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let lastLevel = 0;

      const checkVolume = () => {
        if (!this.audioAnalyser) return;
        this.audioAnalyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = Math.round(sum / bufferLength);

        // Send if significant change or loud voice
        if (Math.abs(average - lastLevel) > 5 || average > 20) {
          lastLevel = average;
          this.socket.emit('audio-level', { level: average });
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn('Audio analysis setup error:', err);
    }
  }

  /**
   * Continuous stream chunk recorder that transmits WebM packets to the backend recording engine
   */
  private setupContinuousRecordingIngest(stream: MediaStream) {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }

      // Check supported MIME types
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1200000,
        audioBitsPerSecond: 128000,
      });

      this.mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          const arrayBuffer = await e.data.arrayBuffer();
          this.socket.emit('recording-chunk', arrayBuffer);
        }
      };

      // Emit chunk every 2000ms for continuous streaming
      this.mediaRecorder.start(2000);
    } catch (err) {
      console.warn('Continuous recording ingest setup warning:', err);
    }
  }

  /**
   * Initiate peer connection as the caller
   */
  async createPeerConnection(remoteSocketId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peerConnections.has(remoteSocketId)) {
      return this.peerConnections.get(remoteSocketId)!;
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.peerConnections.set(remoteSocketId, pc);

    // Add local media tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        try { pc.addTrack(track, this.localStream!); } catch {}
      });
    }

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('signal', {
          to: remoteSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    // Remote Track handler
    pc.ontrack = (event) => {
      let remoteStream = this.remoteStreamsMap.get(remoteSocketId);
      if (!remoteStream) {
        remoteStream = (event.streams && event.streams[0]) ? event.streams[0] : new MediaStream();
        this.remoteStreamsMap.set(remoteSocketId, remoteStream);
      }
      if (event.track && !remoteStream.getTracks().includes(event.track)) {
        remoteStream.addTrack(event.track);
      }
      this.onRemoteStreamCallback(remoteSocketId, remoteStream);
    };

    // Peer connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(remoteSocketId);
      }
    };

    // If caller, create Offer
    if (isInitiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await pc.setLocalDescription(offer);
        this.socket.emit('signal', {
          to: remoteSocketId,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (err) {
        console.error('Error creating offer:', err);
      }
    }

    return pc;
  }

  /**
   * Drain any queued candidates once remote description is set
   */
  private async drainPendingCandidates(fromSocketId: string, pc: RTCPeerConnection) {
    const list = this.pendingCandidates.get(fromSocketId) || [];
    for (const cand of list) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
        console.warn('Error adding queued ICE candidate:', e);
      }
    }
    this.pendingCandidates.delete(fromSocketId);
  }

  /**
   * Handle incoming WebRTC signal (Offer, Answer, ICE Candidate)
   */
  async handleSignal(fromSocketId: string, signal: any) {
    let pc = this.peerConnections.get(fromSocketId);

    if (!pc) {
      pc = await this.createPeerConnection(fromSocketId, false);
    }

    try {
      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await this.drainPendingCandidates(fromSocketId, pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('signal', {
          to: fromSocketId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await this.drainPendingCandidates(fromSocketId, pc);
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else {
          // Queue candidate until remote description is set
          if (!this.pendingCandidates.has(fromSocketId)) {
            this.pendingCandidates.set(fromSocketId, []);
          }
          this.pendingCandidates.get(fromSocketId)!.push(signal.candidate);
        }
      }
    } catch (err) {
      console.error('Error handling WebRTC signal:', err);
    }
  }

  /**
   * Start screen sharing
   */
  async startScreenShare(): Promise<MediaStream> {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30, max: 60 },
        width: { ideal: 1920, max: 3840 },
        height: { ideal: 1080, max: 2160 },
      },
      audio: true,
    });

    this.screenStream = screenStream;
    const videoTrack = screenStream.getVideoTracks()[0];

    // Replace video track in all active peer connections
    this.peerConnections.forEach(async (pc, remoteSocketId) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack).catch(() => {});
      } else {
        pc.addTrack(videoTrack, screenStream);
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
          await pc.setLocalDescription(offer);
          this.socket.emit('signal', { to: remoteSocketId, signal: { type: 'offer', sdp: offer } });
        } catch {}
      }
    });

    return screenStream;
  }

  /**
   * Stop screen share and restore camera track
   */
  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => track.stop());
      this.screenStream = null;
    }

    if (this.localStream) {
      const cameraTrack = this.localStream.getVideoTracks()[0];
      if (cameraTrack) {
        this.peerConnections.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(cameraTrack).catch(() => {});
          }
        });
      }
    }
  }

  closePeer(socketId: string) {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }
    this.pendingCandidates.delete(socketId);
    this.remoteStreamsMap.delete(socketId);
    this.onRemoteStreamRemovedCallback(socketId);
  }

  destroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.audioContext) this.audioContext.close();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();
    this.pendingCandidates.clear();
    this.remoteStreamsMap.clear();
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
    }
  }
}
