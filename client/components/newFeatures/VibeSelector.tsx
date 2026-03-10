import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Keyboard
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchRadioByCategory, searchRadioStations } from '../../constants/musicService';

//@ts-ignore
import FYNC_LOGO from '../../assets/logo.png';

let globalSound: Audio.Sound | null = null;

export default function VibeSelector() {
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('bollywood');
  const [searchQuery, setSearchQuery] = useState('');

  // Track scroll position to toggle the mini-player
  const [scrollY, setScrollY] = useState(0);

  const navigation = useNavigation<any>();

  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true
    });
    loadCategoryRadio('bollywood');
    return () => {
      unloadCurrentSound();
    };
  }, []);

  const unloadCurrentSound = async () => {
    if (globalSound) {
      try {
        await globalSound.stopAsync();
        await globalSound.unloadAsync();
      } catch (e) {
        console.log(e);
      } finally {
        globalSound = null;
      }
    }
  };

  const loadCategoryRadio = async (category: string) => {
    setActiveCategory(category);
    setSearchQuery('');
    setLoading(true);
    await unloadCurrentSound();

    const stations = await fetchRadioByCategory(category);
    setPlaylist(stations);

    if (stations.length > 0) {
      playRadio(stations[0].streamUrl, 0);
    }

    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    Keyboard.dismiss();
    setActiveCategory('search');
    setLoading(true);
    await unloadCurrentSound();

    const stations = await searchRadioStations(searchQuery);
    setPlaylist(stations);

    if (stations.length > 0) {
      playRadio(stations[0].streamUrl, 0);
    } else {
      setIsPlaying(false);
    }

    setLoading(false);
  };

  const playRadio = async (url: string, index: number) => {
    setLoading(true);
    await unloadCurrentSound();

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true }
      );

      globalSound = sound;
      setCurrentIndex(index);
      setIsPlaying(true);
    } catch (error) {
      console.log("Failed to play this station stream", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!globalSound) return;

    if (isPlaying) {
      await globalSound.pauseAsync();
    } else {
      await globalSound.playAsync();
    }
    setIsPlaying(!isPlaying);
  };

  const current = playlist[currentIndex];

  // Show mini player when user scrolls past the large player (approx 280px)
  const showMiniPlayer = scrollY > 280;

  return (
    <View className="flex-1 bg-black">
      {/* HEADER & SEARCH (Fixed at top) */}
      <LinearGradient colors={['#F06292', '#000']} className="px-5 pt-14 pb-6 z-20">
        <View className="flex-row items-center mb-4">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-extrabold italic tracking-tighter">
            FYNC <Text className="text-pink-400">RADIO</Text>
          </Text>
        </View>

        {/* SEARCH BAR */}
        <View className="flex-row items-center bg-black/30 rounded-full px-4 py-3 border border-white/20">
          <Ionicons name="search" size={20} color="#fbcfe8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            placeholder="Search artists, vibes, or stations..."
            placeholderTextColor="#fbcfe8"
            returnKeyType="search"
            className="flex-1 text-white ml-3 font-medium"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#fbcfe8" />
            </TouchableOpacity>
          )}
        </View>

        {/* CATEGORY BUTTONS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-5">
          {[
            ['bollywood', '🎶 Bollywood'],
            ['lofi', '🌙 Lofi'],
            ['study', '📚 Study'],
            ['punjabi', '🔥 Punjabi'],
            ['english', '🎧 English']
          ].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => loadCategoryRadio(key)}
              className={`px-4 py-2.5 rounded-full mr-3 border ${activeCategory === key ? 'bg-white border-white' : 'bg-black/20 border-white/20'
                }`}
            >
              <Text
                className={`font-bold tracking-wider text-xs uppercase ${activeCategory === key ? 'text-pink-600' : 'text-white'
                  }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* COMPACT STICKY MINI-PLAYER (Appears when scrolled down) */}
      {showMiniPlayer && current && (
        <View className="flex-row items-center bg-[#1e1e1e] px-5 py-3 border-b border-white/10 shadow-2xl z-20">
          <Image
            source={current.artwork ? { uri: current.artwork } : FYNC_LOGO}
            className="w-12 h-12 rounded-lg bg-gray-900 border border-white/10"
            resizeMode="cover"
          />
          <View className="flex-1 ml-4 mr-3 justify-center">
            <Text className="text-white font-bold text-sm" numberOfLines={1}>
              {current.name}
            </Text>
            <Text className="text-pink-400 text-[10px] mt-0.5 tracking-widest font-bold uppercase">
              🔴 LIVE STREAM
            </Text>
          </View>
          <TouchableOpacity
            onPress={togglePlayPause}
            className="w-10 h-10 bg-pink-600/20 border border-pink-500/50 rounded-full items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ec4899" />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={18}
                color="#ec4899"
                style={{ marginLeft: isPlaying ? 0 : 2 }}
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* SCROLLABLE CONTENT */}
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={16} // Captures scroll position smoothly
      >

        {/* LARGE NOW PLAYING SECTION (Scrolls up and disappears) */}
        {current ? (
          <View className={`items-center mt-4 pb-6 ${showMiniPlayer ? 'opacity-0' : 'opacity-100'}`}>
            <View className="shadow-2xl shadow-pink-500/50 rounded-3xl overflow-hidden border border-white/10">
              <Image
                source={current.artwork ? { uri: current.artwork } : FYNC_LOGO}
                className="w-64 h-64 bg-gray-900"
                resizeMode="cover"
              />
            </View>

            <Text className="text-white text-2xl font-bold mt-6 text-center px-4" numberOfLines={2}>
              {current.name}
            </Text>

            <Text className="text-pink-400 text-xs mt-2 tracking-widest font-black uppercase bg-pink-500/10 px-3 py-1 rounded-md border border-pink-500/20">
              🔴 LIVE STREAM
            </Text>

            <TouchableOpacity
              onPress={togglePlayPause}
              className="w-20 h-20 bg-pink-500 rounded-full items-center justify-center mt-6 shadow-lg shadow-pink-500/50"
            >
              {loading ? (
                <ActivityIndicator color="white" size="large" />
              ) : (
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={40}
                  color="white"
                  style={{ marginLeft: isPlaying ? 0 : 4 }}
                />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View className="items-center justify-center mt-20 pb-10 opacity-50">
            <Ionicons name="radio-outline" size={64} color="gray" />
            <Text className="text-gray-400 mt-4 font-bold">No stations found.</Text>
          </View>
        )}

        {/* STATION LIST */}
        <Text className="text-gray-400 font-bold mb-4 uppercase tracking-widest text-xs border-t border-white/10 pt-6">
          {activeCategory === 'search' ? `Search Results for "${searchQuery}"` : 'Up Next'}
        </Text>

        {playlist.map((station, i) => (
          <TouchableOpacity
            key={station.id}
            onPress={() => playRadio(station.streamUrl, i)}
            className={`flex-row items-center mb-4 p-3 rounded-2xl border ${i === currentIndex ? 'bg-pink-500/10 border-pink-500/30' : 'bg-[#1e1e1e] border-white/5'}`}
          >
            <Image
              source={station.artwork ? { uri: station.artwork } : FYNC_LOGO}
              className="w-12 h-12 rounded-xl bg-gray-800"
              resizeMode='cover'
            />

            <View className="ml-4 flex-1">
              <Text className={`font-bold ${i === currentIndex ? 'text-pink-400' : 'text-white'}`} numberOfLines={1}>
                {station.name}
              </Text>
              <Text className="text-gray-500 text-[10px] mt-0.5 uppercase tracking-wider font-bold">
                {station.tags ? station.tags.split(',')[0] : 'Radio Station'}
              </Text>
            </View>

            {i === currentIndex && isPlaying ? (
              <View className="w-8 h-8 rounded-full bg-pink-500/20 items-center justify-center">
                <ActivityIndicator size="small" color="#ec4899" />
              </View>
            ) : (
              <Ionicons name="play-circle" size={28} color={i === currentIndex ? "#ec4899" : "#4b5563"} />
            )}
          </TouchableOpacity>
        ))}
        <View className="h-32" />
      </ScrollView>
    </View>
  );
}