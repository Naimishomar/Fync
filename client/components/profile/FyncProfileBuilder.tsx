import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, Alert, Linking, Dimensions, Platform, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, FontAwesome5 } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../context/auth.context';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';

import FyncScoreCard from './FyncScoreCard';
import ProjectCard from './ProjectCard';
import InternshipCard from './InternshipCard';
import CertificateCard from './CertificateCard';
import GitHubStatsCard from './GitHubStatsCard';
import AddProjectModal from './AddProjectModal';
import AddInternshipModal from './AddInternshipModal';
import AddCertificateModal from './AddCertificateModal';
import CodingProfilesModal from './CodingProfilesModal';

const { width } = Dimensions.get('window');

// ─── Completeness Bar ─────────────────────────────────────────────────────────
function CompletenessBar({ pct }: { pct: number }) {
  return (
    <View className="mx-4 mb-6 bg-white rounded-[28px] p-6 border border-slate-100 shadow-sm shadow-black/5">
      <View className="flex-row justify-between mb-3">
        <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-widest">Profile Completeness</Text>
        <Text className="font-black text-xs text-orange-500">{pct}%</Text>
      </View>
      <View className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <View className="h-full rounded-full overflow-hidden" style={{ width: `${pct}%` }}>
          <LinearGradient
            colors={['#f97316', '#fb923c']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="h-full w-full"
          />
        </View>
      </View>
      {pct < 100 && (
        <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-wider mt-3">
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
    <View className="flex-row items-center justify-between px-6 mb-4 mt-8">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 bg-zinc-900 rounded-2xl items-center justify-center shadow-lg shadow-black/20">
          <Ionicons name={icon as any} size={18} color="#f97316" />
        </View>
        <Text className="text-zinc-900 font-black uppercase text-sm tracking-tighter">{title}</Text>
      </View>
      {onAdd && (
        <Pressable onPress={onAdd}
          className="flex-row items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
          <Ionicons name="add" size={16} color="#18181b" />
          <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest">{addLabel || 'Add'}</Text>
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
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddInternship, setShowAddInternship] = useState(false);
  const [showAddCert, setShowAddCert] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editingInternship, setEditingInternship] = useState<any>(null);
  const [editingCert, setEditingCert] = useState<any>(null);
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
      navigation.setParams({ username: undefined });
    }
  }, [route.params?.username]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  };

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
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          await axios.delete('/profile/github/disconnect');
          fetchProfile();
        }
      }
    ]);
  };

  const deleteProject = (id: string) => {
    Alert.alert('Delete Project', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await axios.delete(`/profile/projects/${id}`);
          fetchProfile();
          Toast.show({ type: 'success', text1: 'Project deleted' });
        }
      }
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

  const deleteInternship = (id: string) => {
    Alert.alert('Remove Experience', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await axios.delete(`/profile/internships/${id}`);
          fetchProfile();
        }
      }
    ]);
  };

  const deleteCert = (id: string) => {
    Alert.alert('Delete Certificate', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await axios.delete(`/profile/certificates/${id}`);
          fetchProfile();
        }
      }
    ]);
  };

  const downloadResume = async () => {
    const url = `${axios.defaults.baseURL}/profile/resume/${user?._id}/pdf`;
    await Linking.openURL(url);
  };

  if (loading) return (
    <SafeAreaView className="flex-1 bg-white items-center justify-center">
      <ActivityIndicator size="large" color="#f97316" />
    </SafeAreaView>
  );

  const { projects = [], internships = [], certificates = [], completeness } = profile || {};
  const pct = completeness?.percentage || 0;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View className="px-2">
            <CompletenessBar pct={pct} />

            {/* User Statistics Row */}
            <View className="flex-row mx-4 mb-6 gap-4">
              <View className="flex-1 bg-white border border-slate-100 rounded-[28px] p-5 shadow-sm shadow-black/5 items-center justify-center">
                <View className="bg-orange-100 p-3 rounded-2xl mb-3">
                   <Ionicons name="flame" size={24} color="#f97316" />
                </View>
                <Text className="text-zinc-900 text-2xl font-black tracking-tighter">{profile?.user?.highestStreak || 0}</Text>
                <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-1">Max Streak</Text>
              </View>
              
              <Pressable 
                onPress={() => setShowCodingModal(true)}
                className="flex-1 bg-white border border-slate-100 rounded-[28px] p-5 shadow-sm shadow-black/5 items-center justify-center"
              >
                <View className="bg-zinc-100 p-3 rounded-2xl mb-3">
                   <Ionicons name="code-working" size={24} color="#18181b" />
                </View>
                <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest text-center">Coding Profiles</Text>
                <Text className="text-slate-400 text-[8px] font-bold uppercase tracking-wider mt-1">Boost Score</Text>
              </Pressable>
            </View>

            <FyncScoreCard userId={user?._id!} isOwner onRecalculate={fetchProfile} />
            <GitHubStatsCard
              username={profile?.user?.githubUsername}
              stats={profile?.user?.githubStats}
              isOwner
              onConnect={connectGitHub}
              onSync={syncGitHub}
              onDisconnect={disconnectGitHub}
            />
          </View>
        );

      case 'projects':
        return (
          <View className="px-2">
            <SectionHeader title="Projects" icon="code-slash-outline"
              onAdd={() => { setEditingProject(null); setShowAddProject(true); }}
              addLabel="Add Project" />
            {projects.length === 0 ? (
              <View className="items-center py-20 px-8">
                <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-6">
                  <Feather name="box" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest text-center">No projects yet</Text>
                <Text className="text-slate-400 font-bold text-[10px] mt-2 text-center uppercase tracking-wider">
                  Add your first project to boost your Fync Score!
                </Text>
              </View>
            ) : projects.map((p: any) => (
              <ProjectCard key={p._id} project={p} isOwner currentUserId={user?._id}
                onEdit={(p) => { setEditingProject(p); setShowAddProject(true); }}
                onDelete={deleteProject}
                onToggleFeatured={toggleFeatured}
                onLike={toggleLike} />
            ))}
          </View>
        );

      case 'experience':
        return (
          <View className="px-2">
            <SectionHeader title="Work Experience" icon="briefcase-outline"
              onAdd={() => { setEditingInternship(null); setShowAddInternship(true); }}
              addLabel="Add Experience" />
            {internships.length === 0 ? (
              <View className="items-center py-20 px-8">
                <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-6">
                  <Ionicons name="briefcase-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest text-center">No experience added yet</Text>
                <Text className="text-slate-400 font-bold text-[10px] mt-2 text-center uppercase tracking-wider">
                  Add internships, freelance, or jobs!
                </Text>
              </View>
            ) : internships.map((i: any) => (
              <InternshipCard key={i._id} item={i} isOwner
                onEdit={(i) => { setEditingInternship(i); setShowAddInternship(true); }}
                onDelete={deleteInternship} />
            ))}
          </View>
        );

      case 'certs':
        return (
          <View className="px-2">
            <SectionHeader title="Certificates" icon="ribbon-outline"
              onAdd={() => { setEditingCert(null); setShowAddCert(true); }}
              addLabel="Add Cert" />
            {certificates.length === 0 ? (
              <View className="items-center py-20 px-8">
                <View className="w-20 h-20 bg-slate-50 rounded-full items-center justify-center mb-6">
                  <Ionicons name="ribbon-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-zinc-900 font-black uppercase text-xs tracking-widest text-center">No certificates added yet</Text>
                <Text className="text-slate-400 font-bold text-[10px] mt-2 text-center uppercase tracking-wider">
                  Showcase your learning!
                </Text>
              </View>
            ) : (
              <View className="mx-4 gap-4">
                {certificates.map((c: any) => (
                  <CertificateCard key={c._id} cert={c} isOwner
                    onEdit={(c) => { setEditingCert(c); setShowAddCert(true); }}
                    onDelete={deleteCert} />
                ))}
              </View>
            )}
          </View>
        );
    }
  };

  const TABS = [
    { key: 'overview',    label: 'Overview', icon: 'grid-outline' },
    { key: 'projects',    label: 'Projects',  icon: 'code-slash-outline' },
    { key: 'experience',  label: 'Work',      icon: 'briefcase-outline' },
    { key: 'certs',       label: 'Certs',     icon: 'ribbon-outline' },
  ] as const;

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION - MATCHING DRIVE/STUDY MATERIAL */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#f97316', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header Content */}
        <View className="px-8 pt-8 bg-transparent">
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center gap-4">
              <View>
                <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase leading-tight">Fync <Text className="text-orange-500">Portfolio</Text></Text>
                <View className="flex-row items-center">
                  <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px]">Core Interface</Text>
                </View>
              </View> 
            </View>
            <Pressable onPress={downloadResume}
              className="bg-zinc-900 px-4 py-3 rounded-2xl flex-row items-center shadow-xl shadow-black/20">
              <Feather name="file-text" size={14} color="#f97316" />
              <Text className="text-white font-black uppercase text-[10px] tracking-widest ml-2">Resume</Text>
            </Pressable>
          </View>
        </View>

        {/* Modern Tab Strip */}
        <View className="flex-row bg-white/50 px-4 py-2 border-b border-slate-100">
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 items-center py-4 relative`}
            >
              <Ionicons name={tab.icon as any} size={20}
                color={activeTab === tab.key ? '#f97316' : '#94A3B8'} />
              <Text className={`text-[8px] font-black uppercase tracking-widest mt-1.5 ${activeTab === tab.key ? 'text-zinc-900' : 'text-slate-400'}`}>
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View className="absolute bottom-0 w-12 h-1 bg-orange-500 rounded-full" />
              )}
            </Pressable>
          ))}
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
          contentContainerStyle={{ paddingBottom: 60, paddingTop: 16 }}
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
    </View>
  );
}
