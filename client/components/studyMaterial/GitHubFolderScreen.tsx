import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, StatusBar, ActivityIndicator } from 'react-native';
import { AppBar, Meta, ListRow, SearchField, Empty, Button } from '../ui/kit';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { C } from '../../constants/colors';

const CODE_RE = /\.(cpp|py|java|c|js|ts|tsx|h)$/i;

const RepoRow = React.memo(function RepoRow({ item, onOpen }: { item: any; onOpen: (item: any) => void }) {
  const isFolder = item.type === 'dir';
  const name = item.name || '';
  return (
    <ListRow
      icon={isFolder ? 'folder-outline' : CODE_RE.test(name) ? 'code-slash-outline' : 'document-text-outline'}
      title={name.replace('.md', '')}
      subtitle={isFolder ? 'Folder' : 'Note file'}
      onPress={() => onOpen(item)}
      style={{ paddingHorizontal: 20 }}
    />
  );
});

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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchRepoContents();
  }, [path, repo, owner]);

  const fetchRepoContents = async () => {
    setLoading(true);
    setFailed(false);
    try {
      // Use a fresh axios instance to avoid global interceptors adding local auth tokens
      const githubAxios = axios.create();
      const response = await githubAxios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
      // Sort: Folders first, then files
      // A file path or an API error body is an object, not a listing.
      const sortedData = (Array.isArray(response.data) ? response.data : []).sort((a: any, b: any) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'dir' ? -1 : 1;
      });
      setItems(sortedData);
    } catch (error) {
      // Usually GitHub's 60-requests-an-hour anonymous limit; say so instead of "no files".
      console.error("Error fetching repo contents:", error);
      setFailed(true);
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

  const handlePress = useCallback((item: any) => {
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
    } else if (/\.pdf$/i.test(name) && item.download_url) {
      // Listed but previously did nothing when tapped.
      navigation.navigate('PDFViewerScreen', { url: item.download_url, title: name });
    }
  }, [navigation, owner, repo]);

  const renderItem = useCallback(({ item }: { item: any }) => <RepoRow item={item} onOpen={handlePress} />, [handlePress]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <AppBar title={title} onBack={() => navigation.goBack()} />
      <View className="px-gutter pb-2">
        <Meta style={{ marginBottom: 8 }} numberOfLines={1}>{path || 'root'}</Meta>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search in this folder" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={C.brand[500]} />
          <Text className="mt-4 text-ink-3 font-semibold text-sm">Loading files…</Text>
        </View>
      ) : (
        <FlatList keyboardShouldPersistTaps="handled"
          data={filteredItems}
          keyExtractor={(item) => item.path}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <Empty
              icon="folder-open-outline"
              title={failed ? "Couldn't load this folder" : 'No files here'}
              action={failed ? <Button title="Try again" onPress={fetchRepoContents} /> : undefined}
            />
          }
        />
      )}
    </View>
  );
};

export default GitHubFolderScreen;
