import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import socket from '../../utils/socket';

interface Submission {
  _id: string;
  ProjectName: string;
  TagLine?: string;
  status: string;
  team?: { _id: string; name: string; members?: { user: { _id: string; name?: string } }[] };
  submittedAt?: string;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: '#F97316', bg: '#EDE8E0' },
  submitted: { label: 'Submitted', color: '#2563EB', bg: '#EDE8E0' },
  underReview: { label: 'Under Review', color: '#B45309', bg: '#EDE8E0' },
  scored: { label: 'Scored', color: '#047857', bg: '#EDE8E0' },
};

const HackathonDashboard = () => {
  const route = useRoute<any>();
  const { hackathonId, hackathonTitle } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [recentSubs, setRecentSubs] = useState<Submission[]>([]);
  const [judgeProgress, setJudgeProgress] = useState<any>({});
  const [winners, setWinners] = useState<any[]>([]);
  const [hack, setHack] = useState<any>(null);
  const [prizes, setPrizes] = useState<any[]>([]);

  const [assigning, setAssigning] = useState(false);
  const [winnerModal, setWinnerModal] = useState(false);
  const [assignRank, setAssignRank] = useState<any>(null);
  const [selectedSub, setSelectedSub] = useState<string>('');

  const loadDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`/hackathons/${hackathonId}/dashboard`);
      if (res.data.success) {
        setStats(res.data.stats || {});
        setRecentSubs(res.data.recentSubmissions || []);
        setJudgeProgress(res.data.judgeProgress || {});
        setWinners(res.data.winners || []);
        setHack(res.data.hackathon || null);
        setPrizes(res.data.hackathon?.prizes || []);
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to load dashboard' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hackathonId]);

  // Realtime events can burst during judging (every judge score ticks the board).
  // Collapse them into at most one reload per 800ms so the console stays smooth.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => {
      reloadTimer.current = null;
      loadDashboard();
    }, 800);
  }, [loadDashboard]);

  useEffect(() => {
    loadDashboard();
    socket.emit('join_hack_room', { hackathonId });
    socket.on('submission:new', scheduleReload);
    socket.on('submission:scored', scheduleReload);
    socket.on('leaderboard:updated', scheduleReload);
    socket.on('hackathon:winners_announced', scheduleReload);
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      socket.emit('leave_hack_room', { hackathonId });
      socket.off('submission:new');
      socket.off('submission:scored');
      socket.off('leaderboard:updated');
      socket.off('hackathon:winners_announced');
    };
  }, [hackathonId, loadDashboard, scheduleReload]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, [loadDashboard]);

  const openAssign = (rank: any) => {
    setAssignRank(rank);
    setSelectedSub('');
    setWinnerModal(true);
  };

  const confirmWinner = async () => {
    if (!selectedSub) return Toast.show({ type: 'error', text1: 'Select a submission' });
    setAssigning(true);
    try {
      const nextWinners = winners.filter((w) => w.rank !== assignRank.rank);
      const chosen = recentSubs.find((s) => s._id === selectedSub);
      nextWinners.push({
        rank: assignRank.rank,
        title: assignRank.title || '',
        amount: assignRank.amount || '',
        submissionId: selectedSub,
        teamId: chosen?.team?._id,
      });
      const res = await axios.patch(`/hackathons/${hackathonId}/winners`, { winners: nextWinners });
      if (res.data.success) {
        setWinners(res.data.winners);
        setWinnerModal(false);
        Toast.show({ type: 'success', text1: `Rank ${assignRank.rank} assigned` });
      }
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.message || 'Failed to assign winner' });
    } finally {
      setAssigning(false);
    }
  };

  const statCards = [
    { label: 'Participants', value: stats.participants ?? 0, icon: 'people', color: '#F97316' },
    { label: 'Teams', value: stats.teams ?? 0, icon: 'groups', color: '#F97316' },
    { label: 'Submissions', value: stats.submissions ?? 0, icon: 'rocket', color: '#F97316' },
    { label: 'Scored', value: stats.scored ?? 0, icon: 'trophy', color: '#047857' },
  ];

  const scoredSubs = recentSubs.filter((s) => s.status === 'scored');
  const assignableSubs = recentSubs.filter((s) => s.status !== 'draft');

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" edges={['top']}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
        >
          {/* Header */}
          <View className="px-gutter pt-6 pb-4">
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <View className="w-10 h-10 rounded-card bg-ink items-center justify-center">
                  <Ionicons name="stats-chart" size={18} color="#F97316" />
                </View>
                <Text className="ml-3 text-ink text-2xl font-display">
                  Organizer Console
                </Text>
              </View>
            </View>
            <Text className="text-ink-3 text-label font-semibold" numberOfLines={1}>
              {hackathonTitle || 'Mission Control'}
            </Text>
          </View>

          {loading ? (
            <View className="items-center py-20">
              <ActivityIndicator size="large" color="#F97316" />
            </View>
          ) : (
            <>
              {/* Stats Grid */}
              <View className="flex-row flex-wrap px-6">
                {statCards.map((s) => (
                  <View key={s.label} className="w-1/2 p-2">
                    <View className="bg-card rounded-card p-6 border border-line shadow-hair">
                      <View className="w-10 h-10 rounded-card items-center justify-center mb-4" style={{ backgroundColor: `${s.color}18` }}>
                        <MaterialCommunityIcons name={s.icon as any} size={20} color={s.color} />
                      </View>
                      <Text className="text-ink text-3xl font-display">{s.value}</Text>
                      <Text className="text-ink-3 text-label font-semibold mt-1">{s.label}</Text>
                    </View>
                  </View>
                ))}
              </View>

              {/* Judge Progress */}
              <View className="px-gutter mt-4">
                <Text className="text-ink text-xs font-semibold mb-3">Judge Progress</Text>
                <View className="bg-card rounded-card p-6 border border-line">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-ink-3 text-label font-semibold">Total Submissions in Queue</Text>
                    <Text className="text-ink text-xl font-display">{judgeProgress.totalSubmissions ?? 0}</Text>
                  </View>
                  <View className="mt-4 h-2 bg-paper-2 rounded-full overflow-hidden">
                    <View
                      className="h-full bg-brand-500 rounded-full"
                      style={{
                        width: `${stats.submissions ? Math.min(100, Math.round((stats.scored / stats.submissions) * 100)) : 0}%`,
                      }}
                    />
                  </View>
                  <Text className="text-ink-3 text-label font-semibold mt-3">
                    {Object.keys(judgeProgress.judged || {}).length} judge(s) actively scoring
                  </Text>
                </View>
              </View>

              {/* Winners Assignment */}
              <View className="px-gutter mt-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-ink text-xs font-semibold">Winners / Prizes</Text>
                </View>
                {(prizes.length ? prizes : [{ rank: 1, title: 'Winner', amount: '' }]).map((p: any, idx: number) => {
                  const w = winners.find((x) => x.rank === p.rank);
                  return (
                    <View key={idx} className="bg-card rounded-card p-5 border border-line mb-3 flex-row items-center">
                      <View className="w-12 h-12 rounded-card bg-warning/10 items-center justify-center mr-4">
                        <MaterialCommunityIcons name="trophy-outline" size={22} color="#B45309" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-ink text-sm font-semibold">
                          #{p.rank} {p.title || 'Winner'}
                        </Text>
                        <Text className="text-ink-3 text-label font-semibold mt-1">
                          {w ? 'Assigned' : 'Unassigned'}{w?.amount || p.amount ? ` · ${w?.amount || p.amount}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => openAssign(p)}
                        className={`px-5 py-3 rounded-card ${w ? 'bg-success/10' : 'bg-ink'}`}
                      >
                        <Text className={`text-label font-semibold ${w ? 'text-success' : 'text-white'}`}>
                          {w ? 'Edit' : 'Assign'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>

              {/* Recent Submissions */}
              <View className="px-gutter mt-6">
                <Text className="text-ink text-xs font-semibold mb-3">
                  Recent Submissions ({recentSubs.length})
                </Text>
                {recentSubs.length === 0 ? (
                  <View className="bg-card rounded-card p-card-pad border border-line items-center">
                    <MaterialCommunityIcons name="rocket-outline" size={40} color="#C4BEB6" />
                    <Text className="text-ink-3 text-label font-semibold mt-3">No submissions yet</Text>
                  </View>
                ) : recentSubs.map((s) => {
                  const meta = STATUS_META[s.status] ?? STATUS_META.draft;
                  return (
                    <View key={s._id} className="bg-card rounded-card p-5 border border-line mb-3">
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="text-ink text-sm font-semibold flex-1 mr-3" numberOfLines={1}>
                          {s.ProjectName}
                        </Text>
                        <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: meta.bg }}>
                          <Text className="text-label font-semibold" style={{ color: meta.color }}>{meta.label}</Text>
                        </View>
                      </View>
                      {s.TagLine ? <Text className="text-ink-3 text-xs mb-2" numberOfLines={2}>{s.TagLine}</Text> : null}
                      <Text className="text-ink-3 text-label font-semibold">
                        {s.team?.name || 'Team'} {s.submittedAt ? ` · ${new Date(s.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Assign Winner Modal */}
      <Modal visible={winnerModal} transparent animationType="fade" onRequestClose={() => setWinnerModal(false)}>
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-paper rounded-t-sheet p-card-pad pb-10">
            <View className="w-12 h-1.5 bg-ink-4 rounded-full self-center mb-6" />
            <Text className="text-ink font-display mb-1 text-h1">
              Assign Rank #{assignRank?.rank}
            </Text>
            <Text className="text-ink-3 text-label font-semibold mb-6">
              {assignRank?.title || 'Winner'} {assignRank?.amount ? `· ${assignRank.amount}` : ''}
            </Text>

            <ScrollView className="max-h-96">
              {assignableSubs.length === 0 ? (
                <Text className="text-ink-3 text-center text-xs font-semibold py-10">
                  No submitted projects to assign yet
                </Text>
              ) : assignableSubs.map((s) => (
                <TouchableOpacity
                  key={s._id}
                  onPress={() => setSelectedSub(s._id)}
                  className={`flex-row items-center p-4 rounded-card border mb-2 ${selectedSub === s._id ? 'bg-brand-50 border-ink' : 'bg-paper-2 border-transparent'}`}
                >
                  <View className="flex-1">
                    <Text className="text-ink text-sm font-semibold">{s.ProjectName}</Text>
                    <Text className="text-ink-3 text-label font-semibold mt-0.5">
                      {s.team?.name || 'Team'} · {STATUS_META[s.status]?.label || s.status}
                    </Text>
                  </View>
                  {selectedSub === s._id && <Ionicons name="checkmark-circle" size={22} color="#F97316" />}
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={confirmWinner}
              disabled={assigning}
              className="mt-6 bg-ink py-5 items-center flex-row justify-center border-2 border-ink rounded-md"
            >
              {assigning ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Feather name="check" size={18} color="#F97316" />
                  <Text className="text-white text-label font-semibold ml-2">Confirm Winner</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWinnerModal(false)} className="mt-4 items-center py-3">
              <Text className="text-ink-3 text-label font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HackathonDashboard;