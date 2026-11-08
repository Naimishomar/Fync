import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import AvatarZoom from './ui/AvatarZoom';
import { ProfileSkeleton, GridSkeleton } from './Skeleton';
import { Image as ExpoImage } from 'expo-image';
import GitHubStatsCard from './profile/GitHubStatsCard';
import { C } from '../constants/colors';
import { AppBar, Button, Card, Empty, IconBtn, IconTile, ListRow, Tag, TagRow } from './ui/kit';
import { ProgressiveImage } from './ui/ProgressiveImage';
import { ActivityCalendar } from './profile-shared/ActivityCalendar';
import { ProfileHero, GeneratedBanner, StatsCard, ProfileTabs, GridCell, ProfileSection, type ProfileTab, AnimatedFlashList, useProfileScroll, CompactProfileBar } from './profile-shared/ProfileHeader';
import Reanimated from 'react-native-reanimated';
import { usePop } from './ui/motion';
import { Alert } from './ui/AlertModal';
import { confirmBlock, report } from '../utils/safety';
import { tapHaptic } from '../utils/haptics';
import Toast from 'react-native-toast-message';

const PUBLIC_TABS: ProfileTab<'posts' | 'shorts' | 'tags'>[] = [
    { key: 'posts', icon: 'grid-outline', activeIcon: 'grid', label: 'Posts' },
    { key: 'shorts', icon: 'videocam-outline', activeIcon: 'videocam', label: 'Shorts' },
    { key: 'tags', icon: 'person-outline', activeIcon: 'person', label: 'About' },
];
interface User {
    _id: string;
    username: string;
    name: string;
    avatar?: string;
    user_access?: 'admin' | 'user' | 'alumni' | 'recruiter';
    followers: string[];
    following: string[];
    about?: string;
    college?: string;
    experience?: string;
    skills?: string[];
    hobbies?: string;
    interest?: string;
    github_id?: string;
    linkedIn_id?: string;
    codingProfiles?: {
        leetcode?: string;
        gfg?: string;
    };
}

interface Post {
    _id: string;
    image: string[];
    description: string;
}

interface Short {
    _id: string;
    video: string;
    title: string;
    description?: string;
}

type RootStackParamList = {
    PublicProfile: { user?: User; userId?: string };
    FollowersAndFollowing: { userId: string; type: string };
    Profile: undefined;
};

const PublicProfile = () => {
    const { user: currentUser } = useAuth();
    const route = useRoute<RouteProp<RootStackParamList, 'PublicProfile'>>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { y: scrollY, onScroll } = useProfileScroll();
    const [followPopStyle, popFollow] = usePop(1.06);

    const targetUserId = route.params?.userId || route.params?.user?._id;
    const initialUser = route.params?.user;

    const [profileUser, setProfileUser] = useState<User | null>(initialUser || null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [shorts, setShorts] = useState<Short[]>([]);
    const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'tags'>('posts');
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);


    // --- 1. REDIRECT IF OWN PROFILE ---
    useEffect(() => {
        if (currentUser?._id && profileUser?._id) {
            if (currentUser._id === profileUser._id) {
                // "Profile" is a tab, not a root stack screen, so replace() was
                // unhandled and left the user on their own public profile.
                navigation.popTo('Tabs', currentUser.user_access === 'recruiter'
                    ? { screen: 'Profile' }
                    : { screen: 'TabNavigator', params: { screen: 'Profile' } });
            }
        }
    }, [currentUser, profileUser]);

    // --- 2. CHECK FOLLOW STATUS ---
    useEffect(() => {
        if (!currentUser?._id || !profileUser) return;
        setIsFollowing(profileUser.followers?.includes(currentUser._id) || false);
    }, [currentUser, profileUser]);

    // The endpoint pages by cursor, not by page number — passing `page` to it
    // returned the same first twelve posts forever, so scrolling never grew
    // the grid.
    const postsCursor = useRef<string | null>(null);
    const [postsPage, setPostsPage] = useState(1);
    const [shortsPage, setShortsPage] = useState(1);
    // How many posts they have, not how many are loaded into the grid.
    const [postCount, setPostCount] = useState<number | null>(null);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [hasMoreShorts, setHasMoreShorts] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    // Responses for a profile we've since navigated away from must not land here.
    const targetRef = useRef(targetUserId);
    targetRef.current = targetUserId;
    const followBusy = useRef(false);

    useEffect(() => {
        if (targetUserId) {
            // Always reset loading and content when switching to a different user
            // to show a fresh state and ensure re-fetch.
            setLoading(true);
            setPosts([]);
            setShorts([]);
            setPostsPage(1);
            postsCursor.current = null;
            setShortsPage(1);
            setHasMorePosts(true);
            setHasMoreShorts(true);

            // Immediately update the profile info if available in params
            setProfileUser(initialUser || null);

            fetchFullProfile(targetUserId);
            fetchUserPosts(targetUserId, 1, true);
            fetchUserShorts(targetUserId, 1, true);
        } else {
            setLoading(false);
        }
    }, [targetUserId]);

    const fetchFullProfile = async (uid: string) => {
        try {
            const res = await axios.get(`/user/profile/${uid}`);
            if (uid !== targetRef.current) return;
            if (res.data.success) {
                setProfileUser(res.data.user);
            }
        } catch (error) {
            console.log("Error fetching profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUserPosts = async (uid: string, page = 1, isInitial = false) => {
        try {
            setIsFetchingMore(true);
            const cursor = page > 1 ? postsCursor.current : null;
            const res = await axios.get(`/post/feed/${uid}?limit=12${cursor ? `&cursor=${cursor}` : ''}`);
            if (uid !== targetRef.current) return;
            if (res.data.success) {
                const newPosts = res.data.posts || [];
                postsCursor.current = res.data.nextCursor ?? null;
                setPosts(prev => {
                    if (isInitial) return newPosts;
                    const existingIds = new Set(prev.map(p => p._id));
                    const filteredNew = newPosts.filter((p: any) => !existingIds.has(p._id));
                    return [...prev, ...filteredNew];
                });
                setHasMorePosts(res.data.hasMore === true);
                setPostsPage(page);
                if (typeof res.data.total === 'number') setPostCount(res.data.total);
            }
        } catch (error) {
            console.log("Error fetching posts:", error);
        } finally {
            setIsFetchingMore(false);
            if (!profileUser) setLoading(false); // Safety fallback
        }
    };

    const fetchUserShorts = async (uid: string, page = 1, isInitial = false) => {
        try {
            setIsFetchingMore(true); // Set to true for all fetches
            const res = await axios.get(`/shorts/feed/${uid}?page=${page}&limit=12`);
            if (uid !== targetRef.current) return;
            if (res.data.success) {
                const newShorts = res.data.shorts || [];
                setShorts(prev => {
                    if (isInitial) return newShorts;
                    // Filter out any shorts that already exist in the list to avoid duplicate keys
                    const existingIds = new Set(prev.map(s => s._id));
                    const filteredNew = newShorts.filter((s: any) => !existingIds.has(s._id));
                    return [...prev, ...filteredNew];
                });
                setHasMoreShorts(res.data.hasMore);
                setShortsPage(page);
            }
        } catch (error) {
            console.log("Error fetching shorts:", error);
        } finally {
            setIsFetchingMore(false);
        }
    };

    // onEndReached can fire twice before isFetchingMore re-renders.
    const loadMoreBusy = useRef(false);
    const handleLoadMore = () => {
        if (isFetchingMore || loadMoreBusy.current || !targetUserId) return;
        let req: Promise<void> | undefined;
        if (activeTab === 'posts' && hasMorePosts) {
            req = fetchUserPosts(targetUserId, postsPage + 1);
        } else if (activeTab === 'shorts' && hasMoreShorts) {
            req = fetchUserShorts(targetUserId, shortsPage + 1);
        }
        if (req) {
            loadMoreBusy.current = true;
            req.finally(() => { loadMoreBusy.current = false; });
        }
    };

    const handleFollowToggle = async () => {
        if (!profileUser?._id || !currentUser?._id || followBusy.current) return;
        followBusy.current = true;
        tapHaptic();
        popFollow();
        try {
            if (isFollowing) {
                await axios.post(`/user/unfollow/${profileUser._id}`);
                setIsFollowing(false);
                setProfileUser(prev => prev ? ({
                    ...prev,
                    followers: (prev.followers || []).filter(id => id !== currentUser._id)
                }) : null);
            } else {
                await axios.post(`/user/follow/${profileUser._id}`);
                setIsFollowing(true);
                setProfileUser(prev => prev ? ({
                    ...prev,
                    followers: [...(prev.followers || []), currentUser._id]
                }) : null);
            }
        } catch (error: any) {
            Toast.show({ type: 'error', text1: error?.response?.data?.message || "Couldn't update follow. Try again." });
        } finally {
            followBusy.current = false;
        }
    };

    // A double tap pushed Chat twice while the first request was in flight.
    const chatBusy = useRef(false);
    const startChat = async () => {
        if (!profileUser?._id || chatBusy.current) return;
        chatBusy.current = true;
        try {
            const res = await axios.post("/chat/start", { userId: profileUser._id });
            navigation.navigate("Chat", {
                conversationId: res.data.conversation._id,
                otherUser: profileUser
            });
        } catch (err: any) {
            console.log("Start chat error", err);
            if (err?.response?.status === 403) Alert.alert("Can't message", err.response.data?.message || "You can't message this user");
            else Toast.show({ type: 'error', text1: "Couldn't open chat. Try again." });
        } finally {
            chatBusy.current = false;
        }
    };

    // Block / Report. Never on our own profile (that redirects away anyway).
    const isOwnProfile = !!currentUser?._id && currentUser._id === profileUser?._id;
    const profileMenu = profileUser?._id && !isOwnProfile ? (
        <IconBtn
            name="ellipsis-vertical"
            overlay
            onPress={() => Alert.alert(profileUser.name || 'Options', undefined, [
                { text: 'Report user', onPress: () => report({ targetType: 'user', targetId: profileUser._id }) },
                { text: 'Block user', style: 'destructive', onPress: () => confirmBlock(profileUser._id, profileUser.name, () => navigation.goBack()) },
                { text: 'Cancel', style: 'cancel' },
            ])}
        />
    ) : undefined;

    const [recruiterStats, setRecruiterStats] = useState({ active: 0, total: 0 });
    const isRecruiter = profileUser?.user_access === 'recruiter';
    const recruiterId = isRecruiter ? profileUser?._id : undefined;
    useEffect(() => {
        if (!recruiterId) return;
        let cancelled = false;
        axios.get(`/opportunity/list?recruiterId=${recruiterId}`).then(res => {
            if (cancelled || !res.data.success) return;
            const recPosts = res.data.data || [];
            setRecruiterStats({
                active: recPosts.filter((p: any) => p.isActive !== false).length,
                total: recPosts.length
            });
        }).catch(() => { });
        return () => { cancelled = true; };
    }, [recruiterId]);

    // --- GRID ---
    const openItem = useCallback((item: any, isShort: boolean) => {
        navigation.navigate('IndividualPostOrShort', isShort ? { shortId: item._id } : { postId: item._id });
    }, [navigation]);

    /** Rebuilt inline on every render, this re-rendered the whole grid. */
    const renderTabItem = useCallback(({ item }: { item: any }) => {
        if (activeTab === 'tags') return renderAbout();
        return <GridCell item={item} isShort={activeTab === 'shorts'} onOpen={openItem} />;
        // renderAbout reads profileUser, so the About row must refresh with it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, openItem, profileUser]);

    // A plain render function, not a component: declared inside this one it was a
    // new component type each render and remounted every time.
    const renderAbout = () => {
        const cp = profileUser?.codingProfiles;
        const hasLinks = !!(profileUser?.github_id || profileUser?.linkedIn_id || cp?.leetcode || cp?.gfg);
        return (
            <View className="pt-2 pb-8">
                <ProfileSection title="About">
                    <Text className="text-ink-2 text-sm leading-[22px]">
                        {profileUser?.about || "This user prefers to stay mysterious."}
                    </Text>
                    {!!profileUser?.experience && (
                        <ListRow icon="briefcase-outline" title={profileUser.experience} subtitle="Experience" titleLines={3} style={{ marginTop: 8 }} />
                    )}
                </ProfileSection>

                {!!(profileUser?.skills?.length || profileUser?.hobbies || profileUser?.interest) && (
                    <ProfileSection title="Skills and interests">
                        <TagRow>
                            {profileUser?.skills?.map((skill, i) => <Tag key={i} label={skill} />)}
                            {!!profileUser?.interest && <Tag label={profileUser.interest} icon="sparkles-outline" />}
                            {!!profileUser?.hobbies && <Tag label={profileUser.hobbies} icon="heart-outline" />}
                        </TagRow>
                    </ProfileSection>
                )}

                {!!profileUser?.github_id && (
                    <View className="mt-3">
                        <GitHubStatsCard
                            username={(profileUser as any).githubUsername || profileUser.github_id.split('/').pop()}
                            stats={(profileUser as any).githubStats}
                            isOwner={false}
                        />
                    </View>
                )}

                {hasLinks && (
                    <ProfileSection title="Connect">
                        {!!profileUser?.github_id && (
                            <ListRow icon="logo-github" title="GitHub" right={<Ionicons name="open-outline" size={18} color={C.ink3} />}
                                onPress={() => Linking.openURL(profileUser.github_id!).catch(() => {})} />
                        )}
                        {!!profileUser?.linkedIn_id && (
                            <ListRow leading={<IconTile icon="logo-linkedin" color="#0077B5" />} title="LinkedIn"
                                right={<Ionicons name="open-outline" size={18} color={C.ink3} />}
                                onPress={() => Linking.openURL(profileUser.linkedIn_id!).catch(() => {})} />
                        )}
                        {!!cp?.leetcode && (
                            <ListRow
                                leading={<View className="w-10 h-10 rounded-full bg-paper-2 items-center justify-center">
                                    <ExpoImage source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} style={{ width: 20, height: 20 }} tintColor="#F5B700" cachePolicy="memory-disk" />
                                </View>}
                                title="LeetCode" right={<Ionicons name="open-outline" size={18} color={C.ink3} />}
                                onPress={() => Linking.openURL(`https://leetcode.com/${cp.leetcode}`).catch(() => {})} />
                        )}
                        {!!cp?.gfg && (
                            <ListRow
                                leading={<View className="w-10 h-10 rounded-full bg-paper-2 items-center justify-center">
                                    <ExpoImage source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} style={{ width: 20, height: 20 }} cachePolicy="memory-disk" />
                                </View>}
                                title="GeeksForGeeks" right={<Ionicons name="open-outline" size={18} color={C.ink3} />}
                                onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${cp.gfg}`).catch(() => {})} />
                        )}
                    </ProfileSection>
                )}
            </View>
        );
    };

    // --- RECRUITER PROFILE LAYOUT ---
    // Also a render function: as a nested component it remounted on every parent
    // render, refetching its stats and jumping the ScrollView back to the top.
    const renderRecruiterProfile = () => {
        const p = profileUser as any;
        return (
            <View className="flex-1 bg-paper">
            <View className="absolute left-0 right-0 top-0 z-20" pointerEvents="box-none">
                <AppBar overlay onBack={() => navigation.goBack()} right={profileMenu} />
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 bg-paper" showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
                <View className="h-48 w-full">
                    {p?.banner
                        ? <ProgressiveImage path={p.banner} style={{ width: '100%', height: '100%' }} />
                        : <GeneratedBanner seed={p?._id || p?.username || p?.name || ''} />}
                    <View className="absolute inset-0 bg-black/30" />
                </View>

                <View className="px-gutter -mt-12">
                    <View className="flex-row items-end justify-between">
                        <AvatarZoom avatar={profileUser?.avatar} className="p-1.5 bg-card rounded-full shadow-hair">
                            <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
                                <Avatar user={profileUser as any} size={100} />
                            </View>
                        </AvatarZoom>
                        <Button small title="Message" icon="chatbubble-ellipses-outline" onPress={startChat} style={{ marginBottom: 8 }} />
                    </View>

                    <View className="mt-4">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Text className="text-h1 font-display text-ink" style={{ flexShrink: 1 }} numberOfLines={2}>
                                {p?.company || profileUser?.name}
                            </Text>
                            <MaterialCommunityIcons name="check-decagram" size={22} color={C.recruiter} accessibilityLabel="Verified recruiter" />
                        </View>
                        <Text className="text-ink-3 font-medium text-sm mt-1">
                            {p?.industry || 'Corporate Partner'} · {p?.companySize || 'Growing Team'}
                        </Text>
                    </View>

                    <StatsCard items={[
                        { label: 'Active roles', value: recruiterStats.active },
                        { label: 'Total posts', value: recruiterStats.total },
                    ]} />

                    <Card padded style={{ marginTop: 12 }}>
                        <Text className="font-semibold text-base text-ink mb-2" accessibilityRole="header">About organization</Text>
                        <Text className="text-ink-2 text-sm leading-[22px]">
                            {profileUser?.about || "We're committed to finding the best talent and building the future of innovation."}
                        </Text>
                        <View className="mt-2">
                            <ListRow icon="location-outline" title={p?.college || 'India (Remote)'} subtitle="Headquarters" />
                            {!!p?.companyWebsite && (
                                <ListRow icon="globe-outline" title="Visit website" subtitle="Official website"
                                    right={<Ionicons name="open-outline" size={18} color={C.ink3} />}
                                    onPress={() => Linking.openURL(p.companyWebsite).catch(() => {})} />
                            )}
                        </View>
                    </Card>

                    <View className="flex-row mt-5" style={{ gap: 12 }}>
                        <Button variant="primary" icon="school-outline" title="Internships" style={{ flex: 1 }}
                            onPress={() => navigation.navigate('InternshipList', { recruiterId: profileUser?._id })} />
                        <Button icon="briefcase-outline" title="Jobs" style={{ flex: 1 }}
                            onPress={() => navigation.navigate('JobList', { recruiterId: profileUser?._id })} />
                    </View>
                </View>
            </ScrollView>
            </View>
        );
    };

    // Fetch failed with nothing from params to show: an endless skeleton with
    // no back button trapped the user here.
    if (!loading && !profileUser) {
        return (
            <View className="flex-1 bg-paper">
                <AppBar onBack={() => navigation.goBack()} />
                <View className="px-gutter mt-10">
                    <Empty
                        icon="cloud-offline-outline"
                        title="Couldn't load this profile"
                        action={targetUserId ? (
                            <Button
                                title="Try again"
                                onPress={() => {
                                    setLoading(true);
                                    fetchFullProfile(targetUserId);
                                    fetchUserPosts(targetUserId, 1, true);
                                    fetchUserShorts(targetUserId, 1, true);
                                }}
                            />
                        ) : undefined}
                    />
                </View>
            </View>
        );
    }

    if (loading || !profileUser) {
        return <ProfileSkeleton />;
    }

    // Switch between Recruiter and Student layouts
    if (profileUser.user_access === 'recruiter') {
        return renderRecruiterProfile();
    }

    return (
        <View className="flex-1 bg-paper">
            {/* Back Button Overlay */}
            <View className="absolute left-0 right-0 top-0 z-20" pointerEvents="box-none">
                <AppBar overlay onBack={() => navigation.goBack()} right={profileMenu} />
            </View>

            <CompactProfileBar user={profileUser} y={scrollY} inset={64} />

            <AnimatedFlashList keyboardShouldPersistTaps="handled"
                key={activeTab} // Reset list when tab changes
                onScroll={onScroll}
                scrollEventThrottle={16}
                data={activeTab === 'tags' ? ['ABOUT'] : activeTab === 'posts' ? posts : shorts}
                numColumns={activeTab === 'tags' ? 1 : 3}
                keyExtractor={(item) => typeof item === 'string' ? item : item._id}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <View>
                        <ProfileHero
                            user={profileUser}
                            banner={(profileUser as any)?.banner}
                            bio={profileUser?.about || "Ready to connect and collaborate"}
                            college={profileUser?.college}
                            scrollY={scrollY}
                        >
                            <StatsCard items={[
                                { label: 'Posts', value: postCount ?? posts.length },
                                { label: 'Followers', value: profileUser?.followers?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" }) },
                                { label: 'Following', value: profileUser?.following?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" }) },
                            ]} />

                            {currentUser?._id !== profileUser._id && (
                                <View className="flex-row mt-3 w-full" style={{ gap: 12 }}>
                                    <Reanimated.View style={[{ flex: 1 }, followPopStyle]}>
                                        <Button
                                            title={isFollowing ? "Following" : "Follow"}
                                            icon={isFollowing ? "checkmark" : "person-add-outline"}
                                            variant={isFollowing ? 'secondary' : 'primary'}
                                            block
                                            onPress={handleFollowToggle}
                                        />
                                    </Reanimated.View>
                                    <Button title="Message" icon="chatbubble-ellipses-outline" style={{ flex: 1 }} onPress={startChat} />
                                </View>
                            )}
                            <ActivityCalendar userId={profileUser._id} streak={(profileUser as any).streakCount} highest={(profileUser as any).highestStreak} />
                        </ProfileHero>

                        <ProfileTabs items={PUBLIC_TABS} value={activeTab} onChange={setActiveTab} />
                    </View>
                }
                renderItem={renderTabItem}
                ListFooterComponent={
                    isFetchingMore ? (
                        <View className="py-4">
                            <ActivityIndicator size="small" color={C.ink3} />
                        </View>
                    ) : null
                }
                ListEmptyComponent={isFetchingMore ? <GridSkeleton /> : (
                    <Empty icon={activeTab === 'shorts' ? "videocam-outline" : "images-outline"}
                        title={activeTab === 'shorts' ? "No shorts yet" : "No posts yet"}
                        hint={`${profileUser?.name?.split(' ')[0] || 'They'} hasn't shared anything here yet.`} />
                )}
                contentContainerStyle={{ paddingBottom: insets.bottom }}
            />
        </View>
    );
};

export default PublicProfile;
