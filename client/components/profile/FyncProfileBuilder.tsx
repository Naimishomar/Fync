import React, { useState, useEffect, useCallback } from 'react';
import { readCache, writeCache, userKey } from '../../utils/screenCache';
import { View, Text, ScrollView, Pressable, RefreshControl, ActivityIndicator, Linking, StatusBar, TextInput } from 'react-native'
import * as DocumentPicker from 'expo-document-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
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

import { AppBar, Card, SectionHeader, Button, SegmentedTabs, Empty, IconTile, Num } from '../ui/kit';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';

// ─── Completeness Bar ─────────────────────────────────────────────────────────
function CompletenessBar({ pct }: { pct: number }) {
  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
      <View className="flex-row justify-between mb-3">
        <Text className="text-ink font-semibold text-sm">Profile completeness</Text>
        <Text className="font-semibold text-sm text-accent-text">{pct}%</Text>
      </View>
      <View className="h-2 bg-paper-2 rounded-full overflow-hidden" accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.brand[500] }} />
      </View>
      {pct < 100 && (
        <Text className="text-ink-3 font-sans text-sm mt-3">
          {pct < 50 ? 'Add projects and work experience to boost your score.'
            : pct < 80 ? 'Almost there — connect GitHub and add certificates.'
            : 'You are almost a Legend. Complete all sections.'}
        </Text>
      )}
    </Card>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
const Section = ({ title, onAdd, addLabel }: { title: string; onAdd: () => void; addLabel: string }) => (
  <SectionHeader
    title={title}
    style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 12 }}
    right={<Button small icon="add" title={addLabel} onPress={onAdd} />}
  />
);

const TABS = ['overview', 'projects', 'experience', 'certs'] as const;
const TAB_LABELS = { overview: 'Overview', projects: 'Projects', experience: 'Work', certs: 'Certs' };

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FyncProfileBuilder() {
  const { user, setUser } = useAuth();
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();
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

  // These calls had no catch, so a failed request was an unhandled rejection
  // and the user saw nothing.
  const failToast = () => Toast.show({ type: 'error', text1: 'Something went wrong' });

  const disconnectGitHub = () => {
    Alert.alert('Disconnect GitHub', 'Are you sure? Your GitHub stats will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          try {
            await axios.delete('/profile/github/disconnect');
            fetchProfile();
          } catch { failToast(); }
        }
      }
    ]);
  };

  const deleteProject = (id: string) => {
    Alert.alert('Delete Project', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`/profile/projects/${id}`);
            fetchProfile();
            Toast.show({ type: 'success', text1: 'Project deleted' });
          } catch { failToast(); }
        }
      }
    ]);
  };

  const toggleFeatured = async (id: string) => {
    try {
      await axios.post(`/profile/projects/${id}/feature`);
      fetchProfile();
    } catch { failToast(); }
  };

  const toggleLike = async (id: string) => {
    try {
      await axios.post(`/profile/projects/${id}/like`);
      fetchProfile();
    } catch { failToast(); }
  };

  const deleteInternship = (id: string) => {
    Alert.alert('Remove Experience', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`/profile/internships/${id}`);
            fetchProfile();
          } catch { failToast(); }
        }
      }
    ]);
  };

  const deleteEducation = (id: string) => {
    Alert.alert('Remove Education', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`/profile/education/${id}`);
            fetchProfile();
          } catch { failToast(); }
        }
      }
    ]);
  };

  const deleteCert = (id: string) => {
    Alert.alert('Delete Certificate', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await axios.delete(`/profile/certificates/${id}`);
            fetchProfile();
          } catch { failToast(); }
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
    await Linking.openURL(url).catch(() => Toast.show({ type: 'error', text1: 'Could not open resume' }));
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
        // RN's FormData needs the file:// scheme on iOS too; a bare path fails the upload.
        uri: file.uri,
        name: fileName,
        type: 'application/pdf',
      } as any);

      const res = await axios.post('/user/update', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        Toast.show({ type: 'success', text1: 'Resume uploaded successfully!' });
        // Apply screens read resumeUrl from the auth user, not this profile.
        if (setUser && res.data.user) setUser(res.data.user);
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
    <View className="flex-1 bg-paper items-center justify-center">
      <ActivityIndicator size="large" color={C.brand[500]} />
    </View>
  );

  const { projects = [], internships = [], education = [], certificates = [], completeness } = profile || {};
  const pct = completeness?.percentage || 0;
  const hasResume = !!profile?.user?.resumeUrl;

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <View>
            <CompletenessBar pct={pct} />

            <View className="flex-row mx-4 mb-3" style={{ gap: 12 }}>
              <Card style={{ flex: 1, alignItems: 'center' }}>
                <IconTile icon="flame-outline" size={44} color={C.accentText} />
                <Num style={{ fontSize: 24, lineHeight: 28, marginTop: 8 }}>{String(profile?.user?.highestStreak || 0)}</Num>
                <Text className="text-ink-3 text-xs font-sans mt-1">Max streak</Text>
              </Card>

              <Pressable
                onPress={() => setShowCodingModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Coding profiles. Boost your score"
                className="flex-1 bg-card border border-line rounded-2xl p-4 items-center justify-center active:opacity-70"
              >
                <IconTile icon="code-working-outline" size={44} />
                <Text className="text-ink text-sm font-semibold text-center mt-2">Coding profiles</Text>
                <Text className="text-ink-3 text-xs font-sans mt-1">Boost score</Text>
              </Pressable>
            </View>

            <FyncScoreCard userId={user?._id!} isOwner onRecalculate={fetchProfile} />

            <Card style={{ marginHorizontal: 16, marginBottom: 12 }}>
              <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
                <IconTile icon="document-text-outline" size={40} />
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text className="text-ink font-semibold text-sm">Resume</Text>
                  <Text className="text-ink-3 font-sans text-xs mt-0.5">PDF only</Text>
                </View>
                {hasResume ? <Button small variant="tertiary" title="Preview" onPress={downloadResume} /> : null}
              </View>

              <Pressable
                onPress={handlePickResume}
                disabled={uploadingResume}
                accessibilityRole="button"
                accessibilityLabel={hasResume ? 'Replace resume' : 'Upload resume'}
                accessibilityState={{ busy: uploadingResume }}
                className="flex-row items-center justify-center h-14 rounded-2xl border border-dashed border-line bg-paper-2 active:opacity-70"
                style={{ gap: 8 }}
              >
                {uploadingResume ? (
                  <ActivityIndicator color={C.ink2} size="small" />
                ) : (
                  <>
                    <Ionicons name={hasResume ? 'checkmark-circle' : 'cloud-upload-outline'} size={18} color={hasResume ? C.success : C.ink3} />
                    <Text className="font-semibold text-sm text-ink-2" numberOfLines={1}>
                      {hasResume ? (profile?.user?.resumeName || 'Update resume') : 'Upload resume (PDF)'}
                    </Text>
                  </>
                )}
              </Pressable>
              {!!profile?.user?.resumeName && (
                <Text className="font-sans text-xs text-ink-3 mt-2 text-center">Current: {profile.user.resumeName}</Text>
              )}

              <View className="mt-4 border-t border-line pt-4">
                <Text className="text-ink-2 font-semibold text-sm mb-2">Skills</Text>
                <View className="bg-paper-2 rounded-2xl p-3 flex-row flex-wrap border border-line" style={{ gap: 8, minHeight: 48 }}>
                  {skills.map((skill, index) => (
                    <View key={index} className="bg-card border border-line flex-row items-center pl-3 pr-1 rounded-full" style={{ minHeight: 32 }}>
                      <Text className="text-ink-2 font-medium text-xs">{skill}</Text>
                      <Pressable onPress={() => removeSkill(index)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Remove ${skill}`} className="p-1 active:opacity-60">
                        <Ionicons name="close-circle" size={16} color={C.ink3} />
                      </Pressable>
                    </View>
                  ))}
                  <TextInput
                    value={skillInput}
                    onChangeText={handleSkillInput}
                    // Return adds the skill too; otherwise a skill typed without a comma was dropped.
                    onSubmitEditing={() => handleSkillInput(skillInput + ',')}
                    returnKeyType="done"
                    submitBehavior="submit"
                    placeholder={skills.length > 0 ? "Add a skill" : "React, Node.js, Design..."}
                    placeholderTextColor={C.ink3}
                    accessibilityLabel="Add a skill"
                    className="text-ink min-w-[120px] flex-1 py-1 text-sm font-sans"
                  />
                </View>
                <Text className="text-ink-3 text-xs font-sans mt-2">Type a comma or press return to add. Saves automatically.</Text>
              </View>
            </Card>

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
          <View>
            <Section title="Projects" addLabel="Add project" onAdd={() => { setEditingProject(null); setShowAddProject(true); }} />
            {projects.length === 0 ? (
              <Empty icon="cube-outline" title="No projects yet" hint="Add your first project to boost your Fync Score." />
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
          <View>
            <Section title="Work experience" addLabel="Add" onAdd={() => { setEditingInternship(null); setShowAddInternship(true); }} />
            {internships.length === 0 ? (
              <Empty icon="briefcase-outline" title="No experience added yet" hint="Add internships, freelance work or jobs." />
            ) : internships.map((i: any) => (
              <InternshipCard key={i._id} item={i} isOwner
                onEdit={(i) => { setEditingInternship(i); setShowAddInternship(true); }}
                onDelete={deleteInternship} />
            ))}

            <View className="h-6" />

            <Section title="Education" addLabel="Add" onAdd={() => { setEditingEducation(null); setShowAddEducation(true); }} />
            {education.length === 0 ? (
              <Empty icon="school-outline" title="No education added yet" hint="Add your academic background." />
            ) : (
              <View className="mx-4">
                {education.map((e: any) => (
                  <EducationCard key={e._id} item={e} isOwner
                    onEdit={(e) => { setEditingEducation(e); setShowAddEducation(true); }}
                    onDelete={deleteEducation} />
                ))}
              </View>
            )}
          </View>
        );

      case 'certs':
        return (
          <View>
            <Section title="Certificates" addLabel="Add certificate" onAdd={() => { setEditingCert(null); setShowAddCert(true); }} />
            {certificates.length === 0 ? (
              <Empty icon="ribbon-outline" title="No certificates added yet" hint="Showcase your learning." />
            ) : (
              <View className="mx-4" style={{ gap: 12 }}>
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

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <View className="flex-1">
        <AppBar
          title="Fync portfolio"
          onBack={() => navigation.goBack()}
          right={<Button small variant="tertiary" icon="document-text-outline" title="Resume" onPress={downloadResume} style={{ marginRight: 11 }} />}
        />
        <View className="px-gutter pb-2">
          <SegmentedTabs items={TABS} labels={TAB_LABELS} value={activeTab} onChange={setActiveTab} />
        </View>

        <ScrollView keyboardShouldPersistTaps="handled"
          className="flex-1"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
          contentContainerStyle={{ paddingBottom: 44 + bottomInset, paddingTop: 12 }}
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
      </View>
    </View>
  );
}
