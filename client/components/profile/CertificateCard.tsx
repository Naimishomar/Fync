import React from 'react';
import { View, Text, Pressable, Linking, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';

const CAT_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  coding:        { color: '#12100E', bg: '#F5F2EC', icon: 'code-slash' },
  design:        { color: '#12100E', bg: '#F5F2EC', icon: 'color-palette' },
  cloud:         { color: '#12100E', bg: '#F5F2EC', icon: 'cloud' },
  'ai-ml':       { color: '#F97316', bg: '#EDE8E0', icon: 'hardware-chip' },
  cybersecurity: { color: '#F97316', bg: '#EDE8E0', icon: 'shield-checkmark' },
  management:    { color: '#12100E', bg: '#F5F2EC', icon: 'people' },
  'data-science':{ color: '#F97316', bg: '#EDE8E0', icon: 'bar-chart' },
  other:         { color: '#12100E', bg: '#F5F2EC', icon: 'ribbon' },
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
    <View className="bg-card rounded-card border border-line p-4 flex-row items-center shadow-hair">
      {/* Image or Icon */}
      {cert.imageUrl ? (
        <Image 
          source={{ uri: cert.imageUrl }} 
          className="w-16 h-16 rounded-card mr-4 flex-shrink-0 border border-line"
          resizeMode="cover"
        />
      ) : (
        <View className="w-16 h-16 rounded-card items-center justify-center mr-4 flex-shrink-0"
          style={{ backgroundColor: cat.bg, borderWidth: 1, borderColor: '#EDE8E0' }}>
          <Ionicons name={cat.icon as any} size={24} color={cat.color} />
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        <Text className="font-semibold text-base text-ink leading-tight" numberOfLines={1}>{cert.title}</Text>
        <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5">{cert.issuer}</Text>
        {cert.issueDate && (
          <View className="flex-row items-center gap-1 mt-2">
            <Feather name="calendar" size={10} color="#8B857E" />
            <Text className="text-ink-3 font-semibold text-label uppercase">{fmtDate(cert.issueDate)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-3 ml-4 border-l border-line pl-4">
        {cert.credentialUrl && (
          <Pressable onPress={() => Linking.openURL(cert.credentialUrl!)}
            className="w-9 h-9 bg-card items-center justify-center rounded-xl border border-line shadow-hair">
            <Feather name="external-link" size={14} color="#F97316" />
          </Pressable>
        )}
        {isOwner && (
          <>
            <Pressable onPress={() => onEdit?.(cert)} className="w-8 h-8 items-center justify-center bg-ink rounded-xl">
              <Feather name="edit-3" size={12} color="white" />
            </Pressable>
            <Pressable onPress={() => onDelete?.(cert._id)} className="w-8 h-8 items-center justify-center bg-danger/10 rounded-xl">
              <Ionicons name="trash-outline" size={14} color="#DC2626" />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
