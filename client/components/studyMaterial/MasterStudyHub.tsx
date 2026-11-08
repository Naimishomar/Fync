import React, { useCallback, useRef, useState } from 'react';
import { View, Text, ScrollView, StatusBar, Modal, FlatList, ActivityIndicator, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, Meta, Card, ListRow, Divider, SearchField, Empty, Button, Label, Tag, IconTile } from '../ui/kit';

// Module scope + memo: FlatList rows must not be re-created per render.
const ResultRow = React.memo(function ResultRow({ item, onOpen }: { item: any; onOpen: (item: any) => void }) {
  return (
    <Pressable
      onPress={() => onOpen(item)}
      className="bg-card border border-line rounded-2xl p-4 mb-3 active:opacity-85"
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.title}`}
    >
      <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
        <Tag label="PDF" icon="document-text-outline" />
        <Text className="font-sans text-xs text-ink-3 flex-1" numberOfLines={1}>
          {item.source}{item.year ? ` · ${item.year}` : ''}
        </Text>
      </View>
      <Text className="font-semibold text-base text-ink" numberOfLines={3}>{item.title}</Text>
      {item.authors?.length > 0 && (
        <Text className="font-sans text-xs text-ink-3 mt-1" numberOfLines={1}>{item.authors.join(', ')}</Text>
      )}
    </Pressable>
  );
});

export default function MasterStudyHub() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  // A second search submitted before the first replies must not be
  // overwritten by the older, slower response.
  const requestIdRef = useRef(0);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 3) return;

    const requestId = ++requestIdRef.current;
    setResultsOpen(true);
    setSearchLoading(true);
    setResults([]);
    try {
      const res = await axios.get('/notes/search', { params: { q } });
      if (requestId !== requestIdRef.current) return;
      if (res.data.success) setResults(res.data.results ?? []);
    } catch {
      // The empty state already says nothing was found, which is what an
      // unreachable source looks like from here anyway.
      if (requestId === requestIdRef.current) setResults([]);
    } finally {
      if (requestId === requestIdRef.current) setSearchLoading(false);
    }
  };

  const mainCategories = [
    { 
      id: 'dsa', 
      name: 'DSA Prep', 
      description: 'Master Data Structures', 
      icon: 'infinite-outline', 
      onPress: () => navigation.navigate('DSAPrep')
    },
    { 
      id: 'interview', 
      name: 'Interview Prep', 
      description: 'Dynamic Subject Notes', 
      icon: 'briefcase-outline', 
      onPress: () => navigation.navigate('GitHubFolderScreen', { 
        owner: '8483', 
        repo: 'notes', 
        path: 'topics', 
        title: 'Interview Prep' 
      })
    },
    { 
      id: 'faang', 
      name: 'FAANG Prep', 
      description: 'Elite Placement Kit', 
      icon: 'trophy-outline', 
      onPress: () => navigation.navigate('GitHubFolderScreen', { 
        owner: 'AkashSingh3031', 
        repo: 'The-Complete-FAANG-Preparation', 
        path: '', 
        title: 'FAANG Prep' 
      })
    }
  ];

  const openResult = useCallback((item: any) => {
    setResultsOpen(false);
    navigation.navigate('PDFViewerScreen', { title: item.title, url: item.pdfUrl });
  }, [navigation]);
  const renderResult = useCallback(({ item }: { item: any }) => <ResultRow item={item} onOpen={openResult} />, [openResult]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <AppBar title="Fync Academy" onBack={() => navigation.goBack()} />

      <ScrollView keyboardShouldPersistTaps="handled"
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 }}
      >
        {/* SEARCH */}
        <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
          <Label>Search free PDFs</Label>
          <Tag label="PDF only" />
        </View>
        <SearchField
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          placeholder="Search DSA, React, ML"
          containerStyle={{ marginBottom: 24 }}
        />

        {/* CATEGORIES */}
        <Card style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
          {mainCategories.map((cat, index) => (
            <React.Fragment key={cat.id}>
              {index > 0 && <Divider />}
              <ListRow
                leading={<IconTile icon={cat.icon as any} size={44} color={C.accentText} bg={C.brand[50]} />}
                title={cat.name}
                subtitle={cat.description}
                onPress={cat.onPress}
              />
            </React.Fragment>
          ))}
        </Card>

        {/* MOTIVATIONAL CARD (intentional dark panel) */}
        <View className="mt-4 rounded-2xl bg-night p-5">
          <View className="flex-row items-center mb-3">
            <View className="bg-brand-500 w-10 h-10 rounded-full items-center justify-center mr-3">
              <Ionicons name="rocket-outline" size={20} color={C.onBrand} />
            </View>
            <Text className="font-display text-lg" style={{ color: C.nightInk }}>Mission: Expert</Text>
          </View>
          <Text className="text-sm leading-relaxed" style={{ color: C.nightInk, opacity: 0.75 }}>
            Unlock the world's most comprehensive technical library. From the fundamentals of DSA to elite FAANG preparation, your journey to mastery begins here.
          </Text>
          <Button title="Start learning" variant="primary" onPress={() => navigation.navigate('DSAPrep')} style={{ alignSelf: 'flex-start', marginTop: 16 }} />
        </View>
      </ScrollView>

      {/* Results are drawn here, not loaded from a search engine.
          This used to be a WebView pointed at Google with CSS injected to hide
          its chrome — which still looked like Google, because it was. The
          backend returns open-access PDFs as data and the list below is ours.
          Full-screen modal (not a Sheet): it is a results page with its own app bar. */}
      <Modal visible={resultsOpen} animationType="slide" statusBarTranslucent onRequestClose={() => setResultsOpen(false)}>
        <View className="flex-1 bg-paper">
          <AppBar title={searchQuery} onBack={() => setResultsOpen(false)} />
          {!searchLoading && <Meta style={{ paddingHorizontal: 20 }}>{results.length} free PDFs</Meta>}

          {searchLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={C.brand[500]} />
              <Text className="font-semibold text-base text-ink mt-4">Finding PDFs…</Text>
            </View>
          ) : (
            <FlatList keyboardShouldPersistTaps="handled"
              data={results}
              keyExtractor={(r, i) => String(r.id ?? r.pdfUrl ?? i)}
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              renderItem={renderResult}
              ListEmptyComponent={
                <Empty icon="document-outline" title="Nothing found" hint={'Try the subject name on its own, like "operating systems".'} />
              }
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
