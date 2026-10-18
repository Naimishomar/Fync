import React, { useState, useEffect, useCallback, useRef } from 'react';
import {Text, View, Pressable, FlatList, Dimensions, RefreshControl, Linking, ActivityIndicator, ScrollView, Modal, TextInput, Switch, KeyboardAvoidingView, Platform, DeviceEventEmitter} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/auth.context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { readCache, writeCache, userKey } from '../utils/screenCache';
import { batchGet, bodyOf } from '../utils/batchRequest';
import { prefetchPostImages } from '../utils/imageWarm';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Avatar from './Avatar';
import { Image as ExpoImage } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { getFullUrl, getThumbUrl } from '../utils/imageUtils';
import { StatusBar } from 'expo-status-bar';
import EducationCard, { EducationEntry } from './profile/EducationCard';
import { useTabBarClearance, useTabBarAutoHide } from '../constants/layout';
import { Alert } from './ui/AlertModal';

import { AppBar, StampCard, StampNumber } from './ui/kit';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type UserType = {
  _id: string; name: string; username: string; avatar: string;
  user_access?: string; college?: string; interest?: string | string[];
  about?: string; experience?: string; skills?: string[];
  hobbies?: string | string[]; github_id?: string; linkedIn_id?: string;
  banner?: string; upiId?: string; resumeUrl?: string;
  codingProfiles?: { leetcode?: string; gfg?: string; codechef?: string };
  codingStats?: { leetcodeSolved?: number; leetcodeRating?: number; gfgSolved?: number; gfgRating?: number; codechefSolved?: number; codechefRating?: number; totalSolved?: number };
  followers?: any[]; following?: any[];
  fyncScore?: number; fyncBadge?: string;
  education?: EducationEntry[];
  githubUsername?: string; githubStats?: any;
};


// ─── SECTION HEADER ──────────────────────────────────────────────────────────
const SH = ({ title, icon, accent = C.brand[500] }: { title: string; icon: string; accent?: string }) => (
  <View className="flex-row items-center mb-3 mt-6" style={{ gap: 12 }}>

    <View className="hidden">
      <Ionicons name={icon as any} size={18} color={accent} />
    </View>
    <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>{title}</Text>
    <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
  </View>
);

// ─── PROFILE STRENGTH ────────────────────────────────────────────────────────
// Only fields /user/profile already returns; projects live behind another API,
// so they are not counted here.
const STRENGTH_ITEMS: { label: string; route: 'EditProfile' | 'FyncProfileBuilder'; done: (u: UserType) => boolean }[] = [
  { label: 'Add profile photo', route: 'EditProfile', done: u => !!u?.avatar },
  { label: 'Add a bio', route: 'EditProfile', done: u => !!u?.about?.trim() },
  { label: 'Add skills', route: 'FyncProfileBuilder', done: u => !!u?.skills?.length },
  { label: 'Add education', route: 'FyncProfileBuilder', done: u => !!u?.education?.length },
  { label: 'Link GitHub', route: 'FyncProfileBuilder', done: u => !!(u?.githubUsername || u?.github_id) },
  { label: 'Upload resume', route: 'FyncProfileBuilder', done: u => !!u?.resumeUrl },
];

function ProfileStrength({ user }: { user: UserType }) {
  const navigation = useNavigation<any>();
  if (!user?._id) return null;
  const missing = STRENGTH_ITEMS.filter(i => !i.done(user));
  if (!missing.length) return null;
  const pct = Math.round(((STRENGTH_ITEMS.length - missing.length) / STRENGTH_ITEMS.length) * 100);
  return (
    <View className="w-full mt-4 bg-card border border-line rounded-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-display text-label text-ink-3 uppercase">Profile strength</Text>
        <Text className="font-display text-label text-accent-text">{pct}%</Text>
      </View>
      <View
        className="h-2 bg-paper-2 rounded-full overflow-hidden mt-3"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
      </View>
      <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
        {missing.slice(0, 2).map(i => (
          <Pressable
            key={i.label}
            onPress={() => navigation.navigate(i.route)}
            className="flex-row items-center bg-brand-50 border border-line px-3 rounded-full"
            style={{ minHeight: 32 }}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={14} color={C.accentText} />
            <Text className="font-semibold text-label text-accent-text ml-1">{i.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── SKILL CHIP ───────────────────────────────────────────────────────────────
const SkillChip = ({ label }: { label: string }) => (
  <View className="bg-card border border-line px-3 rounded-full mb-2 mr-2 justify-center" style={{ minHeight: 28 }}>
    <Text className="font-medium text-label text-ink-2">{label}</Text>
  </View>
);

// ─── FYNC SCORE MINI BADGE ────────────────────────────────────────────────────
// Ionicons names, not emoji — rendered through <Ionicons>, never as text.
const BADGE_ICON: Record<string, any> = {
  Newcomer: 'leaf', Explorer: 'compass', Builder: 'hammer', Innovator: 'bulb', Pioneer: 'rocket', Legend: 'star'
};

// ─── CODING STAT CARD ─────────────────────────────────────────────────────────
const CodingPlatformCard = ({ icon, name, color, bg, username, solved, rating, profileUrl }: any) => {
  if (!username && !solved) return null;
  return (
    <Pressable
      onPress={() => username && Linking.openURL(profileUrl).catch(() => {})}
      className="flex-1 rounded-card border p-4 items-center bg-card shadow-hair"
      style={{ borderColor: color + '20' }}
    >
      <View className="w-12 h-12 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: color + '1A' }}>
        {typeof icon === 'string' && icon.startsWith('http')
          ? <ExpoImage source={{ uri: icon }} style={{ width: 28, height: 28 }} contentFit="contain" cachePolicy="memory-disk" />
          : <Ionicons name={icon} size={26} color={color} />}
      </View>
      <Text className="font-display text-xl text-ink leading-tight">{solved || 0}</Text>
      <Text className="font-display text-label text-ink-3 uppercase mb-2" style={{ letterSpacing: 1.4 }}>Solved</Text>
      {rating ? (
        <View className="bg-paper-2 border border-line mt-1 px-2.5 py-1 rounded-full">
          <Text className="font-display text-label" style={{ color }}>{rating}</Text>
        </View>
      ) : null}
      <Text className="font-semibold text-label text-ink mt-3 text-center">{name}</Text>
    </Pressable>
  );
};


// ─── CODING STATS MODAL ───────────────────────────────────────────────────────
function CodingStatsModal({ visible, user, onClose, onSuccess }: {
  visible: boolean; user: any; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm({
      leetcodeSolved: user?.codingStats?.leetcodeSolved?.toString() || '',
      leetcodeRating: user?.codingStats?.leetcodeRating?.toString() || '',
      gfgSolved: user?.codingStats?.gfgSolved?.toString() || '',
      gfgRating: user?.codingStats?.gfgRating?.toString() || '',
      codechefSolved: user?.codingStats?.codechefSolved?.toString() || '',
      codechefRating: user?.codingStats?.codechefRating?.toString() || '',
      codechef: user?.codingProfiles?.codechef || '',
    });
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch('/profile/coding-stats', form);
      Toast.show({ type: 'success', text1: 'Coding stats updated!' });
      onSuccess();
    } catch { Toast.show({ type: 'error', text1: 'Failed to update' }); }
    finally { setSaving(false); }
  };

  const fields = [
    { label: 'LeetCode Problems Solved', key: 'leetcodeSolved', ph: '250' },
    { label: 'LeetCode Rating', key: 'leetcodeRating', ph: '1650' },
    { label: 'GFG Problems Solved', key: 'gfgSolved', ph: '300' },
    { label: 'GFG Rating (Score)', key: 'gfgRating', ph: '2100' },
    { label: 'CodeChef Username', key: 'codechef', ph: 'my_handle', numeric: false },
    { label: 'CodeChef Problems Solved', key: 'codechefSolved', ph: '150' },
    { label: 'CodeChef Rating', key: 'codechefRating', ph: '1400' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-paper" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Android draws the "pageSheet" modal full-screen, so the header sat under
            the status bar. The native SafeAreaView measures its real window, so on
            an iOS sheet (already below the bar) this resolves to 0. */}
        <SafeAreaView edges={['top']}>
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-line">
          <Pressable onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color={C.ink2} /></Pressable>
          <Text className="font-display text-h2 text-ink">Update Coding Stats</Text>
          <Pressable onPress={save} disabled={saving} className="bg-brand-500 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color={C.onBrand} /> : <Text className="text-on-brand font-semibold">Save</Text>}
          </Pressable>
        </View>
        </SafeAreaView>
        <ScrollView className="flex-1 px-4 pt-2" keyboardShouldPersistTaps="handled">
          <View className="bg-paper-2 border border-line px-4 py-3 rounded-xl my-3">
            <Text className="font-sans text-sm text-brand-700">These are self-reported. Enter your current stats from each platform.</Text>
          </View>
          {fields.map(f => (
            <View key={f.key} className="mb-4">
              <Text className="font-display text-label text-ink-3 uppercase mb-2" style={{ letterSpacing: 1.4 }}>{f.label}</Text>
              <TextInput className="bg-card border-[1.5px] border-ink px-4 py-3 text-ink text-sm rounded-md"
                placeholder={f.ph} placeholderTextColor={C.ink4}
                keyboardType={f.numeric === false ? 'default' : 'numeric'}
                value={form[f.key] || ''}
                onChangeText={v => setForm((p: any) => ({ ...p, [f.key]: v }))} />
            </View>
          ))}
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ABOUT TAB FULL REBUILD ───────────────────────────────────────────────────
function AboutSection({ user, isOwner, onRefresh }: { user: UserType; isOwner: boolean; onRefresh: () => void }) {
  const navigation = useNavigation<any>();
  const [showCodingModal, setShowCodingModal] = useState(false);

  const education = user?.education || [];
  const skills = user?.skills || [];
  const cs = user?.codingStats || {};
  const cp = user?.codingProfiles || {};


  const hasCoding = cp.leetcode || cp.gfg || cp.codechef || cs.leetcodeSolved || cs.gfgSolved;

  return (
    // A row of the profile FlashList, which already scrolls and clears the tab bar.
    <View className="bg-paper">

      {/* ── Fync Score Banner ──────────────────────────────────────────── */}
      {/* The one stamped card on this screen. The score is what Profile is for,
          and a stamped white card reads as a printed receipt rather than as the
          fifth orange gradient in the app. */}
      {user?.fyncScore !== undefined && (
        <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')} className="mx-gutter mt-6 mb-2">
          <StampCard>
            <View className="p-card-pad">
              <View className="flex-row items-start">
                <View className="flex-1">
                  <Text className="font-display text-label text-ink-3 uppercase">Score</Text>
                  <Text className="font-display text-ink" style={{ fontSize: 40, lineHeight: 42, letterSpacing: -1.2 }}>
                    {user.fyncScore}
                  </Text>
                  <Text className="font-sans text-sm text-ink-2 mt-2">
                    Score Portfolio · Level {user.fyncBadge || 'Newcomer'}
                  </Text>
                </View>
                <StampNumber value={user.fyncScore} caption="score" />
              </View>

              <View className="h-2 bg-paper-2 rounded-full overflow-hidden mt-5">
                <View className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (user.fyncScore / 1000) * 100))}%` }} />
              </View>
              <View className="flex-row items-center justify-between mt-3">
                <Text className="font-display text-label text-ink-3 uppercase">Next: 1000</Text>
                <Text className="font-display text-label text-accent-text uppercase">
                  +{Math.max(0, 1000 - user.fyncScore)} to go
                </Text>
              </View>

              <View className="mt-4 border-2 border-ink bg-brand-500 items-center justify-center flex-row rounded-md" style={{ minHeight: 48 }}>
                <Ionicons name={BADGE_ICON[user.fyncBadge || 'Newcomer']} size={16} color={C.onBrand} style={{ marginRight: 8 }} />
                <Text className="font-display text-on-brand uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Boost Score</Text>
              </View>
            </View>
          </StampCard>
        </Pressable>
      )}

      {/* ── About ──────────────────────────────────────────────────────── */}
      {!!user?.about && (
        <View className="mx-4 mt-4 bg-card rounded-sheet p-6 border border-line shadow-hair">
          <SH title="About Me" icon="person-outline" />
          <Text className="text-ink-2 text-sm leading-[24px] font-medium">{user.about}</Text>
        </View>
      )}

      {/* ── Skills ──────────────────────────────────────────────────────── */}
      {skills.length > 0 && (
        <View className="mx-4 mt-4 bg-card rounded-sheet p-6 border border-line shadow-hair">
          <SH title="Skills & Stack" icon="code-slash-outline" accent={C.fam.study} />
          <View className="flex-row flex-wrap gap-2">
            {skills.map((s, i) => <SkillChip key={i} label={s} />)}
          </View>
        </View>
      )}

      {/* ── Interests & Hobbies ─────────────────────────────────────────── */}
      {!!(user?.interest || user?.hobbies) && (
        <View className="mx-4 mt-4 bg-card rounded-sheet p-6 border border-line shadow-hair">
          <SH title="Vibe & Interests" icon="heart-outline" accent={C.fam.fun} />
          <View className="flex-row flex-wrap gap-3">
            {(Array.isArray(user.interest) ? user.interest : [user.interest]).filter(Boolean).map((t, i) => (
              <View key={`i${i}`} className="flex-row items-center bg-paper-2 px-4 py-2 rounded-card border border-line">
                <Text className="text-accent-text text-xs font-display uppercase mr-1.5"></Text>
                <Text className="text-brand-700 text-xs font-semibold">{t}</Text>
              </View>
            ))}
            {(Array.isArray(user.hobbies) ? user.hobbies : [user.hobbies]).filter(Boolean).map((h, i) => (
              <View key={`h${i}`} className="flex-row items-center bg-success/10 px-4 py-2 rounded-card border border-success/15">
                <Text className="text-success text-xs font-display uppercase mr-1.5"></Text>
                <Text className="text-success text-xs font-semibold">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Education ───────────────────────────────────────────────────── */}
      <View className="mx-4 mt-6">
        <View className="flex-row items-center justify-between mb-4 px-1">
          <View className="flex-row items-center gap-3">
            <View className="w-1.5 h-6 rounded-full bg-brand-500" />
            <View className="bg-paper-2 p-1.5 rounded-lg border border-line">
              <Ionicons name="school-outline" size={18} color={C.brand[500]} />
            </View>
            <Text className="font-semibold text-ink text-xs uppercase">Education</Text>
          </View>
        </View>
        {education.length === 0 ? (
          <View className="bg-card rounded-sheet border border-line p-card-pad items-center shadow-hair">
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-4">
              <Ionicons name="school-outline" size={32} color={C.ink4} />
            </View>
            <Text className="text-ink font-semibold text-sm">No education yet</Text>
            <Text className="text-ink-3 text-xs mt-1 text-center">Highlight your academic journey here</Text>
          </View>
        ) : education.map(e => (
          <EducationCard key={e._id} item={e} isOwner={false} />
        ))}
      </View>

      {/* ── Coding Platforms ─────────────────────────────────────────────── */}
      {!!(hasCoding || isOwner) && (
        <View className="mx-4 mt-4 bg-paper-2 rounded-sheet p-1">
          <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
            <View className="flex-row items-center justify-between mb-5">
              <SH title="Coding Stats" icon="code-slash-outline" accent={C.fam.social} />
              {isOwner && (
                <Pressable onPress={() => setShowCodingModal(true)}
                  className="bg-fam-career/10 px-3 py-1.5 rounded-xl border border-fam-career/15">
                  <Ionicons name="pencil-outline" size={14} color={C.fam.social} />
                </Pressable>
              )}
            </View>

            {/* Total solved banner */}
            {cs.totalSolved ? (
              <View className="bg-ink rounded-card px-6 py-5 mb-5 flex-row items-center justify-between shadow-hair">
                <View>
                  <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                    <Text className="text-ink-3 font-display text-label uppercase">Total Solved</Text>
                    <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                  </View>
                  <Text className="text-paper font-display text-2xl">{cs.totalSolved}</Text>
                </View>
                <View className="w-12 h-12 bg-card/10 rounded-card items-center justify-center">
                  <Ionicons name="trophy" size={24} color="#F89F1B" />
                </View>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <CodingPlatformCard
                icon="https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0"
                name="LeetCode" color="#F89F1B" bg={C.paper2}
                username={cp.leetcode} solved={cs.leetcodeSolved} rating={cs.leetcodeRating}
                profileUrl={`https://leetcode.com/${cp.leetcode}`}
              />
              <CodingPlatformCard
                icon="https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png"
                name="GFG" color={C.success} bg={C.paper2}
                username={cp.gfg} solved={cs.gfgSolved} rating={cs.gfgRating}
                profileUrl={`https://www.geeksforgeeks.org/user/${cp.gfg}`}
              />
              <CodingPlatformCard
                icon="https://cdn.codechef.com/images/cc-logo.svg"
                name="CodeChef" color="#6F4E37" bg={C.paper2}
                username={cp.codechef} solved={cs.codechefSolved} rating={cs.codechefRating}
                profileUrl={`https://www.codechef.com/users/${cp.codechef}`}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Social Links ─────────────────────────────────────────────────── */}
      {!!(user?.github_id || user?.linkedIn_id || user?.githubUsername) && (
        <View className="mx-4 mt-6 bg-card rounded-sheet p-6 border border-line shadow-hair">
          <SH title="Connected Accounts" icon="share-outline" accent={C.ink2} />
          <View className="gap-3">
            {!!user?.github_id && (
              <Pressable onPress={() => Linking.openURL(user.github_id!).catch(() => {})}
                className="flex-row items-center bg-paper-2 px-5 py-4 rounded-card border border-line">
                <Ionicons name="logo-github" size={24} color={C.ink2} />
                <View className="ml-4 flex-1">
                  <Text className="text-label text-ink-3 font-display uppercase">Developer</Text>
                  <Text className="text-ink font-semibold text-sm">GitHub</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.ink4} />
              </Pressable>
            )}
            {!!user?.linkedIn_id && (
              <Pressable onPress={() => Linking.openURL(user.linkedIn_id!).catch(() => {})}
                className="flex-row items-center bg-paper-2 px-5 py-4 rounded-card border border-line">
                <Ionicons name="logo-linkedin" size={24} color="#0077B5" />
                <View className="ml-4 flex-1">
                  <Text className="text-label text-ink-3 font-display uppercase">Professional</Text>
                  <Text className="text-ink font-semibold text-sm">LinkedIn</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={C.ink4} />
              </Pressable>
            )}
            {isFeatureOn('creatorTips') && !!user?.upiId && (
              <View className="flex-row items-center bg-success/10 px-5 py-4 rounded-card border border-success/15">
                <View className="w-10 h-10 bg-success rounded-card items-center justify-center">
                  <Ionicons name="wallet" size={20} color="white" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-success text-label font-display uppercase">Payments</Text>
                  <Text className="text-success font-semibold text-sm">{user.upiId}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <CodingStatsModal
        visible={showCodingModal}
        user={user}
        onClose={() => setShowCodingModal(false)}
        onSuccess={() => { setShowCodingModal(false); onRefresh(); }}
      />
    </View>
  );
}

// ─── GRID IMAGE ───────────────────────────────────────────────────────────────
// Module scope: declared inside Profile it was a new component type on every
// render, so every cell in the grid unmounted and reloaded its image.
/** Small variant first, full file only if the twin is missing. */
const GridImage = ({ path }: { path: string }) => {
  const [src, setSrc] = useState(getThumbUrl(path) || '');
  return (
    <ExpoImage
      source={{ uri: src }}
      style={{ width: '100%', height: '100%' }}
      contentFit="cover"
      cachePolicy="disk"
      onError={() => { const full = getFullUrl(path); if (full && src !== full) setSrc(full); }}
    />
  );
};

// ─── MAIN PROFILE COMPONENT ───────────────────────────────────────────────────
function Profile() {
  const tabBarClearance = useTabBarClearance();
  const autoHideTabBar = useTabBarAutoHide();
  const { user, logout, setUser } = useAuth();
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [reposts, setReposts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'reposts' | 'about'>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [shortsPage, setShortsPage] = useState(1);
  // The header shows how many posts exist, not how many have been scrolled
  // into the grid — the first page is 12, which read as a cap.
  const [postCount, setPostCount] = useState<number | null>(null);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const fetchSubscription = async () => {
    try {
      const res = await axios.get('/subscription/status');
      if (res.data.success) {
        setSubscription(res.data);
      }
    } catch (error) {
      console.error("Subscription fetch error:", error);
    }
  };

  const getPosts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/post/posts?page=${page}&limit=12`);
      if (res.data.success) {
        setPosts(prev => isInitial ? res.data.posts : [...prev, ...res.data.posts.filter((p: any) => !prev.some(e => e._id === p._id))]);
        setHasMorePosts(res.data.hasMore); setPostsPage(page);
        if (typeof res.data.total === 'number') setPostCount(res.data.total);
        if (isInitial) {
          prefetchPostImages(res.data.posts);
          writeCache(userKey(user?._id, 'profile_posts'), res.data.posts);
        }
      }
    } catch { } finally { setIsLoadingMore(false); }
  };

  const getShorts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/shorts/your?page=${page}&limit=12`);
      if (res.data.success) {
        setShorts(prev => isInitial ? res.data.shorts : [...prev, ...res.data.shorts.filter((s: any) => !prev.some(e => e._id === s._id))]);
        setHasMoreShorts(res.data.hasMore === true); setShortsPage(page);
        if (isInitial) writeCache(userKey(user?._id, 'profile_shorts'), res.data.shorts);
      } else setHasMoreShorts(false);
    } catch { } finally { setIsLoadingMore(false); }
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get('/user/profile');
      if (res.data.user && setUser) setUser(res.data.user);
    } catch { }
  };

  // The grid used to be empty until the network answered, on every single
  // visit. Paint the last-known posts first; the refresh below replaces them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [cachedPosts, cachedShorts] = await Promise.all([
        readCache<any[]>(userKey(user?._id, 'profile_posts')),
        readCache<any[]>(userKey(user?._id, 'profile_shorts')),
      ]);
      if (cancelled) return;
      // Only fill gaps -- a response that already landed must not be undone.
      if (cachedPosts?.length) {
        setPosts(prev => (prev.length ? prev : cachedPosts));
        prefetchPostImages(cachedPosts);
      }
      if (cachedShorts?.length) setShorts(prev => (prev.length ? prev : cachedShorts));
    })();
    return () => { cancelled = true; };
  }, [user?._id]);

  /**
   * One request instead of four.
   *
   * These are all small, fast reads the screen needs before it can paint, which
   * is exactly the shape batching suits: the server pays one middleware pass
   * rather than four, and the device opens one connection rather than four.
   */
  const loadProfileScreen = useCallback(async ({ replace = false } = {}) => {
    /**
     * Merge the fresh first page into what is already loaded.
     *
     * Replacing outright cut a grid the user had scrolled thirty items into
     * back down to twelve, and the list, suddenly shorter than the scroll
     * offset, snapped to the top — which is what returning from a post looked
     * like. A pull-to-refresh does still replace: that is what it is for.
     */
    const merge = (fresh: any[], previous: any[]) => {
      if (replace || previous.length === 0) return fresh;
      const freshIds = new Set(fresh.map((item) => item._id));
      return [...fresh, ...previous.filter((item) => !freshIds.has(item._id))];
    };

    const results = await batchGet({
      posts: '/post/posts?page=1&limit=12',
      shorts: '/shorts/your?page=1&limit=12',
      reposts: `/post/reposts/${user?._id}`,
      subscription: '/subscription/status',
      me: '/user/profile',
    });

    const postsBody = bodyOf<any>(results.posts);
    if (postsBody?.success) {
      setPosts((prev) => merge(postsBody.posts || [], prev));
      setHasMorePosts(postsBody.hasMore);
      if (replace) setPostsPage(1);
      if (typeof postsBody.total === 'number') setPostCount(postsBody.total);
      prefetchPostImages(postsBody.posts || []);
      writeCache(userKey(user?._id, 'profile_posts'), postsBody.posts || []);
    }

    const shortsBody = bodyOf<any>(results.shorts);
    if (shortsBody?.success) {
      setShorts((prev) => merge(shortsBody.shorts || [], prev));
      setHasMoreShorts(shortsBody.hasMore === true);
      if (replace) setShortsPage(1);
      writeCache(userKey(user?._id, 'profile_shorts'), shortsBody.shorts || []);
    } else {
      setHasMoreShorts(false);
    }

    // getReposts answers under the model key, so this is `post`, not `posts`.
    const repostsBody = bodyOf<any>(results.reposts);
    if (repostsBody?.success) setReposts(repostsBody.post || []);

    const subBody = bodyOf<any>(results.subscription);
    if (subBody?.success) setSubscription(subBody);

    const meBody = bodyOf<any>(results.me);
    if (meBody?.user && setUser) setUser(meBody.user);
  }, [user?._id, setUser]);

  // Coming back from a post is not a reason to refetch the whole screen. The
  // first focus loads it; after that only a stale one does, so a quick trip
  // into a post and back leaves the grid exactly where it was.
  const lastLoadedAt = useRef(0);
  const STALE_AFTER_MS = 2 * 60 * 1000;

  useFocusEffect(
    useCallback(() => {
      if (Date.now() - lastLoadedAt.current < STALE_AFTER_MS) return;
      lastLoadedAt.current = Date.now();
      loadProfileScreen().catch(() => { lastLoadedAt.current = 0; });
    }, [loadProfileScreen])
  );

  // A post the user just made is the one case where a return trip does need
  // fresh data, stale gate or not.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('post:created', () => {
      lastLoadedAt.current = 0;
    });
    return () => sub.remove();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    lastLoadedAt.current = Date.now();
    await loadProfileScreen({ replace: true }).catch(() => {});
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    if (activeTab === 'posts' && hasMorePosts) getPosts(postsPage + 1);
    else if (activeTab === 'shorts' && hasMoreShorts) getShorts(shortsPage + 1);
  };

  const deletePost = async (id: string) => {
    const previousPosts = posts;
    // Optimistic update
    setPosts(p => p.filter(x => x._id !== id));
    
    try {
      const res = await axios.delete(`/post/${id}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Post deleted' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      setPosts(previousPosts); // Rollback
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  const deleteShort = async (id: string) => {
    const previousShorts = shorts;
    // Optimistic update
    setShorts(p => p.filter(x => x._id !== id));

    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Short deleted' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      setShorts(previousShorts); // Rollback
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  // ── Profile Header ─────────────────────────────────────────────────────
  const renderProfileInfo = () => (
    <View className="bg-card">
      <View className="h-64 w-full relative">
        <ExpoImage
          source={{ uri: getFullUrl(user?.banner) || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000' }}
          style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.2)']} className="absolute inset-0" />
        
      </View>

      <View className="items-center pb-6 px-5 bg-paper rounded-t-sheet -mt-12 shadow-hair">
        <View className="-mt-14 p-1.5 bg-card rounded-full shadow-hair">
          <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
            <Avatar user={user as any} size={110} />
          </View>
        </View>

        {/* Name + badge */}
        <View className="flex-row items-center mt-4 gap-2">
          <Text className="font-display text-ink text-h1">{user?.name || user?.username}</Text>
        </View>
        <Text className="text-accent-text font-display text-sm mt-1">@{user?.username}</Text>

        <Text className="text-ink-3 text-center mt-4 px-6 text-sm leading-[22px] font-medium">
          {user?.about || "Elevating the future of networking at Fync"}
        </Text>

        <View className="flex-row items-center mt-4 px-4 py-2 bg-paper-2 rounded-card border border-line gap-2">
          <Ionicons name="location" size={16} color={C.brand[500]} />
          <Text className="font-semibold text-base text-ink">{user?.college || 'Earth'}</Text>
        </View>

        {/* Stats Dashboard */}
        <View className="flex-row w-full bg-ink rounded-sheet mt-6 p-6 shadow-hair">
          {[
            { label: 'Posts', value: postCount ?? posts.length },
            { label: 'Followers', value: user?.followers?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user?._id, type: 'followers' }) },
            { label: 'Following', value: user?.following?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user?._id, type: 'following' }) },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View className="w-[1px] h-8 self-center bg-card/10" />}
              <Pressable className="items-center flex-1" onPress={s.onPress}>
                <Text className="text-xl font-display text-paper">{s.value}</Text>
                <Text className="text-ink-3 text-label font-display uppercase mt-1">{s.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Subscription Status Bar */}
        {subscription?.status === 'active' && (
          <View className="w-full mt-4 bg-paper-2 border border-line px-5 py-3 flex-row items-center justify-between rounded-md">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-brand-500 rounded-xl items-center justify-center mr-3">
                <Ionicons name="flash" size={16} color={C.onBrand} />
              </View>
              <View>
                <Text className="text-brand-900 font-display text-label uppercase">
                  {subscription.isLifetime ? "Lifetime Access" : "Premium Member"}
                </Text>
                <Text className="text-accent-text font-semibold text-label mt-0.5">
                  {subscription.isLifetime ? "Infinite Protocol Active" : `${subscription.daysRemaining} Days remaining`}
                </Text>
              </View>
            </View>
            {!subscription.isLifetime && isFeatureOn('fyncProPaid') && (
              <Pressable 
                onPress={() => navigation.navigate('SubscriptionScreen')}
                className="bg-card border border-line px-2.5 py-1 rounded-full"
              >
                <Text className="text-accent-text font-display text-label uppercase">Extend</Text>
              </Pressable>
            )}
          </View>
        )}

        {subscription?.status === 'expired' && isFeatureOn('fyncProPaid') && (
          <Pressable 
            onPress={() => navigation.navigate('SubscriptionScreen')}
            className="w-full mt-4 bg-paper-2 border border-line px-5 py-3 flex-row items-center justify-between rounded-md"
          >
             <View className="flex-row items-center">
              <View className="w-8 h-8 bg-brand-500 rounded-xl items-center justify-center mr-3">
                <Ionicons name="alert-circle" size={18} color={C.onBrand} />
              </View>
              <View>
                <Text className="text-brand-900 font-display text-label uppercase">Plan Expired</Text>
                <Text className="text-accent-text font-semibold text-label mt-0.5">Renew to unlock all features</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={16} color={C.brand[500]} />
          </Pressable>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-4 mt-6 w-full">
          <Pressable onPress={() => navigation.navigate('EditProfile')}
            className="flex-1 bg-paper border-2 border-line py-4 items-center shadow-hair rounded-md">
            <Text className="font-semibold text-base text-ink">Edit Profile</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
            className="flex-1 bg-brand-500 py-4 rounded-card items-center shadow-hair">
            <Text className="text-on-brand font-display uppercase text-sm">Portfolio</Text>
          </Pressable>
        </View>

        <ProfileStrength user={user} />
      </View>
    </View>
  );

  // ── Tab Bar ────────────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View className="flex-row bg-card border-t border-line py-2 px-4 shadow-hair">
      {[
        { key: 'posts', icon: 'grid-outline', activeIcon: 'grid' },
        { key: 'shorts', icon: 'play-circle-outline', activeIcon: 'play-circle' },
        { key: 'reposts', icon: 'repeat-outline', activeIcon: 'repeat' },
        { key: 'about', icon: 'person-outline', activeIcon: 'person' },
      ].map((t, i) => {
        const isActive = activeTab === t.key;
        return (
          <Pressable key={t.key} onPress={() => setActiveTab(t.key as any)} className="flex-1 items-center py-2 relative">
            <View className={`w-14 h-10 rounded-card items-center justify-center ${isActive ? 'bg-paper-2' : 'bg-transparent'}`}>
              <Ionicons name={(isActive ? t.activeIcon : t.icon) as any} size={24}
                color={isActive ? C.brand[500] : C.ink4} />
            </View>
            {isActive && <View className="absolute bottom-[-4px] w-1 h-1 bg-brand-500 rounded-full" />}
          </Pressable>
        );
      })}
    </View>
  );

  // ── Grid item ─────────────────────────────────────────────────────────
  // Read through a ref so renderGridItem stays stable; the delete handlers are
  // recreated every render (they close over the list for rollback).
  const deleteRef = useRef({ deletePost, deleteShort });
  deleteRef.current = { deletePost, deleteShort };

  const renderGridItem = useCallback(({ item, isShort, canDelete = true }: { item: any; isShort?: boolean; canDelete?: boolean }) => (
    <Pressable
      onPress={() => navigation.navigate('IndividualPostOrShort', isShort ? { shortId: item._id } : { postId: item._id })}
      onLongPress={canDelete ? () => Alert.alert(
        isShort ? 'Delete Short' : 'Delete Post', 'Are you sure?',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => isShort ? deleteRef.current.deleteShort(item._id) : deleteRef.current.deletePost(item._id) }]
      ) : undefined}
      className="m-[1px] rounded-lg overflow-hidden"
      style={{ width: (width / 3) - 2, height: isShort ? (width / 1.8) : (width / 3) }}>
      {isShort ? (
        <View className="w-full h-full bg-paper-2 overflow-hidden">
          {/* A still, not a decoder. Mounting <Video> per cell meant a dozen
              hardware decoders on one screen. Shorts uploaded before the
              thumbnail field existed still fall back to the video. */}
          {item.thumbnail ? (
            <ExpoImage source={{ uri: getFullUrl(item.thumbnail) || '' }} style={{ width: '100%', height: '100%' }}
              contentFit="cover" cachePolicy="disk" transition={120} />
          ) : (
            <Video source={{ uri: getFullUrl(item.video) || '' }} style={{ width: '100%', height: '100%' }}
              resizeMode={ResizeMode.COVER} shouldPlay={false} positionMillis={100} />
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} className="absolute inset-0" />
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1.5">
            <Ionicons name="play" size={12} color="white" />
            <Text className="text-white text-label font-display">{item.views || 0}</Text>
          </View>
        </View>
      ) : item.image?.length > 0 ? (
        <GridImage path={item.image[0]} />
      ) : (
        <View className="w-full h-full bg-paper-2 items-center justify-center p-3">
          <Text className="text-accent-text text-label font-semibold text-center" numberOfLines={4}>{item.title || item.description}</Text>
        </View>
      )}
      {!isShort && item.image?.length > 1 && (
        <View className="absolute top-2 right-2 bg-black/40 px-1.5 py-1 rounded-lg backdrop-blur-md">
          <Ionicons name="layers" size={10} color="white" />
        </View>
      )}
    </Pressable>
  ), [navigation]);

  /** Inline, this was rebuilt on every parent render and took the whole grid
   *  with it. */
  const renderTabItem = useCallback(({ item }: { item: any }) => {
    if (activeTab === 'about') return <AboutSection user={user} isOwner onRefresh={onRefresh} />;
    if (activeTab === 'posts') return renderGridItem({ item, isShort: false });
    if (activeTab === 'shorts') return renderGridItem({ item, isShort: true });
    if (activeTab === 'reposts') return renderGridItem({ item, isShort: false, canDelete: false });
    return null;
  }, [activeTab, user, renderGridItem]);

  return (
    // Plain View: tabBarClearance already includes the bottom inset, and a
    // bottom SafeAreaView counted it a second time.
    <View className="flex-1 bg-paper">
      <StatusBar style={C.statusStyle} />
      <AppBar title="Profile" />
      {/* key={activeTab} forces a remount when the column count changes,
          which both list implementations require. */}
      <FlashList keyboardShouldPersistTaps="handled"
        key={activeTab}
        {...autoHideTabBar}
        data={activeTab === 'posts' ? posts : activeTab === 'shorts' ? shorts : activeTab === 'reposts' ? reposts : (['ABOUT'] as any)}
        keyExtractor={(item, i) => (typeof item === 'string' ? item : item._id ?? String(i))}
        numColumns={activeTab === 'about' ? 1 : 3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.recruiter} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={<>{renderProfileInfo()}{renderTabBar()}</>}
        renderItem={renderTabItem}
        ListFooterComponent={isLoadingMore ? <View className="py-4"><ActivityIndicator size="small" color={C.recruiter} /></View> : null}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="images-outline" size={48} color={C.ink4} />
            <Text className="text-ink-3 mt-4 font-medium">No content here yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      />
    </View>
  );
}

export default Profile;
