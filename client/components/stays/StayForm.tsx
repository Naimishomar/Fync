import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { compressImage } from '../../utils/mediaUpload';
import { AppBar, BottomBar, Button, Chip, FilterChips, Label, Screen, SegmentedTabs, TagRow } from '../ui/kit';
import Skeleton from '../Skeleton';
import { FormField } from '../ui/Field';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { buzz } from '../ui/motion';
import { AMENITY_LABEL, FOOD_LABEL, GENDER_LABEL, HABIT_LABEL, KIND_LABEL, Kind } from './StayFinder';

const KINDS = Object.keys(KIND_LABEL) as Kind[];
const GENDERS = Object.keys(GENDER_LABEL) as (keyof typeof GENDER_LABEL)[];
const FOODS = Object.keys(FOOD_LABEL) as (keyof typeof FOOD_LABEL)[];
const MAX_PHOTOS = 4;
// A photo is either already on the server (url) or picked on this device (local uri).
type Photo = { url?: string; uri?: string };
const BLANK = {
  kind: 'pg' as Kind, title: '', rent: '', deposit: '', area: '', distanceKm: '',
  forGender: 'any' as (typeof GENDERS)[number], food: 'none' as (typeof FOODS)[number], amenities: [] as string[],
  moveIn: null as Date | null, budget: '', habits: [] as string[], description: '',
};
const str = (n: unknown) => (n == null ? '' : String(n));

/** Mirrors backend/utils/stayRules.js parseStay, so most mistakes never leave the phone. */
const validate = (f: typeof BLANK) => {
  const e: Record<string, string> = {};
  if (f.title.trim().length < 3) e.title = 'At least 3 characters';
  const rent = Number(f.rent);
  if (!Number.isInteger(rent) || rent < 500 || rent > 200000) e.rent = '₹500 to ₹2,00,000';
  if (f.deposit && !(Number.isInteger(Number(f.deposit)) && Number(f.deposit) >= 0)) e.deposit = 'Whole rupees only';
  if (f.area.trim().length < 2) e.area = 'Which area or locality?';
  if (f.distanceKm && !(Number(f.distanceKm) >= 0 && Number(f.distanceKm) <= 50)) e.distanceKm = '0 to 50 km';
  if (f.kind === 'roommate' && f.budget) {
    const b = Number(f.budget);
    if (!Number.isInteger(b) || b < 500 || b > 200000) e.budget = '₹500 to ₹2,00,000';
  }
  return e;
};

const FormSkeleton = () => (
  <View style={{ paddingHorizontal: 20, gap: 12 }}>
    <Skeleton lightMode width={160} height={14} />
    <Skeleton lightMode height={44} borderRadius={22} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} lightMode height={76} borderRadius={12} style={{ flex: 1 }} />)}
    </View>
    {[0, 1, 2].map((i) => <Skeleton key={i} lightMode height={48} borderRadius={16} style={{ marginTop: 12 }} />)}
  </View>
);

export default function StayForm() {
  const navigation = useNavigation<any>();
  const id = (useRoute<any>().params as { id?: string } | undefined)?.id;
  const [form, setForm] = useState(BLANK);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<typeof BLANK>) => setForm((f) => ({ ...f, ...p }));
  const toggle = (key: 'amenities' | 'habits', v: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] }));

  useEffect(() => {
    if (!id) return;
    axios.get(`/stays/${id}`, { params: { noCache: true } }).then((res) => {
      const s = res.data?.stay;
      if (!s) return;
      setForm({
        kind: s.kind, title: s.title, rent: str(s.rent), deposit: str(s.deposit), area: s.area, distanceKm: str(s.distanceKm),
        forGender: s.forGender, food: s.food, amenities: s.amenities || [], moveIn: s.moveIn ? new Date(s.moveIn) : null,
        budget: str(s.budget), habits: s.habits || [], description: s.description || '',
      });
      setPhotos((s.photos || []).map((url: string) => ({ url })));
    }).catch(() => Toast.show({ type: 'error', text1: 'Could not load listing' })).finally(() => setLoading(false));
  }, [id]);

  const errors = validate(form);
  const err = (k: string) => (tried ? errors[k] : undefined);

  const pick = async () => {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: room, quality: 0.9,
    });
    if (res.canceled) return;
    setPhotos((p) => [...p, ...res.assets.slice(0, room).map((a) => ({ uri: a.uri }))].slice(0, MAX_PHOTOS));
  };

  const submit = async () => {
    setTried(true);
    if (Object.keys(errors).length) return Toast.show({ type: 'error', text1: 'Check the highlighted fields' });
    setSaving(true);
    try {
      const fd = new FormData();
      const fields: Record<string, string> = {
        kind: form.kind, title: form.title.trim(), rent: form.rent, deposit: form.deposit, area: form.area.trim(),
        distanceKm: form.distanceKm, forGender: form.forGender, food: form.food, amenities: form.amenities.join(','),
        description: form.description.trim(),
        moveIn: form.kind === 'roommate' && form.moveIn ? form.moveIn.toISOString() : '',
        budget: form.kind === 'roommate' ? form.budget : '', habits: form.kind === 'roommate' ? form.habits.join(',') : '',
      };
      Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
      if (id) fd.append('keep', photos.filter((p) => p.url).map((p) => p.url).join(','));
      for (const p of photos) {
        if (!p.uri) continue;
        const uri = await compressImage(p.uri);
        fd.append('photos', { uri, name: uri.split('/').pop() || 'stay.jpg', type: uri.endsWith('.png') ? 'image/png' : 'image/jpeg' } as any);
      }
      const headers = { 'Content-Type': 'multipart/form-data' };
      const res = id ? await axios.patch(`/stays/${id}`, fd, { headers }) : await axios.post('/stays', fd, { headers });
      if (!res.data?.success) throw new Error(res.data?.message);
      buzz();
      Toast.show({ type: 'success', text1: id ? 'Listing updated' : 'Your listing is live 🏠', text2: id ? undefined : 'Students at your college can see it for 30 days' });
      if (id) navigation.goBack();
      else navigation.replace('StayDetail', { id: res.data.stay._id });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || e?.message || 'Could not save listing' });
    } finally {
      setSaving(false);
    }
  };

  const label = (t: string) => <Label style={{ marginBottom: 8 }}>{t}</Label>;

  return (
    <Screen>
      <AppBar title={id ? 'Edit listing' : 'List a place'} onBack={() => navigation.goBack()} />
      {/* iOS only: Android resizes the window for the keyboard (softwareKeyboardLayoutMode: resize). */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {loading ? <FormSkeleton /> : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
          {label('What are you listing?')}
          <SegmentedTabs items={KINDS} value={form.kind} onChange={(k) => set({ kind: k })} labels={KIND_LABEL} style={{ marginBottom: 16 }} />

          {label(`Photos · ${photos.length}/${MAX_PHOTOS}`)}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {photos.map((p, i) => (
              <View key={p.url || p.uri} style={{ flex: 1, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: C.paper2 }}>
                {p.url
                  ? <ProgressiveImage path={p.url} thumbOnly style={{ width: '100%', height: '100%' }} accessible={false} />
                  : <Image source={{ uri: p.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessible={false} />}
                <Pressable onPress={() => setPhotos((ps) => ps.filter((_, j) => j !== i))} hitSlop={10} className="active:opacity-85"
                  accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`}
                  style={{ position: 'absolute', top: 4, right: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={16} color="#fff" />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable onPress={pick} className="active:opacity-85" accessibilityRole="button" accessibilityLabel="Add photos"
                style={{ flex: 1, aspectRatio: 1, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="camera-outline" size={24} color={C.ink3} />
              </Pressable>
            ) : null}
            {Array.from({ length: Math.max(0, MAX_PHOTOS - photos.length - 1) }, (_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)}
          </View>

          <FormField label="Title" value={form.title} onChangeText={(t) => set({ title: t })} maxLength={70} error={err('title')}
            placeholder={form.kind === 'roommate' ? 'Need a roommate for 2BHK' : 'Sunrise PG for girls'} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <FormField containerStyle={{ flex: 1 }} label={form.kind === 'roommate' ? 'Your rent share (₹/mo)' : 'Rent (₹/mo)'} value={form.rent}
              onChangeText={(t) => set({ rent: t.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={6} error={err('rent')} placeholder="7500" />
            <FormField containerStyle={{ flex: 1 }} label="Deposit (optional)" value={form.deposit}
              onChangeText={(t) => set({ deposit: t.replace(/\D/g, '') })} keyboardType="number-pad" maxLength={7} error={err('deposit')} placeholder="15000" />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <FormField containerStyle={{ flex: 2 }} label="Area / locality" value={form.area} onChangeText={(t) => set({ area: t })} maxLength={80}
              error={err('area')} placeholder="Near Gate 2, Sector 62" />
            <FormField containerStyle={{ flex: 1 }} label="Distance (km)" value={form.distanceKm}
              onChangeText={(t) => set({ distanceKm: t.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" maxLength={4} error={err('distanceKm')} placeholder="1.5" />
          </View>

          {label('For')}
          <FilterChips items={GENDERS} value={form.forGender} onChange={(v) => set({ forGender: v })} labels={GENDER_LABEL} style={{ marginBottom: 16 }} />
          {label('Food')}
          <FilterChips items={FOODS} value={form.food} onChange={(v) => set({ food: v })} labels={FOOD_LABEL} style={{ marginBottom: 16 }} />
          {label('Amenities')}
          <TagRow style={{ marginBottom: 16 }}>
            {Object.keys(AMENITY_LABEL).map((a) => (
              <Chip key={a} label={AMENITY_LABEL[a]} active={form.amenities.includes(a)} onPress={() => toggle('amenities', a)} />
            ))}
          </TagRow>

          {form.kind === 'roommate' ? (
            <>
              {label('Move-in date (optional)')}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                <Chip icon="calendar-outline" label={form.moveIn ? form.moveIn.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Pick a date'}
                  active={!!form.moveIn} onPress={() => setShowDate(true)} />
                {form.moveIn ? <Chip label="Clear" onPress={() => set({ moveIn: null })} /> : null}
              </View>
              {showDate ? (
                <DateTimePicker value={form.moveIn || new Date()} mode="date" minimumDate={new Date()}
                  maximumDate={new Date(Date.now() + 360 * 86400000)} display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(e, d) => { setShowDate(Platform.OS === 'ios'); if (e.type === 'set' && d) set({ moveIn: d }); }} />
              ) : null}
              <FormField label="Roommate budget (₹/mo, optional)" value={form.budget} onChangeText={(t) => set({ budget: t.replace(/\D/g, '') })}
                keyboardType="number-pad" maxLength={6} error={err('budget')} placeholder="6000" />
              {label('Habits you want in a roommate')}
              <TagRow style={{ marginBottom: 16 }}>
                {Object.keys(HABIT_LABEL).map((h) => (
                  <Chip key={h} label={HABIT_LABEL[h]} active={form.habits.includes(h)} onPress={() => toggle('habits', h)} />
                ))}
              </TagRow>
            </>
          ) : null}

          <FormField label="Details (optional)" value={form.description} onChangeText={(t) => set({ description: t })} maxLength={500} multiline
            placeholder="Rules, timings, what's included…" hint="Don't share your phone number here. People can message you on Fync." />
        </ScrollView>
      )}
      <BottomBar>
        <Button title={id ? 'Save changes' : 'Post listing'} variant="primary" block loading={saving} disabled={loading} onPress={submit} />
      </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}
