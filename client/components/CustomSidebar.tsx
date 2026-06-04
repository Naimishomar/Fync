import React, { useState } from 'react';
import {
    View,
    Text,
    Image,
    Pressable,
    LayoutAnimation,
    Platform,
    UIManager,
    ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';

// Enable LayoutAnimation for Android (only if not on the New Architecture)
const isFabric = !!(global as any)._IS_FABRIC_;

if (
    Platform.OS === 'android' &&
    !isFabric &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    try {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    } catch (e) { }
}

export default function CustomSidebar(props: any) {
    const { user } = useAuth();

    // State for dropdowns
    const [showOpportunities, setShowOpportunities] = useState(false);
    const [showQuizzes, setShowQuizzes] = useState(false);
    const [showHackathons, setShowHackathons] = useState(false);

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
        <View className="flex-1 bg-[#F8FAFC]">
            <ScrollView contentContainerStyle={{ paddingBottom: 10 }} showsVerticalScrollIndicator={false} bounces={false}>
                {/* Header Profile Section with Gradient */}
                <LinearGradient 
                    colors={['#f97316', 'transparent']} 
                    className="pt-16 pb-6 px-6 w-full"
                >
                    <View className="flex-row justify-between items-start mb-5">
                        <Pressable 
                            onPress={() => props.navigation.navigate('Profile')}
                            className="flex-row items-center gap-4 flex-1 mr-4"
                        >
                            <Image
                                source={{ uri: user?.avatar?.trim() ? user.avatar : `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                                className="h-14 w-14 rounded-full border-[3px] border-white/30 bg-white/10"
                            />
                            <View className="flex-1 justify-center">
                                <Text className="text-white text-lg font-black tracking-tight leading-tight" numberOfLines={1}>
                                    {user?.name || user?.username || 'Fync User'}
                                </Text>
                                <Text className="text-white/80 text-[10px] font-bold mt-0.5 tracking-widest">
                                    @{user?.username || 'username'}
                                </Text>
                            </View>
                        </Pressable>
                        
                        <Pressable 
                            onPress={() => props.navigation.closeDrawer()}
                            className="w-9 h-9 bg-white rounded-full items-center justify-center border border-white/20 active:bg-black/20"
                        >
                            <Ionicons name="close" size={18} color="#FF4500" />
                        </Pressable>
                    </View>

                    {/* Score + Build Portfolio CTA */}
                    <Pressable
                        onPress={() => props.navigation.navigate('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-white/10 border border-white/20 px-4 py-3 rounded-3xl active:bg-white/20"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center border border-white/30">
                                <Text style={{ fontSize: 18 }}>
                                    {user?.fyncBadge === 'Legend' ? '🌟' : user?.fyncBadge === 'Pioneer' ? '🚀' : user?.fyncBadge === 'Innovator' ? '💡' : user?.fyncBadge === 'Builder' ? '🔨' : user?.fyncBadge === 'Explorer' ? '🗺️' : '🌱'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-white/80 text-[10px] font-black uppercase tracking-widest mb-0.5">{user?.fyncBadge || 'Newcomer'}</Text>
                                <Text className="text-white text-base font-black uppercase tracking-tight">
                                    {user?.fyncScore || 0} <Text className="text-white/60 text-[9px] font-bold tracking-widest">/ 1000</Text>
                                </Text>
                            </View>
                        </View>
                        <View className="w-8 h-8 bg-white rounded-xl items-center justify-center shadow-lg shadow-black/20">
                            <Ionicons name="arrow-forward" size={14} color="#FF4500" />
                        </View>
                    </Pressable>
                </LinearGradient>

                {/* Menu Items */}
                <View className="pb-12 pt-2">

                    {/* ========================================= */}
                    {/*             ACADEMIC & STUDY              */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-3">Academic & Study</Text>
                    
                    <Pressable onPress={() => props.navigation.navigate('StudyAssistant')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="book-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Study Assistant</Text>
                    </Pressable>
                    
                    <Pressable onPress={() => props.navigation.navigate('DriveFolderScreen', { folderId: '1idOWdlHnISpZVvvY0Ett8O_uJALAf_Qv', title: 'B.Tech' })} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="folder-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Study Material</Text>
                    </Pressable>
                    
                    <Pressable onPress={() => props.navigation.navigate('FocusProductivity')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="timer-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Focus Mode</Text>
                    </Pressable>
                    
                    <Pressable onPress={() => props.navigation.navigate('BunkOMeter')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="flashlight-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">BunkOMeter</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*             CAREER & GROWTH               */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Career & Growth</Text>
                    
                    <Pressable onPress={toggleOpportunities} className="flex-row items-center justify-between px-6 py-3 active:bg-slate-100">
                        <View className="flex-row items-center">
                            <Ionicons name="briefcase-outline" size={22} color="#FF4500" />
                            <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Opportunities</Text>
                        </View>
                        <Ionicons name={showOpportunities ? "chevron-up" : "chevron-down"} size={16} color="#FF4500" />
                    </Pressable>

                    {showOpportunities && (
                        <View className="ml-10 pl-4 border-l-2 border-slate-200 mb-1">
                            <Pressable onPress={() => props.navigation.navigate('InternshipList')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="school-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Internships</Text>
                            </Pressable>
                            <Pressable onPress={() => props.navigation.navigate('JobList')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="business-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Jobs</Text>
                            </Pressable>
                            <Pressable onPress={() => props.navigation.navigate('WorkshopList')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="book-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Workshops</Text>
                            </Pressable>
                        </View>
                    )}

                    <Pressable onPress={() => props.navigation.navigate('PlacementHub')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="business-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Placement Hub</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('PaidGigs')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="cash-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Paid Gigs</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*          EVENTS & COMPETITIONS            */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Events & Competitions</Text>

                    <Pressable onPress={toggleHackathons} className="flex-row items-center justify-between px-6 py-3 active:bg-slate-100">
                        <View className="flex-row items-center">
                            <Ionicons name="rocket-outline" size={22} color="#FF4500" />
                            <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Hackathon Hub</Text>
                        </View>
                        <Ionicons name={showHackathons ? "chevron-up" : "chevron-down"} size={16} color="#FF4500" />
                    </Pressable>

                    {showHackathons && (
                        <View className="ml-10 pl-4 border-l-2 border-slate-200 mb-1">
                            <Pressable onPress={() => props.navigation.navigate('HackathonHub')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="search-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Browse</Text>
                            </Pressable>
                        </View>
                    )}

                    <Pressable onPress={toggleQuizzes} className="flex-row items-center justify-between px-6 py-3 active:bg-slate-100">
                        <View className="flex-row items-center">
                            <Ionicons name="game-controller-outline" size={22} color="#FF4500" />
                            <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Quizzes</Text>
                        </View>
                        <Ionicons name={showQuizzes ? "chevron-up" : "chevron-down"} size={16} color="#FF4500" />
                    </Pressable>

                    {showQuizzes && (
                        <View className="ml-10 pl-4 border-l-2 border-slate-200 mb-1">
                            <Pressable onPress={() => props.navigation.navigate('OneVsOneSetup')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="people-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">1v1 Battle</Text>
                            </Pressable>
                            <Pressable onPress={() => props.navigation.navigate('CreateRoom')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="add-circle-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Create Room</Text>
                            </Pressable>
                            <Pressable onPress={() => props.navigation.navigate('JoinRoomInput')} className="flex-row items-center py-2.5 active:opacity-50">
                                <Ionicons name="enter-outline" size={16} color="#FF4500" />
                                <Text className="text-slate-600 text-xs ml-3 font-bold uppercase tracking-widest">Join Room</Text>
                            </Pressable>
                        </View>
                    )}

                    <Pressable onPress={() => props.navigation.navigate('CodingLeaderboard')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="code-slash-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Coding Leaderboard</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*           SOCIAL & NETWORKING             */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Social & Networking</Text>

                    <Pressable onPress={() => props.navigation.navigate('FindAlumni')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="school-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Campus Alumni</Text>
                    </Pressable>

                    {user?.user_access === 'alumni' && (
                        <Pressable onPress={() => props.navigation.navigate('AlumniConnect')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                            <Ionicons name="chatbubbles-outline" size={22} color="#FF4500" />
                            <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Alumni Connect</Text>
                            <View className="ml-auto bg-orange-100 px-2.5 py-1 rounded-full border border-orange-200">
                                <Text className="text-[9px] text-orange-600 font-black uppercase tracking-widest">Exclusive</Text>
                            </View>
                        </Pressable>
                    )}

                    <Pressable onPress={() => props.navigation.navigate('FindTeammate')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="people-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Find Teammate</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('CommunityList')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="megaphone-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Community Hubs</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('ClubList')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="people-circle-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">College Clubs</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*         CAMPUS LIFE & MARKETPLACE         */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Campus & Marketplace</Text>

                    <Pressable onPress={() => props.navigation.navigate('NoticeBoard')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="notifications-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Notice Board</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('OLXMarketplace')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="cart-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Campus OLX</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('LostAndFound')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="search-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">Lost & Found</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('RewardsMarketplace')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="gift-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight flex-1">Rewards Store</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*            FUN & ENTERTAINMENT            */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Fun & Entertainment</Text>

                    <Pressable onPress={() => props.navigation.navigate('ConfessionFeed')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight flex-1">Confession Feed</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('TwelveAMHomeCard')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="moon-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight">12 AM Night Club</Text>
                    </Pressable>

                    <Pressable onPress={() => props.navigation.navigate('EntertainmentHome')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="film-outline" size={22} color="#FF4500" />
                        <Text className="text-zinc-900 text-sm ml-4 font-black uppercase tracking-tight flex-1">Entertainment</Text>
                    </Pressable>


                    {/* ========================================= */}
                    {/*             SUPPORT & ADMIN               */}
                    {/* ========================================= */}
                    <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1 px-6 mt-4">Support</Text>

                    <Pressable onPress={() => props.navigation.navigate('ContactUs')} className="flex-row items-center px-6 py-3 active:bg-slate-100">
                        <Ionicons name="headset-outline" size={22} color="#FF4500" />
                        <Text className="text-slate-700 text-sm ml-4 font-black uppercase tracking-tight">Contact Us</Text>
                    </Pressable>

                    {user?.user_access === 'admin' && (
                        <Pressable onPress={() => props.navigation.navigate('AdminPortal')} className="flex-row items-center px-6 py-3 bg-rose-50 border-y border-rose-100 active:bg-rose-100 mt-2 rounded-2xl mx-4">
                            <Ionicons name="shield-checkmark-outline" size={22} color="#FF4500" />
                            <Text className="text-rose-600 text-sm ml-4 font-black uppercase tracking-tight flex-1">Admin Portal</Text>
                            <View className="bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                                <Text className="text-[9px] text-rose-600 font-bold">ADMIN</Text>
                            </View>
                        </Pressable>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}
