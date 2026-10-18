import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, TextInput, ActivityIndicator, RefreshControl, Share, Platform, Animated, Easing,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { tapHaptic, selectHaptic } from '../../utils/haptics';
import { AppBar, Button, IconBtn, Screen, Empty } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import Avatar from '../Avatar';

/**
 * Couple Space: a private daily space for two linked partners.
 * Everything (streaks, day boundaries, hiding the partner's answer) is decided
 * by the server at /couple; this screen only renders and posts.
 */

type Person = { _id: string; name?: string; username?: string; avatar?: string; user_access?: any };
type BucketItem = { _id: string; text: string; addedBy: string; doneBy: string | null; doneAt: string | null };
type Next = { date: string; inDays: number; months?: number; years?: number };
type Space = {
  linked: true;
  couple: { id: string; since: string; me: Person; partner: Person };
  together: {
    days: number; milestones: { days: number; label: string }[];
    nextMilestone: { days: number; label: string; inDays: number } | null;
    monthiversary: Next; anniversary: Next;
  };
  streak: number; bestStreak: number; answeredToday: boolean;
  today: { day: string; question: string; mine: string | null; partnerAnswered: boolean; partner: string | null };
  nudges: { sentToday: number; receivedToday: number };
  unreadNotes: number;
  bucket: BucketItem[];
};
type Unlinked = { linked: false; pendingCode: { code: string; expiresIn: number } | null };
type Note = { _id: string; from: string; text: string; createdAt: string; readAt: string | null };
type Past = { day: string; question: string; mine: string | null; partner: string | null };

const dark = () => C.scheme === 'dark';
const ROSE = () => (dark() ? '#FB7185' : '#E11D48');
const ROSE_TINT = () => (dark() ? 'rgba(251,113,133,0.14)' : 'rgba(225,29,72,0.07)');
const ROSE_LINE = () => (dark() ? 'rgba(251,113,133,0.35)' : 'rgba(225,29,72,0.22)');
const HERO = () => (dark() ? '#4C0519' : '#E11D48');

const first = (p?: Person | null) => (p?.name || p?.username || 'Partner').split(' ')[0];
const errMsg = (e: any, fb = 'Something went wrong') => e?.response?.data?.message || fb;
const fmtDay = (key: string) =>
  new Date(`${key}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const ago = (iso: string) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

const Label = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
  <View className="flex-row items-center justify-between mt-7 mb-2.5">
    <Text className="font-display text-label text-ink-2 uppercase" style={{ letterSpacing: 1.2 }}>{children}</Text>
    {right}
  </View>
);

const CoupleSpace = () => {
  const navigation = useNavigation<any>();
  const [data, setData] = useState<Space | Unlinked | null>(null);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get('/couple');
      setData(r.data);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  // Refresh on focus: partner may have answered while we were away.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const unlink = () => {
    if (!data?.linked) return;
    Alert.alert(`Unlink from ${first(data.couple.partner)}?`, 'This deletes your shared answers, notes, bucket list and streak for both of you. It cannot be undone.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: () => {
          axios.delete('/couple')
            .then(() => { Toast.show({ type: 'success', text1: 'Unlinked' }); load(); })
            .catch((e) => Toast.show({ type: 'error', text1: errMsg(e, 'Could not unlink') }));
        },
      },
    ]);
  };

  return (
    <Screen>
      <AppBar
        title="Couple Space"
        onBack={() => navigation.goBack()}
        right={data?.linked ? <IconBtn name="ellipsis-horizontal" onPress={unlink} /> : undefined}
      />
      {!data && !error ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator color={ROSE()} /></View>
      ) : !data ? (
        <Empty
          icon="cloud-offline-outline"
          title="Couldn't load your space"
          hint="Check your connection and try again."
          action={<Button title="Retry" icon="refresh" onPress={() => { setError(false); load(); }} />}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 56 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={ROSE()} colors={[ROSE()]} />}
        >
          {data.linked ? <Dashboard s={data} reload={load} setS={(s) => setData(s)} /> : <LinkFlow pending={data.pendingCode} onLinked={load} />}
        </ScrollView>
      )}
    </Screen>
  );
};

/* ---------------------------------------------------------------- link flow */

const LinkFlow = ({ pending, onLinked }: { pending: Unlinked['pendingCode']; onLinked: () => void }) => {
  const [code, setCode] = useState(pending?.code ?? '');
  const [left, setLeft] = useState(pending?.expiresIn ?? 0);
  const [entry, setEntry] = useState('');
  const [busy, setBusy] = useState<'make' | 'join' | null>(null);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setLeft((s) => {
      if (s <= 1) { clearInterval(t); setCode(''); return 0; }
      return s - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [code]);

  // While our code is out, poll so we jump to the dashboard when the partner joins.
  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => {
      axios.get('/couple').then((r) => { if (r.data?.linked) { tapHaptic(); onLinked(); } }).catch(() => {});
    }, 4000);
    return () => clearInterval(t);
  }, [code, onLinked]);

  const make = async () => {
    setBusy('make');
    try {
      const r = await axios.post('/couple/code');
      tapHaptic();
      setCode(r.data.code);
      setLeft(r.data.expiresIn ?? 600);
    } catch (e) {
      Toast.show({ type: 'error', text1: errMsg(e, 'Could not create a code') });
    } finally {
      setBusy(null);
    }
  };

  const join = async () => {
    if (entry.length !== 6) return;
    setBusy('join');
    try {
      await axios.post('/couple/join', { code: entry });
      tapHaptic();
      Toast.show({ type: 'success', text1: "You're linked 💞" });
      onLinked();
    } catch (e) {
      Toast.show({ type: 'error', text1: errMsg(e, 'Could not link') });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View className="rounded-3xl p-6 items-center" style={{ backgroundColor: HERO() }}>
        <Text style={{ fontSize: 52 }}>💞</Text>
        <Text className="font-display text-center mt-2" style={{ color: '#fff', fontSize: 24, lineHeight: 28 }}>Your space for two</Text>
        <Text className="font-sans text-center mt-2" style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, lineHeight: 20 }}>
          A daily question, a shared streak, your bucket list and little love notes. Just you and your partner.
        </Text>
      </View>

      <Label>Invite your partner</Label>
      <View className="rounded-2xl border bg-card p-5 items-center" style={{ borderColor: ROSE_LINE() }}>
        {code ? (
          <>
            <Text className="font-sans text-ink-2 text-center">Send this code to your partner</Text>
            <Text selectable className="font-display text-ink mt-2" style={{ fontSize: 36, letterSpacing: 6 }}>{code}</Text>
            <Button
              title="Share code"
              icon="share-social-outline"
              variant="primary"
              style={{ marginTop: 14, backgroundColor: ROSE() }}
              onPress={() => Share.share({ message: `Join my Couple Space on Fync 💞 Open Couple Space and enter code ${code}` }).catch(() => {})}
            />
            <View className="flex-row items-center mt-3" style={{ gap: 8 }}>
              <ActivityIndicator size="small" color={ROSE()} />
              <Text className="font-sans text-ink-3 text-xs">
                Waiting for them · expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text className="font-sans text-ink-2 text-center mb-4">Create a one-time code. It works for 10 minutes.</Text>
            <Button title={busy === 'make' ? 'Creating…' : 'Create invite code'} icon="heart" variant="primary" disabled={!!busy} onPress={make} style={{ backgroundColor: ROSE() }} />
          </>
        )}
      </View>

      <Label>Got a code?</Label>
      <View className="flex-row items-center" style={{ gap: 10 }}>
        <TextInput
          value={entry}
          onChangeText={(t) => setEntry(t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase())}
          placeholder="ABC123"
          placeholderTextColor={C.ink4}
          autoCapitalize="characters"
          autoCorrect={false}
          onSubmitEditing={join}
          className="flex-1 rounded-xl border border-line bg-card px-4 font-display text-ink"
          style={{ height: 48, fontSize: 18, letterSpacing: 4 }}
        />
        <Button title={busy === 'join' ? '…' : 'Link'} variant="solid" onPress={join} disabled={entry.length !== 6 || !!busy} />
      </View>
      <Text className="font-sans text-ink-3 text-xs mt-6 text-center">
        Only the two of you can see your space. Either of you can unlink anytime.
      </Text>
    </>
  );
};

/* ---------------------------------------------------------------- dashboard */

const Dashboard = ({ s, reload, setS }: { s: Space; reload: () => Promise<void>; setS: (s: Space) => void }) => {
  const { me, partner } = s.couple;
  const t = s.together;
  const [pickDate, setPickDate] = useState(false);

  const saveSince = (d?: Date) => {
    setPickDate(Platform.OS === 'ios' && !!d); // iOS inline picker stays until Done
    if (!d) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (key === s.couple.since) return;
    axios.patch('/couple/since', { since: key })
      .then(() => { selectHaptic(); reload(); })
      .catch((e) => Toast.show({ type: 'error', text1: errMsg(e, 'Could not save date') }));
  };

  return (
    <>
      {/* Hero: avatars + days together */}
      <View className="rounded-3xl p-6 items-center" style={{ backgroundColor: HERO() }}>
        <View className="flex-row items-center">
          <View style={{ borderWidth: 3, borderColor: '#fff', borderRadius: 40 }}><Avatar user={me} size={64} showBadge={false} /></View>
          <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, marginHorizontal: -10, backgroundColor: '#fff', zIndex: 2 }}>
            <Ionicons name="heart" size={18} color="#E11D48" />
          </View>
          <View style={{ borderWidth: 3, borderColor: '#fff', borderRadius: 40 }}><Avatar user={partner} size={64} showBadge={false} /></View>
        </View>
        <Text className="font-sans mt-3" style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14 }}>You & {first(partner)}</Text>
        <Text className="font-display" style={{ color: '#fff', fontSize: 64, lineHeight: 70, fontVariant: ['tabular-nums'] }}>{t.days}</Text>
        <Text className="font-display uppercase" style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: 2, fontSize: 12 }}>
          {t.days === 1 ? 'day together' : 'days together'}
        </Text>
        <Pressable onPress={() => setPickDate(true)} hitSlop={8} className="flex-row items-center mt-3 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}>
          <Text className="font-sans" style={{ color: '#fff', fontSize: 12 }}>since {fmtDay(s.couple.since)}  </Text>
          <Ionicons name="pencil" size={12} color="#fff" />
        </Pressable>
      </View>
      {pickDate ? (
        <View className="rounded-2xl bg-card border border-line mt-3 p-2">
          <DateTimePicker
            value={new Date(`${s.couple.since}T12:00:00`)}
            maximumDate={new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={(e, d) => saveSince(e.type === 'set' ? d : undefined)}
          />
          {Platform.OS === 'ios' ? <Button title="Done" small variant="ghost" onPress={() => setPickDate(false)} /> : null}
        </View>
      ) : null}

      {/* Stats */}
      <View className="flex-row mt-4" style={{ gap: 10 }}>
        <Stat big={`🔥 ${s.streak}`} small={s.answeredToday ? 'streak · done today' : s.streak ? 'streak · answer today!' : 'day streak'} />
        <Stat big={`${t.monthiversary.inDays}d`} small={`to ${t.monthiversary.months}-month`} />
        <Stat big={`${t.anniversary.inDays}d`} small={t.anniversary.years === 1 ? 'to 1st anniversary' : `to year ${t.anniversary.years}`} />
      </View>
      {s.bestStreak > 1 ? <Text className="font-sans text-ink-3 text-xs mt-2 text-center">Best streak: {s.bestStreak} days</Text> : null}

      {/* Milestones */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4" contentContainerStyle={{ gap: 8 }}>
        {t.milestones.map((m) => (
          <View key={m.days} className="rounded-full px-3 py-1.5 flex-row items-center" style={{ backgroundColor: ROSE_TINT(), borderWidth: 1, borderColor: ROSE_LINE() }}>
            <Text style={{ fontSize: 12 }}>🏅 </Text>
            <Text className="font-display" style={{ color: ROSE(), fontSize: 12 }}>{m.label}</Text>
          </View>
        ))}
        {t.nextMilestone ? (
          <View className="rounded-full px-3 py-1.5 border border-line bg-card flex-row items-center">
            <Text className="font-sans text-ink-3" style={{ fontSize: 12 }}>Next: {t.nextMilestone.label} in {t.nextMilestone.inDays}d</Text>
          </View>
        ) : null}
      </ScrollView>

      <Label>Today's question</Label>
      <QuestionCard s={s} onAnswered={(patch) => setS({ ...s, ...patch, today: { ...s.today, ...patch.today } })} />

      <NudgeCard s={s} />

      <Label right={<Text className="font-sans text-ink-3 text-xs">{s.bucket.filter((b) => b.doneAt).length}/{s.bucket.length} done</Text>}>
        Bucket list
      </Label>
      <Bucket items={s.bucket} meId={me._id} partner={partner} onChange={(bucket) => setS({ ...s, bucket })} />

      <Notes partner={partner} meId={me._id} unread={s.unreadNotes} onRead={() => s.unreadNotes && setS({ ...s, unreadNotes: 0 })} />

      <History />
    </>
  );
};

const Stat = ({ big, small }: { big: string; small: string }) => (
  <View className="flex-1 rounded-2xl border border-line bg-card py-3 px-2 items-center">
    <Text className="font-display text-ink" style={{ fontSize: 20 }}>{big}</Text>
    <Text className="font-sans text-ink-3 text-center mt-0.5" style={{ fontSize: 11 }} numberOfLines={2}>{small}</Text>
  </View>
);

/* ----------------------------------------------------------- daily question */

const QuestionCard = ({ s, onAnswered }: { s: Space; onAnswered: (p: any) => void }) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const partner = s.couple.partner;
  const { today } = s;

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const r = await axios.post('/couple/answer', { text: v });
      tapHaptic();
      setText('');
      onAnswered({
        streak: r.data.streak,
        answeredToday: r.data.answeredToday,
        bestStreak: Math.max(s.bestStreak, r.data.streak),
        today: { mine: r.data.mine, partner: r.data.partner, partnerAnswered: !!r.data.partner },
      });
      if (r.data.answeredToday) Toast.show({ type: 'success', text1: `🔥 Streak: ${r.data.streak}`, text2: 'You both answered today!' });
    } catch (e) {
      Toast.show({ type: 'error', text1: errMsg(e, 'Could not send answer') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="rounded-2xl border p-5" style={{ borderColor: ROSE_LINE(), backgroundColor: ROSE_TINT() }}>
      <Text style={{ fontSize: 22 }}>💌</Text>
      <Text className="font-display text-ink mt-2" style={{ fontSize: 19, lineHeight: 25 }}>{today.question}</Text>

      {today.mine == null ? (
        <>
          <TextInput
            value={text}
            onChangeText={(v) => setText(v.slice(0, 300))}
            placeholder="Your answer…"
            placeholderTextColor={C.ink4}
            multiline
            className="rounded-xl border border-line bg-card px-4 py-3 mt-4 font-sans text-ink"
            style={{ minHeight: 80, textAlignVertical: 'top', fontSize: 15 }}
          />
          <View className="flex-row items-center justify-between mt-3">
            <Text className="font-sans text-ink-3 text-xs">
              {today.partnerAnswered ? `${first(partner)} answered. Answer to see it 👀` : `${text.length}/300`}
            </Text>
            <Button title={busy ? 'Sending…' : 'Answer'} icon="send" small variant="primary" inCard disabled={!text.trim() || busy} onPress={send} style={{ backgroundColor: ROSE() }} />
          </View>
        </>
      ) : (
        <View className="mt-4" style={{ gap: 10 }}>
          <Bubble who="You" text={today.mine} />
          {today.partner ? (
            <Bubble who={first(partner)} text={today.partner} theirs />
          ) : (
            <View className="rounded-xl border border-dashed border-line px-4 py-3 flex-row items-center" style={{ gap: 8 }}>
              <Ionicons name="hourglass-outline" size={16} color={C.ink3} />
              <Text className="font-sans text-ink-2 flex-1">Waiting for {first(partner)} to answer…</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const Bubble = ({ who, text, theirs }: { who: string; text: string; theirs?: boolean }) => (
  <View className="rounded-xl px-4 py-3 bg-card border" style={{ borderColor: theirs ? ROSE_LINE() : C.line }}>
    <Text className="font-display text-xs" style={{ color: theirs ? ROSE() : C.ink3 }}>{who}</Text>
    <Text className="font-sans text-ink mt-1" style={{ fontSize: 15, lineHeight: 21 }}>{text}</Text>
  </View>
);

/* -------------------------------------------------------------------- nudge */

const NudgeCard = ({ s }: { s: Space }) => {
  const [sent, setSent] = useState(s.nudges.sentToday);
  const [wait, setWait] = useState(0);
  const pop = useRef(new Animated.Value(1)).current;
  useEffect(() => setSent(s.nudges.sentToday), [s.nudges.sentToday]);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    if (wait > 0) return;
    tapHaptic();
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.25, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    try {
      const r = await axios.post('/couple/nudge');
      setSent(r.data.sentToday);
      setWait(r.data.retryIn ?? 300);
      Toast.show({ type: 'success', text1: `Sent to ${first(s.couple.partner)} 💭` });
    } catch (e: any) {
      if (e?.response?.status === 429) setWait(e.response.data?.retryIn ?? 300);
      Toast.show({ type: 'info', text1: errMsg(e, 'Could not send') });
    }
  };

  return (
    <Pressable
      onPress={send}
      accessibilityRole="button"
      accessibilityLabel="Send thinking of you"
      className="rounded-2xl border border-line bg-card mt-4 p-4 flex-row items-center"
      style={{ opacity: wait > 0 ? 0.7 : 1 }}
    >
      <Animated.Text style={{ fontSize: 30, transform: [{ scale: pop }] }}>💭</Animated.Text>
      <View className="flex-1 ml-3">
        <Text className="font-display text-ink" style={{ fontSize: 16 }}>Thinking of you</Text>
        <Text className="font-sans text-ink-3 text-xs mt-0.5">
          {wait > 0 ? `Next one in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')} · ` : ''}
          You sent {sent} · got {s.nudges.receivedToday} today
        </Text>
      </View>
      <View className="rounded-full px-4 py-2" style={{ backgroundColor: ROSE() }}>
        <Text className="font-display" style={{ color: '#fff', fontSize: 13 }}>Send</Text>
      </View>
    </Pressable>
  );
};

/* -------------------------------------------------------------- bucket list */

const Bucket = ({ items, meId, partner, onChange }: {
  items: BucketItem[]; meId: string; partner: Person; onChange: (b: BucketItem[]) => void;
}) => {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const sorted = [...items].sort((a, b) => Number(!!a.doneAt) - Number(!!b.doneAt));

  const add = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const r = await axios.post('/couple/bucket', { text: v });
      selectHaptic();
      setText('');
      onChange(r.data.bucket);
    } catch (e) {
      Toast.show({ type: 'error', text1: errMsg(e, 'Could not add') });
    } finally {
      setBusy(false);
    }
  };
  const toggle = (it: BucketItem) => {
    selectHaptic();
    axios.patch(`/couple/bucket/${it._id}`, { done: !it.doneAt })
      .then((r) => { if (!it.doneAt) tapHaptic(); onChange(r.data.bucket); })
      .catch((e) => Toast.show({ type: 'error', text1: errMsg(e, 'Could not update') }));
  };
  const remove = (it: BucketItem) =>
    Alert.alert('Remove this?', it.text, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: () => axios.delete(`/couple/bucket/${it._id}`)
          .then((r) => onChange(r.data.bucket))
          .catch((e) => Toast.show({ type: 'error', text1: errMsg(e, 'Could not remove') })),
      },
    ]);

  return (
    <View className="rounded-2xl border border-line bg-card overflow-hidden">
      <View className="flex-row items-center px-3 py-2 border-b border-line" style={{ gap: 8 }}>
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.slice(0, 120))}
          placeholder={items.length >= 100 ? 'List is full' : 'Add something to do together…'}
          editable={items.length < 100}
          placeholderTextColor={C.ink4}
          onSubmitEditing={add}
          returnKeyType="done"
          className="flex-1 font-sans text-ink px-1"
          style={{ height: 44, fontSize: 15 }}
        />
        <IconBtn name="add-circle" color={ROSE()} size={28} onPress={add} />
      </View>
      {sorted.length === 0 ? (
        <Text className="font-sans text-ink-3 text-center p-5">Sunrise trek? Goa trip? Write your first one ✨</Text>
      ) : sorted.map((it) => (
        <Pressable key={it._id} onPress={() => toggle(it)} onLongPress={() => remove(it)} accessibilityRole="checkbox" accessibilityState={{ checked: !!it.doneAt }}
          className="flex-row items-center px-4 py-3 border-b border-line">
          <Ionicons name={it.doneAt ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={it.doneAt ? ROSE() : C.ink4} />
          <View className="flex-1 ml-3">
            <Text className={`font-sans ${it.doneAt ? 'text-ink-3' : 'text-ink'}`} style={{ fontSize: 15, textDecorationLine: it.doneAt ? 'line-through' : 'none' }}>{it.text}</Text>
            {it.doneAt ? (
              <Text className="font-sans text-ink-3 mt-0.5" style={{ fontSize: 11 }}>
                Done by {String(it.doneBy) === meId ? 'you' : first(partner)} · {fmtDay(it.doneAt.slice(0, 10))}
              </Text>
            ) : null}
          </View>
        </Pressable>
      ))}
      {sorted.length ? <Text className="font-sans text-ink-4 text-center py-2" style={{ fontSize: 11 }}>Tap to tick · long-press to remove</Text> : null}
    </View>
  );
};

/* --------------------------------------------------------------- love notes */

const Notes = ({ partner, meId, unread, onRead }: { partner: Person; meId: string; unread: number; onRead: () => void }) => {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(() => {
    axios.get('/couple/notes')
      .then((r) => { setNotes(r.data.notes); setFailed(false); })
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => { load(); }, [load, unread]);
  useEffect(() => {
    if (!unread || !notes) return;
    axios.post('/couple/notes/read').then(onRead).catch(() => {});
  }, [unread, notes, onRead]);

  const send = async () => {
    const v = text.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const r = await axios.post('/couple/notes', { text: v });
      tapHaptic();
      setText('');
      setNotes((n) => [r.data.note, ...(n ?? [])]);
    } catch (e) {
      Toast.show({ type: 'error', text1: errMsg(e, 'Could not send note') });
    } finally {
      setBusy(false);
    }
  };

  const shown = all ? notes ?? [] : (notes ?? []).slice(0, 4);
  return (
    <>
      <Label right={unread ? (
        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: ROSE() }}>
          <Text className="font-display" style={{ color: '#fff', fontSize: 11 }}>{unread} new</Text>
        </View>
      ) : undefined}>Love notes</Label>
      <View className="rounded-2xl border border-line bg-card p-3">
        <TextInput
          value={text}
          onChangeText={(v) => setText(v.slice(0, 280))}
          placeholder={`Write something sweet to ${first(partner)}…`}
          placeholderTextColor={C.ink4}
          multiline
          className="font-sans text-ink px-1"
          style={{ minHeight: 48, fontSize: 15, textAlignVertical: 'top' }}
        />
        <View className="flex-row items-center justify-between mt-1">
          <Text className="font-sans text-ink-4 text-xs">{text.length}/280</Text>
          <Button title={busy ? '…' : 'Send note'} icon="heart" small variant="primary" inCard disabled={!text.trim() || busy} onPress={send} style={{ backgroundColor: ROSE() }} />
        </View>
      </View>
      {failed ? (
        <Pressable onPress={load} className="p-4 items-center"><Text className="font-sans text-ink-3">Couldn't load notes · tap to retry</Text></Pressable>
      ) : !notes ? (
        <ActivityIndicator color={ROSE()} style={{ marginTop: 16 }} />
      ) : notes.length === 0 ? (
        <Text className="font-sans text-ink-3 text-center mt-4">No notes yet. Leave the first one 💌</Text>
      ) : (
        <View className="mt-3" style={{ gap: 8 }}>
          {shown.map((n) => {
            const mine = String(n.from) === meId;
            return (
              <View key={n._id} className="rounded-2xl px-4 py-3 border" style={{
                alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%',
                backgroundColor: mine ? C.card : ROSE_TINT(), borderColor: mine ? C.line : ROSE_LINE(),
              }}>
                <Text className="font-sans text-ink" style={{ fontSize: 15, lineHeight: 21 }}>{n.text}</Text>
                <Text className="font-sans text-ink-3 mt-1" style={{ fontSize: 11 }}>
                  {mine ? 'You' : first(partner)} · {ago(n.createdAt)}{mine && n.readAt ? ' · seen' : ''}
                </Text>
              </View>
            );
          })}
          {notes.length > 4 ? (
            <Button title={all ? 'Show less' : `Show all ${notes.length}`} small variant="ghost" onPress={() => setAll(!all)} />
          ) : null}
        </View>
      )}
    </>
  );
};

/* ------------------------------------------------------------ past questions */

const History = () => {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState<Past[] | null>(null);
  const [failed, setFailed] = useState(false);

  const toggle = () => {
    selectHaptic();
    setOpen(!open);
    if (!days) {
      axios.get('/couple/history', { params: { limit: 30 } })
        .then((r) => { setDays(r.data.days); setFailed(false); })
        .catch(() => setFailed(true));
    }
  };

  return (
    <>
      <Pressable onPress={toggle} className="flex-row items-center justify-between mt-7 py-2" accessibilityRole="button">
        <Text className="font-display text-label text-ink-2 uppercase" style={{ letterSpacing: 1.2 }}>Past questions</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.ink3} />
      </Pressable>
      {!open ? null : failed ? (
        <Text className="font-sans text-ink-3 text-center mt-2">Couldn't load history. Pull to refresh and try again.</Text>
      ) : !days ? (
        <ActivityIndicator color={ROSE()} style={{ marginTop: 12 }} />
      ) : days.length === 0 ? (
        <Text className="font-sans text-ink-3 text-center mt-2">Your answers will collect here day by day.</Text>
      ) : days.map((d) => (
        <View key={d.day} className="rounded-2xl border border-line bg-card p-4 mt-2.5">
          <Text className="font-sans text-ink-3" style={{ fontSize: 11 }}>{fmtDay(d.day)}</Text>
          <Text className="font-display text-ink mt-1" style={{ fontSize: 15 }}>{d.question}</Text>
          <Text className="font-sans text-ink-2 mt-2" style={{ fontSize: 14 }}><Text className="text-ink-3">You: </Text>{d.mine ?? '—'}</Text>
          <Text className="font-sans text-ink-2 mt-1" style={{ fontSize: 14 }}><Text style={{ color: ROSE() }}>Them: </Text>{d.partner === '🔒' ? '🔒 You skipped this one' : d.partner ?? '—'}</Text>
        </View>
      ))}
    </>
  );
};

export default CoupleSpace;
