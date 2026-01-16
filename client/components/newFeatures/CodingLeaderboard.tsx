import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, Image, TextInput, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert, Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons, FontAwesome5, Octicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig'; 
import { useAuth } from '../../context/auth.context';

const BG_IMAGE = "https://images.unsplash.com/photo-1516116216624-53e697fedbea?q=80&w=1000&auto=format&fit=crop";
const LC_LOGO = "https://upload.wikimedia.org/wikipedia/commons/1/19/LeetCode_logo_black.png";

export default function CodingLeaderboard() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  const [activeScope, setActiveScope] = useState<'global' | 'college'>('college');
  const [timeFilter, setTimeFilter] = useState<'allTime' | 'weekly'>('allTime');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [lcData, setLcData] = useState<any>(null); 
  const [dbUser, setDbUser] = useState<any>(null); 

  // --- HELPER: Process Calendar Data ---
  const getActivityData = (calendarString: string) => {
      try {
          const calendar = JSON.parse(calendarString);
          const today = new Date();
          const last7Days = [];
          
          for (let i = 6; i >= 0; i--) {
              const d = new Date(today);
              d.setDate(d.getDate() - i);
              d.setHours(0, 0, 0, 0);
              const dateStr = d.toISOString().split('T')[0];
              let count = 0;
              Object.keys(calendar).forEach(ts => {
                  const submissionDate = new Date(parseInt(ts) * 1000).toISOString().split('T')[0];
                  if (submissionDate === dateStr) count += calendar[ts];
              });
              last7Days.push({ date: d, count, dayName: d.toLocaleDateString('en-US', { weekday: 'narrow' }) });
          }
          return last7Days;
      } catch (e) {
          return Array(7).fill({ count: 0, dayName: '-' });
      }
  };

  const fetchLeaderboard = async () => {
    try {
      if (!refreshing) setLoading(true);
      const res = await axios.get(`/leaderboard?scope=${activeScope}&type=${timeFilter}&search=${search}`);
      if (res.data.success) {
          const filtered = res.data.leaderboard.filter((u: any) => u.codingProfiles?.leetcode);
          setUsers(filtered);
      }
    } catch (error) {
      console.error("Leaderboard Error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleManualRefresh = async () => {
      setRefreshingStats(true);
      try {
          const res = await axios.post('/leaderboard/refresh');
          if (res.data.success) {
              const total = res.data.user.codingStats.totalSolved;
              Alert.alert("Synced! ⚡", `You have solved ${total} problems on LeetCode.`);
              fetchLeaderboard();
          }
      } catch (err) {
          Alert.alert("Error", "Check your LeetCode username in settings.");
      } finally {
          setRefreshingStats(false);
      }
  };

  const openUserProfile = async (userData: any) => {
      setDbUser(userData);
      setModalVisible(true);
      setProfileLoading(true);
      try {
          const res = await axios.get(`/leaderboard/user/${userData._id}`);
          if (res.data.success) {
              setLcData(res.data.data);
          }
      } catch (err) {
          console.error(err);
      } finally {
          setProfileLoading(false);
      }
  };

  const navigateToAppProfile = () => {
      setModalVisible(false);
      navigation.navigate("PublicProfile", { user: dbUser });
  };

  const openLeetCodeExternal = () => {
      if (dbUser?.codingProfiles?.leetcode) {
          Linking.openURL(`https://leetcode.com/${dbUser.codingProfiles.leetcode}`);
      }
  };

  useEffect(() => { fetchLeaderboard(); }, [activeScope, timeFilter]); 
  useEffect(() => { const t = setTimeout(fetchLeaderboard, 500); return () => clearTimeout(t); }, [search]);
  const onRefresh = () => { setRefreshing(true); fetchLeaderboard(); };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <TouchableOpacity onPress={() => openUserProfile(item)} className="flex-row items-center bg-[#1e1e1e]/90 p-4 mb-3 mx-4 rounded-2xl border border-white/10">
      <View className="w-10 items-center justify-center mr-2">
        {index < 3 ? (
            <MaterialCommunityIcons name="crown" size={24} color={index === 0 ? "#fbbf24" : index === 1 ? "#94a3b8" : "#78350f"} />
        ) : (
            <Text className="text-gray-400 font-bold text-lg">#{index + 1}</Text>
        )}
      </View>
      <Image source={{ uri: item.avatar }} className="w-12 h-12 rounded-full border border-white/10 bg-gray-800" />
      <View className="flex-1 ml-4">
        <Text className="text-white font-bold text-base" numberOfLines={1}>{item.name || item.username}</Text>
        <View className="flex-row items-center mt-1">
            <Image source={{ uri: LC_LOGO }} className="w-3 h-3 mr-1" resizeMode="contain" style={{ tintColor: '#ffa116' }} />
            <Text className="text-gray-500 text-[10px] uppercase">{item.college || "Global"}</Text>
        </View>
      </View>
      <View className="items-end">
        <Text className="text-orange-400 font-black text-xl">
            {timeFilter === 'weekly' ? (item.weeklyStats?.questionsThisWeek || 0) : (item.codingStats?.totalSolved || 0)}
        </Text>
        <Text className="text-gray-600 text-[10px] uppercase">{timeFilter === 'weekly' ? 'This Week' : 'Solved'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-black">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        <View className="px-6 pt-4 mb-4 flex-row justify-between items-center">
            <View>
                <Text className="text-white text-3xl font-black italic tracking-tighter">LEET<Text className="text-orange-500">RANK</Text> ⚡</Text>
            </View>
            <TouchableOpacity onPress={handleManualRefresh} disabled={refreshingStats} className={`p-3 rounded-full border ${refreshingStats ? 'border-orange-500 bg-orange-500/20' : 'border-gray-700 bg-gray-800'}`}>
                {refreshingStats ? <ActivityIndicator size="small" color="#fb923c" /> : <Ionicons name="refresh" size={20} color="white" />}
            </TouchableOpacity>
        </View>

        <View className="px-4 mb-4">
            <View className="flex-row items-center bg-gray-900/80 p-3 rounded-xl border border-white/10 mb-4">
                <Ionicons name="search" size={20} color="gray" />
                <TextInput placeholder="Search..." placeholderTextColor="#666" value={search} onChangeText={setSearch} className="flex-1 ml-3 text-white font-medium" />
            </View>
            <View className="flex-row justify-between gap-3">
                <View className="flex-1 flex-row bg-gray-900 rounded-lg p-1 border border-white/10">
                    {['college', 'global'].map(scope => (
                        <TouchableOpacity key={scope} onPress={() => setActiveScope(scope as any)} className={`flex-1 items-center py-2 rounded-md ${activeScope === scope ? 'bg-orange-600' : 'bg-transparent'}`}>
                            <Text className={`font-bold text-xs capitalize ${activeScope === scope ? 'text-white' : 'text-gray-400'}`}>{scope}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <View className="flex-1 flex-row bg-gray-900 rounded-lg p-1 border border-white/10">
                    <TouchableOpacity onPress={() => setTimeFilter('allTime')} className={`flex-1 items-center py-2 rounded-md ${timeFilter === 'allTime' ? 'bg-gray-700' : 'bg-transparent'}`}>
                        <Text className={`font-bold text-xs ${timeFilter === 'allTime' ? 'text-white' : 'text-gray-400'}`}>All Time</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTimeFilter('weekly')} className={`flex-1 items-center py-2 rounded-md ${timeFilter === 'weekly' ? 'bg-green-600' : 'bg-transparent'}`}>
                        <Text className={`font-bold text-xs ${timeFilter === 'weekly' ? 'text-white' : 'text-gray-400'}`}>Weekly</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>

        {loading && !refreshing ? (
            <ActivityIndicator size="large" color="#fb923c" className="mt-20" />
        ) : (
            <FlatList 
                data={users} keyExtractor={(item) => item._id} renderItem={renderItem}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                ListEmptyComponent={
                    <View className="items-center mt-20 opacity-50">
                        <FontAwesome5 name="code" size={50} color="gray" />
                        <Text className="text-gray-500 mt-4 font-bold">No LeetCoders found.</Text>
                    </View>
                }
            />
        )}

        {/* --- ULTRA DETAILED MODAL --- */}
        <Modal visible={modalVisible} transparent={true} animationType="slide" onRequestClose={() => setModalVisible(false)}>
            <BlurView intensity={100} tint="dark" className="flex-1 justify-end">
                
                {/* 🎨 CHANGED BACKGROUND COLOR HERE: bg-[#1A1A1A] */}
                <View className="bg-black h-[80%] rounded-t-3xl border-t border-white/10 p-6 shadow-2xl">
                    <View className="w-12 h-1 bg-gray-600 rounded-full self-center mb-4" />

                    {profileLoading || !lcData ? (
                        <ActivityIndicator size="large" color="#fb923c" className="mt-20" />
                    ) : (
                        <ScrollView showsVerticalScrollIndicator={false}>
                            
                            {/* 1. Header Profile */}
                            <View className="items-center mb-6">
                                <Image source={{ uri: lcData?.profile?.avatar }} className="w-24 h-24 rounded-full border-4 border-orange-500 bg-[#252525]" />
                                <Text className="text-white text-2xl font-black mt-3">{lcData.profile?.name || dbUser?.name}</Text>
                                <Text className="text-gray-400 text-sm">@{dbUser?.codingProfiles?.leetcode}</Text>
                                
                                {/* Buttons Row */}
                                <View className="flex-row mt-4 gap-3">
                                    {/* View App Profile */}
                                    <TouchableOpacity 
                                        onPress={navigateToAppProfile}
                                        className="flex-row items-center bg-[#2C2C2C] px-4 py-2.5 rounded-full border border-gray-700"
                                    >
                                        <Text className="text-white font-bold text-xs mr-2">App Profile</Text>
                                        <Ionicons name="person" size={14} color="white" />
                                    </TouchableOpacity>

                                    {/* 🔥 NEW: Open LeetCode External */}
                                    <TouchableOpacity 
                                        onPress={openLeetCodeExternal}
                                        className="flex-row items-center bg-[#2C2C2C] px-4 py-2.5 rounded-full border border-gray-700"
                                    >
                                        <Text className="text-white font-bold text-xs mr-2">LeetCode</Text>
                                        <Image source={{ uri: LC_LOGO }} className="w-3.5 h-3.5" style={{ tintColor: '#fb923c' }} />
                                    </TouchableOpacity>
                                </View>

                                {lcData.profile?.about && (
                                    <Text className="text-gray-400 text-xs text-center mt-4 px-4 leading-5" numberOfLines={3}>
                                        {lcData.profile.about}
                                    </Text>
                                )}

                                {/* Career Info */}
                                {(lcData.profile?.company || lcData.profile?.school) && (
                                    <View className="flex-row mt-4 gap-3 bg-[#252525] px-4 py-2 rounded-full border border-white/5">
                                        {lcData.profile?.company && (
                                            <View className="flex-row items-center">
                                                <Ionicons name="briefcase-outline" size={12} color="#9ca3af" />
                                                <Text className="text-gray-300 text-xs ml-1">{lcData.profile.company}</Text>
                                            </View>
                                        )}
                                        {lcData.profile?.school && (
                                            <View className="flex-row items-center">
                                                <Ionicons name="school-outline" size={12} color="#9ca3af" />
                                                <Text className="text-gray-300 text-xs ml-1" numberOfLines={1}>{lcData.profile.school}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Ranking Chips */}
                                <View className="flex-row mt-4 gap-2">
                                    <View className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/30">
                                        <Text className="text-yellow-500 font-bold text-xs">Global Rank #{lcData.profile?.ranking || "N/A"}</Text>
                                    </View>
                                    <View className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/30">
                                        <Text className="text-purple-400 font-bold text-xs">{lcData.profile?.country || "Global"}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 2. Solved Stats */}
                            <View className="flex-row gap-3 mb-8">
                                <View className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5 items-center justify-center">
                                    <Text className="text-3xl font-black text-white">{lcData.solved?.solvedProblem || 0}</Text>
                                    <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mt-1">Total</Text>
                                </View>
                                <View className="flex-1 space-y-2">
                                    <View className="flex-row justify-between bg-green-400/30 px-3 py-2 rounded-xl border border-green-400">
                                        <Text className="text-green-400 text-xs font-bold">Easy</Text>
                                        <Text className="text-white text-xs font-bold">{lcData.solved?.easySolved || 0}</Text>
                                    </View>
                                    <View className="flex-row justify-between bg-yellow-400/10 px-3 py-2 rounded-xl border border-yellow-400">
                                        <Text className="text-yellow-400 text-xs font-bold">Med</Text>
                                        <Text className="text-white text-xs font-bold">{lcData.solved?.mediumSolved || 0}</Text>
                                    </View>
                                    <View className="flex-row justify-between bg-red-500/10 px-3 py-2 rounded-xl border border-red-500/20">
                                        <Text className="text-red-500 text-xs font-bold">Hard</Text>
                                        <Text className="text-white text-xs font-bold">{lcData.solved?.hardSolved || 0}</Text>
                                    </View>
                                </View>
                            </View>

                            {/* 3. Activity Heatmap */}
                            <View className="mb-8 bg-white/5 p-5 rounded-3xl border border-white/5">
                                <Text className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Activity (Last 7 Days)</Text>
                                <View className="flex-row justify-between items-end">
                                    {getActivityData(lcData.submissionCalendar).map((day: any, i: number) => (
                                        <View key={i} className="items-center gap-2">
                                            {day.count > 0 ? (
                                                <View className="items-center">
                                                    <Text className="text-green-400 text-[9px] font-bold mb-1">{day.count}</Text>
                                                    <View className="w-3 h-8 bg-green-500 rounded-full shadow-lg shadow-green-500/50" />
                                                </View>
                                            ) : (
                                                <View className="w-3 h-3 bg-white/10 rounded-full" />
                                            )}
                                            <Text className="text-gray-500 text-[10px] font-bold uppercase">{day.dayName.slice(0,1)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* 4. Badges (Horizontal Scroll) */}
                            {lcData.badges && lcData.badges.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Badges ({lcData.badges.length})</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {lcData.badges.map((badge: any, i: number) => (
                                            <View key={i} className="mr-4 items-center w-20">
                                                <Image 
                                                    source={{ uri: badge.icon.startsWith("http") ? badge.icon : `https://leetcode.com${badge.icon}` }} 
                                                    className="w-12 h-12 mb-2" 
                                                    resizeMode="contain" 
                                                />
                                                <Text className="text-gray-500 text-[9px] text-center" numberOfLines={2}>{badge.displayName}</Text>
                                            </View>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* 5. Contest Rating */}
                            {lcData.contest && (
                                <View className="bg-[#252525] p-4 rounded-xl border border-white/5 mb-6 flex-row justify-between items-center">
                                    <View>
                                        <Text className="text-white font-bold text-base">Contest Rating</Text>
                                        <Text className="text-gray-500 text-xs">Top {lcData.contest.contestTopPercentage || 0}% Global</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-2xl font-black text-orange-400">{Math.round(lcData.contest.contestRating || 0)}</Text>
                                        <Text className="text-gray-600 text-[10px] uppercase">Rating</Text>
                                    </View>
                                </View>
                            )}

                            {/* 6. Skills Breakdown */}
                            {lcData.skills && (
                                <View className="mb-6">
                                    <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Top Skills</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {[...(lcData.skills.advanced || []), ...(lcData.skills.intermediate || [])]
                                            .sort((a:any, b:any) => b.problemsSolved - a.problemsSolved)
                                            .slice(0, 10)
                                            .map((skill: any, i: number) => (
                                                <View key={i} className="bg-[#2C2C2C] px-3 py-1.5 rounded-lg flex-row items-center border border-white/5">
                                                    <Text className="text-gray-300 text-[10px] font-bold mr-1">{skill.tagName}</Text>
                                                    <View className="bg-[#404040] px-1.5 rounded">
                                                        <Text className="text-white text-[9px]">{skill.problemsSolved}</Text>
                                                    </View>
                                                </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* 7. Languages */}
                            {lcData.languages && lcData.languages.length > 0 && (
                                <View className="mb-6">
                                    <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Languages</Text>
                                    <View className="flex-row flex-wrap gap-3">
                                        {lcData.languages.slice(0, 5).map((lang: any, i: number) => (
                                            <View key={i} className="flex-row items-center bg-[#252525] px-2 py-1 rounded border border-white/5">
                                                <Octicons name="dot-fill" size={10} color="#fb923c" />
                                                <Text className="text-gray-300 text-[10px] ml-1 font-bold">{lang.languageName}</Text>
                                                <Text className="text-gray-500 text-[10px] ml-1">({lang.problemsSolved})</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* 8. Recent Questions */}
                            <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Recently Solved</Text>
                            {lcData.recentSubmissions && lcData.recentSubmissions.length > 0 ? (
                                lcData.recentSubmissions.map((sub: any, i: number) => (
                                    <View key={i} className="flex-row justify-between items-center bg-[#252525] p-3 rounded-xl mb-2 border border-white/5">
                                        <View className="flex-1 mr-2">
                                            <Text className="text-white font-medium text-sm" numberOfLines={1}>{sub.title}</Text>
                                            <Text className="text-gray-500 text-[10px] mt-0.5">
                                                {new Date(parseInt(sub.timestamp) * 1000).toLocaleDateString()}
                                            </Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`text-[10px] font-bold px-2 py-0.5 rounded ${sub.statusDisplay === 'Accepted' ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}>
                                                {sub.statusDisplay}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            ) : (
                                <Text className="text-gray-600 italic ml-1">No recent activity.</Text>
                            )}

                            <TouchableOpacity onPress={() => setModalVisible(false)} className="mt-6 bg-[#333] py-4 rounded-xl items-center mb-8 border border-white/10">
                                <Text className="text-white font-bold">Close Profile</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    )}
                </View>
            </BlurView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}