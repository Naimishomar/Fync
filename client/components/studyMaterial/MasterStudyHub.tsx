import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

export default function MasterStudyHub() {
  const navigation = useNavigation<any>();

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
            <Text className="text-zinc-900 text-3xl font-black tracking-tighter uppercase">Fync <Text className="text-purple-600">Academy</Text></Text>
            <Text className="text-slate-500 text-[10px] font-black uppercase tracking-[2px] mt-0.5">The Infinite Tech Protocol</Text>
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
          <View>
            {/* LARGE CATEGORY CARDS */}
            {mainCategories.map((cat, index) => (
              <TouchableOpacity
                key={cat.id}
                onPress={cat.onPress}
                activeOpacity={0.8}
                className="w-full mb-4 overflow-hidden rounded-[32px] bg-white border border-slate-100"
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
                      <Text className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-0.5">
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
            <View className="mt-4 rounded-[40px] bg-zinc-900 p-8 border border-zinc-800">
              <View className="flex-row items-center mb-4">
                <View className="bg-pink-500 p-2 rounded-xl mr-3">
                  <Ionicons name="rocket-outline" size={20} color="white" />
                </View>
                <Text className="text-white font-black text-lg uppercase tracking-tighter">Mission: Expert</Text>
              </View>
              <Text className="text-slate-400 text-sm leading-relaxed font-medium">
                Unlock the world's most comprehensive technical library. From the fundamentals of DSA to elite FAANG preparation, your journey to mastery begins here.
              </Text>
              <TouchableOpacity className="mt-6 bg-white self-start px-6 py-3 rounded-2xl shadow-lg">
                <Text className="text-black font-black text-xs uppercase tracking-widest">Start Learning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
