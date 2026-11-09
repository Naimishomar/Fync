import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform, Image, Keyboard } from 'react-native';
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
import { AppBar, Button, Card, Chip, FormField, IconBtn, IconTile, Label, SegmentedTabs, Tag, TagRow } from '../ui/kit';

const MODES = ['Online', 'Offline', 'Hybrid'] as const;
const APPLY_LABELS = ['Register', 'Apply now', 'Register on Devfolio', 'Fill the form'];
const SPONSOR_LEVELS = ['Title', 'Platinum', 'Gold'];

const SectionTitle = ({ title, icon }: { title: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) => (
  <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
    <IconTile icon={icon} size={40} />
    <Text className="text-ink text-base font-semibold" accessibilityRole="header">{title}</Text>
  </View>
);

/** Tappable label/value row that opens a picker. */
const PickRow = ({ label, value, onPress }: { label: string; value: string; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${label}: ${value}`}
    className="flex-row items-center justify-between bg-paper-2 rounded-2xl px-4 border border-line active:opacity-85"
    style={{ minHeight: 48, gap: 12 }}
  >
    <Text className="text-ink-2 text-sm font-semibold flex-shrink">{label}</Text>
    <Text className="text-ink text-sm">{value}</Text>
  </Pressable>
);

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
        allowsEditing: Platform.OS === 'ios',
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: Platform.OS === 'ios', aspect: [1, 1], quality: 0.8 });
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

  const set = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style={C.scheme === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView className="flex-1" edges={["bottom"]}>

        <AppBar title={isEdit ? 'Edit hackathon' : 'Host a hackathon'} onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>

            {/* Visual assets */}
            <View className="flex-row mt-6" style={{ gap: 12 }}>
              <Pressable onPress={() => pickImage('logo')} accessibilityRole="button" accessibilityLabel="Pick logo" className="w-28 h-28 rounded-2xl bg-paper-2 border border-dashed border-line items-center justify-center overflow-hidden active:opacity-85">
                {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <View className="items-center"><Ionicons name="flash-outline" size={28} color={C.ink3} /><Text className="text-xs font-semibold text-ink-3 mt-1">Logo</Text></View>}
              </Pressable>

              <Pressable onPress={() => pickImage('banner')} accessibilityRole="button" accessibilityLabel="Pick banner" className="flex-1 h-28 rounded-2xl bg-paper-2 border border-dashed border-line items-center justify-center overflow-hidden active:opacity-85">
                {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <View className="items-center"><Ionicons name="images-outline" size={28} color={C.ink3} /><Text className="text-xs font-semibold text-ink-3 mt-1">Banner</Text></View>}
              </Pressable>
            </View>

            <SectionTitle title="Basics" icon="rocket-outline" />
            <Card padded style={{ gap: 12 }}>
              <FormField label="Title" value={form.title} onChangeText={(t) => set({ title: t })} placeholder="Hackathon title" />
              <FormField label="Description" value={form.description} onChangeText={(t) => set({ description: t })} placeholder="What is this hackathon about?" multiline numberOfLines={4} />
              <FormField label="Tags" value={form.tags} onChangeText={(t) => set({ tags: t })} placeholder="ai, blockchain…" hint="Comma separated" />
              <View className="flex-row" style={{ gap: 12 }}>
                <FormField label="Prize pool" value={form.prizepool} onChangeText={(t) => set({ prizepool: t })} placeholder="₹1,00,000" containerStyle={{ flex: 2 }} />
                <FormField label="Team size" value={form.teamSize} onChangeText={(t) => set({ teamSize: t })} placeholder="1-4" containerStyle={{ flex: 1 }} />
              </View>

              <Label>How is it run?</Label>
              <SegmentedTabs items={MODES} value={form.mode as (typeof MODES)[number]} onChange={(m) => set({ mode: m })} />
              {form.mode !== 'Online' ? (
                <FormField label="Venue" value={form.location} onChangeText={(t) => set({ location: t })} placeholder="Venue or city" />
              ) : null}
            </Card>

            {/* The hand-off. Fync lists the hackathon; the host runs it. */}
            <SectionTitle title="Where students register" icon="open-outline" />
            <Card padded style={{ gap: 12 }}>
              <Text className="text-ink-2 text-sm leading-5">
                Fync lists your hackathon and sends students straight to you. Registration,
                teams, submissions and judging all stay on your own platform.
              </Text>

              <FormField
                label="Registration link *"
                value={form.applyLink}
                onChangeText={(t) => set({ applyLink: t })}
                placeholder="unstop.com/… , forms.gle/… , your site"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              <Label>Button text</Label>
              <TagRow>
                {APPLY_LABELS.map((label) => (
                  <Chip key={label} label={label} active={form.applyLabel === label} onPress={() => set({ applyLabel: label })} />
                ))}
              </TagRow>
              <FormField value={form.applyLabel} onChangeText={(t) => set({ applyLabel: t })} placeholder="Or write your own" maxLength={28} accessibilityLabel="Custom button text" />
            </Card>

            <SectionTitle title="Who can apply" icon="school-outline" />
            <Card padded>
              <Text className="text-ink-2 text-sm leading-5 mb-3">
                Open to everyone unless you narrow it. This is what students read before
                tapping through — your own form still decides who actually gets in.
              </Text>

              {ELIGIBILITY_PICKERS.map(({ key, label, allLabel, icon }) => {
                const chosen = eligibility[key];
                const isAll = chosen.length === 0;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setEligibilitySheet(key)}
                    className="bg-paper-2 rounded-2xl border border-line px-4 py-3 mb-3 active:opacity-85"
                    style={{ minHeight: 48 }}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}: ${isAll ? allLabel : chosen.join(', ')}`}
                  >
                    <View className="flex-row items-center">
                      <Ionicons name={icon as any} size={16} color={C.ink3} />
                      <Text className="text-ink text-sm font-semibold ml-2 flex-1">{label}</Text>
                      <Text className="text-ink-3 text-sm mr-1">
                        {isAll ? allLabel : `${chosen.length} selected`}
                      </Text>
                      <Ionicons name="chevron-down" size={16} color={C.ink3} />
                    </View>

                    {/* Show what was picked, not just a count — a host should be
                        able to check the list without reopening the sheet. */}
                    {!isAll ? (
                      <TagRow style={{ marginTop: 12 }}>
                        {chosen.slice(0, 4).map((v) => <Tag key={v} label={v} />)}
                        {chosen.length > 4 ? <Tag label={`+${chosen.length - 4} more`} /> : null}
                      </TagRow>
                    ) : null}
                  </Pressable>
                );
              })}
            </Card>

            <SectionTitle title="Rules" icon="list-outline" />
            <Card padded>
              {rules.map((rule, i) => (
                <View key={i} className="flex-row items-center mb-3" style={{ gap: 8 }}>
                  <FormField value={rule} onChangeText={(t) => setRules(rules.map((r, idx) => idx === i ? t : r))} placeholder={`Rule ${i + 1}`} accessibilityLabel={`Rule ${i + 1}`} containerStyle={{ flex: 1 }} />
                  <IconBtn name="trash-outline" color={C.danger} size={18} onPress={() => removeRule(i)} accessibilityLabel={`Remove rule ${i + 1}`} />
                </View>
              ))}
              <Button small variant="tertiary" icon="add" title="Add rule" onPress={addRule} style={{ alignSelf: 'flex-start' }} />
            </Card>

            <SectionTitle title="Timeline" icon="time-outline" />
            <Text className="text-ink-3 text-sm mb-3">Kickoff, workshops, submission, results — the journey for your participants.</Text>
            {timeline.map((item, i) => (
              <Card key={i} padded style={{ marginBottom: 12, gap: 12 }}>
                <FormField label="Stage" value={item.label} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, label: t } : x))} placeholder="Stage name (e.g. semi-finals)" />
                <PickRow
                  label="Date & time"
                  value={`${item.date.toLocaleDateString()} ${item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  onPress={() => triggerPicker(i)}
                />
                <FormField label="Details" value={item.description} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="What happens in this stage?" multiline />
                <Button small variant="tertiary" icon="trash-outline" title="Remove stage" onPress={() => removeTimelineItem(i)} style={{ alignSelf: 'flex-end' }} />
              </Card>
            ))}
            <Button small variant="tertiary" icon="add" title="Add milestone" onPress={addTimelineItem} style={{ alignSelf: 'flex-start' }} />

            <SectionTitle title="Dates" icon="calendar-outline" />
            <Card padded style={{ gap: 12 }}>
              <PickRow label="Starts" value={form.hackathonstarts.toLocaleDateString()} onPress={() => triggerPicker('hackathonstarts')} />
              <PickRow label="Ends" value={form.hackathonends.toLocaleDateString()} onPress={() => triggerPicker('hackathonends')} />
              {/* Optional: your own form decides when registration really
                  closes — this only tells students whether to hurry. */}
              <PickRow
                label="Registration closes (optional)"
                value={form.registrationends ? form.registrationends.toLocaleDateString() : 'Not set'}
                onPress={() => triggerPicker('registrationends')}
              />
              {form.registrationends ? (
                <Button small variant="tertiary" title="Clear deadline" onPress={() => set({ registrationends: null })} style={{ alignSelf: 'flex-end' }} />
              ) : null}
            </Card>

            <SectionTitle title="Contact & links" icon="mail-outline" />
            <Card padded style={{ gap: 12 }}>
              <FormField label="Contact email" value={form.contactEmail} onChangeText={(t) => set({ contactEmail: t })} placeholder="support@yourhackathon.com" autoCapitalize="none" keyboardType="email-address" />
              <FormField label="Discord server" value={form.discordLink} onChangeText={(t) => set({ discordLink: t })} placeholder="discord.gg/invite" autoCapitalize="none" />
              <FormField label="Website" value={form.websiteLink} onChangeText={(t) => set({ websiteLink: t })} placeholder="https://yourhackathon.com" autoCapitalize="none" keyboardType="url" />
            </Card>

            <SectionTitle title="Sponsors" icon="business-outline" />
            {sponsors.map((s, i) => (
              <Card key={i} padded style={{ marginBottom: 12 }}>
                <View className="flex-row items-center" style={{ gap: 12 }}>
                  <Pressable onPress={() => pickSponsorLogo(i)} accessibilityRole="button" accessibilityLabel="Pick sponsor logo" className="w-16 h-16 rounded-2xl bg-paper-2 border border-line items-center justify-center overflow-hidden active:opacity-85">
                    {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full" /> : <Ionicons name="image-outline" size={24} color={C.ink3} />}
                  </Pressable>
                  <FormField value={s.name} onChangeText={(t) => updateSponsor(i, 'name', t)} placeholder="Sponsor name" accessibilityLabel="Sponsor name" containerStyle={{ flex: 1 }} />
                  <IconBtn name="trash-outline" color={C.danger} size={18} onPress={() => removeSponsor(i)} accessibilityLabel="Remove sponsor" />
                </View>
                <TagRow style={{ marginTop: 12 }}>
                  {SPONSOR_LEVELS.map((lvl) => (
                    <Chip key={lvl} label={lvl} active={s.level === lvl} onPress={() => updateSponsor(i, 'level', lvl)} />
                  ))}
                </TagRow>
              </Card>
            ))}
            <Button small variant="tertiary" icon="add" title="Add sponsor" onPress={addSponsor} style={{ alignSelf: 'flex-start' }} />

            <SectionTitle title="Tracks" icon="layers-outline" />
            <Card padded>
              {tracks.map((t, i) => (
                <View key={i} className="bg-paper-2 rounded-2xl p-4 mb-3 border border-line" style={{ gap: 12 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <FormField value={t.title} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, title: val } : x))} placeholder="Track title" accessibilityLabel="Track title" containerStyle={{ flex: 1 }} />
                    <IconBtn name="close" color={C.danger} size={18} onPress={() => removeTrack(i)} accessibilityLabel="Remove track" />
                  </View>
                  <FormField value={t.description} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, description: val } : x))} placeholder="Track description" accessibilityLabel="Track description" multiline />
                  <FormField value={t.prizes} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, prizes: val } : x))} placeholder="Track prize (e.g. ₹50,000)" accessibilityLabel="Track prize" />
                </View>
              ))}
              <Button small variant="tertiary" icon="add" title="Add track" onPress={addTrack} style={{ alignSelf: 'flex-start' }} />
            </Card>

            <SectionTitle title="FAQs" icon="help-circle-outline" />
            <Card padded>
              {faqs.map((f, i) => (
                <View key={i} className="bg-paper-2 rounded-2xl p-4 mb-3 border border-line" style={{ gap: 12 }}>
                  <View className="flex-row items-center" style={{ gap: 8 }}>
                    <FormField value={f.question} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, question: val } : x))} placeholder="Question" accessibilityLabel="Question" containerStyle={{ flex: 1 }} />
                    <IconBtn name="close" color={C.danger} size={18} onPress={() => removeFaq(i)} accessibilityLabel="Remove question" />
                  </View>
                  <FormField value={f.answer} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, answer: val } : x))} placeholder="Answer" accessibilityLabel="Answer" multiline />
                </View>
              ))}
              <Button small variant="tertiary" icon="add" title="Add question" onPress={addFaq} style={{ alignSelf: 'flex-start' }} />
            </Card>

            <SectionTitle title="Prizes" icon="medal-outline" />
            <Card padded>
              {prizes.map((p, i) => (
                <View key={i} className="flex-row items-center mb-3" style={{ gap: 8 }}>
                  <View className="w-11 h-11 rounded-full bg-paper-2 items-center justify-center"><Text className="font-semibold text-ink text-sm">#{p.rank}</Text></View>
                  <FormField value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="Prize title" accessibilityLabel={`Prize ${p.rank} title`} containerStyle={{ flex: 1 }} />
                  <FormField value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="Amount" accessibilityLabel={`Prize ${p.rank} amount`} containerStyle={{ flex: 1 }} />
                </View>
              ))}
              <Button small variant="tertiary" icon="add" title="Add prize" onPress={addPrize} style={{ alignSelf: 'flex-start' }} />
            </Card>

            <Button
              variant="primary"
              block
              icon="rocket-outline"
              title={isEdit ? 'Save changes' : 'Create hackathon'}
              onPress={handleSubmit}
              loading={loading}
              style={{ marginTop: 32 }}
            />

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


