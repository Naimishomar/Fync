import React, { memo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useNavigation } from '@react-navigation/native';
import { C } from '../../constants/colors';
import { FEATURES, artUrl, isFeatureOn } from '../../constants/features';
import { daysLeftLabel } from '../../utils/deadline';
import { Button, Tag, TagRow } from '../ui/kit';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const WHERE: Record<string, string> = { Remote: 'Work from Home', Onsite: 'In office', Hybrid: 'Hybrid' };

const initials = (s?: string) =>
  (s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const fmtDate = (d?: string) => {
  const t = d ? new Date(d) : null;
  return t && !isNaN(t.getTime()) ? t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
};

const MetaRow = ({ icon, text }: { icon: IconName; text: string }) => (
  <View className="flex-row items-center mt-2">
    <Ionicons name={icon} size={16} color={C.ink3} />
    <Text className="text-ink-2 text-sm font-sans ml-2 flex-1" numberOfLines={1}>{text}</Text>
  </View>
);

/** 56px logo tile; falls back to initials on an always-coloured tile (white text in both themes). */
export const LogoTile = memo(function LogoTile({ uri, name, recyclingKey }: { uri?: string; name?: string; recyclingKey?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <View className="w-14 h-14 rounded-2xl border border-line overflow-hidden items-center justify-center bg-card">
      {uri && !failed ? (
        <Image
          source={{ uri }}
          recyclingKey={recyclingKey}
          style={{ width: 48, height: 48 }}
          contentFit="contain"
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
        />
      ) : (
        <View className="w-full h-full items-center justify-center" style={{ backgroundColor: C.fam.career }}>
          <Text className="font-semibold text-base" style={{ color: '#FFFFFF' }}>{initials(name)}</Text>
        </View>
      )}
    </View>
  );
});

export type ListingTag = { icon?: IconName; label: string };
export type ListingMeta = { icon: IconName; text: string };

/**
 * The one listing card for jobs, internships, hackathons, workshops, bootcamps:
 * title + org with logo, optional banner, tags, meta rows, footer (left) + action (right).
 */
export const ListingCard = memo(function ListingCard({
  title, subtitle, logo, logoKey, banner, tags, meta, children, footer, action, onPress, style,
}: {
  title: string;
  subtitle?: string;
  logo?: string;
  logoKey?: string;
  banner?: string;
  tags?: ListingTag[];
  meta?: ListingMeta[];
  children?: React.ReactNode;
  footer?: React.ReactNode;
  action?: { title: string; onPress?: () => void; variant?: 'primary' | 'secondary' | 'tertiary' | 'solid'; disabled?: boolean; loading?: boolean };
  onPress?: () => void;
  style?: any;
}) {
  const body = (
    <>
      <View className="flex-row items-center" style={{ gap: 12 }}>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-ink text-lg font-semibold" numberOfLines={2}>{title}</Text>
          {subtitle ? <Text className="text-ink-2 text-sm font-sans mt-1" numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        <LogoTile uri={logo} name={subtitle || title} recyclingKey={logoKey} />
      </View>

      {banner ? (
        <View className="mt-4 w-full h-32 rounded-2xl overflow-hidden bg-paper-2">
          <Image source={{ uri: banner }} recyclingKey={logoKey} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      ) : null}

      {tags?.length ? (
        <TagRow style={{ marginTop: 12 }}>
          {tags.map((t, i) => <Tag key={`${i}-${t.label}`} icon={t.icon} label={t.label} />)}
        </TagRow>
      ) : null}

      {meta?.length ? (
        <View className="mt-2">
          {meta.map((m) => <MetaRow key={m.icon + m.text} icon={m.icon} text={m.text} />)}
        </View>
      ) : null}

      {children}

      {footer || action ? (
        <View className="mt-4 pt-4 border-t border-line flex-row items-center" style={{ gap: 12 }}>
          <View className="flex-1" style={{ minWidth: 0 }}>{footer}</View>
          {action ? (
            <Button small title={action.title} onPress={action.onPress} variant={action.variant ?? 'primary'} disabled={action.disabled} loading={action.loading} />
          ) : null}
        </View>
      ) : null}
    </>
  );
  const cls = 'bg-card rounded-2xl mb-3 mx-gutter p-4 border border-line';
  if (!onPress) return <View className={cls} style={style}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} className={`${cls} active:opacity-70`} style={style}>
      {body}
    </Pressable>
  );
});

/** Footer caption + value pair ("Prize pool" / "₹50,000"). */
export const FooterStat = ({ label, value }: { label: string; value: string }) => (
  <>
    <Text className="text-ink-3 text-xs font-semibold">{label}</Text>
    <Text className="text-ink text-base font-semibold mt-0.5" numberOfLines={1}>{value}</Text>
  </>
);

/** Internship / job listing card: title + company with logo, meta rows, posted date + deadline, apply. */
export const OpportunityCard = memo(({ item, onApply, hideApply }: { item: any; onApply: (item: any) => void; hideApply?: boolean }) => {
  const [open, setOpen] = useState(false);
  const isIntern = item.type === 'internship';
  const exp = String(item.experience || 'fresher');
  const pay = item.isPaid
    ? String(item.stipend ?? '').startsWith('₹') ? item.stipend : `₹${item.stipend ?? ''}`
    : 'Unpaid';
  const deadline = daysLeftLabel(item.deadline);
  const posted = fmtDate(item.createdAt);

  return (
    <ListingCard
      title={item.title}
      subtitle={item.company}
      logo={item.companyLogo}
      logoKey={item._id}
      meta={[
        { icon: 'briefcase-outline', text: /fresher/i.test(exp) ? 'No prior experience required' : `${exp} experience` },
        {
          icon: 'time-outline',
          text: [item.opportunityType?.replace('-', ' '), isIntern && item.duration].filter(Boolean).join(' · ') || (isIntern ? 'Internship' : 'Job'),
        },
        { icon: 'location-outline', text: WHERE[item.location] || item.location || 'Work from Home' },
        { icon: 'cash-outline', text: isIntern && item.isPaid ? `${pay} / month` : pay },
      ]}
      footer={
        <View className="flex-row items-center flex-wrap" style={{ gap: 8 }}>
          {posted ? <Text className="text-ink-3 text-xs font-semibold">{posted}</Text> : null}
          {deadline ? (
            <View className={`flex-row items-center px-2 py-1 rounded-full ${deadline.urgent ? 'bg-brand-50' : ''}`}>
              <Ionicons name="hourglass-outline" size={12} color={C.accentText} />
              <Text className="text-accent-text text-xs font-semibold ml-1">{deadline.label}</Text>
            </View>
          ) : null}
        </View>
      }
      action={hideApply ? undefined : {
        title: item.hasApplied ? 'Registered' : 'Apply now',
        variant: item.hasApplied ? 'tertiary' : 'primary',
        disabled: !!item.hasApplied,
        onPress: () => onApply(item),
      }}
    >
      {item.description ? (
        <Pressable onPress={() => setOpen((o) => !o)} className="mt-3 active:opacity-70" accessibilityRole="button" accessibilityLabel={open ? 'Show less' : 'Show full description'}>
          <Text className="text-ink-3 text-sm leading-5 font-sans" numberOfLines={open ? undefined : 2}>{item.description}</Text>
          <Text className="text-accent-text text-xs font-semibold mt-1">{open ? 'Less' : 'More'}</Text>
        </Pressable>
      ) : null}
    </ListingCard>
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
    // Equal-width cells in one row (there are at most three), each a fixed
    // height so the label can never spill past the card's border.
    <View className="flex-row px-gutter py-2" style={{ gap: 8 }}>
      {items.map(({ id, route, f }) => {
        const on = id === current;
        return (
          <View key={id} style={{ flex: 1, minWidth: 0 }}>
            <Pressable
              onPress={() => !on && navigation.replace(route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={f!.label}
              className={`items-center justify-center rounded-2xl border active:opacity-70 ${on ? 'border-brand-500 bg-brand-50' : 'border-line bg-card'}`}
              style={{ height: 76, paddingHorizontal: 6, gap: 4 }}
            >
              {artUrl(f!.art) ? (
                <Image source={{ uri: artUrl(f!.art) }} style={{ width: 32, height: 32 }} contentFit="contain" cachePolicy="disk" />
              ) : (
                <Ionicons name={f!.icon} size={24} color={C.ink3} />
              )}
              <Text
                className={`font-semibold text-center ${on ? 'text-ink' : 'text-ink-2'}`}
                style={{ fontSize: 12, lineHeight: 16 }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
              >
                {f!.label}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
};
