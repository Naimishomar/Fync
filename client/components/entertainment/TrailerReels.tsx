import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ViewToken,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getMovieTrailers, fetchTrendingMovies } from '../../utils/tmdb';
import * as ScreenOrientation from 'expo-screen-orientation';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
// In landscape, width and height swap roles if we don't handle them dynamically
// But for the initial calculation, we'll use the larger dimension as width
const LANDSCAPE_WIDTH = Math.max(SCREEN_WIDTH, SCREEN_HEIGHT);
const LANDSCAPE_HEIGHT = Math.min(SCREEN_WIDTH, SCREEN_HEIGHT);

const ReelItem = ({ movie, isActive, isMuted, onToggleMute }: { movie: any, isActive: boolean, isMuted: boolean, onToggleMute: () => void }) => {
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    const loadTrailer = async () => {
      try {
        const trailers = await getMovieTrailers(movie.id);
        if (trailers && trailers.length > 0) {
          setTrailerKey(trailers[0].key);
        }
      } catch (error) {
        console.error('Error loading trailer:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTrailer();
  }, [movie.id]);

  // Inject JS to toggle mute or play/pause
  useEffect(() => {
    if (isActive && webViewRef.current) {
      const script = isMuted ? 'player.mute();' : 'player.unMute();';
      webViewRef.current.injectJavaScript(script);
    }
  }, [isMuted, isActive]);

  const togglePlayPause = () => {
    if (webViewRef.current) {
      const script = isPaused ? 'player.playVideo();' : 'player.pauseVideo();';
      webViewRef.current.injectJavaScript(script);
      setIsPaused(!isPaused);
    }
  };

  const handleMessage = (event: any) => {
    const data = event.nativeEvent.data;
    if (data === 'PLAYING') setIsPaused(false);
    if (data === 'PAUSED') setIsPaused(true);
  };

  if (loading) {
    return (
      <View style={{ width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }} className="bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  // In landscape mode, we fill the full area
  const videoWidth = LANDSCAPE_WIDTH;
  const videoHeight = LANDSCAPE_HEIGHT;

  return (
    <View style={{ width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }} className="bg-black relative overflow-hidden">
      {isActive && trailerKey ? (
        <View 
          style={{ 
            width: LANDSCAPE_WIDTH * 1.3, 
            height: LANDSCAPE_HEIGHT * 1.3,
            marginLeft: -(LANDSCAPE_WIDTH * 0.3) / 2,
            marginTop: -(LANDSCAPE_HEIGHT * 0.3) / 2
          }}
        >
          <WebView
            ref={webViewRef}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleMessage}
            source={{ 
              html: `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <style>
                      body { margin: 0; padding: 0; background-color: black; overflow: hidden; width: 100%; height: 100%; }
                      #player { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
                    </style>
                  </head>
                  <body>
                    <div id="player"></div>
                    <script src="https://www.youtube.com/iframe_api"></script>
                    <script>
                      var player;
                      function onYouTubeIframeAPIReady() {
                        player = new YT.Player('player', {
                          height: '100%',
                          width: '100%',
                          videoId: '${trailerKey}',
                          playerVars: {
                            'autoplay': 1,
                            'mute': ${isMuted ? 1 : 0},
                            'controls': 0,
                            'modestbranding': 1,
                            'rel': 0,
                            'showinfo': 0,
                            'iv_load_policy': 3,
                            'enablejsapi': 1,
                            'playsinline': 1,
                            'origin': 'https://fync-app.com'
                          },
                          events: {
                            'onReady': (event) => { event.target.playVideo(); },
                            'onStateChange': (event) => {
                               if (event.data == YT.PlayerState.PLAYING) {
                                 window.ReactNativeWebView.postMessage('PLAYING');
                               } else if (event.data == YT.PlayerState.PAUSED) {
                                 window.ReactNativeWebView.postMessage('PAUSED');
                               }
                            }
                          }
                        });
                      }
                    </script>
                  </body>
                </html>
              `,
              baseUrl: 'https://fync-app.com'
            }}
            className="bg-black"
          />
        </View>
      ) : (
        <View className="flex-1 bg-black justify-center items-center">
          <ActivityIndicator size="small" color="#555" />
        </View>
      )}

      {/* Custom Mute Toggle */}
      <TouchableOpacity 
        onPress={onToggleMute}
        className="absolute z-50 right-6 bottom-10 w-12 h-12 bg-black/40 rounded-full items-center justify-center border border-white/10"
      >
        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={24} color="white" />
      </TouchableOpacity>

      {/* Metadata Overlay - Hidden when playing */}
      {(isPaused || loading) && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          className="absolute bottom-0 w-full px-10 pb-12 pt-20 z-20"
        >
          <View className="flex-row justify-between items-end">
            <View className="flex-1 mr-10">
              <Text className="text-white text-3xl font-bold mb-2 shadow-lg" numberOfLines={1}>
                {movie.title}
              </Text>
              <Text className="text-gray-200 text-base leading-6 mb-4" numberOfLines={2}>
                {movie.overview}
              </Text>
              <View className="flex-row items-center gap-4">
                <View className="bg-rose-600 px-4 py-1.5 rounded-full">
                  <Text className="text-white text-sm font-bold">PAUSED</Text>
                </View>
                <View className="flex-row items-center">
                  <Ionicons name="star" size={20} color="#fbbf24" />
                  <Text className="text-white text-sm ml-1 font-bold">{movie.vote_average.toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Interaction Shield & Tap to Pause Toggle - Moved to top z-index */}
      <TouchableOpacity 
        activeOpacity={1}
        onPress={togglePlayPause}
        className="absolute inset-0 z-40 items-center justify-center"
      >
        {isPaused && (
           <View className="bg-black/40 w-20 h-20 rounded-full items-center justify-center">
              <Ionicons name="play" size={40} color="white" />
           </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const TrailerReels = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [movies, setMovies] = useState<any[]>(route.params?.movies || []);
  const [activeIndex, setActiveIndex] = useState(route.params?.initialIndex || 0);
  const [loading, setLoading] = useState(movies.length === 0);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    // Lock orientation to landscape on mount
    const lockOrientation = async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };
    lockOrientation();

    if (movies.length === 0) {
      loadTrending();
    }

    // Restore portrait on unmount
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
    };
  }, []);

  const loadTrending = async () => {
    try {
      const data = await fetchTrendingMovies();
      setMovies(data);
    } catch (error) {
      console.error('Error loading reels:', error);
    } finally {
      setLoading(false);
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  if (loading) {
    return (
      <View style={{ width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }} className="bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View style={{ width: LANDSCAPE_WIDTH, height: LANDSCAPE_HEIGHT }} className="bg-black">
      <FlatList
        data={movies}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <ReelItem 
            movie={item} 
            isActive={index === activeIndex} 
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: LANDSCAPE_WIDTH,
          offset: LANDSCAPE_WIDTH * index,
          index,
        })}
        initialScrollIndex={route.params?.initialIndex || 0}
      />

      {/* Close Button moved to bottom of hierarchy to ensure it stays on top */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={{ top: 30, left: 30 }}
        className="absolute z-[100] w-12 h-12 bg-black/50 rounded-full items-center justify-center border border-white/20"
      >
        <Ionicons name="close" size={32} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default TrailerReels;
