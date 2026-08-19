import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import axios from '../context/axiosConfig';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_KEY || '';

/**
 * Identity for Supabase requests.
 *
 * Nothing in this app ever established a Supabase auth session, so every chat
 * query reached Postgres as the anonymous role with `auth.uid()` NULL. No RLS
 * policy can identify a caller it cannot see, so the tables have to be open for
 * the chat to work -- and the anon key ships inside the app bundle. The backend
 * already knows who the user is, so it signs a Supabase-format JWT carrying the
 * Fync user id in `sub`, and policies match on `auth.jwt() ->> 'sub'`.
 *
 * Cached and refreshed a minute before expiry: this callback runs on every
 * request and must not become a round trip of its own.
 *
 * If the backend has no SUPABASE_JWT_SECRET configured it reports
 * `configured: false` and this returns null, which falls back to the anon key --
 * exactly the behaviour before this change, so the app keeps working while the
 * policies are being rolled out. See backend/docs/supabase-rls.sql.
 */
let cachedToken: string | null = null;
let cachedUntil = 0;
let inflight: Promise<string | null> | null = null;
/** Set once the backend reports the secret is not configured; stops retrying. */
let unavailable = false;

const REFRESH_MARGIN_MS = 60_000;

const fetchToken = async (): Promise<string | null> => {
  try {
    const res = await axios.get('/chat/realtime-token');
    if (res.data?.configured === false) {
      unavailable = true;
      return null;
    }
    if (!res.data?.token) return null;
    cachedToken = res.data.token;
    cachedUntil = Date.now() + (res.data.expiresIn ?? 3600) * 1000 - REFRESH_MARGIN_MS;
    return cachedToken;
  } catch {
    // Network failure or a logged-out user. Fall back to the anon key rather
    // than blocking every Supabase call behind an auth round trip.
    return null;
  } finally {
    inflight = null;
  }
};

const getSupabaseAccessToken = async (): Promise<string | null> => {
  if (unavailable) return null;
  if (cachedToken && Date.now() < cachedUntil) return cachedToken;
  // Collapse the stampede: a screen mount fires several queries at once and
  // they must not each mint their own token.
  if (!inflight) inflight = fetchToken();
  return inflight;
};

/** Called on sign-out so the next user does not inherit this one's identity. */
export const clearSupabaseAuth = () => {
  cachedToken = null;
  cachedUntil = 0;
  inflight = null;
  unavailable = false;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  // Supplying accessToken means this client does not manage its own auth
  // session -- which is correct here, since Fync's backend is the identity
  // provider and supabase.auth was never used.
  accessToken: getSupabaseAccessToken,
});

/**
 * Unread counts per conversation, derived from `messages.seen`.
 *
 * There used to be a `conversations.unreadCount` jsonb counter that both the
 * sender and the receiver read-modify-wrote concurrently, so increments were
 * lost; the header badge read a *third* copy out of Mongo that nothing reset,
 * so it either sat at zero (text messages never touched Mongo) or grew forever
 * (media messages did). Deriving from `seen` removes all three copies.
 */
export const fetchUnreadCounts = async (
  userId: string,
  conversationIds?: string[]
): Promise<Record<string, number>> => {
  let ids = conversationIds;

  if (!ids) {
    const { data } = await supabase
      .from('conversations')
      .select('_id')
      .contains('participants', `[{"_id": "${userId}"}]`);
    ids = (data || []).map((c: any) => c._id);
  }

  if (!ids.length) return {};

  const { data, error } = await supabase
    .from('messages')
    .select('conversationId')
    .in('conversationId', ids)
    .eq('seen', false)
    .filter('sender->>_id', 'neq', userId);

  if (error) {
    console.log('fetchUnreadCounts error', error);
    return {};
  }

  const counts: Record<string, number> = {};
  (data || []).forEach((m: any) => {
    counts[m.conversationId] = (counts[m.conversationId] || 0) + 1;
  });
  return counts;
};
