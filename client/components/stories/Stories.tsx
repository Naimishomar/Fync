import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, DeviceEventEmitter, FlatList, Modal, Pressable, StatusBar, Text, TextInput, View, useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Video, ResizeMode, Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { C } from '../../constants/colors';
import { compressImage, compressVideo } from '../../utils/mediaUpload';
import { getFullUrl } from '../../utils/imageUtils';
import Avatar from '../Avatar';
import { Sheet, useKeyboardLift } from '../ui/Sheet';
import { Alert } from '../ui/AlertModal';
import { tick } from '../ui/motion';
import Skeleton from '../Skeleton';
import { TYPE } from '../../constants/type';
import { isFeatureOn } from '../../constants/features';
import { streamUrl, type Track } from '../../utils/audius';
import MusicPicker from '../music/MusicPicker';

type Story = {
  _id: string; image?: string | null; video?: string | null; text?: string; bg?: string;
  ask?: boolean; music?: { id: string; title?: string; artist?: string } | null;
  createdAt: string; seen: boolean; viewCount?: number;
};

/** Photo/text stories with music run longer than the default 5s. */
const MUSIC_DURATION = 15000;

/** Loops an Audius track while `playing`; unloads when the id changes or on unmount. */
function useTrackSound(id: string | null | undefined, playing: boolean) {
  const sound = useRef<Audio.Sound | null>(null);
  const playingRef = useRef(playing);
  playingRef.current = playing;
  useEffect(() => {
    if (!id) return;
    let alive = true;
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true }).catch(() => {});
    Audio.Sound.createAsync({ uri: streamUrl(id) }, { shouldPlay: false, isLooping: true, volume: 0.8 })
      .then(({ sound: s }) => {
        if (!alive) { s.unloadAsync().catch(() => {}); return; }
        sound.current = s;
        if (playingRef.current) s.playAsync().catch(() => {});
      })
      .catch(() => {}); // Audius unreachable: the story still shows, silently.
    return () => {
      alive = false;
      sound.current?.unloadAsync().catch(() => {});
      sound.current = null;
    };
  }, [id]);
  useEffect(() => {
    const s = sound.current;
    if (s) (playing ? s.playAsync() : s.pauseAsync()).catch(() => {});
  }, [playing]);
}

/** "♪ Title · Artist" pill, credited to Audius. */
const MusicPill = ({ title, artist, onRemove }: { title?: string; artist?: string; onRemove?: () => void }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 300, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 16, paddingLeft: 10, paddingRight: onRemove ? 4 : 12, height: 32 }}>
    <Ionicons name="musical-notes" size={14} color="#fff" />
    <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Inter_600SemiBold', flexShrink: 1 }} numberOfLines={1}>
      {title}{artist ? ` · ${artist}` : ''}
    </Text>
    {onRemove ? (
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove music" style={{ padding: 4 }}>
        <Ionicons name="close" size={16} color="#fff" />
      </Pressable>
    ) : null}
  </View>
);

/** "Ask me anything" sticker: same look in the composer and the viewer. */
const AskSticker = ({ name }: { name?: string }) => (
  <View style={{ backgroundColor: '#fff', borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', width: 260, boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}>
    <Text style={{ color: '#12100E', fontFamily: 'Inter_700Bold', fontSize: 18 }}>Ask me anything</Text>
    <View style={{ marginTop: 10, backgroundColor: '#F5F2EC', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' }}>
      <Text style={{ color: '#8A847C', fontSize: 14, textAlign: 'center' }} numberOfLines={1}>Send {name || 'me'} an anonymous question</Text>
    </View>
  </View>
);
type Group = {
  user: { _id: string; name?: string; username?: string; avatar?: string };
  isMine: boolean; allSeen: boolean; stories: Story[];
};

/** Emit to make the stories row refetch (home pull-to-refresh, after posting). */
export const STORIES_REFRESH = 'stories:refresh';

const DURATION = 5000;
/** Longest video story; the picker trims to this too. */
const MAX_VIDEO_MS = 30000;
const BGS = ['#F97316', '#DB2777', '#7C3AED', '#2563EB', '#0891B2', '#047857', '#12100E'];
const BG_NAMES: Record<string, string> = {
  '#F97316': 'Orange', '#DB2777': 'Pink', '#7C3AED': 'Purple', '#2563EB': 'Blue', '#0891B2': 'Teal', '#047857': 'Green', '#12100E': 'Black',
};
const RING = 68;
const AV = 60;

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h`;
};

/* ------------------------------------------------------------------ row */

const Bubble = memo(function Bubble({
  label, user, ring, add, onPress, onAdd,
}: {
  label: string; user: Group['user'] | any; ring: 'new' | 'seen' | 'none'; add?: boolean;
  onPress: () => void; onAdd?: () => void;
}) {
  const inner = (
    <View style={{ width: RING - 6, height: RING - 6, borderRadius: RING / 2, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center' }}>
      <Avatar user={user} size={AV - 4} showBadge={false} />
    </View>
  );
  return (
    <Pressable onPress={onPress} className="active:opacity-85 items-center" style={{ width: RING + 8 }} accessibilityRole="button"
      accessibilityLabel={ring === 'new' ? `${label}, new story` : ring === 'none' && add ? 'Add to your story' : label}>
      {ring === 'new' ? (
        <LinearGradient colors={[C.brand[600], C.brand[400], '#FBBF24']} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }}
          style={{ width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center' }}>
          {inner}
        </LinearGradient>
      ) : (
        <View style={{ width: RING, height: RING, borderRadius: RING / 2, alignItems: 'center', justifyContent: 'center', borderWidth: ring === 'seen' ? 2 : 0, borderColor: C.line }}>
          {inner}
        </View>
      )}
      {add ? (
        <Pressable onPress={onAdd ?? onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add to your story"
          style={{ position: 'absolute', top: RING - 22, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: C.brand[500], borderWidth: 2, borderColor: C.paper, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={16} color={C.onBrand} />
        </Pressable>
      ) : null}
      <Text numberOfLines={1} className="text-ink-2" style={[TYPE.caption, { marginTop: 4, maxWidth: RING + 8, textAlign: 'center' }]}>{label}</Text>
    </Pressable>
  );
});

const ViewerRow = memo(function ViewerRow({ v }: { v: any }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
      <Avatar user={v} size={40} />
      <View style={{ flex: 1 }}>
        <Text className="text-ink" style={TYPE.heading} numberOfLines={1}>{v.name}</Text>
        <Text className="text-ink-3" style={TYPE.sm} numberOfLines={1}>@{v.username}</Text>
      </View>
    </View>
  );
});
const renderViewer = ({ item }: { item: any }) => <ViewerRow v={item} />;

const ViewersSkeleton = () => (
  <View style={{ gap: 16, paddingTop: 8 }}>
    {[0, 1, 2].map((i) => (
      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Skeleton lightMode width={40} height={40} borderRadius={20} />
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton lightMode width="55%" height={14} />
          <Skeleton lightMode width="35%" height={12} />
        </View>
      </View>
    ))}
  </View>
);

/** Instagram-style stories strip for the home feed: own bubble first, then the college. */
export function StoriesRow() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/story/feed');
      if (res.data?.success) setGroups(res.data.groups || []);
    } catch { /* the row just stays as it was */ }
  }, []);

  useEffect(() => {
    load();
    const sub = DeviceEventEmitter.addListener(STORIES_REFRESH, load);
    return () => sub.remove();
  }, [load]);

  const markSeen = useCallback((storyId: string) => {
    setGroups((gs) => gs.map((g) => {
      if (!g.stories.some((s) => s._id === storyId)) return g;
      const stories = g.stories.map((s) => (s._id === storyId ? { ...s, seen: true } : s));
      return { ...g, stories, allSeen: stories.every((s) => s.seen) };
    }));
  }, []);

  const removeStory = useCallback((storyId: string) => {
    setGroups((gs) => gs.map((g) => ({ ...g, stories: g.stories.filter((s) => s._id !== storyId) })).filter((g) => g.stories.length));
  }, []);

  const mine = groups.find((g) => g.isMine);
  const others = groups.filter((g) => !g.isMine);
  const renderItem = useCallback(({ item }: { item: Group }) => (
    <Bubble
      label={item.user.name?.split(' ')[0] || item.user.username || 'Story'}
      user={item.user}
      ring={item.allSeen ? 'seen' : 'new'}
      onPress={() => setOpen(groups.indexOf(item))}
    />
  ), [groups]);

  return (
    <View style={{ paddingTop: 12, paddingBottom: 8 }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, gap: 4 }}
        data={others}
        keyExtractor={(g) => g.user._id}
        ListHeaderComponent={
          <Bubble
            label="Your story"
            user={user}
            ring={mine ? (mine.allSeen ? 'seen' : 'new') : 'none'}
            add
            onPress={() => (mine ? setOpen(groups.indexOf(mine)) : setComposing(true))}
            onAdd={() => setComposing(true)}
          />
        }
        renderItem={renderItem}
      />
      {open != null && groups[open] ? (
        <StoryViewer groups={groups} start={open} onClose={() => setOpen(null)} onSeen={markSeen} onDeleted={removeStory} />
      ) : null}
      <StoryComposer visible={composing} onClose={() => setComposing(false)} onPosted={load} />
    </View>
  );
}

/* --------------------------------------------------------------- viewer */

function StoryViewer({
  groups, start, onClose, onSeen, onDeleted,
}: {
  groups: Group[]; start: number; onClose: () => void;
  onSeen: (id: string) => void; onDeleted: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Open each author at their first unseen story, like Instagram.
  const firstUnseen = (g?: Group) => Math.max(0, g?.stories.findIndex((s) => !s.seen) ?? 0);
  const [gi, setGi] = useState(start);
  const [si, setSi] = useState(() => firstUnseen(groups[start]));
  const [ready, setReady] = useState(false);
  // How long the current story's bar runs: 5s, or the video's own length.
  const [dur, setDur] = useState(DURATION);
  const [holding, setHolding] = useState(false);
  const [viewers, setViewers] = useState<any[] | null>(null);
  const [viewersLoading, setViewersLoading] = useState(false);
  // AMA sticker reply: null = closed, else the draft.
  const [askDraft, setAskDraft] = useState<string | null>(null);
  const [askState, setAskState] = useState<'idle' | 'sending' | 'sent' | string>('idle');
  const progress = useSharedValue(0);
  const paused = useRef(false);

  const group = groups[gi];
  const story = group?.stories[si];

  const next = useCallback(() => {
    if (!group) return onClose();
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(firstUnseen(groups[gi + 1])); }
    else onClose();
  }, [gi, si, group, groups, onClose]);

  const run = useCallback((ms: number) => {
    progress.value = withTiming(1, { duration: ms }, (done) => { if (done) runOnJS(next)(); });
  }, [next, progress]);

  const prev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(0); }
    else { progress.value = 0; run(dur); }
  }, [gi, si, progress, run, dur]);


  // New story: reset the bar, wait for the media, mark seen.
  useEffect(() => {
    if (!story) return;
    cancelAnimation(progress);
    progress.value = 0;
    setReady(!story.image && !story.video);
    setDur(story.music && !story.video ? MUSIC_DURATION : DURATION);
    if (!story.seen && !group.isMine) {
      onSeen(story._id);
      axios.post(`/story/${story._id}/view`).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story?._id]);

  useEffect(() => {
    if (story && ready && !paused.current && viewers == null) run(dur * (1 - progress.value));
    return () => cancelAnimation(progress);
  }, [story, ready, run, progress, viewers, dur]);

  useTrackSound(story?.video ? null : story?.music?.id, ready && !holding && viewers == null && askDraft === null);

  const hold = (on: boolean) => {
    paused.current = on;
    setHolding(on);
    if (on) cancelAnimation(progress);
    else if (ready) run(dur * (1 - progress.value));
  };

  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  const showViewers = async () => {
    if (!story) return;
    setViewers([]);
    setViewersLoading(true);
    try {
      const res = await axios.get(`/story/${story._id}/viewers`);
      setViewers(res.data?.viewers || []);
    } catch { setViewers([]); }
    setViewersLoading(false);
  };

  const remove = () => {
    if (!story) return;
    hold(true);
    Alert.alert('Delete story?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel', onPress: () => hold(false) },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`/story/${story._id}`);
            const last = group.stories.length === 1;
            onDeleted(story._id);
            if (last) onClose();
            else if (si >= group.stories.length - 1) setSi(si - 1);
          } catch {
            Toast.show({ type: 'error', text1: 'Could not delete story' });
            hold(false);
          }
        },
      },
    ]);
  };

  if (!group || !story) return null;

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {story.video ? (
          // ponytail: the bar runs on a timer set to the video's length, so a
          // long buffering stall can end the story early; sync to playback
          // status if that shows up.
          <Video
            key={story._id}
            source={{ uri: getFullUrl(story.video) ?? story.video }}
            style={{ flex: 1 }}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={ready && !holding && viewers == null}
            onPlaybackStatusUpdate={(st: any) => {
              if (st.isLoaded && !ready) {
                setDur(Math.min(st.durationMillis || DURATION, MAX_VIDEO_MS));
                setReady(true);
              }
            }}
            onError={() => setReady(true)}
          />
        ) : story.image ? (
          <Image
            source={{ uri: getFullUrl(story.image) ?? undefined }}
            style={{ flex: 1 }}
            contentFit="contain"
            cachePolicy="memory-disk"
            onLoad={() => setReady(true)}
            onError={() => setReady(true)}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: story.bg || C.brand[500], alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ color: '#fff', fontSize: 28, lineHeight: 36, fontFamily: 'Inter_600SemiBold', textAlign: 'center' }}>{story.text}</Text>
          </View>
        )}
        {(story.image || story.video) && story.text ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 90, alignItems: 'center', paddingHorizontal: 24 }}>
            <Text style={{ color: '#fff', fontSize: 17, lineHeight: 24, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, overflow: 'hidden' }}>{story.text}</Text>
          </View>
        ) : null}
        {!ready ? <ActivityIndicator color="#fff" style={{ position: 'absolute', alignSelf: 'center', top: '48%' }} /> : null}

        {/* Tap zones: left third back, rest forward; hold to pause. */}
        <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
          <Pressable style={{ width: width / 3 }} onPress={prev} onLongPress={() => hold(true)} onPressOut={() => paused.current && hold(false)} delayLongPress={200} accessibilityLabel="Previous story" />
          <Pressable style={{ flex: 1 }} onPress={next} onLongPress={() => hold(true)} onPressOut={() => paused.current && hold(false)} delayLongPress={200} accessibilityLabel="Next story" />
        </View>

        {/* AMA sticker: tap to send the author an anonymous question. Same
            backend as their public /ask link, so same inbox and limits. */}
        {story.music && !story.video ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + 66, left: 12 }}>
            <MusicPill title={story.music.title} artist={story.music.artist} />
          </View>
        ) : null}
        {story.ask ? (
          <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + (story.music ? 112 : 72), left: 0, right: 0, alignItems: 'center' }}>
            <Pressable
              disabled={group.isMine}
              onPress={() => { hold(true); setAskState('idle'); setAskDraft(''); }}
              className="active:opacity-85"
              accessibilityRole="button"
              accessibilityLabel={`Ask ${group.user.name || 'them'} an anonymous question`}
            >
              <AskSticker name={group.isMine ? 'you' : group.user.name?.split(' ')[0]} />
            </Pressable>
          </View>
        ) : null}

        {askDraft !== null ? (
          <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', paddingTop: insets.top + 72, alignItems: 'center' }}>
            <View style={{ width: 300, backgroundColor: '#fff', borderRadius: 20, padding: 16 }}>
              <Text style={{ color: '#12100E', fontFamily: 'Inter_700Bold', fontSize: 17, textAlign: 'center' }}>
                {askState === 'sent' ? 'Sent anonymously' : `Ask ${group.user.name?.split(' ')[0] || 'them'} anything`}
              </Text>
              {askState === 'sent' ? (
                <Text style={{ color: '#57534E', fontSize: 14, textAlign: 'center', marginTop: 8 }}>They won&apos;t know it was you.</Text>
              ) : (
                <>
                  <TextInput
                    value={askDraft}
                    onChangeText={setAskDraft}
                    placeholder="Type your question…"
                    placeholderTextColor="#8A847C"
                    multiline
                    maxLength={300}
                    autoFocus
                    style={{ marginTop: 12, minHeight: 80, maxHeight: 160, backgroundColor: '#F5F2EC', borderRadius: 12, padding: 12, color: '#12100E', fontSize: 15, textAlignVertical: 'top' }}
                  />
                  {askState !== 'idle' && askState !== 'sending' ? (
                    <Text style={{ color: '#DC2626', fontSize: 13, marginTop: 8 }}>{askState}</Text>
                  ) : null}
                </>
              )}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable onPress={() => { setAskDraft(null); hold(false); }} className="active:opacity-85" accessibilityRole="button"
                  style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F2EC' }}>
                  <Text style={{ color: '#12100E', fontFamily: 'Inter_600SemiBold' }}>{askState === 'sent' ? 'Done' : 'Cancel'}</Text>
                </Pressable>
                {askState !== 'sent' ? (
                  <Pressable
                    disabled={!askDraft?.trim() || askState === 'sending'}
                    onPress={async () => {
                      setAskState('sending');
                      try {
                        await axios.post(`/ask/${encodeURIComponent(group.user.username || '')}`, { text: askDraft?.trim() });
                        setAskState('sent');
                      } catch (e: any) {
                        setAskState(e?.response?.data?.message || 'Could not send. Try again.');
                      }
                    }}
                    className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Send anonymously"
                    style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, opacity: askDraft?.trim() ? 1 : 0.5 }}>
                    {askState === 'sending' ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>Send</Text>}
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        {/* Header: progress bars, author, close. */}
        <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent']} pointerEvents="box-none"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, paddingTop: insets.top + 8, paddingHorizontal: 10, paddingBottom: 24 }}>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {group.stories.map((s, i) => (
              <View key={s._id} style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
                {i < si ? <View style={{ flex: 1, backgroundColor: '#fff' }} />
                  : i === si ? <Animated.View style={[{ height: '100%', backgroundColor: '#fff' }, barStyle]} /> : null}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 10 }}>
            <Avatar user={group.user} size={34} showBadge={false} />
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 14, flexShrink: 1 }} numberOfLines={1}>
              {group.isMine ? 'Your story' : group.user.name}
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>{ago(story.createdAt)}</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close story" className="active:opacity-85">
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>

        {group.isMine ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => { hold(true); showViewers(); }} className="active:opacity-85" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}
              accessibilityRole="button" accessibilityLabel={`${story.viewCount ?? 0} views. See who viewed`}>
              <Ionicons name="eye-outline" size={22} color="#fff" />
              <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>{story.viewCount ?? 0} views</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            <Pressable onPress={remove} hitSlop={10} className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Delete story" style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={22} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Sheet visible={viewers != null} onClose={() => { setViewers(null); hold(false); }} title="Viewed by" height="60%" scroll={false}>
        <FlatList
          data={viewers || []}
          keyExtractor={(v) => v._id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8 }}
          ListEmptyComponent={viewersLoading ? <ViewersSkeleton />
            : <Text className="text-ink-3" style={[TYPE.sm, { textAlign: 'center', marginTop: 24 }]}>No views yet</Text>}
          renderItem={renderViewer}
        />
      </Sheet>
    </Modal>
  );
}

/* ------------------------------------------------------------- composer */

function StoryComposer({ visible, onClose, onPosted }: { visible: boolean; onClose: () => void; onPosted: () => void }) {
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<{ uri: string; video: boolean } | null>(null);
  const image = media?.uri ?? null;
  const [text, setText] = useState('');
  const [bg, setBg] = useState(BGS[0]);
  const [ask, setAsk] = useState(false);
  const [music, setMusic] = useState<Track | null>(null);
  const [picking, setPicking] = useState(false);
  const [posting, setPosting] = useState(false);
  const lift = useKeyboardLift(visible);

  const reset = () => { setMedia(null); setText(''); setBg(BGS[0]); setAsk(false); setMusic(null); setPicking(false); };
  // Preview the picked song while composing (not over a video: it has its own sound).
  useTrackSound(visible && !media?.video ? music?.id : null, !picking);
  const close = () => { if (!posting) { reset(); onClose(); } };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.9,
      videoMaxDuration: MAX_VIDEO_MS / 1000,
    });
    const a = res.canceled ? null : res.assets[0];
    if (!a) return;
    if (a.type === 'video' && (a.duration ?? 0) > MAX_VIDEO_MS + 500) {
      Toast.show({ type: 'error', text1: 'Pick a video up to 30 seconds' });
      return;
    }
    setMedia({ uri: a.uri, video: a.type === 'video' });
  };

  const share = async () => {
    if (!image && !text.trim() && !ask) return;
    setPosting(true);
    try {
      const form = new FormData();
      form.append('text', text.trim());
      form.append('bg', bg);
      if (ask) form.append('ask', 'true');
      if (music && !media?.video) form.append('music', JSON.stringify({ id: music.id, title: music.title, artist: music.artist }));
      if (media?.video) {
        const uri = await compressVideo(media.uri);
        form.append('video', { uri, name: 'story.mp4', type: 'video/mp4' } as any);
      } else if (image) {
        const uri = await compressImage(image);
        form.append('image', { uri, name: uri.split('/').pop() || 'story.jpg', type: uri.endsWith('.png') ? 'image/png' : 'image/jpeg' } as any);
      }
      const res = await axios.post('/story', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!res.data?.success) throw new Error(res.data?.message);
      tick();
      Toast.show({ type: 'success', text1: 'Added to your story' });
      reset();
      onClose();
      onPosted();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || e?.message || 'Could not post story' });
    } finally {
      setPosting(false);
    }
  };

  const canShare = !!image || !!text.trim() || ask;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={close}>
      <StatusBar barStyle="light-content" />
      <View style={{ flex: 1, backgroundColor: image ? '#000' : bg }}>
        {media?.video ? (
          <Video source={{ uri: media.uri }} style={{ flex: 1 }} resizeMode={ResizeMode.CONTAIN} shouldPlay isLooping />
        ) : image ? <Image source={{ uri: image }} style={{ flex: 1 }} contentFit="contain" /> : null}

        <View style={[{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }, image
          ? { position: 'absolute', left: 0, right: 0, bottom: (lift || insets.bottom) + 90 }
          : { position: 'absolute', top: 0, bottom: lift, left: 0, right: 0 }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={image ? 'Add a caption…' : 'Type something…'}
            placeholderTextColor="rgba(255,255,255,0.7)"
            multiline
            maxLength={300}
            autoFocus={!image}
            style={image
              ? { color: '#fff', fontSize: 17, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 200 }
              : { color: '#fff', fontSize: 28, lineHeight: 36, fontFamily: 'Inter_600SemiBold', textAlign: 'center', width: '100%' }}
          />
        </View>

        {music && !media?.video ? (
          <View style={{ position: 'absolute', top: insets.top + 62, left: 0, right: 0, alignItems: 'center' }}>
            <MusicPill title={music.title} artist={music.artist} onRemove={() => setMusic(null)} />
          </View>
        ) : null}
        {ask ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + (music ? 108 : 72), left: 0, right: 0, alignItems: 'center' }}>
            <AskSticker />
          </View>
        ) : null}

        {/* Top: close, and (text mode) colour swatches. */}
        <View style={{ position: 'absolute', top: insets.top + 10, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close" className="active:opacity-85"
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={24} color="#fff" />
          </Pressable>
          {isFeatureOn('ask') && (
            <Pressable onPress={() => { tick(); setAsk((v) => !v); }} hitSlop={6} accessibilityRole="switch" accessibilityLabel="Ask me anything sticker"
              accessibilityState={{ checked: ask }} className="active:opacity-85"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: ask ? '#fff' : 'rgba(0,0,0,0.35)' }}>
              <Ionicons name="chatbubbles-outline" size={18} color={ask ? '#12100E' : '#fff'} />
              <Text style={{ color: ask ? '#12100E' : '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 13 }}>AMA</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {image ? (
            <Pressable onPress={() => setMedia(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Remove photo or video" className="active:opacity-85"
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="trash-outline" size={20} color="#fff" />
            </Pressable>
          ) : BGS.map((c) => (
            <Pressable key={c} onPress={() => { tick(); setBg(c); }} hitSlop={9} accessibilityRole="button"
              accessibilityLabel={`${BG_NAMES[c] ?? c} background`} accessibilityState={{ selected: bg === c }}
              style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c, borderWidth: bg === c ? 3 : 1.5, borderColor: '#fff' }} />
          ))}
        </View>

        {/* Bottom: gallery + share. */}
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 20, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={pick} className="active:opacity-85" accessibilityRole="button" accessibilityLabel={image ? 'Change photo or video' : 'Add photo or video'}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 18, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.35)' }}>
            <Ionicons name="images-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold' }}>{image ? 'Change' : 'Photo / video'}</Text>
          </Pressable>
          {!media?.video ? (
            <Pressable onPress={() => setPicking(true)} className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Add music"
              style={{ marginLeft: 10, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="musical-notes-outline" size={20} color="#fff" />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }} />
          <Pressable onPress={share} disabled={!canShare || posting} className="active:opacity-85" accessibilityRole="button"
            accessibilityLabel="Share to your story" accessibilityState={{ disabled: !canShare || posting, busy: posting }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 20, borderRadius: 24, backgroundColor: '#fff', opacity: canShare ? 1 : 0.5 }}>
            {posting ? <ActivityIndicator color="#12100E" /> : (
              <>
                <Text style={{ color: '#12100E', fontFamily: 'Inter_600SemiBold' }}>Your story</Text>
                <Ionicons name="arrow-forward" size={18} color="#12100E" />
              </>
            )}
          </Pressable>
        </View>
        {picking ? <MusicPicker onPick={(t) => { tick(); setMusic(t); setPicking(false); }} onClose={() => setPicking(false)} /> : null}
      </View>
    </Modal>
  );
}

export default StoriesRow;
