import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, Image, Pressable, ScrollView, Dimensions,
    ActivityIndicator, Modal, Linking, FlatList, TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { BlurView } from 'expo-blur';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import axios from "../context/axiosConfig";
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import { ProfileSkeleton } from './Skeleton';
import { Image as ExpoImage } from 'expo-image';

const { width } = Dimensions.get('window');

// --- TYPES ---
interface User {
    _id: string;
    username: string;
    name: string;
    avatar?: string;
    user_access?: 'admin' | 'user' | 'alumni'| 'recruiter';
    followers: string[];
    following: string[];
    about?: string;
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
            navigation.navigate("Chat", { conversationId: res.data.conversation._id });
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
                    <View className="flex-1 bg-gray-900 justify-center items-center overflow-hidden">
                        <Video
                            source={{ uri: item.video }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode={ResizeMode.COVER}
                            shouldPlay={false}
                            positionMillis={100}
                        />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} className="absolute bottom-0 w-full h-1/2 z-10" />
                        <View className="absolute inset-0 items-center justify-center">
                            <Ionicons name="play-outline" size={28} color="white" style={{ opacity: 0.8 }} />
                        </View>
                        <Text className="text-white text-[10px] font-bold absolute bottom-1.5 left-2 truncate w-[90%] z-20 shadow-sm">
                            {item.title}
                        </Text>
                    </View>
                ) : (
                    <>
                        <Image
                            source={{ uri: item.image?.[0] }}
                            className="flex-1 bg-gray-800"
                            resizeMode="cover"
                        />

                        {/* --- MULTIPLE IMAGES INDICATOR (ADDED) --- */}
                        {item.image && item.image.length > 1 && (
                            <View className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded-full flex-row items-center gap-1">
                                <Ionicons name="copy-outline" size={10} color="white" />
                                <Text className="text-white text-[10px] font-bold">{item.image.length}</Text>
                            </View>
                        )}
                    </>
                )}
            </Pressable>
        );
    };

    // --- ABOUT SECTION (Dark Mode) ---
    const AboutSection = () => (
        <View className="px-4 py-6 pb-32">
            {/* About Card */}
            <View className="bg-white/5 rounded-2xl p-5 border border-white/10 mb-6 shadow-sm">
                <Text className="text-pink-500 text-xs font-bold uppercase mb-2 tracking-widest">About</Text>
                <Text className="text-gray-300 text-base leading-relaxed">
                    {profileUser?.about || "This user prefers to stay mysterious."}
                </Text>
            </View>

            {/* Details Grid */}
            <View className="flex-row flex-wrap gap-4 mb-6">
                {profileUser?.experience && (
                    <View className="w-full bg-white/5 p-4 rounded-2xl border border-white/10 flex-row items-center">
                        <View className="bg-indigo-500/20 p-2 rounded-lg mr-3">
                            <Ionicons name="briefcase" size={20} color="#818cf8" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-indigo-400 text-xs font-bold uppercase tracking-wider">Experience</Text>
                            <Text className="text-gray-200 text-sm mt-0.5">{profileUser.experience}</Text>
                        </View>
                    </View>
                )}
            </View>

            {/* Tags Collection */}
            {(profileUser?.skills?.length || profileUser?.hobbies || profileUser?.interest) && (
                <View className="mb-6">
                    <Text className="text-gray-500 text-xs font-bold uppercase mb-3 tracking-wider ml-1">Tags & Interests</Text>
                    <View className="flex-row flex-wrap gap-2">
                        {profileUser?.skills?.map((skill, i) => (
                            <View key={i} className="bg-blue-500/10 px-3 py-1.5 rounded-lg border border-blue-500/30">
                                <Text className="text-blue-400 text-xs font-bold">{skill}</Text>
                            </View>
                        ))}
                        {profileUser?.interest && (
                            <View className="bg-pink-500/10 px-3 py-1.5 rounded-lg border border-pink-500/30">
                                <Text className="text-pink-400 text-xs font-bold">♥ {profileUser.interest}</Text>
                            </View>
                        )}
                        {profileUser?.hobbies && (
                            <View className="bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                                <Text className="text-emerald-400 text-xs font-bold">★ {profileUser.hobbies}</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            {/* Social Links */}
            <Text className="text-gray-500 text-xs font-bold uppercase mb-3 tracking-wider ml-1">Connect</Text>
            <View className="gap-3">
                {profileUser?.github_id && (
                    <Pressable onPress={() => Linking.openURL(profileUser.github_id!)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                        <Ionicons name="logo-github" size={22} color="white" />
                        <Text className="text-gray-200 ml-3 font-medium">GitHub</Text>
                        <Ionicons name="open-outline" size={16} color="gray" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.linkedIn_id && (
                    <Pressable onPress={() => Linking.openURL(profileUser.linkedIn_id!)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                        <Ionicons name="logo-linkedin" size={22} color="#0077b5" />
                        <Text className="text-gray-200 ml-3 font-medium">LinkedIn</Text>
                        <Ionicons name="open-outline" size={16} color="gray" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.leetcode && (
                    <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${profileUser.codingProfiles?.leetcode}`)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png" }} className="w-5 h-5" style={{ tintColor: '#facc15' }} />
                        <Text className="text-gray-200 ml-3 font-medium">LeetCode</Text>
                        <Ionicons name="open-outline" size={16} color="gray" style={{ marginLeft: 'auto' }} />
                    </Pressable>
                )}
                {profileUser?.codingProfiles?.gfg && (
                    <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${profileUser.codingProfiles?.gfg}`)} className="flex-row items-center bg-white/5 px-4 py-3 rounded-xl border border-white/10">
                        <Image source={{ uri: "https://upload.wikimedia.org/wikipedia/commons/4/43/GeeksforGeeks.svg" }} className="w-5 h-5" />
                        <Text className="text-gray-200 ml-3 font-medium">GeeksForGeeks</Text>
                        <Ionicons name="open-outline" size={16} color="gray" style={{ marginLeft: 'auto' }} />
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
                }).catch(() => {});
            }
        }, [profileUser]);

        return (
            <ScrollView className="flex-1 bg-slate-50" showsVerticalScrollIndicator={false}>
                {/* Banner & Actions */}
                <View className="h-48 w-full relative">
                    <ExpoImage
                        source={{ uri: (profileUser as any)?.banner || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000' }}
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
                            <TouchableOpacity onPress={startChat} className="bg-zinc-900 px-6 py-2.5 rounded-2xl flex-row items-center gap-2">
                                <Ionicons name="chatbubble-ellipses-outline" size={18} color="white" />
                                <Text className="text-white font-black uppercase text-[10px] tracking-widest">Message</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="mt-4">
                        <View className="flex-row items-center gap-2">
                            <Text className="text-2xl font-black text-zinc-900 italic uppercase">
                                {(profileUser as any)?.company || profileUser?.name}
                            </Text>
                            <MaterialCommunityIcons name="check-decagram" size={22} color="#6366f1" />
                        </View>
                        <Text className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                            {(profileUser as any)?.industry || 'Corporate Partner'} • {(profileUser as any)?.companySize || 'Growing Team'}
                        </Text>
                    </View>

                    {/* Quick Stats */}
                    <View className="flex-row bg-zinc-900 rounded-3xl p-5 mt-6 shadow-xl border border-zinc-800">
                        <View className="flex-1 items-center border-r border-zinc-800">
                            <Text className="text-white text-xl font-black italic">{recruiterStats.active}</Text>
                            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">Active Roles</Text>
                        </View>
                        <View className="flex-1 items-center">
                            <Text className="text-white text-xl font-black italic">{recruiterStats.total}</Text>
                            <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">Total Posts</Text>
                        </View>
                    </View>

                    {/* About */}
                    <View className="mt-8 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
                         <View className="flex-row items-center gap-2 mb-4">
                            <View className="w-1 h-5 rounded-full bg-indigo-500" />
                            <Text className="text-zinc-900 font-black italic uppercase text-xs tracking-widest">About Organization</Text>
                        </View>
                        <Text className="text-slate-500 text-xs leading-5 italic">
                            {profileUser?.about || "We're committed to finding the best talent and building the future of innovation."}
                        </Text>

                        <View className="gap-4 mt-6">
                            <View className="flex-row items-center gap-4">
                                <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                                    <Ionicons name="location-outline" size={20} color="#ef4444" />
                                </View>
                                <View>
                                    <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Headquarters</Text>
                                    <Text className="text-zinc-900 font-bold text-sm tracking-tight">{(profileUser as any)?.college || 'India (Remote)'}</Text>
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
                                        <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Official Website</Text>
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
                            <Text className="text-white font-black italic uppercase text-[10px] tracking-widest">View Internships</Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                            onPress={() => navigation.navigate('JobList', { recruiterId: profileUser?._id })}
                            className="flex-1 bg-zinc-900 p-4 rounded-2xl items-center shadow-lg shadow-zinc-200"
                        >
                            <Ionicons name="briefcase-outline" size={20} color="white" className="mb-1" />
                            <Text className="text-white font-black italic uppercase text-[10px] tracking-widest">View Job Openings</Text>
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
        <View className="flex-1 bg-black">
            <SafeAreaView className="flex-1">
                {/* Header */}
                <View className="flex-row items-center px-4 py-2 z-10">
                    <Pressable onPress={() => navigation.goBack()} className="bg-white/10 p-2 rounded-full border border-white/10">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </Pressable>
                    <View className="ml-4">
                        <Text className="text-white font-bold text-lg tracking-wide">{profileUser.username}</Text>
                        <Text className="text-gray-400 text-xs font-medium">{profileUser.name}</Text>
                    </View>
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
                        <>
                            {/* Top Profile Card */}
                            <View className="mx-4 mt-2 mb-6 bg-white/5 rounded-3xl p-5 border border-white/10 shadow-lg">
                                <View className="flex-row items-center">
                                    <Avatar 
                                        user={profileUser as any} 
                                        size={80} 
                                    />
                                    <View className="flex-1 ml-6 flex-row justify-between pr-4">
                                        <View className="items-center">
                                            <Text className="text-xl font-bold text-white">{posts.length}</Text>
                                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Posts</Text>
                                        </View>
                                        <Pressable onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "followers" })} className="items-center">
                                            <Text className="text-xl font-bold text-white">{profileUser.followers?.length || 0}</Text>
                                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Followers</Text>
                                        </Pressable>
                                        <Pressable onPress={() => navigation.navigate("FollowersAndFollowing", { userId: profileUser._id, type: "following" })} className="items-center">
                                            <Text className="text-xl font-bold text-white">{profileUser.following?.length || 0}</Text>
                                            <Text className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Following</Text>
                                        </Pressable>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                {currentUser?._id !== profileUser._id && (
                                    <View className="flex-row gap-3 mt-6">
                                        <Pressable
                                            onPress={handleFollowToggle}
                                            className={`flex-1 py-3 rounded-xl items-center justify-center border ${isFollowing ? 'bg-transparent border-gray-500' : 'bg-pink-600 border-pink-600'}`}
                                        >
                                            <Text className={`font-bold tracking-wide ${isFollowing ? 'text-gray-300' : 'text-white'}`}>
                                                {isFollowing ? "Following" : "Follow"}
                                            </Text>
                                        </Pressable>
                                        <Pressable
                                            onPress={startChat}
                                            className="flex-1 bg-white/10 py-3 rounded-xl items-center justify-center border border-white/10"
                                        >
                                            <Text className="text-white font-bold tracking-wide">Message</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>

                            {/* Custom Tab Bar */}
                            <View className="flex-row border-b border-white/10 mx-4 mb-2">
                                <Pressable onPress={() => setActiveTab('posts')} className={`flex-1 items-center pb-3 ${activeTab === 'posts' ? 'border-b-2 border-pink-500' : ''}`}>
                                    <Ionicons name="grid" size={22} color={activeTab === 'posts' ? '#ec4899' : '#666'} />
                                </Pressable>
                                <Pressable onPress={() => setActiveTab('shorts')} className={`flex-1 items-center pb-3 ${activeTab === 'shorts' ? 'border-b-2 border-pink-500' : ''}`}>
                                    <Ionicons name="videocam" size={24} color={activeTab === 'shorts' ? '#ec4899' : '#666'} />
                                </Pressable>
                                <Pressable onPress={() => setActiveTab('tags')} className={`flex-1 items-center pb-3 ${activeTab === 'tags' ? 'border-b-2 border-pink-500' : ''}`}>
                                    <MaterialCommunityIcons name="account-details" size={26} color={activeTab === 'tags' ? '#ec4899' : '#666'} />
                                </Pressable>
                            </View>
                        </>
                    }
                    renderItem={({ item }: { item: any }) => {
                        if (activeTab === 'tags') return <AboutSection />;
                        return renderGridItem({ item });
                    }}
                    ListFooterComponent={
                        isFetchingMore ? (
                            <View className="py-4">
                                <ActivityIndicator size="small" color="#ec4899" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        <View className="items-center mt-20 opacity-50">
                            <Ionicons name={activeTab === 'shorts' ? "videocam-off-outline" : "images-outline"} size={48} color="white" />
                            <Text className="text-gray-400 mt-2">Nothing to see here</Text>
                        </View>
                    }
                />

                {/* Dark Modal */}
                <Modal visible={modalVisible} transparent={true} animationType="fade" onRequestClose={() => setModalVisible(false)}>
                    <BlurView intensity={90} tint="dark" className="flex-1 justify-center items-center px-4">
                        <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setModalVisible(false)} />

                        {selectedItem && (
                            <View className="w-full bg-[#121212] rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
                                <View className="w-full h-96 bg-black justify-center items-center relative">
                                    {activeTab === 'shorts' ? (
                                        <View className="items-center">
                                            <Ionicons name="play-circle" size={64} color="#ec4899" />
                                            <Text className="text-gray-500 mt-2 text-xs">PREVIEW MODE</Text>
                                        </View>
                                    ) : (
                                        <Image source={{ uri: selectedItem.image ? selectedItem.image[0] : '' }} className="w-full h-full" resizeMode="contain" />
                                    )}
                                    <Pressable onPress={() => setModalVisible(false)} className="absolute top-4 right-4 bg-black/50 p-2 rounded-full">
                                        <Ionicons name="close" size={20} color="white" />
                                    </Pressable>
                                </View>
                                <View className="p-5">
                                    {activeTab === 'shorts' && <Text className="text-xl font-bold text-white mb-2">{selectedItem.title}</Text>}
                                    <Text className="text-gray-400 leading-6">{selectedItem.description || "No caption."}</Text>
                                </View>
                            </View>
                        )}
                    </BlurView>
                </Modal>

            </SafeAreaView>
        </View>
    );
};

export default PublicProfile;