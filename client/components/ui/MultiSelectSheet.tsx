import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { useBottomInset } from '../../constants/layout';

/**
 * "Everyone, or these specific ones."
 *
 * An empty selection means *all* — it is the open default, and it is also what
 * the API already treats as unrestricted, so there is no separate "all" flag to
 * keep in sync with the list.
 */
export interface MultiSelectSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** e.g. "All colleges" — the option that clears the selection. */
  allLabel: string;
  /** One line under the title explaining what the choice affects. */
  hint?: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Long lists (colleges) need a filter; short ones (batches) do not. */
  searchable?: boolean;
  searchPlaceholder?: string;
}

const MultiSelectSheet = ({
  visible,
  onClose,
  title,
  allLabel,
  hint,
  options,
  selected,
  onChange,
  searchable = false,
  searchPlaceholder = 'Search',
}: MultiSelectSheetProps) => {
  const [query, setQuery] = useState('');
  const bottomInset = useBottomInset();

  useEffect(() => {
    if (!visible) setQuery('');
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  const allSelected = selected.length === 0;

  const toggle = (option: string) =>
    onChange(
      selected.includes(option) ? selected.filter((s) => s !== option) : [...selected, option]
    );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable className="flex-1 bg-ink/50 justify-end" onPress={onClose}>
        {/* The sheet swallows taps so only the scrim dismisses. */}
        <Pressable
          className="bg-paper rounded-t-sheet border-t-2 border-ink"
          style={{ height: '78%' }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="flex-row items-center justify-between px-gutter pt-4 pb-3 border-b border-line">
            <View className="flex-1 mr-3">
              <Text className="text-ink text-base font-display">{title}</Text>
              {hint ? <Text className="text-ink-3 text-label font-semibold mt-0.5">{hint}</Text> : null}
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="w-11 h-11 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Done"
            >
              <Ionicons name="close" size={22} color="#12100E" />
            </TouchableOpacity>
          </View>

          {searchable ? (
            <View className="px-gutter pt-3">
              <View className="flex-row items-center bg-card border-2 border-ink rounded-md px-3" style={{ height: 46 }}>
                <Feather name="search" size={16} color="#8B857E" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={searchPlaceholder}
                  placeholderTextColor="#8B857E"
                  autoCorrect={false}
                  className="flex-1 ml-2 text-ink text-sm"
                  style={{ paddingVertical: 0 }}
                />
                {query.length ? (
                  <TouchableOpacity onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={17} color="#C4BEB6" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24 + bottomInset }}
            ListHeaderComponent={
              // Pinned above the list rather than buried in it: "open to
              // everyone" is the common answer.
              <TouchableOpacity
                onPress={() => onChange([])}
                className={`flex-row items-center border-2 rounded-card p-4 mb-3 ${allSelected ? 'bg-brand-500 border-ink' : 'bg-card border-line'}`}
                activeOpacity={0.85}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: allSelected }}
              >
                <Ionicons
                  name={allSelected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={allSelected ? '#12100E' : '#8B857E'}
                />
                <Text className="text-ink text-sm font-semibold ml-3">{allLabel}</Text>
              </TouchableOpacity>
            }
            renderItem={({ item }) => {
              const on = selected.includes(item);
              return (
                <TouchableOpacity
                  onPress={() => toggle(item)}
                  className={`flex-row items-center border rounded-card p-3.5 mb-2 ${on ? 'bg-paper-2 border-ink' : 'bg-card border-line'}`}
                  activeOpacity={0.85}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                >
                  <Ionicons
                    name={on ? 'checkbox' : 'square-outline'}
                    size={19}
                    color={on ? '#C2410C' : '#8B857E'}
                  />
                  <Text className="text-ink text-sm font-semibold ml-3 flex-1">{item}</Text>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View className="items-center pt-14 px-6">
                <Feather name="search" size={24} color="#C4BEB6" />
                <Text className="text-ink-2 text-label font-semibold mt-3 text-center">
                  Nothing matches “{query}”
                </Text>
              </View>
            }
          />

          <View
            className="border-t border-line px-gutter pt-3 bg-paper"
            style={{ paddingBottom: 12 + bottomInset }}
          >
            <TouchableOpacity
              onPress={onClose}
              className="items-center justify-center bg-ink border-2 border-ink rounded-card"
              style={{ minHeight: 48 }}
              activeOpacity={0.9}
              accessibilityRole="button"
            >
              <Text className="text-white text-sm font-semibold">
                {allSelected ? allLabel : `Done · ${selected.length} selected`}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default MultiSelectSheet;
