import React, { memo, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Share, Switch, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import Toast from 'react-native-toast-message';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { artUrl } from '../../constants/features';
import { AppBar, Button, Card, Empty, IconBtn, Screen } from '../ui/kit';
import { Sheet } from '../ui/Sheet';
import { FormField } from '../ui/Field';
import { Alert } from '../ui/AlertModal';
import { buzz, tick } from '../ui/motion';
import { shareImageUrl } from '../../utils/shareCard';

type Msg = { _id: string; text: string; answer: string | null; createdAt: string; expiresAt: string; cardUrl: string | null };
type Me = { link: string; paused: boolean; total: number; unread: number };

const ART = 'assets/Speech balloon/3D/speech_balloon_3d.png';
const MAX = 300;

const timeLeft = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.max(0, Math.ceil(ms / 3600000));
  return h >= 24 ? `${Math.ceil(h / 24)}d` : `${h}h`;
};

const shareLink = (link: string) =>
  Share.share({ message: `Send me anonymous messages 👀 ${link}` }).catch(() => {});

const shareAnswer = (m: Msg, link: string) => {
  if (!m.cardUrl) return;
  shareImageUrl(m.cardUrl, `fync-ask-${m._id}.png`, 'Share your answer', () =>
    Share.share({ message: `Q: ${m.text}\nA: ${m.answer}\n\nAsk me anything 👉 ${link}` }));
};

const Row = memo(function Row({ m, isNew, onAnswer, onShare, onMore }: {
  m: Msg; isNew: boolean; onAnswer: (m: Msg) => void; onShare: (m: Msg) => void; onMore: (m: Msg) => void;
}) {
  return (
    <Card style={{ marginBottom: 12, borderColor: isNew ? C.brand[500] : C.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Text className="text-ink-3" style={{ fontSize: 12, flex: 1 }}>
          {isNew ? 'New · ' : ''}disappears in {timeLeft(m.expiresAt)}
        </Text>
        <IconBtn name="ellipsis-horizontal" onPress={() => onMore(m)} accessibilityLabel="More actions" />
      </View>
      <Text className="text-ink font-semibold" style={{ fontSize: 16, lineHeight: 22 }}>{m.text}</Text>
      {m.answer ? (
        <View className="bg-paper-2 rounded-2xl" style={{ padding: 12, marginTop: 10 }}>
          <Text className="text-ink-3" style={{ fontSize: 12, marginBottom: 2 }}>Your answer</Text>
          <Text className="text-ink" style={{ fontSize: 14, lineHeight: 20 }}>{m.answer}</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Button small title={m.answer ? 'Edit answer' : 'Answer'} variant={m.answer ? 'secondary' : 'primary'} onPress={() => onAnswer(m)} />
        {m.answer ? <Button small title="Share card" icon="share-social-outline" variant="primary" onPress={() => onShare(m)} /> : null}
      </View>
    </Card>
  );
});

/**
 * Ask me anything: a public link (backend /ask/:username) where anyone can send
 * an anonymous message. Messages, answers and blocks all expire after 7 days.
 */
export default function AskInbox() {
  const navigation = useNavigation<any>();
  const [me, setMe] = useState<Me | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [answering, setAnswering] = useState<Msg | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, inbox] = await Promise.all([
        axios.get('/ask/me', { params: { noCache: true } }),
        axios.get('/ask/inbox', { params: { noCache: true } }),
      ]);
      if (m.data?.success) setMe(m.data);
      if (inbox.data?.success) {
        setMsgs(inbox.data.messages);
        setHasMore(inbox.data.hasMore);
        setSeenAt(inbox.data.lastSeenAt);
      }
    } catch {
      Toast.show({ type: 'error', text1: 'Could not load your messages' });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadMore = async () => {
    if (!hasMore || !msgs.length) return;
    setHasMore(false);
    try {
      const res = await axios.get('/ask/inbox', { params: { before: msgs[msgs.length - 1].createdAt, noCache: true } });
      if (res.data?.success) {
        setMsgs((cur) => [...cur, ...res.data.messages]);
        setHasMore(res.data.hasMore);
      }
    } catch { /* next scroll retries */ }
  };

  const link = me?.link || '';

  const copy = async () => {
    await Clipboard.setStringAsync(link);
    tick();
    Toast.show({ type: 'success', text1: 'Link copied' });
  };

  const togglePause = async (paused: boolean) => {
    setMe((m) => (m ? { ...m, paused } : m));
    try {
      await axios.put('/ask/settings', { paused });
    } catch {
      setMe((m) => (m ? { ...m, paused: !paused } : m));
      Toast.show({ type: 'error', text1: 'Could not update' });
    }
  };

  const openAnswer = useCallback((m: Msg) => { setDraft(m.answer || ''); setAnswering(m); }, []);
  const onShare = useCallback((m: Msg) => shareAnswer(m, link), [link]);

  const saveAnswer = async () => {
    if (!answering || !draft.trim()) return;
    setSaving(true);
    try {
      const res = await axios.post(`/ask/${answering._id}/answer`, { answer: draft.trim() });
      const saved: Msg = res.data.message;
      setMsgs((cur) => cur.map((x) => (x._id === saved._id ? saved : x)));
      setAnswering(null);
      buzz();
      Alert.alert('Answered ✨', 'Share it to your story so more people ask you things.', [
        { text: 'Later', style: 'cancel' },
        { text: 'Share card', onPress: () => shareAnswer(saved, link) },
      ]);
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not save answer' });
    } finally {
      setSaving(false);
    }
  };

  const act = useCallback(async (m: Msg, path: 'delete' | 'block' | 'report', done: string) => {
    try {
      if (path === 'delete') await axios.delete(`/ask/${m._id}`);
      else await axios.post(`/ask/${m._id}/${path}`, path === 'report' ? { reason: 'Inappropriate content' } : {});
      if (path !== 'report') setMsgs((cur) => cur.filter((x) => x._id !== m._id));
      Toast.show({ type: 'success', text1: done });
      if (path === 'block') load(); // their other messages are gone too
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Something went wrong' });
    }
  }, [load]);

  const onMore = useCallback((m: Msg) => {
    Alert.alert('Message options', undefined, [
      { text: 'Report', onPress: () => act(m, 'report', 'Reported. Thanks for keeping Fync safe.') },
      { text: 'Block sender', style: 'destructive', onPress: () => act(m, 'block', "Blocked. They can't message you for 7 days.") },
      { text: 'Delete', style: 'destructive', onPress: () => act(m, 'delete', 'Deleted') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [act]);

  const renderItem = useCallback(({ item }: { item: Msg }) => (
    <Row m={item} isNew={!seenAt || item.createdAt > seenAt} onAnswer={openAnswer} onShare={onShare} onMore={onMore} />
  ), [seenAt, openAnswer, onShare, onMore]);

  const header = me ? (
    <View>
      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image source={{ uri: artUrl(ART) }} style={{ width: 48, height: 48 }} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Text className="text-ink font-semibold" style={{ fontSize: 16 }}>Your link</Text>
            <Text className="text-ink-3" style={{ fontSize: 13 }} numberOfLines={1} selectable>{link}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <Button small title="Copy" icon="copy-outline" onPress={copy} />
          <Button small title="Share to story" icon="share-social-outline" variant="primary" onPress={() => shareLink(link)} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, minHeight: 44 }}>
          <View style={{ flex: 1 }}>
            <Text className="text-ink font-semibold" style={{ fontSize: 14 }}>Pause my link</Text>
            <Text className="text-ink-3" style={{ fontSize: 12 }}>{me.paused ? 'Nobody can send you messages' : 'Anyone with the link can ask you'}</Text>
          </View>
          <Switch value={me.paused} onValueChange={togglePause} trackColor={{ true: C.brand[500], false: C.line }} thumbColor="#FFFFFF"
            accessibilityLabel="Pause my link" />
        </View>
      </Card>
      <Text className="text-ink-3" style={{ fontSize: 12, marginBottom: 12 }}>
        🔒 Senders stay anonymous. Messages disappear after 7 days.
      </Text>
    </View>
  ) : null;

  return (
    <Screen>
      <AppBar title="Ask me anything" onBack={() => navigation.goBack()} />
      {loading && !me ? (
        <ActivityIndicator color={C.brand[500]} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={msgs}
          keyExtractor={(m) => m._id}
          renderItem={renderItem}
          ListHeaderComponent={header}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <Empty art={ART} title="No messages yet"
              hint="Share your link on your story. Friends can ask you anything, anonymously."
              action={link ? <Button title="Share my link" variant="primary" onPress={() => shareLink(link)} /> : undefined} />
          }
        />
      )}

      <Sheet visible={!!answering} onClose={() => setAnswering(null)} title="Answer" subtitle={answering?.text}
        footer={<Button title="Save answer" variant="primary" block loading={saving} disabled={!draft.trim()} onPress={saveAnswer} />}>
        <FormField value={draft} onChangeText={setDraft} placeholder="Your answer..." multiline maxLength={MAX} autoFocus
          label="Your answer" hint={`${draft.length}/${MAX} · shows on your share card`} />
      </Sheet>
    </Screen>
  );
}
