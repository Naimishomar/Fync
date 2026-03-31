import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Image, Animated } from 'react-native';
import { fetchDriveData } from '../../utils/handleDrive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const FOLDER_IMG = 'https://cdn-icons-png.flaticon.com/512/716/716784.png'; 
const PDF_IMG = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';

const DriveFolderScreen = ({ route, navigation }: any) => {
  const { folderId, title } = route.params;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: title || "Resources" });
    loadData();
  }, [folderId]);

  const loadData = async () => {
    setLoading(true);
    const data = await fetchDriveData(folderId);
    setItems(data || []);
    setLoading(false);
  };

  const handlePress = (item: any) => {
    if (item.mimeType === 'application/vnd.google-apps.folder') {
      navigation.push('DriveFolderScreen', { folderId: item.id, title: item.name });
    } else {
      navigation.navigate('PDFViewerScreen', { fileId: item.id, title: item.name });
    }
  };

  const SkeletonItem = () => {
    const pulseAnim = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 0.6, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View 
            style={{ opacity: pulseAnim }}
            className="flex-row items-center p-4 mx-4 mb-3 bg-zinc-900 rounded-2xl border border-zinc-800"
        >
            <View className="w-10 h-10 bg-zinc-800 rounded-lg" />
            <View className="ml-4 flex-1">
                <View className="h-4 bg-zinc-800 rounded w-3/4 mb-2" />
                <View className="h-3 bg-zinc-800 rounded w-1/2" />
            </View>
            <View className="w-4 h-4 bg-zinc-800 rounded-full" />
        </Animated.View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-black py-12">
        <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
        <View className='flex-row items-center gap-1 px-4 mb-6'>
            <Ionicons name="arrow-back-outline" size={24} color="white" />
            <Text className='text-2xl font-bold text-white uppercase italic'>Loading Notes</Text>
        </View>
        {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonItem key={i} />)}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black py-12">
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
      <View className='flex-row items-center gap-1 px-4'>
        <Ionicons name="arrow-back-outline" size={24} color="white" onPress={()=> navigation.goBack()} />
        <Text className='text-2xl font-bold text-white'>📑NOTES</Text>
      </View>
      <FlatList
        data={items}
        contentContainerStyle={{ paddingVertical: 10 }}
        keyExtractor={(item: any) => item.id}
        renderItem={({ item }) => {
          const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
          
          return (
            <TouchableOpacity 
              activeOpacity={0.7}
              className="flex-row items-center p-4 mx-4 mb-3 bg-black/30 rounded-2xl shadow-sm border border-gray-800" 
              onPress={() => handlePress(item)}
            >
              {/* Use uri object for remote images */}
              <View className="w-12 h-12 items-center justify-center">
                <Image 
                  source={{ uri: isFolder ? FOLDER_IMG : PDF_IMG }}
                  style={{ width: 40, height: 40 }}
                  className="w-10 h-10"
                  resizeMode="contain"
                />
              </View>
              
              <View className="ml-4 flex-1">
                <Text className="text-white text-base font-bold" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-gray-200 text-xs mt-1">
                  {isFolder ? 'Folder • View contents' : 'PDF • Tap to read'}
                </Text>
              </View>

              <Text className="text-gray-200 text-xl ml-2">›</Text>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View className="items-center mt-20">
            <Text className="text-gray-200 font-medium">No files available here</Text>
          </View>
        }
      />
    </View>
  );
};

export default DriveFolderScreen;