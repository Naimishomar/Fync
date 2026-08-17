import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';

const FOLDER_IMG = 'https://cdn-icons-png.flaticon.com/512/716/716784.png';
const NOTE_IMG = 'https://cdn-icons-png.flaticon.com/512/3209/3209265.png';

const GitHubFolderScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { 
    owner = '8483', 
    repo = 'notes', 
    path = '', 
    title = 'Repository' 
  } = route.params || {};

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchRepoContents();
  }, [path, repo, owner]);

  const fetchRepoContents = async () => {
    setLoading(true);
    try {
      // Use a fresh axios instance to avoid global interceptors adding local auth tokens
      const githubAxios = axios.create();
      const response = await githubAxios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
      // Sort: Folders first, then files
      const sortedData = response.data.sort((a: any, b: any) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
      setItems(sortedData);
    } catch (error) {
      console.error("Error fetching repo contents:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const name = item.name || "";
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    const hasContent = item.type === 'dir' || (item.size && item.size > 0);
    return matchesSearch && hasContent;
  });

  const handlePress = (item: any) => {
    const name = item.name || "";
    if (item.type === 'dir') {
      navigation.push('GitHubFolderScreen', { 
        owner,
        repo,
        path: item.path, 
        title: name.charAt(0).toUpperCase() + name.slice(1) 
      });
    } else if (name.endsWith('.md')) {
      navigation.navigate('MarkdownViewerScreen', { 
        url: item.download_url, 
        title: name.replace('.md', '') 
      });
    } else if (name.match(/\.(cpp|py|java|c|js|ts|tsx|h)$/i)) {
      const ext = name.split('.').pop()?.toLowerCase() || "";
      const langMap: any = { cpp: 'cpp', py: 'python', java: 'java', c: 'c', js: 'javascript', ts: 'typescript', h: 'cpp' };
      navigation.navigate('CodeViewerScreen', { 
        url: item.download_url, 
        title: name,
        language: langMap[ext] || 'javascript'
      });
    }
  };

  const getFileIcon = (name: string = "") => {
    if (name.endsWith('.md')) return NOTE_IMG;
    if (name.match(/\.(cpp|py|java|c|js|ts|tsx|h)$/i)) return 'https://cdn-icons-png.flaticon.com/512/2721/2721614.png';
    return NOTE_IMG;
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#3b82f6', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className='px-8 pt-8 bg-transparent'>
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-1 mr-4">
              <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase" numberOfLines={1}>
                {title.length > 15 ? title.substring(0, 12) + '...' : title}
              </Text>
              <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Repo Explorer / {path || 'root'}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 rounded-2xl items-center justify-center border border-slate-100 bg-white shadow-sm">
              <Ionicons name="arrow-back" size={20} color="#18181b" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center bg-white px-4 py-1 rounded-2xl border border-slate-100 mb-6">
            <Ionicons name="search" size={20} color="#CBD5E1" />
            <TextInput
              placeholder="Search in this folder..."
              placeholderTextColor="#CBD5E1"
              value={search}
              onChangeText={setSearch}
              className="flex-1 text-slate-900 font-black text-sm tracking-tight p-3"
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text className="mt-4 text-slate-500 font-black text-2xs uppercase tracking-wide">Fetching Protocol...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.path}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            renderItem={({ item }) => {
              const isFolder = item.type === 'dir';
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="flex-row items-center p-5 mx-6 mb-4 bg-white rounded-3xl border border-slate-100"
                  onPress={() => handlePress(item)}
                >
                  <View className="w-14 h-14 bg-slate-50 rounded-2xl items-center justify-center p-2.5">
                    <Image
                      source={{ uri: isFolder ? FOLDER_IMG : getFileIcon(item.name) }}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                  </View>

                  <View className="ml-4 flex-1">
                    <Text className="text-slate-900 text-sm font-black uppercase tracking-tight" numberOfLines={1}>
                      {(item.name || "").replace('.md', '')}
                    </Text>
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">
                      {isFolder ? 'Category' : 'Note File'}
                    </Text>
                  </View>

                  <View className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center">
                    <Ionicons name={isFolder ? "chevron-forward" : "eye-outline"} size={12} color="#CBD5E1" />
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center mt-20 px-10">
                <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6">
                  <Ionicons name="folder-open-outline" size={32} color="#CBD5E1" />
                </View>
                <Text className="text-slate-500 font-black text-xs text-center uppercase tracking-wide">No protocol files found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default GitHubFolderScreen;
