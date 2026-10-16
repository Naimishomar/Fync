import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager,
    Alert,
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';
import { C } from '../constants/colors';

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

    return (
        <View className="flex-1 bg-ink">
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header Profile Section */}
                <View className="bg-ink px-5 pt-12 pb-6 border-b border-ink">
                    <Pressable onPress={() => go('Profile')}
                        className="flex-row items-center gap-4 mb-3">
                        <Image
                            source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}` }}
                            className="h-16 w-16 rounded-full border-2 border-recruiter"
                        />
                        <View className="flex-1">
                            <Text className="text-white text-lg font-display" numberOfLines={1}>{user?.name || user?.username || 'Fync Alumni'}</Text>
                            <Text className="text-ink-3 text-xs" numberOfLines={1}>@{user?.username || 'username'}</Text>
                        </View>
                    </Pressable>
                    {/* Score + Build Portfolio CTA */}
                    <Pressable
                        onPress={() => go('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-recruiter/10 border border-recruiter/20 px-4 py-2.5 rounded-xl mt-1">
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="star" size={16} color={C.alumniLit} />
                            <View>
                                <Text className="text-recruiter text-xs font-semibold">{user?.fyncBadge || 'Elite Alumni'}</Text>
                                <Text className="text-white text-base font-semibold">{user?.fyncScore || 0} <Text className="text-ink-3 text-xs font-normal">/ 1000</Text></Text>
                            </View>
                        </View>
                        <View className="flex-row items-center gap-1 bg-recruiter px-3 py-1.5 rounded-lg">
                            <Text className="text-white text-xs font-semibold">Portfolio</Text>
                            <Ionicons name="arrow-forward" size={12} color="white" />
                        </View>
                    </Pressable>
                </View>

                {/* Menu Items */}
                <View className="mt-4 px-2">
                    
                    {/* OPPORTUNITIES DROPDOWN */}
                    <Pressable
                        onPress={toggleOpportunities}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl active:bg-ink"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="briefcase-outline" size={24} color={C.recruiter} />
                            <Text className="text-white text-lg ml-4 font-medium">Opportunities</Text>
                        </View>
                        <Ionicons
                            name={showOpportunities ? "chevron-up-outline" : "chevron-down-outline"}
                            size={20}
                            color={C.ink3}
                        />
                    </Pressable>

                    {showOpportunities && (
                        <View className="ml-6 border-l-2 border-ink pl-1">
                            <Pressable
                                onPress={() => go('InternshipList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-ink"
                            >
                                <Ionicons name="school-outline" size={20} color={C.ink4} />
                                <Text className="text-ink-4 text-base ml-3 font-medium">Internships</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => go('JobList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-ink"
                            >
                                <Ionicons name="business-outline" size={20} color={C.ink4} />
                                <Text className="text-ink-4 text-base ml-3 font-medium">Jobs</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => go('WorkshopList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-ink"
                            >
                                <Ionicons name="book-outline" size={20} color={C.ink4} />
                                <Text className="text-ink-4 text-base ml-3 font-medium">Workshops</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Alumni Connect (Exclusive) */}
                    <Pressable
                        onPress={() => go('AlumniConnect')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="chatbubbles-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Alumni Connect</Text>
                        <View className="ml-2 bg-recruiter px-2 py-0.5 rounded-full">
                            <Text className="text-label text-white font-semibold">Exclusive</Text>
                        </View>
                    </Pressable>

                    {/* Utility Hub */}
                    <Pressable
                        onPress={() => go('UtilityHubScreen')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="construct-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Utility Hub</Text>
                        <View className="ml-2 bg-recruiter px-2 py-0.5 rounded-full">
                            <Text className="text-label text-white font-semibold">New</Text>
                        </View>
                    </Pressable>

                    {/* Campus Alumni */}
                    <Pressable
                        onPress={() => go('FindAlumni')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="people-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Campus Alumni</Text>
                    </Pressable>

                    {/* Professional Hub */}
                    <Pressable
                        onPress={() => go('ProfessionalHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="briefcase-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Professional Hub</Text>
                    </Pressable>

                    {/* Notice Board */}
                    <Pressable
                        onPress={() => go('NoticeBoard')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Notice Board</Text>
                    </Pressable>

                    {/* Echo Hubs */}
                    <Pressable
                        onPress={() => go('CommunityList')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="megaphone-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Echo Hubs</Text>
                    </Pressable>

                    {/* Paid Gigs */}
                    <Pressable
                        onPress={() => go('PaidGigs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="cash-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Paid Gigs</Text>
                    </Pressable>

                    {/* Placement Hub */}
                    <Pressable
                        onPress={() => go('PlacementHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="business-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Placement Hub</Text>
                    </Pressable>

                    {/* Contact Us */}
                    <Pressable
                        onPress={() => go('ContactUs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="people-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Contact Us</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => go('SettingsScreen')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="settings-outline" size={24} color={C.recruiter} />
                        <Text className="text-white text-lg ml-4 font-medium">Settings</Text>
                    </Pressable>

                    <Pressable
                        onPress={confirmLogout}
                        accessibilityRole="button"
                        accessibilityLabel="Sign out"
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-ink"
                    >
                        <Ionicons name="log-out-outline" size={24} color={C.danger} />
                        <Text className="text-danger text-lg ml-4 font-medium">Sign out</Text>
                    </Pressable>

                </View>
            </DrawerContentScrollView>
        </View>
    );
}
