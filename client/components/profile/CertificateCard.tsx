import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import Feather from '@expo/vector-icons/Feather';
import { C } from '../../constants/colors';

const CAT_CONFIG = (): Record<string, { color: string; bg: string; icon: string }> => ({
  coding:        { color: C.ink, bg: C.paper, icon: 'code-slash' },
  design:        { color: C.ink, bg: C.paper, icon: 'color-palette' },
  cloud:         { color: C.ink, bg: C.paper, icon: 'cloud' },
  'ai-ml':       { color: C.brand[500], bg: C.paper2, icon: 'hardware-chip' },
  cybersecurity: { color: C.brand[500], bg: C.paper2, icon: 'shield-checkmark' },
  management:    { color: C.ink, bg: C.paper, icon: 'people' },
  'data-science':{ color: C.brand[500], bg: C.paper2, icon: 'bar-chart' },
  other:         { color: C.ink, bg: C.paper, icon: 'ribbon' },
});

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

const fmtDate = (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '';
};

export default function CertificateCard({ cert, isOwner, onEdit, onDelete }: Props) {
  const cat = CAT_CONFIG()[cert.category || 'other'] || CAT_CONFIG().other;

  return (
    <View className="bg-card rounded-card border border-line p-4 flex-row items-center shadow-hair">
      {/* Image or Icon */}
      {cert.imageUrl ? (
        <Image
          source={{ uri: cert.imageUrl }}
          style={{ width: 64, height: 64, borderRadius: 12, marginRight: 16, borderWidth: 1, borderColor: C.line }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View className="w-16 h-16 rounded-card items-center justify-center mr-4 flex-shrink-0"
          style={{ backgroundColor: cat.bg, borderWidth: 1, borderColor: C.paper2 }}>
          <Ionicons name={cat.icon as any} size={24} color={cat.color} />
        </View>
      )}

      {/* Content */}
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-semibold text-base text-ink leading-tight" numberOfLines={1}>{cert.title}</Text>
        <Text className="text-ink-3 font-semibold text-label uppercase mt-0.5" numberOfLines={1}>{cert.issuer}</Text>
        {!!fmtDate(cert.issueDate) && (
          <View className="flex-row items-center gap-1 mt-2">
            <Feather name="calendar" size={10} color={C.ink3} />
            <Text className="text-ink-3 font-semibold text-label uppercase">{fmtDate(cert.issueDate)}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <View className="flex-row items-center gap-3 ml-4 border-l border-line pl-4">
        {!!cert.credentialUrl && (
          <Pressable onPress={() => Linking.openURL(cert.credentialUrl!).catch(() => {})} hitSlop={6}
            className="w-9 h-9 bg-card items-center justify-center rounded-xl border border-line shadow-hair">
            <Feather name="external-link" size={14} color={C.brand[500]} />
          </Pressable>
        )}
        {isOwner && (
          <>
            <Pressable onPress={() => onEdit?.(cert)} hitSlop={8} className="w-8 h-8 items-center justify-center bg-ink rounded-xl">
              <Feather name="edit-3" size={12} color={C.paper} />
            </Pressable>
            <Pressable onPress={() => onDelete?.(cert._id)} hitSlop={8} className="w-8 h-8 items-center justify-center bg-danger/10 rounded-xl">
              <Ionicons name="trash-outline" size={14} color={C.danger} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}
