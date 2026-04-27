import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/auth.context';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

import FyncScoreCard from './FyncScoreCard';
import ProjectCard from './ProjectCard';
import InternshipCard from './InternshipCard';
import CertificateCard from './CertificateCard';
import GitHubStatsCard from './GitHubStatsCard';
import AddProjectModal from './AddProjectModal';
import AddInternshipModal from './AddInternshipModal';
import AddCertificateModal from './AddCertificateModal';
import CodingProfilesModal from './CodingProfilesModal';

// ─── Completeness Bar ─────────────────────────────────────────────────────────
function CompletenessBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#6366F1';
  return (
    <View className="mx-4 mb-4 bg-white rounded-2xl p-4 border border-gray-100">
      <View className="flex-row justify-between mb-2">
        <Text className="text-gray-700 font-bold text-sm">Profile Completeness</Text>
        <Text className="font-bold text-sm" style={{ color }}>{pct}%</Text>
      </View>
      <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
      {pct < 100 && (
        <Text className="text-gray-400 text-xs mt-1.5">
          {pct < 50 ? '🚀 Add projects & work experience to boost your score!'
            : pct < 80 ? '💡 Almost there — connect GitHub & add certificates!'
            : '🌟 You\'re almost a Legend! Complete all sections.'}
        </Text>
      )}
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, icon, onAdd, addLabel }: {
  title: string; icon: string; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 mb-3 mt-5">
      <View className="flex-row items-center gap-2">
        <Ionicons name={icon as any} size={18} color="#6366F1" />
        <Text className="text-gray-900 font-bold text-base">{title}</Text>
      </View>
      {onAdd && (
        <Pressable onPress={onAdd}
          className="flex-row items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
          <Ionicons name="add" size={14} color="#6366F1" />
          <Text className="text-indigo-600 text-xs font-semibold">{addLabel || 'Add'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FyncProfileBuilder() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'experience' | 'certs'>('overview');

  // Modals
  const [showAddProject, setShowAddProject]   = useState(false);
  const [showAddInternship, setShowAddInternship] = useState(false);
  const [showAddCert, setShowAddCert]         = useState(false);
  const [editingProject, setEditingProject]   = useState<any>(null);
  const [editingInternship, setEditingInternship] = useState<any>(null);
  const [editingCert, setEditingCert]         = useState<any>(null);
  const [showCodingModal, setShowCodingModal] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`/profile/full/${user?._id}`);
      if (res.data.success) setProfile(res.data.profile);
    } catch (e) {
      console.log('FyncProfileBuilder fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  useEffect(() => {
    if (route.params?.username) {
      Toast.show({
        type: 'success',
        text1: 'GitHub Connected!',
        text2: `Connected as ${route.params.username}`
      });
      fetchProfile();
      // Clear params to prevent re-toast
      navigation.setParams({ username: undefined });
    }
  }, [route.params?.username]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

  // ── GitHub handlers ──────────────────────────────────────────────────────
  const connectGitHub = async () => {
    try {
      const res = await axios.get('/profile/github/connect');
      if (res.data.url) await Linking.openURL(res.data.url);
    } catch { Toast.show({ type: 'error', text1: 'Failed to initiate GitHub OAuth' }); }
  };

  const syncGitHub = async () => {
    try {
      const res = await axios.post('/profile/github/sync');
      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'GitHub synced!' });
        fetchProfile();
      }
    } catch (e: any) {
      Toast.show({ type: 'info', text1: e?.response?.data?.message || 'Sync failed' });
    }
  };

  const disconnectGitHub = () => {
    Alert.alert('Disconnect GitHub', 'Are you sure? Your GitHub stats will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        await axios.delete('/profile/github/disconnect');
        fetchProfile();
      } }
    ]);
  };

  // ── Project handlers ─────────────────────────────────────────────────────
  const deleteProject = (id: string) => {
    Alert.alert('Delete Project', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await axios.delete(`/profile/projects/${id}`);
        fetchProfile();
        Toast.show({ type: 'success', text1: 'Project deleted' });
      }}
    ]);
  };

  const toggleFeatured = async (id: string) => {
    await axios.post(`/profile/projects/${id}/feature`);
    fetchProfile();
  };

  const toggleLike = async (id: string) => {
    await axios.post(`/profile/projects/${id}/like`);
    fetchProfile();
  };

  // ── Internship handlers ───────────────────────────────────────────────────
  const deleteInternship = (id: string) => {
    Alert.alert('Delete Experience', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await axios.delete(`/profile/internships/${id}`);
        fetchProfile();
      }}
    ]);
  };

  // ── Certificate handlers ──────────────────────────────────────────────────
  const deleteCert = (id: string) => {
    Alert.alert('Delete Certificate', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await axios.delete(`/profile/certificates/${id}`);
        fetchProfile();
      }}
    ]);
  };

  // ─── Download Resume ──────────────────────────────────────────────────────
  const downloadResume = async () => {
    const url = `${axios.defaults.baseURL}/profile/resume/${user?._id}/pdf`;
    await Linking.openURL(url);
  };

  if (loading) return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#6366F1" />
    </SafeAreaView>
  );

  const { projects = [], internships = [], certificates = [], score, completeness } = profile || {};
  const pct = completeness?.percentage || 0;

  // ─── Tab Content ──────────────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <CompletenessBar pct={pct} />
            
            {/* 📝 Coding Profile Note */}
            <Pressable 
              onPress={() => setShowCodingModal(true)}
              className="mx-4 mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex-row items-center active:bg-indigo-100"
            >
              <View className="bg-indigo-600 p-1.5 rounded-lg mr-3">
                <Ionicons name="code-working" size={16} color="white" />
              </View>
              <View className="flex-1">
                <Text className="text-indigo-900 text-xs font-bold">Coding Profiles</Text>
                <Text className="text-indigo-600 text-[10px]">Add LeetCode, Codeforces & more to boost your score</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#6366F1" />
            </Pressable>

            <FyncScoreCard userId={user?._id!} isOwner onRecalculate={fetchProfile} />
            <GitHubStatsCard
              username={profile?.user?.githubUsername}
              stats={profile?.user?.githubStats}
              isOwner
              onConnect={connectGitHub}
              onSync={syncGitHub}
              onDisconnect={disconnectGitHub}
            />
          </>
        );

      case 'projects':
        return (
          <>
            <SectionHeader title="Projects" icon="code-slash-outline"
              onAdd={() => { setEditingProject(null); setShowAddProject(true); }}
              addLabel="Add Project" />
            {projects.length === 0 ? (
              <View className="items-center py-12 px-8">
                <Ionicons name="rocket-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-400 font-medium mt-3 text-center">
                  No projects yet. Add your first project to boost your Fync Score!
                </Text>
              </View>
            ) : projects.map((p: any) => (
              <ProjectCard key={p._id} project={p} isOwner currentUserId={user?._id}
                onEdit={(p) => { setEditingProject(p); setShowAddProject(true); }}
                onDelete={deleteProject}
                onToggleFeatured={toggleFeatured}
                onLike={toggleLike} />
            ))}
          </>
        );

      case 'experience':
        return (
          <>
            <SectionHeader title="Work Experience" icon="briefcase-outline"
              onAdd={() => { setEditingInternship(null); setShowAddInternship(true); }}
              addLabel="Add Experience" />
            {internships.length === 0 ? (
              <View className="items-center py-12 px-8">
                <Ionicons name="briefcase-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-400 font-medium mt-3 text-center">
                  No experience added yet. Add internships, freelance, or jobs!
                </Text>
              </View>
            ) : internships.map((i: any) => (
              <InternshipCard key={i._id} item={i} isOwner
                onEdit={(i) => { setEditingInternship(i); setShowAddInternship(true); }}
                onDelete={deleteInternship} />
            ))}
          </>
        );

      case 'certs':
        return (
          <>
            <SectionHeader title="Certificates" icon="ribbon-outline"
              onAdd={() => { setEditingCert(null); setShowAddCert(true); }}
              addLabel="Add Cert" />
            {certificates.length === 0 ? (
              <View className="items-center py-12 px-8">
                <Ionicons name="ribbon-outline" size={48} color="#D1D5DB" />
                <Text className="text-gray-400 font-medium mt-3 text-center">
                  No certificates added yet. Showcase your learning!
                </Text>
              </View>
            ) : (
              <View className="mx-4 gap-3">
                {certificates.map((c: any) => (
                  <CertificateCard key={c._id} cert={c} isOwner
                    onEdit={(c) => { setEditingCert(c); setShowAddCert(true); }}
                    onDelete={deleteCert} />
                ))}
              </View>
            )}
          </>
        );
    }
  };

  const TABS = [
    { key: 'overview',    label: 'Overview', icon: 'home-outline' },
    { key: 'projects',    label: 'Projects',  icon: 'code-slash-outline' },
    { key: 'experience',  label: 'Work',      icon: 'briefcase-outline' },
    { key: 'certs',       label: 'Certs',     icon: 'ribbon-outline' },
  ] as const;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => navigation.goBack()}
            className="bg-gray-100 p-2 rounded-full">
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </Pressable>
          <View>
            <Text className="text-gray-900 font-bold text-lg">Fync Portfolio</Text>
            <Text className="text-gray-400 text-xs">{pct}% complete</Text>
          </View>
        </View>
        <Pressable onPress={downloadResume}
          className="flex-row items-center gap-1.5 bg-indigo-600 px-3 py-2 rounded-xl">
          <Ionicons name="download-outline" size={16} color="white" />
          <Text className="text-white font-semibold text-xs">Resume</Text>
        </Pressable>
      </View>

      {/* Tab Strip */}
      <View className="flex-row bg-white border-b border-gray-100 px-2">
        {TABS.map(tab => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            className={`flex-1 items-center py-3 border-b-2 ${activeTab === tab.key ? 'border-indigo-600' : 'border-transparent'}`}
          >
            <Ionicons name={tab.icon as any} size={18}
              color={activeTab === tab.key ? '#6366F1' : '#9CA3AF'} />
            <Text className={`text-[10px] font-semibold mt-0.5 ${activeTab === tab.key ? 'text-indigo-600' : 'text-gray-400'}`}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />}
        contentContainerStyle={{ paddingBottom: 40, paddingTop: 8 }}
      >
        {renderContent()}
      </ScrollView>

      {/* Modals */}
      <AddProjectModal
        visible={showAddProject}
        initial={editingProject}
        onClose={() => setShowAddProject(false)}
        onSuccess={() => { setShowAddProject(false); fetchProfile(); }}
      />
      <AddInternshipModal
        visible={showAddInternship}
        initial={editingInternship}
        onClose={() => setShowAddInternship(false)}
        onSuccess={() => { setShowAddInternship(false); fetchProfile(); }}
      />
      <AddCertificateModal
        visible={showAddCert}
        initial={editingCert}
        onClose={() => setShowAddCert(false)}
        onSuccess={() => { setShowAddCert(false); fetchProfile(); }}
      />
      <CodingProfilesModal
        visible={showCodingModal}
        initialData={profile?.user?.codingProfiles}
        onClose={() => setShowCodingModal(false)}
        onSuccess={() => { setShowCodingModal(false); fetchProfile(); }}
      />
    </SafeAreaView>
  );
}
