import React from 'react';
import { View, Text, Switch, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { C } from '../../constants/colors';
import { FilterChips, IconBtn } from '../ui/kit';

/** Shared bits for the profile Add* sheets and section cards. */

/** Same type as FormField's label, for groups that aren't a text input. */
export const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Text className="text-ink-2 text-sm font-semibold mb-2">{children}</Text>
);

/** 'in-progress' -> 'In progress' */
const pretty = (v: string) => (v.charAt(0).toUpperCase() + v.slice(1)).replace(/-/g, ' ');

/** Labelled single-select chip row; bleeds to the sheet edge. */
export function ChoiceChips({ label, items, value, onChange }: {
  label: string; items: readonly string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <FilterChips
        items={items}
        value={value}
        onChange={onChange}
        labels={Object.fromEntries(items.map((i) => [i, pretty(i)]))}
        style={{ marginHorizontal: -20 }}
      />
    </View>
  );
}

/** Label + Switch on a paper-2 row. */
export const ToggleRow = ({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) => (
  <View className="flex-row items-center justify-between mb-4 bg-paper-2 px-4 rounded-2xl border border-line" style={{ minHeight: 56 }}>
    <Text className="text-ink text-sm font-semibold flex-1">{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: C.brand[500] }} accessibilityLabel={label} />
  </View>
);

/** Dashed upload tile for an empty picker. */
export const UploadTile = ({ label, onPress, height = 128 }: { label: string; onPress: () => void; height?: number }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
    className="w-full border border-dashed border-line rounded-2xl items-center justify-center bg-paper-2 active:opacity-85"
    style={{ height }}
  >
    <View className="w-11 h-11 bg-card rounded-full items-center justify-center mb-2">
      <Feather name="upload-cloud" size={20} color={C.ink2} />
    </View>
    <Text className="text-ink-2 text-sm font-semibold">{label}</Text>
  </Pressable>
);

/** Edit + delete icon buttons for the owner's own cards. */
export const OwnerActions = ({ onEdit, onDelete, what, vertical }: {
  onEdit?: () => void; onDelete?: () => void; what: string; vertical?: boolean;
}) => (
  <View style={{ flexDirection: vertical ? 'column' : 'row' }}>
    <IconBtn name="pencil-outline" size={18} color={C.ink2} onPress={onEdit} accessibilityLabel={`Edit ${what}`} />
    <IconBtn name="trash-outline" size={18} color={C.danger} onPress={onDelete} accessibilityLabel={`Delete ${what}`} />
  </View>
);
