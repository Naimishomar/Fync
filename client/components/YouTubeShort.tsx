import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Dimensions, ActivityIndicator, Text, Image } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const SCREEN_WIDTH = Dimensions.get('screen').width;

/**
 * A YouTube video playing inside the shorts feed.
 *
 * Two failures shaped this file, and both are worth knowing before changing it.
 *
 * Loading https://www.youtube.com/embed/<id> as the WebView's own page gets
 * YouTube error 153: as a top-level document it sends no Referer, and the embed
 * is refused without one. So the embed has to live in an iframe on a page that
 * has an origin — which is what baseUrl provides.
 *
 * Earlier, building that iframe through the IFrame API and waiting for onReady
 * before showing anything produced a permanent spinner whenever the handshake
 * failed. So the API is now used only for control, never for readiness: the
 * video autoplays from its own URL parameters, and if the handshake never
 * completes the video still plays — only pause-on-scroll degrades.
 *
 * The WebView never receives touches, so the vertical swipe belongs to the
 * FlatList above it.
 */
const playerHtml = (videoId: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; padding:0; background:#12100E; height:100%; overflow:hidden; }
  #wrap { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
          width:100vw; height:56.25vw; }
  iframe { width:100%; height:100%; border:0; display:block; }
</style>
</head>
<body>
<div id="wrap">
  <iframe
    id="yt"
    src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&controls=0&rel=0&fs=0&iv_load_policy=3&modestbranding=1&loop=1&playlist=${videoId}&enablejsapi=1"
    allow="autoplay; encrypted-media"
    allowfullscreen>
  </iframe>
</div>
<script>
  var report = function (m) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m));
  };
  var frame = document.getElementById('yt');
  frame.addEventListener('load', function () { report({ type: 'loaded' }); });

  // Control only. postMessage to the embed needs no handshake and no reply, so
  // a command that does not land costs nothing but a video that keeps playing.
  var cmd = function (func, args) {
    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: 'command', func: func, args: args || [] }),
        'https://www.youtube.com'
      );
    } catch (e) {}
  };
  window.fyncPlay = function () { cmd('playVideo'); };
  window.fyncPause = function () { cmd('pauseVideo'); };
  window.fyncUnmute = function () { cmd('unMute'); cmd('setVolume', [100]); };

  // The embed reports its state unprompted once enablejsapi is on. This is a
  // bonus signal, not something the UI waits for.
  window.addEventListener('message', function (e) {
    if (!e.data) return;
    try {
      var d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (d && d.event === 'onError') report({ type: 'error', code: d.info });
      if (d && d.event === 'onStateChange' && d.info === 1) report({ type: 'playing' });
    } catch (err) {}
  });
</script>
</body>
</html>`;

export default function YouTubeShort({
  videoId,
  isActive,
  thumbnail,
}: {
  videoId: string;
  isActive: boolean;
  thumbnail?: string;
}) {
  const ref = useRef<WebView>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState<number | null>(null);

  const html = useMemo(() => playerHtml(videoId), [videoId]);

  useEffect(() => {
    if (!loaded) return;
    ref.current?.injectJavaScript(
      isActive ? 'window.fyncPlay(); true;' : 'window.fyncPause(); true;',
    );
  }, [isActive, loaded]);

  // Restore sound after the muted start has satisfied the autoplay policy.
  // Muted autoplay is the only kind that works without a user gesture, and this
  // player can never receive one.
  useEffect(() => {
    if (!loaded || !isActive) return;
    const t = setTimeout(() => ref.current?.injectJavaScript('window.fyncUnmute(); true;'), 1200);
    return () => clearTimeout(t);
  }, [loaded, isActive]);

  const onMessage = (e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'loaded' || msg.type === 'playing') setLoaded(true);
    // 101 and 150 both mean the owner disallows embedding.
    if (msg.type === 'error') setFailed(msg.code ?? 5);
  };

  if (failed !== null) {
    const reason =
      failed === 101 || failed === 150 ? 'The owner does not allow this one off YouTube.'
      : failed === 100 ? 'This video was removed.'
      : failed === 2 ? 'Bad video reference.'
      : failed === -1 ? 'The player page failed to load.'
      : 'This one would not play.';

    return (
      <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink items-center justify-center px-10">
        <Ionicons name="cloud-offline-outline" size={48} color="#8B857E" />
        <Text className="font-sans text-sm text-night-3 mt-3 text-center">
          {reason} Swipe on.
        </Text>
        <Text className="font-sans text-night-3 mt-2" style={{ fontSize: 10, opacity: 0.6 }}>
          code {failed}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink">
      {!loaded && !!thumbnail && (
        <Image
          source={{ uri: thumbnail }}
          style={{ position: 'absolute', width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          resizeMode="cover"
          blurRadius={6}
        />
      )}

      {/* pointerEvents="none" is what stops the embed behaving like a web page:
          no tap-through to YouTube, no scroll capture, no long-press menu. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: SCREEN_WIDTH,
          height: SCREEN_HEIGHT,
          justifyContent: 'center',
        }}
      >
        <WebView
          ref={ref}
          // baseUrl is not cosmetic: it gives the page an origin, which is what
          // supplies the Referer the embed requires. Without it, error 153.
          source={{ html, baseUrl: 'https://www.youtube.com' }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#12100E' }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          bounces={false}
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          onError={() => setFailed(-1)}
        />
      </View>

      {!loaded && failed === null && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      )}
    </View>
  );
}
