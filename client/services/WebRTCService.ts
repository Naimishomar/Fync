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

  async setupLocalStream(): Promise<MediaStream> {
    try {
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.localStream = stream as MediaStream;
      return this.localStream;
    } catch (error) {
      console.error('Error accessing microphone:', error);
      throw error;
    }
  }

  async initializePeerConnection() {
    let iceServers = [...GOOGLE_STUN_SERVERS];

    try {
      // Fetch secure Cloudflare TURN credentials from our backend
      const response = await axios.post('/webrtc/turn-credentials');
      
      if (response.data?.success && response.data?.iceServers) {
        iceServers.push(response.data.iceServers); // Append Cloudflare TURN & STUN servers
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
    const offer = await this.peerConnection.createOffer({});
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
