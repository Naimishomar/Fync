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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
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
      color: ['#8b5cf6', '#7c3aed'],
      onPress: () => navigation.navigate('DSAPrep')
    },
    { 
      id: 'interview', 
      name: 'Interview Prep', 
      description: 'Dynamic Subject Notes', 
      icon: 'briefcase-outline', 
      color: ['#3b82f6', '#2563eb'],
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
      color: ['#ec4899', '#db2777'],
      onPress: () => navigation.navigate('GitHubFolderScreen', { 
        owner: 'AkashSingh3031', 
        repo: 'The-Complete-FAANG-Preparation', 
        path: '', 
        title: 'FAANG Prep' 
      })
    }
  ];

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-96 opacity-30">
        <LinearGradient
          colors={['#8b5cf6', '#3b82f6', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        {/* TOP BAR */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <View>
            <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase">Fync <Text className="text-purple-600">Academy</Text></Text>
            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">The Infinite Tech Protocol</Text>
          </View>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="w-12 h-12 rounded-2xl items-center justify-center border border-slate-100 bg-white shadow-sm"
          >
            <Ionicons name="arrow-back" size={20} color="#18181b" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          className="flex-1 px-4 mt-4" 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {/* SEARCH BAR */}
          <View className="mb-6 bg-white p-4 rounded-4xl shadow-sm border border-slate-100">
            <View className="flex-row items-center mb-3 ml-2">
              <Ionicons name="logo-google" size={16} color="#3b82f6" />
              <Text className="text-slate-900 font-black text-2xs uppercase tracking-wide ml-2">Fync Search</Text>
              <View className="ml-2 bg-red-100 px-2 py-0.5 rounded-md">
                <Text className="text-red-600 font-bold text-2xs uppercase tracking-wide">PDF Only</Text>
              </View>
            </View>
            <View className="flex-row items-center bg-slate-50 rounded-2xl px-5 py-4 border border-slate-200">
              <Ionicons name="search" size={20} color="#94a3b8" />
              <TextInput 
                className="flex-1 ml-3 text-slate-700 font-bold text-sm p-0"
                placeholder="Search DSA, React, ML..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color="#cbd5e1" />
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
                className="w-full mb-4 overflow-hidden rounded-4xl bg-white border border-slate-100"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.05,
                  shadowRadius: 20,
                  elevation: 5
                }}
              >
                <LinearGradient
                  colors={cat.color as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  className="p-6 flex-row items-center justify-between"
                >
                  <View className="flex-row items-center flex-1">
                    <View className="bg-white/20 p-4 rounded-2xl mr-4">
                      <Ionicons name={cat.icon as any} size={28} color="white" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-black text-xl uppercase tracking-tighter leading-tight">
                        {cat.name}
                      </Text>
                      <Text className="text-white/70 text-2xs font-bold uppercase tracking-wide mt-0.5">
                        {cat.description}
                      </Text>
                    </View>
                  </View>
                  <View className="bg-white/10 w-10 h-10 rounded-full items-center justify-center">
                    <Ionicons name="chevron-forward" size={18} color="white" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}

            {/* MOTIVATIONAL CARD */}
            <View className="mt-4 rounded-5xl bg-slate-900 p-8 border border-slate-800">
              <View className="flex-row items-center mb-4">
                <View className="bg-pink-500 p-2 rounded-xl mr-3">
                  <Ionicons name="rocket-outline" size={20} color="white" />
                </View>
                <Text className="text-white font-black text-lg uppercase tracking-tighter">Mission: Expert</Text>
              </View>
              <Text className="text-slate-500 text-sm leading-relaxed font-medium">
                Unlock the world's most comprehensive technical library. From the fundamentals of DSA to elite FAANG preparation, your journey to mastery begins here.
              </Text>
              <TouchableOpacity className="mt-6 bg-white self-start px-6 py-3 rounded-2xl shadow-lg">
                <Text className="text-black font-black text-xs uppercase tracking-wide">Start Learning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* WEBVIEW MODAL */}
      <Modal visible={isWebViewVisible} animationType="slide" onRequestClose={() => setIsWebViewVisible(false)}>
        <SafeAreaView className="flex-1 bg-white" edges={['top']}>
          <View className="flex-row items-center justify-between p-4 border-b border-slate-100 bg-white">
            <TouchableOpacity onPress={() => setIsWebViewVisible(false)} className="w-10 h-10 items-center justify-center bg-slate-50 rounded-full">
              <Ionicons name="close" size={24} color="#1e293b" />
            </TouchableOpacity>
            <View className="items-center">
              <Text className="text-slate-900 font-black text-sm uppercase tracking-widest">{searchQuery}</Text>
              <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wide">PDF Results</Text>
            </View>
            <View className="w-10" />
          </View>
          
          <View className="flex-1 relative bg-white">
            <WebView 
              source={{ uri: currentSearchUrl }}
              className="flex-1 bg-white"
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
              <View className="absolute inset-0 items-center justify-center bg-white z-10">
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text className="mt-4 text-slate-500 font-black text-xs uppercase tracking-wide">Indexing PDFs...</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
