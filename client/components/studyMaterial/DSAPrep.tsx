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
import Ionicons from '@expo/vector-icons/Ionicons';
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      {/* HEADER DECORATION */}

      <SafeAreaView className="flex-1" edges={['top']}>
        <FlatList
          data={filteredTopics}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListHeaderComponent={
            <View className='px-gutter pt-8 bg-transparent'>
              <View className="flex-row items-center justify-between mb-8">
                <View>
                  <Text className="text-ink text-3xl font-display uppercase">DSA <Text className="text-fam-study">Prep</Text></Text>
                  <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Master Placement Hub</Text>
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
                  placeholder="Search DSA topics..."
                  placeholderTextColor="#C4BEB6"
                  value={search}
                  onChangeText={setSearch}
                  className="flex-1 text-ink font-display text-sm p-3"
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
                      className={`mr-3 px-6 py-3 rounded-full border border-line ${activeFilter === item ? 'bg-ink' : 'bg-card'}`}
                    >
                      <Text className={`font-display text-label uppercase ${activeFilter === item ? 'text-white' : 'text-ink-3'}`}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={item => item}
                />
              </View>

              <View className="mb-6 flex-row items-center">
                <View className="bg-fam-study/10 border border-fam-study/20 mr-2 px-2.5 py-1 rounded-full">
                  <Text className="text-fam-study font-display text-label uppercase">Resources</Text>
                </View>
                <Text className="text-ink-3 text-label font-display uppercase flex-1" numberOfLines={1}>/ Placement Protocol / {activeFilter}</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center p-5 mx-gutter mb-4 bg-card rounded-card border border-line"
              onPress={() => handlePress(item)}
            >
              <View className="w-14 h-14 bg-paper-2 rounded-card items-center justify-center p-2.5">
                <Image
                  source={{ uri: PDF_IMG }}
                  className="w-full h-full"
                  resizeMode="contain"
                />
              </View>

              <View className="ml-4 flex-1">
                <Text className="text-ink text-sm font-display uppercase" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-ink-3 text-label font-display uppercase mt-1">
                  {item.category} Note
                </Text>
              </View>

              <View className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center">
                <Ionicons name="chevron-forward" size={12} color="#C4BEB6" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center mt-20 px-gutter">
              <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                <Ionicons name="search-outline" size={32} color="#C4BEB6" />
              </View>
              <Text className="font-semibold text-base text-ink text-center">No topics found</Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
};

export default DSAPrep;
