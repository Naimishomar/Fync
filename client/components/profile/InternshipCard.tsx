import React from 'react';
import { View, Text, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  internship:   { icon: 'school-outline',    color: '#12100E', bg: '#F5F2EC' },
  'full-time':  { icon: 'briefcase',         color: '#F97316', bg: '#EDE8E0' },
  'part-time':  { icon: 'briefcase-outline', color: '#12100E', bg: '#F5F2EC' },
  freelance:    { icon: 'laptop-outline',    color: '#F97316', bg: '#EDE8E0' },
  contract:     { icon: 'document-outline', color: '#12100E', bg: '#F5F2EC' },
  'open-source':{ icon: 'code-slash-outline',color: '#F97316', bg: '#EDE8E0' },
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
    <View className="mx-4 mb-4 bg-card rounded-card border border-line p-6 shadow-hair">
      <View className="flex-row">
        <View className="w-12 h-12 rounded-card items-center justify-center mr-4 flex-shrink-0 shadow-hair"
          style={{ backgroundColor: type.bg, borderWidth: 1, borderColor: '#EDE8E0' }}>
          <Ionicons name={type.icon as any} size={20} color={type.color} />
        </View>

        <View className="flex-1">
          <Text className="text-ink font-display uppercase text-sm leading-tight">{item.role}</Text>
          <Text className="text-ink-3 font-display uppercase text-label mt-0.5">{item.company}</Text>

          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={10} color="#8B857E" />
              <Text className="text-ink-3 font-semibold text-label uppercase">{start} — {end}</Text>
            </View>
            {durationStr ? (
              <View className="bg-paper-2 px-2.5 py-1 rounded-full">
                <Text className="text-ink-3 text-label font-display uppercase">{durationStr}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              <Feather name="map-pin" size={10} color="#8B857E" />
              <Text className="text-ink-3 font-semibold text-label uppercase">{item.workMode || 'remote'}</Text>
            </View>
            {item.isCurrentlyWorking && (
              <View className="bg-success/10 border border-success/15 px-2.5 py-1 rounded-full">
                <Text className="text-success text-label font-display uppercase">Active</Text>
              </View>
            )}
          </View>

          {item.description ? (
            <Text className="text-ink-3 text-xs mt-4 leading-[18px] font-medium" numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          {item.techStack && item.techStack.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mt-4">
              {item.techStack.slice(0, 4).map((t, i) => (
                <View key={i} className="bg-ink px-2.5 py-1 rounded-full">
                  <Text className="text-white text-label font-display uppercase">{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {isOwner && (
          <View className="ml-4 gap-3 border-l border-line pl-4">
            <Pressable onPress={() => onEdit?.(item)} className="w-8 h-8 items-center justify-center bg-ink rounded-xl">
              <Feather name="edit-3" size={12} color="white" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(item._id)} className="w-8 h-8 items-center justify-center bg-danger/10 rounded-xl">
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
