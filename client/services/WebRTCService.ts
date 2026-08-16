import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import axios from '../context/axiosConfig';

const GOOGLE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

export class WebRTCManager {
  peerConnection: RTCPeerConnection | null = null;
  localStream: MediaStream | null = null;
  remoteStream: MediaStream | null = null;
  iceCandidateQueue: any[] = [];
  isRemoteDescriptionSet: boolean = false;

  onIceCandidate: ((candidate: RTCIceCandidate) => void) | null = null;
  onRemoteStream: ((stream: MediaStream) => void) | null = null;
  onConnectionStateChange: ((state: string) => void) | null = null;

  async setupLocalStream(options?: { video?: boolean; facingMode?: 'user' | 'environment' }): Promise<MediaStream> {
    try {
      const video = options?.video ?? false;
      const constraints: any = {
        audio: true,
        video: video
          ? { facingMode: options?.facingMode || 'user', width: 640, height: 480, frameRate: 30 }
          : false,
      };
      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream as MediaStream;
      return this.localStream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }

  async toggleCamera() {
    if (!this.localStream) return;
    const videoTrack = this.localStream.getVideoTracks()[0] as any;
    if (videoTrack && typeof videoTrack._switchCamera === 'function') {
      try {
        await videoTrack._switchCamera();
      } catch (e) {
        console.warn('Camera switch failed', e);
      }
    }
  }

  setVideoEnabled(enabled: boolean) {
    if (!this.localStream) return;
    this.localStream.getVideoTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  isVideoEnabled(): boolean {
    const track = this.localStream?.getVideoTracks()[0];
    return track ? track.enabled : false;
  }

  async initializePeerConnection() {
    let iceServers: any[] = [...GOOGLE_STUN_SERVERS];

    try {
      // Fetch secure Cloudflare TURN credentials from our backend
      const response = await axios.post('/webrtc/turn-credentials');

      if (response.data?.success && Array.isArray(response.data?.iceServers)) {
        iceServers = [...iceServers, ...response.data.iceServers];
      } else if (response.data?.iceServers) {
        iceServers = [...iceServers, response.data.iceServers];
      }
    } catch (error) {
      console.warn("Failed to fetch Cloudflare TURN credentials from backend. Falling back to Pure P2P STUN.", error);
    }

    this.peerConnection = new RTCPeerConnection({ iceServers });

    // Add local stream tracks to the connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream) {
          this.peerConnection?.addTrack(track, this.localStream);
        }
      });
    }

    // Handle ICE Candidates
    (this.peerConnection as any).onicecandidate = (event: any) => {
      if (event.candidate && this.onIceCandidate) {
        this.onIceCandidate(event.candidate);
      }
    };

    // Handle incoming remote stream
    (this.peerConnection as any).ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0] as MediaStream;
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      }
    };

    (this.peerConnection as any).onconnectionstatechange = () => {
      if (this.peerConnection && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.peerConnection.connectionState);
      }
    };
  }

  async setRemoteDescription(sdp: any) {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    this.isRemoteDescriptionSet = true;
    
    // Process queued candidates
    while (this.iceCandidateQueue.length > 0) {
      const candidate = this.iceCandidateQueue.shift();
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  async addIceCandidate(candidate: any) {
    if (this.peerConnection) {
      if (this.isRemoteDescriptionSet) {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        this.iceCandidateQueue.push(candidate);
      }
    }
  }

  async createOffer(): Promise<RTCSessionDescription | null> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.peerConnection.setLocalDescription(offer);
    return offer;
  }

  async createAnswer(): Promise<RTCSessionDescription | null> {
    if (!this.peerConnection) throw new Error("PeerConnection not initialized");
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    return answer;
  }


  
  toggleMute(isMuted: boolean) {
    if (this.localStream) {
        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
    }
  }

  cleanup() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }
    if (this.peerConnection) {
      this.peerConnection.close();
    }
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.iceCandidateQueue = [];
    this.isRemoteDescriptionSet = false;
  }
}

export const webRTCManager = new WebRTCManager();
