import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { useAuth } from '../../context/auth.context';
import Avatar from '../Avatar';
import { AppBar, BottomBar, Button, Card, Empty, IconBtn, Screen } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import { buzz, tick } from '../ui/motion';
import { CATS, PINK, fmtTime, type Cat } from './SundayPlans';

type U = { _id: string; name?: string; username?: string; avatar?: string };
type Plan = {
  _id: string; title: string; category: Cat; place: string; description?: string; startsAt: string;
  capacity: number; going: number; bring: string[]; host: U;
  attendees: { user: U; bringing: string | null }[]; status: 'host' | 'going' | null;
};

const REASONS = ['Unsafe or private location', 'Inappropriate content', 'Spam or fake plan'];

export default function PlanDetail() {
  const navigation = useNavigation<any>();
  const { id } = (useRoute().params || {}) as { id: string };
  const { user } = useAuth() as any;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [gone, setGone] = useState(false);
  const [claim, setClaim] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/plans/${id}`, { params: { noCache: true } });
      setPlan(res.data?.plan || null);
    } catch {
      setGone(true);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const act = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) Toast.show({ type: 'success', text1: ok });
      setClaim(null);
      await load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Something went wrong' });
      load();
    } finally {
      setBusy(false);
    }
  };

  const join = () => act(async () => {
    await axios.post(`/plans/${id}/join`, claim ? { bringing: claim } : {});
    buzz();
  }, "You're in 🎉");
  const leave = () => Alert.alert('Leave this plan?', 'Your spot opens up for someone else.', [
    { text: 'Stay', style: 'cancel' },
    { text: 'Leave', style: 'destructive', onPress: () => act(() => axios.post(`/plans/${id}/leave`)) },
  ]);
  const kick = (u: U) => Alert.alert(`Remove ${u.name?.split(' ')[0] || 'them'}?`, "They won't be able to rejoin this plan.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: () => act(() => axios.post(`/plans/${id}/kick`, { userId: u._id })) },
  ]);
  const cancel = () => Alert.alert('Cancel this plan?', "Everyone who's going gets a notification.", [
    { text: 'Keep it', style: 'cancel' },
    {
      text: 'Cancel plan', style: 'destructive', onPress: async () => {
        try { await axios.delete(`/plans/${id}`); Toast.show({ type: 'success', text1: 'Plan cancelled' }); navigation.goBack(); } catch (e: any) {
          Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not cancel' });
        }
      },
    },
  ]);
  const report = () => Alert.alert('Report this plan', 'Why are you reporting it?', [
    ...REASONS.map((reason) => ({
      text: reason,
      onPress: async () => {
        try {
          const r = await axios.post(`/plans/${id}/report`, { reason });
          Toast.show({ type: 'success', text1: r.data?.message || 'Reported' });
        } catch (e: any) { Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not report' }); }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  if (gone) {
    return (
      <Screen>
        <AppBar title="Sunday Plan" onBack={() => navigation.goBack()} />
        <Empty icon="calendar-outline" title="This plan is gone" hint="It was cancelled or Sunday is over" />
      </Screen>
    );
  }
  if (!plan) {
    return (
      <Screen>
        <AppBar title="Sunday Plan" onBack={() => navigation.goBack()} />
        <ActivityIndicator color={PINK} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const cat = CATS[plan.category] || CATS.other;
  const isHost = plan.status === 'host';
  const full = plan.going >= plan.capacity;
  const claimedBy = new Map(plan.attendees.filter((a) => a.bringing).map((a) => [a.bringing as string, a.user]));
  const openProfile = (u: U) => navigation.navigate('PublicProfile', { userId: u._id });

  return (
    <Screen>
      <AppBar title="Sunday Plan" onBack={() => navigation.goBack()}
        right={isHost
          ? <IconBtn name="trash-outline" color={C.danger} accessibilityLabel="Cancel plan" onPress={cancel} />
          : <IconBtn name="flag-outline" accessibilityLabel="Report plan" onPress={report} />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}>
        <Card style={{ marginBottom: 16, borderColor: plan.status ? PINK : C.line }}>
          <Text style={{ fontSize: 40 }}>{cat.emoji}</Text>
          <Text className="text-ink font-display" style={{ fontSize: 22, lineHeight: 28, marginTop: 8 }}>{plan.title}</Text>
          <Text style={{ color: PINK, fontSize: 13, fontWeight: '600', marginTop: 4 }}>{cat.label}</Text>
          <View style={{ gap: 6, marginTop: 12 }}>
            <Text className="text-ink-2" style={{ fontSize: 14 }}>🕒 Sunday, {fmtTime(plan.startsAt)}</Text>
            <Text className="text-ink-2" style={{ fontSize: 14 }}>📍 {plan.place}</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: full ? C.danger : C.ink2 }}>👥 {plan.going}/{plan.capacity} going{full ? ' · full' : ''}</Text>
          </View>
          {plan.description ? <Text className="text-ink" style={{ fontSize: 14, lineHeight: 20, marginTop: 12 }}>{plan.description}</Text> : null}
          <Pressable onPress={() => openProfile(plan.host)} className="active:opacity-85" accessibilityRole="button"
            accessibilityLabel={`Hosted by ${plan.host.name}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16, minHeight: 44 }}>
            <Avatar user={plan.host} size={32} />
            <Text className="text-ink-3" style={{ fontSize: 13 }}>Hosted by <Text className="text-ink font-semibold">{plan.host.name}</Text></Text>
          </Pressable>
        </Card>

        {plan.bring.length ? (
          <View style={{ marginBottom: 16 }}>
            <Text className="text-ink font-semibold" style={{ fontSize: 16, marginBottom: 4 }}>Bring list</Text>
            {!plan.status ? <Text className="text-ink-3" style={{ fontSize: 12, marginBottom: 8 }}>Tap an item to bring it when you join (optional)</Text> : null}
            {plan.bring.map((b) => {
              const by = claimedBy.get(b);
              const mine = claim === b;
              const canClaim = !by && !plan.status && !full;
              return (
                <Pressable key={b} disabled={!canClaim} onPress={() => { tick(); setClaim(mine ? null : b); }}
                  accessibilityRole="checkbox" accessibilityState={{ checked: mine || !!by, disabled: !canClaim }}
                  accessibilityLabel={by ? `${b}, ${by.name} is bringing it` : b} className="active:opacity-85"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingHorizontal: 12, marginBottom: 8,
                    borderRadius: 16, borderWidth: 1, borderColor: mine ? PINK : C.line, backgroundColor: C.card }}>
                  <Text style={{ fontSize: 16 }}>{by ? '✅' : mine ? '🙋' : '⬜'}</Text>
                  <Text className="text-ink" style={{ flex: 1, fontSize: 14 }}>{b}</Text>
                  <Text className="text-ink-3" style={{ fontSize: 12 }}>{by ? by.name?.split(' ')[0] : mine ? 'You' : 'Open'}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text className="text-ink font-semibold" style={{ fontSize: 16, marginBottom: 8 }}>Going · {plan.going}</Text>
        {[{ user: plan.host, bringing: null, host: true }, ...plan.attendees.map((a) => ({ ...a, host: false }))].map((a) => (
          <View key={a.user._id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
            <Pressable onPress={() => openProfile(a.user)} className="active:opacity-85" accessibilityRole="button" accessibilityLabel={a.user.name}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar user={a.user} size={40} />
              <View style={{ flex: 1 }}>
                <Text className="text-ink font-semibold" numberOfLines={1}>{a.user.name}{a.user._id === user?._id ? ' (you)' : ''}</Text>
                <Text className="text-ink-3" style={{ fontSize: 12 }} numberOfLines={1}>
                  {a.host ? 'Host' : a.bringing ? `Bringing ${a.bringing}` : `@${a.user.username || ''}`}
                </Text>
              </View>
            </Pressable>
            {isHost && !a.host ? <IconBtn name="close" size={18} accessibilityLabel={`Remove ${a.user.name}`} onPress={() => kick(a.user)} /> : null}
          </View>
        ))}
        <Text className="text-ink-3" style={{ fontSize: 12, lineHeight: 17, marginTop: 16 }}>
          Keep it to common areas and meet in groups. Report anything that feels off.
        </Text>
      </ScrollView>

      {!isHost ? (
        <BottomBar>
          {plan.status === 'going'
            ? <Button title="Leave plan" block loading={busy} onPress={leave} />
            : <Button title={full ? 'Plan is full' : claim ? `Join & bring ${claim}` : "I'm in"} variant="primary" block
                disabled={full} loading={busy} onPress={join} />}
        </BottomBar>
      ) : null}
    </Screen>
  );
}
