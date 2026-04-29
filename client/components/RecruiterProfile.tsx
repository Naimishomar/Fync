import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    RefreshControl,
    Alert,
    Linking,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';

const { width } = Dimensions.get('window');

const RecruiterProfile = () => {
    const navigation = useNavigation<any>();
    const { user, logout, setUser } = useAuth();

    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState<'about' | 'activity'>('about');
    const [stats, setStats] = useState({
        totalPosts: 0,
        totalApplicants: 0,
        activePosts: 0
    });

    const fetchStats = useCallback(async () => {
        try {
            const [postsRes, appsRes] = await Promise.all([
                axios.get('/opportunity/recruiter/posts'),
                axios.get('/opportunity/recruiter/applications'),
            ]);

            if (postsRes.data.success && appsRes.data.success) {
                const posts = postsRes.data.data;
                const apps = appsRes.data.data;
                setStats({
                    totalPosts: posts.length,
                    activePosts: posts.filter((p: any) => p.isActive !== false).length,
                    totalApplicants: apps.length
                });
            }
        } catch (error) {
            console.error('Error fetching recruiter stats:', error);
        }
    }, []);

    const refreshUser = async () => {
        try {
            const res = await axios.get('/user/profile');
            if (res.data.user && setUser) setUser(res.data.user);
        } catch { }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([refreshUser(), fetchStats()]);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    const handleLogout = () => {
        Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: () => logout(), style: 'destructive' }
        ]);
    };

    const renderHeader = () => (
        <View className="bg-white">
            {/* Banner */}
            <View className="h-44 w-full relative">
                <ExpoImage
                    source={{ uri: user?.banner || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000' }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                />
                <View className="absolute inset-0 bg-black/20" />

                {/* Top Actions */}
                <View className="absolute top-12 right-4 flex-row gap-3">
                    <TouchableOpacity
                        onPress={() => navigation.navigate('EditProfile')}
                        className="bg-white/90 p-2.5 rounded-2xl shadow-sm"
                    >
                        <Ionicons name="settings-outline" size={20} color="#1f2937" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="bg-white/90 p-2.5 rounded-2xl shadow-sm"
                    >
                        <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Profile Info Overlay */}
            <View className="px-5 -mt-12 pb-6">
                <View className="flex-row items-end justify-between">
                    <View className="p-1.5 bg-white rounded-full shadow-xl">
                        <Avatar user={user as any} size={100} />
                    </View>
                </View>

                <View className="mt-4">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-2xl font-black text-zinc-900  uppercase">
                            {user?.company || user?.name}
                        </Text>
                        <MaterialCommunityIcons name="check-decagram" size={20} color="#6366f1" />
                    </View>
                    <Text className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                        {user?.industry || 'Corporate Partner'} • {user?.companySize || 'Growing Team'}
                    </Text>

                    <View className="flex-row items-center gap-4 mt-4">
                        <View className="flex-row items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full">
                            <Ionicons name="business-outline" size={14} color="#64748b" />
                            <Text className="text-slate-600 text-[10px] font-bold uppercase tracking-tight">{user?.role || 'Hiring Manager'}</Text>
                        </View>
                        {user?.companyWebsite && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(user.companyWebsite)}
                                className="flex-row items-center gap-1.5 bg-indigo-50 px-3 py-1.5 rounded-full"
                            >
                                <Ionicons name="globe-outline" size={14} color="#6366f1" />
                                <Text className="text-indigo-600 text-[10px] font-bold uppercase tracking-tight">Visit Website</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text className="text-slate-500 text-xs mt-4 leading-5 ">
                        {user?.about || "We're committed to finding the best talent and building the future of innovation."}
                    </Text>
                </View>

                {/* Corporate Stats Card */}
                <View className="flex-row bg-zinc-900 rounded-2xl p-5 mt-6 shadow-xl border border-zinc-800">
                    <View className="flex-1 items-center border-r border-zinc-800">
                        <Text className="text-white text-xl font-black ">{stats.activePosts}</Text>
                        <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">Active Roles</Text>
                    </View>
                    <View className="flex-1 items-center border-r border-zinc-800">
                        <Text className="text-white text-xl font-black ">{stats.totalApplicants}</Text>
                        <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">Total Applicants</Text>
                    </View>
                    <View className="flex-1 items-center">
                        <Text className="text-white text-xl font-black ">{stats.totalPosts}</Text>
                        <Text className="text-zinc-500 text-[8px] font-black uppercase tracking-widest mt-1">Total Posts</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderAboutTab = () => (
        <View className="p-5">
            {/* Company Highlights */}
            <View className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm mb-4">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-indigo-500" />
                    <Text className="text-zinc-900 font-black  uppercase text-xs tracking-widest">Company Overview</Text>
                </View>

                <View className="gap-4">
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                            <Ionicons name="briefcase-outline" size={20} color="#6366f1" />
                        </View>
                        <View>
                            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Industry</Text>
                            <Text className="text-zinc-900 font-bold text-sm tracking-tight">{user?.industry || 'Technology & Services'}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                            <Ionicons name="people-outline" size={20} color="#10b981" />
                        </View>
                        <View>
                            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Company Size</Text>
                            <Text className="text-zinc-900 font-bold text-sm tracking-tight">{user?.companySize || '50-200 Employees'}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center">
                            <Ionicons name="location-outline" size={20} color="#ef4444" />
                        </View>
                        <View>
                            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Headquarters</Text>
                            <Text className="text-zinc-900 font-bold text-sm tracking-tight">{user?.college || 'India (Remote)'}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Recruiter Details */}
            <View className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-pink-500" />
                    <Text className="text-zinc-900 font-black  uppercase text-xs tracking-widest">Contact Information</Text>
                </View>

                <View className="gap-3">
                    <View className="flex-row items-center justify-between py-3 border-b border-slate-50">
                        <Text className="text-slate-400 text-[10px] font-black uppercase">Professional Email</Text>
                        <Text className="text-zinc-900 font-bold text-sm">{user?.email}</Text>
                    </View>
                    <View className="flex-row items-center justify-between py-3">
                        <Text className="text-slate-400 text-[10px] font-black uppercase">LinkedIn Profile</Text>
                        <TouchableOpacity onPress={() => user?.linkedIn_id && Linking.openURL(user.linkedIn_id)}>
                            <Text className="text-indigo-600 font-bold text-sm">View Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Help & Support Section */}
            <View className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm mt-4">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-emerald-500" />
                    <Text className="text-zinc-900 font-black  uppercase text-xs tracking-widest">Support & Feedback</Text>
                </View>

                <Text className="text-slate-500 text-[10px] leading-4 mb-4 font-bold">
                    Need help? Our team is available for assistance.
                </Text>

                <TouchableOpacity
                    onPress={() => navigation.navigate('ContactUs')}
                    className="flex-row items-center justify-center gap-2 bg-zinc-900 py-4 rounded-2xl"
                >
                    <Ionicons name="chatbubbles-outline" size={18} color="white" />
                    <Text className="text-white font-black  uppercase text-[11px] tracking-widest">Contact Support</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-slate-50" edges={['bottom']}>
            <StatusBar style="dark" />
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
                }
            >
                {renderHeader()}

                {/* Tabs */}
                <View className="flex-row px-5 mt-4">
                    <TouchableOpacity
                        onPress={() => setActiveTab('about')}
                        className={`flex-1 py-4 items-center border-b-2 ${activeTab === 'about' ? 'border-indigo-600' : 'border-transparent'}`}
                    >
                        <Text className={`font-black uppercase text-[10px] tracking-widest ${activeTab === 'about' ? 'text-indigo-600' : 'text-slate-400'}`}>Company Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Dashboard')}
                        className={`flex-1 py-4 items-center border-b-2 border-transparent`}
                    >
                        <Text className={`font-black uppercase text-[10px] tracking-widest text-slate-400`}>Manage Roles</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'about' && renderAboutTab()}

            </ScrollView>
        </SafeAreaView>
    );
};

export default RecruiterProfile;
