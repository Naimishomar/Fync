import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type EducationEntry = {
  _id: string; institution: string; degree?: string; field?: string;
  grade?: string; startYear?: number; endYear?: number; isCurrent?: boolean; description?: string;
};

export default function EducationCard({ item, isOwner, onEdit, onDelete }: {
  item: EducationEntry; isOwner?: boolean;
  onEdit?: (i: EducationEntry) => void; onDelete?: (id: string) => void;
}) {
  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-5 mb-4 shadow-sm">
      <View className="flex-row">
        <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center mr-4">
          <Ionicons name="school" size={24} color="#f97316" />
        </View>
        <View className="flex-1">
          <Text className="text-slate-900 font-black text-sm mb-1">{item.institution}</Text>
          {item.degree && (
            <Text className="text-orange-600 text-xs font-bold uppercase tracking-wider mb-2">
              {item.degree}{item.field ? ` • ${item.field}` : ''}
            </Text>
          )}
          <View className="flex-row flex-wrap items-center gap-2 mb-2">
            <View className="bg-slate-100 px-2.5 py-1 rounded-full">
              <Text className="text-slate-500 text-2xs font-black uppercase">
                {item.startYear || '?'} — {item.isCurrent ? 'Present' : (item.endYear || '?')}
              </Text>
            </View>
            {item.grade && (
              <View className="bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                <Text className="text-emerald-700 text-2xs font-black">{item.grade}</Text>
              </View>
            )}
            {item.isCurrent && (
              <View className="bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
                <Text className="text-orange-600 text-2xs font-black uppercase">Active</Text>
              </View>
            )}
          </View>
          {item.description && <Text className="text-slate-500 text-xs leading-5 font-medium" numberOfLines={3}>{item.description}</Text>}
        </View>
        {isOwner && (
          <View className="ml-2 gap-3">
            <Pressable onPress={() => onEdit?.(item)} className="bg-slate-50 p-2 rounded-xl border border-slate-100">
              <Ionicons name="pencil-outline" size={16} color="#f97316" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(item._id)} className="bg-red-50 p-2 rounded-xl border border-red-100">
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
