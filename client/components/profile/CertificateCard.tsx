import React from 'react';
import { View, Text, Pressable, Linking, Image } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

const CAT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  coding:        { color: '#18181b', bg: '#f8fafc', icon: 'code-slash' },
  design:        { color: '#18181b', bg: '#f8fafc', icon: 'color-palette' },
  cloud:         { color: '#18181b', bg: '#f8fafc', icon: 'cloud' },
  'ai-ml':       { color: '#f97316', bg: '#fff7ed', icon: 'hardware-chip' },
  cybersecurity: { color: '#f97316', bg: '#fff7ed', icon: 'shield-checkmark' },
  management:    { color: '#18181b', bg: '#f8fafc', icon: 'people' },
  'data-science':{ color: '#f97316', bg: '#fff7ed', icon: 'bar-chart' },
  other:         { color: '#18181b', bg: '#f8fafc', icon: 'ribbon' },
};

interface Certificate {
  _id: string;
  title: string;
  issuer: string;
  issueDate?: string;
  credentialUrl?: string;
  imageUrl?: string;
  category?: string;
}

interface Props {
  cert: Certificate;
  isOwner?: boolean;
  onEdit?: (c: Certificate) => void;
  onDelete?: (id: string) => void;
}

const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';

export default function CertificateCard({ cert, isOwner, onEdit, onDelete }: Props) {
  const cat = CAT_CONFIG[cert.category || 'other'] || CAT_CONFIG.other;

  return (
    <View className="bg-white rounded-2xl border border-slate-100 p-4 flex-row items-center shadow-sm shadow-black/5">
      {/* Image or Icon */}
      {cert.imageUrl ? (
        <Image 
          source={{ uri: cert.imageUrl }} 
          className="w-16 h-16 rounded-2xl mr-4 flex-shrink-0 border border-slate-200"
          resizeMode="cover"
        />
      ) : (
        <View className="w-16 h-16 rounded-2xl items-center justify-center mr-4 flex-shrink-0"
          style={{ backgroundColor: cat.bg, borderWidth: 1, borderColor: '#f1f5f9' }}>
          <Ionicons name={cat.icon as any} size={24} color={cat.color} />
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        <Text className="text-slate-900 font-black uppercase text-xs tracking-tight leading-tight" numberOfLines={1}>{cert.title}</Text>
        <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wider mt-0.5">{cert.issuer}</Text>
        {cert.issueDate && (
          <View className="flex-row items-center gap-1 mt-2">
            <Feather name="calendar" size={10} color="#94A3B8" />
            <Text className="text-slate-500 font-bold text-2xs uppercase tracking-wider">{fmtDate(cert.issueDate)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-3 ml-4 border-l border-slate-50 pl-4">
        {cert.credentialUrl && (
          <Pressable onPress={() => Linking.openURL(cert.credentialUrl!)}
            className="w-9 h-9 bg-white items-center justify-center rounded-xl border border-slate-100 shadow-sm">
            <Feather name="external-link" size={14} color="#f97316" />
          </Pressable>
        )}
        {isOwner && (
          <>
            <Pressable onPress={() => onEdit?.(cert)} className="w-8 h-8 items-center justify-center bg-slate-900 rounded-xl">
              <Feather name="edit-3" size={12} color="white" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(cert._id)} className="w-8 h-8 items-center justify-center bg-rose-50 rounded-xl">
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
