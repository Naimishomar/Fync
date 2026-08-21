/**
 * Shared PDF plumbing for the Utility Hub.
 *
 * Everything here runs on-device. pdf-lib is pure JS (no native module) and
 * speaks base64 directly — PDFDocument.load(b64) / doc.saveAsBase64() — which
 * pairs exactly with expo-file-system, so no Buffer/atob polyfill is needed.
 */
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// expo-file-system 19 moved documentDirectory / EncodingType /
// StorageAccessFramework behind the legacy entry point; importing from the
// package root leaves them undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';

export type PickedPdf = { uri: string; name: string; size?: number };

export async function pickPdf(multiple = false): Promise<PickedPdf[]> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    multiple,
    copyToCacheDirectory: true,
  });
  if (res.canceled) return [];
  return res.assets.map((a) => ({ uri: a.uri, name: a.name ?? 'document.pdf', size: a.size ?? undefined }));
}

export async function readBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** pdf-lib refuses encrypted files unless told to ignore; surface a clear reason. */
export async function loadDoc(uri: string): Promise<PDFDocument> {
  const b64 = await readBase64(uri);
  try {
    return await PDFDocument.load(b64, { ignoreEncryption: true });
  } catch {
    throw new Error('This PDF could not be read. It may be password-protected or damaged.');
  }
}

export async function writeDoc(doc: PDFDocument, filename: string): Promise<string> {
  const b64 = await doc.saveAsBase64();
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

export async function sharePdf(uri: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: 'Share your PDF',
    UTI: 'com.adobe.pdf',
  });
}

/** Android needs an explicit user-granted directory; iOS goes through the share sheet. */
export async function savePdfToDevice(uri: string, filename: string) {
  if (Platform.OS !== 'android') return sharePdf(uri);
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) throw new Error('Storage permission is required to save the file.');
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const target = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri, filename, 'application/pdf',
  );
  await FileSystem.writeAsStringAsync(target, b64, { encoding: FileSystem.EncodingType.Base64 });
}

/**
 * "1-3, 5, 8-" over a 10-page doc -> [0,1,2,4,7,8,9] (zero-based, deduped, sorted).
 * Returns [] for anything unparseable so callers can show one clear error.
 */
export function parsePageRanges(spec: string, pageCount: number): number[] {
  const out = new Set<number>();
  for (const rawPart of spec.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const m = part.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (m) {
      const from = m[1] ? parseInt(m[1], 10) : 1;
      const to = m[2] ? parseInt(m[2], 10) : pageCount;
      if (Number.isNaN(from) || Number.isNaN(to) || from < 1 || to < from) return [];
      for (let i = from; i <= Math.min(to, pageCount); i++) out.add(i - 1);
    } else if (/^\d+$/.test(part)) {
      const n = parseInt(part, 10);
      if (n < 1 || n > pageCount) return [];
      out.add(n - 1);
    } else {
      return [];
    }
  }
  return [...out].sort((a, b) => a - b);
}

export function prettySize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export { PDFDocument, degrees, rgb, StandardFonts };
