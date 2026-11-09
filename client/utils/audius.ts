/**
 * Story music from Audius (open music API meant for apps). Everything streams
 * from Audius; nothing is downloaded to or proxied through our server.
 * https://docs.audius.org — app_name identifies us, no key needed.
 */
const API = 'https://api.audius.co/v1';
const APP = 'app_name=Fync';

export type Track = { id: string; title: string; artist: string; artwork?: string; duration: number };

const toTrack = (t: any): Track => ({
  id: String(t.id),
  title: String(t.title || ''),
  artist: String(t.user?.name || ''),
  artwork: t.artwork?.['150x150'],
  duration: Number(t.duration) || 0,
});

// Only tracks anyone may stream (no paywalled / gated ones).
const playable = (t: any) => t?.is_streamable && !t?.is_stream_gated && t?.access?.stream !== false;

const get = async (path: string): Promise<Track[]> => {
  const res = await fetch(`${API}${path}${path.includes('?') ? '&' : '?'}${APP}`);
  if (!res.ok) throw new Error(`audius ${res.status}`);
  const body = await res.json();
  return (body?.data || []).filter(playable).map(toTrack);
};

export const trendingTracks = () => get('/tracks/trending?limit=30');
export const searchTracks = (q: string) => get(`/tracks/search?query=${encodeURIComponent(q)}&limit=30`);

/** Built from the id only, never from stored text. Audius redirects to the audio. */
export const streamUrl = (id: string) => `${API}/tracks/${encodeURIComponent(id)}/stream?${APP}`;
