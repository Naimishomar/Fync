import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Text, View, Pressable, Linking, ActivityIndicator, DeviceEventEmitter, Share } from 'react-native';
import { shareRecap, shareCard } from '../utils/shareCard';
import { ActionSheet } from './ui/Sheet';
import CodingProfilesModal from './profile/CodingProfilesModal';
import GitHubStatsCard from './profile/GitHubStatsCard';
import FyncProfileBuilder from './profile/FyncProfileBuilder';
import { profileLink } from './ui/ProfileQR';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { readCache, writeCache, userKey } from '../utils/screenCache';
import { batchGet, bodyOf } from '../utils/batchRequest';
import { prefetchPostImages } from '../utils/imageWarm';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import EducationCard, { EducationEntry } from './profile/EducationCard';
import { useTabBarClearance, useTabBarAutoHide } from '../constants/layout';
import { Alert } from './ui/AlertModal';

import { Button, Card, Empty, FormField, IconBtn, IconTile, ListRow, Sheet, Tag, TagRow } from './ui/kit';
import { ProfileHero, StatsCard, ProfileTabs, GridCell, ProfileSection, type ProfileTab, AnimatedFlashList, useProfileScroll, CompactProfileBar } from './profile-shared/ProfileHeader';
import { ActivityCalendar } from './profile-shared/ActivityCalendar';
import { profileAccent } from '../constants/profileAccents';
import { GridSkeleton } from './Skeleton';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colors';
import { isFeatureOn } from '../constants/features';
import { AnimatedCount } from './ui/motion';
import { LevelUpCelebration } from './ui-extra/Confetti';
import { LEVEL_ICON } from './ui-extra/ScoreRing';

import FyncRefreshControl from './ui/FyncRefreshControl';
// ─── Types ────────────────────────────────────────────────────────────────────
type UserType = {
  _id: string; name: string; username: string; avatar: string;
  user_access?: string; college?: string; interest?: string | string[];
  about?: string; experience?: string; skills?: string[];
  hobbies?: string | string[]; github_id?: string; linkedIn_id?: string;
  banner?: string; upiId?: string; resumeUrl?: string;
  codingProfiles?: { leetcode?: string; gfg?: string; codechef?: string };
  codingStats?: { leetcodeSolved?: number; leetcodeRating?: number; gfgSolved?: number; gfgRating?: number; codechefSolved?: number; codechefRating?: number; totalSolved?: number };
  followers?: any[]; following?: any[]; followersCount?: number; followingCount?: number;
  fyncScore?: number; fyncBadge?: string;
  education?: EducationEntry[];
  githubUsername?: string; githubStats?: any;
};

// ─── PROFILE STRENGTH ────────────────────────────────────────────────────────
// Only fields /user/profile already returns; projects live behind another API,
// so they are not counted here.
// 'coding' opens the handle sheet in place instead of navigating away.
const STRENGTH_ITEMS: { label: string; route: 'EditProfile' | 'FyncProfileBuilder' | 'coding'; tab?: string; done: (u: UserType) => boolean }[] = [
  { label: 'Add profile photo', route: 'EditProfile', done: u => !!u?.avatar },
  { label: 'Add a bio', route: 'EditProfile', done: u => !!u?.about?.trim() },
  { label: 'Link coding profiles', route: 'coding', done: u => Object.values((u as any)?.codingProfiles || {}).some(Boolean) },
  { label: 'Add skills', route: 'FyncProfileBuilder', done: u => !!u?.skills?.length },
  { label: 'Add education', route: 'FyncProfileBuilder', tab: 'experience', done: u => !!u?.education?.length },
  { label: 'Link GitHub', route: 'FyncProfileBuilder', done: u => !!(u?.githubUsername || u?.github_id) },
  { label: 'Upload resume', route: 'FyncProfileBuilder', done: u => !!u?.resumeUrl },
];

function ProfileStrength({ user, onLinkCoding }: { user: UserType; onLinkCoding: () => void }) {
  const navigation = useNavigation<any>();
  if (!user?._id) return null;
  const missing = STRENGTH_ITEMS.filter(i => !i.done(user));
  if (!missing.length) return null;
  const pct = Math.round(((STRENGTH_ITEMS.length - missing.length) / STRENGTH_ITEMS.length) * 100);
  const accent = profileAccent((user as any)?.accentColor);
  return (
    <View className="w-full mt-3 bg-card border border-line rounded-2xl p-4">
      <View className="flex-row items-center justify-between">
        <Text className="font-semibold text-sm text-ink">Profile strength</Text>
        <Text className="font-semibold text-sm" style={{ color: accent.text }}>{pct}%</Text>
      </View>
      <View
        className="h-2 bg-paper-2 rounded-full overflow-hidden mt-3"
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
      >
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accent.fill }} />
      </View>
      <View className="flex-row flex-wrap mt-3" style={{ gap: 8 }}>
        {missing.slice(0, 2).map(i => (
          <Pressable
            key={i.label}
            onPress={() => (i.route === 'coding' ? onLinkCoding() : navigation.navigate(i.route, i.tab ? { tab: i.tab } : undefined))}
            className="flex-row items-center bg-brand-50 border border-line px-3 rounded-full active:opacity-85"
            hitSlop={6}
            style={{ minHeight: 32 }}
            accessibilityRole="button"
            accessibilityLabel={i.label}
          >
            <Ionicons name="add" size={14} color={C.accentText} />
            <Text className="font-semibold text-xs text-accent-text ml-1" numberOfLines={1}>{i.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── FYNC SCORE MINI BADGE ────────────────────────────────────────────────────
// Ionicons names, not emoji — rendered through <Ionicons>, never as text.
const BADGE_ICON = LEVEL_ICON;

// ─── CODING STAT CARD ─────────────────────────────────────────────────────────
const CodingPlatformCard = ({ icon, name, color, username, solved, rating, profileUrl }: any) => {
  if (!username && !solved) return null;
  return (
    <Pressable
      onPress={() => username && Linking.openURL(profileUrl).catch(() => {})}
      disabled={!username}
      className="flex-1 rounded-2xl border border-line p-3 items-center bg-paper active:opacity-85"
      accessibilityRole={username ? 'link' : 'text'}
      accessibilityLabel={`${name}: ${solved || 0} solved${rating ? `, rating ${rating}` : ''}`}
    >
      <View className="w-11 h-11 rounded-full items-center justify-center mb-2 bg-paper-2">
        {typeof icon === 'string' && icon.startsWith('http')
          ? <ExpoImage source={{ uri: icon }} style={{ width: 24, height: 24 }} contentFit="contain" cachePolicy="memory-disk" />
          : <Ionicons name={icon} size={22} color={color} />}
      </View>
      <Text className="font-display text-xl text-ink leading-tight">{solved || 0}</Text>
      <Text className="font-medium text-xs text-ink-3">Solved</Text>
      {rating ? (
        <View className="bg-paper-2 mt-2 px-2.5 py-1 rounded-full">
          <Text className="font-semibold text-xs text-ink-2">{rating}</Text>
        </View>
      ) : null}
      <Text className="font-semibold text-xs text-ink mt-2 text-center">{name}</Text>
    </Pressable>
  );
};


// ─── CODING STATS SHEET ───────────────────────────────────────────────────────
const CODING_FIELDS = [
  { label: 'LeetCode problems solved', key: 'leetcodeSolved', ph: '250' },
  { label: 'LeetCode rating', key: 'leetcodeRating', ph: '1650' },
  { label: 'GFG problems solved', key: 'gfgSolved', ph: '300' },
  { label: 'GFG rating (score)', key: 'gfgRating', ph: '2100' },
  { label: 'CodeChef username', key: 'codechef', ph: 'my_handle', numeric: false },
  { label: 'CodeChef problems solved', key: 'codechefSolved', ph: '150' },
  { label: 'CodeChef rating', key: 'codechefRating', ph: '1400' },
];

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

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Update coding stats"
      subtitle="Self-reported. Enter your current stats from each platform."
      footer={<Button variant="primary" block title="Save" loading={saving} onPress={save} />}
    >
      <View style={{ gap: 16 }}>
        {CODING_FIELDS.map(f => (
          <FormField
            key={f.key}
            label={f.label}
            placeholder={f.ph}
            keyboardType={f.numeric === false ? 'default' : 'numeric'}
            autoCapitalize="none"
            value={form[f.key] || ''}
            onChangeText={v => setForm((p: any) => ({ ...p, [f.key]: v }))}
          />
        ))}
      </View>
    </Sheet>
  );
}

// ─── ABOUT TAB ────────────────────────────────────────────────────────────────
/** Owner-only placeholder for an empty About section: one tap to the editor. */
const AddRow = ({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    className="flex-row items-center p-3 rounded-xl border border-dashed border-line active:opacity-85"
    style={{ gap: 10, minHeight: 48 }}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <Ionicons name="add-circle-outline" size={20} color={C.accentText} />
    <View className="flex-1">
      <Text className="text-accent-text font-semibold text-sm">{label}</Text>
      <Text className="text-ink-3 text-xs mt-0.5">{hint}</Text>
    </View>
  </Pressable>
);
const asList = (v?: string | string[]) => (Array.isArray(v) ? v : [v]).filter(Boolean) as string[];

function AboutSection({ user, isOwner, onRefresh, onLinkCoding }: { user: UserType; isOwner: boolean; onRefresh: () => void; onLinkCoding?: () => void }) {
  const navigation = useNavigation<any>();
  const [showCodingModal, setShowCodingModal] = useState(false);

  const education = user?.education || [];
  const skills = user?.skills || [];
  const cs = user?.codingStats || {};
  const cp = user?.codingProfiles || {};
  const interests = asList(user?.interest);
  const hobbies = asList(user?.hobbies);

  const hasCoding = cp.leetcode || cp.gfg || cp.codechef || cs.leetcodeSolved || cs.gfgSolved;
  const score = user?.fyncScore ?? 0;

  return (
    // A row of the profile FlashList, which already scrolls and clears the tab bar.
    <View className="bg-paper pb-6">

      {/* ── Fync Score ─────────────────────────────────────────────────── */}
      {user?.fyncScore !== undefined && (
        <Pressable
          onPress={() => navigation.navigate('FyncProfileBuilder')}
          className="mx-gutter mt-5 active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel={`Fync score ${score}, level ${user.fyncBadge || 'Newcomer'}. Boost score`}
        >
          <Card padded>
            <Text className="font-semibold text-sm text-ink-3">Fync score</Text>
            <AnimatedCount value={score} format={String} style={{ fontFamily: 'SpaceGrotesk_700Bold', color: C.ink, fontSize: 52, lineHeight: 56, letterSpacing: -1.6, fontVariant: ['tabular-nums'] }} />
            <Text className="font-sans text-sm text-ink-2 mt-1">Level {user.fyncBadge || 'Newcomer'}</Text>

            <View className="h-2 bg-paper-2 rounded-full overflow-hidden mt-4">
              <View className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, Math.max(0, (score / 1000) * 100))}%` }} />
            </View>
            <View className="flex-row items-center justify-between mt-2">
              <Text className="font-medium text-xs text-ink-3">Next: 1000</Text>
              <Text className="font-semibold text-xs text-accent-text">+{Math.max(0, 1000 - score)} to go</Text>
            </View>

            {/* Looks like a primary button; the whole card is the tap target. */}
            <View className="mt-4 bg-brand-500 rounded-full items-center justify-center flex-row" style={{ minHeight: 48, gap: 8 }}>
              <Ionicons name={BADGE_ICON[user.fyncBadge || 'Newcomer']} size={16} color={C.onBrand} />
              <Text className="font-semibold text-on-brand" style={{ fontSize: 15 }}>Boost score</Text>
            </View>
          </Card>
        </Pressable>
      )}

      {/* ── About ──────────────────────────────────────────────────────── */}
      {/* Owners see an empty section with an add row instead of it vanishing. */}
      {!!(user?.about || isOwner) && (
        <ProfileSection title="About me">
          {user?.about
            ? <Text className="text-ink-2 text-sm leading-[22px]">{user.about}</Text>
            : <AddRow label="Add a bio" hint="A line about you, so people know who they're talking to" onPress={() => navigation.navigate('EditProfile')} />}
        </ProfileSection>
      )}

      {/* ── Skills ─────────────────────────────────────────────────────── */}
      {(skills.length > 0 || isOwner) && (
        <ProfileSection title="Skills and stack">
          {skills.length
            ? <TagRow>{skills.map((s, i) => <Tag key={i} label={s} />)}</TagRow>
            : <AddRow label="Add skills" hint="Recruiters and teammates search by these" onPress={() => navigation.navigate('FyncProfileBuilder')} />}
        </ProfileSection>
      )}

      {/* ── Interests & Hobbies ────────────────────────────────────────── */}
      {(interests.length > 0 || hobbies.length > 0 || isOwner) && (
        <ProfileSection title="Interests">
          {interests.length || hobbies.length ? (
            <TagRow>
              {interests.map((t, i) => <Tag key={`i${i}`} label={t} icon="sparkles-outline" />)}
              {hobbies.map((h, i) => <Tag key={`h${i}`} label={h} icon="heart-outline" />)}
            </TagRow>
          ) : (
            <AddRow label="Add interests" hint="Shows people what you're into" onPress={() => navigation.navigate('EditProfile')} />
          )}
        </ProfileSection>
      )}

      {/* ── Education ──────────────────────────────────────────────────── */}
      <View className="mx-gutter mt-6">
        <Text className="font-semibold text-base text-ink mb-3" accessibilityRole="header">Education</Text>
        {education.length === 0 ? (
          <Card>
            <Empty icon="school-outline" title="No education yet" hint="Highlight your academic journey here"
              action={isOwner ? <Button variant="primary" small title="Add education" onPress={() => navigation.navigate('FyncProfileBuilder', { tab: 'experience' })} /> : undefined} />
          </Card>
        ) : education.map(e => (
          <EducationCard key={e._id} item={e} isOwner={false} />
        ))}
      </View>

      {/* ── Coding Platforms ───────────────────────────────────────────── */}
      {!!(hasCoding || isOwner) && (
        <ProfileSection
          title="Coding stats"
          right={isOwner ? (
            <IconBtn name="pencil-outline" size={18} boxed onPress={onLinkCoding} accessibilityLabel="Edit coding profiles" />
          ) : undefined}
        >
          {isOwner && !hasCoding ? (
            <Empty icon="code-slash-outline" title="No coding profiles linked"
              hint="Add your LeetCode, GFG, Codeforces or CodeChef username. Stats and your coding streak fill in on their own."
              action={<Button variant="primary" small title="Link coding profiles" onPress={onLinkCoding} />} />
          ) : null}
          {cs.totalSolved ? (
            <View className="bg-paper-2 rounded-2xl px-4 py-3 mb-3 flex-row items-center justify-between">
              <View>
                <Text className="text-ink-3 font-medium text-xs">Total solved</Text>
                <Text className="text-ink font-display text-2xl">{cs.totalSolved}</Text>
              </View>
              <IconTile icon="trophy-outline" bg={C.card} />
            </View>
          ) : null}

          <View className="flex-row" style={{ gap: 8 }}>
            <CodingPlatformCard
              icon="https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0"
              name="LeetCode" color="#F89F1B"
              username={cp.leetcode} solved={cs.leetcodeSolved} rating={cs.leetcodeRating}
              profileUrl={`https://leetcode.com/${cp.leetcode}`}
            />
            <CodingPlatformCard
              icon="https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png"
              name="GFG" color={C.success}
              username={cp.gfg} solved={cs.gfgSolved} rating={cs.gfgRating}
              profileUrl={`https://www.geeksforgeeks.org/user/${cp.gfg}`}
            />
            <CodingPlatformCard
              icon="https://cdn.codechef.com/images/cc-logo.svg"
              name="CodeChef" color="#6F4E37"
              username={cp.codechef} solved={cs.codechefSolved} rating={cs.codechefRating}
              profileUrl={`https://www.codechef.com/users/${cp.codechef}`}
            />
          </View>
          {isOwner && hasCoding ? (
            <Button variant="ghost" small title="Enter solved counts manually" onPress={() => setShowCodingModal(true)} style={{ marginTop: 8, alignSelf: 'center' }} />
          ) : null}
        </ProfileSection>
      )}

      {/* ── GitHub ─────────────────────────────────────────────────────── */}
      {/* Was only on other people's profiles and inside Portfolio. Sync and
          disconnect stay in Portfolio; here it's view + connect. */}
      {isOwner && (
        <View className="mt-6">
          <GitHubStatsCard
            username={(user as any)?.githubUsername}
            stats={(user as any)?.githubStats}
            isOwner={!(user as any)?.githubUsername}
            onConnect={async () => {
              try {
                const res = await axios.get('/profile/github/connect');
                if (res.data.url) await Linking.openURL(res.data.url);
              } catch { Toast.show({ type: 'error', text1: 'Could not start GitHub connect' }); }
            }}
          />
        </View>
      )}

      {/* ── Social Links ───────────────────────────────────────────────── */}
      {!!(user?.github_id || user?.linkedIn_id || (isFeatureOn('creatorTips') && user?.upiId)) && (
        <ProfileSection title="Connected accounts">
          {!!user?.github_id && (
            <ListRow icon="logo-github" title="GitHub" subtitle="Developer"
              onPress={() => Linking.openURL(user.github_id!).catch(() => {})} />
          )}
          {!!user?.linkedIn_id && (
            <ListRow leading={<IconTile icon="logo-linkedin" color="#0077B5" />} title="LinkedIn" subtitle="Professional"
              onPress={() => Linking.openURL(user.linkedIn_id!).catch(() => {})} />
          )}
          {isFeatureOn('creatorTips') && !!user?.upiId && (
            <ListRow leading={<IconTile icon="wallet-outline" color={C.success} />} title={user.upiId} subtitle="Payments" />
          )}
        </ProfileSection>
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

type ProfileTabKey = 'posts' | 'shorts' | 'reposts' | 'about' | 'portfolio';
const PROFILE_TABS: ProfileTab<ProfileTabKey>[] = [
  { key: 'posts', icon: 'grid-outline', activeIcon: 'grid', label: 'Posts' },
  { key: 'shorts', icon: 'play-circle-outline', activeIcon: 'play-circle', label: 'Shorts' },
  { key: 'reposts', icon: 'repeat-outline', activeIcon: 'repeat', label: 'Reposts' },
  { key: 'about', icon: 'person-outline', activeIcon: 'person', label: 'About' },
  // Was a separate screen behind a button; one identity, one place.
  { key: 'portfolio', icon: 'briefcase-outline', activeIcon: 'briefcase', label: 'Portfolio' },
];

// ─── MAIN PROFILE COMPONENT ───────────────────────────────────────────────────
function Profile() {
  const tabBarClearance = useTabBarClearance();
  const autoHideTabBar = useTabBarAutoHide();
  const { user, logout, setUser } = useAuth();
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [reposts, setReposts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('posts');
  const [portfolioKey, setPortfolioKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [shortsPage, setShortsPage] = useState(1);
  // The header shows how many posts exist, not how many have been scrolled
  // into the grid — the first page is 12, which read as a cap.
  const [postCount, setPostCount] = useState<number | null>(null);
  const [linkCoding, setLinkCoding] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [codingKey, setCodingKey] = useState(0);
  const openLinkCoding = useCallback(() => setLinkCoding(true), []);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  // Until the first load answers, an empty grid means "loading", not "none".
  const [loaded, setLoaded] = useState(false);

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

    // Profile and subscription go through the axios read-through cache (their
    // own 1-2 min TTLs) instead of the batch, which always hit the server.
    // Pull-to-refresh still forces them fresh.
    const cached = (path: string) =>
      axios.get(path, replace ? { params: { noCache: true } } : undefined)
        .then((r) => ({ status: r.status, body: r.data }))
        .catch(() => undefined);
    const [results, subResult, meResult] = await Promise.all([
      batchGet({
        posts: '/post/posts?page=1&limit=12',
        shorts: '/shorts/your?page=1&limit=12',
        reposts: `/post/reposts/${user?._id}`,
      }),
      cached('/subscription/status'),
      cached('/user/profile'),
    ]);

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

    const subBody = bodyOf<any>(subResult);
    if (subBody?.success) setSubscription(subBody);

    const meBody = bodyOf<any>(meResult);
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
      loadProfileScreen()
        .catch(() => { lastLoadedAt.current = 0; })
        .finally(() => setLoaded(true));
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
    setPortfolioKey((k) => k + 1);
    lastLoadedAt.current = Date.now();
    await loadProfileScreen({ replace: true }).catch(() => {});
    setRefreshing(false);
  };

  // onEndReached can fire twice before isLoadingMore re-renders.
  const loadMoreBusy = useRef(false);
  const handleLoadMore = () => {
    if (isLoadingMore || loadMoreBusy.current) return;
    const req = activeTab === 'posts' && hasMorePosts ? getPosts(postsPage + 1)
      : activeTab === 'shorts' && hasMoreShorts ? getShorts(shortsPage + 1)
      : undefined;
    if (req) {
      loadMoreBusy.current = true;
      req.finally(() => { loadMoreBusy.current = false; });
    }
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
  const accentFill = profileAccent((user as any)?.accentColor).fill;
  const renderProfileInfo = () => (
    <ProfileHero user={user} banner={user?.banner} bio={user?.about} college={user?.college} scrollY={scrollY}>
      <StatsCard items={[
        { label: 'Posts', value: postCount ?? posts.length },
        { label: 'Followers', value: user?.followersCount ?? user?.followers?.length ?? 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user?._id, type: 'followers' }) },
        { label: 'Following', value: user?.followingCount ?? user?.following?.length ?? 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user?._id, type: 'following' }) },
      ]} />

      {/* Plan: a pill, not a card. It is status, not something to act on. */}
      {subscription?.status === 'active' && (
        <Pressable
          onPress={!subscription.isLifetime && isFeatureOn('fyncProPaid') ? () => navigation.navigate('SubscriptionScreen') : undefined}
          disabled={subscription.isLifetime || !isFeatureOn('fyncProPaid')}
          className="mt-3 flex-row items-center bg-paper-2 px-3 py-1.5 rounded-full active:opacity-85"
          style={{ gap: 6 }}
          accessibilityRole={subscription.isLifetime ? 'text' : 'button'}
          accessibilityLabel={subscription.isLifetime ? 'Fync Pro, lifetime' : `Fync Pro, ${subscription.daysRemaining} days left`}
        >
          <Ionicons name="flash" size={13} color={C.accentText} />
          <Text className="text-ink-2 text-xs font-semibold">
            {subscription.isLifetime ? 'Fync Pro · Lifetime' : `Fync Pro · ${subscription.daysRemaining} days left`}
          </Text>
        </Pressable>
      )}

      {subscription?.status === 'expired' && isFeatureOn('fyncProPaid') && (
        <Pressable
          onPress={() => navigation.navigate('SubscriptionScreen')}
          className="w-full mt-3 bg-card border border-line px-4 py-3 flex-row items-center rounded-2xl active:opacity-85"
          style={{ gap: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Plan expired. Renew to unlock all features"
        >
          <View className="w-9 h-9 bg-brand-500 rounded-full items-center justify-center">
            <Ionicons name="alert-circle" size={18} color={C.onBrand} />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-ink font-semibold text-sm">Plan expired</Text>
            <Text className="text-ink-3 text-xs mt-0.5">Renew to unlock all features</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={C.ink3} />
        </Pressable>
      )}

      {/* One primary action; everything shareable lives behind Share. Portfolio is a tab now. */}
      <View className="flex-row mt-3 w-full" style={{ gap: 12 }}>
        <Button title="Edit profile" icon="create-outline" variant="primary" style={{ flex: 1, backgroundColor: accentFill, borderColor: accentFill }} onPress={() => navigation.navigate('EditProfile')} />
        <Button title="Share" icon="share-social-outline" style={{ flex: 1 }} onPress={() => setShareOpen(true)} />
      </View>

      <ProfileStrength user={user} onLinkCoding={openLinkCoding} />
      <ActivityCalendar userId={user?._id} streak={(user as any)?.streakCount} highest={(user as any)?.highestStreak} refreshKey={`${postCount}:${codingKey}`} accent={(user as any)?.accentColor} onLinkCoding={openLinkCoding} />
    </ProfileHero>
  );

  // ── Grid item ─────────────────────────────────────────────────────────
  // Read through a ref so the cell callbacks stay stable; the delete handlers
  // are recreated every render (they close over the list for rollback).
  const deleteRef = useRef({ deletePost, deleteShort });
  deleteRef.current = { deletePost, deleteShort };

  const openItem = useCallback((item: any, isShort: boolean) => {
    navigation.navigate('IndividualPostOrShort', isShort ? { shortId: item._id } : { postId: item._id });
  }, [navigation]);

  const confirmDelete = useCallback((item: any, isShort: boolean) => Alert.alert(
    isShort ? 'Delete Short' : 'Delete Post', 'Are you sure?',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => isShort ? deleteRef.current.deleteShort(item._id) : deleteRef.current.deletePost(item._id) }]
  ), []);

  /** Inline, this was rebuilt on every parent render and took the whole grid
   *  with it. */
  const renderTabItem = useCallback(({ item }: { item: any }) => {
    if (activeTab === 'about') return <AboutSection user={user} isOwner onRefresh={onRefresh} onLinkCoding={openLinkCoding} />;
    if (activeTab === 'portfolio') return <FyncProfileBuilder embedded refreshKey={portfolioKey} />;
    if (activeTab === 'reposts') return <GridCell item={item} onOpen={openItem} />;
    return <GridCell item={item} isShort={activeTab === 'shorts'} onOpen={openItem} onLongPress={confirmDelete} />;
  }, [activeTab, user, openItem, confirmDelete, openLinkCoding, portfolioKey]);

  const insets = useSafeAreaInsets();
  const { y: scrollY, onScroll } = useProfileScroll(autoHideTabBar.onScroll);
  // key={activeTab} remounts the list at the top; the bar must follow.
  useEffect(() => { scrollY.value = 0; }, [activeTab, scrollY]);
  const [pastBanner, setPastBanner] = useState(false);
  useAnimatedReaction(() => scrollY.value > 220, (now, prev) => { if (now !== prev) runOnJS(setPastBanner)(now); });
  return (
    // Plain View: tabBarClearance already includes the bottom inset, and a
    // bottom SafeAreaView counted it a second time.
    <View className="flex-1 bg-paper">
      {/* Banner draws under a transparent status bar: light icons over it,
          theme icons once the compact bar covers it. */}
      <StatusBar style={pastBanner ? C.statusStyle : 'light'} />
      {/* key={activeTab} forces a remount when the column count changes,
          which both list implementations require. */}
      <CompactProfileBar user={user} y={scrollY} />
      {/* Settings lived only in the Home drawer; the profile is where people look for it. */}
      <View style={{ position: 'absolute', top: insets.top + 8, right: 12, zIndex: 20 }}>
        <IconBtn name="settings-outline" boxed onPress={() => navigation.navigate('SettingsScreen')} accessibilityLabel="Settings" />
      </View>
      <AnimatedFlashList keyboardShouldPersistTaps="handled"
        key={activeTab}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={activeTab === 'posts' ? posts : activeTab === 'shorts' ? shorts : activeTab === 'reposts' ? reposts : activeTab === 'portfolio' ? (['PORTFOLIO'] as any) : (['ABOUT'] as any)}
        keyExtractor={(item, i) => (typeof item === 'string' ? item : item._id ?? String(i))}
        numColumns={activeTab === 'about' || activeTab === 'portfolio' ? 1 : 3}
        refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={<>{renderProfileInfo()}<ProfileTabs items={PROFILE_TABS} value={activeTab} onChange={setActiveTab} accent={(user as any)?.accentColor} /></>}
        renderItem={renderTabItem}
        ListFooterComponent={isLoadingMore ? <View className="py-4"><ActivityIndicator size="small" color={C.ink3} /></View> : null}
        ListEmptyComponent={!loaded ? <GridSkeleton /> : activeTab === 'posts' ? (
          <Empty icon="images-outline" title="No posts yet" hint="Share your first photo or update."
            action={<Button variant="primary" title="Create post" onPress={() => navigation.navigate('CreatePost')} />} />
        ) : activeTab === 'shorts' ? (
          <Empty icon="videocam-outline" title="No shorts yet" hint="Post a quick video for your campus."
            action={<Button variant="primary" title="Create short" onPress={() => navigation.navigate('CreateShorts')} />} />
        ) : (
          <Empty icon="images-outline" title="No reposts yet" hint="Posts you repost show up here." />
        )}
        contentContainerStyle={{ paddingBottom: tabBarClearance }}
      />
      <LevelUpCelebration userId={user?._id} level={user?.fyncBadge} />
      <ActionSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share"
        actions={user?._id ? [
          {
            label: 'Share my week', icon: 'stats-chart-outline' as const, hint: 'Story card: problems solved, streak, posts',
            onPress: () => shareRecap(user._id, () => Share.share({ message: `My week on Fync: ${profileLink(user._id)}` })),
          },
          {
            label: 'Share profile', icon: 'person-circle-outline' as const, hint: 'Card with your QR code',
            onPress: () => shareCard('u', user._id, 'Share your profile', () => Share.share({ message: `${user.name} on Fync: ${profileLink(user._id)}` })),
          },
          // AMA was only reachable from Explore; the inbox has the link + share.
          ...(isFeatureOn('ask') ? [{
            label: 'Ask me anything', icon: 'chatbubbles-outline' as const, hint: 'Get anonymous questions from your link',
            onPress: () => navigation.navigate('AskInbox'),
          }] : []),
        ] : []}
      />
      <CodingProfilesModal
        visible={linkCoding}
        initialData={(user as any)?.codingProfiles}
        onClose={() => setLinkCoding(false)}
        onSuccess={() => { setLinkCoding(false); setCodingKey((k) => k + 1); onRefresh(); }}
      />
    </View>
  );
}

export default Profile;
