import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, Pressable, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
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

/**
 * How one resource stores comments. Every other surface (notices, confessions,
 * community posts, funding…) used to carry its own copy of this sheet just
 * because its routes were spelled differently. Describe the routes here instead.
 *
 * `update` / `remove` / `replies` are optional: leave one out and the sheet
 * hides that action rather than offering something the server cannot do.
 */
export interface CommentsApi {
  /** GET path for the list. */
  list: (targetId: string) => string;
  /** POST path for a new comment. */
  add: (targetId: string) => string;
  /** Request body for `add`. Default `{ text, parentComment }`. `reply` carries the
   *  top-level comment and the replied-to author, for servers that only accept
   *  one level of nesting or that @-mention the person replied to. */
  body?: (
    text: string,
    parentId: string | null,
    reply: { rootId: string; userId?: string } | null,
  ) => object;
  /** Pull the array out of the GET response. Default `data.comments`. */
  pick?: (data: any) => any[];
  /** Map a server row onto the sheet's shape (author field names differ). */
  normalize?: (raw: any) => CommentModel;
  replies?: boolean;
  update?: (commentId: string) => string;
  remove?: (commentId: string) => { method: 'delete' | 'post'; url: string };
}

const BUILT_IN: Record<Resource, CommentsApi> = {
  post: {
    list: (id) => `/post/comment/${id}`,
    add: (id) => `/post/comment/${id}`,
    replies: true,
    update: (id) => `/post/comment/update/${id}`,
    remove: (id) => ({ method: 'delete', url: `/post/comment/${id}` }),
  },
  shorts: {
    list: (id) => `/shorts/comments/${id}`,
    add: (id) => `/shorts/comment/${id}`,
    replies: true,
    update: (id) => `/shorts/comment/update/${id}`,
    // Shorts historically exposed a POST variant as well; DELETE is the one
    // both resources accept.
    remove: (id) => ({ method: 'delete', url: `/shorts/comment/${id}` }),
  },
};

export interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Which resource the comments belong to: a built-in name, or its routes. */
  resource: Resource | CommentsApi;
  /** Sheet heading. */
  title?: string;
  /** The post or short being commented on. */
  targetId: string | null;
  currentUser: any;
  /** Told when the count changes, so a feed can update its label. */
  /** Fires with the server's count and its newest comment, so a feed row can
   *  refresh both its badge and the comment it previews. */
  onCountChange?: (targetId: string, count: number, newest?: any) => void;
}

export interface CommentModel {
  _id: string;
  text: string;
  commentor?: { _id: string; name?: string; username?: string; avatar?: string };
  replies?: CommentModel[];
  replyToUser?: { _id?: string; username?: string } | null;
  createdAt?: string;
}

/** What a row needs from the sheet. */
interface RowCtx {
  currentUserId: string;
  editingId: string | null;
  editingText: string;
  busyId: string | null;
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  setEditingText: (text: string) => void;
  onReply: (comment: CommentModel, root: CommentModel) => void;
  onEdit: (comment: CommentModel) => void;
  onCancelEdit: () => void;
  onSave: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Declared at module level: defined inside the sheet it was a new component
 * type every render, so each keystroke remounted every row — images reloaded
 * and the edit box lost focus.
 */
const CommentRow = React.memo(function CommentRow({
  comment, root, ctx,
}: { comment: CommentModel; root?: CommentModel; ctx: RowCtx }) {
  const isReply = !!root;
  const mine = String(comment.commentor?._id) === ctx.currentUserId;
  const editing = ctx.editingId === comment._id;

  return (
    <View className={isReply ? 'ml-10 mt-2' : 'mb-4'}>
      <View className="flex-row">
        <Image
          source={{
            uri: getFullUrl(comment.commentor?.avatar)
              || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.commentor?.username ?? 'user')}`,
          }}
          style={{ width: 34, height: 34, borderRadius: 17 }}
          cachePolicy="memory-disk"
        />
        <View className="flex-1 ml-3">
          <Text className="font-display text-ink" style={{ fontSize: 13 }} numberOfLines={1}>
            {comment.commentor?.name ?? comment.commentor?.username ?? 'Someone'}
          </Text>

          {editing ? (
            <View className="mt-1">
              <TextInput
                value={ctx.editingText}
                onChangeText={ctx.setEditingText}
                multiline
                autoFocus
                className="bg-white border-2 border-ink rounded-xl px-3 py-2 text-ink"
                style={{ fontSize: 13 }}
              />
              <View className="flex-row mt-2">
                <TouchableOpacity
                  onPress={() => ctx.onSave(comment._id)}
                  disabled={ctx.busyId === comment._id}
                  className="bg-brand-500 border-2 border-ink rounded-xl px-4 items-center justify-center mr-2"
                  style={{ minHeight: 36 }}
                >
                  <Text className="font-display text-ink" style={{ fontSize: 11 }}>SAVE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={ctx.onCancelEdit}
                  className="bg-card border-2 border-ink rounded-xl px-4 items-center justify-center"
                  style={{ minHeight: 36 }}
                >
                  <Text className="font-display text-ink" style={{ fontSize: 11 }}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <Text className="font-sans text-ink-2 mt-[2px]" style={{ fontSize: 13, lineHeight: 18 }}>
              {comment.replyToUser?.username && !comment.text?.startsWith('@') ? (
                <Text className="font-display text-ink">@{comment.replyToUser.username} </Text>
              ) : null}
              {comment.text}
            </Text>
          )}

          {!editing && (
            <View className="flex-row items-center mt-1.5">
              {ctx.canReply && (
              <Pressable onPress={() => ctx.onReply(comment, root ?? comment)} hitSlop={8}>
                <Text className="font-display text-ink-2 uppercase" style={{ fontSize: 10 }}>Reply</Text>
              </Pressable>
              )}

              {mine && ctx.canEdit && (
                <Pressable
                  onPress={() => ctx.onEdit(comment)}
                  hitSlop={8}
                  className={ctx.canReply ? "ml-4" : ""}
                >
                  <Text className="font-display text-ink-2 uppercase" style={{ fontSize: 10 }}>Edit</Text>
                </Pressable>
              )}
              {mine && ctx.canDelete && (
                <Pressable onPress={() => ctx.onDelete(comment._id)} hitSlop={8} className="ml-4">
                  <Text className="font-display text-danger uppercase" style={{ fontSize: 10 }}>Delete</Text>
                </Pressable>
              )}

              {ctx.busyId === comment._id && <ActivityIndicator size="small" color={C.brand[500]} style={{ marginLeft: 10 }} />}
            </View>
          )}
        </View>
      </View>

      {comment.replies?.map((r) => <CommentRow key={r._id} comment={r} root={root ?? comment} ctx={ctx} />)}
    </View>
  );
});

export default function CommentsSheet({
  visible, onClose, resource, targetId, currentUser, onCountChange, title = 'Comments',
}: CommentsSheetProps) {
  const api = typeof resource === 'string' ? BUILT_IN[resource] : resource;
  // Held in a ref: callers build the api object inline, and a fresh object per
  // render must not re-trigger the fetch effect.
  const apiRef = useRef(api);
  apiRef.current = api;
  const apiKey = api.list('');
  const [comments, setComments] = useState<CommentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<CommentModel | null>(null);
  /** Top-level comment of the thread being replied in. */
  const [replyRoot, setReplyRoot] = useState<CommentModel | null>(null);
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

  /** Bumped per fetch, so a slow reply for an earlier post cannot land on a later one. */
  const fetchSeq = useRef(0);
  const loadedFor = useRef<string | null>(null);

  const fetchComments = useCallback(async (options?: { fresh?: boolean }) => {
    if (!targetId) return;
    const seq = ++fetchSeq.current;
    // A refetch after a write keeps the list on screen; only a first load (or a
    // different post) swaps it for the spinner.
    if (!options?.fresh) setLoading(true);
    if (loadedFor.current !== targetId) {
      loadedFor.current = targetId;
      setComments([]);
    }
    try {
      // The GET is cached for a minute server-side. That cache is invalidated
      // when a comment is written, but a refetch that lands before the
      // invalidation — or while the cache store is unreachable — answered with
      // the list from before the comment, which is what made a just-posted
      // comment vanish. A read straight after a write asks for a fresh one.
      const { list: listPath, pick, normalize } = apiRef.current;
      const base = listPath(targetId);
      const url = base + (options?.fresh ? `${base.includes('?') ? '&' : '?'}t=${Date.now()}` : '');
      const res = await axios.get(url);
      const raw: any[] = (pick ? pick(res.data) : res.data?.comments) ?? [];
      const list = normalize ? raw.map(normalize) : raw;
      if (seq !== fetchSeq.current) return;
      setComments(list);
      report(list, targetId);
    } catch {
      // Leaves whatever was already on screen rather than blanking it.
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [apiKey, targetId, report]);

  useEffect(() => {
    if (visible && targetId) fetchComments();
  }, [visible, targetId, fetchComments]);

  const post = async () => {
    const body = text.trim();
    if (!body || !targetId || posting) return;
    setPosting(true);
    try {
      const reply = replyingTo
        ? { rootId: (replyRoot ?? replyingTo)._id, userId: replyingTo.commentor?._id }
        : null;
      // Every comment backend here nests one level (getCommentThread), so a
      // reply to a reply is filed under the thread's top-level comment — sent
      // with the reply's own id it vanished on the next refetch.
      const parent = reply?.rootId ?? null;
      const res = await axios.post(
        api.add(targetId),
        api.body ? api.body(body, parent, reply) : { text: body, parentComment: parent },
      );
      // The optimistic insert can only place it under a top-level row.
      const parentId = reply?.rootId;
      setText('');
      setReplyingTo(null);
      setReplyRoot(null);

      // Show it straight away from what the server just handed back, rather
      // than waiting on a refetch to prove it exists.
      const createdRaw = res.data?.comment;
      const created: CommentModel | undefined =
        createdRaw && api.normalize ? api.normalize(createdRaw) : createdRaw;
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
    if (!editingText.trim() || !api.update) return;
    setBusyId(id);
    try {
      await axios.post(api.update(id), { text: editingText.trim() });
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
    if (!api.remove) return;
    const { method, url } = api.remove(id);
    Alert.alert('Delete comment', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(id);
          try {
            await (method === 'delete' ? axios.delete(url) : axios.post(url));
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

  const updateRef = useRef(update);
  updateRef.current = update;
  const removeRef = useRef(remove);
  removeRef.current = remove;

  // Booleans, not the functions: callers build `api` inline.
  const canReply = !!api.replies;
  const canEdit = !!api.update;
  const canDelete = !!api.remove;
  const rowCtx = useMemo<RowCtx>(() => ({
    currentUserId,
    editingId,
    editingText,
    busyId,
    canReply,
    canEdit,
    canDelete,
    setEditingText,
    onReply: (comment, root) => {
      setReplyingTo(comment);
      setReplyRoot(root);
      setText(`@${comment.commentor?.username ?? ''} `);
      inputRef.current?.focus();
    },
    onEdit: (comment) => { setEditingId(comment._id); setEditingText(comment.text); },
    onCancelEdit: () => { setEditingId(null); setEditingText(''); },
    onSave: (id) => updateRef.current(id),
    onDelete: (id) => removeRef.current(id),
  }), [currentUserId, editingId, editingText, busyId, canReply, canEdit, canDelete]);

  const renderComment = useCallback(
    ({ item }: { item: CommentModel }) => <CommentRow comment={item} ctx={rowCtx} />,
    [rowCtx],
  );

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
            <Text className="font-display text-xl text-ink">{title}</Text>
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
              renderItem={renderComment}
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
                <Pressable onPress={() => { setReplyingTo(null); setReplyRoot(null); }} hitSlop={8}>
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
