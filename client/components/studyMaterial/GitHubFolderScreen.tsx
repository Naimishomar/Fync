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
import Ionicons from '@expo/vector-icons/Ionicons';
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>
        <View className='px-gutter pt-8 bg-transparent'>
          <View className="flex-row items-center justify-between mb-8">
            <View className="flex-1 mr-4">
              <Text className="text-ink text-3xl font-display uppercase" numberOfLines={1}>
                {title.length > 15 ? title.substring(0, 12) + '...' : title}
              </Text>
              <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Repo Explorer / {path || 'root'}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
              <Ionicons name="arrow-back" size={20} color="#12100E" />
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center bg-card px-4 py-1 border-2 border-ink mb-6 rounded-md">
            <Ionicons name="search" size={20} color="#C4BEB6" />
            <TextInput
              placeholder="Search in this folder..."
              placeholderTextColor="#C4BEB6"
              value={search}
              onChangeText={setSearch}
              className="flex-1 text-ink font-display text-sm p-3"
            />
          </View>
        </View>

        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="mt-4 text-ink-3 font-display text-label uppercase">Fetching Protocol...</Text>
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
                  className="flex-row items-center p-5 mx-gutter mb-4 bg-card rounded-card border border-line"
                  onPress={() => handlePress(item)}
                >
                  <View className="w-14 h-14 bg-paper-2 rounded-card items-center justify-center p-2.5">
                    <Image
                      source={{ uri: isFolder ? FOLDER_IMG : getFileIcon(item.name) }}
                      className="w-full h-full"
                      resizeMode="contain"
                    />
                  </View>

                  <View className="ml-4 flex-1">
                    <Text className="text-ink text-sm font-display uppercase" numberOfLines={1}>
                      {(item.name || "").replace('.md', '')}
                    </Text>
                    <Text className="text-ink-3 text-label font-display uppercase mt-1">
                      {isFolder ? 'Category' : 'Note File'}
                    </Text>
                  </View>

                  <View className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center">
                    <Ionicons name={isFolder ? "chevron-forward" : "eye-outline"} size={12} color="#C4BEB6" />
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center mt-20 px-gutter">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                  <Ionicons name="folder-open-outline" size={32} color="#C4BEB6" />
                </View>
                <Text className="font-semibold text-base text-ink text-center">No protocol files found</Text>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default GitHubFolderScreen;
