import React from 'react';
import { View, Text } from 'react-native';
import { C } from '../../constants/colors';
import { Card, IconTile, Tag, TagRow } from '../ui/kit';
import { OwnerActions } from './ProfileBits';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const TYPE_CONFIG = (): Record<string, { icon: string; color: string }> => ({
  internship:   { icon: 'school-outline',     color: C.ink },
  'full-time':  { icon: 'briefcase-outline',  color: C.accentText },
  'part-time':  { icon: 'briefcase-outline',  color: C.ink },
  freelance:    { icon: 'laptop-outline',     color: C.accentText },
  contract:     { icon: 'document-outline',   color: C.ink },
  'open-source':{ icon: 'code-slash-outline', color: C.accentText },
});

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

// Dates are typed by hand in the add form, so an unparseable one is possible.
const parse = (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t : null;
};
const fmtDate = (d?: string) =>
  parse(d)?.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) ?? '';

export default function InternshipCard({ item, isOwner, onEdit, onDelete }: Props) {
  const type = TYPE_CONFIG()[item.type || 'internship'] || TYPE_CONFIG().internship;
  const start = fmtDate(item.startDate);
  const end = item.isCurrentlyWorking ? 'Present' : fmtDate(item.endDate);

  let durationStr = '';
  const s = parse(item.startDate);
  if (s) {
    const e = (!item.isCurrentlyWorking && parse(item.endDate)) || new Date();
    const months = Math.max(0, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    durationStr = months >= 12
      ? `${Math.floor(months / 12)}y ${months % 12}m`
      : `${months}m`;
  }

  return (
    <Card style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', gap: 12 }}>
      <IconTile icon={type.icon as any} size={48} color={type.color} />

      <View className="flex-1" style={{ minWidth: 0 }}>
        <Text className="text-ink font-semibold text-base" numberOfLines={2}>{item.role}</Text>
        <Text className="text-ink-2 text-sm font-sans mt-0.5" numberOfLines={1}>{item.company}</Text>

        <TagRow style={{ marginTop: 8 }}>
          <Tag icon="calendar-outline" label={`${start} – ${end}`} />
          {durationStr ? <Tag label={durationStr} /> : null}
          <Tag icon="location-outline" label={cap(item.workMode || 'remote')} />
          {item.isCurrentlyWorking ? <Tag label="Current" tone={{ fg: C.success }} /> : null}
        </TagRow>

        {item.description ? (
          <Text className="text-ink-3 text-sm mt-2 leading-5 font-sans" numberOfLines={3}>{item.description}</Text>
        ) : null}

        {item.techStack?.length ? (
          <TagRow style={{ marginTop: 8 }}>
            {item.techStack.slice(0, 4).map((t, i) => <Tag key={i} label={t} />)}
          </TagRow>
        ) : null}
      </View>

      {isOwner ? <OwnerActions vertical what="experience" onEdit={() => onEdit?.(item)} onDelete={() => onDelete?.(item._id)} /> : null}
    </Card>
  );
}
