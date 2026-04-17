import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  internship:   { icon: 'school-outline',    color: '#6366F1', bg: '#EEF2FF' },
  'full-time':  { icon: 'briefcase',         color: '#059669', bg: '#ECFDF5' },
  'part-time':  { icon: 'briefcase-outline', color: '#0EA5E9', bg: '#F0F9FF' },
  freelance:    { icon: 'laptop-outline',    color: '#7C3AED', bg: '#F5F3FF' },
  contract:     { icon: 'document-outline', color: '#D97706', bg: '#FFFBEB' },
  'open-source':{ icon: 'code-slash-outline',color: '#1F2937', bg: '#F3F4F6' },
};

interface Internship {
  _id: string;
  company: string;
  role: string;
  type?: string;
  description?: string;
  techStack?: string[];
  startDate?: string;
  endDate?: string;
  isCurrentlyWorking?: boolean;
  workMode?: string;
  location?: string;
}

interface Props {
  item: Internship;
  isOwner?: boolean;
  onEdit?: (i: Internship) => void;
  onDelete?: (id: string) => void;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';

export default function InternshipCard({ item, isOwner, onEdit, onDelete }: Props) {
  const type = TYPE_CONFIG[item.type || 'internship'] || TYPE_CONFIG.internship;
  const start = fmtDate(item.startDate);
  const end = item.isCurrentlyWorking ? 'Present' : fmtDate(item.endDate);

  let durationStr = '';
  if (item.startDate) {
    const s = new Date(item.startDate);
    const e = item.isCurrentlyWorking ? new Date() : new Date(item.endDate || Date.now());
    const months = Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    durationStr = months >= 12
      ? `${Math.floor(months / 12)}y ${months % 12}m`
      : `${months}m`;
  }

  return (
    <View className="mx-4 mb-3 bg-white rounded-2xl border border-gray-100 p-4">
      <View className="flex-row">
        <View className="w-11 h-11 rounded-xl items-center justify-center mr-3 flex-shrink-0"
          style={{ backgroundColor: type.bg }}>
          <Ionicons name={type.icon as any} size={22} color={type.color} />
        </View>

        <View className="flex-1">
          <Text className="text-gray-900 font-bold text-sm">{item.role}</Text>
          <Text className="text-gray-600 text-sm font-medium">{item.company}</Text>

          <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <View className="flex-row items-center gap-1">
              <Ionicons name="calendar-outline" size={12} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs">{start} — {end}</Text>
            </View>
            {durationStr ? (
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-gray-500 text-[10px] font-semibold">{durationStr}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1">
              <Ionicons name="globe-outline" size={12} color="#9CA3AF" />
              <Text className="text-gray-400 text-xs capitalize">{item.workMode || 'remote'}</Text>
            </View>
            {item.isCurrentlyWorking && (
              <View className="bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                <Text className="text-emerald-600 text-[10px] font-bold">CURRENT</Text>
              </View>
            )}
          </View>

          {item.description ? (
            <Text className="text-gray-500 text-xs mt-2 leading-4" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}

          {item.techStack && item.techStack.length > 0 && (
            <View className="flex-row flex-wrap gap-1 mt-2">
              {item.techStack.slice(0, 4).map((t, i) => (
                <View key={i} className="px-2 py-0.5 rounded-md" style={{ backgroundColor: type.bg }}>
                  <Text className="text-[10px] font-semibold" style={{ color: type.color }}>{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {isOwner && (
          <View className="ml-2 gap-2">
            <Pressable onPress={() => onEdit?.(item)}>
              <Ionicons name="pencil-outline" size={16} color="#6366F1" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(item._id)}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
