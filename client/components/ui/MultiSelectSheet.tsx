import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { Sheet } from './Sheet';
import { SearchField } from './Field';
import { Button } from './kit';

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
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={hint}
      closeLabel="Done"
      height="78%"
      scroll={false}
      footer={
        <Button
          variant="solid"
          block
          onPress={onClose}
          title={allSelected ? allLabel : `Done · ${selected.length} selected`}
        />
      }
    >
      {searchable ? (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={searchPlaceholder}
          containerStyle={{ marginHorizontal: 20, marginTop: 12 }}
        />
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item}
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, gap: 8 }}
        ListHeaderComponent={
          // Pinned above the list rather than buried in it: "open to
          // everyone" is the common answer.
          <Option label={allLabel} on={allSelected} onPress={() => onChange([])} radio />
        }
        renderItem={({ item }) => (
          <Option label={item} on={selected.includes(item)} onPress={() => toggle(item)} />
        )}
        ListEmptyComponent={
          <View className="items-center pt-12 px-6" style={{ gap: 12 }}>
            <View className="w-14 h-14 rounded-full bg-paper-2 items-center justify-center">
              <Ionicons name="search-outline" size={24} color={C.ink3} />
            </View>
            <Text className="text-ink-3 font-sans text-center" style={{ fontSize: 13 }}>
              Nothing matches “{query}”
            </Text>
          </View>
        }
      />
    </Sheet>
  );
};

/** One selectable row. `radio` for the "all" option, checkbox otherwise. */
const Option = React.memo(function Option({
  label, on, onPress, radio,
}: { label: string; on: boolean; onPress: () => void; radio?: boolean }) {
  const icon = radio ? (on ? 'checkmark-circle' : 'ellipse-outline') : on ? 'checkbox' : 'square-outline';
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-2xl border px-4 active:opacity-85 ${on ? 'bg-card border-brand-500' : 'bg-card border-line'}`}
      style={{ minHeight: 52, gap: 12 }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
    >
      <Ionicons name={icon} size={20} color={on ? C.brand[500] : C.ink3} />
      <Text className="text-ink font-medium flex-1" style={{ fontSize: 15 }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
});

export default MultiSelectSheet;
