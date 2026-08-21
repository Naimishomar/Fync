/**
 * Shared chrome for every PDF tool: app bar, file picker, options slot, run
 * button and result actions. Each tool supplies only its own options and the
 * transform, so a tool screen stays small enough to read in one go.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from '../../ui/AlertModal';
import { pickPdf, sharePdf, savePdfToDevice, prettySize, type PickedPdf } from './pdfKit';

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
  const navigation = useNavigation<any>();
  const [files, setFiles] = useState<PickedPdf[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ uri: string; filename: string; note?: string } | null>(null);

  const choose = async () => {
    try {
      const picked = await pickPdf(multiple);
      if (picked.length) { setFiles(multiple ? [...files, ...picked] : picked); setResult(null); }
    } catch { Alert.alert('Error', 'Could not open that file.'); }
  };

  const blocked = files.length === 0 ? 'Choose a PDF first' : disabledReason?.(files) ?? null;

  const go = async () => {
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
    <View className="flex-1" style={{ backgroundColor: '#F5F2EC' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View className="px-5 py-4 flex-row items-center border-b border-line bg-transparent">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back" style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink flex-1">{title}</Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          <Text className="text-ink-2 text-sm mb-5">{blurb}</Text>

          <TouchableOpacity
            onPress={choose}
            className="w-full bg-card border-2 border-dashed border-ink-4 rounded-card p-card-pad items-center justify-center mb-5 shadow-hair"
            accessibilityRole="button"
          >
            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-3">
              <Ionicons name={icon} size={32} color="#57534E" />
            </View>
            <Text className="text-ink font-display uppercase text-label">
              {files.length === 0 ? 'Choose PDF' : multiple ? 'Add another PDF' : 'Choose a different PDF'}
            </Text>
          </TouchableOpacity>

          {files.length > 0 && (
            <View className="mb-5">
              <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
                <Text className="text-ink-3 text-label font-display uppercase">Selected</Text>
                <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                <Text className="text-ink-3 font-mono text-label">{files.length}</Text>
              </View>
              {files.map((f, i) => (
                <View key={`${f.uri}-${i}`} className="flex-row items-center bg-card rounded-card p-4 border border-line mb-2">
                  <Ionicons name="document-text-outline" size={20} color="#57534E" />
                  <View className="flex-1 ml-3">
                    <Text className="text-ink text-sm" numberOfLines={1}>{f.name}</Text>
                    {!!f.size && <Text className="text-ink-3 text-label mt-0.5">{prettySize(f.size)}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => { setFiles(files.filter((_, j) => j !== i)); setResult(null); }}
                    className="w-11 h-11 items-center justify-center rounded-xl"
                    accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`}
                  >
                    <Ionicons name="close" size={18} color="#57534E" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {files.length > 0 && options?.(files)}

          {files.length > 0 && (
            <TouchableOpacity
              onPress={go}
              disabled={busy || !!blocked}
              className={`w-full py-4 rounded-md items-center justify-center border-2 border-ink mb-3 ${blocked || busy ? 'bg-paper-2' : 'bg-brand-500'}`}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color="#12100E" />
                : <Text className={`font-display uppercase text-base ${blocked ? 'text-ink-3' : 'text-ink'}`}>{blocked ?? runLabel}</Text>}
            </TouchableOpacity>
          )}

          {result && (
            <View className="bg-card rounded-card p-card-pad border-2 border-ink mb-10" style={{ marginTop: 8 }}>
              <Text className="text-ink font-display uppercase text-label mb-1">Done</Text>
              <Text className="text-ink-2 text-sm mb-4">{result.note ?? result.filename}</Text>
              <View className="flex-row" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => sharePdf(result.uri).catch((e) => Alert.alert('Error', e.message))}
                  className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button"
                >
                  <Ionicons name="share-outline" size={16} color="#F5F2EC" style={{ marginRight: 7 }} />
                  <Text className="font-display text-paper uppercase" style={{ fontSize: 12 }}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => savePdfToDevice(result.uri, result.filename)
                    .then(() => Alert.alert('Saved', 'The file was saved to your device.'))
                    .catch((e) => Alert.alert('Error', e.message))}
                  className="flex-1 flex-row items-center justify-center bg-card border-[1.5px] border-line rounded-md" style={{ minHeight: 44 }}
                  accessibilityRole="button"
                >
                  <Ionicons name="download-outline" size={16} color="#12100E" style={{ marginRight: 7 }} />
                  <Text className="font-display text-ink uppercase" style={{ fontSize: 12 }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
