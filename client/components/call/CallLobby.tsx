import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Modal,
  StatusBar,
  ActivityIndicator,
  } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../context/auth.context';
import { webRTCManager } from '../../services/WebRTCService';
import { callSignaling, type CallUser, type CallerInfo } from '../../services/CallSignalingService';
import Avatar from '../Avatar';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, Meta, Label, Empty, ListRow, Sheet } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
/**
 * One lobby for both audio and video calling.
 *
 * These were two near-identical screens that had drifted apart: the audio one
 * signalled over the shared socket, the video one still went through Supabase
 * realtime. Only the media constraints and the active-call screen actually
 * differ, so they are parameters now.
 */

export type CallMode = 'audio' | 'video';

type Props = {
  mode: CallMode;
  navigation: any;
  /** Rendered once a call is up. Audio and video present very differently. */
  renderActiveCall: (props: {
    remoteUser: CallUser;
    isCallConnected: boolean;
    onEndCall: () => void;
  }) => React.ReactNode;
};

const RING_TIMEOUT_MS = 30000;

const CallUserRow = memo(function CallUserRow({
  item, isVideo, onCall,
}: { item: CallUser; isVideo: boolean; onCall: (u: CallUser) => void }) {
  const busy = item.status === 'busy';
  const status = busy ? 'In a call' : 'Available';
  return (
    <ListRow
      title={item.name}
      subtitle={item.college ? `${status} · ${item.college}` : status}
      leading={
        <View>
          <Avatar user={item as any} size={44} />
          <View className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-paper ${busy ? 'bg-brand-500' : 'bg-success'}`} />
        </View>
      }
      right={
        <Pressable
          onPress={() => onCall(item)}
          disabled={busy}
          className={`w-11 h-11 rounded-full items-center justify-center active:opacity-70 ${busy ? 'bg-paper-2' : 'bg-brand-500'}`}
          accessibilityRole="button"
          accessibilityLabel={`${busy ? 'Busy' : 'Call'} ${item.name}`}
          accessibilityState={{ disabled: busy }}
        >
          <Ionicons name={isVideo ? 'videocam' : 'call'} size={20} color={busy ? C.ink4 : C.onBrand} />
        </Pressable>
      }
    />
  );
});

export default function CallLobby({ mode, navigation, renderActiveCall }: Props) {
  const { user } = useAuth();
  const bottomInset = useBottomInset();

  const [onlineUsers, setOnlineUsers] = useState<CallUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketReady, setSocketReady] = useState(callSignaling.isConnected());

  const [incomingCall, setIncomingCall] = useState<
    { callerId: string; callerInfo: CallerInfo; sdp: any } | null
  >(null);
  const [activeCallUser, setActiveCallUser] = useState<CallUser | null>(null);
  const [isCallConnected, setIsCallConnected] = useState(false);
  const [isDialling, setIsDialling] = useState(false);

  // Callbacks fire from socket handlers that closed over the first render, so
  // anything they need to read lives in a ref.
  const activeCallUserRef = useRef<CallUser | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isVideo = mode === 'video';
  const label = isVideo ? 'Video' : 'Audio';

  const loadUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    const users = await callSignaling.getOnlineUsers(mode);
    setOnlineUsers(users);
    setLoading(false);
    setRefreshing(false);
  }, [mode]);

  const clearCall = useCallback(() => {
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    webRTCManager.cleanup();
    setActiveCallUser(null);
    activeCallUserRef.current = null;
    setIsCallConnected(false);
    setIsDialling(false);
  }, []);

  const endCall = useCallback(
    (notifyOther = true) => {
      const peer = activeCallUserRef.current;
      if (notifyOther && peer) callSignaling.endCall(peer._id);
      clearCall();
    },
    [clearCall]
  );

  /** Shared peer-connection wiring for both the caller and the answerer. */
  const preparePeer = useCallback(
    async (peerId: string) => {
      await webRTCManager.setupLocalStream({ video: isVideo });
      await webRTCManager.initializePeerConnection();

      webRTCManager.onIceCandidate = (candidate) => {
        callSignaling.sendIceCandidate(peerId, candidate);
      };

      webRTCManager.onConnectionStateChange = (state) => {
        if (state === 'connected') {
          setIsCallConnected(true);
          setIsDialling(false);
          if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        }
        if (state === 'disconnected' || state === 'failed') {
          Alert.alert('Connection Lost', `The ${mode} call dropped. Check your network.`);
          endCall(false);
        }
      };
    },
    [isVideo, mode, endCall]
  );

  // ── Signaling ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?._id) return;

    callSignaling.onIncomingCall = (data) => {
      // The server refuses to ring a busy user, so this is belt-and-braces for
      // a call that arrives in the same instant we start one.
      if (activeCallUserRef.current) {
        callSignaling.sendBusy(data.callerId);
        return;
      }
      setIncomingCall(data);
    };

    callSignaling.onCallAnswered = async ({ sdp }) => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      await webRTCManager.setRemoteDescription(sdp);
    };

    callSignaling.onIceCandidate = async ({ candidate }) => {
      await webRTCManager.addIceCandidate(candidate);
    };

    callSignaling.onCallEnded = ({ reason }) => {
      setIncomingCall(null);
      clearCall();
      if (reason && reason !== 'ended') Alert.alert('Call Ended', reason);
    };

    callSignaling.onCallRejected = () => {
      clearCall();
      Alert.alert('Call Declined', 'They are not available right now.');
    };

    callSignaling.onCallBusy = (data) => {
      clearCall();
      Alert.alert('Busy', data?.reason || 'They are on another call.');
    };

    callSignaling.onCallFailed = ({ reason }) => {
      clearCall();
      Alert.alert('Call Failed', reason || 'Could not connect. Try again.');
    };

    // Busy/free transitions keep the list honest without a refetch.
    callSignaling.onCallStatus = ({ userId, status }) => {
      setOnlineUsers((prev) => {
        if (status === 'offline') return prev.filter((u) => u._id !== userId);
        return prev.map((u) => (u._id === userId ? { ...u, status } : u));
      });
    };

    callSignaling.onPresence = ({ userId, status }) => {
      if (status === 'offline') {
        setOnlineUsers((prev) => prev.filter((u) => u._id !== userId));
      } else {
        // Someone just came online; the list needs their profile.
        loadUsers();
      }
    };

    callSignaling.connect(user._id);
    setSocketReady(callSignaling.isConnected());
    loadUsers();

    // Claim a place in THIS lobby. Announcing it after the socket connects, and
    // retrying while it is still coming up, keeps the room list honest — a user
    // who is not standing here should not appear here.
    const announce = () => { if (callSignaling.isConnected()) { callSignaling.joinLobby(mode); return true; } return false; };
    let announceRetry: ReturnType<typeof setInterval> | undefined;
    let announceGiveUp: ReturnType<typeof setTimeout> | undefined;
    if (!announce()) {
      announceRetry = setInterval(() => { if (announce()) clearInterval(announceRetry); }, 1000);
      announceGiveUp = setTimeout(() => clearInterval(announceRetry), 15000);
    }

    const readyPoll = setInterval(() => setSocketReady(callSignaling.isConnected()), 2000);

    return () => {
      clearInterval(readyPoll);
      // Otherwise a retry can joinLobby after we already left it.
      clearInterval(announceRetry);
      clearTimeout(announceGiveUp);
      callSignaling.leaveLobby();
      if (activeCallUserRef.current) callSignaling.endCall(activeCallUserRef.current._id);
      callSignaling.disconnect();
      webRTCManager.cleanup();
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    };
  }, [user?._id, clearCall, loadUsers, mode]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const startCall = useCallback(
    async (target: CallUser) => {
      if (activeCallUserRef.current) return;
      if (target.status === 'busy') {
        Alert.alert('Busy', `${target.name} is on another call.`);
        return;
      }

      setActiveCallUser(target);
      activeCallUserRef.current = target;
      setIsDialling(true);

      try {
        await preparePeer(target._id);
        const offer = await webRTCManager.createOffer();
        callSignaling.sendOffer(target._id, offer);

        ringTimeoutRef.current = setTimeout(() => {
          endCall(true);
          Alert.alert('No Answer', `${target.name} did not pick up.`);
        }, RING_TIMEOUT_MS);
      } catch (error) {
        console.error('Start call error:', error);
        Alert.alert('Error', `Could not start the ${mode} call. Check your permissions.`);
        endCall(true);
      }
    },
    [preparePeer, endCall, mode]
  );

  const acceptCall = useCallback(async () => {
    // Ref guard: a double tap lands before the re-render that clears incomingCall.
    if (!incomingCall || activeCallUserRef.current) return;
    const { callerId, callerInfo, sdp } = incomingCall;

    const caller: CallUser = {
      _id: callerId,
      name: callerInfo?.name || 'Fync user',
      username: callerInfo?.username,
      avatar: callerInfo?.avatar,
      college: callerInfo?.college,
      status: 'busy',
    };

    setIncomingCall(null);
    setActiveCallUser(caller);
    activeCallUserRef.current = caller;

    try {
      await preparePeer(callerId);
      await webRTCManager.setRemoteDescription(sdp);
      const answer = await webRTCManager.createAnswer();
      callSignaling.sendAnswer(callerId, answer);
    } catch (error) {
      console.error('Accept call error:', error);
      Alert.alert('Error', 'Could not answer the call.');
      endCall(true);
    }
  }, [incomingCall, preparePeer, endCall]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    callSignaling.rejectCall(incomingCall.callerId);
    setIncomingCall(null);
  }, [incomingCall]);

  // ── Render ────────────────────────────────────────────────────────────────
  // While dialling, the caller stays on the lobby with the ringing overlay on
  // top; the active-call screen only takes over once there is a call to show.
  // (Returning early on `activeCallUser` alone made the overlay unreachable.)
  if (activeCallUser && !isDialling) {
    return (
      <>
        {renderActiveCall({
          remoteUser: activeCallUser,
          isCallConnected,
          onEndCall: () => endCall(true),
        })}
      </>
    );
  }

  const renderUser = ({ item }: { item: CallUser }) => (
    <CallUserRow item={item} isVideo={isVideo} onCall={startCall} />
  );

  const caller = incomingCall?.callerInfo;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />


      <View className="flex-1">
        <AppBar title={`${label} rooms`} onBack={() => navigation.goBack()} />
        <Meta className="px-gutter mb-5">
          {socketReady ? `${onlineUsers.length} people online` : 'Connecting…'}
        </Meta>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={C.brand[500]} />
          </View>
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={onlineUsers}
            keyExtractor={(item) => item._id}
            renderItem={renderUser}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottomInset + 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <FyncRefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor={C.brand[500]} />
            }
            ListHeaderComponent={<Label className="mb-2">Online now</Label>}
            ListEmptyComponent={
              <View className="mt-20">
                <Empty icon={isVideo ? 'videocam-off-outline' : 'call-outline'} title="Nobody online" hint="Pull down to refresh." />
              </View>
            }
          />
        )}
      </View>

      {/* Dialling overlay — the caller needs to see who is ringing and be able
          to cancel before the callee picks up. */}
      <Modal visible={isDialling && !!activeCallUser} transparent statusBarTranslucent animationType="fade" onRequestClose={() => endCall(true)}>
        <View className="flex-1 items-center justify-center px-gutter" style={{ backgroundColor: 'rgba(18, 16, 14,0.85)' }}>
          <Avatar user={activeCallUser as any} size={96} />
          <Text className="text-white text-xl font-display mt-6" numberOfLines={1}>
            {activeCallUser?.name}
          </Text>
          {!!activeCallUser?.college && (
            <Text className="text-white/60 text-sm mt-1">
              {activeCallUser.college}
            </Text>
          )}
          <Text className="font-semibold text-sm text-brand-400 mt-4" accessibilityLiveRegion="polite">
            Ringing…
          </Text>
          <Pressable
            onPress={() => endCall(true)}
            className="w-16 h-16 rounded-full bg-danger items-center justify-center mt-12 active:opacity-70"
            accessibilityRole="button"
            accessibilityLabel="Cancel call"
          >
            <Ionicons name="call" size={26} color={C.paper} style={{ transform: [{ rotate: '135deg' }] }} />
          </Pressable>
        </View>
      </Modal>

      {/* Incoming call — accept or decline. Not dismissable: a stray scrim tap must not decline. */}
      <Sheet visible={!!incomingCall} onClose={rejectCall} dismissable={false} contentStyle={{ paddingTop: 24 }}>
        <View className="items-center">
          <Avatar user={caller as any} size={88} />
          <Text className="text-ink font-display mt-5 text-h1" numberOfLines={1}>
            {caller?.name || 'Fync user'}
          </Text>
          {!!caller?.college && <Meta className="mt-1" numberOfLines={1}>{caller.college}</Meta>}
          <Text className="text-accent-text text-sm font-semibold mt-3">
            Incoming {mode} call
          </Text>
        </View>

        <View className="flex-row justify-center gap-16 mt-8 mb-2">
          <View className="items-center">
            <Pressable
              onPress={rejectCall}
              className="w-16 h-16 rounded-full bg-danger items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Decline call"
            >
              <Ionicons name="call" size={26} color={C.paper} style={{ transform: [{ rotate: '135deg' }] }} />
            </Pressable>
            <Label className="mt-3">Decline</Label>
          </View>

          <View className="items-center">
            <Pressable
              onPress={acceptCall}
              className="w-16 h-16 rounded-full bg-success items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Accept call"
            >
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={26} color={C.paper} />
            </Pressable>
            <Label className="mt-3">Accept</Label>
          </View>
        </View>
      </Sheet>
    </View>
  );
}
