import React, { useEffect, useState, useCallback, memo } from 'react';
import {View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, Image, ScrollView, Modal} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import { Alert } from '../ui/AlertModal';

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

interface JoinRequest {
  _id: string;
  user: { _id: string; name: string; avatar?: string; skills?: string[] };
  message?: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
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
      className="bg-card rounded-card p-4 mb-3 border border-line"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}
    >
      {/* Header row */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-ink font-semibold text-base leading-5">{team.name}</Text>
          {team.description && (
            <Text className="text-ink-3 text-xs mt-1 leading-4" numberOfLines={2}>{team.description}</Text>
          )}
        </View>
        {score !== undefined && (
          <View className="bg-brand-100 rounded-xl px-2.5 py-1">
            <Text className="text-brand-600 font-semibold text-xs">{Math.round(score * 100)}% match</Text>
          </View>
        )}
        {(myTeam || iLeader || iMember) && (
          <View className="bg-success/15 rounded-xl px-2.5 py-1">
            <Text className="text-success font-semibold text-label">Your Team</Text>
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
                <View className="w-7 h-7 rounded-full bg-brand-100 border-2 border-white items-center justify-center">
                  <Ionicons name="person" size={11} color="#F97316" />
                </View>
              )}
            </View>
          ))}
        </View>
        <Text className="text-ink-3 text-xs font-semibold ml-1">
          {team.members?.length ?? 0} member{team.members?.length !== 1 ? 's' : ''}
        </Text>
        {!team.lookingForMembers && (
          <View className="ml-auto bg-danger/10 border border-danger/15 rounded-lg px-2 py-0.5">
            <Text className="text-danger text-label font-semibold">Closed</Text>
          </View>
        )}
        {team.lookingForMembers && (
          <View className="ml-auto bg-success/10 border border-success/15 rounded-lg px-2 py-0.5">
            <Text className="text-success text-label font-semibold">Open</Text>
          </View>
        )}
      </View>

      {/* Required Skills */}
      {team.requiredSkills && team.requiredSkills.length > 0 && (
        <View className="flex-row flex-wrap gap-1.5 mb-3">
          {team.requiredSkills.slice(0, 5).map((s, i) => (
            <View key={i} className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
              <Text className="text-ink-2 text-label font-semibold">{s}</Text>
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
            <View className="w-5 h-5 rounded-full bg-warning/15 items-center justify-center mr-1.5">
              <Ionicons name="person" size={9} color="#B45309" />
            </View>
          )}
          <Text className="text-ink-3 text-label font-semibold">Leader: {team.leader?.name}</Text>
        </View>

        {/* Action button */}
        {!iMember && !iLeader && team.lookingForMembers && !team.isLocked && (
          <TouchableOpacity
            onPress={() => onRequest(team._id)}
            className="bg-ink rounded-xl px-3 py-1.5"
          >
            <Text className="font-display text-label text-white uppercase">Request</Text>
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
      Toast.show({ type: 'success', text1: 'Team created!' });
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
      <View className="flex-1 bg-paper">
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-line bg-card">
            <Text className="text-ink font-display text-xl">Create Team</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#8B857E" />
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 px-5 pt-5"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Team Name */}
            <Text className="text-ink-3 text-label font-semibold mb-2">Team Name *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Night Owls"
              placeholderTextColor="#8B857E"
              className="bg-card px-4 py-3.5 text-ink font-semibold border-[1.5px] border-ink mb-5 rounded-md"
            />

            {/* Description */}
            <Text className="text-ink-3 text-label font-semibold mb-2">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What are you building?"
              placeholderTextColor="#8B857E"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="bg-card px-4 py-3.5 text-ink font-semibold border-[1.5px] border-ink mb-5 h-24 rounded-md"
            />

            {/* Required Skills */}
            <Text className="text-ink-3 text-label font-semibold mb-2">Required Skills</Text>
            <View className="flex-row mb-3">
              <TextInput
                value={skillInput}
                onChangeText={setSkillInput}
                onSubmitEditing={addSkill}
                placeholder="e.g. React Native, ML"
                placeholderTextColor="#8B857E"
                className="flex-1 bg-paper px-4 py-3 text-ink font-semibold border-[1.5px] border-ink mr-2 rounded-md"
              />
              <TouchableOpacity
                onPress={addSkill}
                className="bg-ink px-4 items-center justify-center border-2 border-ink rounded-md"
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2 mb-6">
              {skills.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => setSkills(p => p.filter(x => x !== s))}
                  className="flex-row items-center bg-brand-100 border border-brand-200 rounded-xl px-3 py-1.5"
                >
                  <Text className="text-brand-700 font-semibold text-xs mr-1">{s}</Text>
                  <Ionicons name="close" size={10} color="#EA580C" />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Submit */}
          <View className="px-5 pb-8 pt-4 bg-card border-t border-line">
            <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.88}>
              <View className="rounded-card" style={{ backgroundColor: '#F97316' }}>
                <View className="py-4 items-center">
                  {loading
                    ? <ActivityIndicator size="small" color="#12100E" />
                    : <Text className="text-ink font-semibold text-sm">Create Team</Text>
                  }
                </View>
              </View>
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

  const [incomingRequests, setIncomingRequests] = useState<JoinRequest[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

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

      if (mine && mine.leader?._id === user?._id) {
        // There is no GET /teams/:id/requests — that URL fell through to
        // getTeam, whose payload has no `.requests`, so the list was always
        // empty. getTeam already populates joinRequests.from.
        const reqRes = await axios.get(`/teams/${mine._id}`);
        const raw = reqRes.data.team?.joinRequests ?? [];
        setIncomingRequests(
          raw
            .filter((r: any) => r.status === 'pending')
            .map((r: any) => ({ ...r, user: r.from }))
        );
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = async (requestId: string, status: 'accepted' | 'rejected') => {
    if (!myTeam) return;
    setRespondingTo(requestId);
    try {
      // Route is /request/respond, and the controller reads `action`, not `status`.
      await axios.post(`/teams/${myTeam._id}/request/respond`, {
        requestId,
        action: status === 'accepted' ? 'accept' : 'decline',
      });
      Toast.show({ type: 'success', text1: `Request ${status === 'accepted' ? 'accepted' : 'rejected'}` });
      loadMyTeam(); // Refresh
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Action failed' });
    } finally {
      setRespondingTo(null);
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={22} color="#12100E" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-ink text-xl font-display">Teams</Text>
            <Text className="text-ink-3 text-label font-semibold">Find your squad</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            className="bg-ink rounded-card px-4 py-2.5"
          >
            <Text className="text-white font-semibold text-xs">+ Create</Text>
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
              className={`px-5 py-2.5 rounded-card border ${activeTab === i ? 'bg-ink border-ink' : 'bg-card border-line'}`}
            >
              <Text className={`font-semibold text-xs ${activeTab === i ? 'text-white' : 'text-ink-3'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
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
                    <View className="w-20 h-20 rounded-card items-center justify-center mb-4" style={{ backgroundColor: '#EDE8E0' }}>
                      <Ionicons name="analytics-outline" size={36} color="#F97316" />
                    </View>
                    <Text className="text-ink-2 font-semibold text-base">No Matches Yet</Text>
                    <Text className="text-ink-3 text-xs mt-1 text-center px-gutter">
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
                    <Ionicons name="people-outline" size={48} color="#C4BEB6" />
                    <Text className="text-ink-3 font-semibold text-base mt-3">No teams yet</Text>
                    <Text className="text-ink-4 text-xs mt-1">Be the first to create one!</Text>
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
                    <View className="rounded-card p-5 mb-4" style={{ backgroundColor: '#F97316' }}>
                      <Text className="text-white text-xs font-semibold mb-1">Your Team</Text>
                      <Text className="text-white text-2xl font-display">{myTeam.name}</Text>
                      {myTeam.description && (
                        <Text className="text-ink-4 text-xs mt-2 leading-4">{myTeam.description}</Text>
                      )}
                      <View className="flex-row items-center mt-3">
                        <View className={`px-3 py-1 rounded-full ${myTeam.lookingForMembers ? 'bg-success' : 'bg-card/20'}`}>
                          <Text className="font-display text-label text-white uppercase">
                            {myTeam.lookingForMembers ? 'Open' : 'Closed'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {/* Members */}
                    <View className="bg-card rounded-card p-4 mb-4 border border-line">
                      <Text className="font-display text-label text-ink uppercase mb-3">Members ({myTeam.members?.length})</Text>
                      {myTeam.members?.map((m, i) => (
                        <View key={i} className="flex-row items-center mb-3 last:mb-0">
                          {m.user?.avatar ? (
                            <Image source={{ uri: m.user.avatar }} className="w-10 h-10 rounded-full" />
                          ) : (
                            <View className="w-10 h-10 rounded-full bg-brand-100 items-center justify-center">
                              <Ionicons name="person" size={18} color="#F97316" />
                            </View>
                          )}
                          <View className="ml-3 flex-1">
                            <Text className="text-ink font-semibold text-sm">{m.user?.name}</Text>
                            <Text className="text-ink-3 text-label capitalize">{m.role}</Text>
                          </View>
                          {m.role === 'leader' && (
                            <View className="bg-warning/15 rounded-lg px-2 py-0.5">
                              <Text className="font-display text-label text-warning uppercase">Leader</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Required skills */}
                    {myTeam.requiredSkills && myTeam.requiredSkills.length > 0 && (
                      <View className="bg-card rounded-card p-4 mb-4 border border-line">
                        <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                          <Text className="font-display text-label text-ink uppercase">Required Skills</Text>
                          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                          {myTeam.requiredSkills.map((s, i) => (
                            <View key={i} className="bg-paper-2 border border-line rounded-xl px-3 py-1.5">
                              <Text className="text-brand-600 font-semibold text-xs">{s}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Incoming Requests (Leader only) */}
                    {myTeam.leader?._id === user?._id && incomingRequests.length > 0 && (
                      <View className="mb-4">
                        <Text className="font-display text-label text-ink uppercase mb-3">Pending Requests ({incomingRequests.length})</Text>
                        {incomingRequests.map((req) => (
                          <View key={req._id} className="bg-card rounded-card p-4 mb-3 border border-line border-l-4 border-l-recruiter">
                            <View className="flex-row items-center justify-between mb-2">
                              <View className="flex-row items-center">
                                {req.user?.avatar ? (
                                  <Image source={{ uri: req.user.avatar }} className="w-8 h-8 rounded-full" />
                                ) : (
                                  <View className="w-8 h-8 rounded-full bg-paper-2 items-center justify-center">
                                    <Ionicons name="person" size={14} color="#8B857E" />
                                  </View>
                                )}
                                <Text className="text-ink font-semibold text-sm ml-2">{req.user?.name}</Text>
                              </View>
                              <View className="flex-row gap-2">
                                <TouchableOpacity
                                  onPress={() => handleResponse(req._id, 'rejected')}
                                  disabled={respondingTo === req._id}
                                  className="w-8 h-8 rounded-full bg-danger/10 items-center justify-center border border-danger/15"
                                >
                                  <Ionicons name="close" size={16} color="#DC2626" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  onPress={() => handleResponse(req._id, 'accepted')}
                                  disabled={respondingTo === req._id}
                                  className="w-8 h-8 rounded-full bg-success/10 items-center justify-center border border-success/15"
                                >
                                  <Ionicons name="checkmark" size={16} color="#047857" />
                                </TouchableOpacity>
                              </View>
                            </View>
                            {req.message && (
                              <Text className="text-ink-3 text-xs leading-4 bg-paper-2 p-2 rounded-lg">
                                "{req.message}"
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Leave button (non-leaders only) */}
                    {myTeam.leader?._id !== user?._id && (
                      <TouchableOpacity
                        onPress={handleLeaveTeam}
                        className="border border-danger/25 rounded-card py-4 items-center"
                      >
                        <Text className="text-danger font-semibold text-sm">Leave Team</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View className="items-center py-16">
                    <View className="w-24 h-24 rounded-card items-center justify-center mb-5" style={{ backgroundColor: '#EDE8E0' }}>
                      <Ionicons name="people-outline" size={42} color="#F97316" />
                    </View>
                    <Text className="text-ink-2 font-display text-xl mb-2">No Team Yet</Text>
                    <Text className="text-ink-3 text-xs text-center px-gutter mb-6">
                      Create your own team or join an open one for this hackathon!
                    </Text>
                    <TouchableOpacity onPress={() => setShowCreate(true)} activeOpacity={0.88}>
                      <View className="rounded-card px-gutter py-3.5" style={{ backgroundColor: '#F97316' }}>
                        <Text className="text-ink font-semibold text-sm">Create Team</Text>
                      </View>
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
        <SafeAreaView className="flex-1 bg-paper">
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3 border-b border-line bg-card">
            <Text className="text-ink font-display text-xl">Request to Join</Text>
            <TouchableOpacity onPress={() => setShowRequestModal(false)}>
              <Ionicons name="close" size={24} color="#8B857E" />
            </TouchableOpacity>
          </View>
          <View className="flex-1 px-5 pt-5">
            {selectedTeam && (
              <View className="bg-paper-2 rounded-card p-4 mb-5 border border-line">
                <Text className="text-brand-700 font-semibold text-base">{selectedTeam.name}</Text>
                <Text className="text-ink-3 text-xs mt-0.5">Led by {selectedTeam.leader?.name}</Text>
              </View>
            )}
            <Text className="text-ink-3 text-label font-semibold mb-2">Message (optional)</Text>
            <TextInput
              value={requestMsg}
              onChangeText={setRequestMsg}
              placeholder="Tell the leader why you'd like to join..."
              placeholderTextColor="#8B857E"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-card px-4 py-3.5 text-ink font-semibold border-[1.5px] border-ink h-28 rounded-md"
            />
          </View>
          <View className="px-5 pb-8 bg-card border-t border-line pt-4">
            <TouchableOpacity onPress={sendRequest} disabled={sendingRequest} activeOpacity={0.88}>
              <View className="rounded-card" style={{ backgroundColor: '#F97316' }}>
                <View className="py-4 items-center">
                  {sendingRequest
                    ? <ActivityIndicator size="small" color="#12100E" />
                    : <Text className="text-ink font-semibold text-sm">Send Request</Text>
                  }
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
};

export default HackathonTeamScreen;
