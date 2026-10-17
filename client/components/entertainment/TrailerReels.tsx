import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  ViewToken,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { fetchTrailersBatch, getMovieTrailers, fetchTrendingMovies } from '../../utils/tmdb';
import { C } from '../../constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ReelItem = React.memo(function ReelItem({ 
  movie, 
  isActive, 
  isMuted, 
  onToggleMute,
  cachedTrailerKey,
  pageHeight,
}: { 
  movie: any, 
  isActive: boolean, 
  isMuted: boolean, 
  onToggleMute: () => void,
  cachedTrailerKey?: string | null,
  pageHeight: number,
}) {
  const [trailerKey, setTrailerKey] = useState<string | null>(cachedTrailerKey || null);
  const [loading, setLoading] = useState(!cachedTrailerKey);
  const [isPaused, setIsPaused] = useState(false);
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    if (cachedTrailerKey) {
      setTrailerKey(cachedTrailerKey);
      setLoading(false);
      return;
    }

    let alive = true;
    const loadTrailer = async () => {
      try {
        const trailers = await getMovieTrailers(movie.id);
        if (alive && trailers && trailers.length > 0) {
          setTrailerKey(trailers[0].key);
        }
      } catch (error) {
        console.error('Error loading trailer:', error);
      } finally {
        if (alive) setLoading(false);
      }
    };
    loadTrailer();
    return () => { alive = false; };
  }, [movie.id, cachedTrailerKey]);

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

  useEffect(() => {
    if (isActive && webViewRef.current) {
      const script = isMuted ? 'if(player && player.mute) player.mute();' : 'if(player && player.unMute) player.unMute();';
      webViewRef.current.injectJavaScript(script);
    }
  }, [isMuted, isActive]);
  
  const handleShare = async () => {
    try {
      const shareUrl = `https://fync-api.duckdns.org/movie?id=${movie.id}`;
      await Share.share({
        message: `Check out the trailer for ${movie.title} on Fync!\n\n${movie.overview}\n\nWatch here: ${shareUrl}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const videoHeight = SCREEN_WIDTH * (9/16);

  const webViewSource = React.useMemo(() => ({
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <style>
            body { margin: 0; padding: 0; background-color: black; overflow: hidden; width: 100%; height: 100%; }
            #player { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
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
                  'mute': 0,
                  'controls': 1,
                  'modestbranding': 1,
                  'rel': 0,
                  'showinfo': 0,
                  'iv_load_policy': 3,
                  'enablejsapi': 1,
                  'playsinline': 1
                },
                events: {
                  'onReady': (event) => { 
                      event.target.playVideo(); 
                      window.ReactNativeWebView.postMessage('READY');
                  },
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
  }), [trailerKey]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: pageHeight }} className="bg-night">
      {/* Video Container */}
      <View style={{ width: SCREEN_WIDTH, height: videoHeight }} className="bg-ink relative">
        {isActive && trailerKey ? (
          <WebView
            ref={webViewRef}
            style={{ flex: 1 }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsFullscreenVideo={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleMessage}
            source={webViewSource}
          />
        ) : (
          <View className="flex-1 bg-ink justify-center items-center">
            {loading ? (
              <ActivityIndicator size="small" color={C.fam.fun} />
            ) : (
              <Ionicons name="videocam-off-outline" size={40} color={C.ink4} />
            )}
          </View>
        )}

        {/* Play/Pause Overlay */}
        {!isActive && (
           <View className="absolute inset-0 bg-black/60 items-center justify-center">
              <Ionicons name="play-circle" size={50} color="white" />
           </View>
        )}
      </View>

      {/* Content Container */}
      <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-6 pt-8">
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1 mr-4">
            <Text className="text-white text-3xl font-display uppercase mb-2">
              {movie.title}
            </Text>
            <View className="flex-row items-center gap-3">
               <View className="bg-danger/20 border border-danger/30 px-2.5 py-1 rounded-full">
                  <Text className="text-danger text-label font-display uppercase">TRAILER</Text>
               </View>
               <View className="flex-row items-center">
                  <Ionicons name="star" size={14} color={C.warning} />
                  <Text className="text-white text-sm ml-1 font-semibold">{Number(movie.vote_average ?? 0).toFixed(1)}</Text>
               </View>
               <Text className="text-ink-3 text-xs font-semibold uppercase">
                  {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
               </Text>
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={handleShare}
              className="w-12 h-12 bg-card/5 rounded-card items-center justify-center border border-white/10"
            >
              <Ionicons name="share-social-outline" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onToggleMute}
              className="w-12 h-12 bg-card/5 rounded-card items-center justify-center border border-white/10"
            >
              <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Extended Metadata */}
        <View className="flex-row flex-wrap gap-2 mb-8">
           {['Action', 'Blockbuster', 'Trending', 'Hot'].map((tag) => (
             <View key={tag} className="bg-ink/50 border border-white/5 px-2.5 py-1 rounded-full">
                <Text className="text-ink-3 text-label font-display uppercase">{tag}</Text>
             </View>
           ))}
        </View>

        <View className="mb-4">
          <View className="flex-row items-center mt-6 mb-2" style={{ gap: 12 }}>
            <Text className="text-danger font-display text-xs uppercase">Synopsis</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <Text className="text-ink-4 text-base leading-7 font-medium">
            {movie.overview || "No description available for this cinematic masterpiece."}
          </Text>
        </View>

        {/* Production Details Card */}
        <View className="bg-ink/50 p-card-pad rounded-sheet border border-white/5 mb-4">
            <View className="flex-row items-center mt-6 mb-6" style={{ gap: 12 }}>
              <Text className="text-white font-display text-sm uppercase">Production Details</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            </View>
            <View className="flex-row justify-between mb-4">
               <Text className="text-ink-3 font-semibold uppercase text-label">Original Language</Text>
               <Text className="text-white font-display uppercase text-label">{movie.original_language || 'EN'}</Text>
            </View>
            <View className="flex-row justify-between mb-4">
               <Text className="text-ink-3 font-semibold uppercase text-label">Vote Count</Text>
               <Text className="text-white font-display uppercase text-label">{movie.vote_count || '0'}+</Text>
            </View>
            <View className="flex-row justify-between">
               <Text className="text-ink-3 font-semibold uppercase text-label">Popularity Score</Text>
               <Text className="text-success font-display uppercase text-label">{Math.round(movie.popularity || 0)}</Text>
            </View>
        </View>

        <View className="mb-20">
           <View className="bg-danger/10 p-card-pad rounded-sheet border border-danger/20">
              <View className="flex-row items-center mb-4">
                 <View className="bg-danger p-2 rounded-xl mr-3">
                    <Ionicons name="sparkles" size={18} color="white" />
                 </View>
                 <Text className="text-white font-display uppercase text-xs">Fync Smart Recommendation</Text>
              </View>
              <Text className="text-ink-3 text-sm leading-6 font-medium">
                Our AI suggests this title based on your recent activity in Fync Media. Swipe down to discover more legends.
              </Text>
           </View>
        </View>
      </ScrollView>
    </View>
  );
});

const TrailerReels = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [movies, setMovies] = useState<any[]>(route.params?.movies || []);
  const [activeIndex, setActiveIndex] = useState(route.params?.initialIndex || 0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [trailerCache, setTrailerCache] = useState<Record<string, string | null>>({});
  // Pages are sized to the list's measured height, not Dimensions' window
  // height: on edge-to-edge Android those differ and paging drifts off-page.
  const [pageHeight, setPageHeight] = useState(0);
  const toggleMute = useCallback(() => setIsMuted(m => !m), []);

  useEffect(() => {
    const init = async () => {
      if (movies.length === 0) {
        await loadTrending();
      } else {
        setLoading(true);
        await fetchAllTrailers(movies);
        setLoading(false);
      }
    };
    init();
  }, []);

  const fetchAllTrailers = async (movieList: any[]) => {
    try {
      const ids = movieList.slice(0, 30).map(m => m.id);
      const trailers = await fetchTrailersBatch(ids);
      setTrailerCache(trailers || {});
    } catch (error) {
      console.error('Error pre-fetching trailers:', error);
    }
  };

  const loadTrending = async () => {
    try {
      setLoading(true);
      const data = await fetchTrendingMovies();
      setMovies(data || []);
      await fetchAllTrailers(data || []);
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
      <View className="flex-1 bg-ink justify-center items-center">
        <ActivityIndicator size="large" color={C.fam.fun} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ink" onLayout={(e) => setPageHeight(Math.round(e.nativeEvent.layout.height))}>
      {pageHeight > 0 && (
      <FlatList keyboardShouldPersistTaps="handled"
        data={movies}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <ReelItem 
            movie={item} 
            isActive={index === activeIndex} 
            isMuted={isMuted}
            onToggleMute={toggleMute}
            cachedTrailerKey={trailerCache[item.id]}
            pageHeight={pageHeight}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: pageHeight,
          offset: pageHeight * index,
          index,
        })}
        initialScrollIndex={Math.min(route.params?.initialIndex || 0, Math.max(movies.length - 1, 0))}
      />
      )}

      {/* Close Button */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={{ position: 'absolute', top: insets.top + 10, left: 9 }}
        className="w-11 h-11 items-center justify-center rounded-xl z-[100]"
      
            accessibilityRole="button"
            accessibilityLabel="Go back">
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default TrailerReels;
