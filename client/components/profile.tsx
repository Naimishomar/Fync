import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import Avatar from './Avatar';
import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
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
  <View className="flex-row items-center gap-2 mb-3 px-1">
    <View className="w-1 h-5 rounded-full" style={{ backgroundColor: accent }} />
    <Ionicons name={icon as any} size={16} color={accent} />
    <Text className="font-bold text-gray-800 text-sm uppercase tracking-wide">{title}</Text>
  </View>
);

// ─── SKILL CHIP ───────────────────────────────────────────────────────────────
const SkillChip = ({ label }: { label: string }) => (
  <View className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full">
    <Text className="text-indigo-700 text-xs font-semibold">{label}</Text>
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
      className="flex-1 rounded-2xl border p-3 items-center"
      style={{ backgroundColor: bg, borderColor: color + '30' }}
    >
      {typeof icon === 'string' && icon.startsWith('http')
        ? <Image source={{ uri: icon }} className="w-7 h-7 mb-2" resizeMode="contain" />
        : <Ionicons name={icon} size={24} color={color} style={{ marginBottom: 6 }} />}
      <Text className="font-bold text-base" style={{ color }}>{solved || 0}</Text>
      <Text className="text-[10px] text-gray-500 mb-0.5">Problems</Text>
      {rating ? <Text className="text-[10px] font-bold" style={{ color }}>⭐ {rating}</Text> : null}
      <Text className="text-[10px] text-gray-400 mt-1 font-medium">{name}</Text>
    </Pressable>
  );
};

// ─── EDUCATION CARD ────────────────────────────────────────────────────────────
const EducationCard = ({ item, isOwner, onEdit, onDelete }: {
  item: EducationEntry; isOwner?: boolean;
  onEdit?: (i: EducationEntry) => void; onDelete?: (id: string) => void;
}) => (
  <View className="bg-white rounded-2xl border border-gray-100 p-4 mb-3 shadow-sm">
    <View className="flex-row">
      <View className="w-10 h-10 bg-blue-50 rounded-xl items-center justify-center mr-3 flex-shrink-0">
        <Ionicons name="school" size={22} color="#3B82F6" />
      </View>
      <View className="flex-1">
        <Text className="text-gray-900 font-bold text-sm">{item.institution}</Text>
        {item.degree && <Text className="text-gray-600 text-sm">{item.degree}{item.field ? ` · ${item.field}` : ''}</Text>}
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 mt-1">
          {(item.startYear || item.endYear) && (
            <Text className="text-gray-400 text-xs">
              {item.startYear || '?'} — {item.isCurrent ? 'Present' : (item.endYear || '?')}
            </Text>
          )}
          {item.grade && (
            <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              <Text className="text-emerald-700 text-[10px] font-bold">{item.grade}</Text>
            </View>
          )}
          {item.isCurrent && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              <Text className="text-blue-600 text-[10px] font-bold">CURRENT</Text>
            </View>
          )}
        </View>
        {item.description && <Text className="text-gray-500 text-xs mt-1.5" numberOfLines={2}>{item.description}</Text>}
      </View>
      {isOwner && (
        <View className="ml-2 gap-2">
          <Pressable onPress={() => onEdit?.(item)}>
            <Ionicons name="pencil-outline" size={16} color="#6366F1" />
          </Pressable>
          <Pressable onPress={() => onDelete?.(item._id)}>
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
    <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ paddingBottom: 60 }}>

      {/* ── Fync Score Banner ──────────────────────────────────────────── */}
      {user?.fyncScore !== undefined && (
        <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
          className="mx-4 mt-4 mb-2 bg-indigo-600 rounded-2xl px-5 py-4 flex-row items-center">
          <Text style={{ fontSize: 28 }}>{BADGE_EMOJI[user.fyncBadge || 'Newcomer']}</Text>
          <View className="ml-3 flex-1">
            <Text className="text-white font-bold text-lg">{user.fyncScore} / 1000</Text>
            <Text className="text-indigo-200 text-xs">{user.fyncBadge || 'Newcomer'} · Tap for full portfolio →</Text>
          </View>
        </Pressable>
      )}

      {/* ── About ──────────────────────────────────────────────────────── */}
      {user?.about && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <SH title="About" icon="person-outline" />
          <Text className="text-gray-600 text-sm leading-relaxed">{user.about}</Text>
        </View>
      )}

      {/* ── Skills ──────────────────────────────────────────────────────── */}
      {skills.length > 0 && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <SH title="Skills" icon="code-slash-outline" accent="#8B5CF6" />
          <View className="flex-row flex-wrap gap-2">
            {skills.map((s, i) => <SkillChip key={i} label={s} />)}
          </View>
        </View>
      )}

      {/* ── Interests & Hobbies ─────────────────────────────────────────── */}
      {(user?.interest || user?.hobbies) && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <SH title="Interests & Hobbies" icon="heart-outline" accent="#EC4899" />
          <View className="flex-row flex-wrap gap-2">
            {(Array.isArray(user.interest) ? user.interest : [user.interest]).filter(Boolean).map((t, i) => (
              <View key={`i${i}`} className="bg-pink-50 border border-pink-100 px-3 py-1.5 rounded-full">
                <Text className="text-pink-700 text-xs font-semibold">♥ {t}</Text>
              </View>
            ))}
            {(Array.isArray(user.hobbies) ? user.hobbies : [user.hobbies]).filter(Boolean).map((h, i) => (
              <View key={`h${i}`} className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
                <Text className="text-emerald-700 text-xs font-semibold">★ {h}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Education ───────────────────────────────────────────────────── */}
      <View className="mx-4 mt-4">
        <View className="flex-row items-center justify-between mb-3">
          <View className="flex-row items-center gap-2">
            <View className="w-1 h-5 rounded-full bg-blue-500" />
            <Ionicons name="school-outline" size={16} color="#3B82F6" />
            <Text className="font-bold text-gray-800 text-sm uppercase tracking-wide">Education</Text>
          </View>
          {isOwner && (
            <Pressable onPress={() => { setEditingEdu(undefined); setShowAddEdu(true); }}
              className="flex-row items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
              <Ionicons name="add" size={14} color="#3B82F6" />
              <Text className="text-blue-600 text-xs font-semibold">Add</Text>
            </Pressable>
          )}
        </View>
        {education.length === 0 ? (
          <View className="bg-white rounded-2xl border border-gray-100 p-6 items-center">
            <Ionicons name="school-outline" size={36} color="#D1D5DB" />
            <Text className="text-gray-400 text-sm mt-2">No education added yet</Text>
          </View>
        ) : education.map(e => (
          <EducationCard key={e._id} item={e} isOwner={isOwner}
            onEdit={(i) => { setEditingEdu(i); setShowAddEdu(true); }}
            onDelete={deleteEdu} />
        ))}
      </View>

      {/* ── Coding Platforms ─────────────────────────────────────────────── */}
      {(hasCoding || isOwner) && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <View className="flex-row items-center justify-between mb-3">
            <SH title="Coding Stats" icon="code-slash-outline" accent="#0EA5E9" />
            {isOwner && (
              <Pressable onPress={() => setShowCodingModal(true)}
                className="flex-row items-center gap-1 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100">
                <Ionicons name="pencil-outline" size={12} color="#0EA5E9" />
                <Text className="text-sky-600 text-xs font-semibold">Update</Text>
              </Pressable>
            )}
          </View>

          {/* Total solved banner */}
          {cs.totalSolved ? (
            <View className="bg-indigo-50 rounded-xl px-4 py-3 mb-3 border border-indigo-100 flex-row items-center justify-between">
              <Text className="text-indigo-700 font-bold text-sm">Total Problems Solved</Text>
              <Text className="text-indigo-800 font-black text-xl">{cs.totalSolved}</Text>
            </View>
          ) : null}

          <View className="flex-row gap-2">
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
      )}

      {/* ── Social Links ─────────────────────────────────────────────────── */}
      {(user?.github_id || user?.linkedIn_id || user?.githubUsername) && (
        <View className="mx-4 mt-4 bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <SH title="Social Links" icon="share-outline" accent="#1F2937" />
          <View className="gap-2.5">
            {user?.github_id && (
              <Pressable onPress={() => Linking.openURL(user.github_id!)}
                className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <Ionicons name="logo-github" size={22} color="#1F2937" />
                <Text className="text-gray-700 ml-3 font-medium flex-1">GitHub</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {user?.linkedIn_id && (
              <Pressable onPress={() => Linking.openURL(user.linkedIn_id!)}
                className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <Ionicons name="logo-linkedin" size={22} color="#0077B5" />
                <Text className="text-gray-700 ml-3 font-medium flex-1">LinkedIn</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {cp.leetcode && (
              <Pressable onPress={() => Linking.openURL(`https://leetcode.com/${cp.leetcode}`)}
                className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <Image source={{ uri: 'https://assets.streamlinehq.com/image/private/w_300,h_300,ar_1/f_auto/v1/icons/logos/leetcode-xp0gbbxtpmnkjk8uhdrmhg.png/leetcode-jj5yfhjdsmrt5j9xb3sec.png?_a=DATAiZiuZAA0' }} className="w-5 h-5" resizeMode="contain" />
                <Text className="text-gray-700 ml-3 font-medium flex-1">LeetCode @{cp.leetcode}</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {cp.gfg && (
              <Pressable onPress={() => Linking.openURL(`https://www.geeksforgeeks.org/user/${cp.gfg}`)}
                className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <Image source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/e/eb/GeeksForGeeks_logo.png' }} className="w-5 h-5" resizeMode="contain" />
                <Text className="text-gray-700 ml-3 font-medium flex-1">GFG @{cp.gfg}</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {cp.codechef && (
              <Pressable onPress={() => Linking.openURL(`https://www.codechef.com/users/${cp.codechef}`)}
                className="flex-row items-center bg-gray-50 px-4 py-3 rounded-xl border border-gray-100">
                <Text style={{ fontSize: 18, marginRight: 2 }}>👨‍🍳</Text>
                <Text className="text-gray-700 ml-2 font-medium flex-1">CodeChef @{cp.codechef}</Text>
                <Ionicons name="open-outline" size={16} color="#9CA3AF" />
              </Pressable>
            )}
            {user?.upiId && (
              <View className="flex-row items-center bg-green-50 px-4 py-3 rounded-xl border border-green-100">
                <Ionicons name="wallet-outline" size={22} color="#059669" />
                <View className="ml-3">
                  <Text className="text-green-800 text-[10px] font-bold uppercase">UPI ID</Text>
                  <Text className="text-green-700 font-medium">{user.upiId}</Text>
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

  useEffect(() => { getPosts(1, true); getShorts(1, true); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([getPosts(1, true), getShorts(1, true), refreshUser()]);
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    if (isLoadingMore) return;
    if (activeTab === 'posts' && hasMorePosts) getPosts(postsPage + 1);
    else if (activeTab === 'shorts' && hasMoreShorts) getShorts(shortsPage + 1);
  };

  const deletePost = async (id: string) => {
    try {
      const res = await axios.delete(`/post/${id}`);
      if (res.data.success) { setPosts(p => p.filter(x => x._id !== id)); Toast.show({ type: 'success', text1: 'Post deleted' }); }
    } catch { Toast.show({ type: 'error', text1: 'Failed to delete' }); }
  };

  const deleteShort = async (id: string) => {
    try {
      const res = await axios.post(`/shorts/delete/${id}`);
      if (res.data.success) { setShorts(p => p.filter(x => x._id !== id)); Toast.show({ type: 'success', text1: 'Short deleted' }); }
    } catch { Toast.show({ type: 'error', text1: 'Failed to delete' }); }
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
      <View className="h-52 w-full relative">
        <ExpoImage
          source={{ uri: user?.banner || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=1000' }}
          style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="disk" />
        <View className="absolute inset-0 bg-black/15" />
        <View className="absolute top-12 right-4 flex-row gap-3 bg-white/90 p-2 rounded-2xl">
          <Pressable onPress={clearAppCache}><Ionicons name="trash-outline" size={20} color="#6B7280" /></Pressable>
          <Pressable onPress={() => Alert.alert('Logout', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', onPress: handleLogout, style: 'destructive' }
          ])}><Ionicons name="log-out-outline" size={20} color="#EF4444" /></Pressable>
        </View>
      </View>

      <View className="items-center pb-4 px-4 bg-white rounded-t-[28px] -mt-6">
        <View className="-mt-10 p-1 bg-white rounded-full shadow-lg">
          <Avatar user={user as any} size={90} />
        </View>

        {/* Name + badge */}
        <View className="flex-row items-center mt-2 gap-2">
          <Text className="text-2xl font-bold text-gray-900">{user?.name || user?.username}</Text>
          <Pressable onPress={() => navigation.navigate('EditProfile')} className="bg-blue-100 rounded-full p-1">
            <Ionicons name="pencil" size={14} color="#3B82F6" />
          </Pressable>
        </View>
        <Text className="text-gray-400 text-sm">@{user?.username}</Text>

        {/* Fync score badge small */}
        {user?.fyncScore !== undefined && (
          <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
            className="flex-row items-center gap-1.5 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full mt-2">
            <Text style={{ fontSize: 12 }}>{BADGE_EMOJI[user?.fyncBadge || 'Newcomer']}</Text>
            <Text className="text-indigo-600 text-xs font-bold">{user?.fyncBadge || 'Newcomer'}</Text>
            <Text className="text-indigo-400 text-xs">·</Text>
            <Text className="text-indigo-700 text-xs font-black">{user?.fyncScore}</Text>
            <Text className="text-indigo-400 text-[9px]">/ 1000</Text>
          </Pressable>
        )}

        <Text className="text-gray-400 text-center mt-2 px-8 text-xs leading-4">
          {user?.bio || user?.about || "I'm delighted to introduce myself as a Fync member"} 💫
        </Text>

        <View className="flex-row items-center mt-2 px-3 py-1.5 bg-gray-100 rounded-full gap-1.5">
          <Ionicons name="school-outline" size={14} color="#6B7280" />
          <Text className="text-gray-600 text-xs font-semibold">{user?.college}</Text>
        </View>

        {/* Stats */}
        <View className="flex-row w-full justify-around mt-5 border-t border-b border-gray-50 py-4">
          {[
            { label: 'Posts', value: posts.length },
            { label: 'Followers', value: user?.followers?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'followers' }) },
            { label: 'Following', value: user?.following?.length || 0, onPress: () => navigation.navigate('FollowersAndFollowing', { userId: user._id, type: 'following' }) },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View className="w-[1px] h-6 self-center bg-gray-100" />}
              <Pressable className="items-center flex-1" onPress={s.onPress}>
                <Text className="text-lg font-bold text-gray-900">{s.value}</Text>
                <Text className="text-gray-400 text-[10px] uppercase tracking-wide">{s.label}</Text>
              </Pressable>
            </React.Fragment>
          ))}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3 mt-5 w-full">
          <Pressable onPress={() => navigation.navigate('EditProfile')}
            className="flex-1 bg-white border border-gray-200 py-2.5 rounded-xl items-center">
            <Text className="text-gray-900 font-semibold">Edit Profile</Text>
          </Pressable>
          <Pressable onPress={() => navigation.navigate('FyncProfileBuilder')}
            className="flex-1 bg-indigo-600 py-2.5 rounded-xl items-center">
            <Text className="text-white font-semibold">My Portfolio</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );

  // ── Tab Bar ────────────────────────────────────────────────────────────
  const renderTabBar = () => (
    <View className="flex-row bg-white border-t border-gray-50 py-1">
      {[
        { key: 'posts', icon: 'grid' },
        { key: 'shorts', icon: 'movie-play-outline' },
        { key: 'about', icon: 'account-details-outline' },
      ].map((t, i) => (
        <Pressable key={t.key} onPress={() => setActiveTab(t.key as any)} className="flex-1 items-center py-3 relative">
          <MaterialCommunityIcons name={t.icon as any} size={i === 2 ? 30 : 26}
            color={activeTab === t.key ? 'black' : '#d1d5db'} />
          {activeTab === t.key && <View className="absolute bottom-1 w-8 h-0.5 bg-black rounded-full" />}
        </Pressable>
      ))}
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
      className="m-[0.5px]"
      style={{ width: (width / 3) - 1, height: isShort ? (width / 2) : (width / 3), overflow: 'hidden' }}>
      {isShort ? (
        <View className="w-full h-full bg-gray-100 overflow-hidden">
          <Video source={{ uri: item.video }} style={{ width: '100%', height: '100%' }}
            resizeMode={ResizeMode.COVER} shouldPlay={false} positionMillis={100} />
          <View className="absolute inset-0 bg-black/10" />
          <View className="absolute bottom-2 left-2 flex-row items-center gap-1">
            <Ionicons name="play" size={12} color="white" />
            <Text className="text-white text-[10px] font-bold">{item.views || 0}</Text>
          </View>
        </View>
      ) : item.image?.length > 0 ? (
        <Image source={{ uri: item.image[0] }} className="w-full h-full" resizeMode="cover" />
      ) : (
        <View className="w-full h-full bg-gray-50 items-center justify-center">
          <Text className="text-gray-400 text-xs p-2 text-center" numberOfLines={3}>{item.title}</Text>
        </View>
      )}
      {!isShort && item.image?.length > 1 && (
        <View className="absolute top-2 right-2 bg-black/30 px-1.5 py-0.5 rounded-full">
          <Ionicons name="copy" size={10} color="white" />
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