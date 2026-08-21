/**
 * pdf.js runs inside a hidden WebView because rasterising a PDF page needs a
 * canvas, which React Native has no equivalent of. The library is vendored in
 * assets/pdfjs (MIT) so this works offline and costs nothing.
 *
 * v3's UMD build is used rather than v4: v4 is ESM-only, which would mean a
 * module worker built from a blob URL — far more fragile inside a WebView.
 */
import React, { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export type PdfJsResult =
  | { kind: 'pages'; pages: string[] }   // base64 JPEGs, one per page
  | { kind: 'text'; text: string }
  | { kind: 'error'; message: string };

async function assetText(mod: number): Promise<string> {
  const a = Asset.fromModule(mod);
  await a.downloadAsync();
  const uri = a.localUri ?? a.uri;
  return FileSystem.readAsStringAsync(uri);
}

function buildHtml(lib: string, worker: string) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<script>${lib}<\/script>
<script>
// the worker source is inlined too, so nothing is fetched over the network
var blob = new Blob([${JSON.stringify(worker)}], { type: 'application/javascript' });
pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);

function post(o) { window.ReactNativeWebView.postMessage(JSON.stringify(o)); }

window.__run = async function (b64, mode, scale) {
  try {
    var raw = atob(b64), arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    var doc = await pdfjsLib.getDocument({ data: arr }).promise;

    if (mode === 'text') {
      var out = [];
      for (var p = 1; p <= doc.numPages; p++) {
        var page = await doc.getPage(p);
        var tc = await page.getTextContent();
        var last = null, line = [];
        var lines = [];
        tc.items.forEach(function (it) {
          if (!it.str) return;
          var y = Math.round(it.transform[5]);
          if (last !== null && Math.abs(y - last) > 2) { lines.push(line.join('')); line = []; }
          last = y; line.push(it.str);
        });
        if (line.length) lines.push(line.join(''));
        out.push(lines.join('\\n'));
      }
      post({ kind: 'text', text: out.join('\\n\\n---\\n\\n') });
      return;
    }

    var pages = [];
    for (var p2 = 1; p2 <= doc.numPages; p2++) {
      var pg = await doc.getPage(p2);
      var vp = pg.getViewport({ scale: scale });
      var c = document.createElement('canvas');
      c.width = vp.width; c.height = vp.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      pages.push(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    }
    post({ kind: 'pages', pages: pages });
  } catch (e) {
    post({ kind: 'error', message: (e && e.message) || 'This PDF could not be read.' });
  }
};
<\/script></body></html>`;
}

export function usePdfJs() {
  const ref = useRef<WebView>(null);
  const resolver = useRef<((r: PdfJsResult) => void) | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const ready = useRef(false);

  const ensure = useCallback(async () => {
    if (html) return;
    const [lib, worker] = await Promise.all([
      assetText(require('../../../assets/pdfjs/pdf.min.js.txt')),
      assetText(require('../../../assets/pdfjs/pdf.worker.min.js.txt')),
    ]);
    setHtml(buildHtml(lib, worker));
  }, [html]);

  const run = useCallback(
    (b64: string, mode: 'pages' | 'text', scale = 1.5) =>
      new Promise<PdfJsResult>(async (resolve) => {
        await ensure();
        resolver.current = resolve;
        const fire = () => ref.current?.injectJavaScript(
          `window.__run(${JSON.stringify(b64)}, ${JSON.stringify(mode)}, ${scale}); true;`,
        );
        // the WebView may not have finished parsing 1.5MB of inlined library yet
        if (ready.current) fire();
        else {
          const t = setInterval(() => { if (ready.current) { clearInterval(t); fire(); } }, 120);
          setTimeout(() => clearInterval(t), 20000);
        }
      }),
    [ensure],
  );

  const Host = useCallback(
    () => (html ? (
      <View style={{ width: 0, height: 0, opacity: 0 }} pointerEvents="none">
        <WebView
          ref={ref}
          source={{ html }}
          originWhitelist={['*']}
          javaScriptEnabled
          onLoadEnd={() => { ready.current = true; }}
          onMessage={(e) => {
            const r = JSON.parse(e.nativeEvent.data) as PdfJsResult;
            resolver.current?.(r);
            resolver.current = null;
          }}
        />
      </View>
    ) : null),
    [html],
  );

  return { run, Host, prepare: ensure };
}
