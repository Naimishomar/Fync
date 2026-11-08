import React, { useState } from 'react';
import { Modal, Pressable, useWindowDimensions } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { getFullUrl } from '../../utils/imageUtils';
import { C } from '../../constants/colors';

/**
 * Wraps an avatar so a tap opens the photo large over a dimmed screen,
 * Instagram-style. Tap anywhere or press back to close. Without a photo the
 * avatar is not tappable.
 */
export default function AvatarZoom({
  avatar, className, children,
}: { avatar?: string | null; className?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { width } = useWindowDimensions();
  const uri = getFullUrl(avatar) ?? undefined;
  const size = width * 0.78;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        disabled={!uri}
        className={`${className ?? ''} active:opacity-85`}
        accessibilityRole="imagebutton"
        accessibilityLabel="View profile photo"
      >
        {children}
      </Pressable>
      <Modal visible={open} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          className="flex-1 items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
          accessibilityRole="button"
          accessibilityLabel="Close photo"
        >
          <ExpoImage
            source={{ uri }}
            style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.paper2 }}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        </Pressable>
      </Modal>
    </>
  );
}
