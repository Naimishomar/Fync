import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Pressable, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Avatar from '../Avatar';
import { C } from '../../constants/colors';
import { tick } from '../ui/motion';

const REPLY_AT = 60;
const SPRING = { damping: 20, stiffness: 260, mass: 0.6 };

/* ---------- day separator ---------- */
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  });
};

export const isSameDay = (a: string, b: string) => sameDay(new Date(a), new Date(b));

/* ---------- typing bubble ---------- */
const Dot = ({ i, still }: { i: number; still: boolean }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    y.value = withDelay(
      i * 140,
      withRepeat(withSequence(withTiming(-4, { duration: 260 }), withTiming(0, { duration: 260 }), withTiming(0, { duration: 300 })), -1),
    );
  }, [still, i, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: interpolate(y.value, [-4, 0], [1, 0.45]) }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, marginHorizontal: 2, backgroundColor: C.ink3 }, s]} />;
};

export const TypingBubble = memo(function TypingBubble({ peer }: { peer: any }) {
  const still = useReducedMotion();
  return (
    <View className="flex-row items-end mb-2" accessibilityLabel="Typing" accessibilityLiveRegion="polite">
      <View className="mr-2"><Avatar user={peer} size={32} showBadge={false} /></View>
      <View
        className="bg-card border border-line flex-row items-center px-4"
        style={{ height: 38, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderBottomRightRadius: 20, borderBottomLeftRadius: 6 }}
      >
        {[0, 1, 2].map(i => <Dot key={i} i={i} still={still} />)}
      </View>
    </View>
  );
});

/* ---------- read receipt ---------- */
type Status = 'sending' | 'sent' | 'read';
const STATUS = {
  sending: { icon: 'time-outline', label: 'Sending' },
  sent: { icon: 'checkmark', label: 'Sent' },
  read: { icon: 'checkmark-done', label: 'Read' },
} as const;

const StatusTicks = ({ status }: { status: Status }) => {
  const v = useSharedValue(1);
  const first = useRef(true);
  useEffect(() => {
    // Only animate a change, not the first paint of every row.
    if (first.current) { first.current = false; return; }
    v.value = 0.5;
    v.value = withSpring(1, SPRING);
  }, [status, v]);
  const s = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: v.value }] }));
  const read = status === 'read';
  return (
    <Animated.View style={s} className="ml-1.5 flex-row items-center">
      <Ionicons name={STATUS[status].icon} size={12} color={read ? C.brand[500] : C.ink4} />
      <Text className={`text-xs ml-0.5 ${read ? 'text-accent-text' : 'text-ink-3'}`}>{STATUS[status].label}</Text>
    </Animated.View>
  );
};

/* ---------- row ---------- */
type Props = {
  item: any;
  isMe: boolean;
  me: any;
  /** Newest bubble of a same-sender run: gets the tail, avatar and time. */
  last: boolean;
  /** Pill shown above this bubble (first message of a day), or null. */
  day: string | null;
  mediaW: number;
  onReply: (item: any) => void;
  onLongPress: (item: any, isMe: boolean) => void;
  onOpenImage: (url: string) => void;
  onOpenVideo: (url: string) => void;
};

export const MessageRow = memo(function MessageRow({
  item, isMe, me, last, day, mediaW, onReply, onLongPress, onOpenImage, onOpenVideo,
}: Props) {
  const x = useSharedValue(0);
  const armed = useSharedValue(false);
  const fire = () => onReply(item);

  // Swipe right to reply. Activates on horizontal intent only, so the inverted
  // list keeps its vertical scroll.
  const pan = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetX(-12)
    .failOffsetY([-12, 12])
    .onUpdate(e => {
      const t = Math.max(0, e.translationX);
      x.value = t > REPLY_AT ? REPLY_AT + (t - REPLY_AT) * 0.25 : t;
      const over = t >= REPLY_AT;
      if (over !== armed.value) {
        armed.value = over;
        if (over) runOnJS(tick)();
      }
    })
    .onEnd(() => {
      if (armed.value) runOnJS(fire)();
    })
    .onFinalize(() => {
      armed.value = false;
      x.value = withSpring(0, SPRING);
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const arrowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [10, REPLY_AT], [0, 1], 'clamp'),
    transform: [{ scale: interpolate(x.value, [10, REPLY_AT], [0.6, 1], 'clamp') }],
  }));

  const fg = isMe ? C.onBrand : C.ink;
  const status: Status = item.pending || item.optimistic ? 'sending' : item.seen ? 'read' : 'sent';

  return (
    <View className={last ? 'mb-3' : 'mb-0.5'}>
      {day && (
        <View className="items-center my-3">
          <View className="bg-paper-2 border border-line rounded-full px-3 py-1">
            <Text className="text-xs font-semibold text-ink-3">{day}</Text>
          </View>
        </View>
      )}
      <View>
        <Animated.View style={[{ position: 'absolute', left: 0, top: 0, bottom: 0, justifyContent: 'center' }, arrowStyle]} pointerEvents="none">
          <View className="w-8 h-8 rounded-full bg-paper-2 items-center justify-center">
            <Ionicons name="arrow-undo" size={16} color={C.ink2} />
          </View>
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View style={rowStyle} className={`w-full ${isMe ? 'items-end' : 'items-start'}`}>
            <View className={`flex-row items-end ${isMe ? 'flex-row-reverse' : 'flex-row'} max-w-[85%]`}>
              <View className={isMe ? 'ml-2' : 'mr-2'} style={{ width: 32 }}>
                {last && <Avatar user={isMe ? me : item.sender} size={32} showBadge={false} />}
              </View>

              <View className={`${isMe ? 'items-end' : 'items-start'} flex-1`}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onLongPress={() => onLongPress(item, isMe)}
                  delayLongPress={500}
                  style={{
                    borderRadius: 20,
                    ...(last ? (isMe ? { borderBottomRightRadius: 6 } : { borderBottomLeftRadius: 6 }) : null),
                  }}
                  className={`px-4 py-2.5 ${isMe ? 'bg-brand-500' : 'bg-card border border-line'}`}
                >
                  {item.replyTo && (
                    <View
                      className={`mb-2 p-2 rounded-xl border-l-2 ${isMe ? 'bg-black/10' : 'bg-paper-2 border-brand-500'}`}
                      style={isMe ? { borderLeftColor: C.onBrand } : undefined}
                    >
                      <Text className={`text-xs font-semibold ${isMe ? '' : 'text-accent-text'}`} style={isMe ? { color: C.onBrand } : undefined}>
                        {item.replyTo.sender?.name || (item.replyTo.sender === me._id ? 'You' : 'User')}
                      </Text>
                      <Text className={`text-xs ${isMe ? '' : 'text-ink-3'}`} style={isMe ? { color: C.onBrand, opacity: 0.75 } : undefined} numberOfLines={1}>
                        {item.replyTo.message}
                      </Text>
                    </View>
                  )}

                  {(item.messageType === 'text' || !item.messageType) && item.message ? (
                    <Text className="text-[15px] leading-5 font-sans" style={{ color: fg }}>{item.message}</Text>
                  ) : null}

                  {item.messageType === 'image' && (
                    <TouchableOpacity onPress={() => onOpenImage(item.mediaUrl)} accessibilityRole="imagebutton" accessibilityLabel="Open photo">
                      <Image
                        source={{ uri: item.mediaUrl }}
                        style={{ width: mediaW, aspectRatio: 1, borderRadius: 12 }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        blurRadius={item.pending ? 10 : 0}
                      />
                    </TouchableOpacity>
                  )}

                  {item.messageType === 'video' && (
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); if (!item.pending) onOpenVideo(item.mediaUrl); }}
                      onLongPress={(e) => e.stopPropagation()}
                      accessibilityRole="button"
                      accessibilityLabel="Play video"
                      className="bg-night rounded-xl overflow-hidden shadow-hair items-center justify-center"
                      style={{ width: mediaW, aspectRatio: 16 / 10 }}
                    >
                      <Ionicons name="play-circle" size={44} color="white" />
                      {item.pending && (
                        <View className="absolute inset-0 bg-black/40 items-center justify-center">
                          <ActivityIndicator size="small" color="white" />
                        </View>
                      )}
                    </Pressable>
                  )}

                  {item.messageType === 'file' && (
                    <Pressable
                      onPress={(e) => { e.stopPropagation(); Linking.openURL(item.mediaUrl); }}
                      onLongPress={(e) => e.stopPropagation()}
                      accessibilityRole="button"
                      accessibilityLabel="Open PDF"
                      className={`flex-row items-center p-3 rounded-xl ${isMe ? 'bg-black/10' : 'bg-paper-2'}`}
                    >
                      <View className={`w-10 h-10 rounded-lg items-center justify-center ${isMe ? 'bg-card' : 'bg-brand-100'}`}>
                        <Ionicons name="document-text" size={24} color={C.brand[500]} />
                      </View>
                      <View className="ml-3 flex-1">
                        <Text className="text-sm font-semibold" style={{ color: fg }} numberOfLines={1}>
                          {item.message || 'Shared PDF'}
                        </Text>
                        <Text className="text-xs" style={{ color: fg, opacity: 0.7 }}>Tap to view PDF</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={fg} />
                    </Pressable>
                  )}
                </TouchableOpacity>

                {last && (
                  <View className="mt-1 flex-row items-center">
                    <Text className="text-xs text-ink-3">
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && <StatusTicks status={status} />}
                  </View>
                )}
              </View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </View>
  );
});
