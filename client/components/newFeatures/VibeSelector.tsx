import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchRadioByCategory } from '../../constants/musicService';

let globalSound: Audio.Sound | null = null;

export default function VibeSelector() {
  const [playlist, setPlaylist] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('bollywood');

  const navigation = useNavigation<any>();

  // ---------------------------
  // AUDIO SETUP
  // ---------------------------
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true
    });

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

  // =====================
  // 📻 LOAD CATEGORY RADIO
  // =====================
  const loadCategoryRadio = async (category: string) => {
    setActiveCategory(category);
    setLoading(true);
    await unloadCurrentSound();

    const stations = await fetchRadioByCategory(category);
    setPlaylist(stations);

    if (stations.length > 0) {
      playRadio(stations[0].streamUrl, 0);
    }

    setLoading(false);
  };

  const playRadio = async (url: string, index: number) => {
    setLoading(true);
    await unloadCurrentSound();

    const { sound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true }
    );

    globalSound = sound;
    setCurrentIndex(index);
    setIsPlaying(true);
    setLoading(false);
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

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <View className="flex-1 bg-black">
      {/* HEADER */}
      <LinearGradient colors={['#F06292', '#000']} className="px-5 pt-14 pb-6">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text className="text-white text-3xl font-extrabold">
          Live Radio
        </Text>

        {/* CATEGORY BUTTONS */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
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
              className={`px-4 py-2 rounded-full mr-3 ${
                activeCategory === key ? 'bg-white' : 'bg-white/20'
              }`}
            >
              <Text
                className={`font-bold ${
                  activeCategory === key ? 'text-black' : 'text-white'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* NOW PLAYING */}
      {current && (
        <View className="items-center mt-6">
          <Image source={{ uri: current.artwork }} className="w-56 h-56 rounded-xl" />

          <Text className="text-white text-xl font-bold mt-4">
            {current.name.length > 30
              ? current.name.slice(0, 30) + '...'
              : current.name}
          </Text>

          <Text className="text-red-400 text-sm mt-1">
            🔴 LIVE RADIO
          </Text>

          <TouchableOpacity
            onPress={togglePlayPause}
            className="w-16 h-16 bg-pink-300 rounded-full items-center justify-center mt-6"
          >
            {loading ? (
              <ActivityIndicator color="black" />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color="black"
              />
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* STATION LIST */}
      <ScrollView className="mt-8 px-5">
        <Text className="text-white font-bold mb-3 uppercase">
          Stations
        </Text>

        {playlist.map((station, i) => (
          <TouchableOpacity
            key={station.id}
            onPress={() => playRadio(station.streamUrl, i)}
            className="flex-row items-center mb-4"
          >
            <Image
              source={{ uri: station.artwork }}
              className="w-12 h-12 rounded-lg"
            />

            <View className="ml-4 flex-1">
              <Text className="text-white font-semibold" numberOfLines={1}>
                {station.name}
              </Text>
              <Text className="text-gray-500 text-xs">
                Live Stream
              </Text>
            </View>

            <Ionicons
              name={i === currentIndex && isPlaying ? 'volume-high' : 'play'}
              size={18}
              color="#9ca3af"
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
