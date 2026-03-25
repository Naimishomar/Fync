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
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomSidebar(props: any) {
    const { user, logout } = useAuth();

    // State for dropdowns
    const [showOpportunities, setShowOpportunities] = useState(false);
    const [showQuizzes, setShowQuizzes] = useState(false);

    const toggleOpportunities = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowOpportunities(!showOpportunities);
    };

    const toggleQuizzes = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setShowQuizzes(!showQuizzes);
    };

    return (
        <View className="flex-1 bg-black">
            <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0 }}>
                {/* Header Profile Section */}
                <View className="bg-gray-900 px-5 pt-12 pb-8 border-b border-gray-800">
                    <Pressable onPress={() => props.navigation.navigate('Profile')}>
                        <Image
                            source={{ uri: user?.avatar || `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                            className="h-20 w-20 rounded-full border-2 border-pink-500 mb-4"
                        />
                    </Pressable>
                    <Text className="text-white text-xl font-bold">{user?.fullName || user?.username || "Fync User"}</Text>
                    <Text className="text-gray-400 text-sm">@{user?.username || "username"}</Text>
                </View>

                {/* Menu Items */}
                <View className="mt-4 px-2">

                    {/* 2. QUIZZES DROPDOWN (Parent) */}
                    <Pressable
                        onPress={toggleQuizzes}
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
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
                        <View className="ml-4 border-l-2 border-gray-800 pl-2">
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
                        className="flex-row items-center justify-between px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
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
                        <View className="ml-4 border-l-2 border-gray-800 pl-2">
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
                        <Ionicons name="briefcase-outline" size={24} color="#3b82f6" />
                        <Text className="text-white text-lg ml-4 font-medium">Professional Hub</Text>
                        <View className="ml-2 bg-blue-500 px-2 py-0.5 rounded-full">
                            <Text className="text-[10px] text-white font-bold italic">PRO</Text>
                        </View>
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

                    {/* 10. Marketplace */}
                    <Pressable
                        onPress={() => props.navigation.navigate('MarketplaceScreen')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="cart-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Marketplace</Text>
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
                        <Ionicons name="megaphone-outline" size={24} color="#6366f1" />
                        <Text className="text-white text-lg ml-4 font-medium">Echo Hubs</Text>
                        <View className="ml-2 bg-indigo-600 px-2 py-0.5 rounded-full">
                            <Text className="text-[8px] text-white font-black italic">NEW</Text>
                        </View>
                    </Pressable>

                    {/* 13. Collaboration */}
                    <Pressable
                        onPress={() => props.navigation.navigate('CollaborationScreen')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="people-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Collaboration</Text>
                    </Pressable>


                    {/* 15. Paid Gigs */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PaidGigs')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="cash-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Paid Gigs</Text>
                    </Pressable>

                    {/* 16. Late Night Food removed */}

                    {/* 17. Campus Travel removed */}


                    {/* 18. Study Assistant */}
                    <Pressable
                        onPress={() => props.navigation.navigate('StudyAssistant')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="book-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Study Assistant</Text>
                    </Pressable>


                    {/* 18c. Placement Hub */}
                    <Pressable
                        onPress={() => props.navigation.navigate('PlacementHub')}
                        className="flex-row items-center px-4 py-4 rounded-xl mb-1 active:bg-gray-800"
                    >
                        <Ionicons name="business-outline" size={24} color="#f9a8d4" />
                        <Text className="text-white text-lg ml-4 font-medium">Placement Hub 🏢</Text>
                    </Pressable>



                </View>
            </DrawerContentScrollView>

            {/* Footer / Logout */}
            <View className="p-5 border-t border-gray-800 mb-5">
                <Pressable onPress={logout} className="flex-row items-center px-4 py-2">
                    <Ionicons name="log-out-outline" size={24} color="#ef4444" />
                    <Text className="text-red-500 ml-4 font-medium text-lg">Sign Out</Text>
                </Pressable>
            </View>
        </View>
    );
}