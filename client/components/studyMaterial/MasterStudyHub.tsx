import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function MasterStudyHub() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [isWebViewVisible, setIsWebViewVisible] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [currentSearchUrl, setCurrentSearchUrl] = useState('');

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery.trim() + ' filetype:pdf')}`;
    setCurrentSearchUrl(url);
    setIsWebViewVisible(true);
    setWebViewLoading(true);
  };

  const mainCategories = [
    { 
      id: 'dsa', 
      name: 'DSA Prep', 
      description: 'Master Data Structures', 
      icon: 'infinite-outline', 
      color: ['#7C3AED', '#7c3aed'],
      onPress: () => navigation.navigate('DSAPrep')
    },
    { 
      id: 'interview', 
      name: 'Interview Prep', 
      description: 'Dynamic Subject Notes', 
      icon: 'briefcase-outline', 
      color: ['#2563EB', '#2563eb'],
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
      color: ['#F97316', '#db2777'],
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
              <Ionicons name="logo-google" size={16} color="#2563EB" />
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
                className="w-full mb-4 overflow-hidden rounded-sheet bg-card border border-line"
                style={{
                  shadowColor: "#12100E",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1
                }}
              >
                <View
                  style={{ backgroundColor: cat.color[0] }}
                  className="p-6 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="bg-card/20 p-4 rounded-card mr-4">
                      <Ionicons name={cat.icon as any} size={28} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-display text-xl uppercase leading-tight">
                        {cat.name}
                      </Text>
                      <Text className="text-white/70 text-label font-semibold uppercase mt-0.5">
                        {cat.description}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-card/10 w-10 h-10 rounded-full items-center justify-center">
                    <Ionicons name="chevron-forward" size={18} color="white" />
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
      <Modal visible={isWebViewVisible} animationType="slide" onRequestClose={() => setIsWebViewVisible(false)}>
        <SafeAreaView className="flex-1 bg-paper" edges={['top']}>
          <View className="flex-row items-center justify-between p-4 border-b border-line bg-card">
            <TouchableOpacity onPress={() => setIsWebViewVisible(false)} className="w-10 h-10 items-center justify-center bg-paper-2 rounded-full">
              <Ionicons name="close" size={24} color="#12100E" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-ink font-display text-sm uppercase">{searchQuery}</Text>
              <Text className="text-ink-3 font-semibold text-label uppercase">PDF Results</Text>
            </View>
            <View className="w-10" />
          </View>
          
          <View className="flex-1 relative bg-card">
            <WebView 
              source={{ uri: currentSearchUrl }}
              className="flex-1 bg-paper"
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              injectedJavaScript={`
                var style = document.createElement('style');
                style.innerHTML = 'header, form, footer, [role="banner"], [role="navigation"], [role="contentinfo"], #sfooter { display: none !important; } body { padding-top: 0 !important; background-color: #ffffff !important; }';
                document.head.appendChild(style);
                true;
              `}
              onShouldStartLoadWithRequest={(request) => {
                const { url } = request;
                
                // 1. Intercept Google Redirects (Google Search wraps links in /url?q=...)
                if (url.includes('/url?q=') || url.includes('/url?url=')) {
                  const match = url.match(/[?&](q|url)=([^&]+)/);
                  if (match) {
                    const targetUrl = decodeURIComponent(match[2]);
                    setIsWebViewVisible(false);
                    navigation.navigate('PDFViewerScreen', {
                      title: searchQuery,
                      url: targetUrl
                    });
                    return false; // Prevent WebView from downloading
                  }
                }

                // 2. Intercept direct external links
                const isGoogle = url.includes('google.com') || url.includes('google.co.in');
                if (!isGoogle && url !== 'about:blank') {
                  setIsWebViewVisible(false);
                  navigation.navigate('PDFViewerScreen', {
                    title: searchQuery,
                    url: url
                  });
                  return false; // Prevent WebView from downloading
                }

                return true; // Allow Google Search navigation
              }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
            />
            {webViewLoading && (
              <View className="absolute inset-0 items-center justify-center bg-card z-10">
                <ActivityIndicator size="large" color="#2563EB" />
                <Text className="font-semibold text-base text-ink mt-4">Indexing PDFs...</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
