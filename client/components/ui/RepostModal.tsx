import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Avatar from '../Avatar';
import { C } from '../../constants/colors';
import { useBottomInset } from '../../constants/layout';
import { tapHaptic } from '../../utils/haptics';

const MAX_LENGTH = 1000;

/**
 * Confirm sheet for a repost, with the optional note the reposter adds.
 *
 * Reposting used to be a single unconfirmed tap, which is a public action
 * taken by accident more often than on purpose. The note is optional: sharing
 * something without a word is still the common case.
 */
export default function RepostModal({
  visible,
  onClose,
  onConfirm,
  author,
  preview,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void | Promise<void>;
  /** The original poster, shown so it is clear what is being shared. */
  author?: { name?: string; username?: string; avatar?: string } | null;
  /** First line of the post being shared. */
  preview?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomInset = useBottomInset();

  const close = () => {
    setText('');
    onClose();
  };

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    tapHaptic();
    try {
      await onConfirm(text.trim());
      setText('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: C.scrim }} onPress={close}>
        <KeyboardAvoidingView behavior="padding">
          {/* Stops a tap inside the sheet from closing it. */}
          <Pressable onPress={() => {}} className="bg-card rounded-t-sheet p-5" style={{ paddingBottom: bottomInset + 8 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="font-display text-lg text-ink">Repost</Text>
              <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel">
                <Ionicons name="close" size={22} color={C.ink} />
              </Pressable>
            </View>

            <TextInput
              value={text}
              onChangeText={(v) => setText(v.slice(0, MAX_LENGTH))}
              placeholder="Add your thoughts (optional)"
              placeholderTextColor={C.ink3}
              multiline
              autoFocus
              className="font-sans text-base text-ink bg-paper-2 rounded-card p-3"
              style={{ minHeight: 90, maxHeight: 160, textAlignVertical: 'top' }}
            />

            {!!author && (
              <View className="flex-row items-center mt-3 p-3 bg-paper-2 rounded-card">
                <Avatar user={author as any} size={28} />
                <View className="ml-2 flex-1">
                  <Text className="font-semibold text-sm text-ink">
                    {author.name || author.username || 'Unknown'}
                  </Text>
                  {!!preview && (
                    <Text className="text-ink-3 text-xs mt-0.5" numberOfLines={1}>
                      {preview}
                    </Text>
                  )}
                </View>
              </View>
            )}

            <View className="flex-row justify-end items-center gap-3 mt-5">
              <Pressable onPress={close} className="px-4 py-2.5" accessibilityRole="button">
                <Text className="font-semibold text-sm text-ink-3">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                disabled={busy}
                className="flex-row items-center bg-ink rounded-full px-5 py-2.5"
                accessibilityRole="button"
                accessibilityLabel="Confirm repost"
              >
                {busy ? (
                  <ActivityIndicator size="small" color={C.paper} />
                ) : (
                  <>
                    <Ionicons name="repeat" size={16} color={C.paper} />
                    <Text className="font-semibold text-sm text-paper ml-2">Repost</Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
