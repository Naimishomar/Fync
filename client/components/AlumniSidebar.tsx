import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager
} from 'react-native';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';

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

    const togglePortfolio = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowPortfolio(!showPortfolio);
    };

    const toggleOpportunities = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowOpportunities(!showOpportunities);
    };

    return (
        <View className="flex-1 bg-black">
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header Profile Section */}
                <View className="bg-slate-900 px-5 pt-12 pb-6 border-b border-slate-800">
                    <Pressable onPress={() => props.navigation.navigate('Profile')}
                        className="flex-row items-center gap-4 mb-3">
                        <Image
                            source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                            className="h-16 w-16 rounded-full border-2 border-indigo-500"
                        />
                        <View className="flex-1">
                            <Text className="text-white text-lg font-bold">{user?.name || user?.username || 'Fync Alumni'}</Text>
                            <Text className="text-slate-500 text-xs">@{user?.username || 'username'}</Text>
                        </View>
                    </Pressable>
                    {/* Score + Build Portfolio CTA */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl mt-1">
                        <View className="flex-row items-center gap-2">
                            <Text style={{ fontSize: 16 }}>🌟</Text>
                            <View>
                                <Text className="text-indigo-300 text-xs font-bold">{user?.fyncBadge || 'Elite Alumni'}</Text>
                                <Text className="text-white text-base font-bold">{user?.fyncScore || 0} <Text className="text-slate-500 text-xs font-normal">/ 1000</Text></Text>
                            </View>
                        </View>
                        <View className="flex-row items-center gap-1 bg-indigo-600 px-3 py-1.5 rounded-lg">
                            <Text className="text-white text-xs font-bold">Portfolio</Text>
                            <Ionicons name="arrow-forward" size={12} color="white" />
                        </View>
                    </Pressable>
                </View>

                {/* Menu Items */}
                <View className="mt-4 px-2">
                    
                    {/* OPPORTUNITIES DROPDOWN */}
                    <Pressable
                        onPress={toggleOpportunities}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl active:bg-slate-800"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="briefcase-outline" size={24} color="#818cf8" />
                            <Text className="text-white text-lg ml-4 font-medium">Opportunities</Text>
                        </View>
                        <Ionicons
                            name={showOpportunities ? "chevron-up-outline" : "chevron-down-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </Pressable>

                    {showOpportunities && (
                        <View className="ml-6 border-l-2 border-slate-800 pl-1">
                            <Pressable
                                onPress={() => props.navigation.navigate('InternshipList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-slate-800"
                            >
                                <Ionicons name="school-outline" size={20} color="#9ca3af" />
                                <Text className="text-slate-300 text-base ml-3 font-medium">Internships</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => props.navigation.navigate('JobList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-slate-800"
                            >
                                <Ionicons name="business-outline" size={20} color="#9ca3af" />
                                <Text className="text-slate-300 text-base ml-3 font-medium">Jobs</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => props.navigation.navigate('WorkshopList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-slate-800"
                            >
                                <Ionicons name="book-outline" size={20} color="#9ca3af" />
                                <Text className="text-slate-300 text-base ml-3 font-medium">Workshops</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* Alumni Connect (Exclusive) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('AlumniConnect')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="chatbubbles-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Alumni Connect</Text>
                        <View className="ml-2 bg-indigo-500 px-2 py-0.5 rounded-full">
                            <Text className="text-2xs text-white font-bold">Exclusive</Text>
                        </View>
                    </Pressable>

                    {/* Utility Hub */}
                    <Pressable
                        onPress={() => props.navigation.navigate('UtilityHubScreen')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="construct-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Utility Hub</Text>
                        <View className="ml-2 bg-indigo-500 px-2 py-0.5 rounded-full">
                            <Text className="text-2xs text-white font-bold">New</Text>
                        </View>
                    </Pressable>

                    {/* Campus Alumni */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FindAlumni')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="people-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Campus Alumni</Text>
                    </Pressable>

                    {/* Professional Hub */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ProfessionalHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="briefcase-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Professional Hub</Text>
                    </Pressable>

                    {/* Notice Board */}
                    <Pressable
                        onPress={() => props.navigation.navigate('NoticeBoard')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Notice Board</Text>
                    </Pressable>

                    {/* Echo Hubs */}
                    <Pressable
                        onPress={() => props.navigation.navigate('CommunityList')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="megaphone-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Echo Hubs</Text>
                    </Pressable>

                    {/* Paid Gigs */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PaidGigs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="cash-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Paid Gigs</Text>
                    </Pressable>

                    {/* Placement Hub */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PlacementHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="business-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Placement Hub</Text>
                    </Pressable>

                    {/* Contact Us */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ContactUs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-slate-800"
                    >
                        <Ionicons name="people-outline" size={24} color="#818cf8" />
                        <Text className="text-white text-lg ml-4 font-medium">Contact Us</Text>
                    </Pressable>

                </View>
            </DrawerContentScrollView>
        </View>
    );
}
