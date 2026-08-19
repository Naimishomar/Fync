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
                    <View className="flex-1 bg-slate-900 justify-center items-center overflow-hidden">
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
                        <Text className="text-white text-2xs font-bold absolute bottom-1.5 left-2 truncate w-[90%] z-20 shadow-sm">
                            {item.title}
                        </Text>
                    </View>
                ) : (
                    <>
                        <Image
                            source={{ uri: getFullUrl(item.image?.[0]) || '' }}
                            className="flex-1 bg-slate-100"
                            resizeMode="cover"
                        />

                        {/* --- MULTIPLE IMAGES INDICATOR (ADDED) --- */}
                        {item.image && item.image.length > 1 && (
                            <View className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-full flex-row items-center gap-1">
                                <Ionicons name="copy-outline" size={10} color="white" />
                                <Text className="text-white text-2xs font-bold">{item.image.length}</Text>
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
            <View className="bg-white rounded-4xl p-6 border border-slate-100 mb-6 shadow-sm shadow-slate-200">
                <Text className="text-orange-500 text-xs font-black uppercase mb-3 tracking-wide">About</Text>
                <Text className="text-slate-600 text-sm font-medium leading-relaxed">
                    {profileUser?.about || "This user prefers to stay mysterious."}
                </Text>
            </View>

            {/* Details Grid */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                {profileUser?.experience && (
                    <View className="w-full bg-white p-5 rounded-4xl border border-slate-100 flex-row items-center shadow-sm shadow-slate-200">
                        <View className="bg-orange-50 p-3 rounded-2xl mr-4">
                            <Ionicons name="briefcase" size={24} color="#f97316" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-orange-500 text-2xs font-black uppercase tracking-wide mb-1">Experience</Text>
                            <Text className="text-slate-700 text-sm font-bold">{profileUser.experience}</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Tags Collection */}
            {(profileUser?.skills?.length || profileUser?.hobbies || profileUser?.interest) && (
                <View className="mb-6 bg-white p-6 rounded-4xl border border-slate-100 shadow-sm shadow-slate-200">
                    <Text className="text-slate-500 text-2xs font-black uppercase mb-4 tracking-wide">Tags & Interests</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {profileUser?.skills?.map((skill, i) => (
                            <View key={i} className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100">
                                <Text className="text-slate-600 text-2xs font-black uppercase tracking-tight">{skill}</Text>
                            </View>
                        ))}
                        {profileUser?.interest && (
                            <View className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">
                                <Text className="text-orange-600 text-2xs font-black uppercase tracking-tight">♥ {profileUser.interest}</Text>
                            </View>
                        )}
                        {profileUser?.hobbies && (
                            <View className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100">
                                <Text className="text-orange-600 text-2xs font-black uppercase tracking-tight">★ {profileUser.hobbies}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Social Links */}
            <Text className="text-slate-500 text-2xs font-black uppercase mb-4 tracking-wide ml-1">Connect</Text>
            
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
                    <Pressable onPress={() => Linking.openURL(profileUser.github_id!)} className="flex-row items-center bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Ionicons name="logo-github" size={24} color="#18181b" />
                        <Text className="text-slate-900 ml-4 font-black uppercase tracking-tight">GitHub</Text>
                        <Ionicons name="open-outline" size={18} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.linkedIn_id && (
                    <Pressable onPress={() => Linking.openURL(profileUser.linkedIn_id!)} className="flex-row items-center bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Ionicons name="logo-linkedin" size={24} color="#0077b5" />
                        <Text className="text-slate-900 ml-4 font-black uppercase tracking-tight">LinkedIn</Text>
                        <Ionicons name="open-outline" size={18} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.leetcode && (
                    <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${profileUser.codingProfiles?.leetcode}`)} className="flex-row items-center bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} className="w-6 h-6" style={{ tintColor: '#facc15' }} />
                        <Text className="text-slate-900 ml-4 font-black uppercase tracking-tight">LeetCode</Text>
                        <Ionicons name="open-outline" size={18} color="#94a3b8" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.gfg && (
                    <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${profileUser.codingProfiles?.gfg}`)} className="flex-row items-center bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} className="w-6 h-6" />
                        <Text className="text-slate-900 ml-4 font-black uppercase tracking-tight">GeeksForGeeks</Text>
                        <Ionicons name="open-outline" size={18} color="#94a3b8" style={{ marginLeft: 'auto' }} />
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
            <ScrollView className="flex-1 bg-slate-50" showsVerticalScrollIndicator={false}>
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
                        className="absolute top-12 left-4 bg-white/20 p-2 rounded-full"
                    >
                        <Ionicons name="chevron-back" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* Info Card Overlay */}
                <View className="px-5 -mt-12 pb-6">
                    <View className="flex-row items-end justify-between">
                        <View className="p-1.5 bg-white rounded-full shadow-xl">
                            <Avatar user={profileUser as any} size={100} />
                        </View>
                        <View className="flex-row gap-2 mb-2">
                            <TouchableOpacity onPress={startChat} className="bg-slate-900 px-6 py-2.5 rounded-2xl flex-row items-center gap-2">
                                <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
                                <Text className="text-white font-black uppercase text-2xs tracking-wide">Message</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="mt-4">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-2xl font-black text-slate-900  uppercase">
                                {(profileUser as any)?.company || profileUser?.name}
                            </Text>
                            <MaterialCommunityIcons name="check-decagram" size={22} color="#6366f1" />
                        </View>
                        <Text className="text-slate-500 font-bold text-xs uppercase tracking-wide mt-1">
                            {(profileUser as any)?.industry || 'Corporate Partner'} • {(profileUser as any)?.companySize || 'Growing Team'}
                        </Text>
                    </View>

                    {/* Quick Stats */}
                    <View className="flex-row bg-slate-900 rounded-3xl p-5 mt-6 shadow-xl border border-slate-800">
                        <View className="flex-1 items-center border-r border-slate-800">
                            <Text className="text-white text-xl font-black ">{recruiterStats.active}</Text>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Active Roles</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-white text-xl font-black ">{recruiterStats.total}</Text>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Total Posts</Text>
                        </View>
                    </View>

                    {/* About */}
                    <View className="mt-8 bg-white p-6 rounded-4xl border border-slate-100 shadow-sm">
                        <View className="flex-row items-center gap-2 mb-4">
                            <View className="w-1 h-5 rounded-full bg-indigo-500" />
                            <Text className="text-slate-900 font-black  uppercase text-xs tracking-wide">About Organization</Text>
                        </View>
                        <Text className="text-slate-500 text-xs leading-5 ">
                            {profileUser?.about || "We're committed to finding the best talent and building the future of innovation."}
                        </Text>

                        <View className="gap-4 mt-6">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                                    <Ionicons name="location-outline" size={20} color="#ef4444" />
                                </View>
                                <View>
                                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Headquarters</Text>
                                    <Text className="text-slate-900 font-bold text-sm tracking-tight">{(profileUser as any)?.college || 'India (Remote)'}</Text>
                                </View>
                            </View>
                            {(profileUser as any)?.companyWebsite && (
                                <TouchableOpacity
                                    onPress={() => Linking.openURL((profileUser as any).companyWebsite)}
                                    className="flex-row items-center gap-4"
                                >
                                    <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                                        <Ionicons name="globe-outline" size={20} color="#6366f1" />
                                    </View>
                                    <View>
                                        <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide">Official Website</Text>
                                        <Text className="text-indigo-600 font-bold text-sm tracking-tight underline">Visit Page</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* CTA Buttons */}
                    <View className="flex-row gap-3 mt-8">
                        <TouchableOpacity
                            onPress={() => navigation.navigate('InternshipList', { recruiterId: profileUser?._id })}
                            className="flex-1 bg-pink-600 p-4 rounded-2xl items-center shadow-lg shadow-pink-200"
                        >
                            <Ionicons name="school-outline" size={20} color="white" className="mb-1" />
                            <Text className="text-white font-black  uppercase text-2xs tracking-wide">View Internships</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('JobList', { recruiterId: profileUser?._id })}
                            className="flex-1 bg-slate-900 p-4 rounded-2xl items-center shadow-lg shadow-slate-200"
                        >
                            <Ionicons name="briefcase-outline" size={20} color="white" className="mb-1" />
                            <Text className="text-white font-black  uppercase text-2xs tracking-wide">View Job Openings</Text>
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
        <View className="flex-1 bg-slate-50">
            {/* Back Button Overlay */}
            <View className="absolute top-12 left-4 z-20">
                <Pressable onPress={() => navigation.goBack()} className="bg-black/30 p-2.5 rounded-full backdrop-blur-md">
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
                        <View className="items-center pb-6 px-5 bg-white rounded-t-5xl -mt-12 shadow-2xl">
                            <View className="-mt-14 p-1.5 bg-white rounded-full shadow-2xl">
                                <View className="rounded-full overflow-hidden border-4 border-white">
                                    <Avatar user={profileUser as any} size={110} />
                                </View>
                            </View>

                            {/* Name + username */}
                            <Text className="text-3xl font-black text-slate-900 tracking-tight mt-4">
                                {profileUser?.name || profileUser?.username}
                            </Text>
                            <Text className="text-orange-500 font-black text-sm tracking-widest mt-1">
                                @{profileUser?.username}
                            </Text>
                            
                            <Text className="text-slate-500 text-center mt-4 px-6 text-sm leading-[22px] font-medium">
                                {profileUser?.about || "Ready to connect and collaborate 🚀"}
                            </Text>

                            <View className="flex-row items-center mt-4 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100 gap-2">
                                <Ionicons name="location" size={16} color="#f97316" />
                                <Text className="text-slate-900 text-xs font-black uppercase tracking-wider">{profileUser?.college || 'Earth'}</Text>
                            </View>

                            {/* Stats Dashboard */}
                            <View className="flex-row w-full bg-slate-900 rounded-4xl mt-6 p-6 shadow-xl shadow-slate-300">
                                {[
                                    { label: 'Posts', value: posts.length },
                                    { label: 'Followers', value: profileUser?.followers?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" }) },
                                    { label: 'Following', value: profileUser?.following?.length || 0, onPress: () => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" }) },
                                ].map((s, i) => (
                                    <React.Fragment key={i}>
                                        {i > 0 && <View className="w-[1px] h-8 self-center bg-white/10" />}
                                        <Pressable className="items-center flex-1" onPress={s.onPress}>
                                            <Text className="text-xl font-black text-white">{s.value}</Text>
                                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">{s.label}</Text>
                                        </Pressable>
                                    </React.Fragment>
                                ))}
                            </View>

                            {/* Action Buttons */}
                            {currentUser?._id !== profileUser._id && (
                                <View className="flex-row gap-3 mt-6 w-full">
                                    <Pressable
                                        onPress={handleFollowToggle}
                                        className={`flex-1 py-4 rounded-3xl items-center justify-center border shadow-lg ${isFollowing ? 'bg-white border-slate-200 shadow-slate-200' : 'bg-orange-500 border-orange-500 shadow-orange-500/30'}`}
                                    >
                                        <Text className={`font-black uppercase tracking-widest text-xs ${isFollowing ? 'text-slate-500' : 'text-white'}`}>
                                            {isFollowing ? "Following" : "Follow"}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={startChat}
                                        className="flex-1 bg-slate-900 py-4 rounded-3xl items-center justify-center border border-slate-900 shadow-lg shadow-slate-900/30"
                                    >
                                        <Text className="text-white font-black uppercase tracking-wide text-xs">Message</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>

                        {/* Custom Tab Bar */}
                        <View className="flex-row border-b border-slate-100 bg-white">
                            <Pressable onPress={() => setActiveTab('posts')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'posts' ? 'border-b-[3px] border-orange-500' : ''}`}>
                                <Ionicons name="grid" size={22} color={activeTab === 'posts' ? '#f97316' : '#94a3b8'} />
                            </Pressable>
                            <Pressable onPress={() => setActiveTab('shorts')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'shorts' ? 'border-b-[3px] border-orange-500' : ''}`}>
                                <Ionicons name="videocam" size={24} color={activeTab === 'shorts' ? '#f97316' : '#94a3b8'} />
                            </Pressable>
                            <Pressable onPress={() => setActiveTab('tags')} className={`flex-1 items-center pb-4 pt-4 ${activeTab === 'tags' ? 'border-b-[3px] border-orange-500' : ''}`}>
                                <MaterialCommunityIcons name="account-details" size={26} color={activeTab === 'tags' ? '#f97316' : '#94a3b8'} />
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
                        <View className="py-4 bg-white">
                            <ActivityIndicator size="small" color="#f97316" />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    <View className="items-center mt-20 opacity-50 bg-slate-50">
                        <Ionicons name={activeTab === 'shorts' ? "videocam-off-outline" : "images-outline"} size={48} color="#cbd5e1" />
                        <Text className="text-slate-500 mt-2 font-bold uppercase tracking-wide text-2xs">Nothing to see here</Text>
                    </View>
                }
                className="bg-slate-50"
            />

            {/* Light Modal */}
            <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <BlurView intensity={90} tint="light" className="flex-1 justify-center items-center px-4">
                    <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setModalVisible(false)} />

                    {selectedItem && (
                        <View className="w-full bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-2xl">
                            <View className="w-full h-96 bg-slate-100 justify-center items-center relative">
                                {activeTab === 'shorts' ? (
                                    <View className="items-center">
                                        <Ionicons name="play-circle" size={64} color="#f97316" />
                                        <Text className="text-slate-500 mt-2 font-bold uppercase tracking-wide text-2xs">PREVIEW MODE</Text>
                                    </View>
                                ) : (
                                    <Image source={{ uri: getFullUrl(selectedItem.image ? selectedItem.image[0] : '') || '' }} className="w-full h-full" resizeMode="cover" />
                                )}
                                <Pressable onPress={() => setModalVisible(false)} className="absolute top-4 right-4 bg-white/80 p-2 rounded-full">
                                    <Ionicons name="close" size={20} color="#18181b" />
                                </Pressable>
                            </View>
                            <View className="p-5">
                                {activeTab === 'shorts' && <Text className="text-lg font-black text-slate-900 mb-2 uppercase">{selectedItem.title}</Text>}
                                <Text className="text-slate-500 font-medium leading-6">{selectedItem.description || "No caption."}</Text>
                            </View>
                        </View>
                    )}
                </BlurView>
            </Modal>
        </View>
    );
};

export default PublicProfile;
