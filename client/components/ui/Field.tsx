import React, { forwardRef } from 'react';
import { View, Text, TextInput, Pressable, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C, themed } from '../../constants/colors';

/**
 * Pill search input: icon, text, clear button once there is text.
 *   <SearchField value={q} onChangeText={setQ} placeholder="Search people" />
 */
export const SearchField = forwardRef<TextInput, TextInputProps & {
  /** Container style (margins). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Called after the clear button empties the field. */
  onClear?: () => void;
}>(function SearchField({ value, onChangeText, onClear, containerStyle, placeholder = 'Search', style, ...p }, ref) {
  return (
    <View style={[s.search, containerStyle]}>
      <Ionicons name="search-outline" size={20} color={C.ink3} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={C.ink3}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        {...p}
        style={[s.searchInput, style]}
      />
      {value ? (
        <Pressable
          onPress={() => { onChangeText?.(''); onClear?.(); }}
          hitSlop={12}
          className="active:opacity-85"
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={20} color={C.ink3} />
        </Pressable>
      ) : null}
    </View>
  );
});

/**
 * Label + input + hint/error. The error replaces the hint and is announced.
 *   <FormField label="Full name" value={name} onChangeText={setName} error={errors.name} />
 */
export const FormField = forwardRef<TextInput, TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null | false;
  containerStyle?: StyleProp<ViewStyle>;
  /** Trailing element inside the box (unit, eye toggle, counter). */
  right?: React.ReactNode;
}>(function FormField({ label, hint, error, containerStyle, right, style, multiline, ...p }, ref) {
  return (
    <View style={[s.field, containerStyle]}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={[s.box, multiline && s.boxMulti, !!error && { borderColor: C.danger }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={C.ink3}
          multiline={multiline}
          accessibilityLabel={label}
          {...p}
          style={[s.input, multiline && s.inputMulti, style]}
        />
        {right}
      </View>
      {error ? (
        <Text style={s.error} accessibilityLiveRegion="polite" accessibilityRole="alert">{error}</Text>
      ) : hint ? (
        <Text style={s.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const s = themed(() => ({
  search: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16,
    borderRadius: 999, backgroundColor: C.card, borderWidth: 1, borderColor: C.line,
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 8, fontFamily: 'Inter_400Regular', fontSize: 15, color: C.ink },
  field: { gap: 6 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, lineHeight: 18, color: C.ink2 },
  box: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingHorizontal: 16,
    borderRadius: 16, borderCurve: 'continuous', backgroundColor: C.paper2, borderWidth: 1, borderColor: C.line,
  },
  boxMulti: { alignItems: 'flex-start', paddingVertical: 4 },
  input: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: 'Inter_400Regular', fontSize: 15, color: C.ink },
  inputMulti: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 16, color: C.ink3 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 16, color: C.danger },
}));
