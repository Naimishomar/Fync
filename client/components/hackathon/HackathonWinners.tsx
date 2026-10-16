import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

/**
 * Announcing winners.
 *
 * Fync does not know who took part — registration happened on the organiser's
 * own site — so the organiser types the result in: a rank, a team name, and
 * whichever teammates have Fync accounts. Tagged students get a notification
 * and the win shows on their profile; teammates who aren't on Fync are still
 * credited by name, because a half-listed team reads as a mistake.
 */

interface TaggedUser {
  _id: string;
  name: string;
  username?: string;
  avatar?: string;
  college?: string;
}

interface WinnerRow {
  rank: number;
  title: string;
  amount: string;
  teamName: string;
  users: TaggedUser[];
  projectLink: string;
  note: string;
}

const RANK_LABEL: Record<number, string> = { 1: '1st place', 2: '2nd place', 3: '3rd place' };
const rankLabel = (r: number) => RANK_LABEL[r] ?? `Rank ${r}`;

const emptyRow = (rank: number): WinnerRow => ({
  rank,
  title: RANK_LABEL[rank] ? RANK_LABEL[rank].replace(' place', ' Prize') : '',
  amount: '',
  teamName: '',
  users: [],
  projectLink: '',
  note: '',
});

const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
}: any) => (
  <View className="mb-3">
    <Text className="text-ink-3 text-label font-semibold mb-1.5">{label}</Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.ink3}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      className="bg-paper-2 border border-line rounded-card px-4 py-3 text-ink text-sm"
      style={multiline ? { minHeight: 72, textAlignVertical: 'top' } : undefined}
    />
  </View>
);

// ─── Student picker ──────────────────────────────────────────────────────────
const StudentPicker = ({
  visible,
  onClose,
  onPick,
  alreadyTagged,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (u: TaggedUser) => void;
  alreadyTagged: string[];
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaggedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const bottomInset = useBottomInset();

  // Every keystroke used to be a collection scan on the server. One request
  // per pause instead, and only the last one is allowed to render.
  const reqId = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Invalidate any in-flight search; its cleared timer would otherwise
      // leave the spinner on for good.
      reqId.current++;
      setResults([]);
      setSearching(false);
      return;
    }
    const id = ++reqId.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`/user/search?q=${encodeURIComponent(q)}`);
        if (id === reqId.current) setResults(res.data.users ?? []);
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setSearching(false);
      }
    }, 320);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-ink/50 justify-end">
        <View className="bg-paper rounded-t-sheet border-t-2 border-ink" style={{ height: '72%' }}>
          <View className="flex-row items-center justify-between px-gutter pt-4 pb-3 border-b border-line">
            <Text className="text-ink text-base font-display">Tag a student</Text>
            <TouchableOpacity onPress={onClose} className="w-11 h-11 items-center justify-center" accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={C.ink} />
            </TouchableOpacity>
          </View>

          <View className="px-gutter pt-3">
            <View className="flex-row items-center bg-card border-2 border-ink rounded-md px-3" style={{ height: 46 }}>
              <Feather name="search" size={16} color={C.ink3} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or username"
                placeholderTextColor={C.ink3}
                autoFocus
                autoCorrect={false}
                autoCapitalize="none"
                className="flex-1 ml-2 text-ink text-sm"
                style={{ paddingVertical: 0 }}
              />
              {searching ? <ActivityIndicator size="small" color={C.brand[500]} /> : null}
            </View>
          </View>

          <FlatList
            data={results}
            keyExtractor={(u) => u._id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 + bottomInset }}
            renderItem={({ item }) => {
              const taken = alreadyTagged.includes(item._id);
              return (
                <TouchableOpacity
                  onPress={() => {
                    if (taken) return;
                    onPick(item);
                    onClose();
                  }}
                  disabled={taken}
                  className={`flex-row items-center border rounded-card p-3 mb-2 ${taken ? 'bg-paper-2 border-line' : 'bg-card border-line'}`}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: taken }}
                >
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} className="w-10 h-10 rounded-full mr-3" />
                  ) : (
                    <View className="w-10 h-10 rounded-full bg-paper-2 border border-line items-center justify-center mr-3">
                      <Text className="text-ink-3 font-semibold">{item.name?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View className="flex-1">
                    <Text className="text-ink text-sm font-semibold">{item.name}</Text>
                    <Text className="text-ink-3 text-label font-semibold" numberOfLines={1}>
                      {item.username ? `@${item.username}` : ''}
                      {item.username && item.college ? ' · ' : ''}
                      {item.college ?? ''}
                    </Text>
                  </View>
                  {taken ? (
                    <Text className="text-ink-3 text-label font-semibold">Added</Text>
                  ) : (
                    <Ionicons name="add-circle-outline" size={20} color={C.brand[700]} />
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center pt-16 px-6">
                <Feather name="users" size={26} color={C.ink4} />
                <Text className="text-ink-2 text-label font-semibold mt-3 text-center">
                  {query.trim().length < 2 ? 'Type at least two characters' : searching ? 'Searching…' : 'No students matched'}
                </Text>
                <Text className="text-ink-3 text-label text-center mt-1 leading-4">
                  Winners who aren&apos;t on Fync can still be credited with the team name.
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Screen ──────────────────────────────────────────────────────────────────
const HackathonWinners = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bottomInset = useBottomInset();
  const { hackathonId, hackathonTitle } = route.params ?? {};

  const [rows, setRows] = useState<WinnerRow[]>([emptyRow(1)]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`/hackathons/${hackathonId}`);
        const existing = res.data.hackathon?.winners ?? [];
        if (existing.length) {
          setRows(
            [...existing]
              .sort((a: any, b: any) => (a.rank ?? 99) - (b.rank ?? 99))
              .map((w: any) => ({
                rank: w.rank ?? 1,
                title: w.title ?? '',
                amount: w.amount ?? '',
                teamName: w.teamName ?? '',
                users: (w.users ?? []).filter((u: any) => u && u._id),
                projectLink: w.projectLink ?? '',
                note: w.note ?? '',
              }))
          );
        }
      } catch {
        Toast.show({ type: 'error', text1: 'Could not load the current winners' });
      } finally {
        setLoading(false);
      }
    })();
  }, [hackathonId]);

  const update = useCallback((index: number, patch: Partial<WinnerRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const addRow = () => setRows((prev) => [...prev, emptyRow(prev.length + 1)]);

  const removeRow = (index: number) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const tagUser = (index: number, u: TaggedUser) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === index && !r.users.some((x) => x._id === u._id) ? { ...r, users: [...r.users, u] } : r
      )
    );

  const untagUser = (index: number, userId: string) =>
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, users: r.users.filter((u) => u._id !== userId) } : r)));

  const save = async () => {
    // A row with neither a team name nor a tagged student says nothing — it
    // would publish as a blank prize card.
    const filled = rows.filter((r) => r.teamName.trim() || r.users.length);
    if (!filled.length) {
      Toast.show({ type: 'info', text1: 'Add a team name or tag at least one student' });
      return;
    }

    const ranks = filled.map((r) => r.rank);
    if (new Set(ranks).size !== ranks.length) {
      Toast.show({ type: 'info', text1: 'Two rows share the same rank' });
      return;
    }

    setSaving(true);
    try {
      await axios.patch(`/hackathons/${hackathonId}/winners`, {
        winners: filled.map((r) => ({
          rank: r.rank,
          title: r.title.trim(),
          amount: r.amount.trim(),
          teamName: r.teamName.trim(),
          users: r.users.map((u) => u._id),
          projectLink: r.projectLink.trim(),
          note: r.note.trim(),
        })),
      });
      const tagged = filled.reduce((n, r) => n + r.users.length, 0);
      Toast.show({
        type: 'success',
        text1: 'Winners announced',
        text2: tagged ? `${tagged} student${tagged > 1 ? 's' : ''} notified` : undefined,
      });
      navigation.goBack();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: err?.response?.data?.message ?? 'Could not save the winners' });
    } finally {
      setSaving(false);
    }
  };

  const confirmLeave = () => {
    Alert.alert('Discard changes?', 'The winners you entered will not be saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-paper items-center justify-center">
        <ActivityIndicator size="large" color={C.brand[500]} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-paper">
      <StatusBar style="dark" />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <AppBar title="Announce winners" subtitle={hackathonTitle || undefined} onBack={confirmLeave} />

        <KeyboardAvoidingView
          behavior="padding"
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 120 + bottomInset }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-row items-start bg-card border border-line rounded-card p-3.5 mb-4">
              <Feather name="info" size={13} color={C.ink3} style={{ marginTop: 1 }} />
              <Text className="text-ink-2 text-label leading-4 ml-2 flex-1">
                Tagged students get a notification and the win appears on their profile. Teammates
                without a Fync account are still credited through the team name.
              </Text>
            </View>

            {rows.map((row, i) => (
              <View key={i} className="bg-card border-2 border-ink rounded-card p-4 mb-3">
                <View className="flex-row items-center justify-between mb-3">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons
                      name="trophy-variant"
                      size={16}
                      color={row.rank === 1 ? '#D97706' : row.rank === 2 ? '#78716C' : '#B45309'}
                    />
                    <Text className="text-ink text-sm font-display ml-2">{rankLabel(row.rank)}</Text>
                  </View>
                  {rows.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => removeRow(i)}
                      className="w-9 h-9 items-center justify-center"
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${rankLabel(row.rank)}`}
                    >
                      <Feather name="trash-2" size={15} color="#B91C1C" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Rank picker */}
                <Text className="text-ink-3 text-label font-semibold mb-1.5">Rank</Text>
                <View className="flex-row flex-wrap mb-3" style={{ gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((r) => {
                    const on = row.rank === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => update(i, { rank: r })}
                        className={`px-3.5 py-2 rounded-md border ${on ? 'bg-ink border-ink' : 'bg-paper-2 border-line'}`}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text className={`text-label font-semibold ${on ? 'text-white' : 'text-ink-2'}`}>{r}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Field
                  label="Team name"
                  value={row.teamName}
                  onChangeText={(t: string) => update(i, { teamName: t })}
                  placeholder="e.g. Team Byte Bandits"
                />

                {/* Tagged students */}
                <Text className="text-ink-3 text-label font-semibold mb-1.5">Students on Fync</Text>
                <View className="flex-row flex-wrap mb-2" style={{ gap: 6 }}>
                  {row.users.map((u) => (
                    <View key={u._id} className="flex-row items-center bg-paper-2 border border-line rounded-full pl-1 pr-1 py-1">
                      {u.avatar ? (
                        <Image source={{ uri: u.avatar }} className="w-6 h-6 rounded-full mr-1.5" />
                      ) : (
                        <View className="w-6 h-6 rounded-full bg-card items-center justify-center mr-1.5">
                          <Text className="text-ink-3 text-label font-semibold">{u.name?.[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                      <Text className="text-ink text-label font-semibold mr-1">{u.name}</Text>
                      <TouchableOpacity
                        onPress={() => untagUser(i, u._id)}
                        hitSlop={8}
                        className="w-6 h-6 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${u.name}`}
                      >
                        <Ionicons name="close-circle" size={16} color={C.ink3} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <TouchableOpacity
                  onPress={() => setPickerFor(i)}
                  className="flex-row items-center justify-center border-2 border-dashed border-line rounded-card py-3 mb-3"
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Ionicons name="person-add-outline" size={15} color={C.brand[700]} />
                  <Text className="text-brand-700 text-label font-semibold ml-2">Tag a student</Text>
                </TouchableOpacity>

                <Field
                  label="Prize title"
                  value={row.title}
                  onChangeText={(t: string) => update(i, { title: t })}
                  placeholder="e.g. Grand Prize, Best UI"
                />
                <Field
                  label="Prize amount"
                  value={row.amount}
                  onChangeText={(t: string) => update(i, { amount: t })}
                  placeholder="e.g. ₹50,000"
                />
                <Field
                  label="Project link (optional)"
                  value={row.projectLink}
                  onChangeText={(t: string) => update(i, { projectLink: t })}
                  placeholder="https://github.com/…"
                  autoCapitalize="none"
                />
                <Field
                  label="Note (optional)"
                  value={row.note}
                  onChangeText={(t: string) => update(i, { note: t })}
                  placeholder="One line on why they won"
                  multiline
                />
              </View>
            ))}

            <TouchableOpacity
              onPress={addRow}
              className="flex-row items-center justify-center border-2 border-dashed border-line rounded-card py-4"
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              <Ionicons name="add" size={17} color={C.ink} />
              <Text className="text-ink text-label font-semibold ml-1.5">Add another position</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Save */}
        <View
          className="absolute left-0 right-0 bottom-0 bg-paper border-t border-line px-gutter pt-3"
          style={{ paddingBottom: 12 + bottomInset }}
        >
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            className={`flex-row items-center justify-center border-2 border-ink rounded-card ${saving ? 'bg-paper-2' : 'bg-brand-500'}`}
            style={{ minHeight: 52 }}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
          >
            {saving ? (
              <ActivityIndicator size="small" color={C.ink} />
            ) : (
              <>
                <MaterialCommunityIcons name="trophy" size={17} color={C.ink} />
                <Text className="text-ink text-base font-display ml-2">Publish winners</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <StudentPicker
        visible={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onPick={(u) => pickerFor !== null && tagUser(pickerFor, u)}
        alreadyTagged={pickerFor !== null ? rows[pickerFor].users.map((u) => u._id) : []}
      />
    </View>
  );
};

export default HackathonWinners;
