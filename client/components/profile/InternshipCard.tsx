import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  internship:   { icon: 'school-outline',    color: '#18181b', bg: '#f8fafc' },
  'full-time':  { icon: 'briefcase',         color: '#f97316', bg: '#fff7ed' },
  'part-time':  { icon: 'briefcase-outline', color: '#18181b', bg: '#f8fafc' },
  freelance:    { icon: 'laptop-outline',    color: '#f97316', bg: '#fff7ed' },
  contract:     { icon: 'document-outline', color: '#18181b', bg: '#f8fafc' },
  'open-source':{ icon: 'code-slash-outline',color: '#f97316', bg: '#fff7ed' },
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
    <View className="mx-4 mb-4 bg-white rounded-[28px] border border-slate-100 p-6 shadow-sm shadow-black/5">
      <View className="flex-row">
        <View className="w-12 h-12 rounded-2xl items-center justify-center mr-4 flex-shrink-0 shadow-sm"
          style={{ backgroundColor: type.bg, borderWidth: 1, borderColor: '#f1f5f9' }}>
          <Ionicons name={type.icon as any} size={20} color={type.color} />
        </View>

        <View className="flex-1">
          <Text className="text-zinc-900 font-black uppercase text-sm tracking-tight leading-tight">{item.role}</Text>
          <Text className="text-slate-400 font-black uppercase text-[10px] tracking-widest mt-0.5">{item.company}</Text>

          <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 mt-3">
            <View className="flex-row items-center gap-1.5">
              <Feather name="calendar" size={10} color="#94A3B8" />
              <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">{start} — {end}</Text>
            </View>
            {durationStr ? (
              <View className="bg-slate-50 px-2 py-0.5 rounded-lg">
                <Text className="text-slate-500 text-[8px] font-black uppercase tracking-widest">{durationStr}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1.5">
              <Feather name="map-pin" size={10} color="#94A3B8" />
              <Text className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">{item.workMode || 'remote'}</Text>
            </View>
            {item.isCurrentlyWorking && (
              <View className="bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                <Text className="text-emerald-600 text-[8px] font-black uppercase tracking-widest">Active</Text>
              </View>
            )}
          </View>

          {item.description ? (
            <Text className="text-slate-500 text-[12px] mt-4 leading-[18px] font-medium" numberOfLines={3}>
              {item.description}
            </Text>
          ) : null}

          {item.techStack && item.techStack.length > 0 && (
            <View className="flex-row flex-wrap gap-2 mt-4">
              {item.techStack.slice(0, 4).map((t, i) => (
                <View key={i} className="bg-zinc-900 px-2.5 py-1 rounded-lg">
                  <Text className="text-white text-[8px] font-black uppercase tracking-widest">{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {isOwner && (
          <View className="ml-4 gap-3 border-l border-slate-50 pl-4">
            <Pressable onPress={() => onEdit?.(item)} className="w-8 h-8 items-center justify-center bg-zinc-900 rounded-xl">
              <Feather name="edit-3" size={12} color="white" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(item._id)} className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl">
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}
