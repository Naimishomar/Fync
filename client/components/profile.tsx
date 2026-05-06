import React, { useState, useEffect, useCallback } from 'react';
import {
  Text, Image, View, Pressable, FlatList,
  Dimensions, RefreshControl, Linking, Alert,
  ActivityIndicator, ScrollView, Modal, TextInput,
  Switch, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '../context/auth.context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Avatar from './Avatar';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { getFullUrl } from '../utils/imageUtils';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type UserType = {
  _id: string; name: string; username: string; avatar: string;
  user_access?: string; college?: string; interest?: string | string[];
  bio?: string; about?: string; experience?: string; skills?: string[];
  hobbies?: string | string[]; github_id?: string; linkedIn_id?: string;
  banner?: string; upiId?: string;
  codingProfiles?: { leetcode?: string; gfg?: string; codechef?: string };
  codingStats?: { leetcodeSolved?: number; leetcodeRating?: number; gfgSolved?: number; gfgRating?: number; codechefSolved?: number; codechefRating?: number; totalSolved?: number };
  followers?: any[]; following?: any[];
  fyncScore?: number; fyncBadge?: string;
  education?: EducationEntry[];
  githubUsername?: string; githubStats?: any;
};

type EducationEntry = {
  _id: string; institution: string; degree?: string; field?: string;
  grade?: string; startYear?: number; endYear?: number; isCurrent?: boolean; description?: string;
};

// ─── SECTION HEADER ──────────────────────────────────────────────────────────
const SH = ({ title, icon, accent = '#6366F1' }: { title: string; icon: string; accent?: string }) => (
  <View className="flex-row items-center gap-3 mb-4 px-1">
    <View className="w-1.5 h-6 rounded-full" style={{ backgroundColor: accent, shadowColor: accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 }} />
    <View className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
      <Ionicons name={icon as any} size={18} color={accent} />
    </View>
    <Text className="font-extrabold text-gray-900 text-xs uppercase tracking-[2px]">{title}</Text>
  </View>
);

// ─── SKILL CHIP ───────────────────────────────────────────────────────────────
const SkillChip = ({ label }: { label: string }) => (
  <View className="bg-white border border-gray-100 px-4 py-2 rounded-2xl shadow-sm mb-1 mr-1">
    <Text className="text-gray-700 text-[13px] font-bold">{label}</Text>
  </View>
);

// ─── FYNC SCORE MINI BADGE ────────────────────────────────────────────────────
const BADGE_EMOJI: Record<string, string> = {
  Newcomer: '🌱', Explorer: '🗺️', Builder: '🔨', Innovator: '💡', Pioneer: '🚀', Legend: '🌟'
};

// ─── CODING STAT CARD ─────────────────────────────────────────────────────────
const CodingPlatformCard = ({ icon, name, color, bg, username, solved, rating, profileUrl }: any) => {
  if (!username && !solved) return null;
  return (
    <Pressable
      onPress={() => username && Linking.openURL(profileUrl)}
      className="flex-1 rounded-[24px] border p-4 items-center bg-white shadow-sm"
      style={{ borderColor: color + '20' }}
    >
      <View className="w-12 h-12 rounded-2xl items-center justify-center mb-3" style={{ backgroundColor: color + '10' }}>
        {typeof icon === 'string' && icon.startsWith('http')
          ? <Image source={{ uri: icon }} className="w-7 h-7" resizeMode="contain" />
          : <Ionicons name={icon} size={26} color={color} />}
      </View>
      <Text className="font-black text-xl text-gray-900 leading-tight">{solved || 0}</Text>
      <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Solved</Text>
      {rating ? (
        <View className="bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 mt-1">
          <Text className="text-[10px] font-black" style={{ color }}>⭐ {rating}</Text>
        </View>
      ) : null}
      <Text className="text-[11px] text-gray-500 font-bold mt-3 text-center">{name}</Text>
    </Pressable>
  );
};

// ─── EDUCATION CARD ────────────────────────────────────────────────────────────
const EducationCard = ({ item, isOwner, onEdit, onDelete }: {
  item: EducationEntry; isOwner?: boolean;
  onEdit?: (i: EducationEntry) => void; onDelete?: (id: string) => void;
}) => (
  <View className="bg-white rounded-[24px] border border-gray-100 p-5 mb-4 shadow-sm">
    <View className="flex-row">
      <View className="w-12 h-12 bg-indigo-50 rounded-2xl items-center justify-center mr-4">
        <Ionicons name="school" size={24} color="#6366F1" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-black text-[15px] mb-1">{item.institution}</Text>
        {item.degree && (
          <Text className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-2">
            {item.degree}{item.field ? ` • ${item.field}` : ''}
          </Text>
        )}
        <View className="flex-row flex-wrap items-center gap-2 mb-2">
          <View className="bg-gray-100 px-2.5 py-1 rounded-full">
            <Text className="text-gray-500 text-[10px] font-black uppercase">
              {item.startYear || '?'} — {item.isCurrent ? 'Present' : (item.endYear || '?')}
            </Text>
          </View>
          {item.grade && (
            <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              <Text className="text-emerald-700 text-[10px] font-black">{item.grade}</Text>
            </View>
          )}
          {item.isCurrent && (
            <View className="bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              <Text className="text-blue-600 text-[10px] font-black uppercase">Active</Text>
            </View>
          )}
        </View>
        {item.description && <Text className="text-gray-500 text-[13px] leading-5 font-medium" numberOfLines={3}>{item.description}</Text>}
      </View>
      {isOwner && (
        <View className="ml-2 gap-3">
          <Pressable onPress={() => onEdit?.(item)} className="bg-gray-50 p-2 rounded-xl border border-gray-100">
            <Ionicons name="pencil-outline" size={16} color="#6366F1" />
          </Pressable>
          <Pressable onPress={() => onDelete?.(item._id)} className="bg-red-50 p-2 rounded-xl border border-red-100">
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </Pressable>
        </View>
      )}
    </View>
  </View>
);

// ─── ADD EDUCATION MODAL ──────────────────────────────────────────────────────
function AddEducationModal({ visible, initial, onClose, onSuccess }: {
  visible: boolean; initial?: EducationEntry; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    institution: '', degree: '', field: '', grade: '',
    startYear: '', endYear: '', isCurrent: false, description: ''
  });
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      setForm({
        institution: initial.institution || '',
        degree: initial.degree || '',
        field: initial.field || '',
        grade: initial.grade || '',
        startYear: initial.startYear?.toString() || '',
        endYear: initial.endYear?.toString() || '',
        isCurrent: initial.isCurrent || false,
        description: initial.description || ''
      });
    } else {
      setForm({ institution: '', degree: '', field: '', grade: '', startYear: '', endYear: '', isCurrent: false, description: '' });
    }
  }, [initial, visible]);

  const save = async () => {
    if (!form.institution.trim()) return Toast.show({ type: 'error', text1: 'Institution is required' });
    setSaving(true);
    try {
      const payload = { ...form, startYear: form.startYear ? Number(form.startYear) : undefined, endYear: form.endYear ? Number(form.endYear) : undefined };
      if (isEdit) await axios.patch(`/profile/education/${initial!._id}`, payload);
      else await axios.post('/profile/education', payload);
      Toast.show({ type: 'success', text1: isEdit ? 'Education updated!' : 'Education added!' });
      onSuccess();
    } catch { Toast.show({ type: 'error', text1: 'Failed to save' }); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></Pressable>
          <Text className="font-bold text-gray-900 text-lg">{isEdit ? 'Edit Education' : 'Add Education'}</Text>
          <Pressable onPress={save} disabled={saving} className="bg-indigo-600 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Save</Text>}
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
          {[
            { label: 'Institution *', key: 'institution', ph: 'e.g. IIT Delhi, DPS School' },
            { label: 'Degree / Level', key: 'degree', ph: 'e.g. B.Tech, 12th, MBA' },
            { label: 'Field / Stream', key: 'field', ph: 'e.g. Computer Science, PCM' },
            { label: 'Grade / Percentage', key: 'grade', ph: 'e.g. 9.2 CGPA, 92%' },
            { label: 'Start Year', key: 'startYear', ph: '2020' },
          ].map(f => (
            <View key={f.key} className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">{f.label}</Text>
              <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                placeholder={f.ph} placeholderTextColor="#9CA3AF"
                value={form[f.key as keyof typeof form] as string}
                onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
                keyboardType={f.key.includes('Year') ? 'numeric' : 'default'} />
            </View>
          ))}
          <View className="flex-row items-center justify-between mb-4 bg-gray-50 px-4 py-3 rounded-xl border border-gray-200">
            <Text className="text-gray-700 font-semibold text-sm">Currently Studying Here</Text>
            <Switch value={form.isCurrent}
              onValueChange={v => setForm(p => ({ ...p, isCurrent: v }))}
              trackColor={{ true: '#6366F1' }} />
          </View>
          {!form.isCurrent && (
            <View className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">End Year</Text>
              <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                placeholder="2024" placeholderTextColor="#9CA3AF" keyboardType="numeric"
                value={form.endYear} onChangeText={v => setForm(p => ({ ...p, endYear: v }))} />
            </View>
          )}
          <View className="mb-6">
            <Text className="text-gray-700 font-semibold text-sm mb-1.5">Description</Text>
            <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
              placeholder="Clubs, achievements, projects..." placeholderTextColor="#9CA3AF"
              style={{ height: 80, textAlignVertical: 'top' }}
              value={form.description} multiline
              onChangeText={v => setForm(p => ({ ...p, description: v }))} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── CODING STATS MODAL ───────────────────────────────────────────────────────
function CodingStatsModal({ visible, user, onClose, onSuccess }: {
  visible: boolean; user: any; onClose: () => void; onSuccess: () => void;
}) {
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm({
      leetcodeSolved: user?.codingStats?.leetcodeSolved?.toString() || '',
      leetcodeRating: user?.codingStats?.leetcodeRating?.toString() || '',
      gfgSolved: user?.codingStats?.gfgSolved?.toString() || '',
      gfgRating: user?.codingStats?.gfgRating?.toString() || '',
      codechefSolved: user?.codingStats?.codechefSolved?.toString() || '',
      codechefRating: user?.codingStats?.codechefRating?.toString() || '',
      codechef: user?.codingProfiles?.codechef || '',
    });
  }, [visible]);

  const save = async () => {
    setSaving(true);
    try {
      await axios.patch('/profile/coding-stats', form);
      Toast.show({ type: 'success', text1: 'Coding stats updated!' });
      onSuccess();
    } catch { Toast.show({ type: 'error', text1: 'Failed to update' }); }
    finally { setSaving(false); }
  };

  const fields = [
    { label: '🟡 LeetCode Problems Solved', key: 'leetcodeSolved', ph: '250' },
    { label: '🟡 LeetCode Rating', key: 'leetcodeRating', ph: '1650' },
    { label: '🟢 GFG Problems Solved', key: 'gfgSolved', ph: '300' },
    { label: '🟢 GFG Rating (Score)', key: 'gfgRating', ph: '2100' },
    { label: '🔵 CodeChef Username', key: 'codechef', ph: 'my_handle', numeric: false },
    { label: '🔵 CodeChef Problems Solved', key: 'codechefSolved', ph: '150' },
    { label: '🔵 CodeChef Rating', key: 'codechefRating', ph: '1400' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-gray-100">
          <Pressable onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></Pressable>
          <Text className="font-bold text-gray-900 text-lg">Update Coding Stats</Text>
          <Pressable onPress={save} disabled={saving} className="bg-indigo-600 px-4 py-2 rounded-xl">
            {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Save</Text>}
          </Pressable>
        </View>
        <ScrollView className="flex-1 px-4 pt-2" keyboardShouldPersistTaps="handled">
          <View className="bg-amber-50 border border-amber-100 px-4 py-3 rounded-xl my-3">
            <Text className="text-amber-700 text-xs font-medium">📌 These are self-reported. Enter your current stats from each platform.</Text>
          </View>
          {fields.map(f => (
            <View key={f.key} className="mb-4">
              <Text className="text-gray-700 font-semibold text-sm mb-1.5">{f.label}</Text>
              <TextInput className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm"
                placeholder={f.ph} placeholderTextColor="#9CA3AF"
                keyboardType={f.numeric === false ? 'default' : 'numeric'}
                value={form[f.key] || ''}
                onChangeText={v => setForm((p: any) => ({ ...p, [f.key]: v }))} />
            </View>
          ))}
          <View className="h-6" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ABOUT TAB FULL REBUILD ───────────────────────────────────────────────────
function AboutSection({ user, isOwner, onRefresh }: { user: UserType; isOwner: boolean; onRefresh: () => void }) {
  const navigation = useNavigation<any>();
  const [showAddEdu, setShowAddEdu] = useState(false);
  const [editingEdu, setEditingEdu] = useState<EducationEntry | undefined>();
  const [showCodingModal, setShowCodingModal] = useState(false);

  const education = user?.education || [];
  const skills = user?.skills || [];
  const cs = user?.codingStats || {};
  const cp = user?.codingProfiles || {};

  const deleteEdu = (id: string) => Alert.alert('Delete', 'Remove this education entry?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => {
      await axios.delete(`/profile/education/${id}`);
      onRefresh();
    }}
  ]);

  const hasCoding = cp.leetcode || cp.gfg || cp.codechef || cs.leetcodeSolved || cs.gfgSolved;

  return (
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 100 }}>

      {/* ── Fync Score Banner ──────────────────────────────────────────── */}
      {user?.fyncScore !== undefined && (
        <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
          className="mx-4 mt-6 mb-2 rounded-[28px] overflow-hidden">
          <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="px-6 py-5 flex-row items-center">
            <View className="bg-white/20 w-14 h-14 rounded-2xl items-center justify-center mr-4">
              <Text style={{ fontSize: 32 }}>{BADGE_EMOJI[user.fyncBadge || 'Newcomer']}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white font-black text-xl">{user.fyncScore}</Text>
                <Text className="text-indigo-100 text-[10px] font-black uppercase tracking-widest">Score Portfolio</Text>
              </View>
              <View className="h-1.5 bg-black/10 rounded-full overflow-hidden mb-2">
                <View className="h-full bg-white rounded-full" style={{ width: `${(user.fyncScore / 1000) * 100}%` }} />
              </View>
              <Text className="text-indigo-100 text-[11px] font-bold">Level: {user.fyncBadge || 'Newcomer'} • Tap to expand →</Text>
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {/* ── About ──────────────────────────────────────────────────────── */}
      {user?.about && (
        <View className="mx-4 mt-4 bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
          <SH title="About Me" icon="person-outline" />
          <Text className="text-gray-600 text-[15px] leading-[24px] font-medium">{user.about}</Text>
        </View>
      )}

      {/* ── Skills ──────────────────────────────────────────────────────── */}
      {skills.length > 0 && (
        <View className="mx-4 mt-4 bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
          <SH title="Skills & Stack" icon="code-slash-outline" accent="#8B5CF6" />
          <View className="flex-row flex-wrap gap-2">
            {skills.map((s, i) => <SkillChip key={i} label={s} />)}
          </View>
        </View>
      )}

      {/* ── Interests & Hobbies ─────────────────────────────────────────── */}
      {(user?.interest || user?.hobbies) && (
        <View className="mx-4 mt-4 bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
          <SH title="Vibe & Interests" icon="heart-outline" accent="#EC4899" />
          <View className="flex-row flex-wrap gap-3">
            {(Array.isArray(user.interest) ? user.interest : [user.interest]).filter(Boolean).map((t, i) => (
              <View key={`i${i}`} className="flex-row items-center bg-pink-50/50 px-4 py-2 rounded-2xl border border-pink-100">
                <Text className="text-pink-600 text-xs font-black uppercase tracking-wide mr-1.5">♥</Text>
                <Text className="text-pink-700 text-[13px] font-bold">{t}</Text>
              </View>
            ))}
            {(Array.isArray(user.hobbies) ? user.hobbies : [user.hobbies]).filter(Boolean).map((h, i) => (
              <View key={`h${i}`} className="flex-row items-center bg-emerald-50/50 px-4 py-2 rounded-2xl border border-emerald-100">
                <Text className="text-emerald-600 text-xs font-black uppercase tracking-wide mr-1.5">★</Text>
                <Text className="text-emerald-700 text-[13px] font-bold">{h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Education ───────────────────────────────────────────────────── */}
      <View className="mx-4 mt-6">
        <View className="flex-row items-center justify-between mb-4 px-1">
          <View className="flex-row items-center gap-3">
            <View className="w-1.5 h-6 rounded-full bg-blue-500" />
            <View className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
              <Ionicons name="school-outline" size={18} color="#3B82F6" />
            </View>
            <Text className="font-extrabold text-gray-900 text-xs uppercase tracking-[2px]">Education</Text>
          </View>
          {isOwner && (
            <Pressable onPress={() => { setEditingEdu(undefined); setShowAddEdu(true); }}
              className="flex-row items-center gap-1.5 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <Ionicons name="add" size={16} color="#3B82F6" />
              <Text className="text-gray-900 text-xs font-black uppercase tracking-wider">Add</Text>
            </Pressable>
          )}
        </View>
        {education.length === 0 ? (
          <View className="bg-white rounded-[32px] border border-gray-100 p-10 items-center shadow-sm">
            <View className="w-16 h-16 bg-gray-50 rounded-full items-center justify-center mb-4">
              <Ionicons name="school-outline" size={32} color="#D1D5DB" />
            </View>
            <Text className="text-gray-900 font-bold text-[15px]">No education yet</Text>
            <Text className="text-gray-400 text-xs mt-1 text-center">Highlight your academic journey here</Text>
          </View>
        ) : education.map(e => (
          <EducationCard key={e._id} item={e} isOwner={isOwner}
            onEdit={(i) => { setEditingEdu(i); setShowAddEdu(true); }}
            onDelete={deleteEdu} />
        ))}
      </View>

      {/* ── Coding Platforms ─────────────────────────────────────────────── */}
      {(hasCoding || isOwner) && (
        <View className="mx-4 mt-4 bg-gray-50 rounded-[32px] p-1">
          <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
            <View className="flex-row items-center justify-between mb-5">
              <SH title="Coding Stats" icon="code-slash-outline" accent="#0EA5E9" />
              {isOwner && (
                <Pressable onPress={() => setShowCodingModal(true)}
                  className="bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-100">
                  <Ionicons name="pencil-outline" size={14} color="#0EA5E9" />
                </Pressable>
              )}
            </View>

            {/* Total solved banner */}
            {cs.totalSolved ? (
              <View className="bg-gray-900 rounded-[24px] px-6 py-5 mb-5 flex-row items-center justify-between shadow-lg shadow-gray-200">
                <View>
                  <Text className="text-gray-400 font-black text-[10px] uppercase tracking-widest mb-1">Total Solved</Text>
                  <Text className="text-white font-black text-2xl">{cs.totalSolved}</Text>
                </View>
                <View className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center">
                  <Ionicons name="trophy" size={24} color="#F89F1B" />
                </View>
              </View>
            ) : null}

            <View className="flex-row gap-3">
              <CodingPlatformCard
                icon="https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0"
                name="LeetCode" color="#F89F1B" bg="#FFFBF0"
                username={cp.leetcode} solved={cs.leetcodeSolved} rating={cs.leetcodeRating}
                profileUrl={`https://leetcode.com/${cp.leetcode}`}
              />
              <CodingPlatformCard
                icon="https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png"
                name="GFG" color="#2E8B57" bg="#F0FFF4"
                username={cp.gfg} solved={cs.gfgSolved} rating={cs.gfgRating}
                profileUrl={`https://www.geeksforgeeks.org/user/${cp.gfg}`}
              />
              <CodingPlatformCard
                icon="https://cdn.codechef.com/images/cc-logo.svg"
                name="CodeChef" color="#6F4E37" bg="#FFF8F0"
                username={cp.codechef} solved={cs.codechefSolved} rating={cs.codechefRating}
                profileUrl={`https://www.codechef.com/users/${cp.codechef}`}
              />
            </View>
          </View>
        </View>
      )}

      {/* ── Social Links ─────────────────────────────────────────────────── */}
      {(user?.github_id || user?.linkedIn_id || user?.githubUsername) && (
        <View className="mx-4 mt-6 bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
          <SH title="Connected Accounts" icon="share-outline" accent="#1F2937" />
          <View className="gap-3">
            {user?.github_id && (
              <Pressable onPress={() => Linking.openURL(user.github_id!)}
                className="flex-row items-center bg-gray-50 px-5 py-4 rounded-[20px] border border-gray-100">
                <Ionicons name="logo-github" size={24} color="#1F2937" />
                <View className="ml-4 flex-1">
                  <Text className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Developer</Text>
                  <Text className="text-gray-900 font-bold text-[15px]">GitHub</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {user?.linkedIn_id && (
              <Pressable onPress={() => Linking.openURL(user.linkedIn_id!)}
                className="flex-row items-center bg-gray-50 px-5 py-4 rounded-[20px] border border-gray-100">
                <Ionicons name="logo-linkedin" size={24} color="#0077B5" />
                <View className="ml-4 flex-1">
                  <Text className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Professional</Text>
                  <Text className="text-gray-900 font-bold text-[15px]">LinkedIn</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {user?.upiId && (
              <View className="flex-row items-center bg-emerald-50 px-5 py-4 rounded-[20px] border border-emerald-100">
                <View className="w-10 h-10 bg-emerald-500 rounded-2xl items-center justify-center">
                  <Ionicons name="wallet" size={20} color="white" />
                </View>
                <View className="ml-4 flex-1">
                  <Text className="text-emerald-800 text-[10px] font-black uppercase tracking-widest">Payments</Text>
                  <Text className="text-emerald-700 font-bold text-[15px]">{user.upiId}</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      <AddEducationModal
        visible={showAddEdu}
        initial={editingEdu}
        onClose={() => setShowAddEdu(false)}
        onSuccess={() => { setShowAddEdu(false); onRefresh(); }}
      />
      <CodingStatsModal
        visible={showCodingModal}
        user={user}
        onClose={() => setShowCodingModal(false)}
        onSuccess={() => { setShowCodingModal(false); onRefresh(); }}
      />
    </ScrollView>
  );
}

// ─── MAIN PROFILE COMPONENT ───────────────────────────────────────────────────
function Profile() {
  const { user, logout, setUser } = useAuth();
  const navigation = useNavigation<any>();

  const [posts, setPosts] = useState<any[]>([]);
  const [shorts, setShorts] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'shorts' | 'about'>('posts');
  const [refreshing, setRefreshing] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [shortsPage, setShortsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreShorts, setHasMoreShorts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);

  const fetchSubscription = async () => {
    try {
      const res = await axios.get('/subscription/status');
      if (res.data.success) {
        setSubscription(res.data);
      }
    } catch (error) {
      console.error("Subscription fetch error:", error);
    }
  };

  const getPosts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/post/posts?page=${page}&limit=12`);
      if (res.data.success) {
        setPosts(prev => isInitial ? res.data.posts : [...prev, ...res.data.posts.filter((p: any) => !prev.some(e => e._id === p._id))]);
        setHasMorePosts(res.data.hasMore); setPostsPage(page);
      }
    } catch { } finally { setIsLoadingMore(false); }
  };

  const getShorts = async (page = 1, isInitial = false) => {
    try {
      setIsLoadingMore(true);
      const res = await axios.get(`/shorts/your?page=${page}&limit=12`);
      if (res.data.success) {
        setShorts(prev => isInitial ? res.data.shorts : [...prev, ...res.data.shorts.filter((s: any) => !prev.some(e => e._id === s._id))]);
        setHasMoreShorts(res.data.hasMore === true); setShortsPage(page);
      } else setHasMoreShorts(false);
    } catch { } finally { setIsLoadingMore(false); }
  };

  const refreshUser = async () => {
    try {
      const res = await axios.get('/user/profile');
      if (res.data.user && setUser) setUser(res.data.user);
    } catch { }
  };

  useFocusEffect(
    useCallback(() => {
      getPosts(1, true);
      getShorts(1, true);
      fetchSubscription();
      refreshUser();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getPosts(1, true), getShorts(1, true), refreshUser(), fetchSubscription()]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    if (activeTab === 'posts' && hasMorePosts) getPosts(postsPage + 1);
    else if (activeTab === 'shorts' && hasMoreShorts) getShorts(shortsPage + 1);
  };

  const deletePost = async (id: string) => {
    const previousPosts = posts;
    // Optimistic update
    setPosts(p => p.filter(x => x._id !== id));
    
    try {
      const res = await axios.delete(`/post/${id}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Post deleted' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      setPosts(previousPosts); // Rollback
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  const deleteShort = async (id: string) => {
    const previousShorts = shorts;
    // Optimistic update
    setShorts(p => p.filter(x => x._id !== id));

    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Short deleted' });
      } else {
        throw new Error("Failed to delete");
      }
    } catch (err) {
      setShorts(previousShorts); // Rollback
      Toast.show({ type: 'error', text1: 'Failed to delete' });
    }
  };

  const handleLogout = async () => { await logout(); };

  const clearAppCache = async () => {
    try {
      if (FileSystem.cacheDirectory) {
        const content = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
        let totalFreed = 0;
        for (const item of content) {
          const itemPath = `${FileSystem.cacheDirectory}${item}`;
          const info = await FileSystem.getInfoAsync(itemPath);
          if (info.exists && !info.isDirectory) totalFreed += info.size || 0;
          await FileSystem.deleteAsync(itemPath, { idempotent: true });
        }
        await ExpoImage.clearDiskCache(); await ExpoImage.clearMemoryCache();
        Alert.alert('Cache Cleared 🧹', `Reclaimed ${(totalFreed / 1048576).toFixed(2)} MB`);
      }
    } catch { Toast.show({ type: 'error', text1: 'Failed to clear cache' }); }
  };

  // ── Profile Header ─────────────────────────────────────────────────────
  const renderProfileInfo = () => (
    <View className="bg-white">
      <View className="h-64 w-full relative">
        <ExpoImage
          source={{ uri: getFullUrl(user?.banner) || 'https://images.unsplash.com/photo-1557683316-973673baf926?q=80&w=1000' }}
          style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
        <LinearGradient colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.2)']} className="absolute inset-0" />
        
        <View className="absolute top-12 right-4 flex-row gap-3">
          <Pressable onPress={clearAppCache} className="bg-white/20 p-2.5 rounded-2xl border border-white/30 backdrop-blur-md">
            <Ionicons name="trash-outline" size={20} color="white" />
          </Pressable>
          <Pressable onPress={() => Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: handleLogout, style: 'destructive' }
          ])} className="bg-white/20 p-2.5 rounded-2xl border border-white/30 backdrop-blur-md">
            <Ionicons name="log-out-outline" size={20} color="white" />
          </Pressable>
        </View>
      </View>

      <View className="items-center pb-6 px-5 bg-white rounded-t-[40px] -mt-12 shadow-2xl">
        <View className="-mt-14 p-1.5 bg-white rounded-full shadow-2xl">
          <View className="rounded-full overflow-hidden border-4 border-white">
            <Avatar user={user as any} size={110} />
          </View>
        </View>

        {/* Name + badge */}
        <View className="flex-row items-center mt-4 gap-2">
          <Text className="text-3xl font-black text-gray-900 tracking-tight">{user?.name || user?.username}</Text>
          <Pressable onPress={() => navigation.navigate('EditProfile')} className="bg-indigo-50 rounded-xl p-2 border border-indigo-100">
            <Ionicons name="pencil" size={16} color="#6366F1" />
          </Pressable>
        </View>
        <Text className="text-indigo-500 font-black text-sm uppercase tracking-widest mt-1">@{user?.username}</Text>

        <Text className="text-gray-500 text-center mt-4 px-6 text-[14px] leading-[22px] font-medium">
          {user?.bio || user?.about || "Elevating the future of networking at Fync 💫"}
        </Text>

        <View className="flex-row items-center mt-4 px-4 py-2 bg-gray-50 rounded-2xl border border-gray-100 gap-2">
          <Ionicons name="location" size={16} color="#6366F1" />
          <Text className="text-gray-900 text-xs font-black uppercase tracking-wider">{user?.college || 'Earth'}</Text>
        </View>

        {/* Stats Dashboard */}
        <View className="flex-row w-full bg-gray-900 rounded-[32px] mt-6 p-6 shadow-xl shadow-gray-300">
          {[
            { label: 'Posts', value: posts.length },
            { label: 'Followers', value: user?.followers?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'followers' }) },
            { label: 'Following', value: user?.following?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'following' }) },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View className="w-[1px] h-8 self-center bg-white/10" />}
              <Pressable className="items-center flex-1" onPress={s.onPress}>
                <Text className="text-xl font-black text-white">{s.value}</Text>
                <Text className="text-gray-400 text-[9px] font-black uppercase tracking-widest mt-1">{s.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Subscription Status Bar */}
        {subscription?.status === 'active' && (
          <View className="w-full mt-4 bg-indigo-50 border border-indigo-100 rounded-2xl px-5 py-3 flex-row items-center justify-between">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-indigo-600 rounded-xl items-center justify-center mr-3">
                <Ionicons name="flash" size={16} color="white" />
              </View>
              <View>
                <Text className="text-indigo-900 font-black text-[10px] uppercase tracking-widest">
                  {subscription.isLifetime ? "Lifetime Access" : "Premium Member"}
                </Text>
                <Text className="text-indigo-600 font-bold text-[11px] mt-0.5">
                  {subscription.isLifetime ? "Infinite Protocol Active" : `${subscription.daysRemaining} Days remaining`}
                </Text>
              </View>
            </View>
            {!subscription.isLifetime && (
              <Pressable 
                onPress={() => navigation.navigate('SubscriptionScreen')}
                className="bg-white px-3 py-1.5 rounded-lg border border-indigo-200"
              >
                <Text className="text-indigo-600 font-black text-[9px] uppercase tracking-tighter">Extend</Text>
              </Pressable>
            )}
          </View>
        )}

        {subscription?.status === 'expired' && (
          <Pressable 
            onPress={() => navigation.navigate('SubscriptionScreen')}
            className="w-full mt-4 bg-orange-50 border border-orange-100 rounded-2xl px-5 py-3 flex-row items-center justify-between"
          >
             <View className="flex-row items-center">
              <View className="w-8 h-8 bg-orange-500 rounded-xl items-center justify-center mr-3">
                <Ionicons name="alert-circle" size={18} color="white" />
              </View>
              <View>
                <Text className="text-orange-900 font-black text-[10px] uppercase tracking-widest">Plan Expired</Text>
                <Text className="text-orange-600 font-bold text-[11px] mt-0.5">Renew to unlock all features</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#f97316" />
          </Pressable>
        )}

        {/* Action buttons */}
        <View className="flex-row gap-4 mt-6 w-full">
          <Pressable onPress={() => navigation.navigate('EditProfile')}
            className="flex-1 bg-white border-2 border-gray-100 py-4 rounded-[24px] items-center shadow-sm">
            <Text className="text-gray-900 font-black uppercase text-xs tracking-widest">Edit Profile</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
            className="flex-1 bg-indigo-600 py-4 rounded-[24px] items-center shadow-lg shadow-indigo-200">
            <Text className="text-white font-black uppercase text-xs tracking-widest">Portfolio</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // ── Tab Bar ────────────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View className="flex-row bg-white border-t border-gray-100 py-2 px-4 shadow-sm">
      {[
        { key: 'posts', icon: 'grid-outline', activeIcon: 'grid' },
        { key: 'shorts', icon: 'play-circle-outline', activeIcon: 'play-circle' },
        { key: 'about', icon: 'person-outline', activeIcon: 'person' },
      ].map((t, i) => {
        const isActive = activeTab === t.key;
        return (
          <Pressable key={t.key} onPress={() => setActiveTab(t.key as any)} className="flex-1 items-center py-2 relative">
            <View className={`w-14 h-10 rounded-2xl items-center justify-center ${isActive ? 'bg-indigo-50' : 'bg-transparent'}`}>
              <Ionicons name={(isActive ? t.activeIcon : t.icon) as any} size={24}
                color={isActive ? '#6366F1' : '#9CA3AF'} />
            </View>
            {isActive && <View className="absolute bottom-[-4px] w-1 h-1 bg-indigo-600 rounded-full" />}
          </Pressable>
        );
      })}
    </View>
  );

  // ── Grid item ─────────────────────────────────────────────────────────
  const renderGridItem = ({ item, isShort }: { item: any; isShort?: boolean }) => (
    <Pressable
      onPress={() => navigation.navigate('IndividualPostOrShort', isShort ? { shortId: item._id } : { postId: item._id })}
      onLongPress={() => Alert.alert(
        isShort ? 'Delete Short' : 'Delete Post', 'Are you sure?',
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => isShort ? deleteShort(item._id) : deletePost(item._id) }]
      )}
      className="m-[1px] rounded-lg overflow-hidden"
      style={{ width: (width / 3) - 2, height: isShort ? (width / 1.8) : (width / 3) }}>
      {isShort ? (
        <View className="w-full h-full bg-gray-100 overflow-hidden">
          <Video source={{ uri: getFullUrl(item.video) || '' }} style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER} shouldPlay={false} positionMillis={100} />
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} className="absolute inset-0" />
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1.5">
            <Ionicons name="play" size={12} color="white" />
            <Text className="text-white text-[10px] font-black">{item.views || 0}</Text>
          </View>
        </View>
      ) : item.image?.length > 0 ? (
        <ExpoImage source={{ uri: getFullUrl(item.image[0]) || '' }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      ) : (
        <View className="w-full h-full bg-indigo-50/50 items-center justify-center p-3">
          <Text className="text-indigo-400 text-[10px] font-bold text-center" numberOfLines={4}>{item.title || item.description}</Text>
        </View>
      )}
      {!isShort && item.image?.length > 1 && (
        <View className="absolute top-2 right-2 bg-black/40 px-1.5 py-1 rounded-lg backdrop-blur-md">
          <Ionicons name="layers" size={10} color="white" />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom']}>
      <StatusBar style="dark" />
      <FlatList
        key={activeTab}
        data={activeTab === 'posts' ? posts : activeTab === 'shorts' ? shorts : (['ABOUT'] as any)}
        keyExtractor={(item, i) => (typeof item === 'string' ? item : item._id + i)}
        numColumns={activeTab === 'about' ? 1 : 3}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={<>{renderProfileInfo()}{renderTabBar()}</>}
        renderItem={({ item }) => {
          if (activeTab === 'about') return <AboutSection user={user} isOwner onRefresh={onRefresh} />;
          if (activeTab === 'posts') return renderGridItem({ item, isShort: false });
          if (activeTab === 'shorts') return renderGridItem({ item, isShort: true });
          return null;
        }}
        ListFooterComponent={isLoadingMore ? <View className="py-4"><ActivityIndicator size="small" color="#6366F1" /></View> : null}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Ionicons name="images-outline" size={48} color="#d1d5db" />
            <Text className="text-gray-400 mt-4 font-medium">No content here yet</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </SafeAreaView>
  );
}

export default Profile;
