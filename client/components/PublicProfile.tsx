import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Image, Pressable, ScrollView, Dimensions,
    ActivityIndicator, Modal, Linking, FlatList, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import { ProfileSkeleton } from './Skeleton';
import { Image as ExpoImage } from 'expo-image';
import { getFullUrl } from '../utils/imageUtils';
import GitHubStatsCard from './profile/GitHubStatsCard';

const { width } = Dimensions.get('window');

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

    const targetUserId = route.params?.userId || route.params?.user?._id;
    const initialUser = route.params?.user;

    const [profileUser, setProfileUser] = useState<User | null>(initialUser || null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [shorts, setShorts] = useState<Short[]>([]);
    const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'tags'>('posts');
    const [loading, setLoading] = useState(true);
    const [isFollowing, setIsFollowing] = useState(false);

    const [selectedItem, setSelectedItem] = useState<any>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // --- 1. REDIRECT IF OWN PROFILE ---
    useEffect(() => {
        if (currentUser?._id && profileUser?._id) {
            if (currentUser._id === profileUser._id) {
                navigation.replace("Profile");
            }
        }
    }, [currentUser, profileUser]);

    // --- 2. CHECK FOLLOW STATUS ---
    useEffect(() => {
        if (!currentUser?._id || !profileUser) return;
        setIsFollowing(profileUser.followers?.includes(currentUser._id) || false);
    }, [currentUser, profileUser]);

    const [postsPage, setPostsPage] = useState(1);
    const [shortsPage, setShortsPage] = useState(1);
    const [hasMorePosts, setHasMorePosts] = useState(true);
    const [hasMoreShorts, setHasMoreShorts] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);

    useEffect(() => {
        console.log("👤 [PublicProfile] Component Mounted/Updated with Params:", route.params);
        if (targetUserId) {
            console.log(`🚀 [PublicProfile] Initiating data fetch for UID: ${targetUserId}`);
            // Always reset loading and content when switching to a different user
            // to show a fresh state and ensure re-fetch.
            setLoading(true);
            setPosts([]);
            setShorts([]);
            setPostsPage(1);
            setShortsPage(1);
            setHasMorePosts(true);
            setHasMoreShorts(true);

            // Immediately update the profile info if available in params
            setProfileUser(initialUser || null);

            fetchFullProfile(targetUserId);
            fetchUserPosts(targetUserId, 1, true);
            fetchUserShorts(targetUserId, 1, true);
        } else {
            console.warn("⚠️ [PublicProfile] No targetUserId found in params!");
            setLoading(false);
        }
    }, [targetUserId]);

    const fetchFullProfile = async (uid: string) => {
        try {
            const res = await axios.get(`/user/profile/${uid}`);
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
            const res = await axios.get(`/post/feed/${uid}?page=${page}&limit=12`);
            if (res.data.success) {
                const newPosts = res.data.posts || [];
                setPosts(prev => {
                    if (isInitial) return newPosts;
                    const existingIds = new Set(prev.map(p => p._id));
                    const filteredNew = newPosts.filter((p: any) => !existingIds.has(p._id));
                    return [...prev, ...filteredNew];
                });
                setHasMorePosts(res.data.hasMore === true);
                setPostsPage(page);
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

    const handleLoadMore = () => {
        if (isFetchingMore || !targetUserId) return;
        if (activeTab === 'posts' && hasMorePosts) {
            fetchUserPosts(targetUserId, postsPage + 1);
        } else if (activeTab === 'shorts' && hasMoreShorts) {
            fetchUserShorts(targetUserId, shortsPage + 1);
        }
    };

    const handleFollowToggle = async () => {
        if (!profileUser?._id || !currentUser?._id) return;
        try {
            if (isFollowing) {
                await axios.post(`/user/unfollow/${profileUser._id}`);
                setIsFollowing(false);
                setProfileUser(prev => prev ? ({
                    ...prev,
                    followers: prev.followers.filter(id => id !== currentUser._id)
                }) : null);
            } else {
                await axios.post(`/user/follow/${profileUser._id}`);
                setIsFollowing(true);
                setProfileUser(prev => prev ? ({
                    ...prev,
                    followers: [...prev.followers, currentUser._id]
                }) : null);
            }
        } catch (error: any) {
            console.log("Follow error", error.message);
        }
    };

    const startChat = async () => {
        if (!profileUser?._id) return;
        try {
            const res = await axios.post("/chat/start", { userId: profileUser._id });
            navigation.navigate("Chat", {
                conversationId: res.data.conversation._id,
                otherUser: profileUser
            });
        } catch (err) {
            console.log("Start chat error", err);
        }
    };

    const openItem = (item: any) => {
        setSelectedItem(item);
        setModalVisible(true);
    };

    // --- GRID RENDERER ---
    const COLUMN_SIZE = width / 3;
    const renderGridItem = ({ item }: { item: any }) => {
        const isVideo = activeTab === 'shorts';
        return (
            <Pressable
                onPress={() => {
                    if (isVideo) {
                        navigation.navigate('IndividualPostOrShort', { shortId: item._id });
                    } else {
                        navigation.navigate('IndividualPostOrShort', { postId: item._id });
                    }
                }}
                className="relative border border-black/50"
                style={{ width: COLUMN_SIZE, height: isVideo ? COLUMN_SIZE * 1.5 : COLUMN_SIZE }}
            >
                {isVideo ? (
                    <View className="flex-1 bg-ink justify-center items-center overflow-hidden">
                        <Video
                            source={{ uri: getFullUrl(item.video) || '' }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={false}
                            positionMillis={100}
                        />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 w-full h-1/2 z-10" />
                        <View className="absolute inset-0 items-center justify-center">
                            <Ionicons name="play-outline" size={28} color="white" style={{ opacity: 0.8 }} />
                        </View>
                        <Text className="text-white text-label font-semibold absolute bottom-1.5 left-2 truncate w-[90%] z-20 shadow-hair">
                            {item.title}
                        </Text>
                    </View>
                ) : (
                    <>
                        <Image
                            source={{ uri: getFullUrl(item.image?.[0]) || '' }}
                            className="flex-1 bg-paper-2"
                            resizeMode="cover"
                        />

                        {/* --- MULTIPLE IMAGES INDICATOR (ADDED) --- */}
                        {item.image && item.image.length > 1 && (
                            <View className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-full flex-row items-center gap-1">
                                <Ionicons name="copy-outline" size={10} color="white" />
                                <Text className="text-white text-label font-semibold">{item.image.length}</Text>
                            </View>
                        )}
                    </>
                )}
            </Pressable>
        );
    };

    // --- ABOUT SECTION (Light Mode) ---
    const AboutSection = () => (
        <View className="px-5 py-6 pb-32">
            {/* About Card */}
            <View className="bg-card rounded-sheet p-6 border border-line mb-6 shadow-hair">
                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                  <Text className="text-accent-text text-xs font-display uppercase">About</Text>
                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                </View>
                <Text className="text-ink-2 text-sm font-medium leading-relaxed">
                    {profileUser?.about || "This user prefers to stay mysterious."}
                </Text>
            </View>

            {/* Details Grid */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                {profileUser?.experience && (
                    <View className="w-full bg-card p-5 rounded-sheet border border-line flex-row items-center shadow-hair">
                        <View className="bg-brand-50 p-3 rounded-card mr-4">
                            <Ionicons name="briefcase" size={24} color="#F97316" />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                              <Text className="text-accent-text text-label font-display uppercase">Experience</Text>
                              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                            </View>
                            <Text className="text-ink-2 text-sm font-semibold">{profileUser.experience}</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Tags Collection */}
            {(profileUser?.skills?.length || profileUser?.hobbies || profileUser?.interest) && (
                <View className="mb-6 bg-card p-6 rounded-sheet border border-line shadow-hair">
                    <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-display uppercase">Tags & Interests</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                        {profileUser?.skills?.map((skill, i) => (
                            <View key={i} className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                <Text className="text-ink-2 text-label font-display uppercase">{skill}</Text>
                            </View>
                        ))}
                        {profileUser?.interest && (
                            <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                <Text className="text-accent-text text-label font-display uppercase"> {profileUser.interest}</Text>
                            </View>
                        )}
                        {profileUser?.hobbies && (
                            <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                <Text className="text-accent-text text-label font-display uppercase"> {profileUser.hobbies}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Social Links */}
            <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
              <Text className="text-ink-3 text-label font-display uppercase">Connect</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            </View>
            
            {profileUser?.github_id && (
                <View className="-mx-5 mb-6">
                    <GitHubStatsCard 
                        username={ (profileUser as any).githubUsername || profileUser.github_id.split('/').pop() }
                        stats={ (profileUser as any).githubStats }
                        isOwner={false}
                    />
                </View>
            )}

            <View className="gap-3">
                {profileUser?.github_id && (
                    <Pressable onPress={() => Linking.openURL(profileUser.github_id!)} className="flex-row items-center bg-card px-5 py-4 rounded-card border border-line shadow-hair">
                        <Ionicons name="logo-github" size={24} color="#12100E" />
                        <Text className="text-ink ml-4 font-display uppercase">GitHub</Text>
                        <Ionicons name="open-outline" size={18} color="#8B857E" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.linkedIn_id && (
                    <Pressable onPress={() => Linking.openURL(profileUser.linkedIn_id!)} className="flex-row items-center bg-card px-5 py-4 rounded-card border border-line shadow-hair">
                        <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
                        <Text className="text-ink ml-4 font-display uppercase">LinkedIn</Text>
                        <Ionicons name="open-outline" size={18} color="#8B857E" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.leetcode && (
                    <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${profileUser.codingProfiles?.leetcode}`)} className="flex-row items-center bg-card px-5 py-4 rounded-card border border-line shadow-hair">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} className="w-6 h-6" style={{ tintColor: '#F5B700' }} />
                        <Text className="text-ink ml-4 font-display uppercase">LeetCode</Text>
                        <Ionicons name="open-outline" size={18} color="#8B857E" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.gfg && (
                    <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${profileUser.codingProfiles?.gfg}`)} className="flex-row items-center bg-card px-5 py-4 rounded-card border border-line shadow-hair">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} className="w-6 h-6" />
                        <Text className="text-ink ml-4 font-display uppercase">GeeksForGeeks</Text>
                        <Ionicons name="open-outline" size={18} color="#8B857E" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
            </View>
        </View>
    );

    // --- RECRUITER PROFILE LAYOUT ---
    const RecruiterProfileLayout = () => {
        const [recruiterStats, setRecruiterStats] = useState({ active: 0, total: 0 });

        useEffect(() => {
            if (profileUser?._id) {
                axios.get(`/opportunity/list?recruiterId=${profileUser._id}`).then(res => {
                    if (res.data.success) {
                        const recPosts = res.data.data;
                        setRecruiterStats({
                            active: recPosts.filter((p: any) => p.isActive !== false).length,
                            total: recPosts.length
                        });
                    }
                }).catch(() => { });
            }
        }, [profileUser]);

        return (
            <ScrollView className="flex-1 bg-paper" showsVerticalScrollIndicator={false}>
                {/* Banner & Actions */}
                <View className="h-48 w-full relative">
                    <ExpoImage
                        source={{ uri: getFullUrl((profileUser as any)?.banner) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000' }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                    />
                    <View className="absolute inset-0 bg-black/30" />
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        className="w-11 h-11 items-center justify-center rounded-xl top-12 left-4"
                    
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Info Card Overlay */}
                <View className="px-5 -mt-12 pb-6">
                    <View className="flex-row items-end justify-between">
                        <View className="p-1.5 bg-card rounded-full shadow-hair">
                            <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
                                <Avatar user={profileUser as any} size={100} />
                            </View>
                        </View>
                        <View className="flex-row gap-2 mb-2">
                            <TouchableOpacity onPress={startChat} className="bg-ink px-6 py-2.5 flex-row items-center gap-2 border-2 border-ink rounded-md">
                                <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
                                <Text className="text-white font-display uppercase text-label">Message</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="mt-4">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-2xl font-display text-ink uppercase">
                                {(profileUser as any)?.company || profileUser?.name}
                            </Text>
                            <MaterialCommunityIcons name="check-decagram" size={22} color="#4F46E5" />
                        </View>
                        <Text className="text-ink-3 font-semibold text-xs uppercase mt-1">
                            {(profileUser as any)?.industry || 'Corporate Partner'} • {(profileUser as any)?.companySize || 'Growing Team'}
                        </Text>
                    </View>

                    {/* Quick Stats */}
                    <View className="flex-row bg-ink rounded-card p-5 mt-6 shadow-hair border border-ink">
                        <View className="flex-1 items-center border-r border-ink">
                            <Text className="text-white text-xl font-display">{recruiterStats.active}</Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-1">Active Roles</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-white text-xl font-display">{recruiterStats.total}</Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-1">Total Posts</Text>
                        </View>
                    </View>

                    {/* About */}
                    <View className="mt-8 bg-card p-6 rounded-sheet border border-line shadow-hair">
                        <View className="flex-row items-center gap-2 mb-4">
                            <View className="w-1 h-5 rounded-full bg-recruiter" />
                            <Text className="font-semibold text-base text-ink">About Organization</Text>
                        </View>
                        <Text className="text-ink-3 text-xs leading-5">
                            {profileUser?.about || "We're committed to finding the best talent and building the future of innovation."}
                        </Text>

                        <View className="gap-4 mt-6">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center">
                                    <Ionicons name="location-outline" size={20} color="#DC2626" />
                                </View>
                                <View>
                                    <Text className="text-ink-3 text-label font-display uppercase">Headquarters</Text>
                                    <Text className="text-ink font-semibold text-sm">{(profileUser as any)?.college || 'India (Remote)'}</Text>
                                </View>
                            </View>
                            {(profileUser as any)?.companyWebsite && (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL((profileUser as any).companyWebsite)}
                                    className="flex-row items-center gap-4"
                                >
                                    <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center">
                                        <Ionicons name="globe-outline" size={20} color="#4F46E5" />
                                    </View>
                                    <View>
                                        <Text className="text-ink-3 text-label font-display uppercase">Official Website</Text>
                                        <Text className="text-recruiter font-semibold text-sm underline">Visit Page</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* CTA Buttons */}
                    <View className="flex-row gap-3 mt-8">
                        <TouchableOpacity
                            onPress={() => navigation.navigate('InternshipList', { recruiterId: profileUser?._id })}
                            className="flex-1 bg-brand-600 p-4 rounded-card items-center shadow-hair"
                        >
                            <Ionicons name="school-outline" size={20} color="white" className="mb-1" />
                            <Text className="text-white font-display uppercase text-label">View Internships</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('JobList', { recruiterId: profileUser?._id })}
                            className="flex-1 bg-ink p-4 rounded-card items-center shadow-hair"
                        >
                            <Ionicons name="briefcase-outline" size={20} color="white" className="mb-1" />
                            <Text className="text-white font-display uppercase text-label">View Job Openings</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View className="h-20" />
            </ScrollView>
        );
    };

    if (loading || !profileUser) {
        return <ProfileSkeleton />;
    }

    // Switch between Recruiter and Student layouts
    if (profileUser.user_access === 'recruiter') {
        return <RecruiterProfileLayout />;
    }

    return (
        <View className="flex-1 bg-paper">
            {/* Back Button Overlay */}
            <View className="absolute top-12 left-4 z-20">
                <Pressable onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl p-2.5 backdrop-blur-md"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </Pressable>
            </View>

            <FlatList
                key={activeTab} // Reset list when tab changes
                data={activeTab === 'tags' ? ['ABOUT'] : activeTab === 'posts' ? posts : shorts}
                numColumns={activeTab === 'tags' ? 1 : 3}
                keyExtractor={(item) => typeof item === 'string' ? item : item._id}
                showsVerticalScrollIndicator={false}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    <View>
                        {/* Banner Overlay */}
                        <View className="h-64 w-full relative">
                            <ExpoImage
                                source={{ uri: getFullUrl((profileUser as any)?.banner) || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000' }}
                                style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" 
                            />
                            <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.2)']} className="absolute inset-0" />
                        </View>

                        {/* Top Profile Card */}
                        <View className="items-center pb-6 px-5 bg-paper rounded-t-sheet -mt-12 shadow-hair">
                            <View className="-mt-14 p-1.5 bg-card rounded-full shadow-hair">
                                <View className="rounded-full overflow-hidden border-[3px] border-brand-500">
                                    <Avatar user={profileUser as any} size={110} />
                                </View>
                            </View>

                            {/* Name + username */}
                            <Text className="font-display text-ink mt-4 text-h1">
                                {profileUser?.name || profileUser?.username}
                            </Text>
                            <Text className="text-accent-text font-display text-sm mt-1">
                                @{profileUser?.username}
                            </Text>
                            
                            <Text className="text-ink-3 text-center mt-4 px-6 text-sm leading-[22px] font-medium">
                                {profileUser?.about || "Ready to connect and collaborate"}
                            </Text>

                            <View className="flex-row items-center mt-4 px-4 py-2 bg-paper-2 rounded-card border border-line gap-2">
                                <Ionicons name="location" size={16} color="#F97316" />
                                <Text className="font-semibold text-base text-ink">{profileUser?.college || 'Earth'}</Text>
                            </View>

                            {/* Stats Dashboard */}
                            <View className="flex-row w-full bg-ink rounded-sheet mt-6 p-6 shadow-hair">
                                {[
                                    { label: 'Posts', value: posts.length },
                                    { label: 'Followers', value: profileUser?.followers?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" }) },
                                    { label: 'Following', value: profileUser?.following?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" }) },
                                ].map((s, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <View className="w-[1px] h-8 self-center bg-card/10" />}
                                        <Pressable className="items-center flex-1" onPress={s.onPress}>
                                            <Text className="text-xl font-display text-white">{s.value}</Text>
                                            <Text className="text-ink-3 text-label font-display uppercase mt-1">{s.label}</Text>
                                        </Pressable>
                                    </React.Fragment>
                                ))}
                            </View>

                            {/* Action Buttons */}
                            {currentUser?._id !== profileUser._id && (
                                <View className="flex-row gap-3 mt-6 w-full">
                                    <Pressable
                                        onPress={handleFollowToggle}
                                        className={`flex-1 py-4 rounded-card items-center justify-center border shadow-hair ${isFollowing ? 'bg-card border-line ' : 'bg-brand-500 border-brand-500 '}`}
                                    >
                                        <Text className={`font-display uppercase text-sm ${isFollowing ? 'text-ink-3' : 'text-ink'}`}>
                                            {isFollowing ? "Following" : "Follow"}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={startChat}
                                        className="flex-1 bg-ink py-4 items-center justify-center border-2 border-ink rounded-md"
                                    >
                                        <Text className="text-white font-display uppercase text-xs">Message</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>

                        {/* Custom Tab Bar */}
                        <View className="flex-row border-b border-line bg-card">
                            <Pressable onPress={() => setActiveTab('posts')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'posts' ? 'border-b-[3px] border-brand-500' : ''}`}>
                                <Ionicons name="grid" size={22} color={activeTab === 'posts' ? '#F97316' : '#8B857E'} />
                            </Pressable>
                            <Pressable onPress={() => setActiveTab('shorts')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'shorts' ? 'border-b-[3px] border-brand-500' : ''}`}>
                                <Ionicons name="videocam" size={24} color={activeTab === 'shorts' ? '#F97316' : '#8B857E'} />
                            </Pressable>
                            <Pressable onPress={() => setActiveTab('tags')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'tags' ? 'border-b-[3px] border-brand-500' : ''}`}>
                                <MaterialCommunityIcons name="account-details" size={26} color={activeTab === 'tags' ? '#F97316' : '#8B857E'} />
                            </Pressable>
                        </View>
                    </View>
                }
                renderItem={({ item }: { item: any }) => {
                    if (activeTab === 'tags') return <AboutSection />;
                    return renderGridItem({ item });
                }}
                ListFooterComponent={
                    isFetchingMore ? (
                        <View className="py-4 bg-card">
                            <ActivityIndicator size="small" color="#F97316" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <View className="items-center mt-20 opacity-50 bg-paper-2">
                        <Ionicons name={activeTab === 'shorts' ? "videocam-off-outline" : "images-outline"} size={48} color="#C4BEB6" />
                        <Text className="text-ink-3 mt-2 font-semibold uppercase text-label">Nothing to see here</Text>
                    </View>
                }
                className="bg-paper-2"
            />

            {/* Light Modal */}
            <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <BlurView intensity={90} tint="light" className="flex-1 justify-center items-center px-4">
                    <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setModalVisible(false)} />

                    {selectedItem && (
                        <View className="w-full bg-card rounded-card overflow-hidden border border-line shadow-hair">
                            <View className="w-full h-96 bg-paper-2 justify-center items-center relative">
                                {activeTab === 'shorts' ? (
                                    <View className="items-center">
                                        <Ionicons name="play-circle" size={64} color="#F97316" />
                                        <Text className="text-ink-3 mt-2 font-semibold uppercase text-label">PREVIEW MODE</Text>
                                    </View>
                                ) : (
                                    <Image source={{ uri: getFullUrl(selectedItem.image ? selectedItem.image[0] : '') || '' }} className="w-full h-full" resizeMode="cover" />
                                )}
                                <Pressable onPress={() => setModalVisible(false)} className="absolute top-4 right-4 bg-card/80 p-2 rounded-full">
                                    <Ionicons name="close" size={20} color="#12100E" />
                                </Pressable>
                            </View>
                            <View className="p-5">
                                {activeTab === 'shorts' && <Text className="text-lg font-display text-ink mb-2 uppercase">{selectedItem.title}</Text>}
                                <Text className="text-ink-3 font-medium leading-6">{selectedItem.description || "No caption."}</Text>
                            </View>
                        </View>
                    )}
                </BlurView>
            </Modal>
        </View>
    );
};

export default PublicProfile;
