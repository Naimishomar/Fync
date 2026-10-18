import React, { memo, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';
import { FEATURES, artUrl, isFeatureOn } from '../../constants/features';
import { daysLeftLabel } from '../../utils/deadline';

const WHERE: Record<string, string> = { Remote: 'Work from Home', Onsite: 'In office', Hybrid: 'Hybrid' };

const initials = (s?: string) =>
  (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const fmtDate = (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

const MetaRow = ({ icon, text }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string }) => (
  <View className="flex-row items-center mt-1.5">
    <Ionicons name={icon} size={15} color={C.ink3} />
    <Text className="text-ink-2 text-sm font-sans ml-2 flex-1" numberOfLines={1}>{text}</Text>
  </View>
);

/** Internship / job listing card: title + company with logo, meta rows, posted date + deadline, apply. */
export const OpportunityCard = memo(({ item, onApply, hideApply }: { item: any; onApply: (item: any) => void; hideApply?: boolean }) => {
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const isIntern = item.type === 'internship';
  const exp = String(item.experience || 'fresher');
  const pay = item.isPaid
    ? String(item.stipend ?? '').startsWith('₹') ? item.stipend : `₹${item.stipend ?? ''}`
    : 'Unpaid';
  const deadline = daysLeftLabel(item.deadline);
  const posted = fmtDate(item.createdAt);

  return (
    <View className="bg-card rounded-card mb-4 mx-gutter p-5 border border-line shadow-hair">
      <View className="flex-row" style={{ gap: 12 }}>
        <View className="flex-1">
          <Text className="text-ink text-lg font-display leading-6" numberOfLines={2}>{item.title}</Text>
          <Text className="text-ink-2 text-sm font-sans mt-1" numberOfLines={1}>{item.company}</Text>
        </View>
        <View className="w-14 h-14 rounded-xl border border-line overflow-hidden items-center justify-center bg-card">
          {item.companyLogo && !logoFailed ? (
            <Image
              source={{ uri: item.companyLogo }}
              recyclingKey={item._id}
              style={{ width: 48, height: 48 }}
              contentFit="contain"
              cachePolicy="memory-disk"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            // Always-coloured tile: white text in both themes.
            <View className="w-full h-full items-center justify-center" style={{ backgroundColor: C.fam.career }}>
              <Text className="font-display text-base" style={{ color: '#FFFFFF' }}>{initials(item.company)}</Text>
            </View>
          )}
        </View>
      </View>

      <View className="mt-3">
        <MetaRow icon="briefcase-outline" text={/fresher/i.test(exp) ? 'No prior experience required' : `${exp} experience`} />
        <MetaRow
          icon="time-outline"
          text={[item.opportunityType?.replace('-', ' '), isIntern && item.duration].filter(Boolean).join(' · ') || (isIntern ? 'Internship' : 'Job')}
        />
        <MetaRow icon="location-outline" text={WHERE[item.location] || item.location || 'Work from Home'} />
        <MetaRow icon="cash-outline" text={isIntern && item.isPaid ? `${pay} / month` : pay} />
      </View>

      {item.description ? (
        <Pressable onPress={() => setOpen((o) => !o)} className="mt-3" accessibilityRole="button" accessibilityLabel={open ? 'Show less' : 'Show full description'}>
          <Text className="text-ink-3 text-sm leading-5 font-sans" numberOfLines={open ? undefined : 2}>{item.description}</Text>
          <Text className="text-accent-text text-label font-semibold mt-1">{open ? 'Less' : 'More'}</Text>
        </Pressable>
      ) : null}

      <View className="mt-4 pt-4 border-t border-line flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-1 flex-row items-center flex-wrap" style={{ gap: 10 }}>
          {posted ? <Text className="text-ink-3 text-label font-semibold">{posted}</Text> : null}
          {deadline ? (
            <View className={`flex-row items-center px-2 py-1 rounded-md ${deadline.urgent ? 'bg-brand-50' : ''}`}>
              <Ionicons name="hourglass-outline" size={12} color={C.accentText} />
              <Text className="text-accent-text text-label font-semibold ml-1">{deadline.label}</Text>
            </View>
          ) : null}
        </View>

        {!hideApply && (
          <TouchableOpacity
            onPress={() => !item.hasApplied && onApply(item)}
            activeOpacity={item.hasApplied ? 1 : 0.9}
            className={`${item.hasApplied ? 'bg-paper-2 border border-line' : 'bg-ink'} px-5 py-3 rounded-card`}
          >
            <Text className={`${item.hasApplied ? 'text-ink-3' : 'text-paper'} font-display uppercase text-label`}>
              {item.hasApplied ? 'Registered' : 'Apply Now'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});
OpportunityCard.displayName = 'OpportunityCard';

const LISTINGS = [
  { id: 'internships', route: 'InternshipList' },
  { id: 'jobs', route: 'JobList' },
  { id: 'hackathons', route: 'HackathonHub' },
];

/** Internships / Jobs / Hackathons hop row; replaces the current screen so Back still returns to where you came from. */
export const ListingSwitcher = ({ current }: { current: 'internships' | 'jobs' | 'hackathons' }) => {
  const navigation = useNavigation<any>();
  const items = LISTINGS.filter((l) => isFeatureOn(l.id))
    .map((l) => ({ ...l, f: FEATURES.find((f) => f.id === l.id) }))
    .filter((l) => l.f);
  if (items.length < 2) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingVertical: 8 }}>
      {items.map(({ id, route, f }) => {
        const on = id === current;
        return (
          <TouchableOpacity
            key={id}
            onPress={() => !on && navigation.replace(route)}
            activeOpacity={0.85}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            className={`items-center rounded-card border-2 px-4 py-2.5 ${on ? 'border-brand-500 bg-brand-50' : 'border-line bg-card'}`}
            style={{ minWidth: 96 }}
          >
            {artUrl(f!.art) ? (
              <Image source={{ uri: artUrl(f!.art) }} style={{ width: 40, height: 40 }} contentFit="contain" cachePolicy="disk" />
            ) : (
              <Ionicons name={f!.icon} size={28} color={C.ink3} />
            )}
            <Text className={`text-label font-semibold mt-1.5 ${on ? 'text-ink' : 'text-ink-2'}`}>{f!.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
