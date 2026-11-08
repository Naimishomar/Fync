/**
 * Shared chrome for every utility tool. `ToolScreen` is the page frame (app
 * bar, blurb, scroll body); `PickZone`, `OptionCard`, `Choices`, `Thumb` and
 * `DoneCard` are its parts. `PdfToolShell` (default export) assembles them for
 * the pick-a-PDF -> options -> run tools, so those screens hold only their
 * options and the transform.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, KeyboardAvoidingView, Platform, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AppBar, Button, Card, Chip, IconBtn, IconTile, Label, ListRow, SectionHeader } from '../../ui/kit';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, sharePdf, savePdfToDevice, prettySize, type PickedPdf } from './pdfKit';
import { C } from '../../../constants/colors';

/** Options card every tool puts in the `options` slot. */
export function OptionCard({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <Card padded style={{ marginBottom: 20, gap: 12 }}>
      {label ? <Label>{label}</Label> : null}
      {children}
    </Card>
  );
}

/** Single-select pills for a tool option (rotation, trim amount, position). */
export function Choices<T extends string | number>({
  items, value, onChange,
}: { items: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="flex-row flex-wrap" style={{ gap: 8 }}>
      {items.map((it) => (
        <Chip key={String(it.id)} label={it.label} active={it.id === value} onPress={() => onChange(it.id)} />
      ))}
    </View>
  );
}

/** Dashed drop-zone button that opens the picker. Shared with the image tools. */
export function PickZone({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-full bg-card border border-dashed border-line rounded-2xl p-6 items-center justify-center mb-5 active:opacity-85"
      style={{ gap: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <IconTile icon={icon} size={64} iconSize={28} color={C.ink2} />
      <Text className="text-ink font-semibold text-base">{label}</Text>
    </Pressable>
  );
}

/** Page frame: app bar, one-line blurb, scroll body kept above the keyboard. */
export function ToolScreen({
  title, blurb, right, children, before, footer,
}: {
  title: string; blurb?: string; right?: React.ReactNode; children: React.ReactNode;
  /** Rendered outside the scroll view (a hidden WebView host). */
  before?: React.ReactNode;
  /** Docked under the scroll view (a BottomBar). */
  footer?: React.ReactNode;
}) {
  const navigation = useNavigation<any>();
  return (
    <View className="flex-1 bg-paper">
      {before}
      <SafeAreaView style={{ flex: 1 }} edges={footer ? [] : ['bottom']}>
        <AppBar title={title} onBack={() => navigation.goBack()} right={right} />
        {/* Several tools have a text field; keep it above the keyboard. */}
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {blurb ? <Text className="text-ink-2 text-sm mb-5">{blurb}</Text> : null}
            {children}
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
        {footer}
      </SafeAreaView>
    </View>
  );
}

/** "Done" result card with its actions (Share / Save buttons). */
export function DoneCard({ note, children }: { note: string; children: React.ReactNode }) {
  return (
    <Card padded style={{ marginTop: 8, marginBottom: 20, gap: 4 }}>
      <Text className="text-ink font-semibold text-base" accessibilityRole="header">Done</Text>
      <Text className="text-ink-2 text-sm mb-3">{note}</Text>
      <View className="flex-row" style={{ gap: 12 }}>{children}</View>
    </Card>
  );
}

/** Done card for a produced PDF: Share and Save to device. */
export function PdfResult({ uri, filename, note }: { uri: string; filename: string; note: string }) {
  return (
    <DoneCard note={note}>
      <Button
        variant="solid" icon="share-outline" title="Share" style={{ flex: 1 }}
        onPress={() => sharePdf(uri).catch((e) => Alert.alert('Error', e.message))}
      />
      <Button
        icon="download-outline" title="Save" style={{ flex: 1 }}
        onPress={() => savePdfToDevice(uri, filename)
          .then(() => Alert.alert('Saved', 'The file was saved to your device.'))
          .catch((e) => Alert.alert('Error', e.message))}
      />
    </DoneCard>
  );
}

const THUMB = { width: 84, height: 110 };

/** Page/photo thumbnail, optional remove button and caption. */
export function Thumb({
  uri, style = THUMB, onRemove, removeLabel, caption, contain,
}: {
  uri: string; style?: StyleProp<ViewStyle>; onRemove?: () => void; removeLabel?: string;
  caption?: string; contain?: boolean;
}) {
  return (
    <View className="rounded-2xl overflow-hidden border border-line bg-paper-2" style={style}>
      <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit={contain ? 'contain' : 'cover'} cachePolicy="memory" />
      {onRemove ? (
        <View className="absolute" style={{ top: 0, right: 0 }}>
          <IconBtn name="close" size={18} color="#FFFFFF" overlay onPress={onRemove} accessibilityLabel={removeLabel ?? 'Remove'} />
        </View>
      ) : null}
      {caption ? (
        <View className="absolute left-2 bottom-2 px-2 py-1 rounded-full" style={{ backgroundColor: 'rgba(18,16,14,0.6)' }}>
          <Text className="text-white text-xs font-semibold">{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Props = {
  title: string;
  /** Shown above the picker; one line on what the tool does. */
  blurb: string;
  icon: keyof typeof Ionicons.glyphMap;
  multiple?: boolean;
  runLabel: string;
  /** Rendered between the picker and the run button. */
  options?: (files: PickedPdf[]) => React.ReactNode;
  /** Returns the produced file's uri + filename. */
  run: (files: PickedPdf[]) => Promise<{ uri: string; filename: string; note?: string }>;
  /** Block the run button with a reason when options are incomplete. */
  disabledReason?: (files: PickedPdf[]) => string | null;
};

export default function PdfToolShell({
  title, blurb, icon, multiple = false, runLabel, options, run, disabledReason,
}: Props) {
  const [files, setFiles] = useState<PickedPdf[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; filename: string; note?: string } | null>(null);

  const choose = async () => {
    try {
      const picked = await pickPdf(multiple);
      if (picked.length) { setFiles((prev) => (multiple ? [...prev, ...picked] : picked)); setResult(null); }
    } catch { Alert.alert('Error', 'Could not open that file.'); }
  };

  const blocked = files.length === 0 ? 'Choose a PDF first' : disabledReason?.(files) ?? null;

  const go = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setResult(await run(files));
    } catch (e: any) {
      Alert.alert('Could not finish', e?.message ?? 'Something went wrong with this PDF.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolScreen title={title} blurb={blurb}>
      <PickZone
        icon={icon}
        onPress={choose}
        label={files.length === 0 ? 'Choose PDF' : multiple ? 'Add another PDF' : 'Choose a different PDF'}
      />

      {files.length > 0 && (
        <View className="mb-5">
          <SectionHeader title="Selected" count={files.length} style={{ marginTop: 0 }} />
          {files.map((f, i) => (
            <ListRow
              key={`${f.uri}-${i}`}
              icon="document-text-outline"
              title={f.name}
              subtitle={f.size ? prettySize(f.size) : undefined}
              right={
                <IconBtn
                  name="close"
                  onPress={() => { setFiles(files.filter((_, j) => j !== i)); setResult(null); }}
                  accessibilityLabel={`Remove ${f.name}`}
                />
              }
            />
          ))}
        </View>
      )}

      {files.length > 0 && options?.(files)}

      {files.length > 0 && (
        <Button
          variant="primary"
          block
          title={blocked ?? runLabel}
          onPress={go}
          loading={busy}
          disabled={!!blocked}
          style={{ marginBottom: 12 }}
        />
      )}

      {result && <PdfResult uri={result.uri} filename={result.filename} note={result.note ?? result.filename} />}
    </ToolScreen>
  );
}
