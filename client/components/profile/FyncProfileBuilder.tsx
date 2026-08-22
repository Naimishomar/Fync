import React, { useState, useEffect, useCallback } from 'react';
import { readCache, writeCache, userKey } from '../../utils/screenCache';
import {View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Linking, Dimensions, Platform, StatusBar, TextInput} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
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
import EducationCard, { EducationEntry } from './EducationCard';
import AddEducationModal from './AddEducationModal';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
const { width } = Dimensions.get('window');

// ─── Completeness Bar ─────────────────────────────────────────────────────────
function CompletenessBar({ pct }: { pct: number }) {
  return (
    <StampCard style={{ marginHorizontal: 16, marginBottom: 24 }}>
    <View className="p-card-pad">
      <View className="flex-row justify-between mb-3">
        <Text className="text-ink font-display uppercase text-label">Profile Completeness</Text>
        <Text className="font-display text-xs text-accent-text">{pct}%</Text>
      </View>
      <View className="h-2 bg-paper-2 rounded-full overflow-hidden">
        <View className="h-full rounded-full overflow-hidden" style={{ width: `${pct}%` }}>
          <View
            className="h-full w-full"
           style={{ backgroundColor: '#F97316' }} />
        </View>
      </View>
      {pct < 100 && (
        <Text className="text-ink-3 font-semibold text-label uppercase mt-3">
          {pct < 50 ? 'Add projects and work experience to boost your score.'
            : pct < 80 ? 'Almost there — connect GitHub and add certificates.'
            : 'You are almost a Legend. Complete all sections.'}
        </Text>
      )}
    </View>
    </StampCard>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, icon, onAdd, addLabel }: {
  title: string; icon: string; onAdd?: () => void; addLabel?: string;
}) {
  return (
    <View className="flex-row items-center justify-between px-6 mb-4 mt-8">
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 bg-ink rounded-card items-center justify-center shadow-hair">
          <Ionicons name={icon as any} size={18} color="#F97316" />
        </View>
        <Text className="text-ink font-display uppercase text-sm">{title}</Text>
      </View>
      {onAdd && (
        <Pressable onPress={onAdd}
          className="flex-row items-center gap-2 bg-card px-4 py-2.5 rounded-card border border-line shadow-hair">
          <Ionicons name="add" size={16} color="#12100E" />
          <Text className="text-ink text-label font-display uppercase">{addLabel || 'Add'}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FyncProfileBuilder() {
  const { user, setUser } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [skillInput, setSkillInput] = useState('');

  const updateSkillsOnServer = async (newSkills: string[]) => {
    try {
      const formData = new FormData();
      if (newSkills.length === 0) {
        formData.append('skills', ''); 
      } else {
        newSkills.forEach((skill) => formData.append('skills', skill));
      }
      const res = await axios.post('/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        if (setUser) setUser(res.data.user);
        setProfile((prev: any) => ({ ...prev, user: res.data.user }));
      }
    } catch (error) {
      Toast.show({ type: 'error', text1: 'Failed to update skills' });
    }
  };

  const handleSkillInput = (text: string) => {
    if (text.endsWith(',')) {
      const newSkill = text.slice(0, -1).trim();
      if (newSkill.length > 0 && !skills.includes(newSkill)) {
        const updatedSkills = [...skills, newSkill];
        setSkills(updatedSkills);
        updateSkillsOnServer(updatedSkills);
      }
      setSkillInput('');
    } else {
      setSkillInput(text);
    }
  };

  const removeSkill = (indexToRemove: number) => {
    const updatedSkills = skills.filter((_, index) => index !== indexToRemove);
    setSkills(updatedSkills);
    updateSkillsOnServer(updatedSkills);
  };

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
  const [showAddEducation, setShowAddEducation] = useState(false);
  const [editingEducation, setEditingEducation] = useState<any>(null);
  const [showCodingModal, setShowCodingModal] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);

  const fetchProfile = async () => {
    // The mount effect had an empty dependency array, so on a cold start where
    // auth had not resolved yet this requested /profile/full/undefined and the
    // screen stayed on its spinner until the user pulled to refresh.
    if (!user?._id) return;
    try {
      const res = await axios.get(`/profile/full/${user._id}`);
      if (res.data.success) {
        setProfile(res.data.profile);
        writeCache(userKey(user._id, 'portfolio'), res.data.profile);
      }
    } catch (e) {
      console.log('FyncProfileBuilder fetch error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?._id) return;
    let cancelled = false;
    // Paint the portfolio we rendered last time while the fresh copy loads.
    readCache<any>(userKey(user._id, 'portfolio')).then((cached) => {
      if (cancelled || !cached) return;
      setProfile((prev: any) => prev ?? cached);
      setLoading(false);
    });
    fetchProfile();
    return () => { cancelled = true; };
  }, [user?._id]);

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

  const deleteEducation = (id: string) => {
    Alert.alert('Remove Education', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await axios.delete(`/profile/education/${id}`);
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
    if (!profile?.user?.resumeUrl) {
      Toast.show({ type: 'info', text1: 'No resume uploaded yet' });
      return;
    }
    const url = profile.user.resumeUrl;
    await Linking.openURL(url);
  };

  const handlePickResume = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        uploadResume(result.assets[0]);
      }
    } catch (err) {
      console.error("Document picking error:", err);
    }
  };

  const uploadResume = async (file: any) => {
    setUploadingResume(true);
    try {
      const formData = new FormData();
      const fileName = file.name || 'resume.pdf';
      
      formData.append('resume', {
        uri: Platform.OS === 'ios' ? file.uri.replace('file://', '') : file.uri,
        name: fileName,
        type: 'application/pdf',
      } as any);

      const res = await axios.post('/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Resume uploaded successfully!' });
        fetchProfile();
      }
    } catch (error) {
      console.error(error);
      Toast.show({ type: 'error', text1: 'Upload failed' });
    } finally {
      setUploadingResume(false);
    }
  };

  if (loading) return (
    <SafeAreaView className="flex-1 bg-paper items-center justify-center">
      <ActivityIndicator size="large" color="#F97316" />
    </SafeAreaView>
  );

  const { projects = [], internships = [], education = [], certificates = [], completeness } = profile || {};
  const pct = completeness?.percentage || 0;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View className="px-2">
            <CompletenessBar pct={pct} />

            {/* User Statistics Row */}
            <View className="flex-row mx-4 mb-6 gap-4">
              <View className="flex-1 bg-paper border border-line p-5 shadow-hair items-center justify-center rounded-md">
                <View className="bg-brand-100 p-3 rounded-card mb-3">
                   <Ionicons name="flame" size={24} color="#F97316" />
                </View>
                <Text className="text-ink text-2xl font-display">{profile?.user?.highestStreak || 0}</Text>
                <Text className="text-ink-3 text-label font-display uppercase mt-1">Max Streak</Text>
              </View>
              
              <Pressable 
                onPress={() => setShowCodingModal(true)}
                className="flex-1 bg-paper border border-line p-5 shadow-hair items-center justify-center rounded-md"
              >
                <View className="bg-paper-2 p-3 rounded-card mb-3">
                   <Ionicons name="code-working" size={24} color="#12100E" />
                </View>
                <Text className="text-ink text-label font-display uppercase text-center">Coding Profiles</Text>
                <Text className="text-ink-3 text-label font-semibold uppercase mt-1">Boost Score</Text>
              </Pressable>
            </View>

            <FyncScoreCard userId={user?._id!} isOwner onRecalculate={fetchProfile} />

            {/* Resume Upload Section (NEW) */}
            <View className="mx-4 mb-6 bg-card border border-line rounded-card p-6 shadow-hair">
              <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-recruiter/15 rounded-card items-center justify-center">
                    <Ionicons name="document-text" size={18} color="#4F46E5" />
                  </View>
                  <View>
                    <Text className="text-ink font-display uppercase text-label">Career Document</Text>
                    <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">Resume / CV (PDF)</Text>
                  </View>
                </View>
                {profile?.user?.resumeUrl && (
                  <Pressable onPress={downloadResume} className="bg-recruiter/10 border border-recruiter/15 px-2.5 py-1 rounded-full">
                    <Text className="text-recruiter font-display text-label uppercase">Preview</Text>
                  </Pressable>
                )}
              </View>

              <Pressable 
                onPress={handlePickResume}
                disabled={uploadingResume}
                className={`flex-row items-center justify-center gap-3 h-14 rounded-card border-2 border-dashed ${profile?.user?.resumeUrl ? 'border-recruiter/25 bg-recruiter/10' : 'border-line bg-paper-2'}`}
              >
                {uploadingResume ? (
                  <ActivityIndicator color="#4F46E5" size="small" />
                ) : (
                  <>
                    <Feather name={profile?.user?.resumeUrl ? "check-circle" : "upload-cloud"} size={18} color={profile?.user?.resumeUrl ? "#047857" : "#8B857E"} />
                    <Text className={`font-display uppercase text-label ${profile?.user?.resumeUrl ? 'text-recruiter' : 'text-ink-3'}`}>
                      {profile?.user?.resumeUrl ? (profile?.user?.resumeName || "Update Resume") : "Upload Resume (PDF)"}
                    </Text>
                  </>
                )}
              </Pressable>
              {profile?.user?.resumeName && (
                 <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                    Current: {profile.user.resumeName}
                 </Text>
              )}

              {/* --- Skills Section --- */}
              <View className="mt-6 border-t border-line pt-5">
                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                  <Text className="text-ink font-display uppercase text-label">Core Skills & Stack</Text>
                  <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                </View>
                <View className="bg-paper-2 rounded-card p-3 flex-row flex-wrap gap-2 border border-line">
                  {skills.map((skill, index) => (
                    <View key={index} className="bg-recruiter/15 border border-recruiter/15 flex-row items-center px-2.5 py-1 rounded-full">
                      <Text className="text-recruiter font-semibold text-label uppercase mr-1">{skill}</Text>
                      <Pressable onPress={() => removeSkill(index)}>
                        <Ionicons name="close-circle" size={14} color="#4F46E5" />
                      </Pressable>
                    </View>
                  ))}
                  <TextInput
                    value={skillInput}
                    onChangeText={handleSkillInput}
                    placeholder={skills.length > 0 ? "" : "React, Node.js, Design..."}
                    placeholderTextColor="#8B857E"
                    className="text-ink-2 min-w-[120px] flex-1 py-1 text-label font-semibold uppercase"
                  />
                </View>
                <Text className="text-ink-3 text-label font-semibold uppercase mt-2 ml-1">
                   * Type and press comma (,) to add a skill. Auto-saves.
                </Text>
              </View>

            </View>

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
              <View className="items-center py-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Feather name="box" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No projects yet</Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
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
              <View className="items-center py-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="briefcase-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No experience added yet</Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                  Add internships, freelance, or jobs!
                </Text>
              </View>
            ) : internships.map((i: any) => (
              <InternshipCard key={i._id} item={i} isOwner
                onEdit={(i) => { setEditingInternship(i); setShowAddInternship(true); }}
                onDelete={deleteInternship} />
            ))}
            
            <View className="h-6" />

            <SectionHeader title="Education" icon="school-outline"
              onAdd={() => { setEditingEducation(null); setShowAddEducation(true); }}
              addLabel="Add Education" />
            {education.length === 0 ? (
              <View className="items-center py-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="school-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No education added yet</Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
                  Add your academic background!
                </Text>
              </View>
            ) : education.map((e: any) => (
              <EducationCard key={e._id} item={e} isOwner
                onEdit={(e) => { setEditingEducation(e); setShowAddEducation(true); }}
                onDelete={deleteEducation} />
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
              <View className="items-center py-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="ribbon-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No certificates added yet</Text>
                <Text className="font-sans text-sm text-ink-3 mt-2 text-center">
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION - MATCHING DRIVE/STUDY MATERIAL */}

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header Content */}
        <View className="px-gutter pt-8 bg-transparent">
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-row items-center gap-4">
              <View>
                <Pressable
                  onPress={() => navigation.goBack()}
                  className="w-11 h-11 items-center justify-center rounded-xl"
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={{ marginLeft: -11 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#12100E" />
                </Pressable>
                <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Fync</Text>
                <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Portfolio</Text>
                <View className="flex-row items-center">
                  <Text className="text-ink-3 text-label font-display uppercase">Core Interface</Text>
                </View>
              </View> 
            </View>
            <Pressable onPress={downloadResume}
              className="bg-ink px-4 py-3 flex-row items-center border-2 border-ink rounded-md">
              <Feather name="file-text" size={14} color="#F97316" />
              <Text className="text-white font-display uppercase text-label ml-2">Resume</Text>
            </Pressable>
          </View>
        </View>

        {/* Modern Tab Strip */}
        <View className="flex-row bg-card/50 px-4 py-2 border-b border-line">
          {TABS.map(tab => (
            <Pressable
              key={tab.key}
              onPress={() => setActiveTab(tab.key)}
              className={`flex-1 items-center py-4 relative`}
            >
              <Ionicons name={tab.icon as any} size={20}
                color={activeTab === tab.key ? '#F97316' : '#8B857E'} />
              <Text className={`text-label font-display uppercase mt-1.5 ${activeTab === tab.key ? 'text-ink' : 'text-ink-3'}`}>
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View className="absolute bottom-0 w-12 h-1 bg-brand-500 rounded-full" />
              )}
            </Pressable>
          ))}
        </View>

        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F97316" />}
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
        <AddEducationModal
          visible={showAddEducation}
          initial={editingEducation}
          onClose={() => setShowAddEducation(false)}
          onSuccess={() => { setShowAddEducation(false); fetchProfile(); }}
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
