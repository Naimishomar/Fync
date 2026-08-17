// Socket.io based WebRTC signaling service
// Replaces Supabase Realtime for audio/video call signaling

import type { Socket } from 'socket.io-client';
import axios from '../context/axiosConfig';
import sharedSocket from '../utils/socket';

interface OnlineUser {
  _id: string;
  name: string;
  profilePic?: string;
  college?: string;
  status: 'online' | 'busy';
}

class CallSignalingService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  
  // Event callbacks
  onIncomingCall: ((data: { callerId: string; sdp: any; callerInfo: any }) => void) | null = null;
  onCallAnswered: ((data: { sdp: any }) => void) | null = null;
  onIceCandidate: ((data: { candidate: any }) => void) | null = null;
  onCallEnded: ((data: { reason: string }) => void) | null = null;
  onCallRejected: (() => void) | null = null;
  onCallBusy: (() => void) | null = null;
  onCallFailed: ((data: { reason: string }) => void) | null = null;
  onOnlineUsers: ((users: OnlineUser[]) => void) | null = null;
  onUserStatus: ((data: { userId: string; status: string }) => void) | null = null;

  connect(userId: string) {
    // Reuse the app-wide authenticated socket instead of opening a second
    // connection. The server rejects handshakes without a JWT, and signaling
    // needs the same `user:<id>` room presence the shared socket already has.
    if (this.socket) return;

    this.userId = userId;
    this.socket = sharedSocket;

    // Call signaling events
    this.socket.on('call:incoming', (data) => {
      console.log('📞 Incoming call from:', data.callerInfo?.name || data.callerId);
      this.onIncomingCall?.(data);
    });

    this.socket.on('call:answered', (data) => {
      console.log('📞 Call answered');
      this.onCallAnswered?.(data);
    });

    this.socket.on('call:ice-candidate', (data) => {
      this.onIceCandidate?.(data);
    });

    this.socket.on('call:ended', (data) => {
      console.log('📞 Call ended:', data.reason);
      this.onCallEnded?.(data);
    });

    this.socket.on('call:rejected', () => {
      console.log('📞 Call rejected');
      this.onCallRejected?.();
    });

    this.socket.on('call:busy', () => {
      console.log('📞 User is busy');
      this.onCallBusy?.();
    });

    this.socket.on('call:failed', (data) => {
      console.log('📞 Call failed:', data.reason);
      this.onCallFailed?.(data);
    });

    // Presence events
    this.socket.on('initialOnlineList', (users) => {
      this.onOnlineUsers?.(users);
    });

    this.socket.on('statusUpdate', (data) => {
      this.onUserStatus?.(data);
    });
  }

  disconnect() {
    if (!this.socket) return;
    // Detach this service's listeners only; the socket is shared app-wide and
    // logout is what actually tears it down.
    for (const event of [
      'call:incoming', 'call:answered', 'call:ice-candidate', 'call:ended',
      'call:rejected', 'call:busy', 'call:failed', 'initialOnlineList', 'statusUpdate',
    ]) {
      this.socket.off(event);
    }
    this.socket = null;
    this.userId = null;
  }

  // Call methods
  sendOffer(targetUserId: string, sdp: any, callerInfo: any) {
    this.socket?.emit('call:offer', { targetUserId, sdp, callerInfo });
  }

  sendAnswer(targetUserId: string, sdp: any) {
    this.socket?.emit('call:answer', { targetUserId, sdp });
  }

  sendIceCandidate(targetUserId: string, candidate: any) {
    this.socket?.emit('call:ice-candidate', { targetUserId, candidate });
  }

  endCall(targetUserId: string, reason = 'ended') {
    this.socket?.emit('call:end', { targetUserId, reason });
  }

  rejectCall(targetUserId: string) {
    this.socket?.emit('call:reject', { targetUserId });
  }

  sendBusy(targetUserId: string) {
    this.socket?.emit('call:busy', { targetUserId });
  }

  // Check if user is online via REST API
  async checkUserOnline(targetUserId: string): Promise<boolean> {
    try {
      const res = await axios.get(`/user/status/${targetUserId}`);
      return res.data?.online === true;
    } catch {
      return false;
    }
  }

  // Get online users list
  async getOnlineUsers(): Promise<string[]> {
    try {
      const res = await axios.get('/user/online');
      return res.data?.users || [];
    } catch {
      return [];
    }
  }

  isConnected(): boolean {
    return this.socket?.connected === true;
  }
}

export const callSignaling = new CallSignalingService();
export default callSignaling;