import React, { useState } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';
import { Alert } from './ui/AlertModal';
import { Avatar, C, Card, IconTile, ListRow, Tag } from './ui/kit';
import { isFeatureOn } from '../constants/features';
import { getFullUrl } from '../utils/imageUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Enable LayoutAnimation for Android
if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    try { 
        UIManager.setLayoutAnimationEnabledExperimental(true);
    } catch (e) {}
}

export default function AlumniSidebar(props: any) {
    const { user, logout } = useAuth();
    const insets = useSafeAreaInsets();

    // State for dropdowns
    const [showOpportunities, setShowOpportunities] = useState(false);
    const [showPortfolio, setShowPortfolio] = useState(false);

    // Close first: the target screen lives in the parent stack, and coming back
    // to a still-open drawer read as the menu being stuck.
    const go = (route: string) => {
        props.navigation.closeDrawer();
        props.navigation.navigate(route);
    };

    // Same confirm and auth-context logout as SettingsScreen's "Sign out",
    // which is where CustomSidebar sends students to sign out.
    const confirmLogout = () =>
        Alert.alert('Sign out', `Sign out of ${user?.username ? `@${user.username}` : 'your account'}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: () => logout() },
        ]);

    const togglePortfolio = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowPortfolio(!showPortfolio);
    };

    const toggleOpportunities = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowOpportunities(!showOpportunities);
    };

    const newTag = (label: string) => <Tag label={label} tone={{ bg: C.brand100, fg: C.brandText }} />;

    return (
        <View className="flex-1 bg-paper">
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0, paddingBottom: insets.bottom + 16 }}>
                {/* Inset-based top so the avatar clears tall status bars / notches. */}
                <View className="px-5 pb-4" style={{ paddingTop: insets.top + 16 }}>
                    <Pressable
                        onPress={() => go('Profile')}
                        className="flex-row items-center mb-4 active:opacity-70"
                        style={{ gap: 12 }}
                        accessibilityRole="button"
                        accessibilityLabel="Open your profile"
                    >
                        <Avatar uri={getFullUrl(user?.avatar) || undefined} initials={user?.name || user?.username} size={56} role="alumni" />
                        <View className="flex-1">
                            <Text className="text-ink text-lg font-semibold" numberOfLines={1}>{user?.name || user?.username || 'Fync Alumni'}</Text>
                            <Text className="text-ink-3 text-sm" numberOfLines={1}>@{user?.username || 'username'}</Text>
                        </View>
                    </Pressable>
                    <Card padded={false} style={{ paddingHorizontal: 16 }}>
                        <ListRow
                            leading={<IconTile icon="star" color={C.alumni} />}
                            title={`${user?.fyncScore || 0} / 1000`}
                            subtitle={`${user?.fyncBadge || 'Elite Alumni'} · Portfolio`}
                            onPress={() => go('FyncProfileBuilder')}
                        />
                    </Card>
                </View>

                <View className="px-5">
                    <ListRow
                        icon="briefcase-outline"
                        title="Opportunities"
                        onPress={toggleOpportunities}
                        accessibilityLabel={`Opportunities, ${showOpportunities ? 'expanded' : 'collapsed'}`}
                        right={<Ionicons name={showOpportunities ? 'chevron-up' : 'chevron-down'} size={18} color={C.ink3} />}
                    />
                    {showOpportunities && (
                        <View style={{ paddingLeft: 52 }}>
                            <ListRow title="Internships" onPress={() => go('InternshipList')} />
                            <ListRow title="Jobs" onPress={() => go('JobList')} />
                            {isFeatureOn('workshops') && <ListRow title="Workshops" onPress={() => go('WorkshopList')} />}
                        </View>
                    )}

                    {isFeatureOn('alumniConnect') && (
                        <ListRow icon="chatbubbles-outline" title="Alumni Connect" onPress={() => go('AlumniConnect')} right={newTag('Exclusive')} chevron />
                    )}
                    <ListRow icon="construct-outline" title="Utility Hub" onPress={() => go('UtilityHubScreen')} right={newTag('New')} chevron />
                    {isFeatureOn('alumni') && <ListRow icon="people-outline" title="Campus Alumni" onPress={() => go('FindAlumni')} />}
                    {isFeatureOn('proHub') && <ListRow icon="briefcase-outline" title="Professional Hub" onPress={() => go('ProfessionalHub')} />}
                    <ListRow icon="chatbubble-ellipses-outline" title="Notice Board" onPress={() => go('NoticeBoard')} />
                    {isFeatureOn('communities') && <ListRow icon="megaphone-outline" title="Echo Hubs" onPress={() => go('CommunityList')} />}
                    <ListRow icon="cash-outline" title="Paid Gigs" onPress={() => go('PaidGigs')} />
                    {isFeatureOn('placement') && <ListRow icon="business-outline" title="Placement Hub" onPress={() => go('PlacementHub')} />}
                    <ListRow icon="mail-outline" title="Contact us" onPress={() => go('ContactUs')} />
                    <ListRow icon="settings-outline" title="Settings" onPress={() => go('SettingsScreen')} />

                    <Pressable
                        onPress={confirmLogout}
                        accessibilityRole="button"
                        accessibilityLabel="Sign out"
                        className="flex-row items-center active:opacity-70"
                        style={{ gap: 12, minHeight: 56 }}
                    >
                        <IconTile icon="log-out-outline" color={C.danger} />
                        <Text className="text-danger text-base font-semibold">Sign out</Text>
                    </Pressable>
                </View>
            </DrawerContentScrollView>
        </View>
    );
}
