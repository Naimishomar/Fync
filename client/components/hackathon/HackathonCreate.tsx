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
        <Ionicons name={icon as any} size={18} color="#F97316" />
      </View>
      <Text className="text-ink font-display text-xl">{title}</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="flex-row items-center px-gutter py-6 border-b border-line bg-card">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text className="text-ink text-3xl font-display leading-7">Host</Text>
            <Text className="text-ink text-3xl font-display leading-7">Mission</Text>
          </View>
        </View>

        <KeyboardAvoidingView behavior="padding" className="flex-1">
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}>

            {/* Visual Assets */}
            <View className="flex-row gap-4 mt-8">
              <TouchableOpacity onPress={() => pickImage('logo')} className="w-28 h-28 rounded-sheet bg-paper-2 border-2 border-dashed border-line items-center justify-center overflow-hidden shadow-hair">
                {logo ? <Image source={{ uri: logo }} className="w-full h-full" /> : <View className="items-center"><Ionicons name="flash-outline" size={28} color="#8B857E" /><Text className="text-label font-semibold text-ink-3 mt-1">Logo</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => pickImage('banner')} className="flex-1 h-28 rounded-sheet bg-paper-2 border-2 border-dashed border-line items-center justify-center overflow-hidden shadow-hair">
                {bannerImage ? <Image source={{ uri: bannerImage }} className="w-full h-full" resizeMode="cover" /> : <View className="items-center"><Ionicons name="images-outline" size={28} color="#8B857E" /><Text className="text-label font-semibold text-ink-3 mt-1">Banner</Text></View>}
              </TouchableOpacity>
            </View>

            {/* Basic Info */}
            {renderSectionHeader('Protocol Essentials', 'rocket')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              <TextInput value={form.hackathonId} onChangeText={(t) => setForm({ ...form, hackathonId: t })} placeholder="Unique id (e.g. hack-01)" placeholderTextColor="#8B857E" className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line" />
              <TextInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Hackathon title" placeholderTextColor="#8B857E" className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line" />
              <TextInput value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} placeholder="What is this hackathon about?" multiline numberOfLines={4} placeholderTextColor="#8B857E" className="bg-paper-2 rounded-sheet px-6 py-4 mb-4 text-ink font-semibold text-xs border border-line h-32" />
              <TextInput value={form.tags} onChangeText={(t) => setForm({ ...form, tags: t })} placeholder="Tags (ai, blockchain…)" placeholderTextColor="#8B857E" className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line" />
              <View className="flex-row gap-4">
                <TextInput value={form.prizepool} onChangeText={(t) => setForm({ ...form, prizepool: t })} placeholder="Prize pool" placeholderTextColor="#8B857E" className="flex-[2] bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line" />
                <TextInput value={form.MaxTeamSize} onChangeText={(t) => setForm({ ...form, MaxTeamSize: t })} placeholder="Max team size" placeholderTextColor="#8B857E" keyboardType="numeric" className="flex-1 bg-paper rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line" />
              </View>
            </View>

            {/* Targeting / Eligibility */}
            {renderSectionHeader('Targeting & Eligibility', 'school')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              <TextInput
                value={eligibility.colleges}
                onChangeText={(t) => setEligibility({ ...eligibility, colleges: t })}
                placeholder="Colleges (comma separated)"
                placeholderTextColor="#8B857E"
                className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line"
              />
              <TextInput
                value={eligibility.Year}
                onChangeText={(t) => setEligibility({ ...eligibility, Year: t })}
                placeholder="Years (e.g. 1st, 2nd)"
                placeholderTextColor="#8B857E"
                className="bg-paper-2 rounded-card px-6 py-4 mb-4 text-ink font-semibold text-sm border border-line"
              />
              <TextInput
                value={eligibility.branch}
                onChangeText={(t) => setEligibility({ ...eligibility, branch: t })}
                placeholder="Branches (cs, it…)"
                placeholderTextColor="#8B857E"
                className="bg-paper-2 rounded-card px-6 py-4 text-ink font-semibold text-sm border border-line"
              />
            </View>

            {/* Rules */}
            {renderSectionHeader('Rules', 'list')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {rules.map((rule, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-3">
                  <TextInput value={rule} onChangeText={(t) => setRules(rules.map((r, idx) => idx === i ? t : r))} placeholder={`Rule ${i + 1}`} placeholderTextColor="#8B857E" className="flex-1 bg-paper rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
                  <TouchableOpacity onPress={() => removeRule(i)} className="bg-paper-2 p-3 rounded-xl border border-line"><Ionicons name="trash" size={16} color="#DC2626" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addRule} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card mt-2">
                <Ionicons name="add" size={20} color="#F97316" />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add rule</Text>
              </TouchableOpacity>
            </View>

            {/* Timeline */}
            {renderSectionHeader('Event Roadmap / Timeline', 'time')}
            <View className="mb-8">
              <Text className="text-ink-3 text-label font-semibold mb-4 px-2">Construct the journey for your participants (e.g. Kickoff, Workshops, Submission, Results)</Text>
              {timeline.map((item, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line shadow-hair /[0.02]">
                  <TextInput value={item.label} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, label: t } : x))} placeholder="Stage name (e.g. semi-finals)" placeholderTextColor="#8B857E" className="text-ink font-semibold text-xs mb-3" />
                  <TouchableOpacity onPress={() => triggerPicker(i)} className="bg-card rounded-xl px-4 py-3 mb-3 border border-line flex-row justify-between items-center">
                    <Text className="text-ink-3 font-semibold text-label">Date & Time</Text>
                    <Text className="text-ink font-semibold text-label">{item.date.toLocaleDateString()} {item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </TouchableOpacity>
                  <TextInput value={item.description} onChangeText={(t) => setTimeline(timeline.map((x, idx) => idx === i ? { ...x, description: t } : x))} placeholder="What happens in this stage?" placeholderTextColor="#8B857E" multiline className="text-ink-3 text-xs leading-4" />
                  <TouchableOpacity onPress={() => setTimeline(timeline.filter((_, idx) => idx !== i))} className="mt-4 self-end">
                    <Ionicons name="trash" size={16} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={() => setTimeline([...timeline, { label: '', date: new Date(), description: '' }])} className="border-2 border-dashed border-line rounded-card p-5 items-center">
                <Text className="text-ink-3 font-semibold text-label">Add milestone +</Text>
              </TouchableOpacity>
            </View>

            {/* Dates (Global) */}
            {renderSectionHeader('Base Window', 'calendar')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair mb-8">
              {['registrationstart', 'registrationends', 'hackathonstarts', 'hackathonends'].map((field) => (
                <TouchableOpacity key={field} onPress={() => triggerPicker(field)} className="flex-row items-center justify-between bg-ink rounded-card px-6 py-4 mb-3 border border-ink">
                  <Text className="text-ink-3 font-semibold text-label">{field.replace(/([A-Z])/g, ' $1')}</Text>
                  <Text className="text-white font-semibold text-xs">{(form as any)[field].toLocaleDateString()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Contact Portal */}
            {renderSectionHeader('Contact & Portal Signals', 'mail')}
            <View className="bg-paper-2 rounded-sheet p-card-pad mb-8 border border-line">
              <View className="mb-6">
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Official Contact Email</Text>
                <TextInput value={form.contactEmail} onChangeText={t => setForm({ ...form, contactEmail: t })} placeholder="support@yourhackathon.com" placeholderTextColor="#8B857E" className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
              <View className="mb-6">
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Discord server</Text>
                <TextInput value={form.discordLink} onChangeText={t => setForm({ ...form, discordLink: t })} placeholder="discord.gg/invite" placeholderTextColor="#8B857E" className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
              <View>
                <Text className="text-ink-3 font-semibold text-label mb-3 px-2">Website</Text>
                <TextInput value={form.websiteLink} onChangeText={t => setForm({ ...form, websiteLink: t })} placeholder="https://yourhackathon.com" placeholderTextColor="#8B857E" className="bg-card rounded-card px-6 py-4 text-ink font-semibold text-xs border border-line" />
              </View>
            </View>

            {/* Sponsors */}
            {renderSectionHeader('Sponsors / Partners', 'business')}
            <View className="mb-8">
              {sponsors.map((s, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-6 mb-4 border border-line">
                  <View className="flex-row items-center mb-4">
                    <TouchableOpacity onPress={() => pickSponsorLogo(i)} className="w-16 h-16 rounded-card bg-card border border-line items-center justify-center mr-4 shadow-hair">
                      {s.logo ? <Image source={{ uri: s.logo }} className="w-full h-full rounded-card" /> : <Ionicons name="image" size={24} color="#C4BEB6" />}
                    </TouchableOpacity>
                    <View className="flex-1">
                      <TextInput value={s.name} onChangeText={(t) => updateSponsor(i, 'name', t)} placeholder="Sponsor name" placeholderTextColor="#8B857E" className="text-ink font-semibold text-xs mb-2" />
                      <View className="flex-row">
                        {['Title', 'Platinum', 'Gold', 'Silver', 'Bronze', 'Partner'].slice(0, 3).map(lvl => (
                          <TouchableOpacity key={lvl} onPress={() => updateSponsor(i, 'level', lvl)} className={`px-3 py-1 rounded-lg border mr-2 ${s.level === lvl ? 'bg-ink border-ink' : 'bg-card border-line'}`}>
                            <Text className={`text-label font-semibold ${s.level === lvl ? 'text-white' : 'text-ink-3'}`}>{lvl}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => removeSponsor(i)} className="ml-2">
                      <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={addSponsor} className="border-2 border-dashed border-line rounded-card p-5 items-center">
                <Text className="text-ink-3 font-semibold text-label">Onboard Sponsor +</Text>
              </TouchableOpacity>
            </View>

            {/* Judges & Mentors */}
            {renderSectionHeader('Judges & Mentors', 'people')}
            <View className="mb-8">
              <View className="bg-ink rounded-sheet p-6 mb-2">
                <Text className="text-brand-600 font-semibold text-label mb-4">Assign judges and mentors</Text>
                <View className="flex-row items-center bg-ink rounded-card px-4 py-3 mb-4">
                  <Ionicons name="search" size={16} color="#F97316" />
                  <TextInput
                    value={userSearch}
                    onChangeText={searchUsers}
                    placeholder="Search by email or name"
                    placeholderTextColor="#8B857E"
                    className="flex-1 ml-3 text-white font-semibold text-xs"
                  />
                  {searching && <ActivityIndicator size="small" color="#F97316" />}
                </View>

                {searchResults.length > 0 && (
                  <View className="bg-ink rounded-card overflow-hidden mb-4 border border-ink">
                    {searchResults.slice(0, 5).map((u, i) => (
                      <View key={i} className="flex-row items-center justify-between p-4 border-b border-ink">
                        <View className="flex-row items-center">
                          {u.avatar ? <Image source={{ uri: u.avatar }} className="w-8 h-8 rounded-full" /> : <View className="w-8 h-8 rounded-full bg-ink items-center justify-center"><Ionicons name="person" size={12} color="#8B857E" /></View>}
                          <View className="ml-3">
                            <Text className="font-display text-label text-white uppercase">{u.name}</Text>
                            <Text className="text-ink-3 text-label">{u.email}</Text>
                          </View>
                        </View>
                        <View className="flex-row">
                          <TouchableOpacity onPress={() => addJudge(u)} className="bg-brand-500 mr-2 px-2.5 py-1 rounded-full"><Text className="text-ink font-semibold text-label">Judge</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => addMentor(u)} className="bg-ink px-2.5 py-1 rounded-full"><Text className="font-display text-label text-white uppercase">Mentor</Text></TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View className="flex-row flex-wrap gap-2">
                  {judges.map((j, idx) => (
                    <View key={idx} className="bg-ink flex-row items-center pl-2 pr-3 py-2 rounded-xl border border-brand-500/30">
                      <Text className="text-brand-600 font-semibold text-label mr-2">Judge:</Text>
                      <Text className="font-display text-label text-white uppercase">{j.name}</Text>
                      <TouchableOpacity onPress={() => setJudges(judges.filter((_, i) => i !== idx))} className="ml-2">
                        <Ionicons name="close-circle" size={14} color="#8B857E" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {mentors.map((m, idx) => (
                    <View key={idx} className="bg-ink flex-row items-center pl-2 pr-3 py-2 rounded-xl border border-brand-500/30">
                      <Text className="text-brand-600 font-semibold text-label mr-2">Mentor:</Text>
                      <Text className="font-display text-label text-white uppercase">{m.name}</Text>
                      <TouchableOpacity onPress={() => setMentors(mentors.filter((_, i) => i !== idx))} className="ml-2">
                        <Ionicons name="close-circle" size={14} color="#8B857E" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Tracks */}
            {renderSectionHeader('Strategic Tracks', 'layers')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {tracks.map((t, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line">
                  <TextInput value={t.title} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, title: val } : x))} placeholder="Track title" placeholderTextColor="#8B857E" className="text-ink font-semibold text-xs mb-3" />
                  <TextInput value={t.description} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, description: val } : x))} placeholder="Track description" multiline placeholderTextColor="#8B857E" className="bg-card rounded-xl px-4 py-3 text-ink font-semibold text-label border border-line mb-3 h-20" />
                  <TextInput value={t.prizes} onChangeText={(val) => setTracks(tracks.map((x, idx) => idx === i ? { ...x, prizes: val } : x))} placeholder="Track prize (e.g. ₹50,000)" placeholderTextColor="#8B857E" className="bg-card rounded-xl px-4 py-3 text-success font-semibold text-label border border-success/10" />
                  <TouchableOpacity onPress={() => removeTrack(i)} className="absolute -top-2 -right-2 bg-card w-8 h-8 rounded-full items-center justify-center border border-line shadow-hair"><Ionicons name="close" size={16} color="#DC2626" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addTrack} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card">
                <Ionicons name="add" size={20} color="#F97316" />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add track</Text>
              </TouchableOpacity>
            </View>

            {/* FAQs */}
            {renderSectionHeader('Knowledge Base', 'help-circle')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {faqs.map((f, i) => (
                <View key={i} className="bg-paper-2 rounded-card p-5 mb-4 border border-line">
                  <TextInput value={f.question} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, question: val } : x))} placeholder="Question" placeholderTextColor="#8B857E" className="text-ink font-semibold text-xs mb-3" />
                  <TextInput value={f.answer} onChangeText={(val) => setFaqs(faqs.map((x, idx) => idx === i ? { ...x, answer: val } : x))} placeholder="Answer" multiline placeholderTextColor="#8B857E" className="bg-card rounded-xl px-4 py-3 text-ink-3 font-semibold text-label border border-line h-20" />
                  <TouchableOpacity onPress={() => removeFaq(i)} className="absolute -top-2 -right-2 bg-card w-8 h-8 rounded-full items-center justify-center border border-line shadow-hair"><Ionicons name="close" size={16} color="#DC2626" /></TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity onPress={addFaq} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card">
                <Ionicons name="add" size={20} color="#F97316" />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add question</Text>
              </TouchableOpacity>
            </View>

            {/* Rewards */}
            {renderSectionHeader('Bounty Tiers', 'medal')}
            <View className="bg-card rounded-sheet p-6 border border-line shadow-hair">
              {prizes.map((p, i) => (
                <View key={i} className="flex-row items-center gap-3 mb-4">
                  <View className="w-10 h-10 rounded-xl bg-ink items-center justify-center border border-ink shadow-hair"><Text className="font-semibold text-white text-label">#{p.rank}</Text></View>
                  <TextInput value={p.title} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, title: t } : x))} placeholder="Prize title" placeholderTextColor="#8B857E" className="flex-1 bg-paper rounded-card px-5 py-3 font-semibold text-xs text-ink border border-line" />
                  <TextInput value={p.amount} onChangeText={(t) => setPrizes(prizes.map((x, idx) => idx === i ? { ...x, amount: t } : x))} placeholder="Amount" placeholderTextColor="#8B857E" className="flex-1 bg-paper rounded-card px-5 py-3 font-semibold text-xs text-ink border border-line" />
                </View>
              ))}
              <TouchableOpacity onPress={addPrize} className="flex-row items-center justify-center p-4 border-2 border-dashed border-line rounded-card mt-2">
                <Ionicons name="add" size={20} color="#F97316" />
                <Text className="text-brand-600 font-semibold ml-2 text-label">Add prize</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleSubmit} disabled={loading} className="mt-12 overflow-hidden rounded-sheet shadow-hair">
              <View className="py-6 items-center justify-center flex-row" style={{ backgroundColor: '#F97316' }}>
                {loading ? <ActivityIndicator size="small" color="#12100E" /> : (
                  <>
                    <Text className="text-ink font-display mr-3 text-lg">Create hackathon</Text>
                    <Ionicons name="rocket" size={24} color="#12100E" />
                  </>
                )}
              </View>
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


