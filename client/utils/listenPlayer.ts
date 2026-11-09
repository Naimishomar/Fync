import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Audio, type AVPlaybackStatus } from 'expo-av';
import socket from './socket';
import { streamUrl } from './audius';

/**
 * Listen Together playback (backend controllers/listen.socket.js).
 *
 * The server's state says "track T was at `position` ms at server time
 * `anchorAt`". Each phone measures its clock offset to the server, computes
 * where the song should be right now, and seeks there. Everything below is
 * about doing that robustly:
 *  - offset from the fastest of several pings (least network noise), redone on
 *    reconnect and when the app comes back to the foreground;
 *  - a stale load (track changed while the previous was loading) is dropped;
 *  - drift is checked every 2s and only corrected past 600ms, so small jitter
 *    doesn't cause audible seeking;
 *  - a load failure retries with backoff on this phone only; others keep playing;
 *  - when the song ends here we nudge the server (lt:action next with the
 *    track key), which is idempotent across everyone's phones.
 */

export type LtTrack = { key: string; id: string; title: string; artist: string; artwork?: string | null; duration: number; addedBy?: string };
export type LtState = {
  id: string; code: string;
  members: { userId: string; name?: string; username?: string; avatar?: string }[];
  online: string[];
  track: LtTrack | null; queue: LtTrack[];
  playing: boolean; position: number; anchorAt: number; version: number; serverNow: number;
};

const DRIFT_MS = 600;
const CHECK_MS = 2000;

/** Server clock minus local clock, from the lowest-RTT of `n` pings. */
export async function measureOffset(n = 5): Promise<number | null> {
  let best: { rtt: number; offset: number } | null = null;
  for (let i = 0; i < n; i++) {
    const t0 = Date.now();
    try {
      const server: number = await socket.timeout(3000).emitWithAck('lt:time', {});
      const t1 = Date.now();
      const sample = { rtt: t1 - t0, offset: server - (t0 + t1) / 2 };
      if (!best || sample.rtt < best.rtt) best = sample;
    } catch { /* lost ping: try the next */ }
  }
  return best ? best.offset : null;
}

/** Where the song should be now, in ms, given the server state and our offset. */
export const expectedPosition = (st: LtState, offset: number, now = Date.now()) => {
  if (!st.track) return 0;
  const p = st.playing ? st.position + (now + offset - st.anchorAt) : st.position;
  return Math.max(0, Math.min(p, st.track.duration * 1000));
};

export type PlayerStatus = 'idle' | 'loading' | 'buffering' | 'ready' | 'error';

export function useSyncedPlayer(state: LtState | null, onEnded: (trackKey: string) => void) {
  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [reload, setReload] = useState(0);
  const offset = useRef(0);
  const sound = useRef<Audio.Sound | null>(null);
  const loadedKey = useRef<string | null>(null);
  const token = useRef(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const endedSent = useRef<string | null>(null);
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const nudgeEnded = useCallback((key: string) => {
    if (endedSent.current === key) return; // once per track per phone
    endedSent.current = key;
    onEndedRef.current(key);
  }, []);

  /** Bring the loaded sound in line with the current server state. */
  const apply = useCallback(async () => {
    const st = stateRef.current;
    const s = sound.current;
    if (!st?.track || !s || loadedKey.current !== st.track.key) return;
    const want = expectedPosition(st, offset.current);
    const end = st.track.duration * 1000;
    try {
      if (st.playing && want >= end - 250) {
        await s.pauseAsync();
        nudgeEnded(st.track.key);
        return;
      }
      const cur = await s.getStatusAsync();
      const at = cur.isLoaded ? cur.positionMillis : 0;
      if (Math.abs(at - want) > DRIFT_MS || !st.playing) await s.setPositionAsync(want);
      if (st.playing) await s.playAsync();
      else await s.pauseAsync();
    } catch { /* sound unloaded mid-call: the next state change re-applies */ }
  }, [nudgeEnded]);

  const resync = useCallback(async () => {
    const o = await measureOffset();
    if (o !== null) offset.current = o;
    apply();
  }, [apply]);

  // Audio mode once: keep playing when the screen locks / app is backgrounded.
  useEffect(() => {
    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      shouldDuckAndroid: true,
    }).catch(() => {});
  }, []);

  // Clock offset: now, on every reconnect, and back from background.
  useEffect(() => {
    resync();
    const onConnect = () => { resync(); };
    socket.on('connect', onConnect);
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') resync(); });
    return () => { socket.off('connect', onConnect); sub.remove(); };
  }, [resync]);

  // (Re)load when the track changes. Stale loads are discarded by token.
  const trackKey = state?.track?.key ?? null;
  const trackId = state?.track?.id ?? null;
  useEffect(() => {
    const my = ++token.current;
    const old = sound.current;
    sound.current = null;
    loadedKey.current = null;
    old?.unloadAsync().catch(() => {});
    if (!trackKey || !trackId) { setStatus('idle'); return; }
    setStatus('loading');
    let cancelled = false;

    const onStatus = (st: AVPlaybackStatus) => {
      if (token.current !== my || !st.isLoaded) return;
      if (st.didJustFinish) nudgeEnded(trackKey);
      setStatus(st.isBuffering && st.isPlaying === false && stateRef.current?.playing ? 'buffering' : 'ready');
    };

    const load = async (attempt: number): Promise<void> => {
      try {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri: streamUrl(trackId) },
          { shouldPlay: false, progressUpdateIntervalMillis: 500 },
          onStatus,
        );
        if (cancelled || token.current !== my) { s.unloadAsync().catch(() => {}); return; }
        sound.current = s;
        loadedKey.current = trackKey;
        endedSent.current = null;
        setStatus('ready');
        await apply();
      } catch {
        if (cancelled || token.current !== my) return;
        if (attempt >= 3) { setStatus('error'); return; }
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        return load(attempt + 1);
      }
    };
    load(0);
    return () => { cancelled = true; };
  }, [trackKey, trackId, reload, apply, nudgeEnded]);

  // Every server update (play/pause/seek/skip by anyone).
  const version = state?.version;
  const playing = state?.playing;
  useEffect(() => { apply(); }, [version, playing, apply]);

  // Drift check while playing.
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { if (status === 'ready') apply(); }, CHECK_MS);
    return () => clearInterval(t);
  }, [playing, status, apply]);

  // Leaving the screen: stop and free the sound.
  useEffect(() => () => {
    token.current++;
    sound.current?.unloadAsync().catch(() => {});
    sound.current = null;
  }, []);

  // Re-run the load effect for this phone (after a load error).
  const retry = useCallback(() => setReload((n) => n + 1), []);

  return { status, offset, retry };
}
