import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';
import socket from '../../utils/socket';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Announcement {
  _id: string;
  Title: string;
  body: string;
  type: string;
  isPinned: boolean;
  author: { _id: string; name: string; avatar?: string; role: string };
  reactions: { user: string; emoji: string }[];
  readby: string[];
  createdAt: string;
}

const ANN_TYPES: { value: string; label: string; icon: string; color: string; bg: string }[] = [
  { value: 'general', label: 'General', icon: 'megaphone', color: '#F97316', bg: '#EDE8E0' },
  { value: 'important', label: 'Important', icon: 'alert-circle', color: '#DC2626', bg: '#EDE8E0' },
  { value: 'schedule_change', label: 'Schedule', icon: 'calendar', color: '#B45309', bg: '#EDE8E0' },
  { value: 'result', label: 'Result', icon: 'trophy', color: '#047857', bg: '#EDE8E0' },
];

const HackathonChannel = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId, hackathonTitle } = route.params;
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOfficial, setIsOfficial] = useState(false);

  // Announcement Draft
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({ title: '', body: '', isPinned: false, type: 'general' });
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadAnnouncements();
    checkPermissions();

    socket.emit('join_hack_room', { hackathonId });

    const onNew = (ann: Announcement) => {
      setAnnouncements(prev => [ann, ...prev].sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1)));
      Toast.show({ type: 'info', text1: 'New Announcement', text2: ann.Title });
    };

    const onReact = (data: { announcementId: string; userId: string; emoji: string }) => {
      setAnnouncements(prev => prev.map(a =>
        a._id === data.announcementId
          ? { ...a, reactions: [...a.reactions.filter(r => r.user !== data.userId), { user: data.userId, emoji: data.emoji }] }
          : a
      ));
    };

    const onPin = (data: { announcementId: string; isPinned: boolean }) => {
      setAnnouncements(prev => prev.map(a =>
        a._id === data.announcementId ? { ...a, isPinned: data.isPinned } : a
      ).sort((a, b) => (a.isPinned === b.isPinned ? 0 : a.isPinned ? -1 : 1)));
    };

    socket.on('announcement:new', onNew);
    socket.on('announcement:reaction', onReact);
    socket.on('announcement:pinned', onPin);

    return () => {
      socket.off('announcement:new', onNew);
      socket.off('announcement:reaction', onReact);
      socket.off('announcement:pinned', onPin);
      socket.emit('leave_hack_room', { hackathonId });
    };
  }, [hackathonId]);

  const loadAnnouncements = async () => {
    try {
      const res = await axios.get(`/announcements/${hackathonId}`);
      setAnnouncements(res.data.announcements ?? []);
    } catch {
      Toast.show({ type: 'error', text1: 'Failed to load announcements' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const res = await axios.get(`/hackathons/${hackathonId}`);
      const hack = res.data.hackathon;
      const isOrg = hack.organiser?._id === user?.id || hack.organiser === user?.id;
      const isJdg = hack.judges?.some((j: any) => (j._id || j) === user?.id);
      setIsOfficial(isOrg || isJdg);
    } catch { /* silent */ }
  };

  const handlePost = async () => {
    if (!draft.title.trim() || !draft.body.trim()) return;
    setPosting(true);
    try {
      await axios.post(`/announcements/${hackathonId}`, {
        title: draft.title.trim(),
        body: draft.body.trim(),
        type: draft.type,
        isPinned: draft.isPinned
      });
      setDraft({ title: '', body: '', isPinned: false, type: 'general' });
      setShowCompose(false);
      Toast.show({ type: 'success', text1: 'Posted' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err.response?.data?.message ?? 'Failed to post' });
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (annId: string, emoji: string) => {
    try {
      await axios.patch(`/announcements/${annId}/react`, { emoji });
    } catch { /* silent fallback */ }
  };

  const handlePin = async (annId: string, current: boolean) => {
    try {
      await axios.patch(`/announcements/${annId}/pin`, { isPinned: !current });
    } catch { /* silent */ }
  };

  const renderAnnouncement = ({ item }: { item: Announcement }) => {
    const typeMeta = ANN_TYPES.find(t => t.value === item.type) || ANN_TYPES[0];
    const myReaction = item.reactions.find(r => r.user === user?.id)?.emoji;

    return (
      <View className={`bg-card rounded-card p-5 mb-4 border ${item.isPinned ? 'border-warning/40 bg-warning/10' : 'border-line'}`}
        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2 }}>

        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center bg-card px-2.5 py-1 rounded-xl border border-line">
            <Ionicons name={typeMeta.icon as any} size={11} color={typeMeta.color} />
            <Text className="text-label font-semibold ml-1.5" style={{ color: typeMeta.color }}>
              {typeMeta.label}
            </Text>
          </View>
          {item.isPinned && (
            <View className="flex-row items-center bg-warning/15 px-2.5 py-1 rounded-xl">
              <Ionicons name="pin" size={10} color="#B45309" />
              <Text className="text-warning text-label font-semibold ml-1">Pinned</Text>
            </View>
          )}
        </View>

        <Text className="text-ink font-semibold text-base mb-1.5 leading-5">{item.Title}</Text>
        <Text className="text-ink-3 text-xs leading-5 mb-4">{item.body}</Text>

        {/* Footer */}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {item.author?.avatar ? (
              <Image source={{ uri: item.author.avatar }} className="w-6 h-6 rounded-full mr-2" />
            ) : (
              <View className="w-6 h-6 rounded-full bg-brand-100 items-center justify-center mr-2">
                <Ionicons name="person" size={12} color="#F97316" />
              </View>
            )}
            <View>
              <Text className="text-ink font-semibold text-label">{item.author?.name}</Text>
              <Text className="text-ink-3 text-label font-semibold">{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </View>

          {/* Reactions */}
          <View className="flex-row gap-1.5">
            {['👍', '🔥', '❤️', '🚀'].map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => handleReact(item._id, emoji)}
                className={`w-8 h-8 rounded-xl items-center justify-center border ${myReaction === emoji ? 'bg-ink border-ink' : 'bg-paper-2 border-line'}`}
              >
                <Text className="text-xs">{emoji}</Text>
              </TouchableOpacity>
            ))}
            {isOfficial && (
              <TouchableOpacity
                onPress={() => handlePin(item._id, item.isPinned)}
                className="w-8 h-8 rounded-xl items-center justify-center bg-paper-2 border border-line"
              >
                <Ionicons name="pin" size={14} color={item.isPinned ? '#B45309' : '#8B857E'} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="flex-row items-center px-5 pt-4 pb-3 border-b border-line bg-card">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={20} color="#12100E" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-ink text-xl font-display">Channel</Text>
            <Text className="text-ink-3 text-label font-semibold" numberOfLines={1}>{hackathonTitle}</Text>
          </View>
          {isOfficial && (
            <TouchableOpacity
              onPress={() => setShowCompose(!showCompose)}
              className={`w-10 h-10 rounded-card items-center justify-center ${showCompose ? 'bg-paper-2' : 'bg-ink'}`}
            >
              <Ionicons name={showCompose ? 'close' : 'add'} size={24} color={showCompose ? '#DC2626' : 'white'} />
            </TouchableOpacity>
          )}
        </View>

        {/* Compose Section */}
        {showCompose && (
          <View className="bg-card px-5 py-4 border-b border-line">
            <Text className="text-ink-3 text-label font-semibold mb-3">Broadcast New Message</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
              {ANN_TYPES.map(t => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setDraft({ ...draft, type: t.value })}
                  className={`flex-row items-center px-3 py-2 rounded-xl border mr-2 ${draft.type === t.value ? 'bg-ink border-ink' : 'bg-paper-2 border-line'}`}
                >
                  <Ionicons name={t.icon as any} size={11} color={draft.type === t.value ? 'white' : '#8B857E'} />
                  <Text className={`text-label font-semibold ml-1.5 ${draft.type === t.value ? 'text-white' : 'text-ink-3'}`}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              placeholder="Headline..."
              value={draft.title}
              onChangeText={t => setDraft({ ...draft, title: t })}
              className="bg-paper-2 rounded-card px-4 py-3 mb-2 font-semibold text-ink border border-line"
            />
            <TextInput
              placeholder="Detailed message..."
              value={draft.body}
              onChangeText={t => setDraft({ ...draft, body: t })}
              multiline
              numberOfLines={3}
              className="bg-paper-2 rounded-card px-4 py-3 mb-3 font-semibold text-ink border border-line h-20"
              textAlignVertical="top"
            />
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center">
                <Ionicons name="pin" size={14} color={draft.isPinned ? '#B45309' : '#8B857E'} />
                <Text className="text-label font-semibold text-ink-3 ml-2">Pin to top</Text>
              </View>
              <Switch
                value={draft.isPinned}
                onValueChange={v => setDraft({ ...draft, isPinned: v })}
                trackColor={{ false: '#E3DDD3', true: '#EDE8E0' }}
                thumbColor={draft.isPinned ? '#F97316' : '#EDE8E0'}
              />
            </View>
            <TouchableOpacity onPress={handlePost} disabled={posting} className="rounded-card overflow-hidden">
              <View className="py-3.5 items-center" style={{ backgroundColor: '#F97316' }}>
                {posting ? <ActivityIndicator size="small" color="#12100E" /> : <Text className="text-ink font-semibold text-xs">Send Announcement</Text>}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Announcements List */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#F97316" />
          </View>
        ) : (
          <FlatList
            data={announcements}
            keyExtractor={item => item._id}
            renderItem={renderAnnouncement}
            contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAnnouncements(); }} />}
            ListEmptyComponent={() => (
              <View className="items-center py-20">
                <View className="w-20 h-20 rounded-card items-center justify-center mb-5" style={{ backgroundColor: '#EDE8E0' }}>
                  <Ionicons name="megaphone-outline" size={36} color="#F97316" />
                </View>
                <Text className="text-ink-2 font-display text-lg mb-1">Silence is Golden</Text>
                <Text className="text-ink-3 text-xs font-semibold">No announcements yet. Check back soon!</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default HackathonChannel;
