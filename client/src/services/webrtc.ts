import { Socket } from 'socket.io-client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCManager {
  private socket: Socket;
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
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
    this.localStream = stream;
    this.setupAudioAnalysis(stream);
    this.setupContinuousRecordingIngest(stream);

    // Update existing peer connections with new tracks
    this.peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track?.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track);
        } else {
          pc.addTrack(track, stream);
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
        pc.addTrack(track, this.localStream!);
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
      if (event.streams && event.streams[0]) {
        this.onRemoteStreamCallback(remoteSocketId, event.streams[0]);
      }
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
        const offer = await pc.createOffer();
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
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('signal', {
          to: fromSocketId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
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
      video: true,
      audio: true,
    });

    this.screenStream = screenStream;
    const videoTrack = screenStream.getVideoTracks()[0];

    // Replace video track in all active peer connections
    this.peerConnections.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
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
            sender.replaceTrack(cameraTrack);
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
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
    }
  }
}
