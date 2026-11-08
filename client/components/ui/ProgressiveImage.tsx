import React, { memo, useState } from 'react';
import { Image, type ImageProps } from 'expo-image';
import { getFullUrl, getThumbUrl } from '../../utils/imageUtils';
import { C } from '../../constants/colors';

/**
 * Image that shows its small `_sm` twin (≈400px, a few KB) straight away and
 * cross-fades to the full file when it lands — the photo appears at once,
 * blurred-soft, instead of a grey box. Old uploads without a twin still work:
 * nginx serves the full file for a missing `_sm`.
 *
 *   <ProgressiveImage path={post.image[0]} style={{ width, height: width }} />
 */
export const ProgressiveImage = memo(function ProgressiveImage({
  path, style, contentFit = 'cover', thumbOnly, ...rest
}: Omit<ImageProps, 'source' | 'placeholder'> & {
  path?: string | null;
  /** Small tiles (grids): load only the `_sm` twin, never the full file. */
  thumbOnly?: boolean;
}) {
  const full = getFullUrl(path) ?? undefined;
  const thumb = getThumbUrl(path) ?? undefined;
  // A non-media URL has no `_sm` twin and nginx can't fall back for it, so a
  // thumbnail that fails drops to the full file.
  const [thumbFailed, setThumbFailed] = useState(false);
  const src = thumbOnly && !thumbFailed ? thumb : full;
  return (
    <Image
      {...rest}
      source={src ? { uri: src } : undefined}
      placeholder={!thumbOnly && thumb ? { uri: thumb } : undefined}
      placeholderContentFit={contentFit as any}
      contentFit={contentFit}
      transition={200}
      cachePolicy="memory-disk"
      recyclingKey={src}
      onError={thumbOnly && !thumbFailed ? () => setThumbFailed(true) : rest.onError}
      style={[{ backgroundColor: C.paper2 }, style]}
    />
  );
});

export default ProgressiveImage;
