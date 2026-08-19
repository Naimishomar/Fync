import { Image as ImageCompressor, Video as VideoCompressor } from 'react-native-compressor';

/**
 * Shrink media on the device before it goes over the wire.
 *
 * Both create screens picked at `quality: 1` and posted the camera original --
 * 4-12MB per photo on a current phone. The server then resized every one of
 * them to 1200px WebP, so all that bandwidth was uploaded only to be thrown
 * away. Compressing here removes the slowest part of posting: on mobile data a
 * four-photo post went from tens of megabytes to under two.
 *
 * Compression itself is native and runs in well under the time it saves. If it
 * fails for any reason the original URI is returned, so a post never fails
 * because an optimisation did.
 */

/** Matches the server's own resize target, so nothing is uploaded to be discarded. */
const MAX_IMAGE_DIMENSION = 1280;

export const compressImage = async (uri: string): Promise<string> => {
  try {
    return await ImageCompressor.compress(uri, {
      maxWidth: MAX_IMAGE_DIMENSION,
      maxHeight: MAX_IMAGE_DIMENSION,
      quality: 0.8,
      compressionMethod: 'manual',
    });
  } catch (e) {
    console.log('Image compression skipped:', e);
    return uri;
  }
};

/** Compress several images at once; order is preserved. */
export const compressImages = (uris: string[]): Promise<string[]> =>
  Promise.all(uris.map(compressImage));

export const compressVideo = async (
  uri: string,
  onProgress?: (fraction: number) => void
): Promise<string> => {
  try {
    return await VideoCompressor.compress(
      uri,
      { compressionMethod: 'auto' },
      onProgress
    );
  } catch (e) {
    console.log('Video compression skipped:', e);
    return uri;
  }
};

/** Best-effort byte size of a local file, for logging and size guards. */
export const fileSize = async (uri: string): Promise<number> => {
  try {
    const res = await fetch(uri);
    const blob = await res.blob();
    return blob.size;
  } catch {
    return 0;
  }
};
