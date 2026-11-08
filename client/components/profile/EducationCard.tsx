import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../constants/colors';
import { Card, IconTile, Tag, TagRow } from '../ui/kit';
import { OwnerActions } from './ProfileBits';

export type EducationEntry = {
  _id: string; institution: string; degree?: string; field?: string;
  grade?: string; startYear?: number; endYear?: number; isCurrent?: boolean; description?: string;
};

export default function EducationCard({ item, isOwner, onEdit, onDelete }: {
  item: EducationEntry; isOwner?: boolean;
  onEdit?: (i: EducationEntry) => void; onDelete?: (id: string) => void;
}) {
  return (
    <Card style={{ marginBottom: 12, flexDirection: 'row', gap: 12 }}>
      <IconTile icon="school-outline" size={48} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-ink font-semibold text-base">{item.institution}</Text>
        {/* !! — the add form saves blank fields as '', and a bare '' in a View crashes RN. */}
        {!!item.degree && (
          <Text className="text-ink-2 text-sm font-sans mt-0.5">
            {item.degree}{item.field ? ` · ${item.field}` : ''}
          </Text>
        )}
        <TagRow style={{ marginTop: 8 }}>
          <Tag icon="calendar-outline" label={`${item.startYear || '?'} – ${item.isCurrent ? 'Present' : (item.endYear || '?')}`} />
          {item.grade ? <Tag icon="star-outline" label={item.grade} /> : null}
          {item.isCurrent ? <Tag label="Current" tone={{ fg: C.success }} /> : null}
        </TagRow>
        {!!item.description && <Text className="text-ink-3 text-sm leading-5 font-sans mt-2" numberOfLines={3}>{item.description}</Text>}
      </View>
      {isOwner ? <OwnerActions vertical what="education" onEdit={() => onEdit?.(item)} onDelete={() => onDelete?.(item._id)} /> : null}
    </Card>
  );
}
