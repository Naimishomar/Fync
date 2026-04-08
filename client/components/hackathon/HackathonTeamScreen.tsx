import React, { useEffect, useState, useCallback, memo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Alert,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TeamMember {
  user: { _id: string; name: string; avatar?: string; skills?: string[] };
  role: 'leader' | 'member';
  joinedAt: string;
}

interface Team {
  _id: string;
  name: string;
  description?: string;
  leader: { _id: string; name: string; avatar?: string; skills?: string[] };
  members: TeamMember[];
  requiredSkills?: string[];
  lookingForMembers: boolean;
  isLocked: boolean;
  hackathon?: { maxTeamSize: number; title: string };
}

interface ScoredTeam {
  team: Team;
  score: number;
}

const TABS = ['Matched For You', 'All Teams', 'My Team'];

// ─── Team Card ────────────────────────────────────────────────────────────────
const TeamCard = memo(({
  team,
  score,
  myTeam,
  userId,
  onRequest,
  onViewTeam,
}: {
  team: Team;
  score?: number;
  myTeam: boolean;
  userId: string;
  onRequest: (teamId: string) => void;
  onViewTeam: (team: Team) => void;
}) => {
  const iLeader = team.leader?._id === userId;
  const iMember = team.members?.some(m => m.user?._id === userId);

  return (
    <TouchableOpacity
      onPress={() => onViewTeam(team)}
      activeOpacity={0.88}
      className="bg-white rounded-2xl p-4 mb-3 border border-slate-100"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
    >
      {/* Header row */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-zinc-900 font-black italic text-base leading-5">{team.name}</Text>
          {team.description && (
            <Text className="text-slate-500 text-xs mt-1 leading-4" numberOfLines={2}>{team.description}</Text>
          )}
        </View>
        {score !== undefined && (
          <View className="bg-indigo-100 rounded-xl px-2.5 py-1">
            <Text className="text-indigo-600 font-black text-xs">{Math.round(score * 100)}% match</Text>
          </View>
        )}
        {(myTeam || iLeader || iMember) && (
          <View className="bg-emerald-100 rounded-xl px-2.5 py-1">
            <Text className="text-emerald-700 font-black text-[10px] uppercase">Your Team</Text>
          </View>
        )}
      </View>

      {/* Members */}
      <View className="flex-row items-center mb-3">
        <View className="flex-row mr-2">
          {team.members?.slice(0, 4).map((m, i) => (
            <View key={i} style={{ marginLeft: i > 0 ? -8 : 0, zIndex: 4 - i }}>
              {m.user?.avatar ? (
                <Image source={{ uri: m.user.avatar }} className="w-7 h-7 rounded-full border-2 border-white" />
              ) : (
                <View className="w-7 h-7 rounded-full bg-indigo-100 border-2 border-white items-center justify-center">
                  <Ionicons name="person" size={11} color="#6366f1" />
                </View>
              )}
            </View>
          ))}
        </View>
        <Text className="text-slate-500 text-xs font-semibold ml-1">
          {team.members?.length ?? 0} member{team.members?.length !== 1 ? 's' : ''}
        </Text>
        {!team.lookingForMembers && (
          <View className="ml-auto bg-red-50 border border-red-100 rounded-lg px-2 py-0.5">
            <Text className="text-red-500 text-[10px] font-black">Closed</Text>
          </View>
        )}
        {team.lookingForMembers && (
          <View className="ml-auto bg-green-50 border border-green-100 rounded-lg px-2 py-0.5">
            <Text className="text-green-600 text-[10px] font-black">Open 🟢</Text>
          </View>
        )}
      </View>

      {/* Required Skills */}
      {team.requiredSkills && team.requiredSkills.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {team.requiredSkills.slice(0, 5).map((s, i) => (
            <View key={i} className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
              <Text className="text-slate-600 text-[10px] font-black">{s}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Leader */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          {team.leader?.avatar ? (
            <Image source={{ uri: team.leader.avatar }} className="w-5 h-5 rounded-full mr-1.5" />
          ) : (
            <View className="w-5 h-5 rounded-full bg-amber-100 items-center justify-center mr-1.5">
              <Ionicons name="person" size={9} color="#d97706" />
            </View>
          )}
          <Text className="text-slate-500 text-[11px] font-semibold">Leader: {team.leader?.name}</Text>
        </View>

        {/* Action button */}
        {!iMember && !iLeader && team.lookingForMembers && !team.isLocked && (
          <TouchableOpacity
            onPress={() => onRequest(team._id)}
            className="bg-indigo-600 rounded-xl px-3 py-1.5"
          >
            <Text className="text-white font-black text-[11px] uppercase">Request</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── Create Team Modal ────────────────────────────────────────────────────────
const CreateTeamModal = ({
  visible,
  hackathonId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  hackathonId: string;
  onClose: () => void;
  onCreated: () => void;
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) setSkills(p => [...p, s]);
    setSkillInput('');
  };

  const submit = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Team name is required' });
      return;
    }
    setLoading(true);
    try {
      await axios.post('/teams', {
        hackathonId,
        name: name.trim(),
        description: description.trim(),
        requiredskill: skills,
        isLocked: false,
      });
      Toast.show({ type: 'success', text1: 'Team created! 🚀' });
      onCreated();
      onClose();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not create team' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-[#F8FAFC]">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 bg-white">
            <Text className="text-zinc-900 font-black italic text-xl">Create Team</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 px-5 pt-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Team Name */}
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Team Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Night Owls"
              placeholderTextColor="#94a3b8"
              className="bg-white rounded-2xl px-4 py-3.5 text-zinc-900 font-semibold border border-slate-200 mb-5"
            />

            {/* Description */}
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What are you building?"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-white rounded-2xl px-4 py-3.5 text-zinc-900 font-semibold border border-slate-200 mb-5 h-24"
            />

            {/* Required Skills */}
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Required Skills</Text>
            <View className="flex-row mb-3">
              <TextInput
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                placeholder="e.g. React Native, ML"
                placeholderTextColor="#94a3b8"
                className="flex-1 bg-white rounded-2xl px-4 py-3 text-zinc-900 font-semibold border border-slate-200 mr-2"
              />
              <TouchableOpacity
                onPress={addSkill}
                className="bg-indigo-600 rounded-2xl px-4 items-center justify-center"
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {skills.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSkills(p => p.filter(x => x !== s))}
                  className="flex-row items-center bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-indigo-700 font-black text-xs mr-1">{s}</Text>
                  <Ionicons name="close" size={10} color="#4338ca" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Submit */}
          <View className="px-5 pb-8 pt-4 bg-white border-t border-slate-100">
            <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.88}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-2xl">
                <View className="py-4 items-center">
                  {loading
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text className="text-white font-black italic text-sm uppercase tracking-widest">Create Team 🚀</Text>
                  }
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonTeamScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId, mode } = route.params ?? {};
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState(mode === 'create' ? 2 : 0);
  const [matchedTeams, setMatchedTeams] = useState<ScoredTeam[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [requestMsg, setRequestMsg] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);

  useEffect(() => {
    if (activeTab === 0) loadMatchedTeams();
    if (activeTab === 1) loadAllTeams();
    if (activeTab === 2) loadMyTeam();
  }, [activeTab]);

  const loadMatchedTeams = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/teams/match/${hackathonId}`);
      setMatchedTeams(res.data.teams ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const loadAllTeams = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/teams', { params: { hackathon: hackathonId } });
      setAllTeams(res.data.teams ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const loadMyTeam = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/teams', { params: { hackathon: hackathonId } });
      const teams: Team[] = res.data.teams ?? [];
      const mine = teams.find(t =>
        t.leader?._id === user?._id ||
        t.members?.some(m => m.user?._id === user?._id)
      );
      setMyTeam(mine ?? null);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const sendRequest = async () => {
    if (!selectedTeam) return;
    setSendingRequest(true);
    try {
      await axios.post(`/teams/${selectedTeam._id}/request`, { message: requestMsg || 'I would love to join your team!' });
      Toast.show({ type: 'success', text1: 'Request sent!' });
      setShowRequestModal(false);
      setRequestMsg('');
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not send request' });
    } finally {
      setSendingRequest(false);
    }
  };

  const handleLeaveTeam = () => {
    if (!myTeam) return;
    Alert.alert('Leave Team', 'Are you sure you want to leave this team?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await axios.post(`/teams/${myTeam._id}/leave`);
            Toast.show({ type: 'success', text1: 'Left team' });
            setMyTeam(null);
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Error' });
          }
        }
      }
    ]);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
            <Ionicons name="arrow-back" size={22} color="#1e293b" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-zinc-900 text-xl font-black italic tracking-tight">Teams</Text>
            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Find your squad</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            className="bg-indigo-600 rounded-2xl px-4 py-2.5"
          >
            <Text className="text-white font-black text-xs uppercase">+ Create</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 4 }}
        >
          {TABS.map((tab, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => setActiveTab(i)}
              className={`px-5 py-2.5 rounded-2xl border ${activeTab === i ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}
            >
              <Text className={`font-black text-xs uppercase tracking-wide ${activeTab === i ? 'text-white' : 'text-slate-500'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#6366f1" />
          </View>
        ) : (
          <>
            {/* Matched Teams */}
            {activeTab === 0 && (
              <FlatList
                data={matchedTeams}
                keyExtractor={item => item.team._id}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TeamCard
                    team={item.team}
                    score={item.score}
                    myTeam={false}
                    userId={user?._id}
                    onRequest={(teamId) => {
                      setSelectedTeam(item.team);
                      setShowRequestModal(true);
                    }}
                    onViewTeam={setSelectedTeam}
                  />
                )}
                ListEmptyComponent={() => (
                  <View className="items-center py-16">
                    <LinearGradient colors={['#ede9fe', '#fce7f3']} className="w-20 h-20 rounded-3xl items-center justify-center mb-4">
                      <Ionicons name="analytics-outline" size={36} color="#6366f1" />
                    </LinearGradient>
                    <Text className="text-zinc-700 font-black italic text-base uppercase">No Matches Yet</Text>
                    <Text className="text-slate-400 text-xs mt-1 text-center px-8">
                      Update your profile skills to get skill-matched with teams
                    </Text>
                  </View>
                )}
              />
            )}

            {/* All Teams */}
            {activeTab === 1 && (
              <FlatList
                data={allTeams}
                keyExtractor={item => item._id}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TeamCard
                    team={item}
                    myTeam={item.leader?._id === user?._id || item.members?.some(m => m.user?._id === user?._id)}
                    userId={user?._id}
                    onRequest={(teamId) => {
                      setSelectedTeam(item);
                      setShowRequestModal(true);
                    }}
                    onViewTeam={setSelectedTeam}
                  />
                )}
                ListEmptyComponent={() => (
                  <View className="items-center py-16">
                    <Ionicons name="people-outline" size={48} color="#cbd5e1" />
                    <Text className="text-slate-400 font-black italic text-base mt-3">No teams yet</Text>
                    <Text className="text-slate-300 text-xs mt-1">Be the first to create one!</Text>
                  </View>
                )}
              />
            )}

            {/* My Team */}
            {activeTab === 2 && (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                {myTeam ? (
                  <View>
                    {/* Team header */}
                    <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-3xl p-5 mb-4">
                      <Text className="text-white text-xs font-black uppercase tracking-widest mb-1">Your Team</Text>
                      <Text className="text-white text-2xl font-black italic">{myTeam.name}</Text>
                      {myTeam.description && (
                        <Text className="text-indigo-200 text-xs mt-2 leading-4">{myTeam.description}</Text>
                      )}
                      <View className="flex-row items-center mt-3">
                        <View className={`px-3 py-1 rounded-full ${myTeam.lookingForMembers ? 'bg-green-400' : 'bg-white/20'}`}>
                          <Text className="text-white font-black text-[11px]">
                            {myTeam.lookingForMembers ? 'Open 🟢' : 'Closed 🔒'}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>

                    {/* Members */}
                    <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                      <Text className="text-zinc-900 font-black italic mb-3">👥 Members ({myTeam.members?.length})</Text>
                      {myTeam.members?.map((m, i) => (
                        <View key={i} className="flex-row items-center mb-3 last:mb-0">
                          {m.user?.avatar ? (
                            <Image source={{ uri: m.user.avatar }} className="w-10 h-10 rounded-full" />
                          ) : (
                            <View className="w-10 h-10 rounded-full bg-indigo-100 items-center justify-center">
                              <Ionicons name="person" size={18} color="#6366f1" />
                            </View>
                          )}
                          <View className="ml-3 flex-1">
                            <Text className="text-zinc-800 font-black text-sm">{m.user?.name}</Text>
                            <Text className="text-slate-400 text-[11px] capitalize">{m.role}</Text>
                          </View>
                          {m.role === 'leader' && (
                            <View className="bg-amber-100 rounded-lg px-2 py-0.5">
                              <Text className="text-amber-700 font-black text-[10px]">👑 Leader</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Required skills */}
                    {myTeam.requiredSkills && myTeam.requiredSkills.length > 0 && (
                      <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-100">
                        <Text className="text-zinc-900 font-black italic mb-3">🛠 Required Skills</Text>
                        <View className="flex-row flex-wrap gap-2">
                          {myTeam.requiredSkills.map((s, i) => (
                            <View key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5">
                              <Text className="text-indigo-600 font-black text-xs">{s}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Leave button (non-leaders only) */}
                    {myTeam.leader?._id !== user?._id && (
                      <TouchableOpacity
                        onPress={handleLeaveTeam}
                        className="border border-red-200 rounded-2xl py-4 items-center"
                      >
                        <Text className="text-red-500 font-black uppercase tracking-wide text-sm">Leave Team</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View className="items-center py-16">
                    <LinearGradient colors={['#ede9fe', '#fce7f3']} className="w-24 h-24 rounded-3xl items-center justify-center mb-5">
                      <Ionicons name="people-outline" size={42} color="#6366f1" />
                    </LinearGradient>
                    <Text className="text-zinc-700 font-black italic text-xl uppercase mb-2">No Team Yet</Text>
                    <Text className="text-slate-400 text-xs text-center px-8 mb-6">
                      Create your own team or join an open one for this hackathon!
                    </Text>
                    <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.88}>
                      <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-2xl px-8 py-3.5">
                        <Text className="text-white font-black text-sm uppercase tracking-wide">Create Team</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}
          </>
        )}
      </SafeAreaView>

      {/* Create Team Modal */}
      <CreateTeamModal
        visible={showCreate}
        hackathonId={hackathonId}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setActiveTab(2); loadMyTeam(); }}
      />

      {/* Join Request Modal */}
      <Modal visible={showRequestModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 bg-white">
            <Text className="text-zinc-900 font-black italic text-xl">Request to Join</Text>
            <TouchableOpacity onPress={() => setShowRequestModal(false)}>
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          <View className="flex-1 px-5 pt-5">
            {selectedTeam && (
              <View className="bg-indigo-50 rounded-2xl p-4 mb-5 border border-indigo-100">
                <Text className="text-indigo-700 font-black text-base italic">{selectedTeam.name}</Text>
                <Text className="text-indigo-400 text-xs mt-0.5">Led by {selectedTeam.leader?.name}</Text>
              </View>
            )}
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Message (optional)</Text>
            <TextInput
              value={requestMsg}
              onChangeText={setRequestMsg}
              placeholder="Tell the leader why you'd like to join..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-white rounded-2xl px-4 py-3.5 text-zinc-900 font-semibold border border-slate-200 h-28"
            />
          </View>
          <View className="px-5 pb-8 bg-white border-t border-slate-100 pt-4">
            <TouchableOpacity onPress={sendRequest} disabled={sendingRequest} activeOpacity={0.88}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-2xl">
                <View className="py-4 items-center">
                  {sendingRequest
                    ? <ActivityIndicator size="small" color="white" />
                    : <Text className="text-white font-black italic text-sm uppercase tracking-widest">Send Request</Text>
                  }
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default HackathonTeamScreen;
