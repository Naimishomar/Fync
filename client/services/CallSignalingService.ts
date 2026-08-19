// Socket.io based WebRTC signaling.

import type { Socket } from 'socket.io-client';
import axios from '../context/axiosConfig';
import sharedSocket from '../utils/socket';

export interface CallUser {
  _id: string;
  name: string;
  username?: string;
  /** The user schema's field is `avatar`; there is no `profilePic`. */
  avatar?: string;
  college?: string;
  status: 'online' | 'busy';
}

export interface CallerInfo {
  _id: string;
  name: string;
  username?: string;
  avatar?: string;
  college?: string;
}

type Handler = (...args: any[]) => void;

class CallSignalingService {
  private socket: Socket | null = null;
  private userId: string | null = null;

  /**
   * Handlers are kept so they can be removed individually.
   *
   * `disconnect()` used to call `socket.off(event)` with no handler, which
   * removes EVERY listener for that event. The socket is shared app-wide, so
   * leaving the call lobby also tore out the presence and typing listeners that
   * ChatList and Chat had registered — online dots simply stopped updating
   * until the app restarted.
   */
  private handlers = new Map<string, Handler>();

  // Event callbacks
  onIncomingCall: ((data: { callerId: string; sdp: any; callerInfo: CallerInfo }) => void) | null = null;
  onCallAnswered: ((data: { sdp: any }) => void) | null = null;
  onIceCandidate: ((data: { candidate: any }) => void) | null = null;
  onCallEnded: ((data: { reason: string }) => void) | null = null;
  onCallRejected: (() => void) | null = null;
  onCallBusy: ((data?: { reason?: string }) => void) | null = null;
  onCallFailed: ((data: { reason: string }) => void) | null = null;
  /** Busy/free/offline transitions for the lobby list. */
  onCallStatus: ((data: { userId: string; status: 'online' | 'busy' | 'offline' }) => void) | null = null;
  /** Plain online/offline presence, for greying out a row. */
  onPresence: ((data: { userId: string; status: string }) => void) | null = null;

  connect(userId: string) {
    // Reuse the app-wide authenticated socket instead of opening a second
    // connection. The server rejects handshakes without a JWT, and signaling
    // needs the same `user:<id>` room presence the shared socket already has.
    if (this.socket) return;

    this.userId = userId;
    this.socket = sharedSocket;

    const on = (event: string, handler: Handler) => {
      this.handlers.set(event, handler);
      this.socket?.on(event, handler);
    };

    on('call:incoming', (data) => this.onIncomingCall?.(data));
    on('call:answered', (data) => this.onCallAnswered?.(data));
    on('call:ice-candidate', (data) => this.onIceCandidate?.(data));
    on('call:ended', (data) => this.onCallEnded?.(data));
    on('call:rejected', () => this.onCallRejected?.());
    on('call:busy', (data) => this.onCallBusy?.(data));
    on('call:failed', (data) => this.onCallFailed?.(data));

    // Distinct from `statusUpdate`. The lobby needs busy-vs-free, which the
    // presence system does not model; conflating them made a user who went
    // OFFLINE render as "In a call".
    on('call:status', (data) => this.onCallStatus?.(data));
    on('statusUpdate', (data) => this.onPresence?.(data));
  }

  disconnect() {
    if (!this.socket) return;
    for (const [event, handler] of this.handlers) {
      this.socket.off(event, handler);
    }
    this.handlers.clear();
    this.socket = null;
    this.userId = null;

    this.onIncomingCall = null;
    this.onCallAnswered = null;
    this.onIceCandidate = null;
    this.onCallEnded = null;
    this.onCallRejected = null;
    this.onCallBusy = null;
    this.onCallFailed = null;
    this.onCallStatus = null;
    this.onPresence = null;
  }

  // Call methods
  sendOffer(targetUserId: string, sdp: any, callerInfo?: Partial<CallerInfo>) {
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

  /** Online users with their real busy state, resolved server-side. */
  async getOnlineUsers(): Promise<CallUser[]> {
    try {
      const res = await axios.get('/user/online');
      return Array.isArray(res.data?.users) ? res.data.users : [];
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
