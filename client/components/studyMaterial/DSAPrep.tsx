import React, { useState, useEffect, useCallback } from 'react';
import { View, FlatList, StatusBar } from 'react-native';
import { AppBar, ListRow, FilterChips, SearchField, Empty, Meta } from '../ui/kit';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';

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

type Topic = typeof dsaTopics[number];

const categories = ['all', ...Array.from(new Set(dsaTopics.map(t => t.category.toLowerCase())))];
const categoryLabels = Object.fromEntries(categories.map(c => [c, c.charAt(0).toUpperCase() + c.slice(1)]));

const TopicRow = React.memo(function TopicRow({ item, onOpen }: { item: Topic; onOpen: (t: Topic) => void }) {
  return (
    <ListRow
      icon="document-text-outline"
      title={item.name}
      subtitle={`${item.category} note`}
      onPress={() => onOpen(item)}
      style={{ paddingHorizontal: 20 }}
    />
  );
});

const DSAPrep = () => {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const [filteredTopics, setFilteredTopics] = useState(dsaTopics);
  const [activeFilter, setActiveFilter] = useState('all');

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

  const handlePress = useCallback((topic: Topic) => {
    navigation.navigate('PDFViewerScreen', { url: topic.url, title: topic.name });
  }, [navigation]);

  const renderItem = useCallback(({ item }: { item: Topic }) => <TopicRow item={item} onOpen={handlePress} />, [handlePress]);

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <AppBar title="DSA Prep" onBack={() => navigation.goBack()} />
      <FlatList keyboardShouldPersistTaps="handled"
        data={filteredTopics}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <View className="pt-2 pb-2">
            <SearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Search DSA topics"
              containerStyle={{ marginHorizontal: 20, marginBottom: 12 }}
            />
            <FilterChips items={categories} value={activeFilter} onChange={setActiveFilter} labels={categoryLabels} />
            <Meta style={{ paddingHorizontal: 20, marginTop: 16 }}>{filteredTopics.length} notes</Meta>
          </View>
        }
        ListEmptyComponent={<Empty icon="search-outline" title="No topics found" hint="Try another name or filter." />}
      />
    </View>
  );
};

export default DSAPrep;
