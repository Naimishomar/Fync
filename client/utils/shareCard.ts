import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://fync-api.duckdns.org';

/**
 * Share the server-rendered card image (backend routes/shareCard.route.js) for a
 * post or profile. Any failure (offline, 404 for a private post, no share
 * target) runs `fallback`, the old link share, whose preview shows the same card.
 */
export async function shareCard(kind: 'post' | 'u', id: string, dialogTitle: string, fallback: () => Promise<unknown>) {
  try {
    if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw new Error('no share target');
    const { uri, status } = await FileSystem.downloadAsync(
      `${BACKEND_URL}/card/${kind}/${id}.png`,
      `${FileSystem.cacheDirectory}fync-${kind}-${id}.png`,
    );
    if (status !== 200) throw new Error(`card ${status}`);
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle, UTI: 'public.png' });
  } catch {
    await fallback().catch(() => {});
  }
}
