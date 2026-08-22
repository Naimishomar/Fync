import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';

export default function MasterStudyHub() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (q.length < 3) return;

    setResultsOpen(true);
    setSearchLoading(true);
    setResults([]);
    try {
      const res = await axios.get('/notes/search', { params: { q } });
      if (res.data.success) setResults(res.data.results);
    } catch {
      // The empty state already says nothing was found, which is what an
      // unreachable source looks like from here anyway.
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const mainCategories = [
    { 
      id: 'dsa', 
      name: 'DSA Prep', 
      description: 'Master Data Structures', 
      icon: 'infinite-outline', 
      bg: '#12100E', fg: '#FFFFFF',   // ink, white text 18.98:1
      onPress: () => navigation.navigate('DSAPrep')
    },
    { 
      id: 'interview', 
      name: 'Interview Prep', 
      description: 'Dynamic Subject Notes', 
      icon: 'briefcase-outline', 
      bg: '#F97316', fg: '#12100E',   // brand-500, ink text 6.77:1
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
      bg: '#C2410C', fg: '#FFFFFF',   // brand-700, white text 5.18:1
      onPress: () => navigation.navigate('GitHubFolderScreen', { 
        owner: 'AkashSingh3031', 
        repo: 'The-Complete-FAANG-Preparation', 
        path: '', 
        title: 'FAANG Prep' 
      })
    }
  ];

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* TOP BAR */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <View>
            <Text className="text-ink text-3xl font-display uppercase">Fync <Text className="text-fam-study">Academy</Text></Text>
            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">The Infinite Tech Protocol</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="w-11 h-11 items-center justify-center rounded-xl"
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={20} color="#12100E" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1 px-4 mt-4" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* SEARCH BAR */}
          <View className="mb-6 bg-card p-4 rounded-sheet shadow-hair border border-line">
            <View className="flex-row items-center mb-3 ml-2">
              <Ionicons name="search-circle" size={18} color="#EA580C" />
              <Text className="text-ink font-display text-label uppercase ml-2">Fync Search</Text>
              <View className="ml-2 bg-danger/15 px-2 py-0.5 rounded-md">
                <Text className="text-danger font-semibold text-label uppercase">PDF Only</Text>
              </View>
            </View>
            <View className="flex-row items-center bg-paper-2 px-5 py-4 border-2 border-ink rounded-md">
              <Ionicons name="search" size={20} color="#8B857E" />
              <TextInput 
                className="flex-1 ml-3 text-ink-2 font-semibold text-sm p-0"
                placeholder="Search DSA, React, ML..."
                placeholderTextColor="#8B857E"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#C4BEB6" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View>
            {/* LARGE CATEGORY CARDS */}
            {mainCategories.map((cat, index) => (
              <TouchableOpacity
                key={cat.id}
                onPress={cat.onPress}
                activeOpacity={0.8}
                className="w-full mb-4 overflow-hidden rounded-card bg-card border-2 border-ink"
              >
                <View
                  style={{ backgroundColor: cat.bg }}
                  className="p-6 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    {/* Outlined in the foreground colour rather than a white
                        wash, which disappeared on the light card. */}
                    <View
                      className="p-4 rounded-card mr-4 border-2"
                      style={{ borderColor: cat.fg }}
                    >
                      <Ionicons name={cat.icon as any} size={28} color={cat.fg} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-display text-xl uppercase leading-tight" style={{ color: cat.fg }}>
                        {cat.name}
                      </Text>
                      <Text className="text-label font-semibold uppercase mt-0.5" style={{ color: cat.fg, opacity: 0.75 }}>
                        {cat.description}
                      </Text>
                    </View>
                  </View>
                  <View className="w-10 h-10 rounded-full items-center justify-center">
                    <Ionicons name="chevron-forward" size={18} color={cat.fg} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}

            {/* MOTIVATIONAL CARD */}
            <View className="mt-4 rounded-sheet bg-ink p-card-pad border border-ink">
              <View className="flex-row items-center mb-4">
                <View className="bg-brand-500 p-2 rounded-xl mr-3">
                  <Ionicons name="rocket-outline" size={20} color="#12100E" />
                </View>
                <Text className="text-white font-display text-lg uppercase">Mission: Expert</Text>
              </View>
              <Text className="text-ink-3 text-sm leading-relaxed font-medium">
                Unlock the world's most comprehensive technical library. From the fundamentals of DSA to elite FAANG preparation, your journey to mastery begins here.
              </Text>
              <TouchableOpacity className="mt-6 bg-card self-start px-6 py-3 rounded-card shadow-hair">
                <Text className="font-semibold text-base text-ink">Start Learning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* WEBVIEW MODAL */}
      {/* Results are drawn here, not loaded from a search engine.
          This used to be a WebView pointed at Google with CSS injected to hide
          its chrome — which still looked like Google, because it was. The
          backend returns open-access PDFs as data and the list below is ours. */}
      <Modal visible={resultsOpen} animationType="slide" onRequestClose={() => setResultsOpen(false)}>
        <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
          <View className="px-5 pt-2 pb-3 border-b-2 border-ink bg-paper">
            <TouchableOpacity
              onPress={() => setResultsOpen(false)}
              className="w-11 h-11 items-center justify-center rounded-xl"
              style={{ marginLeft: -11 }}
              accessibilityRole="button"
              accessibilityLabel="Close results"
            >
              <Ionicons name="arrow-back" size={24} color="#12100E" />
            </TouchableOpacity>
            <Text className="font-display text-xl text-ink mt-1" numberOfLines={1}>{searchQuery}</Text>
            <Text className="text-ink-3 font-display uppercase text-label mt-1">
              {searchLoading ? 'Searching' : `${results.length} free PDFs`}
            </Text>
          </View>

          {searchLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#F97316" />
              <Text className="font-semibold text-base text-ink mt-4">Finding PDFs...</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setResultsOpen(false);
                    navigation.navigate('PDFViewerScreen', { title: item.title, url: item.pdfUrl });
                  }}
                  className="bg-card border-2 border-ink rounded-card p-4 mb-3"
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${item.title}`}
                >
                  <View className="flex-row items-center mb-2">
                    <View className="bg-brand-500 px-2 py-1 rounded-sm">
                      <Text className="font-display uppercase text-ink" style={{ fontSize: 9 }}>PDF</Text>
                    </View>
                    <Text className="font-sans text-ink-3 ml-2 flex-1" style={{ fontSize: 11 }} numberOfLines={1}>
                      {item.source}{item.year ? ` · ${item.year}` : ''}
                    </Text>
                  </View>

                  <Text className="font-display text-base text-ink" numberOfLines={3}>{item.title}</Text>

                  {item.authors?.length > 0 && (
                    <Text className="font-sans text-ink-3 mt-1" style={{ fontSize: 11 }} numberOfLines={1}>
                      {item.authors.join(', ')}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View className="items-center mt-20 px-8">
                  <Ionicons name="document-outline" size={52} color="#C4BEB6" />
                  <Text className="font-display text-base text-ink mt-4 text-center">Nothing found</Text>
                  <Text className="font-sans text-ink-3 mt-2 text-center" style={{ fontSize: 13 }}>
                    Try the subject name on its own, like "operating systems".
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
