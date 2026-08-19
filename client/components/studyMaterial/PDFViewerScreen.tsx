import React from 'react';
import { WebView } from 'react-native-webview';
import { View, ActivityIndicator, Text, Pressable, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

/**
 * Google's PDF viewer follows the reader's own Google theme, so on a dark-mode
 * account the document renders on near-black while our chrome stayed white --
 * the page looked like a foreign website bolted into the app.
 *
 * Rather than guess, we ask the page what colour it actually painted and match
 * the header, safe area and status bar to it. The result reads as one screen
 * whichever theme the reader has set.
 */

const FALLBACK_LIGHT = '#ffffff';

/**
 * Runs inside the WebView. Walks up from body to html looking for the first
 * element that actually painted a colour -- Drive's viewer leaves body
 * transparent and colours a wrapper, so reading body alone returns rgba(0,0,0,0).
 */
const PROBE_SCRIPT = `
(function () {
  function opaque(el) {
    if (!el) return null;
    var c = getComputedStyle(el).backgroundColor;
    if (!c) return null;
    var m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    var parts = m[1].split(',').map(function (x) { return parseFloat(x); });
    if (parts.length > 3 && parts[3] === 0) return null;   // fully transparent
    return { r: parts[0], g: parts[1], b: parts[2] };
  }
  function probe() {
    var found =
      opaque(document.body) ||
      opaque(document.documentElement) ||
      opaque(document.querySelector('.ndfHFb-c4YZDc-Wrql6b')) ||
      null;
    if (found) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'bg', color: found }));
    }
  }
  probe();
  // Drive paints asynchronously; re-probe a couple of times as it settles.
  setTimeout(probe, 400);
  setTimeout(probe, 1200);
  true;
})();
`;

/** Perceived brightness (ITU-R BT.601). Decides black or white foreground. */
const isDark = (r: number, g: number, b: number) =>
  (r * 299 + g * 587 + b * 114) / 1000 < 140;

const PDFViewerScreen = ({ route, navigation }: any) => {
  const { fileId, title, url } = route.params;

  const [bg, setBg] = React.useState(FALLBACK_LIGHT);
  const [dark, setDark] = React.useState(false);

  const pdfUrl = url
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : `https://drive.google.com/file/d/${fileId}/preview`;

  const onMessage = (event: any) => {
    try {
      const payload = JSON.parse(event.nativeEvent.data);
      if (payload?.type !== 'bg' || !payload.color) return;
      const { r, g, b } = payload.color;
      if ([r, g, b].some((v) => typeof v !== 'number' || Number.isNaN(v))) return;
      setBg(`rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`);
      setDark(isDark(r, g, b));
    } catch {
      // A message we did not send. Keep the current theme.
    }
  };

  const foreground = dark ? '#ffffff' : '#0f172a';
  const border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar
        barStyle={dark ? 'light-content' : 'dark-content'}
        backgroundColor={Platform.OS === 'android' ? bg : undefined}
      />
      <SafeAreaView edges={['top']} style={{ backgroundColor: bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: border,
          }}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            style={{ padding: 6, marginRight: 4 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={foreground} />
          </Pressable>
          <Text
            numberOfLines={1}
            style={{ flex: 1, color: foreground, fontSize: 15, fontWeight: '800' }}
          >
            {title}
          </Text>
        </View>
      </SafeAreaView>

      <WebView
        source={{ uri: pdfUrl }}
        style={{ flex: 1, backgroundColor: bg }}
        // Matches the native view behind the page so there is no white flash
        // before the document paints on a dark theme.
        containerStyle={{ backgroundColor: bg }}
        onMessage={onMessage}
        injectedJavaScript={PROBE_SCRIPT}
        startInLoadingState={true}
        renderLoading={() => (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: bg,
            }}
          >
            <ActivityIndicator size="large" color="#8b5cf6" />
          </View>
        )}
      />
    </View>
  );
};

export default PDFViewerScreen;
