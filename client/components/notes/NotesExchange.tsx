import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { View, Text, FlatList, ActivityIndicator, Linking, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';
import { AppBar, Button, Card, Chip, ChipRow, Empty, Label, Tag, Sheet, SearchField, FormField } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
interface Note {
  _id: string;
  title: string;
  description?: string;
  subject: string;
  semester?: number;
  branch?: string;
  kind: 'notes' | 'pyq' | 'lab' | 'syllabus';
  downloads: number;
  upvotes: number;
  owned?: boolean;
  uploader?: { _id: string; name: string; username: string };
}

const KINDS = [
  { id: '', label: 'All' },
  { id: 'notes', label: 'Notes' },
  { id: 'pyq', label: 'Papers' },
  { id: 'lab', label: 'Lab' },
  { id: 'syllabus', label: 'Syllabus' },
];

const KIND_LABEL: Record<string, string> = {
  notes: 'Notes', pyq: 'Past paper', lab: 'Lab', syllabus: 'Syllabus',
};

export default function NotesExchange() {
  const navigation = useNavigation<any>();
  const bottomInset = useBottomInset();
  const { user, setUser } = useAuth() as any;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [kind, setKind] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [query, setQuery] = useState('');
  const [unlocking, setUnlocking] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const coins = user?.coins ?? 0;

  // Switching filters quickly must not let an older, slower listing land last.
  const requestId = useRef(0);
  const fetchNotes = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const res = await axios.get('/notes', {
        params: { kind: kind || undefined, sort, q: query.trim() || undefined },
      });
      if (id === requestId.current && res.data.success) setNotes(res.data.notes ?? []);
    } catch {
      // A failed listing leaves whatever was already on screen rather than
      // blanking it out.
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [kind, sort, query]);

  useEffect(() => { setLoading(true); fetchNotes(); }, [kind, sort]);

  const unlock = async (note: Note) => {
    setUnlocking(note._id);
    try {
      const res = await axios.post(`/notes/${note._id}/unlock`);
      if (res.data.success) {
        setNotes((prev) => prev.map((n) => (n._id === note._id ? { ...n, owned: true } : n)));
        Linking.openURL(res.data.fileUrl).catch(() =>
          Alert.alert('Could not open', 'No app on this phone can open the file.', [{ text: 'Okay' }]));
      }
    } catch (err: any) {
      const data = err?.response?.data;
      Alert.alert(
        data?.expired ? 'No longer available' : 'Could not open',
        data?.message ?? 'Try again in a moment.',
        [{ text: 'Okay' }],
      );
    } finally {
      setUnlocking(null);
    }
  };

  const renderNote = useCallback(({ item }: { item: Note }) => (
    <NoteCard item={item} busy={unlocking === item._id} onOpen={unlock} />
  ), [unlocking]);

  return (
    <View className="flex-1 bg-paper">
      <AppBar title="Notes Exchange" onBack={() => navigation.goBack()} />
      <View className="px-gutter">
        <View className="flex-row items-center mb-3">
          <Label>Free for everyone</Label>
          <View className="flex-1" />
          {/* Coins earned from sharing. Kept visible because uploading still
              pays — but nothing here costs anything to read. */}
          <Tag icon="server-outline" label={`${coins} coins`} />
        </View>

        <SearchField
          placeholder="Subject, topic, paper..."
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => { setLoading(true); fetchNotes(); }}
          containerStyle={{ marginBottom: 12 }}
        />
      </View>

      <ChipRow>
        {KINDS.map((k) => (
          <Chip key={k.id || 'all'} label={k.label} active={kind === k.id} onPress={() => setKind(k.id)} />
        ))}
        <Chip
          icon="swap-vertical-outline"
          label={sort === 'recent' ? 'Newest' : 'Popular'}
          accessibilityLabel={`Sort: ${sort === 'recent' ? 'newest' : 'popular'}`}
          onPress={() => setSort(sort === 'recent' ? 'popular' : 'recent')}
        />
      </ChipRow>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={C.brand[500]} />
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          data={notes}
          renderItem={renderNote}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
          refreshControl={
            <FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotes(); }} tintColor={C.brand[500]} />
          }
          ListEmptyComponent={
            <View className="mt-16">
              <Empty
                icon="documents-outline"
                title="Nothing here yet"
                hint="Be the first to share notes for your college. Free for everyone to read."
              />
            </View>
          }
        />
      )}

      <Button
        variant="primary"
        icon="cloud-upload-outline"
        title="Share"
        accessibilityLabel="Share notes"
        onPress={() => setUploadOpen(true)}
        style={{ position: 'absolute', right: 20, bottom: bottomInset + 32 }}
      />

      <UploadSheet
        visible={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onDone={(earned: number) => {
          setUploadOpen(false);
          setLoading(true);
          fetchNotes();
          if (earned > 0) setUser((u: any) => (u ? { ...u, coins: (u.coins ?? 0) + earned } : u));
        }}
      />
    </View>
  );
}

const NoteCard = memo(function NoteCard({ item, busy, onOpen }: { item: Note; busy: boolean; onOpen: (n: Note) => void }) {
  return (
    <Card padded style={{ marginBottom: 12 }}>
      <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
        <Tag label={KIND_LABEL[item.kind] ?? 'Notes'} tone={{ bg: C.brand[50], border: C.brand[100], fg: C.accentText }} />
        {!!item.semester && <Text className="font-sans text-xs text-ink-3">Sem {item.semester}</Text>}
        <View className="flex-1" />
        <Ionicons name="download-outline" size={13} color={C.ink3} />
        <Text className="font-sans text-xs text-ink-3" accessibilityLabel={`${item.downloads} downloads`}>{item.downloads}</Text>
      </View>

      <Text className="font-semibold text-base text-ink" numberOfLines={2}>{item.title}</Text>
      <Text className="font-sans text-xs text-ink-3 mt-1">{item.subject}</Text>

      {!!item.description && (
        <Text className="font-sans text-xs text-ink-2 mt-2" numberOfLines={2}>{item.description}</Text>
      )}

      <View className="flex-row items-center mt-3" style={{ gap: 12 }}>
        <Text className="font-sans text-xs text-ink-3 flex-1" numberOfLines={1}>
          {item.uploader?.name ?? 'Someone'}
        </Text>
        <Button
          small
          variant="primary"
          icon="document-text-outline"
          title={item.owned ? 'Open' : 'Download'}
          loading={busy}
          accessibilityLabel={`Open ${item.title}`}
          onPress={() => onOpen(item)}
        />
      </View>
    </Card>
  );
});

/** Upload lives in a sheet rather than its own screen: it is four fields and a
 *  file, and pushing a route for that loses the list underneath. */
function UploadSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (earned: number) => void }) {
  const [file, setFile] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [semester, setSemester] = useState('');
  const [kind, setKind] = useState<'notes' | 'pyq' | 'lab' | 'syllabus'>('notes');
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) setFile(res.assets[0]);
  };

  const submit = async () => {
    if (!file) return Alert.alert('Pick a file', 'Choose a PDF to share.', [{ text: 'Okay' }]);
    if (!title.trim() || !subject.trim()) {
      return Alert.alert('Almost there', 'A title and subject are needed.', [{ text: 'Okay' }]);
    }

    setBusy(true);
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name ?? 'notes.pdf', type: 'application/pdf' } as any);
    form.append('title', title.trim());
    form.append('subject', subject.trim());
    form.append('kind', kind);
    if (semester.trim()) form.append('semester', semester.trim());

    try {
      const res = await axios.post('/notes/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setFile(null); setTitle(''); setSubject(''); setSemester('');
        Alert.alert(
          'Shared',
          res.data.earned > 0
            ? `Thanks — you earned ${res.data.earned} coin${res.data.earned > 1 ? 's' : ''}, plus 1 more each time someone opens it.`
            : 'Thanks for sharing. You have hit today’s reward cap, but you still earn a coin each time someone opens it.',
          [{ text: 'Nice' }],
        );
        onDone(res.data.earned ?? 0);
      }
    } catch (err: any) {
      const data = err?.response?.data;
      // The server distinguishes these, so the student is told which it was —
      // "could not share" for a duplicate would just make them retry.
      const title = data?.duplicate ? 'Already shared'
        : data?.rejected ? 'Not shared'
        : 'Could not share';
      Alert.alert(title, data?.message ?? 'Try again in a moment.', [{ text: 'Okay' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Share notes"
      footer={<Button variant="primary" block title="Share and earn" loading={busy} onPress={submit} />}
    >
      <Pressable
        onPress={pick}
        className="bg-paper-2 border border-line rounded-2xl px-4 flex-row items-center mb-3 active:opacity-70"
        style={{ minHeight: 56 }}
        accessibilityRole="button"
        accessibilityLabel={file ? `Selected ${file.name}. Choose another PDF` : 'Choose a PDF'}
      >
        <Ionicons name={file ? 'document-text' : 'add-circle-outline'} size={22} color={C.accentText} />
        <Text className="font-sans text-ink ml-3 flex-1" numberOfLines={1}>
          {file ? file.name : 'Choose a PDF'}
        </Text>
      </Pressable>

      <FormField
        label="Title"
        placeholder="e.g. Unit 3 - Trees"
        value={title}
        onChangeText={setTitle}
        containerStyle={{ marginBottom: 12 }}
      />
      <View className="flex-row mb-3" style={{ gap: 8 }}>
        <FormField label="Subject" value={subject} onChangeText={setSubject} containerStyle={{ flex: 1 }} />
        <FormField
          label="Sem"
          keyboardType="number-pad"
          value={semester}
          onChangeText={setSemester}
          containerStyle={{ width: 96 }}
        />
      </View>

      <Label style={{ marginBottom: 8 }}>Type</Label>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {(['notes', 'pyq', 'lab', 'syllabus'] as const).map((k) => (
          <Chip key={k} label={KIND_LABEL[k]} active={kind === k} onPress={() => setKind(k)} />
        ))}
      </View>
    </Sheet>
  );
}
