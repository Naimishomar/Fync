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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth.context';

// Enable LayoutAnimation for Android
if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    // Only call if not in New Architecture or to avoid noisy warning
    try { 
        UIManager.setLayoutAnimationEnabledExperimental(true);
    } catch (e) {}
}

export default function CustomSidebar(props: any) {
    const { user, logout } = useAuth();

    // State for dropdowns
    const [showOpportunities, setShowOpportunities] = useState(false);
    const [showQuizzes, setShowQuizzes] = useState(false);
    const [showHackathons, setShowHackathons] = useState(false);
    const [showPortfolio, setShowPortfolio] = useState(false);

    const togglePortfolio = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowPortfolio(!showPortfolio);
    };

    const toggleOpportunities = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowOpportunities(!showOpportunities);
    };

    const toggleQuizzes = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowQuizzes(!showQuizzes);
    };

    const toggleHackathons = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowHackathons(!showHackathons);
    };

    return (
        <View className="flex-1 bg-black">
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header Profile Section */}
                <View className="bg-gray-900 px-5 pt-12 pb-6 border-b border-gray-800">
                    <Pressable onPress={() => props.navigation.navigate('Profile')}
                        className="flex-row items-center gap-4 mb-3">
                        <Image
                            source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                            className="h-16 w-16 rounded-full border-2 border-pink-500"
                        />
                        <View className="flex-1">
                            <Text className="text-white text-lg font-bold">{user?.name || user?.username || 'Fync User'}</Text>
                            <Text className="text-gray-400 text-xs">@{user?.username || 'username'}</Text>
                        </View>
                    </Pressable>
                    {/* Score + Build Portfolio CTA */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-indigo-500/10 border border-indigo-500/20 px-4 py-2.5 rounded-xl mt-1">
                        <View className="flex-row items-center gap-2">
                            <Text style={{ fontSize: 16 }}>{user?.fyncBadge === 'Legend' ? '🌟' : user?.fyncBadge === 'Pioneer' ? '🚀' : user?.fyncBadge === 'Innovator' ? '💡' : user?.fyncBadge === 'Builder' ? '🔨' : user?.fyncBadge === 'Explorer' ? '🗺️' : '🌱'}</Text>
                            <View>
                                <Text className="text-indigo-300 text-xs font-bold">{user?.fyncBadge || 'Newcomer'}</Text>
                                <Text className="text-white text-base font-bold">{user?.fyncScore || 0} <Text className="text-gray-500 text-xs font-normal">/ 1000</Text></Text>
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

                    {/* ─── FYNC PORTFOLIO (NEW) ──────────────── */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FyncProfileBuilder')}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 bg-indigo-500/10 border border-indigo-500/20 active:bg-indigo-500/20"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="person-circle-outline" size={24} color="#818CF8" />
                            <Text className="text-indigo-300 text-lg ml-4 font-bold">Fync Portfolio</Text>
                            <View className="ml-2 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                <Text className="text-[9px] text-indigo-400 font-bold">NEW</Text>
                            </View>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color="#818CF8" />
                    </Pressable>

                    <Pressable
                        onPress={toggleQuizzes}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl active:bg-gray-800"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="game-controller-outline" size={24} color="#f9a8d4" />
                            <Text className="text-white text-lg ml-4 font-medium">Quizzes</Text>
                        </View>
                        <Ionicons
                            name={showQuizzes ? "chevron-up-outline" : "chevron-down-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </Pressable>

                    {/* 2a. QUIZZES CHILDREN */}
                    {showQuizzes && (
                        <View className="ml-6 border-l-2 border-gray-800 pl-1">
                            {/* 1v1 Quiz */}
                            <Pressable
                                onPress={() => props.navigation.navigate('OneVsOneSetup')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="people-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">1v1 Battle</Text>
                            </Pressable>

                            {/* Create Room */}
                            <Pressable
                                onPress={() => props.navigation.navigate('CreateRoom')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="add-circle-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Create Room</Text>
                            </Pressable>

                            {/* Join Room */}
                            <Pressable
                                onPress={() => props.navigation.navigate('JoinRoomInput')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="enter-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Join Room</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* 3. OPPORTUNITIES DROPDOWN (Parent) */}
                    <Pressable
                        onPress={toggleOpportunities}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl active:bg-gray-800"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="briefcase-outline" size={24} color="#f9a8d4" />
                            <Text className="text-white text-lg ml-4 font-medium">Opportunities</Text>
                        </View>
                        <Ionicons
                            name={showOpportunities ? "chevron-up-outline" : "chevron-down-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </Pressable>

                    {/* 3a. OPPORTUNITIES CHILDREN */}
                    {showOpportunities && (
                        <View className="ml-6 border-l-2 border-gray-800 pl-1">
                            {/* Hackathon */}
                            <Pressable
                                onPress={() => props.navigation.navigate('HackathonList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="code-slash-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Hackathons</Text>
                            </Pressable>

                            {/* Internship */}
                            <Pressable
                                onPress={() => props.navigation.navigate('InternshipList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="school-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Internships</Text>
                            </Pressable>

                            {/* Jobs */}
                            <Pressable
                                onPress={() => props.navigation.navigate('JobList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="business-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Jobs</Text>
                            </Pressable>

                            {/* Workshops */}
                            <Pressable
                                onPress={() => props.navigation.navigate('WorkshopList')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="book-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Workshops</Text>
                            </Pressable>
                        </View>
                    )}

                    {/* HACKATHON ECOSYSTEM DROPDOWN */}
                    <Pressable
                        onPress={toggleHackathons}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="rocket-outline" size={24} color="#f9a8d4" />
                            <Text className="text-white text-lg ml-4 font-medium">Hackathon Hub</Text>
                            <View className="ml-2 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30">
                                <Text className="text-[9px] text-indigo-400 font-bold">NEW</Text>
                            </View>
                        </View>
                        <Ionicons
                            name={showHackathons ? "chevron-up-outline" : "chevron-down-outline"}
                            size={20}
                            color="#6b7280"
                        />
                    </Pressable>

                    {showHackathons && (
                        <View className="ml-4 border-l-2 border-gray-800 pl-2">
                            {/* Browse Hackathons */}
                            <Pressable
                                onPress={() => props.navigation.navigate('HackathonHub')}
                                className="flex-row items-center px-4 py-3 rounded-xl mb-1 active:bg-gray-800"
                            >
                                <Ionicons name="search-outline" size={20} color="#9ca3af" />
                                <Text className="text-gray-300 text-base ml-3 font-medium">Browse Hackathons</Text>
                            </Pressable>
                        </View>
                    )}


                    {/* Campus Alumni (Find alumni from your college) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FindAlumni')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="school-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Campus Alumni</Text>
                    </Pressable>

                    {/* Alumni Connect (Only for Alumni) */}
                    {user?.user_access === 'alumni' && (
                        <Pressable
                            onPress={() => props.navigation.navigate('AlumniConnect')}
                            className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                        >
                            <Ionicons name="chatbubbles-outline" size={24} color="#f9a8d4" />
                            <Text className="text-white text-lg ml-4 font-medium">Alumni Connect</Text>
                            <View className="ml-2 bg-pink-500 px-2 py-0.5 rounded-full">
                                <Text className="text-[10px] text-white font-bold">Exclusive</Text>
                            </View>
                        </Pressable>
                    )}

                    {/* Professional Hub (Student-Alumni Mentorship) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ProfessionalHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="briefcase-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Professional Hub</Text>
                    </Pressable>

                    {/* 5. Bunk O Meter */}
                    <Pressable
                        onPress={() => props.navigation.navigate('BunkOMeter')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                        <Ionicons name="flashlight-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">BunkOMeter</Text>
                    </Pressable>


                    {/* 5. Twelve AM Club */}
                    <Pressable
                        onPress={() => props.navigation.navigate('TwelveAMHomeCard')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                        <Ionicons name="time-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">12 AM Night Club</Text>
                    </Pressable>

                    {/* 6. Find Teammate */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FindTeammate')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                        <Ionicons name="people-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Find Teammate</Text>
                    </Pressable>

                    {/* Confession Feed */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ConfessionFeed')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="chatbubbles-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Confession Feed</Text>
                        <View className="ml-2 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                            <Text className="text-[10px] text-pink-400 font-bold italic">SECRET</Text>
                        </View>
                    </Pressable>


                    {/* 9. Coding Leaderboard */}
                    <Pressable
                        onPress={() => props.navigation.navigate('CodingLeaderboard')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                        <Ionicons name="code-slash-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Coding Leaderboard</Text>
                    </Pressable>

                    {/*10. Drive */}
                    <Pressable
                        onPress={() => props.navigation.navigate('DriveFolderScreen', { folderId: '1iebOEYcCJKexGpo8TbRs6BxqUZ8zDjMr', title: 'B.Tech' })}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800">
                        <Ionicons name="folder-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Study Material</Text>
                    </Pressable>

                    {/* 10. Campus OLX (Peer-to-Peer) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('OLXMarketplace')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="cart-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Campus OLX</Text>
                    </Pressable>

                    {/* 10b. Rewards Store (Spend Coins) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('RewardsMarketplace')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="gift-outline" size={24} color="#fbd38d" />
                        <Text className="text-white text-lg ml-4 font-medium">Rewards Store</Text>
                        <View className="ml-2 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                            <Text className="text-[9px] text-amber-500 font-bold">COINS</Text>
                        </View>
                    </Pressable>

                    {/* 11. Lost & Found */}
                    <Pressable
                        onPress={() => props.navigation.navigate('LostAndFound')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="search-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Lost & Found</Text>
                    </Pressable>

                    {/* 12. Notice Board */}
                    <Pressable
                        onPress={() => props.navigation.navigate('NoticeBoard')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Notice Board</Text>
                    </Pressable>

                    {/* Echo Hubs (Creator Ecosystem) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('CommunityList')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="megaphone-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Echo Hubs</Text>
                    </Pressable>

                    {/* College Clubs (Campus Community) */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ClubList')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="people-circle-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">College Clubs</Text>
                    </Pressable>

                    {/* 15. Paid Gigs */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PaidGigs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="cash-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Paid Gigs</Text>
                    </Pressable>

                    {/* 18. Study Assistant */}
                    <Pressable
                        onPress={() => props.navigation.navigate('StudyAssistant')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="book-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Study Assistant</Text>
                    </Pressable>

                    {/* Focus Mode */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FocusProductivity')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="timer-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Focus Mode</Text>
                    </Pressable>


                    {/* 18c. Placement Hub */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PlacementHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="business-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Placement Hub</Text>
                    </Pressable>

                    {/* Meet Our Team */}
                    <Pressable
                        onPress={() => props.navigation.navigate('ContactUs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="people-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Contact Us</Text>
                    </Pressable>

                    {/* Admin Only — Manage Ads */}
                    {user?.user_access === 'admin' && (
                        <Pressable
                            onPress={() => props.navigation.navigate('AdminPortal')}
                            className="flex-row items-center px-4 py-4 rounded-xl mb-1 mt-2 bg-pink-500/10 border border-pink-500/20 active:bg-pink-500/20"
                        >
                            <Ionicons name="shield-checkmark-outline" size={24} color="#ec4899" />
                            <Text className="text-pink-400 text-lg ml-4 font-semibold">Admin Portal</Text>
                            <View className="ml-2 bg-pink-500/20 px-2 py-0.5 rounded-full border border-pink-500/30">
                                <Text className="text-[9px] text-pink-400 font-bold">ADMIN</Text>
                            </View>
                        </Pressable>
                    )}

                </View>
            </DrawerContentScrollView>

            {/* Footer / Logout */}
            {/* <View className="p-5 border-t border-gray-800 mb-5">
                <Pressable onPress={logout} className="flex-row items-center px-4 py-2">
                    <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                    <Text className="text-red-500 ml-4 font-medium text-lg">Sign Out</Text>
                </Pressable>
            </View> */}
        </View>
    );
}