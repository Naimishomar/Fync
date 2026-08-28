import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, Pressable, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Image, Keyboard,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Alert } from './AlertModal';
import { getFullUrl } from '../../utils/imageUtils';
import { useBottomInset } from '../../constants/layout';
import { C } from '../../constants/colors';

/**
 * The comment sheet, for every surface that has comments.
 *
 * There were three near-identical copies of this — posts, shorts, and the
 * individual post screen — which is why they had drifted: only one of them
 * handled the keyboard correctly, only one had a usable send button, and a fix
 * to any of them left the others behind.
 *
 * The APIs were already the same shape (add, update and delete are identical
 * across resources; only the fetch path differs, `/post/comment/:id` against
 * `/shorts/comments/:id`), so the difference is one line of configuration
 * rather than a second implementation.
 */
type Resource = 'post' | 'shorts';

const ENDPOINTS: Record<Resource, (id: string) => string> = {
  post:   (id) => `/post/comment/${id}`,
  shorts: (id) => `/shorts/comments/${id}`,
};

export interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Which resource the comments belong to. */
  resource: Resource;
  /** The post or short being commented on. */
  targetId: string | null;
  currentUser: any;
  /** Told when the count changes, so a feed can update its label. */
  /** Fires with the server's count and its newest comment, so a feed row can
   *  refresh both its badge and the comment it previews. */
  onCountChange?: (targetId: string, count: number, newest?: any) => void;
}

interface CommentModel {
  _id: string;
  text: string;
  commentor?: { _id: string; name?: string; username?: string; avatar?: string };
  replies?: CommentModel[];
  createdAt?: string;
}

export default function CommentsSheet({
  visible, onClose, resource, targetId, currentUser, onCountChange,
}: CommentsSheetProps) {
  const [comments, setComments] = useState<CommentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentModel | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const bottomInset = useBottomInset();
  const [keyboardUp, setKeyboardUp] = useState(false);

  /**
   * The composer needs the navigation-bar inset only while the keyboard is
   * down. With the keyboard up the composer already sits above it, and keeping
   * the inset would leave a band of dead white between the input and the keys.
   */
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardUp(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardUp(false),
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  const currentUserId = String(currentUser?._id ?? currentUser?.id ?? '');

  /**
   * Held in a ref so it never changes fetchComments' identity.
   *
   * Callers pass an inline arrow, which is a new function on every render. With
   * the callback in the dependency array that meant: fetch -> report count ->
   * parent re-renders -> new arrow -> fetchComments changes -> effect re-runs ->
   * fetch again, forever. The sheet reloaded continuously and the feed's comment
   * counter climbed with every pass.
   */
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => { onCountChangeRef.current = onCountChange; }, [onCountChange]);

  /**
   * Tell the parent what this list adds up to.
   *
   * Replies count too — the feed row counts every comment on the post, so
   * reporting only the top-level ones would make the badge drop the moment the
   * sheet opened. The list is newest-first, so its head is the preview.
   */
  const report = useCallback((list: CommentModel[], id: string) => {
    const total = list.reduce((sum, comment) => sum + 1 + (comment.replies?.length ?? 0), 0);
    onCountChangeRef.current?.(id, total, list[0]);
  }, []);

  const fetchComments = useCallback(async (options?: { fresh?: boolean }) => {
    if (!targetId) return;
    setLoading(true);
    try {
      // The GET is cached for a minute server-side. That cache is invalidated
      // when a comment is written, but a refetch that lands before the
      // invalidation — or while the cache store is unreachable — answered with
      // the list from before the comment, which is what made a just-posted
      // comment vanish. A read straight after a write asks for a fresh one.
      const url = ENDPOINTS[resource](targetId) + (options?.fresh ? `?t=${Date.now()}` : '');
      const res = await axios.get(url);
      const list = res.data.comments ?? [];
      setComments(list);
      report(list, targetId);
    } catch {
      // Leaves whatever was already on screen rather than blanking it.
    } finally {
      setLoading(false);
    }
  }, [resource, targetId, report]);

  useEffect(() => {
    if (visible && targetId) fetchComments();
  }, [visible, targetId, fetchComments]);

  const post = async () => {
    const body = text.trim();
    if (!body || !targetId) return;
    setPosting(true);
    try {
      const res = await axios.post(`/${resource}/comment/${targetId}`, {
        text: body,
        parentComment: replyingTo?._id ?? null,
      });
      const parentId = replyingTo?._id;
      setText('');
      setReplyingTo(null);

      // Show it straight away from what the server just handed back, rather
      // than waiting on a refetch to prove it exists.
      const created: CommentModel | undefined = res.data?.comment;
      if (created) {
        setComments((prev) => {
          const next = parentId
            ? prev.map((c) => (c._id === parentId
              ? { ...c, replies: [...(c.replies ?? []), created] }
              : c))
            : [{ ...created, replies: [] }, ...prev];
          report(next, targetId);
          return next;
        });
      }

      fetchComments({ fresh: true });
    } catch (error: any) {
      // The server's own reason, when it gave one — "did not send" alone left
      // nothing to act on.
      console.log('Comment post failed:', error?.response?.status, error?.response?.data);
      Alert.alert(
        'Could not post',
        error?.response?.data?.message || 'Your comment did not send. Try again.',
        [{ text: 'Okay' }],
      );
    } finally {
      setPosting(false);
    }
  };

  const update = async (id: string) => {
    if (!editingText.trim()) return;
    setBusyId(id);
    try {
      await axios.post(`/${resource}/comment/update/${id}`, { text: editingText.trim() });
      setEditingId(null);
      setEditingText('');
      fetchComments({ fresh: true });
    } catch {
      Alert.alert('Could not save', 'That edit did not save.', [{ text: 'Okay' }]);
    } finally {
      setBusyId(null);
    }
  };

  const remove = (id: string) => {
    Alert.alert('Delete comment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            // Shorts historically exposed a POST variant as well; DELETE is the
            // one both resources accept, so it is the only one used here.
            await axios.delete(`/${resource}/comment/${id}`);
            fetchComments({ fresh: true });
          } catch {
            Alert.alert('Could not delete', 'That comment is still there.', [{ text: 'Okay' }]);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const Row = ({ comment, isReply = false }: { comment: CommentModel; isReply?: boolean }) => {
    const mine = String(comment.commentor?._id) === currentUserId;
    const editing = editingId === comment._id;

    return (
      <View className={isReply ? 'ml-10 mt-2' : 'mb-4'}>
        <View className="flex-row">
          <Image
            source={{
              uri: getFullUrl(comment.commentor?.avatar)
                || `https://ui-avatars.com/api/?name=${comment.commentor?.username ?? 'user'}`,
            }}
            style={{ width: 34, height: 34, borderRadius: 17 }}
          />
          <View className="flex-1 ml-3">
            <Text className="font-display text-ink" style={{ fontSize: 13 }}>
              {comment.commentor?.name ?? comment.commentor?.username ?? 'Someone'}
            </Text>

            {editing ? (
              <View className="mt-1">
                <TextInput
                  value={editingText}
                  onChangeText={setEditingText}
                  multiline
                  autoFocus
                  className="bg-white border-2 border-ink rounded-xl px-3 py-2 text-ink"
                  style={{ fontSize: 13 }}
                />
                <View className="flex-row mt-2">
                  <TouchableOpacity
                    onPress={() => update(comment._id)}
                    disabled={busyId === comment._id}
                    className="bg-brand-500 border-2 border-ink rounded-xl px-4 items-center justify-center mr-2"
                    style={{ minHeight: 36 }}
                  >
                    <Text className="font-display text-ink" style={{ fontSize: 11 }}>SAVE</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => { setEditingId(null); setEditingText(''); }}
                    className="bg-card border-2 border-ink rounded-xl px-4 items-center justify-center"
                    style={{ minHeight: 36 }}
                  >
                    <Text className="font-display text-ink" style={{ fontSize: 11 }}>CANCEL</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 13, lineHeight: 18 }}>
                {comment.text}
              </Text>
            )}

            {!editing && (
              <View className="flex-row items-center mt-1.5">
                <Pressable
                  onPress={() => {
                    setReplyingTo(comment);
                    setText(`@${comment.commentor?.username ?? ''} `);
                    inputRef.current?.focus();
                  }}
                  hitSlop={8}
                >
                  <Text className="font-display text-ink-2 uppercase" style={{ fontSize: 10 }}>Reply</Text>
                </Pressable>

                {mine && (
                  <>
                    <Pressable
                      onPress={() => { setEditingId(comment._id); setEditingText(comment.text); }}
                      hitSlop={8}
                      className="ml-4"
                    >
                      <Text className="font-display text-ink-2 uppercase" style={{ fontSize: 10 }}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(comment._id)} hitSlop={8} className="ml-4">
                      <Text className="font-display text-danger uppercase" style={{ fontSize: 10 }}>Delete</Text>
                    </Pressable>
                  </>
                )}

                {busyId === comment._id && <ActivityIndicator size="small" color={C.brand[500]} style={{ marginLeft: 10 }} />}
              </View>
            )}
          </View>
        </View>

        {comment.replies?.map((r) => <Row key={r._id} comment={r} isReply />)}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* 'padding' on both platforms: targetSdk 35 puts the app in Android 15's
          enforced edge-to-edge mode, where the window no longer resizes for the
          keyboard and an undefined behavior means no avoidance at all. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(18,16,14,0.6)' }}
      >
        <Pressable className="flex-1" onPress={onClose} />

        {/* A shrinkable column with the composer as a normal sibling. Pinned
            absolutely inside a fixed-height sheet it could never rise, whatever
            the keyboard did. */}
        <View
          className="bg-paper rounded-t-sheet pt-4 border-t-2 border-x-2 border-ink"
          style={{ height: '50%', flexShrink: 1 }}
        >
          <View className="items-center mb-3">
            <View className="h-1 w-10 bg-ink-3 rounded-full" />
          </View>

          <View className="px-5 mb-3">
            <Text className="font-display text-xl text-ink">Comments</Text>
            <View className="h-[2px] bg-ink mt-1" style={{ width: 44 }} />
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center" style={{ minHeight: 220 }}>
              <ActivityIndicator size="large" color={C.brand[500]} />
            </View>
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(c) => c._id}
              renderItem={({ item }) => <Row comment={item} />}
              className="flex-1"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View className="items-center mt-16 px-10">
                  <Ionicons name="chatbubble-ellipses-outline" size={44} color={C.ink4} />
                  <Text className="font-display text-base text-ink mt-3">No comments yet</Text>
                  <Text className="font-sans text-ink-2 mt-1 text-center" style={{ fontSize: 12 }}>
                    Say the first thing.
                  </Text>
                </View>
              }
            />
          )}

          <View
            className="border-t-2 border-ink bg-white px-3 pt-2"
            style={{ paddingBottom: keyboardUp ? 8 : bottomInset }}
          >
            {replyingTo && (
              <View className="flex-row items-center justify-between bg-paper px-3 py-2 mb-2 rounded-xl mx-2 border-2 border-ink">
                <Text className="font-sans text-ink-2" style={{ fontSize: 12 }}>
                  Replying to <Text className="font-display text-ink">@{replyingTo.commentor?.username}</Text>
                </Text>
                <Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={C.ink3} />
                </Pressable>
              </View>
            )}

            <View className="flex-row items-center px-2">
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={replyingTo ? 'Add a reply...' : 'Add a comment...'}
                placeholderTextColor={C.ink3}
                className="flex-1 text-ink bg-paper border-2 border-ink rounded-xl px-4 mr-2"
                style={{ minHeight: 46, maxHeight: 110, paddingTop: 12, paddingBottom: 12 }}
                multiline
              />
              {/* 52x46, not a bare text label — the old ones were roughly a
                  20px tap target, well under the 44pt minimum. */}
              <TouchableOpacity
                onPress={post}
                disabled={posting || !text.trim()}
                className={`items-center justify-center rounded-xl border-2 border-ink ${!text.trim() ? 'bg-paper' : 'bg-brand-500'}`}
                style={{ width: 52, height: 46, opacity: posting ? 0.6 : 1 }}
                accessibilityRole="button"
                accessibilityLabel={replyingTo ? 'Post reply' : 'Post comment'}
              >
                {posting
                  ? <ActivityIndicator size="small" color={C.ink} />
                  : <Ionicons name="arrow-up" size={20} color={!text.trim() ? '#8B857E' : '#12100E'} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
