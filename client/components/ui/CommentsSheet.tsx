import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, Modal, FlatList, TextInput, Pressable, TouchableOpacity,
  ActivityIndicator, Platform, Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { Alert } from './AlertModal';
import { getFullUrl } from '../../utils/imageUtils';
import { useBottomInset } from '../../constants/layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { Button, Empty } from './kit';

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
  /** Adds Report to other people's comments; call `hide` once it is reported. */
  onReport?: (comment: CommentModel, hide: () => void) => void;
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
  onReport?: (comment: CommentModel) => void;
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
                className="bg-paper-2 rounded-2xl px-3 py-2 text-ink"
                style={{ fontSize: 13 }}
              />
              <View className="flex-row mt-2">
                <TouchableOpacity
                  onPress={() => ctx.onSave(comment._id)}
                  disabled={ctx.busyId === comment._id}
                  className="bg-brand-500 rounded-full px-4 items-center justify-center mr-2"
                  style={{ minHeight: 34 }}
                >
                  <Text className="font-semibold text-on-brand" style={{ fontSize: 12 }}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={ctx.onCancelEdit}
                  className="bg-paper-2 rounded-full px-4 items-center justify-center"
                  style={{ minHeight: 34 }}
                >
                  <Text className="font-semibold text-ink" style={{ fontSize: 12 }}>Cancel</Text>
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

              {!mine && ctx.onReport && (
                <Pressable onPress={() => ctx.onReport!(comment)} hitSlop={8} className={ctx.canReply ? "ml-4" : ""}>
                  <Text className="font-display text-ink-3 uppercase" style={{ fontSize: 10 }}>Report</Text>
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
  visible, onClose, resource, targetId, currentUser, onCountChange, title = 'Comments', onReport,
}: CommentsSheetProps) {
  const api = typeof resource === 'string' ? BUILT_IN[resource] : resource;
  // Held in a ref: callers build the api object inline, and a fresh object per
  // render must not re-trigger the fetch effect.
  const apiRef = useRef(api);
  apiRef.current = api;
  const apiKey = api.list('');
  const [comments, setComments] = useState<CommentModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
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
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const navBarInset = useSafeAreaInsets().bottom;
  const keyboardUp = keyboardHeight > 0;

  /**
   * The sheet lifts by the keyboard's own height. A KeyboardAvoidingView inside
   * a Modal does nothing on Android edge-to-edge (the modal window never
   * resizes), which left the composer under the keys. With the keyboard up the
   * composer also drops the nav-bar inset, or a dead band sits above the keys.
   */
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      // Android reports the keyboard height with the nav bar subtracted
      // (ime - systemBars insets), but this edge-to-edge modal reaches under the
      // nav bar, so lifting by that height alone left the composer hidden
      // behind exactly the nav bar's height. iOS reports the full height.
      (e) => setKeyboardHeight(e.endCoordinates.height + (Platform.OS === 'android' ? navBarInset : 0)),
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0),
    );
    return () => { show.remove(); hide.remove(); };
  }, [navBarInset]);

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
      // `t` makes a new server cache key (the server keys on the full URL), and
      // axiosConfig never stores timestamp-busted URLs, so this one is fresh end to end.
      const res = await axios.get(base, options?.fresh ? { params: { t: Date.now() } } : undefined);
      const raw: any[] = (pick ? pick(res.data) : res.data?.comments) ?? [];
      const list = normalize ? raw.map(normalize) : raw;
      if (seq !== fetchSeq.current) return;
      setLoadFailed(false);
      setComments(list);
      report(list, targetId);
    } catch {
      // Leaves whatever was already on screen rather than blanking it; the
      // flag only shows when there is nothing on screen to keep.
      if (seq === fetchSeq.current) setLoadFailed(true);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [apiKey, targetId, report]);

  useEffect(() => {
    if (visible && targetId) fetchComments();
  }, [visible, targetId, fetchComments]);

  // A reply or edit left open on one post must not carry over to the next:
  // the reply would be filed under a comment id the new post does not have.
  useEffect(() => {
    setReplyingTo(null);
    setReplyRoot(null);
    setEditingId(null);
    setEditingText('');
    setText('');
  }, [targetId]);

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
  const reportRef = useRef(onReport);
  reportRef.current = onReport;
  const canReport = !!onReport;
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
    // Reported comments (and their replies) leave this list at once.
    onReport: canReport ? (comment) => reportRef.current?.(comment, () => setComments((prev) => prev
      .filter((c) => c._id !== comment._id)
      .map((c) => (c.replies ? { ...c, replies: c.replies.filter((r) => r._id !== comment._id) } : c)))) : undefined,
  }), [currentUserId, editingId, editingText, busyId, canReply, canEdit, canDelete, canReport]);

  const renderComment = useCallback(
    ({ item }: { item: CommentModel }) => <CommentRow comment={item} ctx={rowCtx} />,
    [rowCtx],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end" style={{ backgroundColor: C.scrim }}>
        <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close comments" />

        {/* Bottom sheet, Shahparpay-style: handle, a header row with a close
            button, the list, and the composer pinned under a hairline. */}
        <View
          className="bg-card rounded-t-3xl border-t border-line"
          style={{ height: '72%', maxHeight: '92%', marginBottom: keyboardHeight, flexShrink: 1 }}
        >
          <View className="items-center pt-3">
            <View className="h-1 w-10 bg-line rounded-full" />
          </View>

          <View className="flex-row items-center px-5 py-3 border-b border-line" style={{ gap: 12 }}>
            <View className="flex-1 min-w-0">
              <Text className="font-semibold text-ink" style={{ fontSize: 17 }} accessibilityRole="header">{title}</Text>
              {!loading && comments.length > 0 && (
                <Text className="font-sans text-ink-3 text-xs mt-0.5">
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </Text>
              )}
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              className="w-10 h-10 rounded-full bg-paper-2 items-center justify-center active:opacity-60"
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={C.ink2} />
            </Pressable>
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
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, flexGrow: 1 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={loadFailed ? (
                <View className="mt-10">
                  <Empty
                    icon="cloud-offline-outline"
                    title="Couldn't load comments"
                    action={<Button title="Try again" onPress={() => fetchComments()} />}
                  />
                </View>
              ) : (
                <View className="flex-1 items-center justify-center px-10" style={{ gap: 8 }}>
                  <View className="w-14 h-14 rounded-full bg-paper-2 items-center justify-center">
                    <Ionicons name="chatbubble-outline" size={24} color={C.ink3} />
                  </View>
                  <Text className="font-semibold text-base text-ink">No comments yet</Text>
                  <Text className="font-sans text-ink-3 text-center" style={{ fontSize: 13 }}>
                    Start the conversation.
                  </Text>
                </View>
              )}
            />
          )}

          <View
            className="border-t border-line bg-card px-4 pt-3"
            style={{ paddingBottom: keyboardUp ? 10 : bottomInset }}
          >
            {replyingTo && (
              <View className="flex-row items-center justify-between bg-paper-2 px-3 py-2 mb-2 rounded-full">
                <Text className="font-sans text-ink-2 flex-1" style={{ fontSize: 12 }} numberOfLines={1}>
                  Replying to <Text className="font-semibold text-ink">@{replyingTo.commentor?.username}</Text>
                </Text>
                <Pressable onPress={() => { setReplyingTo(null); setReplyRoot(null); }} hitSlop={8} accessibilityLabel="Cancel reply">
                  <Ionicons name="close-circle" size={18} color={C.ink3} />
                </Pressable>
              </View>
            )}

            <View className="flex-row items-end" style={{ gap: 8 }}>
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                placeholder={replyingTo ? 'Add a reply…' : 'Add a comment…'}
                placeholderTextColor={C.ink3}
                className="flex-1 text-ink bg-paper-2 rounded-3xl px-4 font-sans"
                style={{ minHeight: 44, maxHeight: 110, paddingTop: 11, paddingBottom: 11, fontSize: 15 }}
                multiline
              />
              <TouchableOpacity
                onPress={post}
                disabled={posting || !text.trim()}
                className={`items-center justify-center rounded-full ${!text.trim() ? 'bg-paper-2' : 'bg-brand-500'}`}
                style={{ width: 44, height: 44, opacity: posting ? 0.6 : 1 }}
                accessibilityRole="button"
                accessibilityLabel={replyingTo ? 'Post reply' : 'Post comment'}
              >
                {posting
                  ? <ActivityIndicator size="small" color={C.onBrand} />
                  : <Ionicons name="arrow-up" size={20} color={!text.trim() ? C.ink3 : C.onBrand} />}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
