import React from 'react';
import { View, Text, Linking } from 'react-native';
import { Image } from 'expo-image';
import { C } from '../../constants/colors';
import { Card, IconTile, IconBtn } from '../ui/kit';
import { OwnerActions } from './ProfileBits';

const CAT_CONFIG = (): Record<string, { color: string; icon: string }> => ({
  coding:        { color: C.ink, icon: 'code-slash-outline' },
  design:        { color: C.ink, icon: 'color-palette-outline' },
  cloud:         { color: C.ink, icon: 'cloud-outline' },
  'ai-ml':       { color: C.accentText, icon: 'hardware-chip-outline' },
  cybersecurity: { color: C.accentText, icon: 'shield-checkmark-outline' },
  management:    { color: C.ink, icon: 'people-outline' },
  'data-science':{ color: C.accentText, icon: 'bar-chart-outline' },
  other:         { color: C.ink, icon: 'ribbon-outline' },
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

  const date = fmtDate(cert.issueDate);

  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {cert.imageUrl ? (
        <Image
          source={{ uri: cert.imageUrl }}
          style={{ width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: C.line }}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <IconTile icon={cat.icon as any} size={56} color={cat.color} />
      )}

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="font-semibold text-base text-ink" numberOfLines={1}>{cert.title}</Text>
        <Text className="text-ink-2 text-sm font-sans mt-0.5" numberOfLines={1}>{cert.issuer}</Text>
        {date ? <Text className="text-ink-3 text-xs font-sans mt-1">Issued {date}</Text> : null}
      </View>

      <View className="flex-row items-center">
        {cert.credentialUrl ? (
          <IconBtn name="open-outline" size={18} color={C.ink2} onPress={() => Linking.openURL(cert.credentialUrl!).catch(() => {})} accessibilityLabel="Open credential" />
        ) : null}
        {isOwner ? <OwnerActions what="certificate" onEdit={() => onEdit?.(cert)} onDelete={() => onDelete?.(cert._id)} /> : null}
      </View>
    </Card>
  );
}
