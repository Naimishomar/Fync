import React, { useEffect, useState } from 'react';
import {View, Text, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Image, Keyboard} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { Alert } from '../ui/AlertModal';
import MultiSelectSheet from '../ui/MultiSelectSheet';
import { collegesInIndia } from '../../data/college';
import { PASSOUT_YEARS, BRANCHES } from '../../data/academics';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

const ELIGIBILITY_META = {
  colleges: {
    title: 'Which colleges?',
    hint: 'Leave it open unless the hackathon is campus-restricted',
    allLabel: 'All colleges',
    options: collegesInIndia,
  },
  Year: {
    title: 'Which batches?',
    hint: 'By passout year — the same batches students pick at signup',
    allLabel: 'All batches',
    options: PASSOUT_YEARS,
  },
  branch: {
    title: 'Which branches?',
    hint: 'Descriptive only — your registration form decides who gets in',
    allLabel: 'All branches',
    options: BRANCHES,
  },
} as const;

const ELIGIBILITY_PICKERS = [
  { key: 'colleges' as const, label: 'Colleges', allLabel: 'All colleges', icon: 'business-outline' },
  { key: 'Year' as const, label: 'Batch', allLabel: 'All batches', icon: 'calendar-outline' },
  { key: 'branch' as const, label: 'Branches', allLabel: 'All branches', icon: 'git-branch-outline' },
];

/** A stored date that fails to parse would render "Invalid Date" and throw in toISOString on save. */
const toDate = (v: any) => {
  const d = v ? new Date(v) : null;
  return d && !isNaN(d.getTime()) ? d : new Date();
};

const HackathonCreate = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    title: '',
    description: '',
    // Fync hands students off here — the listing is a signpost, not a
    // registration desk.
    applyLink: '',
    applyLabel: 'Register',
    // Optional: the host's own form is what actually closes. This is shown for
    // context so a student knows whether it is worth tapping through.
    registrationends: null as Date | null,
    hackathonstarts: new Date(),
    hackathonends: new Date(),
    mode: 'Online',
    location: '',
    teamSize: '',
    prizepool: '',
    tags: '',
    contactEmail: '',
    discordLink: '',
    websiteLink: '',
  });

  // Complex Nested State
  // Empty array means "open to all" — the same thing the API already treats
  // as unrestricted, so there is no separate flag to keep in sync.
  const [eligibility, setEligibility] = useState<{ Year: string[]; branch: string[]; colleges: string[] }>({
    Year: [],
    branch: [],
    colleges: [],
  });
  const [eligibilitySheet, setEligibilitySheet] = useState<'colleges' | 'Year' | 'branch' | null>(null);
  const [prizes, setPrizes] = useState([{ rank: 1, title: '', amount: '' }]);
  const [rules, setRules] = useState(['']);
  const [tracks, setTracks] = useState([{ title: '', description: '', prizes: '' }]);
  const [timeline, setTimeline] = useState([{ label: '', date: new Date(), description: '' }]);
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);
  const [sponsors, setSponsors] = useState([{ name: '', level: 'Partner', logo: null as string | null }]);

  const [bannerImage, setBannerImage] = useState<string | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState<string | number | null>(null);

  const route = useRoute<any>();
  const hackIdToEdit = route.params?.hackathonId;
  const isEdit = !!hackIdToEdit;

  useEffect(() => {
    if (isEdit) {
      loadHackathonToEdit();
    }
  }, [hackIdToEdit]);

  const loadHackathonToEdit = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/hackathons/${hackIdToEdit}`);
      const h = res.data.hackathon;

      setForm({
        title: h.title || '',
        description: h.description || '',
        applyLink: h.applyLink || '',
        applyLabel: h.applyLabel || 'Register',
        registrationends: h.registrationends ? new Date(h.registrationends) : null,
        hackathonstarts: toDate(h.hackathonstarts),
        hackathonends: toDate(h.hackathonends),
        mode: h.mode || 'Online',
        location: h.location || '',
        teamSize: h.teamSize || '',
        prizepool: h.prizepool || '',
        tags: h.tags?.join(', ') || '',
        contactEmail: h.contactEmail || '',
        discordLink: h.discordLink || '',
        websiteLink: h.websiteLink || '',
      });

      setEligibility({
        Year: h.eligibility?.Year ?? [],
        branch: h.eligibility?.branch ?? [],
        colleges: h.eligibility?.colleges ?? [],
      });

      if (h.prizes?.length) setPrizes(h.prizes);
      if (h.rules?.length) setRules(h.rules);
      if (h.tracks?.length) setTracks(h.tracks);
      if (h.timeline?.length) {
        setTimeline(h.timeline.map((t: any) => ({ ...t, date: toDate(t.date) })));
      }
      if (h.faqs?.length) setFaqs(h.faqs);
      if (h.sponsors?.length) setSponsors(h.sponsors);

      setForm(prev => ({
        ...prev,
        contactEmail: h.contactEmail || '',
        discordLink: h.discordLink || '',
        websiteLink: h.websiteLink || '',
      }));

      if (h.bannerImage) setBannerImage(h.bannerImage);
      if (h.logo) setLogo(h.logo);

    } catch (err) {
      Toast.show({ type: 'error', text1: 'Failed to load details' });
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (type: 'banner' | 'logo') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: type === 'banner' ? [16, 9] : [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'banner') setBannerImage(result.assets[0].uri);
        else setLogo(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date, idOverride?: string | number | null) => {
    const activeId = idOverride !== undefined ? idOverride : showPicker;

    if (selectedDate && activeId !== null) {
      if (typeof activeId === 'string') {
        setForm(prev => ({ ...prev, [activeId]: selectedDate }));
      } else {
        setTimeline(prev => prev.map((item, idx) => idx === activeId ? { ...item, date: selectedDate } : item));
      }
    }
    setShowPicker(null);
  };

  const triggerPicker = (id: string | number) => {
    Keyboard?.dismiss?.();
    const currentValue = (typeof id === 'string' ? (form as any)[id] : timeline[id].date) ?? new Date();
    const minDate = getMinDate(id);

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: currentValue,
        onChange: (event, date) => {
          if (event.type === 'set' && date) {
            // After date is confirmed, open time picker
            DateTimePickerAndroid.open({
              value: date,
              onChange: (tEvent, tDate) => handleDateChange(tEvent, tDate, id),
              mode: 'time',
              is24Hour: true,
            });
          } else {
            handleDateChange(event, date, id);
          }
        },
        mode: 'date',
        minimumDate: minDate,
      });
    } else {
      setShowPicker(id);
    }
  };

  const getMinDate = (id: string | number) => {
    const now = new Date();
    if (typeof id === 'number') return now;

    switch (id) {
      case 'registrationends': return now;
      case 'hackathonstarts': return now;
      case 'hackathonends': return form.hackathonstarts;
      default: return now;
    }
  };

  const validateDates = () => {
    const { registrationends, hackathonstarts, hackathonends } = form;

    // The deadline is optional — plenty of hosts keep registration open until
    // they fill up — but if it is set it has to precede the hackathon.
    if (registrationends && registrationends > hackathonends) {
      Alert.alert('Check the dates', 'Registration cannot close after the hackathon ends.');
      return false;
    }
    if (hackathonends <= hackathonstarts) {
      Alert.alert('Check the dates', 'The hackathon must end after it starts.');
      return false;
    }
    return true;
  };

  /** Hosts paste "unstop.com/x" as often as a full URL; both must work. */
  const validateApplyLink = () => {
    const raw = form.applyLink.trim();
    if (!raw) {
      Alert.alert('Registration link required', 'Students tap through to your own form or site — add that link.');
      return false;
    }
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const url = new URL(withScheme);
      if (!url.hostname.includes('.')) throw new Error('bad host');
      return true;
    } catch {
      Alert.alert('Check the link', "That does not look like a valid URL.");
      return false;
    }
  };

  const addPrize = () => setPrizes([...prizes, { rank: prizes.length + 1, title: '', amount: '' }]);
  const removePrize = (i: number) => setPrizes(prizes.filter((_, idx) => idx !== i));

  const addRule = () => setRules([...rules, '']);
  const removeRule = (i: number) => setRules(rules.filter((_, idx) => idx !== i));

  const addTrack = () => setTracks([...tracks, { title: '', description: '', prizes: '' }]);
  const removeTrack = (i: number) => setTracks(tracks.filter((_, idx) => idx !== i));

  const addTimelineItem = () => setTimeline([...timeline, { label: '', date: new Date(), description: '' }]);
  const removeTimelineItem = (i: number) => setTimeline(timeline.filter((_, idx) => idx !== i));

  const addFaq = () => setFaqs([...faqs, { question: '', answer: '' }]);
  const removeFaq = (i: number) => setFaqs(faqs.filter((_, idx) => idx !== i));

  const addSponsor = () => setSponsors([...sponsors, { name: '', level: 'Partner', logo: null }]);
  const removeSponsor = (i: number) => setSponsors(sponsors.filter((_, idx) => idx !== i));
  const updateSponsor = (i: number, field: string, value: any) => {
    setSponsors(sponsors.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const pickSponsorLogo = async (i: number) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled) updateSponsor(i, 'logo', result.assets[0].uri);
    } catch { Alert.alert('Error', 'Failed to pick logo'); }
  };

  const handleSubmit = async () => {
    Keyboard?.dismiss?.();
    if (!form.title.trim()) {
      Alert.alert('Title required', 'Give the hackathon a name students will recognise.');
      return;
    }
    if (!validateApplyLink()) return;
    if (!validateDates()) return;

    setLoading(true);
    try {
      const formData = new FormData();

      // Basic fields
      Object.entries(form).forEach(([key, val]) => {
        // A null deadline means "no deadline" — sending "null" as a string
        // would fail the cast and reject the whole listing.
        if (val === null || val === undefined) return;
        if (val instanceof Date) formData.append(key, val.toISOString());
        else formData.append(key, String(val));
      });

      // Tags
      formData.append('tags', JSON.stringify(form.tags.split(',').map(tag => tag.trim()).filter(t => t)));

      // Complex fields
      formData.append('eligibility', JSON.stringify(eligibility));
      formData.append('prizes', JSON.stringify(prizes.filter(p => p.title)));
      formData.append('rules', JSON.stringify(rules.filter(r => r.trim())));
      formData.append('tracks', JSON.stringify(tracks.filter(t => t.title || t.description)));
      formData.append('timeline', JSON.stringify(timeline.filter(t => t.label || t.description).map(t => ({ ...t, date: t.date.toISOString() }))));
      formData.append('faqs', JSON.stringify(faqs.filter(f => f.question)));

      // Sponsors (images are handled separately). The server matches
      // sponsorLogo_<i> to position i in the *sent* array, so files are indexed
      // by the filtered list, and an already-uploaded logo URL is sent back so
      // editing a listing does not wipe it.
      const namedSponsors = sponsors.filter(s => s.name);
      const sponsorsData = namedSponsors.map((s, i) => ({
        name: s.name,
        level: s.level,
        index: i, // to track which file matches which sponsor
        ...(s.logo && !s.logo.startsWith('file') ? { logo: s.logo } : {}),
      }));
      formData.append('sponsors', JSON.stringify(sponsorsData));

      namedSponsors.forEach((s, i) => {
        if (s.logo && s.logo.startsWith('file')) {
          formData.append(`sponsorLogo_${i}`, {
            uri: s.logo,
            name: `sponsor_${i}.jpg`,
            type: 'image/jpeg',
          } as any);
        }
      });

      // Images (only upload if local URI)
      if (bannerImage && bannerImage.startsWith('file')) {
        const filename = bannerImage.split('/').pop() || 'banner.jpg';
        formData.append('bannerImage', { uri: bannerImage, name: filename, type: 'image/jpeg' } as any);
      }
      if (logo && logo.startsWith('file')) {
        const filename = logo.split('/').pop() || 'logo.jpg';
        formData.append('logo', { uri: logo, name: filename, type: 'image/jpeg' } as any);
      }

      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (isEdit) {
        await axios.patch(`/hackathons/${hackIdToEdit}`, formData, config);
        Toast.show({ type: 'success', text1: 'Hackathon Reconfigured!' });
      } else {
        await axios.post('/hackathons', formData, config);
        Toast.show({ type: 'success', text1: 'Hackathon Live!' });
      }

      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: isEdit ? 'Failed to update' : 'Failed to create',
        text2: error.response?.data?.message || 'Check your fields'
      });
    } finally {
      setLoading(false);
    }
  };

  const renderSectionHeader = (title: string, icon: string) => (
    <View className="flex-row items-center mt-8 mb-4">
      <View className="w-10 h-10 rounded-card bg-paper-2 border border-line items-center justify-center mr-3 shadow-hair">
        <Ionicons name={icon as any} size={18} color={C.brand[500]} />
      </View>
      <Text className="text-ink font-display text-xl">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style={C.scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView className="flex-1" edges={["bottom"]}>

        {/* Header */}
        <AppBar title="Host Mission" onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>

            {/* Visual Assets */}
            <View className="flex-row gap-4 mt-8">
              <TouchableOpacity onPress={() => pickImage('logo')} className="w-28 h-28 rounded-sheet bg-paper-2 border-2 border-dashed border-line items-center justify-center overflow-hidden shadow-hair">
                {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <View className="items-center"><Ionicons name="flash-outline" size={28} color={C.ink3} /><Text className="text-label font-semibold text-ink-3 mt-1">Logo</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 h-28 rounded-sheet bg-paper-2 border-2 border-dashed border-line items-center justify-center overflow-hidden shadow-hair">
                {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <View className="items-center"><Ionicons name="images-outline" size={28} color={C.ink3} /><Text className="text-label font-semibold text-ink-3 mt-1">Banner</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Basic Info */}
            {renderSectionHeader('Protocol Essentials', 'rocket')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              <TextInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Hackathon title" placeholderTextColor={C.ink3} className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line" />
              <TextInput value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="What is this hackathon about?" multiline numberOfLines={4} placeholderTextColor={C.ink3} className="bg-paper-2 rounded-sheet px-6 py-4 mb-4 text-ink font-semibold text-xs border border-line h-32" />
              <TextInput value={form.tags} onChangeText={(t) => setForm({ ...form, tags: t })} placeholder="Tags (ai, blockchain…)" placeholderTextColor={C.ink3} className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line" />
              <View className="flex-row gap-4">
                <TextInput value={form.prizepool} onChangeText={(t) => setForm({ ...form, prizepool: t })} placeholder="Prize pool" placeholderTextColor={C.ink3} className="flex-[2] bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line" />
                <TextInput value={form.teamSize} onChangeText={(t) => setForm({ ...form, teamSize: t })} placeholder="Team size" placeholderTextColor={C.ink3} className="flex-1 bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line" />
              </View>

              {/* Mode + venue */}
              <Text className="text-ink-3 font-semibold text-label mt-4 mb-2">How is it run?</Text>
              <View className="flex-row gap-2 mb-4">
                {['Online', 'Offline', 'Hybrid'].map((m) => {
                  const on = form.mode === m;
                  return (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setForm({ ...form, mode: m })}
                      className={`flex-1 items-center py-3 rounded-card border-2 ${on ? 'bg-ink border-ink' : 'bg-paper-2 border-line'}`}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text className={`font-semibold text-label ${on ? 'text-paper' : 'text-ink-2'}`}>{m}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {form.mode !== 'Online' ? (
                <TextInput value={form.location} onChangeText={(t) => setForm({ ...form, location: t })} placeholder="Venue or city" placeholderTextColor={C.ink3} className="bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line" />
              ) : null}
            </View>

            {/* The hand-off. Fync lists the hackathon; the host runs it. */}
            {renderSectionHeader('Where students register', 'open-outline')}
            <View className="bg-card rounded-sheet p-6 border-2 border-ink shadow-hair">
              <Text className="text-ink-2 text-label leading-4 mb-4">
                Fync lists your hackathon and sends students straight to you. Registration,
                teams, submissions and judging all stay on your own platform.
              </Text>

              <Text className="text-ink-3 font-semibold text-label mb-2">Registration link *</Text>
              <TextInput
                value={form.applyLink}
                onChangeText={(t) => setForm({ ...form, applyLink: t })}
                placeholder="unstop.com/… , forms.gle/… , your site"
                placeholderTextColor={C.ink3}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line"
              />

              <Text className="text-ink-3 font-semibold text-label mb-2">Button text</Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {['Register', 'Apply now', 'Register on Devfolio', 'Fill the form'].map((label) => {
                  const on = form.applyLabel === label;
                  return (
                    <TouchableOpacity
                      key={label}
                      onPress={() => setForm({ ...form, applyLabel: label })}
                      className={`px-3.5 py-2 rounded-card border ${on ? 'bg-brand-500 border-ink' : 'bg-paper-2 border-line'}`}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text className={`font-semibold text-label ${on ? 'text-on-brand' : 'text-ink-2'}`}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                value={form.applyLabel}
                onChangeText={(t) => setForm({ ...form, applyLabel: t })}
                placeholder="Or write your own"
                placeholderTextColor={C.ink3}
                maxLength={28}
                className="bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line"
              />
            </View>

            {/* Targeting / Eligibility */}
            {renderSectionHeader('Who can apply', 'school')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              <Text className="text-ink-2 text-label leading-4 mb-4">
                Open to everyone unless you narrow it. This is what students read before
                tapping through — your own form still decides who actually gets in.
              </Text>

              {ELIGIBILITY_PICKERS.map(({ key, label, allLabel, icon }) => {
                const chosen = eligibility[key];
                const isAll = chosen.length === 0;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setEligibilitySheet(key)}
                    className="bg-paper-2 rounded-card border border-line px-5 py-4 mb-3"
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}: ${isAll ? allLabel : chosen.join(', ')}`}
                  >
                    <View className="flex-row items-center">
                      <Ionicons name={icon as any} size={15} color={C.ink3} />
                      <Text className="text-ink-3 font-semibold text-label ml-2 flex-1">{label}</Text>
                      <Text className="text-ink-3 font-semibold text-label mr-1">
                        {isAll ? allLabel : `${chosen.length} selected`}
                      </Text>
                      <Ionicons name="chevron-down" size={15} color={C.ink3} />
                    </View>

                    {/* Show what was picked, not just a count — a host should be
                        able to check the list without reopening the sheet. */}
                    {!isAll ? (
                      <View className="flex-row flex-wrap mt-3" style={{ gap: 6 }}>
                        {chosen.slice(0, 4).map((v) => (
                          <View key={v} className="bg-card border border-line px-2.5 py-1 rounded-md">
                            <Text className="text-ink-2 text-label font-semibold">{v}</Text>
                          </View>
                        ))}
                        {chosen.length > 4 ? (
                          <View className="px-2 py-1">
                            <Text className="text-ink-3 text-label font-semibold">+{chosen.length - 4} more</Text>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Rules */}
            {renderSectionHeader('Rules', 'list')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {rules.map((rule, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-3">
                  <TextInput value={rule} onChangeText={(t) => setRules(rules.map((r, idx) => idx === i ? t : r))} placeholder={`Rule ${i + 1}`} placeholderTextColor={C.ink3} className="flex-1 bg-paper rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
                  <TouchableOpacity onPress={() => removeRule(i)} className="bg-paper-2 p-3 rounded-xl border border-line"><Ionicons name="trash" size={16} color={C.danger} /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addRule} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card mt-2">
                <Ionicons name="add" size={20} color={C.brand[500]} />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add rule</Text>
              </TouchableOpacity>
            </View>

            {/* Timeline */}
            {renderSectionHeader('Event Roadmap / Timeline', 'time')}
            <View className="mb-8">
              <Text className="text-ink-3 text-label font-semibold mb-4 px-2">Construct the journey for your participants (e.g. Kickoff, Workshops, Submission, Results)</Text>
              {timeline.map((item, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line shadow-hair /[0.02]">
                  <TextInput value={item.label} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, label: t } : x))} placeholder="Stage name (e.g. semi-finals)" placeholderTextColor={C.ink3} className="text-ink font-semibold text-xs mb-3" />
                  <TouchableOpacity onPress={() => triggerPicker(i)} className="bg-card rounded-xl px-4 py-3 mb-3 border border-line flex-row justify-between items-center">
                    <Text className="text-ink-3 font-semibold text-label">Date & Time</Text>
                    <Text className="text-ink font-semibold text-label">{item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                  <TextInput value={item.description} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="What happens in this stage?" placeholderTextColor={C.ink3} multiline className="text-ink-3 text-xs leading-4" />
                  <TouchableOpacity onPress={() => setTimeline(timeline.filter((_, idx) => idx !== i))} className="mt-4 self-end">
                    <Ionicons name="trash" size={16} color={C.danger} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setTimeline([...timeline, { label: '', date: new Date(), description: '' }])} className="border-2 border-dashed border-line rounded-card p-5 items-center">
                <Text className="text-ink-3 font-semibold text-label">Add milestone +</Text>
              </TouchableOpacity>
            </View>

            {/* Dates */}
            {renderSectionHeader('Dates', 'calendar')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mb-8">
              {[
                ['hackathonstarts', 'Starts'],
                ['hackathonends', 'Ends'],
              ].map(([field, label]) => (
                <TouchableOpacity
                  key={field}
                  onPress={() => triggerPicker(field)}
                  className="flex-row items-center justify-between bg-paper-2 rounded-card px-6 py-4 mb-3 border border-line"
                  accessibilityRole="button"
                >
                  <Text className="text-ink-3 font-semibold text-label">{label}</Text>
                  <Text className="text-ink font-semibold text-xs">{(form as any)[field].toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}

              {/* Optional: your own form decides when registration really
                  closes — this only tells students whether to hurry. */}
              <TouchableOpacity
                onPress={() => triggerPicker('registrationends')}
                className="flex-row items-center justify-between bg-paper-2 rounded-card px-6 py-4 border border-line"
                accessibilityRole="button"
              >
                <Text className="text-ink-3 font-semibold text-label">Registration closes (optional)</Text>
                <Text className="text-ink font-semibold text-xs">
                  {form.registrationends ? form.registrationends.toLocaleDateString() : 'Not set'}
                </Text>
              </TouchableOpacity>
              {form.registrationends ? (
                <TouchableOpacity onPress={() => setForm({ ...form, registrationends: null })} className="self-end mt-2 py-2" accessibilityRole="button">
                  <Text className="text-ink-3 font-semibold text-label">Clear deadline</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Contact Portal */}
            {renderSectionHeader('Contact & Portal Signals', 'mail')}
            <View className="bg-paper-2 rounded-sheet p-card-pad mb-8 border border-line">
              <View className="mb-6">
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Official Contact Email</Text>
                <TextInput value={form.contactEmail} onChangeText={t => setForm({ ...form, contactEmail: t })} placeholder="support@yourhackathon.com" placeholderTextColor={C.ink3} className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
              <View className="mb-6">
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Discord server</Text>
                <TextInput value={form.discordLink} onChangeText={t => setForm({ ...form, discordLink: t })} placeholder="discord.gg/invite" placeholderTextColor={C.ink3} className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
              <View>
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Website</Text>
                <TextInput value={form.websiteLink} onChangeText={t => setForm({ ...form, websiteLink: t })} placeholder="https://yourhackathon.com" placeholderTextColor={C.ink3} className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
            </View>

            {/* Sponsors */}
            {renderSectionHeader('Sponsors / Partners', 'business')}
            <View className="mb-8">
              {sponsors.map((s, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-6 mb-4 border border-line">
                  <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={() => pickSponsorLogo(i)} className="w-16 h-16 rounded-card bg-card border border-line items-center justify-center mr-4 shadow-hair">
                      {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full rounded-card" /> : <Ionicons name="image" size={24} color={C.ink4} />}
                    </TouchableOpacity>
                    <View className="flex-1">
                      <TextInput value={s.name} onChangeText={(t) => updateSponsor(i, 'name', t)} placeholder="Sponsor name" placeholderTextColor={C.ink3} className="text-ink font-semibold text-xs mb-2" />
                      <View className="flex-row">
                        {['Title', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'].slice(0, 3).map(lvl => (
                          <TouchableOpacity key={lvl} onPress={() => updateSponsor(i, 'level', lvl)} className={`px-3 py-1 rounded-lg border mr-2 ${s.level === lvl ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                            <Text className={`text-label font-semibold ${s.level === lvl ? 'text-paper' : 'text-ink-3'}`}>{lvl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeSponsor(i)} className="ml-2">
                      <Ionicons name="trash-outline" size={18} color={C.danger} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={addSponsor} className="border-2 border-dashed border-line rounded-card p-5 items-center">
                <Text className="text-ink-3 font-semibold text-label">Onboard Sponsor +</Text>
              </TouchableOpacity>
            </View>

            {/* Tracks */}
            {renderSectionHeader('Strategic Tracks', 'layers')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {tracks.map((t, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line">
                  <TextInput value={t.title} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, title: val } : x))} placeholder="Track title" placeholderTextColor={C.ink3} className="text-ink font-semibold text-xs mb-3" />
                  <TextInput value={t.description} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, description: val } : x))} placeholder="Track description" multiline placeholderTextColor={C.ink3} className="bg-card rounded-xl px-4 py-3 text-ink font-semibold text-label border border-line mb-3 h-20" />
                  <TextInput value={t.prizes} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, prizes: val } : x))} placeholder="Track prize (e.g. ₹50,000)" placeholderTextColor={C.ink3} className="bg-card rounded-xl px-4 py-3 text-success font-semibold text-label border border-success/10" />
                  <TouchableOpacity onPress={() => removeTrack(i)} className="absolute -top-2 -right-2 bg-card w-8 h-8 rounded-full items-center justify-center border border-line shadow-hair"><Ionicons name="close" size={16} color={C.danger} /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addTrack} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card">
                <Ionicons name="add" size={20} color={C.brand[500]} />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add track</Text>
              </TouchableOpacity>
            </View>

            {/* FAQs */}
            {renderSectionHeader('Knowledge Base', 'help-circle')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {faqs.map((f, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line">
                  <TextInput value={f.question} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, question: val } : x))} placeholder="Question" placeholderTextColor={C.ink3} className="text-ink font-semibold text-xs mb-3" />
                  <TextInput value={f.answer} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, answer: val } : x))} placeholder="Answer" multiline placeholderTextColor={C.ink3} className="bg-card rounded-xl px-4 py-3 text-ink-3 font-semibold text-label border border-line h-20" />
                  <TouchableOpacity onPress={() => removeFaq(i)} className="absolute -top-2 -right-2 bg-card w-8 h-8 rounded-full items-center justify-center border border-line shadow-hair"><Ionicons name="close" size={16} color={C.danger} /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addFaq} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card">
                <Ionicons name="add" size={20} color={C.brand[500]} />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add question</Text>
              </TouchableOpacity>
            </View>

            {/* Rewards */}
            {renderSectionHeader('Bounty Tiers', 'medal')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {prizes.map((p, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-xl bg-ink items-center justify-center border border-ink shadow-hair"><Text className="font-semibold text-paper text-label">#{p.rank}</Text></View>
                  <TextInput value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="Prize title" placeholderTextColor={C.ink3} className="flex-1 bg-paper rounded-card px-5 py-3 font-semibold text-xs text-ink border border-line" />
                  <TextInput value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="Amount" placeholderTextColor={C.ink3} className="flex-1 bg-paper rounded-card px-5 py-3 font-semibold text-xs text-ink border border-line" />
                </View>
              ))}
              <TouchableOpacity onPress={addPrize} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card mt-2">
                <Ionicons name="add" size={20} color={C.brand[500]} />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add prize</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="mt-12 overflow-hidden rounded-sheet shadow-hair">
              <View className="py-6 items-center justify-center flex-row" style={{ backgroundColor: C.brand[500] }}>
                {loading ? <ActivityIndicator size="small" color={C.onBrand} /> : (
                  <>
                    <Text className="text-on-brand font-display mr-3 text-lg">{isEdit ? 'Save changes' : 'Create hackathon'}</Text>
                    <Ionicons name="rocket" size={24} color={C.onBrand} />
                  </>
                )}
              </View>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {eligibilitySheet ? (
        <MultiSelectSheet
          visible
          onClose={() => setEligibilitySheet(null)}
          title={ELIGIBILITY_META[eligibilitySheet].title}
          hint={ELIGIBILITY_META[eligibilitySheet].hint}
          allLabel={ELIGIBILITY_META[eligibilitySheet].allLabel}
          options={ELIGIBILITY_META[eligibilitySheet].options}
          selected={eligibility[eligibilitySheet]}
          onChange={(next) => setEligibility((prev) => ({ ...prev, [eligibilitySheet]: next }))}
          searchable={eligibilitySheet === 'colleges'}
          searchPlaceholder="Search colleges"
        />
      ) : null}

      {Platform.OS === 'ios' && showPicker !== null && (
        <DateTimePicker
          // registrationends is null until set; the picker crashes on a null value.
          value={(typeof showPicker === 'string' ? (form as any)[showPicker] : timeline[showPicker]?.date) ?? new Date()}
          mode="datetime"
          display="default"
          onChange={handleDateChange}
          minimumDate={getMinDate(showPicker)}
        />
      )}
    </View>
  );
};

export default HackathonCreate;


