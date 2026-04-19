import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

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
          className={`w-8 h-8 rounded-full items-center justify-center ${i <= current ? 'bg-indigo-600' : 'bg-slate-200'}`}
        >
          {i < current
            ? <Ionicons name="checkmark" size={14} color="white" />
            : <Text className={`font-black text-xs ${i === current ? 'text-white' : 'text-slate-400'}`}>{i + 1}</Text>
          }
        </View>
        {i < total - 1 && (
          <View className={`h-0.5 w-8 ${i < current ? 'bg-indigo-600' : 'bg-slate-200'}`} />
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
      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest">{label}</Text>
      {optional && <Text className="text-slate-300 text-[10px] font-semibold ml-1">(optional)</Text>}
    </View>
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      multiline={multiline}
      numberOfLines={multiline ? 4 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      keyboardType={keyboardType}
      className={`bg-white rounded-2xl px-4 py-3.5 text-zinc-900 font-semibold border border-slate-200 ${multiline ? 'h-28' : ''}`}
    />
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
const HackathonSubmission = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { hackathonId } = route.params;

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
        // Create — fetch the user's team for this hackathon first
        const teamRes = await axios.get('/teams', { params: { hackathon: hackathonId } });
        const teams = teamRes.data.teams ?? [];
        // Use /submissions/my/:hackathonId to avoid guessing user ID
        const myTeam = (await axios.get(`/submissions/my/${hackathonId}`).catch(() => null));
        const teamId = myTeam?.data?.data?.team?._id ||
          teams.find((t: any) => t.members?.some((m: any) => m.role === 'leader' || m.role === 'member'))?._id;
        await axios.post('/submissions', { ...payload, team: teamId });
      }

      Toast.show({ type: 'success', text1: 'Draft saved ✅' });
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
          text: 'Submit! 🚀', onPress: async () => {
            setFinalizing(true);
            try {
              await saveDraft(); // Save latest first
              if (existing?._id) {
                await axios.post(`/submissions/${existing._id}/finalize`);
                Toast.show({ type: 'success', text1: 'Submitted! Good luck 🎉' });
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
      <View className="flex-1 bg-[#F8FAFC] items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const isSubmitted = existing?.status === 'submitted';
  const STEPS = ['Project Info', 'Tech & Category', 'Links & URLs'];

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View className="flex-row items-center px-5 pt-4 pb-3">
            <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
              <Ionicons name="arrow-back" size={22} color="#1e293b" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-zinc-900 text-xl font-black italic">Submission</Text>
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                {isSubmitted ? '✅ Finalized' : existing?._id ? '📝 Draft' : 'New'}
              </Text>
            </View>
          </View>

          {/* Finalized State */}
          {isSubmitted ? (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
              <LinearGradient colors={['#10b981', '#059669']} className="rounded-3xl p-6 mb-5 items-center">
                <Text className="text-5xl mb-3">🎉</Text>
                <Text className="text-white font-black italic text-2xl text-center">{existing?.ProjectName}</Text>
                <Text className="text-emerald-200 text-xs uppercase tracking-widest mt-1">Submitted Successfully</Text>
                {existing?.submittedAt && (
                  <Text className="text-emerald-300 text-xs mt-2">
                    {new Date(existing.submittedAt).toLocaleString('en-IN')}
                  </Text>
                )}
              </LinearGradient>

              {/* Submission details */}
              {[
                { label: 'Tagline', value: existing?.TagLine },
                { label: 'Category', value: existing?.category },
                { label: 'GitHub', value: existing?.GithubUrl },
                { label: 'Demo', value: existing?.demourl },
              ].filter(x => x.value).map((item, i) => (
                <View key={i} className="bg-white rounded-2xl px-4 py-3.5 mb-3 border border-slate-100">
                  <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">{item.label}</Text>
                  <Text className="text-zinc-800 font-semibold text-sm">{item.value}</Text>
                </View>
              ))}

              {existing?.techStack && existing.techStack.length > 0 && (
                <View className="bg-white rounded-2xl px-4 py-3.5 mb-3 border border-slate-100">
                  <Text className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Tech Stack</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {existing.techStack.map((t, i) => (
                      <View key={i} className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-1.5">
                        <Text className="text-indigo-600 font-black text-xs">{t}</Text>
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
                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest text-center mb-4">
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
                      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Category</Text>
                      <View className="flex-row flex-wrap gap-2">
                        {CATEGORIES.map((c, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setCategory(c)}
                            className={`px-4 py-2 rounded-2xl border ${category === c ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-200'}`}
                          >
                            <Text className={`font-black text-xs ${category === c ? 'text-white' : 'text-slate-600'}`}>{c}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Tech Stack */}
                    <View className="mb-5">
                      <Text className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Tech Stack</Text>
                      <View className="flex-row mb-3">
                        <TextInput
                          value={techInput}
                          onChangeText={setTechInput}
                          onSubmitEditing={addTech}
                          placeholder="e.g. React Native"
                          placeholderTextColor="#94a3b8"
                          className="flex-1 bg-white rounded-2xl px-4 py-3 text-zinc-900 font-semibold border border-slate-200 mr-2"
                        />
                        <TouchableOpacity
                          onPress={addTech}
                          className="bg-indigo-600 rounded-2xl px-4 items-center justify-center"
                        >
                          <Ionicons name="add" size={20} color="white" />
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {techStack.map((t, i) => (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setTechStack(p => p.filter(x => x !== t))}
                            className="flex-row items-center bg-indigo-100 border border-indigo-200 rounded-xl px-3 py-1.5"
                          >
                            <Text className="text-indigo-700 font-black text-xs mr-1">{t}</Text>
                            <Ionicons name="close" size={10} color="#4338ca" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                {/* Step 2 — Links */}
                {step === 2 && (
                  <View>
                    <View className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5">
                      <Text className="text-amber-700 font-black text-sm mb-1">⚠️ Required for finalization</Text>
                      <Text className="text-amber-600 text-xs">You must provide at least a GitHub URL or Demo URL before finalizing.</Text>
                    </View>
                    <Field label="GitHub URL" value={githubUrl} onChange={setGithubUrl} placeholder="https://github.com/you/project" keyboardType="url" />
                    <Field label="Demo URL" value={demoUrl} onChange={setDemoUrl} placeholder="https://yourproject.live" keyboardType="url" optional />
                    <Field label="Video URL" value={videoUrl} onChange={setVideoUrl} placeholder="https://youtube.com/watch?v=..." keyboardType="url" optional />
                    <Field label="Presentation URL" value={presentationUrl} onChange={setPresentationUrl} placeholder="https://slides.com/..." keyboardType="url" optional />
                  </View>
                )}
              </ScrollView>

              {/* Bottom Navigation */}
              <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-5 pb-8 pt-4">
                <View className="flex-row gap-3">
                  {step > 0 && (
                    <TouchableOpacity
                      onPress={() => setStep(s => s - 1)}
                      className="flex-1 border border-slate-200 rounded-2xl py-4 items-center"
                    >
                      <Text className="text-slate-600 font-black uppercase text-sm">Back</Text>
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
                      <LinearGradient colors={['#6366f1', '#8b5cf6']} className="rounded-2xl">
                        <View className="py-4 items-center">
                          <Text className="text-white font-black uppercase text-sm">Next →</Text>
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
                    <View className="flex-1 flex-row gap-3">
                      <TouchableOpacity
                        onPress={saveDraft}
                        disabled={saving}
                        className="flex-1 border border-indigo-200 rounded-2xl py-4 items-center"
                      >
                        {saving
                          ? <ActivityIndicator size="small" color="#6366f1" />
                          : <Text className="text-indigo-600 font-black uppercase text-sm">Save Draft</Text>
                        }
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={finalize}
                        disabled={finalizing}
                        className="flex-1"
                        activeOpacity={0.88}
                      >
                        <LinearGradient colors={['#10b981', '#059669']} className="rounded-2xl">
                          <View className="py-4 items-center">
                            {finalizing
                              ? <ActivityIndicator size="small" color="white" />
                              : <Text className="text-white font-black uppercase text-sm">Submit 🚀</Text>
                            }
                          </View>
                        </LinearGradient>
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
