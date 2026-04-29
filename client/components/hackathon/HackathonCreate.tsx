import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';

const HackathonCreate = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);

  // Form State
  const [form, setForm] = useState({
    hackathonId: '',
    title: '',
    description: '',
    registrationstart: new Date(),
    registrationends: new Date(),
    hackathonstarts: new Date(),
    hackathonends: new Date(),
    prizepool: '',
    MaxTeamSize: '4',
    tags: '',
    contactEmail: '',
    discordLink: '',
    websiteLink: '',
  });

  // Complex Nested State
  const [eligibility, setEligibility] = useState({ Year: '', branch: '', colleges: '' });
  const [criteria, setCriteria] = useState([{ name: '', weightage: '0', description: '' }]);
  const [prizes, setPrizes] = useState([{ rank: 1, title: '', amount: '' }]);
  const [rules, setRules] = useState(['']);
  const [tracks, setTracks] = useState([{ title: '', description: '', prizes: '' }]);
  const [timeline, setTimeline] = useState([{ label: '', date: new Date(), description: '' }]);
  const [faqs, setFaqs] = useState([{ question: '', answer: '' }]);
  const [sponsors, setSponsors] = useState([{ name: '', level: 'Partner', logo: null as string | null }]);
  const [judges, setJudges] = useState<any[]>([]);
  const [mentors, setMentors] = useState<any[]>([]);

  // Search state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

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
        hackathonId: h.hackathonId,
        title: h.title,
        description: h.description,
        registrationstart: new Date(h.registrationstart),
        registrationends: new Date(h.registrationends),
        hackathonstarts: new Date(h.hackathonstarts),
        hackathonends: new Date(h.hackathonends),
        prizepool: h.prizepool || '',
        MaxTeamSize: h.MaxTeamSize?.toString() || '4',
        tags: h.tags?.join(', ') || '',
        contactEmail: h.contactEmail || '',
        discordLink: h.discordLink || '',
        websiteLink: h.websiteLink || '',
      });

      setEligibility({
        Year: h.eligibility?.Year?.join(', ') || '',
        branch: h.eligibility?.branch?.join(', ') || '',
        colleges: h.eligibility?.colleges?.join(', ') || '',
      });

      if (h.judgingcriteria?.length) setCriteria(h.judgingcriteria);
      if (h.prizes?.length) setPrizes(h.prizes);
      if (h.rules?.length) setRules(h.rules);
      if (h.tracks?.length) setTracks(h.tracks);
      if (h.timeline?.length) {
        setTimeline(h.timeline.map((t: any) => ({ ...t, date: new Date(t.date) })));
      }
      if (h.faqs?.length) setFaqs(h.faqs);
      if (h.sponsors?.length) setSponsors(h.sponsors);
      if (h.judges?.length) setJudges(h.judges);
      if (h.mentors?.length) setMentors(h.mentors);

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
    const currentValue = typeof id === 'string' ? (form as any)[id] : timeline[id].date;
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
      case 'registrationstart': return now;
      case 'registrationends': return form.registrationstart;
      case 'hackathonstarts': return form.registrationends;
      case 'hackathonends': return form.hackathonstarts;
      default: return now;
    }
  };

  const validateDates = () => {
    const { registrationstart, registrationends, hackathonstarts, hackathonends } = form;
    const now = new Date();

    if (registrationstart < new Date(now.getTime() - 5 * 60000)) { // 5 min grace
      Alert.alert('Timing Error', 'Registration cannot start in the past.');
      return false;
    }
    if (registrationends <= registrationstart) {
      Alert.alert('Timing Error', 'Registration must end after it starts.');
      return false;
    }
    if (hackathonstarts < registrationends) {
      Alert.alert('Timing Error', 'Hackathon must start after registration ends (or same time).');
      return false;
    }
    if (hackathonends <= hackathonstarts) {
      Alert.alert('Timing Error', 'Hackathon must end after it starts.');
      return false;
    }
    return true;
  };

  const addCriteria = () => setCriteria([...criteria, { name: '', weightage: '0', description: '' }]);
  const removeCriteria = (i: number) => setCriteria(criteria.filter((_, idx) => idx !== i));

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

  const searchUsers = async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await axios.get(`/user/search?q=${q}`);
      setSearchResults(res.data.users || []);
    } catch {
    } finally { setSearching(false); }
  };

  const addJudge = (user: any) => {
    if (!judges.find(j => j._id === user._id)) setJudges([...judges, user]);
    setUserSearch('');
    setSearchResults([]);
  };

  const addMentor = (user: any) => {
    if (!mentors.find(m => m._id === user._id)) setMentors([...mentors, user]);
    setUserSearch('');
    setSearchResults([]);
  };

  const handleSubmit = async () => {
    Keyboard?.dismiss?.();
    if (!form.hackathonId || !form.title) {
      Alert.alert('Error', 'Please fill in Hackathon ID and Title');
      return;
    }

    if (!validateDates()) return;

    setLoading(true);
    try {
      const formData = new FormData();

      // Basic fields
      Object.entries(form).forEach(([key, val]) => {
        if (val instanceof Date) formData.append(key, val.toISOString());
        else formData.append(key, String(val));
      });

      // Tags
      formData.append('tags', JSON.stringify(form.tags.split(',').map(tag => tag.trim()).filter(t => t)));

      // Complex fields
      formData.append('eligibility', JSON.stringify({
        Year: eligibility.Year.split(',').map(s => s.trim()).filter(s => s),
        branch: eligibility.branch.split(',').map(s => s.trim()).filter(s => s),
        colleges: eligibility.colleges.split(',').map(s => s.trim()).filter(s => s),
      }));
      formData.append('judgingcriteria', JSON.stringify(criteria.filter(c => c.name)));
      formData.append('prizes', JSON.stringify(prizes.filter(p => p.title)));
      formData.append('rules', JSON.stringify(rules.filter(r => r.trim())));
      formData.append('tracks', JSON.stringify(tracks.filter(t => t.title || t.description)));
      formData.append('timeline', JSON.stringify(timeline.filter(t => t.label || t.description).map(t => ({ ...t, date: t.date.toISOString() }))));
      formData.append('faqs', JSON.stringify(faqs.filter(f => f.question)));
      formData.append('judges', JSON.stringify(judges.map(j => j._id)));
      formData.append('mentors', JSON.stringify(mentors.map(m => m._id)));

      // Sponsors (images are handled separately)
      const sponsorsData = sponsors.filter(s => s.name).map((s, i) => ({
        name: s.name,
        level: s.level,
        index: i, // to track which file matches which sponsor
      }));
      formData.append('sponsors', JSON.stringify(sponsorsData));

      sponsors.forEach((s, i) => {
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
        Toast.show({ type: 'success', text1: 'Hackathon Reconfigured! 🛠️' });
      } else {
        await axios.post('/hackathons', formData, config);
        Toast.show({ type: 'success', text1: 'Hackathon Live! 🚀' });
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
      <View className="w-10 h-10 rounded-2xl bg-slate-50 border border-gray-100 items-center justify-center mr-3 shadow-sm">
        <Ionicons name={icon as any} size={18} color="#ec4899" />
      </View>
      <Text className="text-zinc-900 font-black  text-xl uppercase tracking-tighter">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-white">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="flex-row items-center px-8 py-6 border-b border-slate-50 bg-white">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 rounded-2xl bg-zinc-900 items-center justify-center mr-4 shadow-lg shadow-zinc-900/20">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-zinc-900 text-3xl font-black  uppercase tracking-tighter leading-7">Host</Text>
            <Text className="text-zinc-900 text-3xl font-black  uppercase tracking-tighter leading-7">Mission</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 150 }}>

            {/* Visual Assets */}
            <View className="flex-row gap-4 mt-8">
              <TouchableOpacity onPress={() => pickImage('logo')} className="w-28 h-28 rounded-[32px] bg-slate-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm">
                {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <View className="items-center"><Ionicons name="flash-outline" size={28} color="#94a3b8" /><Text className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Logo</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 h-28 rounded-[32px] bg-slate-50 border-2 border-dashed border-gray-200 items-center justify-center overflow-hidden shadow-sm">
                {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <View className="items-center"><Ionicons name="images-outline" size={28} color="#94a3b8" /><Text className="text-[8px] font-black uppercase tracking-widest text-slate-400 mt-1">Banner</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Basic Info */}
            {renderSectionHeader('Protocol Essentials', 'rocket')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              <TextInput value={form.hackathonId} onChangeText={(t) => setForm({ ...form, hackathonId: t })} placeholder="UNIQUE PROTOCOL ID (E.G. HACK-01)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100" />
              <TextInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="MISSION TITLE" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100" />
              <TextInput value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="MISSION BRIEFING & DESCRIPTION..." multiline numberOfLines={4} placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-[32px] px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-xs border border-gray-100 h-32" />
              <TextInput value={form.tags} onChangeText={(t) => setForm({ ...form, tags: t })} placeholder="TAGS (AI, BLOCKCHAIN...)" placeholderTextColor="#94a3b8" className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100" />
              <View className="flex-row gap-4">
                <TextInput value={form.prizepool} onChangeText={(t) => setForm({ ...form, prizepool: t })} placeholder="BOUNTY POOL" placeholderTextColor="#94a3b8" className="flex-[2] bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100" />
                <TextInput value={form.MaxTeamSize} onChangeText={(t) => setForm({ ...form, MaxTeamSize: t })} placeholder="MAX SQUAD" placeholderTextColor="#94a3b8" keyboardType="numeric" className="flex-1 bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100" />
              </View>
            </View>

            {/* Targeting / Eligibility */}
            {renderSectionHeader('Targeting & Eligibility', 'school')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              <TextInput
                value={eligibility.colleges}
                onChangeText={(t) => setEligibility({ ...eligibility, colleges: t })}
                placeholder="COLLEGE PROTOCOLS (COMMA SEP)"
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100"
              />
              <TextInput
                value={eligibility.Year}
                onChangeText={(t) => setEligibility({ ...eligibility, Year: t })}
                placeholder="TARGET YEARS (E.G. 1ST, 2ND)"
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 rounded-2xl px-6 py-4 mb-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100"
              />
              <TextInput
                value={eligibility.branch}
                onChangeText={(t) => setEligibility({ ...eligibility, branch: t })}
                placeholder="TARGET BRANCHES (CS, IT...)"
                placeholderTextColor="#94a3b8"
                className="bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-sm border border-gray-100"
              />
            </View>

            {/* Rules */}
            {renderSectionHeader('Commandments', 'list')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {rules.map((rule, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-3">
                  <TextInput value={rule} onChangeText={(t) => setRules(rules.map((r, idx) => idx === i ? t : r))} placeholder={`RULE #${i + 1}`} placeholderTextColor="#94a3b8" className="flex-1 bg-slate-50 rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-xs border border-gray-100" />
                  <TouchableOpacity onPress={() => removeRule(i)} className="bg-slate-50 p-3 rounded-xl border border-gray-100"><Ionicons name="trash" size={16} color="#f43f5e" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addRule} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-100 rounded-2xl mt-2">
                <Ionicons name="add" size={20} color="#ec4899" />
                <Text className="text-pink-500 font-black  uppercase tracking-widest ml-2 text-[10px]">Append Commandment</Text>
              </TouchableOpacity>
            </View>

            {/* Timeline */}
            {renderSectionHeader('Event Roadmap / Timeline', 'time')}
            <View className="mb-8">
              <Text className="text-slate-400 text-[10px] font-bold mb-4 px-2 uppercase tracking-widest">Construct the journey for your participants (e.g. Kickoff, Workshops, Submission, Results)</Text>
              {timeline.map((item, i) => (
                <View key={i} className="bg-slate-50 rounded-3xl p-5 mb-4 border border-gray-100 shadow-sm shadow-black/[0.02]">
                  <TextInput value={item.label} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, label: t } : x))} placeholder="STAGE NAME (E.G. SEMI-FINALS)" placeholderTextColor="#94a3b8" className="text-zinc-900 font-black  uppercase text-xs mb-3" />
                  <TouchableOpacity onPress={() => triggerPicker(i)} className="bg-white rounded-xl px-4 py-3 mb-3 border border-gray-100 flex-row justify-between items-center">
                    <Text className="text-slate-400 font-black uppercase text-[10px]">Date & Time</Text>
                    <Text className="text-zinc-900 font-black  uppercase text-[10px]">{item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                  <TextInput value={item.description} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="BRIEF INTEL ABOUT THIS STAGE" placeholderTextColor="#94a3b8" multiline className="text-slate-500 text-xs leading-4" />
                  <TouchableOpacity onPress={() => setTimeline(timeline.filter((_, idx) => idx !== i))} className="mt-4 self-end">
                    <Ionicons name="trash" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setTimeline([...timeline, { label: '', date: new Date(), description: '' }])} className="border-2 border-dashed border-slate-200 rounded-3xl p-5 items-center">
                <Text className="text-slate-400 font-black  uppercase text-[10px]">Add Milestone Protocol +</Text>
              </TouchableOpacity>
            </View>

            {/* Dates (Global) */}
            {renderSectionHeader('Base Window', 'calendar')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm mb-8">
              {['registrationstart', 'registrationends', 'hackathonstarts', 'hackathonends'].map((field) => (
                <TouchableOpacity key={field} onPress={() => triggerPicker(field)} className="flex-row items-center justify-between bg-zinc-900 rounded-2xl px-6 py-4 mb-3 border border-zinc-800">
                  <Text className="text-slate-500 font-black uppercase text-[9px] tracking-widest">{field.replace(/([A-Z])/g, ' $1')}</Text>
                  <Text className="text-white font-black  uppercase tracking-tight text-xs">{(form as any)[field].toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contact Portal */}
            {renderSectionHeader('Contact & Portal Signals', 'mail')}
            <View className="bg-slate-50 rounded-[40px] p-8 mb-8 border border-gray-100">
              <View className="mb-6">
                <Text className="text-slate-400 font-black uppercase text-[9px] mb-3 tracking-widest px-2">Official Contact Email</Text>
                <TextInput value={form.contactEmail} onChangeText={t => setForm({ ...form, contactEmail: t })} placeholder="SUPPORT@MISSION.COM" placeholderTextColor="#94a3b8" className="bg-white rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-xs border border-gray-100" />
              </View>
              <View className="mb-6">
                <Text className="text-slate-400 font-black uppercase text-[9px] mb-3 tracking-widest px-2">Discord Server Signal</Text>
                <TextInput value={form.discordLink} onChangeText={t => setForm({ ...form, discordLink: t })} placeholder="DISCORD.GG/INVITE" placeholderTextColor="#94a3b8" className="bg-white rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-xs border border-gray-100" />
              </View>
              <View>
                <Text className="text-slate-400 font-black uppercase text-[9px] mb-3 tracking-widest px-2">External Protocol Website</Text>
                <TextInput value={form.websiteLink} onChangeText={t => setForm({ ...form, websiteLink: t })} placeholder="HTTPS://MISSION.FYNC.COM" placeholderTextColor="#94a3b8" className="bg-white rounded-2xl px-6 py-4 text-zinc-900 font-black  uppercase text-xs border border-gray-100" />
              </View>
            </View>

            {/* Sponsors */}
            {renderSectionHeader('Sponsors / Partners', 'business')}
            <View className="mb-8">
              {sponsors.map((s, i) => (
                <View key={i} className="bg-slate-50 rounded-3xl p-6 mb-4 border border-gray-100">
                  <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={() => pickSponsorLogo(i)} className="w-16 h-16 rounded-2xl bg-white border border-gray-100 items-center justify-center mr-4 shadow-sm">
                      {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full rounded-2xl" /> : <Ionicons name="image" size={24} color="#CBD5E1" />}
                    </TouchableOpacity>
                    <View className="flex-1">
                      <TextInput value={s.name} onChangeText={(t) => updateSponsor(i, 'name', t)} placeholder="SPONSOR NAME" placeholderTextColor="#94a3b8" className="text-zinc-900 font-black  uppercase text-xs mb-2" />
                      <View className="flex-row">
                        {['Title', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'].slice(0, 3).map(lvl => (
                          <TouchableOpacity key={lvl} onPress={() => updateSponsor(i, 'level', lvl)} className={`px-3 py-1 rounded-lg border mr-2 ${s.level === lvl ? 'bg-zinc-900 border-zinc-900' : 'bg-white border-gray-100'}`}>
                            <Text className={`text-[8px] font-black uppercase ${s.level === lvl ? 'text-white' : 'text-slate-400'}`}>{lvl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeSponsor(i)} className="ml-2">
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={addSponsor} className="border-2 border-dashed border-slate-200 rounded-3xl p-5 items-center">
                <Text className="text-slate-400 font-black  uppercase text-[10px]">Onboard Sponsor +</Text>
              </TouchableOpacity>
            </View>

            {/* Judges & Mentors */}
            {renderSectionHeader('Judges & Mentors', 'people')}
            <View className="mb-8">
              <View className="bg-zinc-900 rounded-[32px] p-6 mb-2">
                <Text className="text-pink-500 font-black uppercase text-[10px] mb-4 tracking-widest">Assign Protocol Officials</Text>
                <View className="flex-row items-center bg-zinc-800 rounded-2xl px-4 py-3 mb-4">
                  <Ionicons name="search" size={16} color="#ec4899" />
                  <TextInput
                    value={userSearch}
                    onChangeText={searchUsers}
                    placeholder="SEARCH BY EMAIL OR NAME..."
                    placeholderTextColor="#4b5563"
                    className="flex-1 ml-3 text-white font-black  uppercase text-xs"
                  />
                  {searching && <ActivityIndicator size="small" color="#ec4899" />}
                </View>

                {searchResults.length > 0 && (
                  <View className="bg-zinc-800 rounded-2xl overflow-hidden mb-4 border border-zinc-700">
                    {searchResults.slice(0, 5).map((u, i) => (
                      <View key={i} className="flex-row items-center justify-between p-4 border-b border-zinc-700">
                        <View className="flex-row items-center">
                          {u.avatar ? <Image source={{ uri: u.avatar }} className="w-8 h-8 rounded-full" /> : <View className="w-8 h-8 rounded-full bg-zinc-700 items-center justify-center"><Ionicons name="person" size={12} color="#4b5563" /></View>}
                          <View className="ml-3">
                            <Text className="text-white font-black text-[10px]">{u.name}</Text>
                            <Text className="text-zinc-500 text-[8px]">{u.email}</Text>
                          </View>
                        </View>
                        <View className="flex-row">
                          <TouchableOpacity onPress={() => addJudge(u)} className="bg-pink-500 px-3 py-1.5 rounded-lg mr-2"><Text className="text-white font-black text-[8px] uppercase">Judge</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => addMentor(u)} className="bg-indigo-500 px-3 py-1.5 rounded-lg"><Text className="text-white font-black text-[8px] uppercase">Mentor</Text></TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View className="flex-row flex-wrap gap-2">
                  {judges.map((j, idx) => (
                    <View key={idx} className="bg-zinc-800 flex-row items-center pl-2 pr-3 py-2 rounded-xl border border-pink-500/30">
                      <Text className="text-pink-500 font-black text-[9px] uppercase mr-2">Judge:</Text>
                      <Text className="text-white font-bold text-[9px]">{j.name}</Text>
                      <TouchableOpacity onPress={() => setJudges(judges.filter((_, i) => i !== idx))} className="ml-2">
                        <Ionicons name="close-circle" size={14} color="#4b5563" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {mentors.map((m, idx) => (
                    <View key={idx} className="bg-zinc-800 flex-row items-center pl-2 pr-3 py-2 rounded-xl border border-indigo-500/30">
                      <Text className="text-indigo-500 font-black text-[9px] uppercase mr-2">Mentor:</Text>
                      <Text className="text-white font-bold text-[9px]">{m.name}</Text>
                      <TouchableOpacity onPress={() => setMentors(mentors.filter((_, i) => i !== idx))} className="ml-2">
                        <Ionicons name="close-circle" size={14} color="#4b5563" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Tracks */}
            {renderSectionHeader('Strategic Tracks', 'layers')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {tracks.map((t, i) => (
                <View key={i} className="bg-slate-50 rounded-3xl p-5 mb-4 border border-gray-100">
                  <TextInput value={t.title} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, title: val } : x))} placeholder="TRACK TITLE" placeholderTextColor="#94a3b8" className="text-zinc-900 font-black  uppercase text-xs mb-3" />
                  <TextInput value={t.description} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, description: val } : x))} placeholder="TRACK INTEL..." multiline placeholderTextColor="#94a3b8" className="bg-white rounded-xl px-4 py-3 text-zinc-900 font-black  uppercase text-[10px] border border-gray-100 mb-3 h-20" />
                  <TextInput value={t.prizes} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, prizes: val } : x))} placeholder="TRACK BOUNTY (E.G. $500)" placeholderTextColor="#94a3b8" className="bg-white rounded-xl px-4 py-3 text-emerald-600 font-black  uppercase text-[10px] border border-emerald-50" />
                  <TouchableOpacity onPress={() => removeTrack(i)} className="absolute -top-2 -right-2 bg-white w-8 h-8 rounded-full items-center justify-center border border-gray-100 shadow-sm"><Ionicons name="close" size={16} color="#f43f5e" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addTrack} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-100 rounded-2xl">
                <Ionicons name="add" size={20} color="#ec4899" />
                <Text className="text-pink-500 font-black  uppercase tracking-widest ml-2 text-[10px]">Append Mission Track</Text>
              </TouchableOpacity>
            </View>

            {/* FAQs */}
            {renderSectionHeader('Knowledge Base', 'help-circle')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {faqs.map((f, i) => (
                <View key={i} className="bg-slate-50 rounded-3xl p-5 mb-4 border border-gray-100">
                  <TextInput value={f.question} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, question: val } : x))} placeholder="QUERY PROTOCOL" placeholderTextColor="#94a3b8" className="text-zinc-900 font-black  uppercase text-xs mb-3" />
                  <TextInput value={f.answer} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, answer: val } : x))} placeholder="AUTHORISED ANSWER..." multiline placeholderTextColor="#94a3b8" className="bg-white rounded-xl px-4 py-3 text-slate-500 font-black uppercase text-[9px] border border-gray-100 h-20" />
                  <TouchableOpacity onPress={() => removeFaq(i)} className="absolute -top-2 -right-2 bg-white w-8 h-8 rounded-full items-center justify-center border border-gray-100 shadow-sm"><Ionicons name="close" size={16} color="#f43f5e" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addFaq} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-100 rounded-2xl">
                <Ionicons name="add" size={20} color="#ec4899" />
                <Text className="text-pink-500 font-black  uppercase tracking-widest ml-2 text-[10px]">Add Query Signal</Text>
              </TouchableOpacity>
            </View>

            {/* Rewards */}
            {renderSectionHeader('Bounty Tiers', 'medal')}
            <View className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-sm">
              {prizes.map((p, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-xl bg-zinc-900 items-center justify-center border border-zinc-800 shadow-sm"><Text className="font-black text-white  text-[10px]">#{p.rank}</Text></View>
                  <TextInput value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="BOUNTY TITLE" placeholderTextColor="#94a3b8" className="flex-1 bg-slate-50 rounded-2xl px-5 py-3 font-black  uppercase text-xs text-zinc-900 border border-gray-100" />
                  <TextInput value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="Σ AMT" placeholderTextColor="#94a3b8" className="flex-1 bg-slate-50 rounded-2xl px-5 py-3 font-black  uppercase text-xs text-zinc-900 border border-gray-100" />
                </View>
              ))}
              <TouchableOpacity onPress={addPrize} className="flex-row items-center justify-center p-4 border-2 border-dashed border-gray-100 rounded-2xl mt-2">
                <Ionicons name="add" size={20} color="#ec4899" />
                <Text className="text-pink-500 font-black  uppercase tracking-widest ml-2 text-[10px]">Extend Bounty List</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="mt-12 overflow-hidden rounded-[32px] shadow-2xl shadow-pink-500/20">
              <LinearGradient colors={['#ec4899', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} className="py-6 items-center justify-center flex-row">
                {loading ? <ActivityIndicator size="small" color="white" /> : (
                  <>
                    <Text className="text-white font-black  uppercase tracking-[2px] mr-3 text-lg">Initiate Mission</Text>
                    <Ionicons name="rocket" size={24} color="white" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {Platform.OS === 'ios' && showPicker !== null && (
        <DateTimePicker
          value={typeof showPicker === 'string' ? (form as any)[showPicker] : (timeline[showPicker].date)}
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


