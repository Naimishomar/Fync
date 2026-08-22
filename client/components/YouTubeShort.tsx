import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Dimensions, ActivityIndicator, Text, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';

const SCREEN_HEIGHT = Dimensions.get('screen').height;
const SCREEN_WIDTH = Dimensions.get('screen').width;

/**
 * A YouTube video playing inside the shorts feed.
 *
 * The WebView is a playback surface, not a browser: no chrome, no controls, no
 * scrolling, and it never receives touches. Gestures land on a native Pressable
 * above it so the vertical swipe still belongs to the FlatList, which is what
 * keeps the feed feeling like the rest of the app rather than an embedded page.
 *
 * YouTube's own player is deliberately left intact underneath. Their IFrame API
 * terms require it, and stripping it is what gets an API key revoked — which
 * would take the whole feed down with it.
 */
const playerHtml = (videoId: string, width: number, height: number) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin:0; padding:0; background:#12100E; height:100%; overflow:hidden; }
  #player { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); }
</style>
</head>
<body>
<div id="player"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script>
  var player;
  var send = function (msg) {
    window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  };
  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      videoId: '${videoId}',
      width: '${Math.round(width)}',
      height: '${Math.round(height)}',
      playerVars: {
        controls: 0, playsinline: 1, rel: 0, fs: 0,
        disablekb: 1, iv_load_policy: 3, modestbranding: 1
      },
      events: {
        onReady: function () { send({ type: 'ready' }); },
        onStateChange: function (e) { send({ type: 'state', state: e.data }); },
        // A CC video can still be blocked for embedding in some regions, and
        // that arrives here rather than as a failed request.
        onError: function (e) { send({ type: 'error', code: e.data }); }
      }
    });
  }
  window.play = function () { player && player.playVideo && player.playVideo(); };
  window.pause = function () { player && player.pauseVideo && player.pauseVideo(); };
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
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ended, setEnded] = useState(false);

  // 16:9 centred in the screen, matching how the PeerTube cards letterbox, so
  // the two sources look like one feed rather than two.
  const height = useMemo(() => Math.round(SCREEN_WIDTH * 9 / 16), []);
  const html = useMemo(() => playerHtml(videoId, SCREEN_WIDTH, height), [videoId, height]);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.${isActive ? 'play' : 'pause'}(); true;`);
  }, [isActive, ready]);

  const onMessage = (e: any) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }

    if (msg.type === 'ready') {
      setReady(true);
      if (isActive) ref.current?.injectJavaScript('window.play(); true;');
    }
    if (msg.type === 'error') setFailed(true);
    // 0 is ENDED. Looping keeps the feed continuous instead of stopping dead on
    // a black frame until the user swipes.
    if (msg.type === 'state' && msg.state === 0) {
      setEnded(true);
      ref.current?.injectJavaScript('window.play(); true;');
    }
  };

  if (failed) {
    return (
      <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink items-center justify-center px-10">
        <Ionicons name="cloud-offline-outline" size={48} color="#8B857E" />
        <Text className="font-sans text-sm text-night-3 mt-3 text-center">
          This one wouldn&apos;t play. Swipe on.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ height: SCREEN_HEIGHT, width: SCREEN_WIDTH }} className="bg-ink">
      {/* pointerEvents="none" is what stops the embed from behaving like a web
          page: no tap-through to YouTube, no scroll capture, no long-press menu. */}
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
          source={{ html, baseUrl: 'https://www.youtube.com' }}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, backgroundColor: '#12100E' }}
          originWhitelist={['*']}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          // Without these the player refuses to start without a tap, which in a
          // feed reads as a video that simply never loads.
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          scrollEnabled={false}
          bounces={false}
          setSupportMultipleWindows={false}
          androidLayerType="hardware"
          onError={() => setFailed(true)}
          onHttpError={() => setFailed(true)}
        />
      </View>

      {!ready && (
        <View className="absolute inset-0 items-center justify-center">
          <ActivityIndicator size="large" color="#F97316" />
        </View>
      )}
    </View>
  );
}
