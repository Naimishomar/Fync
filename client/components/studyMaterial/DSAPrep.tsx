import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StatusBar,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

const PDF_IMG = 'https://cdn-icons-png.flaticon.com/512/337/337946.png';

const dsaTopics = [
  { id: '1', name: '1. Intro + Recursion', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/1.%20Intro%2BRecursion.pdf', category: 'Fundamentals' },
  { id: '2', name: '2. Array + Searching', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/2.%20Array%2BSearching.pdf', category: 'Arrays' },
  { id: '3', name: '3. Sorting', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/3.%20Sorting.pdf', category: 'Algorithms' },
  { id: '4', name: '4. Hashing', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/4.%20Hashing.pdf', category: 'Advanced' },
  { id: '5', name: '5. Strings', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/5.%20Strings.pdf', category: 'Fundamentals' },
  { id: '6', name: '6. Linked List', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/6.%20LinkedList.pdf', category: 'Linear' },
  { id: '7', name: '7. Stacks', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/7.%20Stacks.pdf', category: 'Linear' },
  { id: '8', name: '8. Queues', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/8.%20Queues.pdf', category: 'Linear' },
  { id: '9', name: '9. Trees', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/9.%20Trees.pdf', category: 'Non-Linear' },
  { id: '10', name: '10. Binary Search Trees', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/10.%20BinarySearchTrees.pdf', category: 'Non-Linear' },
  { id: '11', name: '11. Greedy + Backtracking', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/11.%20Greedy%2BBacktracking.pdf', category: 'Algorithms' },
  { id: '12', name: '12. Dynamic Programming', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/12.%20DynamicProgramming.pdf', category: 'Advanced' },
  { id: '13', name: '13. Graphs', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/13.%20Graphs.pdf', category: 'Non-Linear' },
  { id: '14', name: 'DBMS Notes', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/DBMS.pdf', category: 'Fundamentals' },
  { id: '15', name: 'OOPS Notes', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/OOPS.pdf', category: 'Fundamentals' },
  { id: '16', name: 'Operating System Notes', url: 'https://raw.githubusercontent.com/Deeksha2501/Data-Structures-and-Algorithms-Notes/main/OperatingSystem.pdf', category: 'Fundamentals' }
];

const DSAPrep = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [filteredTopics, setFilteredTopics] = useState(dsaTopics);
  const [activeFilter, setActiveFilter] = useState('all');

  const categories = ['all', ...Array.from(new Set(dsaTopics.map(t => t.category.toLowerCase())))];

  useEffect(() => {
    let result = dsaTopics;
    if (search.trim()) {
      result = result.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
    }
    if (activeFilter !== 'all') {
      result = result.filter(t => t.category.toLowerCase() === activeFilter);
    }
    setFilteredTopics(result);
  }, [search, activeFilter]);

  const handlePress = (topic: any) => {
    navigation.navigate('PDFViewerScreen', { url: topic.url, title: topic.name });
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient
          colors={['#8b5cf6', 'transparent']}
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <FlatList
          data={filteredTopics}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View className='px-8 pt-8 bg-transparent'>
              <View className="flex-row items-center justify-between mb-8">
                <View>
                  <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase">DSA <Text className="text-purple-600">Prep</Text></Text>
                  <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Master Placement Hub</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} className="w-12 h-12 rounded-2xl items-center justify-center border border-slate-100 bg-white shadow-sm">
                  <Ionicons name="arrow-back" size={20} color="#18181b" />
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center bg-white px-4 py-1 rounded-2xl border border-slate-100 mb-6">
                <Ionicons name="search" size={20} color="#CBD5E1" />
                <TextInput
                  placeholder="Search DSA topics..."
                  placeholderTextColor="#CBD5E1"
                  value={search}
                  onChangeText={setSearch}
                  className="flex-1 text-slate-900 font-black text-sm tracking-tight p-3"
                />
              </View>

              {/* CATEGORY FILTERS */}
              <View className="mb-6">
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={categories}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setActiveFilter(item)}
                      className={`mr-3 px-6 py-3 rounded-full border border-slate-100 ${activeFilter === item ? 'bg-slate-900' : 'bg-white'}`}
                    >
                      <Text className={`font-black text-2xs uppercase tracking-widest ${activeFilter === item ? 'text-white' : 'text-slate-500'}`}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={item => item}
                />
              </View>

              <View className="mb-6 flex-row items-center">
                <View className="bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 mr-2">
                  <Text className="text-purple-600 font-black text-2xs uppercase tracking-tighter">Resources</Text>
                </View>
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide flex-1" numberOfLines={1}>/ Placement Protocol / {activeFilter}</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center p-5 mx-6 mb-4 bg-white rounded-3xl border border-slate-100"
              onPress={() => handlePress(item)}
            >
              <View className="w-14 h-14 bg-slate-50 rounded-2xl items-center justify-center p-2.5">
                <Image
                  source={{ uri: PDF_IMG }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              <View className="ml-4 flex-1">
                <Text className="text-slate-900 text-sm font-black uppercase tracking-tight" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">
                  {item.category} Note
                </Text>
              </View>

              <View className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center">
                <Ionicons name="chevron-forward" size={12} color="#CBD5E1" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center mt-20 px-10">
              <View className="w-20 h-20 bg-slate-50 rounded-4xl items-center justify-center mb-6">
                <Ionicons name="search-outline" size={32} color="#CBD5E1" />
              </View>
              <Text className="text-slate-500 font-black text-xs text-center uppercase tracking-wide">No topics found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
};

export default DSAPrep;
