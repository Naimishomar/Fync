import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CAT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  coding:        { color: '#0EA5E9', bg: '#F0F9FF', icon: 'code-slash' },
  design:        { color: '#EC4899', bg: '#FDF2F8', icon: 'color-palette' },
  cloud:         { color: '#6366F1', bg: '#EEF2FF', icon: 'cloud' },
  'ai-ml':       { color: '#7C3AED', bg: '#F5F3FF', icon: 'hardware-chip' },
  cybersecurity: { color: '#DC2626', bg: '#FEF2F2', icon: 'shield-checkmark' },
  management:    { color: '#D97706', bg: '#FFFBEB', icon: 'people' },
  'data-science':{ color: '#059669', bg: '#ECFDF5', icon: 'bar-chart' },
  other:         { color: '#6B7280', bg: '#F3F4F6', icon: 'ribbon' },
};

interface Certificate {
  _id: string;
  title: string;
  issuer: string;
  issueDate?: string;
  credentialUrl?: string;
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
    <View className="bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 flex-row items-center">
      {/* Icon */}
      <View className="w-10 h-10 rounded-xl items-center justify-center mr-3 flex-shrink-0"
        style={{ backgroundColor: cat.bg }}>
        <Ionicons name={cat.icon as any} size={20} color={cat.color} />
      </View>

      {/* Content */}
      <View className="flex-1">
        <Text className="text-gray-900 font-semibold text-sm" numberOfLines={1}>{cert.title}</Text>
        <Text className="text-gray-500 text-xs">{cert.issuer}</Text>
        {cert.issueDate && (
          <Text className="text-gray-400 text-[10px] mt-0.5">{fmtDate(cert.issueDate)}</Text>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-2 ml-2">
        {cert.credentialUrl && (
          <Pressable onPress={() => Linking.openURL(cert.credentialUrl!)}
            className="bg-blue-50 p-1.5 rounded-lg border border-blue-100">
            <Ionicons name="open-outline" size={14} color="#2563EB" />
          </Pressable>
        )}
        {isOwner && (
          <>
            <Pressable onPress={() => onEdit?.(cert)} className="p-1">
              <Ionicons name="pencil-outline" size={14} color="#6366F1" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(cert._id)} className="p-1">
              <Ionicons name="trash-outline" size={14} color="#EF4444" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
