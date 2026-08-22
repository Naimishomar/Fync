import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, ActivityIndicator,
  RefreshControl, ScrollView, Linking, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';

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
  notes: 'NOTES', pyq: 'PAST PAPER', lab: 'LAB', syllabus: 'SYLLABUS',
};

export default function NotesExchange() {
  const navigation = useNavigation<any>();
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

  const fetchNotes = useCallback(async () => {
    try {
      const res = await axios.get('/notes', {
        params: { kind: kind || undefined, sort, q: query.trim() || undefined },
      });
      if (res.data.success) setNotes(res.data.notes);
    } catch {
      // A failed listing leaves whatever was already on screen rather than
      // blanking it out.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, sort, query]);

  useEffect(() => { setLoading(true); fetchNotes(); }, [kind, sort]);

  const unlock = async (note: Note) => {
    setUnlocking(note._id);
    try {
      const res = await axios.post(`/notes/${note._id}/unlock`);
      if (res.data.success) {
        setNotes((prev) => prev.map((n) => (n._id === note._id ? { ...n, owned: true } : n)));
        Linking.openURL(res.data.fileUrl);
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

  const renderNote = ({ item }: { item: Note }) => (
    <View className="bg-white border-2 border-ink rounded-card p-4 mb-3">
      <View className="flex-row items-center mb-2">
        <View className="bg-brand-500 px-2 py-1 rounded-sm">
          <Text className="font-display text-label text-ink uppercase" style={{ fontSize: 9 }}>
            {KIND_LABEL[item.kind] ?? 'NOTES'}
          </Text>
        </View>
        {!!item.semester && (
          <Text className="font-sans text-ink-3 ml-2" style={{ fontSize: 11 }}>
            Sem {item.semester}
          </Text>
        )}
        <View className="flex-1" />
        <Ionicons name="download-outline" size={13} color="#8B857E" />
        <Text className="font-sans text-ink-3 ml-1" style={{ fontSize: 11 }}>{item.downloads}</Text>
      </View>

      <Text className="font-display text-base text-ink" numberOfLines={2}>{item.title}</Text>
      <Text className="font-sans text-ink-3 mt-1" style={{ fontSize: 12 }}>{item.subject}</Text>

      {!!item.description && (
        <Text className="font-sans text-ink-3 mt-2" style={{ fontSize: 12 }} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View className="flex-row items-center mt-3">
        <Text className="font-sans text-ink-3 flex-1" style={{ fontSize: 11 }} numberOfLines={1}>
          {item.uploader?.name ?? 'Someone'}
        </Text>

        <TouchableOpacity
          onPress={() => unlock(item)}
          disabled={unlocking === item._id}
          className="flex-row items-center px-4 py-2 rounded-xl border-2 border-ink bg-brand-500"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.title}`}
        >
          {unlocking === item._id ? (
            <ActivityIndicator size="small" color="#12100E" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={15} color="#12100E" />
              <Text className="font-display text-ink ml-1" style={{ fontSize: 12 }}>
                {item.owned ? 'OPEN' : 'DOWNLOAD'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
      <View className="px-5 pt-2">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="w-11 h-11 items-center justify-center rounded-xl"
          style={{ marginLeft: -11 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color="#12100E" />
        </TouchableOpacity>

        <Text className="font-display text-display text-ink uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Notes</Text>
        <Text className="font-display text-display text-brand-600 uppercase" style={{ lineHeight: 35, letterSpacing: -1.2 }}>Exchange</Text>

        <View className="flex-row items-center mt-3 mb-4">
          <Text className="font-display text-ink-3 uppercase" style={{ fontSize: 11, letterSpacing: 1.4 }}>
            Free for everyone
          </Text>
          <View className="flex-1" />
          {/* Coins earned from sharing. Kept visible because uploading still
              pays — but nothing here costs anything to read. */}
          <View className="flex-row items-center bg-white border-2 border-ink rounded-xl px-3 py-1">
            <Ionicons name="server-outline" size={14} color="#EA580C" />
            <Text className="font-display text-ink ml-1" style={{ fontSize: 13 }}>{coins}</Text>
          </View>
        </View>

        <View className="flex-row items-center bg-white border-2 border-ink rounded-xl px-3 mb-3" style={{ height: 48 }}>
          <Ionicons name="search" size={18} color="#8B857E" />
          <TextInput
            className="flex-1 ml-2 text-ink"
            placeholder="Subject, topic, paper..."
            placeholderTextColor="#8B857E"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => { setLoading(true); fetchNotes(); }}
            returnKeyType="search"
          />
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
          {KINDS.map((k) => (
            <TouchableOpacity
              key={k.id || 'all'}
              onPress={() => setKind(k.id)}
              className={`px-4 py-2 rounded-xl border-2 border-ink mr-2 ${kind === k.id ? 'bg-brand-500' : 'bg-white'}`}
              style={{ minHeight: 40, justifyContent: 'center' }}
            >
              <Text className="font-display text-ink" style={{ fontSize: 12 }}>{k.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setSort(sort === 'recent' ? 'popular' : 'recent')}
            className="px-4 py-2 rounded-xl border-2 border-ink mr-2 bg-white flex-row items-center"
            style={{ minHeight: 40 }}
          >
            <Ionicons name="swap-vertical-outline" size={14} color="#12100E" />
            <Text className="font-display text-ink ml-1" style={{ fontSize: 12 }}>
              {sort === 'recent' ? 'Newest' : 'Popular'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      ) : (
        <FlatList
          data={notes}
          renderItem={renderNote}
          keyExtractor={(n) => n._id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotes(); }} tintColor="#F97316" />
          }
          ListEmptyComponent={
            <View className="items-center mt-20 px-8">
              <Ionicons name="documents-outline" size={56} color="#C4BEB6" />
              <Text className="font-display text-base text-ink mt-4 text-center">Nothing here yet</Text>
              <Text className="font-sans text-ink-3 mt-2 text-center" style={{ fontSize: 13 }}>
                Be the first to share notes for your college. Free for everyone to read.
              </Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        onPress={() => setUploadOpen(true)}
        className="absolute bottom-8 right-6 bg-brand-500 border-2 border-ink rounded-full flex-row items-center px-5"
        style={{ height: 56 }}
        accessibilityRole="button"
        accessibilityLabel="Share notes"
      >
        <Ionicons name="cloud-upload-outline" size={20} color="#12100E" />
        <Text className="font-display text-ink ml-2">SHARE</Text>
      </TouchableOpacity>

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
    </SafeAreaView>
  );
}

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(18,16,14,0.4)' }}>
        <Pressable className="flex-1" onPress={onClose} />
        <View className="bg-paper rounded-t-sheet border-t-2 border-x-2 border-ink px-5 pt-4 pb-8">
          <View className="items-center mb-4">
            <View className="h-1 w-10 bg-ink-3 rounded-full" />
          </View>

          <Text className="font-display text-xl text-ink mb-4">Share notes</Text>

          <TouchableOpacity
            onPress={pick}
            className="bg-white border-2 border-ink rounded-card px-4 flex-row items-center mb-3"
            style={{ height: 56 }}
          >
            <Ionicons name={file ? 'document-text' : 'add-circle-outline'} size={22} color="#EA580C" />
            <Text className="font-sans text-ink ml-3 flex-1" numberOfLines={1}>
              {file ? file.name : 'Choose a PDF'}
            </Text>
          </TouchableOpacity>

          <TextInput
            className="bg-white border-2 border-ink rounded-xl px-4 text-ink mb-3"
            style={{ height: 50 }}
            placeholder="Title, e.g. Unit 3 - Trees"
            placeholderTextColor="#8B857E"
            value={title}
            onChangeText={setTitle}
          />
          <View className="flex-row mb-3">
            <TextInput
              className="bg-white border-2 border-ink rounded-xl px-4 text-ink flex-1 mr-2"
              style={{ height: 50 }}
              placeholder="Subject"
              placeholderTextColor="#8B857E"
              value={subject}
              onChangeText={setSubject}
            />
            <TextInput
              className="bg-white border-2 border-ink rounded-xl px-4 text-ink"
              style={{ height: 50, width: 96 }}
              placeholder="Sem"
              placeholderTextColor="#8B857E"
              keyboardType="number-pad"
              value={semester}
              onChangeText={setSemester}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
            {(['notes', 'pyq', 'lab', 'syllabus'] as const).map((k) => (
              <TouchableOpacity
                key={k}
                onPress={() => setKind(k)}
                className={`px-4 py-2 rounded-xl border-2 border-ink mr-2 ${kind === k ? 'bg-brand-500' : 'bg-white'}`}
                style={{ minHeight: 40, justifyContent: 'center' }}
              >
                <Text className="font-display text-ink" style={{ fontSize: 12 }}>{KIND_LABEL[k]}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <TouchableOpacity
            onPress={submit}
            disabled={busy}
            className="bg-brand-500 border-2 border-ink rounded-xl items-center justify-center"
            style={{ height: 54, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#12100E" /> : <Text className="font-display text-ink">SHARE AND EARN</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
