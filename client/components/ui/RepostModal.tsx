import React, { useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import Avatar from '../Avatar';
import { C } from '../../constants/colors';
import { Sheet } from './Sheet';
import { Button } from './kit';
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
    <Sheet
      visible={visible}
      onClose={close}
      title="Repost"
      closeLabel="Cancel"
      footer={
        <View className="flex-row" style={{ gap: 8 }}>
          <Button title="Cancel" variant="tertiary" onPress={close} style={{ flex: 1 }} />
          <Button
            title="Repost"
            icon="repeat"
            variant="primary"
            loading={busy}
            onPress={confirm}
            accessibilityLabel="Confirm repost"
            style={{ flex: 1 }}
          />
        </View>
      }
    >
      <TextInput
        value={text}
        onChangeText={(v) => setText(v.slice(0, MAX_LENGTH))}
        placeholder="Add your thoughts (optional)"
        placeholderTextColor={C.ink3}
        multiline
        autoFocus
        className="font-sans text-ink bg-paper-2 rounded-2xl border border-line px-4 py-3"
        style={{ fontSize: 15, minHeight: 96, maxHeight: 160, textAlignVertical: 'top' }}
        accessibilityLabel="Add your thoughts"
      />

      {!!author && (
        <View className="flex-row items-center mt-3 p-3 bg-paper-2 rounded-2xl" style={{ gap: 12 }}>
          <Avatar user={author as any} size={32} />
          <View className="flex-1 min-w-0">
            <Text className="font-semibold text-ink" style={{ fontSize: 14 }} numberOfLines={1}>
              {author.name || author.username || 'Unknown'}
            </Text>
            {!!preview && (
              <Text className="font-sans text-ink-3 mt-0.5" style={{ fontSize: 13 }} numberOfLines={1}>
                {preview}
              </Text>
            )}
          </View>
        </View>
      )}
    </Sheet>
  );
}
