import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';

export type EducationEntry = {
  _id: string; institution: string; degree?: string; field?: string;
  grade?: string; startYear?: number; endYear?: number; isCurrent?: boolean; description?: string;
};

export default function EducationCard({ item, isOwner, onEdit, onDelete }: {
  item: EducationEntry; isOwner?: boolean;
  onEdit?: (i: EducationEntry) => void; onDelete?: (id: string) => void;
}) {
  return (
    <View className="bg-card rounded-card border border-line p-5 mb-4 shadow-hair">
      <View className="flex-row">
        <View className="w-12 h-12 bg-brand-50 rounded-card items-center justify-center mr-4">
          <Ionicons name="school" size={24} color={C.brand[500]} />
        </View>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-ink font-display text-sm mb-1">{item.institution}</Text>
          {/* !! — the add form saves blank fields as '', and a bare '' in a View crashes RN. */}
          {!!item.degree && (
            <Text className="text-accent-text text-xs font-semibold uppercase mb-2">
              {item.degree}{item.field ? ` • ${item.field}` : ''}
            </Text>
          )}
          <View className="flex-row flex-wrap items-center gap-2 mb-2">
            <View className="bg-paper-2 px-2.5 py-1 rounded-full">
              <Text className="text-ink-3 text-label font-display uppercase">
                {item.startYear || '?'} — {item.isCurrent ? 'Present' : (item.endYear || '?')}
              </Text>
            </View>
            {!!item.grade && (
              <View className="bg-success/10 border border-success/15 px-2.5 py-1 rounded-full">
                <Text className="text-success text-label font-display">{item.grade}</Text>
              </View>
            )}
            {item.isCurrent && (
              <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                <Text className="text-accent-text text-label font-display uppercase">Active</Text>
              </View>
            )}
          </View>
          {!!item.description && <Text className="text-ink-3 text-xs leading-5 font-medium" numberOfLines={3}>{item.description}</Text>}
        </View>
        {isOwner && (
          <View className="ml-2 gap-3">
            <Pressable onPress={() => onEdit?.(item)} hitSlop={6} className="bg-paper-2 p-2 rounded-xl border border-line">
              <Ionicons name="pencil-outline" size={16} color={C.brand[500]} />
            </Pressable>
            <Pressable onPress={() => onDelete?.(item._id)} hitSlop={6} className="bg-danger/10 p-2 rounded-xl border border-danger/15">
              <Ionicons name="trash-outline" size={16} color={C.danger} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
