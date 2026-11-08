import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { Image as ExpoImage } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import axios from '../context/axiosConfig';
import { useAuth } from '../context/auth.context';
import Avatar from './Avatar';
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { getFullUrl } from '../utils/imageUtils';
import { AppBar, Button, Card, Divider, H1, IconBtn, Label, ListRow, Num, SectionHeader, Tabs, Tag } from './ui/kit';
import { useTabBarAutoHide, useTabBarClearance } from '../constants/layout';

import FyncRefreshControl from './ui/FyncRefreshControl';
const RecruiterProfile = () => {
    const autoHideTabBar = useTabBarAutoHide();
    const tabBarClearance = useTabBarClearance();
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
        <View>
            {/* Banner */}
            <View className="h-44 w-full">
                <ExpoImage
                    // getFullUrl: an uploaded banner is a relative path, which rendered blank.
                    source={{ uri: getFullUrl(user?.banner) || 'https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=1000' }}
                    style={{ width: '100%', height: '100%', backgroundColor: C.paper2 }}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                />
            </View>

            <View className="px-gutter -mt-12">
                <View className="self-start p-1 bg-paper rounded-full">
                    <Avatar user={user as any} size={96} />
                </View>

                <View className="mt-3">
                    <View className="flex-row items-center" style={{ gap: 8 }}>
                        <H1 style={{ flexShrink: 1 }} numberOfLines={2}>{user?.company || user?.name}</H1>
                        <MaterialCommunityIcons name="check-decagram" size={20} color={C.recruiter} accessibilityLabel="Verified recruiter" />
                    </View>
                    <Text className="text-ink-3 text-sm mt-1">
                        {user?.industry || 'Corporate Partner'} · {user?.companySize || 'Growing Team'}
                    </Text>

                    <View className="flex-row flex-wrap items-center mt-3" style={{ gap: 8 }}>
                        <Tag icon="business-outline" label={user?.role || 'Hiring Manager'} />
                        {user?.companyWebsite && (
                            <Button
                                small
                                icon="globe-outline"
                                title="Visit website"
                                onPress={() => Linking.openURL(user.companyWebsite).catch(() => {})}
                            />
                        )}
                    </View>

                    <Text className="text-ink-2 text-sm mt-3 leading-5">
                        {user?.about || "We're committed to finding the best talent and building the future of innovation."}
                    </Text>
                </View>

                {/* Stats */}
                <Card style={{ flexDirection: 'row', paddingVertical: 16, marginTop: 16 }}>
                    {[
                        { n: stats.activePosts, l: 'Active roles' },
                        { n: stats.totalApplicants, l: 'Applicants' },
                        { n: stats.totalPosts, l: 'Total posts' },
                    ].map((x, i) => (
                        <View key={x.l} className={`flex-1 items-center ${i < 2 ? 'border-r border-line' : ''}`}>
                            <Num style={{ fontSize: 20 }}>{x.n}</Num>
                            <Label style={{ marginTop: 2 }}>{x.l}</Label>
                        </View>
                    ))}
                </Card>
            </View>
        </View>
    );

    const renderAboutTab = () => (
        <View className="px-gutter">
            <SectionHeader title="Company overview" />
            <Card style={{ paddingHorizontal: 16 }}>
                <ListRow icon="briefcase-outline" title={user?.industry || 'Technology & Services'} subtitle="Industry" />
                <Divider />
                <ListRow icon="people-outline" title={user?.companySize || '50-200 Employees'} subtitle="Company size" />
                <Divider />
                <ListRow icon="location-outline" title={user?.college || 'India (Remote)'} subtitle="Headquarters" />
            </Card>

            <SectionHeader title="Contact information" />
            <Card style={{ paddingHorizontal: 16 }}>
                <ListRow icon="mail-outline" title={user?.email || ''} subtitle="Professional email" />
                <Divider />
                <ListRow
                    icon="logo-linkedin"
                    title="LinkedIn profile"
                    subtitle="View profile"
                    onPress={() => user?.linkedIn_id && Linking.openURL(user.linkedIn_id).catch(() => {})}
                />
            </Card>

            <SectionHeader title="Support & feedback" />
            <Card padded>
                <Text className="text-ink-2 text-sm mb-4">Need help? Our team is available for assistance.</Text>
                <Button block icon="chatbubbles-outline" title="Contact support" onPress={() => navigation.navigate('ContactUs')} />
            </Card>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
            <StatusBar style={C.statusStyle} />
            <AppBar
                title="Profile"
                right={
                    <>
                        <IconBtn name="settings-outline" onPress={() => navigation.navigate('EditProfile')} accessibilityLabel="Edit profile" />
                        <IconBtn name="log-out-outline" color={C.danger} onPress={handleLogout} accessibilityLabel="Log out" />
                    </>
                }
            />
            <ScrollView keyboardShouldPersistTaps="handled"
                {...autoHideTabBar}
                contentContainerStyle={{ paddingBottom: tabBarClearance }}
                refreshControl={
                    <FyncRefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.recruiter} colors={[C.recruiter]} />
                }
            >
                {renderHeader()}

                <View className="mt-4">
                    <Tabs
                        fill
                        items={['Company info', 'Manage roles']}
                        value="Company info"
                        onChange={(t) => { if (t === 'Manage roles') navigation.navigate('Dashboard'); else setActiveTab('about'); }}
                    />
                </View>

                {activeTab === 'about' && renderAboutTab()}

            </ScrollView>
        </SafeAreaView>
    );
};

export default RecruiterProfile;
