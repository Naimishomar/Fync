import React, { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import Avatar from '../Avatar';
import { AppBar, Button, Card, Chip, Label, Screen, Tag, TagRow } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { Alert } from '../ui/AlertModal';
import { buzz, tick } from '../ui/motion';

type Intent = 'friendship' | 'dating';
type Profile = { optedIn: boolean; intent: Intent; interestedIn: string | null; interests: string[]; vibes: number[]; priority: boolean };
type MatchCard = { user: { _id: string; name?: string; username?: string; avatar?: string; year?: number }; sharedInterests: string[]; intent?: Intent; expiresAt: string };
type Options = { interests: string[]; maxInterests: number; vibes: { q: string; options: string[] }[]; reasons: string[] };
type State = { profile: Profile | null; match: MatchCard | null; nextAt: string; options: Options };

const PINK = '#db2777';
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const HEARTS = artUrl('assets/Two hearts/3D/two_hearts_3d.png');

const Countdown = memo(function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to).getTime() - now);
  const parts = [
    [Math.floor(ms / 86400000), 'days'], [Math.floor(ms / 3600000) % 24, 'hrs'],
    [Math.floor(ms / 60000) % 60, 'min'], [Math.floor(ms / 1000) % 60, 'sec'],
  ] as const;
  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }} accessible
      accessibilityLabel={`Next match in ${parts[0][0]} days ${parts[1][0]} hours ${parts[2][0]} minutes`}>
      {parts.map(([n, l]) => (
        <View key={l} className="bg-card border border-line rounded-2xl" style={{ width: 70, paddingVertical: 12, alignItems: 'center' }}>
          <Text className="font-display text-ink" style={{ fontSize: 28 }}>{String(n).padStart(2, '0')}</Text>
          <Text className="text-ink-3" style={{ fontSize: 12 }}>{l}</Text>
        </View>
      ))}
    </View>
  );
});

/**
 * Sunday Match: opt in with a short quiz, get paired with one person from your
 * college every Sunday at 7 PM. Only your own match is ever shown.
 */
export default function SundayMatch() {
  const navigation = useNavigation<any>();
  const reduceMotion = useReducedMotion();
  const [data, setData] = useState<State | null>(null);
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const [intent, setIntent] = useState<Intent | null>(null);
  const [interestedIn, setInterestedIn] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [vibes, setVibes] = useState<(number | null)[]>([null, null, null]);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/couple/sunday', { params: { noCache: true } });
      if (res.data?.success) setData(res.data);
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load Sunday Match' });
    }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startQuiz = () => {
    const p = data?.profile;
    setIntent(p?.intent ?? null);
    setInterestedIn(p?.interestedIn ?? null);
    setInterests(p?.interests ?? []);
    setVibes(p?.vibes?.length === 3 ? p.vibes : [null, null, null]);
    setAdult(false);
    setStep(0);
    setEditing(true);
  };

  const toggleInterest = (t: string) => {
    tick();
    setInterests((cur) => cur.includes(t) ? cur.filter((x) => x !== t)
      : cur.length >= (data?.options.maxInterests ?? 8) ? cur : [...cur, t]);
  };

  const join = async () => {
    setBusy(true);
    try {
      await axios.put('/couple/sunday/profile', { intent, interestedIn, interests, vibes, ageConfirmed: adult });
      buzz();
      Toast.show({ type: 'success', text1: "You're in 💞", text2: 'Your match drops Sunday at 7 PM' });
      setEditing(false);
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not save' });
    } finally {
      setBusy(false);
    }
  };

  const post = async (path: string, body?: object, ok?: string) => {
    setBusy(true);
    try {
      const res = await axios.post(`/couple/sunday/${path}`, body);
      if (ok || res.data?.message) Toast.show({ type: 'success', text1: ok || res.data.message });
      load();
      return true;
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Something went wrong' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const pause = () => Alert.alert('Pause Sunday Match?', "You won't be matched until you join again.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Pause', style: 'destructive', onPress: () => post('optout', undefined, 'Paused') },
  ]);
  const unmatch = () => Alert.alert('Unmatch?', 'This ends the match for both of you.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Unmatch', style: 'destructive', onPress: () => post('unmatch', undefined, 'Unmatched') },
  ]);
  const report = async (reason: string) => {
    if (await post('report', { reason })) setReporting(false);
  };

  const o = data?.options;
  const stepOk = step === 0 ? !!intent && (intent !== 'dating' || !!interestedIn)
    : step === 1 ? interests.length > 0 : vibes.every((v) => v != null) && adult;

  const quiz = o ? (
    <>
      <Label style={{ marginBottom: 12 }}>Step {step + 1} of 3</Label>
      {step === 0 ? (
        <>
          <Text className="text-ink font-semibold" style={{ fontSize: 18, marginBottom: 12 }}>What are you looking for?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(['friendship', 'dating'] as const).map((i) => (
              <Chip key={i} label={i === 'friendship' ? 'Friendship 🤝' : 'Dating 💘'} active={intent === i} onPress={() => { tick(); setIntent(i); }} />
            ))}
          </View>
          {intent === 'dating' ? (
            <>
              <Text className="text-ink font-semibold" style={{ fontSize: 16, marginTop: 20, marginBottom: 12 }}>Interested in</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {['men', 'women', 'everyone'].map((g) => (
                  <Chip key={g} label={cap(g)} active={interestedIn === g} onPress={() => { tick(); setInterestedIn(g); }} />
                ))}
              </View>
              <Text className="text-ink-3" style={{ fontSize: 12, marginTop: 8 }}>We use the gender on your profile to match both ways.</Text>
            </>
          ) : null}
        </>
      ) : step === 1 ? (
        <>
          <Text className="text-ink font-semibold" style={{ fontSize: 18, marginBottom: 4 }}>Pick your interests</Text>
          <Text className="text-ink-3" style={{ fontSize: 13, marginBottom: 12 }}>{interests.length}/{o.maxInterests} selected</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {o.interests.map((t) => <Chip key={t} label={cap(t)} active={interests.includes(t)} onPress={() => toggleInterest(t)} />)}
          </View>
        </>
      ) : (
        <>
          {o.vibes.map((v, qi) => (
            <View key={v.q} style={{ marginBottom: 20 }}>
              <Text className="text-ink font-semibold" style={{ fontSize: 16, marginBottom: 10 }}>{v.q}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {v.options.map((label, oi) => (
                  <Chip key={label} label={label} active={vibes[qi] === oi}
                    onPress={() => { tick(); setVibes((cur) => cur.map((x, i) => (i === qi ? oi : x))); }} />
                ))}
              </View>
            </View>
          ))}
          <Pressable onPress={() => setAdult((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: adult }}
            className="active:opacity-85" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
            <Ionicons name={adult ? 'checkbox' : 'square-outline'} size={24} color={adult ? PINK : C.ink3} />
            <Text className="text-ink" style={{ flex: 1, fontSize: 14 }}>I confirm I am 18 or older</Text>
          </Pressable>
        </>
      )}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
        {step > 0 ? <Button title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />
          : data?.profile ? <Button title="Cancel" onPress={() => setEditing(false)} style={{ flex: 1 }} /> : null}
        <Button title={step < 2 ? 'Next' : 'Join Sunday Match'} variant="primary" style={{ flex: 1 }} disabled={!stepOk}
          loading={busy} onPress={step < 2 ? () => setStep(step + 1) : join} />
      </View>
    </>
  ) : null;

  const m = data?.match;
  const showQuiz = editing || (!m && !data?.profile?.optedIn);

  return (
    <Screen>
      <AppBar title="Sunday Match" onBack={() => navigation.goBack()} />
      {!data ? (
        <ActivityIndicator color={PINK} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <View className="rounded-2xl overflow-hidden mb-5" style={{ backgroundColor: PINK }}>
            <View className="p-5 flex-row items-center">
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text className="font-display" style={{ color: '#fff', fontSize: 24, lineHeight: 30 }}>Sunday Match 💞</Text>
                <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18, marginTop: 6 }}>
                  One new person from your college, every Sunday at 7 PM. Friendship or dating, your call.
                </Text>
              </View>
              <Image source={{ uri: HEARTS }} style={{ width: 72, height: 72 }} contentFit="contain" cachePolicy="disk" />
            </View>
          </View>

          {showQuiz ? quiz : m ? (
            <Animated.View entering={reduceMotion ? undefined : ZoomIn.duration(320)}>
              <Card style={{ alignItems: 'center', borderColor: PINK, paddingVertical: 24 }}>
                <Text className="text-ink-3" style={{ fontSize: 13, marginBottom: 12 }}>This week&apos;s match</Text>
                <Avatar user={m.user} size={96} />
                <Text className="font-display text-ink" style={{ fontSize: 22, marginTop: 12 }}>{m.user.name}</Text>
                <Text className="text-ink-3" style={{ fontSize: 13, marginTop: 2 }}>
                  {m.user.year ? `Year ${m.user.year} · ` : ''}{m.intent === 'dating' ? 'Dating 💘' : 'Friendship 🤝'}
                </Text>
                {m.sharedInterests.length ? (
                  <>
                    <Text className="text-ink-2 font-semibold" style={{ fontSize: 13, marginTop: 16, marginBottom: 8 }}>You both like</Text>
                    <TagRow style={{ justifyContent: 'center' }}>
                      {m.sharedInterests.map((t) => <Tag key={t} label={cap(t)} tone={{ fg: PINK, border: PINK }} />)}
                    </TagRow>
                  </>
                ) : null}
                <Button title="Say hi" variant="primary" icon="chatbubble-ellipses-outline" block style={{ marginTop: 20 }}
                  onPress={() => navigation.navigate('PublicProfile', { userId: m.user._id })} />
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 12, alignSelf: 'stretch' }}>
                  <Button title="Unmatch" style={{ flex: 1 }} onPress={unmatch} disabled={busy} />
                  <Button title="Report" variant="danger" style={{ flex: 1 }} onPress={() => setReporting(true)} disabled={busy} />
                </View>
              </Card>
              <Text className="text-ink-3" style={{ fontSize: 12, lineHeight: 17, marginTop: 12, textAlign: 'center' }}>
                Match ends {new Date(m.expiresAt).toDateString()}. Only the two of you can see it.
              </Text>
            </Animated.View>
          ) : (
            <>
              <Text className="text-ink font-semibold" style={{ fontSize: 16, textAlign: 'center', marginBottom: 12 }}>Your next match drops in</Text>
              <Countdown to={data.nextAt} />
              {data.profile?.priority ? (
                <Card style={{ marginTop: 20 }}>
                  <Text className="text-ink font-semibold">No match last week</Text>
                  <Text className="text-ink-3" style={{ fontSize: 13, marginTop: 2 }}>You&apos;re first in line this Sunday.</Text>
                </Card>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                <Button title="Edit preferences" style={{ flex: 1 }} onPress={startQuiz} />
                <Button title="Pause" style={{ flex: 1 }} onPress={pause} disabled={busy} />
              </View>
            </>
          )}

          {!showQuiz && m ? (data.profile?.optedIn
            ? <Button title="Pause future matches" variant="tertiary" style={{ marginTop: 16 }} onPress={pause} disabled={busy} />
            : <Button title="Join again for next week" variant="tertiary" style={{ marginTop: 16 }} onPress={startQuiz} />
          ) : null}
        </ScrollView>
      )}

      <Sheet visible={reporting} onClose={() => setReporting(false)} title="Report this match" subtitle="This ends the match and you won't be paired again">
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 8 }}>
          {(o?.reasons ?? []).map((r) => (
            <Button key={r} title={r} block disabled={busy} onPress={() => report(r)} />
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
