import React, { useState, useRef, useEffect } from 'react';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const ReelItem = ({ 
  movie, 
  isActive, 
  isMuted, 
  onToggleMute,
  cachedTrailerKey 
}: { 
  movie: any, 
  isActive: boolean, 
  isMuted: boolean, 
  onToggleMute: () => void,
  cachedTrailerKey?: string | null
}) => {
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
    <View style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }} className="bg-[#050505]">
      {/* Video Container */}
      <View style={{ width: SCREEN_WIDTH, height: videoHeight }} className="bg-black relative">
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
          <View className="flex-1 bg-slate-900 justify-center items-center">
            {loading ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <Ionicons name="videocam-off-outline" size={40} color="#333" />
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
      <ScrollView className="flex-1 px-6 pt-8">
        <View className="flex-row justify-between items-start mb-6">
          <View className="flex-1 mr-4">
            <Text className="text-white text-3xl font-black uppercase tracking-tighter mb-2">
              {movie.title}
            </Text>
            <View className="flex-row items-center gap-3">
               <View className="bg-rose-600/20 px-3 py-1 rounded-full border border-rose-600/30">
                  <Text className="text-rose-500 text-2xs font-black uppercase tracking-wide">TRAILER</Text>
               </View>
               <View className="flex-row items-center">
                  <Ionicons name="star" size={14} color="#fbbf24" />
                  <Text className="text-white text-sm ml-1 font-bold">{movie.vote_average.toFixed(1)}</Text>
               </View>
               <Text className="text-slate-500 text-xs font-bold uppercase tracking-wide">
                  {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
               </Text>
            </View>
          </View>
          
          <View className="flex-row gap-3">
            <TouchableOpacity 
              onPress={handleShare}
              className="w-12 h-12 bg-white/5 rounded-2xl items-center justify-center border border-white/10"
            >
              <Ionicons name="share-social-outline" size={20} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={onToggleMute}
              className="w-12 h-12 bg-white/5 rounded-2xl items-center justify-center border border-white/10"
            >
              <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Extended Metadata */}
        <View className="flex-row flex-wrap gap-2 mb-8">
           {['Action', 'Blockbuster', 'Trending', 'Hot'].map((tag) => (
             <View key={tag} className="bg-slate-800/50 px-4 py-2 rounded-xl border border-white/5">
                <Text className="text-slate-400 text-2xs font-black uppercase tracking-wide">{tag}</Text>
             </View>
           ))}
        </View>

        <View className="mb-4">
          <Text className="text-rose-500 font-black text-xs uppercase tracking-wide mb-2">Synopsis</Text>
          <Text className="text-slate-300 text-base leading-7 font-medium">
            {movie.overview || "No description available for this cinematic masterpiece."}
          </Text>
        </View>

        {/* Production Details Card */}
        <View className="bg-slate-900/50 p-8 rounded-5xl border border-white/5 mb-4">
            <Text className="text-white font-black text-sm uppercase tracking-widest mb-6">Production Details</Text>
            <View className="flex-row justify-between mb-4">
               <Text className="text-slate-500 font-bold uppercase text-2xs tracking-wide">Original Language</Text>
               <Text className="text-white font-black uppercase text-2xs tracking-wide">{movie.original_language || 'EN'}</Text>
            </View>
            <View className="flex-row justify-between mb-4">
               <Text className="text-slate-500 font-bold uppercase text-2xs tracking-wide">Vote Count</Text>
               <Text className="text-white font-black uppercase text-2xs tracking-wide">{movie.vote_count || '0'}+</Text>
            </View>
            <View className="flex-row justify-between">
               <Text className="text-slate-500 font-bold uppercase text-2xs tracking-wide">Popularity Score</Text>
               <Text className="text-emerald-500 font-black uppercase text-2xs tracking-wide">{Math.round(movie.popularity || 0)}</Text>
            </View>
        </View>

        <View className="mb-20">
           <View className="bg-rose-600/10 p-8 rounded-5xl border border-rose-600/20">
              <View className="flex-row items-center mb-4">
                 <View className="bg-rose-600 p-2 rounded-xl mr-3">
                    <Ionicons name="sparkles" size={18} color="white" />
                 </View>
                 <Text className="text-white font-black uppercase text-xs tracking-wide">Fync Smart Recommendation</Text>
              </View>
              <Text className="text-slate-400 text-sm leading-6 font-medium">
                Our AI suggests this title based on your recent activity in Fync Media. Swipe down to discover more legends.
              </Text>
           </View>
        </View>
      </ScrollView>
    </View>
  );
};

const TrailerReels = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [movies, setMovies] = useState<any[]>(route.params?.movies || []);
  const [activeIndex, setActiveIndex] = useState(route.params?.initialIndex || 0);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [trailerCache, setTrailerCache] = useState<Record<string, string | null>>({});

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
      setMovies(data);
      await fetchAllTrailers(data);
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
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <FlatList
        data={movies}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <ReelItem 
            movie={item} 
            isActive={index === activeIndex} 
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            cachedTrailerKey={trailerCache[item.id]}
          />
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        removeClippedSubviews={true}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        initialScrollIndex={route.params?.initialIndex || 0}
      />

      {/* Close Button */}
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        style={{ top: insets.top + 10, left: 20 }}
        className="absolute z-[100] w-10 h-10 bg-black/40 rounded-full items-center justify-center border border-white/10"
      >
        <Ionicons name="close" size={24} color="white" />
      </TouchableOpacity>
    </View>
  );
};

export default TrailerReels;
