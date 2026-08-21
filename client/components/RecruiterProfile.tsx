import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, TouchableOpacity, ScrollView, RefreshControl, Linking, Dimensions, ActivityIndicator} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import { Alert } from './ui/AlertModal';

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
        <View className="bg-card">
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
                        className="bg-card/90 p-2.5 rounded-card shadow-hair"
                    >
                        <Ionicons name="settings-outline" size={20} color="#57534E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleLogout}
                        className="bg-card/90 p-2.5 rounded-card shadow-hair"
                    >
                        <Ionicons name="log-out-outline" size={20} color="#DC2626" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Profile Info Overlay */}
            <View className="px-5 -mt-12 pb-6">
                <View className="flex-row items-end justify-between">
                    <View className="p-1.5 bg-card rounded-full shadow-hair">
                        <Avatar user={user as any} size={100} />
                    </View>
                </View>

                <View className="mt-4">
                    <View className="flex-row items-center gap-2">
                        <Text className="text-2xl font-display text-ink uppercase">
                            {user?.company || user?.name}
                        </Text>
                        <MaterialCommunityIcons name="check-decagram" size={20} color="#4F46E5" />
                    </View>
                    <Text className="text-ink-3 font-semibold text-xs uppercase mt-1">
                        {user?.industry || 'Corporate Partner'} • {user?.companySize || 'Growing Team'}
                    </Text>

                    <View className="flex-row items-center gap-4 mt-4">
                        <View className="flex-row items-center gap-1.5 bg-paper-2 px-3 py-1.5 rounded-full">
                            <Ionicons name="business-outline" size={14} color="#8B857E" />
                            <Text className="text-ink-2 text-label font-semibold uppercase">{user?.role || 'Hiring Manager'}</Text>
                        </View>
                        {user?.companyWebsite && (
                            <TouchableOpacity
                                onPress={() => Linking.openURL(user.companyWebsite)}
                                className="flex-row items-center gap-1.5 bg-recruiter/10 px-3 py-1.5 rounded-full"
                            >
                                <Ionicons name="globe-outline" size={14} color="#4F46E5" />
                                <Text className="text-recruiter text-label font-semibold uppercase">Visit Website</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text className="text-ink-3 text-xs mt-4 leading-5">
                        {user?.about || "We're committed to finding the best talent and building the future of innovation."}
                    </Text>
                </View>

                {/* Corporate Stats Card */}
                <View className="flex-row bg-ink rounded-card p-5 mt-6 shadow-hair border border-ink">
                    <View className="flex-1 items-center border-r border-ink">
                        <Text className="text-white text-xl font-display">{stats.activePosts}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-1">Active Roles</Text>
                    </View>
                    <View className="flex-1 items-center border-r border-ink">
                        <Text className="text-white text-xl font-display">{stats.totalApplicants}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-1">Total Applicants</Text>
                    </View>
                    <View className="flex-1 items-center">
                        <Text className="text-white text-xl font-display">{stats.totalPosts}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-1">Total Posts</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    const renderAboutTab = () => (
        <View className="p-5">
            {/* Company Highlights */}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mb-4">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-recruiter" />
                    <Text className="font-semibold text-base text-ink">Company Overview</Text>
                </View>

                <View className="gap-4">
                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center">
                            <Ionicons name="briefcase-outline" size={20} color="#4F46E5" />
                        </View>
                        <View>
                            <Text className="text-ink-3 text-label font-display uppercase">Industry</Text>
                            <Text className="text-ink font-semibold text-sm">{user?.industry || 'Technology & Services'}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center">
                            <Ionicons name="people-outline" size={20} color="#047857" />
                        </View>
                        <View>
                            <Text className="text-ink-3 text-label font-display uppercase">Company Size</Text>
                            <Text className="text-ink font-semibold text-sm">{user?.companySize || '50-200 Employees'}</Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-4">
                        <View className="w-10 h-10 bg-paper-2 rounded-card items-center justify-center">
                            <Ionicons name="location-outline" size={20} color="#DC2626" />
                        </View>
                        <View>
                            <Text className="text-ink-3 text-label font-display uppercase">Headquarters</Text>
                            <Text className="text-ink font-semibold text-sm">{user?.college || 'India (Remote)'}</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Recruiter Details */}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-brand-500" />
                    <Text className="font-semibold text-base text-ink">Contact Information</Text>
                </View>

                <View className="gap-3">
                    <View className="flex-row items-center justify-between py-3 border-b border-line">
                        <Text className="text-ink-3 text-label font-display uppercase">Professional Email</Text>
                        <Text className="text-ink font-semibold text-sm">{user?.email}</Text>
                    </View>
                    <View className="flex-row items-center justify-between py-3">
                        <Text className="text-ink-3 text-label font-display uppercase">LinkedIn Profile</Text>
                        <TouchableOpacity onPress={() => user?.linkedIn_id && Linking.openURL(user.linkedIn_id)}>
                            <Text className="text-recruiter font-semibold text-sm">View Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Help & Support Section */}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mt-4">
                <View className="flex-row items-center gap-2 mb-4">
                    <View className="w-1 h-5 rounded-full bg-success" />
                    <Text className="font-semibold text-base text-ink">Support & Feedback</Text>
                </View>

                <Text className="text-ink-3 text-label leading-4 mb-4 font-semibold">
                    Need help? Our team is available for assistance.
                </Text>

                <TouchableOpacity
                    onPress={() => navigation.navigate('ContactUs')}
                    className="flex-row items-center justify-center gap-2 bg-ink py-4 rounded-card"
                >
                    <Ionicons name="chatbubbles-outline" size={18} color="white" />
                    <Text className="text-white font-display uppercase text-label">Contact Support</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
            <StatusBar style="dark" />
            <ScrollView
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4F46E5" />
                }
            >
                {renderHeader()}

                {/* Tabs */}
                <View className="flex-row px-5 mt-4">
                    <TouchableOpacity
                        onPress={() => setActiveTab('about')}
                        className={`flex-1 py-4 items-center border-b-2 ${activeTab === 'about' ? 'border-recruiter' : 'border-transparent'}`}
                    >
                        <Text className={`font-display uppercase text-label ${activeTab === 'about' ? 'text-recruiter' : 'text-ink-3'}`}>Company Info</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Dashboard')}
                        className={`flex-1 py-4 items-center border-b-2 border-transparent`}
                    >
                        <Text className={`font-display uppercase text-label text-ink-3`}>Manage Roles</Text>
                    </TouchableOpacity>
                </View>

                {activeTab === 'about' && renderAboutTab()}

            </ScrollView>
        </SafeAreaView>
    );
};

export default RecruiterProfile;
