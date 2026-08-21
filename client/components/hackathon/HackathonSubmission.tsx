import React, { useEffect, useState, useCallback } from 'react';
import {View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Keyboard} from 'react-native'
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Submission {
  _id?: string;
  ProjectName?: string;    // backend schema uses PascalCase
  TagLine?: string;
  description?: string;
  techStack?: string[];
  category?: string;
  GithubUrl?: string;      // backend schema field name
  demourl?: string;        // backend schema field name (lowercase)
  videoUrl?: string;
  presentationUrl?: string;
  status?: 'draft' | 'submitted' | 'underReview' | 'scored';
  submittedAt?: string;
  team?: { name: string };
  files?: { _id?: string; name: string; Url: string; size?: string; type?: string }[];
}

const CATEGORIES = [
  'AI/ML', 'Web Dev', 'Mobile App', 'Blockchain',
  'IoT', 'HealthTech', 'EdTech', 'FinTech', 'OpenInnovation',
];

// ─── Step Indicator ───────────────────────────────────────────────────────────
const StepIndicator = ({ total, current }: { total: number; current: number }) => (
  <View className="flex-row items-center justify-center gap-2 mb-6">
    {Array.from({ length: total }).map((_, i) => (
      <View key={i} className="flex-row items-center">
        <View
          className={`w-8 h-8 rounded-full items-center justify-center ${i <= current ? 'bg-ink' : 'bg-paper-2'}`}
        >
          {i < current
            ? <Ionicons name="checkmark" size={14} color="white" />
            : <Text className={`font-semibold text-xs ${i === current ? 'text-white' : 'text-ink-3'}`}>{i + 1}</Text>
          }
        </View>
        {i < total - 1 && (
          <View className={`h-0.5 w-8 ${i < current ? 'bg-ink' : 'bg-paper-2'}`} />
        )}
      </View>
    ))}
  </View>
);

// ─── Field Input ──────────────────────────────────────────────────────────────
const Field = ({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  optional = false,
  keyboardType = 'default',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  optional?: boolean;
  keyboardType?: any;
}) => (
  <View className="mb-5">
    <View className="flex-row items-center mb-2">
      <Text className="text-ink-3 text-label font-semibold">{label}</Text>
      {optional && <Text className="text-ink-4 text-label font-semibold ml-1">(optional)</Text>}
    </View>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#8B857E"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType}
      className={`bg-card rounded-card px-4 py-3.5 text-ink font-semibold border border-line ${multiline ? 'h-28' : ''}`}
    />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonSubmission = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId } = route.params;
  const { user } = useAuth();

  const [existing, setExisting] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [step, setStep] = useState(0);

  // Form fields
  const [projectName, setProjectName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [techInput, setTechInput] = useState('');
  const [techStack, setTechStack] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [demoUrl, setDemoUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [presentationUrl, setPresentationUrl] = useState('');
  const [files, setFiles] = useState<Submission['files']>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkExisting();
  }, []);

  const checkExisting = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/submissions/my/${hackathonId}`);
      const sub: Submission = res.data.data;
      setExisting(sub);
      // Populate form
      setProjectName(sub.ProjectName ?? '');
      setTagline(sub.TagLine ?? '');
      setDescription(sub.description ?? '');
      setTechStack(sub.techStack ?? []);
      setCategory(sub.category ?? '');
      setGithubUrl(sub.GithubUrl ?? '');
      setDemoUrl(sub.demourl ?? '');
      setVideoUrl(sub.videoUrl ?? '');
      setPresentationUrl(sub.presentationUrl ?? '');
      setFiles(sub.files ?? []);
    } catch {
      // No submission yet — fresh form
    } finally {
      setLoading(false);
    }
  };

  const addTech = () => {
    const s = techInput.trim();
    if (s && !techStack.includes(s)) setTechStack(p => [...p, s]);
    setTechInput('');
  };

  const pickAndUploadFile = async () => {
    if (!existing?._id) {
      Toast.show({ type: 'error', text1: 'Save your draft before attaching files' });
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setUploading(true);
      try {
        // RN FormData file convention: { uri, name, type }
        const formData = new FormData();
        formData.append('file', {
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType || 'application/octet-stream',
        } as any);

        const res = await axios.post(`/submissions/${existing._id}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setFiles(res.data.files ?? []);
        setExisting(prev => prev ? { ...prev, files: res.data.files ?? [] } : prev);
        Toast.show({ type: 'success', text1: 'File attached' });
      } catch (err: any) {
        Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Upload failed' });
      } finally {
        setUploading(false);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Could not open file picker' });
    }
  };

  const removeFile = async (fileId: string) => {
    if (!existing?._id) return;
    Alert.alert('Remove File', 'Remove this attachment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', onPress: async () => {
          try {
            const res = await axios.delete(`/submissions/${existing._id}/files/${fileId}`);
            setFiles(res.data.files ?? []);
            setExisting(prev => prev ? { ...prev, files: res.data.files ?? [] } : prev);
          } catch (err: any) {
            Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not remove file' });
          }
        }
      }
    ]);
  };

  const saveDraft = async () => {
    Keyboard.dismiss();
    if (!projectName.trim()) {
      Toast.show({ type: 'error', text1: 'Project name is required' });
      return;
    }
    setSaving(true);
    try {
      // Backend schema field names (note the casing matches the model)
      const payload = {
        hackathon: hackathonId,
        ProjectName: projectName,
        TagLine: tagline,
        description,
        techStack,
        category,
        GithubUrl: githubUrl,
        demourl: demoUrl,
        videoUrl,
        presentationUrl,
      };

      if (existing?._id) {
        await axios.patch(`/submissions/${existing._id}`, payload);
      } else {
        // Create — find the user's team for this hackathon (single lookup)
        const uid = String(user?._id || user?.id);
        const teamRes = await axios.get('/teams', { params: { hackathon: hackathonId } });
        const teams = teamRes.data.teams ?? [];
        const teamId = teams.find((t: any) =>
          t.members?.some((m: any) => String(m.user?._id || m.user) === uid)
        )?._id;
        await axios.post('/submissions', { ...payload, team: teamId });
      }

      Toast.show({ type: 'success', text1: 'Draft saved' });
      checkExisting(); // Reload
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not save draft' });
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!githubUrl && !demoUrl) {
      Toast.show({ type: 'error', text1: 'Provide at least a GitHub URL or Demo URL' });
      return;
    }
    Alert.alert(
      'Finalize Submission',
      'Once finalized, you cannot edit your submission. Are you ready?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Submit', onPress: async () => {
            setFinalizing(true);
            try {
              await saveDraft(); // Save latest first
              if (existing?._id) {
                await axios.post(`/submissions/${existing._id}/finalize`);
                Toast.show({ type: 'success', text1: 'Submitted! Good luck' });
                checkExisting();
              }
            } catch (err: any) {
              Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Finalization failed' });
            } finally {
              setFinalizing(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color="#F97316" />
      </View>
    );
  }

  const isSubmitted = existing?.status === 'submitted';
  const STEPS = ['Project Info', 'Tech & Category', 'Links & URLs'];

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1"
      >
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
              <Text className="text-ink text-xl font-display">Submission</Text>
              <Text className="text-ink-3 text-label font-semibold">
                {isSubmitted ? 'Finalized' : existing?._id ? ' Draft' : 'New'}
              </Text>
            </View>
          </View>

          {/* Finalized State */}
          {isSubmitted ? (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <View className="rounded-card p-6 mb-5 items-center" style={{ backgroundColor: '#047857' }}>
                <Ionicons name="checkmark-circle" size={34} color="#047857" style={{ marginBottom: 12 }} />
                <Text className="text-white font-display text-2xl text-center">{existing?.ProjectName}</Text>
                <Text className="text-success text-xs mt-1">Submitted Successfully</Text>
                {existing?.submittedAt && (
                  <Text className="text-success text-xs mt-2">
                    {new Date(existing.submittedAt).toLocaleString('en-IN')}
                  </Text>
                )}
              </View>

              {/* Submission details */}
              {[
                { label: 'Tagline', value: existing?.TagLine },
                { label: 'Category', value: existing?.category },
                { label: 'GitHub', value: existing?.GithubUrl },
                { label: 'Demo', value: existing?.demourl },
              ].filter(x => x.value).map((item, i) => (
                <View key={i} className="bg-card rounded-card px-4 py-3.5 mb-3 border border-line">
                  <Text className="text-label text-ink-3 font-semibold mb-1">{item.label}</Text>
                  <Text className="text-ink font-semibold text-sm">{item.value}</Text>
                </View>
              ))}

              {existing?.techStack && existing.techStack.length > 0 && (
                <View className="bg-card rounded-card px-4 py-3.5 mb-3 border border-line">
                  <Text className="text-label text-ink-3 font-semibold mb-2">Tech Stack</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {existing.techStack.map((t, i) => (
                      <View key={i} className="bg-paper-2 border border-line rounded-xl px-3 py-1.5">
                        <Text className="text-brand-600 font-semibold text-xs">{t}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </ScrollView>
          ) : (
            <>
              {/* Step Indicator */}
              <View className="px-5">
                <StepIndicator total={STEPS.length} current={step} />
                <Text className="text-ink-3 text-label font-semibold text-center mb-4">
                  Step {step + 1} of {STEPS.length} — {STEPS[step]}
                </Text>
              </View>

              <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {/* Step 0 — Project Info */}
                {step === 0 && (
                  <View>
                    <Field label="Project Name" value={projectName} onChange={setProjectName} placeholder="e.g. MediAI" />
                    <Field label="Tagline" value={tagline} onChange={setTagline} placeholder="One-liner that sells your project" optional />
                    <Field label="Description" value={description} onChange={setDescription} placeholder="What problem does it solve? How?" multiline optional />
                  </View>
                )}

                {/* Step 1 — Tech & Category */}
                {step === 1 && (
                  <View>
                    {/* Category picker */}
                    <View className="mb-5">
                      <Text className="text-ink-3 text-label font-semibold mb-2">Category</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {CATEGORIES.map((c, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setCategory(c)}
                            className={`px-4 py-2 rounded-card border ${category === c ? 'bg-ink border-ink' : 'bg-card border-line'}`}
                          >
                            <Text className={`font-semibold text-xs ${category === c ? 'text-white' : 'text-ink-2'}`}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Tech Stack */}
                    <View className="mb-5">
                      <Text className="text-ink-3 text-label font-semibold mb-2">Tech Stack</Text>
                      <View className="flex-row mb-3">
                        <TextInput
                          value={techInput}
                          onChangeText={setTechInput}
                          onSubmitEditing={addTech}
                          placeholder="e.g. React Native"
                          placeholderTextColor="#8B857E"
                          className="flex-1 bg-paper px-4 py-3 text-ink font-semibold border-[1.5px] border-ink mr-2 rounded-md"
                        />
                        <TouchableOpacity
                          onPress={addTech}
                          className="bg-ink px-4 items-center justify-center border-2 border-ink rounded-md"
                        >
                          <Ionicons name="add" size={20} color="white" />
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {techStack.map((t, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setTechStack(p => p.filter(x => x !== t))}
                            className="flex-row items-center bg-brand-100 border border-ink rounded-xl px-3 py-1.5"
                          >
                            <Text className="text-brand-700 font-semibold text-xs mr-1">{t}</Text>
                            <Ionicons name="close" size={10} color="#EA580C" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Step 2 — Links */}
                {step === 2 && (
                  <View>
                    <View className="bg-warning/10 border border-warning/15 rounded-card p-4 mb-5">
                      <Text className="text-warning font-semibold text-sm mb-1">Required for finalization</Text>
                      <Text className="text-warning text-xs">You must provide at least a GitHub URL or Demo URL before finalizing.</Text>
                    </View>
                    <Field label="GitHub URL" value={githubUrl} onChange={setGithubUrl} placeholder="https://github.com/you/project" keyboardType="url" />
                    <Field label="Demo URL" value={demoUrl} onChange={setDemoUrl} placeholder="https://yourproject.live" keyboardType="url" optional />
                    <Field label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://youtube.com/watch?v=..." keyboardType="url" optional />
                    <Field label="Presentation URL" value={presentationUrl} onChange={setPresentationUrl} placeholder="https://slides.com/..." keyboardType="url" optional />

                    {/* File Attachments */}
                    <View className="mb-5">
                      <View className="flex-row items-center mb-2">
                        <Text className="text-ink-3 text-label font-semibold">Attachments</Text>
                        <Text className="text-ink-4 text-label font-semibold ml-1">(optional)</Text>
                      </View>

                      {(files || []).map((f, i) => (
                        <View key={f._id || i} className="flex-row items-center bg-card rounded-card px-4 py-3 border border-line mb-2">
                          <Ionicons name="document-attach-outline" size={18} color="#F97316" />
                          <Text className="flex-1 text-ink font-semibold text-sm ml-2" numberOfLines={1}>{f.name}</Text>
                          {f.size ? <Text className="text-ink-3 text-label mr-2">{f.size}</Text> : null}
                          {existing?.status === 'draft' && (
                            <TouchableOpacity onPress={() => removeFile(f._id as string)} hitSlop={10}>
                              <Ionicons name="close-circle" size={18} color="#DC2626" />
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}

                      <TouchableOpacity
                        onPress={pickAndUploadFile}
                        disabled={uploading}
                        className="flex-row items-center justify-center border-2 border-dashed border-ink-4 rounded-card py-4"
                      >
                        {uploading
                          ? <ActivityIndicator size="small" color="#F97316" />
                          : <>
                              <Ionicons name="cloud-upload-outline" size={18} color="#F97316" />
                              <Text className="text-brand-600 font-semibold text-xs ml-2">Attach File (PDF / Image)</Text>
                            </>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Bottom Navigation */}
              <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-line px-5 pb-8 pt-4">
                <View className="flex-row gap-3">
                  {step > 0 && (
                    <TouchableOpacity
                      onPress={() => setStep(s => s - 1)}
                      className="flex-1 border border-line rounded-card py-4 items-center"
                    >
                      <Text className="text-ink-2 font-semibold text-sm">Back</Text>
                    </TouchableOpacity>
                  )}

                  {step < STEPS.length - 1 ? (
                    <TouchableOpacity
                      onPress={() => {
                        if (step === 0 && !projectName.trim()) {
                          Toast.show({ type: 'error', text1: 'Project name is required' });
                          return;
                        }
                        setStep(s => s + 1);
                      }}
                      className="flex-1"
                      activeOpacity={0.88}
                    >
                      <View className="rounded-card" style={{ backgroundColor: '#F97316' }}>
                        <View className="py-4 items-center">
                          <Text className="text-ink font-semibold text-sm">Next →</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-1 flex-row gap-3">
                      <TouchableOpacity
                        onPress={saveDraft}
                        disabled={saving}
                        className="flex-1 border border-line rounded-card py-4 items-center"
                      >
                        {saving
                          ? <ActivityIndicator size="small" color="#F97316" />
                          : <Text className="text-brand-600 font-semibold text-sm">Save Draft</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={finalize}
                        disabled={finalizing}
                        className="flex-1"
                        activeOpacity={0.88}
                      >
                        <View className="rounded-card" style={{ backgroundColor: '#047857' }}>
                          <View className="py-4 items-center">
                            {finalizing
                              ? <ActivityIndicator size="small" color="white" />
                              : <Text className="text-white font-semibold text-sm">Submit</Text>
                            }
                          </View>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default HackathonSubmission;
