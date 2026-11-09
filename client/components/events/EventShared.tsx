import React, { memo, useCallback, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, Modal, Switch, Linking, ActivityIndicator, type ListRenderItem, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { CameraView } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { collegesInIndia } from '../../data/college';
import { navigate } from '../../utils/navigation';
import {
  Avatar, Button, Card, Chip, Empty, FormField, IconBtn, Label, ListRow, SearchField, SectionHeader, Sheet, Tag, TagRow,
} from '../ui/kit';
import { Pop } from '../ui-extra/usePop';
import { FooterStat, type ListingTag } from '../opportunity/OpportunityCard';

/* Shared by BootcampScreen and SpeakerSessionScreen. */

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface ContactDetail { name: string; mobile: string; email: string }

export const pickImage = async (setter: (uri: string) => void) => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: Platform.OS === 'ios',
    quality: 0.8,
  });
  if (!result.canceled) setter(result.assets[0].uri);
};

export const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

/* ------------------------------------------------------------- event card */
type EventLike = {
  _id: string; eventName: string; description?: string; college?: string; banner?: string; logo?: string;
  fee?: number; status?: 'open' | 'closed'; userLimit?: number; registrationsCount?: number;
  isCommunityActive?: boolean; contactDetails?: ContactDetail[];
};

/** Bootcamp / speaker session card: banner, logo, title, tags, contacts, community link, fee + join. */
export const EventCard = memo(function EventCard({
  item, fallbackIcon, tags, chatType, isAdmin, isPrimaryAdmin, isRegistered, onRegister, onScan, onAttendees, onEdit, children,
}: {
  item: EventLike;
  fallbackIcon: IconName;
  tags: ListingTag[];
  chatType: 'Bootcamp' | 'SpeakerSession';
  isAdmin: boolean;
  isPrimaryAdmin?: boolean;
  isRegistered?: boolean;
  onRegister: () => void;
  onScan: () => void;
  onAttendees: () => void;
  onEdit: () => void;
  /** Extra body (speakers row). */
  children?: React.ReactNode;
}) {
  const limit = item.userLimit ?? 0;
  const isLimitReached = !isAdmin && !isRegistered && limit > 0 && limit < 1000000 && (item.registrationsCount ?? 0) >= limit;
  const closed = item.status === 'closed';
  const off = !!isRegistered || closed || isLimitReached;

  return (
    <View className="bg-card rounded-2xl mb-3 mx-gutter overflow-hidden border border-line">
      <View className="h-40">
        {item.banner ? (
          <Image source={{ uri: item.banner }} recyclingKey={item._id} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="memory-disk" />
        ) : (
          <View className="w-full h-full bg-paper-2" />
        )}
        {item.college ? (
          <View className="absolute top-3 left-3 bg-card px-3 py-1 rounded-full max-w-[60%]">
            <Text className="text-ink text-xs font-semibold" numberOfLines={1}>{item.college}</Text>
          </View>
        ) : null}
        {isAdmin ? (
          <View className="absolute top-2 right-2 flex-row" style={{ gap: 4 }}>
            <IconBtn name="scan-outline" overlay size={20} onPress={onScan} accessibilityLabel="Scan tickets" />
            <IconBtn name="people-outline" overlay size={20} onPress={onAttendees} accessibilityLabel="View attendees" />
            {isPrimaryAdmin ? <IconBtn name="settings-outline" overlay size={20} onPress={onEdit} accessibilityLabel="Edit event" /> : null}
          </View>
        ) : null}
        <View className="absolute -bottom-6 left-4 w-16 h-16 bg-card rounded-2xl p-1 border border-line">
          {item.logo ? (
            <Image source={{ uri: item.logo }} style={{ width: '100%', height: '100%', borderRadius: 12 }} cachePolicy="memory-disk" />
          ) : (
            <View className="w-full h-full bg-paper-2 rounded-xl items-center justify-center">
              <Ionicons name={fallbackIcon} size={24} color={C.ink2} />
            </View>
          )}
        </View>
      </View>

      <View className="pt-10 px-4 pb-4">
        <Text className="text-ink text-lg font-semibold" numberOfLines={2}>{item.eventName}</Text>
        <TagRow style={{ marginTop: 12 }}>
          {tags.map((t) => <Tag key={t.label} icon={t.icon} label={t.label} />)}
        </TagRow>

        {children}

        {item.description ? (
          <Text className="text-ink-2 text-sm font-sans mt-3" numberOfLines={3}>{item.description}</Text>
        ) : null}

        {item.contactDetails?.length ? (
          <View className="mt-4 bg-paper-2 p-3 rounded-2xl" style={{ gap: 12 }}>
            <Label>Contacts</Label>
            {item.contactDetails.map((c, idx) => (
              <View key={idx}>
                <Text className="text-ink text-sm font-semibold">{c.name}</Text>
                <View className="flex-row flex-wrap mt-2" style={{ gap: 8 }}>
                  {c.mobile ? <Button small variant="secondary" icon="call-outline" title={c.mobile} accessibilityLabel={`Call ${c.name}`} onPress={() => Linking.openURL(`tel:${c.mobile}`)} /> : null}
                  {c.email ? <Button small variant="secondary" icon="mail-outline" title="Email" accessibilityLabel={`Email ${c.name}`} onPress={() => Linking.openURL(`mailto:${c.email}`)} /> : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {(isRegistered || isAdmin) && item.isCommunityActive !== false ? (
          <ListRow
            icon="chatbubbles-outline"
            title="Community chat"
            subtitle="Talk with everyone attending"
            onPress={() => navigate('EventCommunityChat', { eventId: item._id, eventName: item.eventName, type: chatType })}
            style={{ marginTop: 8 }}
          />
        ) : null}

        <View className="mt-4 pt-4 border-t border-line flex-row items-center" style={{ gap: 12 }}>
          <View className="flex-1"><FooterStat label="Entry" value={item.fee && item.fee > 0 ? `₹${item.fee}` : 'Free'} /></View>
          <Pop on={!!isRegistered}>
            <Button
              small
              variant={off ? 'tertiary' : 'primary'}
              disabled={off}
              title={closed ? 'Closed' : isRegistered ? 'Joined' : isLimitReached ? 'Full' : 'Join'}
              onPress={onRegister}
            />
          </Pop>
        </View>
      </View>
    </View>
  );
});

/* ---------------------------------------------------------- joined ticket */
export const JoinedCard = memo(function JoinedCard({
  title, eyebrow, timeLabel, isAdmin, isPresent, locked, passLabel, onPress,
}: {
  title: string; eyebrow: string; timeLabel: string; isAdmin?: boolean; isPresent?: boolean;
  locked?: boolean; passLabel: string; onPress: () => void;
}) {
  return (
    <Card padded style={{ marginHorizontal: 20, marginBottom: 12 }}>
      <Label>{eyebrow}</Label>
      <Text className="text-ink text-lg font-semibold mt-1" numberOfLines={1}>{title}</Text>
      <TagRow style={{ marginTop: 12 }}>
        <Tag icon="time-outline" label={timeLabel} />
        {isAdmin ? <Tag icon="shield-outline" label="Admin" /> : null}
        {isPresent ? <Tag icon="checkmark-circle" label="Present" /> : null}
      </TagRow>
      <Button
        block
        variant="secondary"
        icon={locked ? 'lock-closed-outline' : 'qr-code-outline'}
        title={passLabel}
        onPress={onPress}
        style={{ marginTop: 16 }}
      />
    </Card>
  );
});

/* ----------------------------------------------------------------- sheets */
export function TicketsSheet<T extends { _id: string }>({
  visible, onClose, subtitle, data, renderItem, emptyText,
}: {
  visible: boolean; onClose: () => void; subtitle: string; data: T[]; renderItem: ListRenderItem<T>; emptyText: string;
}) {
  return (
    <Sheet visible={visible} onClose={onClose} title="My tickets" subtitle={subtitle} scroll={false} height="75%">
      <FlatList
        data={data}
        keyExtractor={(it) => it._id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
        ListEmptyComponent={<Empty icon="ticket-outline" title="No tickets yet" hint={emptyText} action={<Button variant="primary" title="Explore events" onPress={onClose} />} />}
      />
    </Sheet>
  );
}

/** Entry pass: QR on white (scanners need the contrast in both themes). */
export function PassSheet({
  visible, onClose, title, qrCode, caption,
}: { visible: boolean; onClose: () => void; title?: string; qrCode?: string; caption?: string }) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title || 'Entry pass'} subtitle="Show this at the entrance" footer={<Button block title="Close" onPress={onClose} />}>
      <View className="items-center py-4">
        <View className="p-4 rounded-2xl border border-line" style={{ backgroundColor: '#FFFFFF' }}>
          {qrCode ? (
            <Image source={{ uri: qrCode }} style={{ width: 224, height: 224 }} contentFit="contain" accessibilityLabel="Entry QR code" />
          ) : (
            <View style={{ width: 224, height: 224 }} className="items-center justify-center"><ActivityIndicator color={C.brand[500]} /></View>
          )}
        </View>
        {caption ? <Text className="text-ink-2 text-sm font-semibold mt-4">{caption}</Text> : null}
      </View>
    </Sheet>
  );
}

const CollegeRow = memo(function CollegeRow({ name, onPick }: { name: string; onPick: (n: string) => void }) {
  return <ListRow icon="business-outline" title={name} titleLines={2} chevron={false} onPress={() => onPick(name)} style={{ paddingHorizontal: 20 }} />;
});

export function CollegePickerSheet({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (college: string) => void }) {
  const [q, setQ] = useState('');
  const list = useMemo(() => collegesInIndia.filter((c) => c.toLowerCase().includes(q.toLowerCase())), [q]);
  const pick = useCallback((c: string) => { onSelect(c); setQ(''); }, [onSelect]);
  const renderItem = useCallback<ListRenderItem<string>>(({ item }) => <CollegeRow name={item} onPick={pick} />, [pick]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Select college" scroll={false} height="78%">
      <SearchField value={q} onChangeText={setQ} placeholder="Search colleges" containerStyle={{ marginHorizontal: 20, marginVertical: 12 }} />
      <FlatList
        data={list}
        keyExtractor={(it) => it}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={15}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Empty icon="business-outline" title="No college found" hint="Try a shorter name" />}
      />
    </Sheet>
  );
}

/** Attendee list sheet: title + actions, optional header (date chips), notice, list. */
export function AttendeesSheet<T extends { _id: string }>({
  visible, onClose, title, subtitle, actions, top, notice, loading, data, renderItem,
}: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; actions?: React.ReactNode;
  top?: React.ReactNode; notice: string; loading?: boolean; data: T[]; renderItem: ListRenderItem<T>;
}) {
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      scroll={false}
      height="90%"
      header={
        <View className="flex-row items-center" style={{ gap: 4 }}>
          <View className="flex-1" style={{ minWidth: 0 }}>
            <Text className="text-ink text-lg font-semibold" numberOfLines={1} accessibilityRole="header">{title}</Text>
            {subtitle ? <Text className="text-ink-3 text-sm font-sans" numberOfLines={1}>{subtitle}</Text> : null}
          </View>
          {actions}
        </View>
      }
    >
      {top}
      <View className="mx-gutter mt-3 mb-1 p-3 rounded-2xl bg-paper-2 flex-row items-start" style={{ gap: 8 }}>
        <Ionicons name="information-circle-outline" size={18} color={C.ink2} />
        <Text className="text-ink-2 text-xs font-sans flex-1">{notice}</Text>
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color={C.brand[500]} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it._id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={<Empty icon="people-outline" title="No attendees yet" />}
        />
      )}
    </Sheet>
  );
}

export const AttendeeRow = memo(function AttendeeRow({
  name, email, index, status, tags, right,
}: { name?: string; email?: string; index: number; status?: ListingTag[]; tags: (string | undefined)[]; right?: React.ReactNode }) {
  return (
    <View className="px-gutter py-4 border-b border-line">
      <View className="flex-row items-start" style={{ gap: 12 }}>
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text className="text-ink text-base font-semibold" numberOfLines={1}>{name || 'Unknown'}</Text>
          {email ? <Text className="text-ink-3 text-sm font-sans" numberOfLines={1}>{email}</Text> : null}
        </View>
        <Text className="text-ink-3 text-xs font-semibold">#{index + 1}</Text>
      </View>
      <View className="flex-row items-center mt-3" style={{ gap: 12 }}>
        <TagRow style={{ flex: 1 }}>
          {status?.map((t) => <Tag key={t.label} icon={t.icon} label={t.label} />)}
          {tags.filter(Boolean).map((t) => <Tag key={t} label={t!} />)}
        </TagRow>
        {right}
      </View>
    </View>
  );
});

/* ------------------------------------------------------------ full-screen */
/** Camera QR scanner. Intentionally dark: it sits over the live camera feed. */
export function ScannerModal({
  visible, onClose, onScanned, title, hint,
}: { visible: boolean; onClose: () => void; onScanned?: (r: any) => void; title: string; hint: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'black' }}>
        <CameraView style={{ flex: 1 }} onBarcodeScanned={onScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} />
        <View
          pointerEvents="box-none"
          className="absolute inset-0 items-center justify-between px-gutter"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }}
        >
          <View className="items-center">
            <Text className="text-xl font-semibold" style={{ color: '#FFFFFF' }} accessibilityRole="header">{title}</Text>
            <Text className="text-sm font-sans mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>{hint}</Text>
          </View>
          <View pointerEvents="none" className="w-64 h-64 rounded-3xl" style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)' }} />
          <Button title="Cancel" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------ form pieces */
/** Tap-to-pick field styled like FormField (date, time, college). */
export function PickerField({
  label, value, placeholder, onPress, icon = 'chevron-down', style,
}: { label?: string; value?: string; placeholder: string; onPress: () => void; icon?: IconName; style?: any }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text className="text-ink-2 text-sm font-semibold">{label}</Text> : null}
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${value || placeholder}` : value || placeholder}
        className="flex-row items-center min-h-[48px] px-4 rounded-2xl bg-paper-2 border border-line active:opacity-85"
        style={{ gap: 8 }}
      >
        <Text className={`flex-1 text-base font-sans ${value ? 'text-ink' : 'text-ink-3'}`} numberOfLines={1}>{value || placeholder}</Text>
        <Ionicons name={icon} size={18} color={C.ink3} />
      </Pressable>
    </View>
  );
}

export function BrandingPicker({
  banner, logo, onBanner, onLogo,
}: { banner: string | null; logo: string | null; onBanner: (u: string) => void; onLogo: (u: string) => void }) {
  return (
    <View className="flex-row" style={{ gap: 12 }}>
      <Pressable onPress={() => pickImage(onBanner)} accessibilityRole="button" accessibilityLabel="Pick banner image" className="flex-1 h-32 rounded-2xl bg-paper-2 border border-line overflow-hidden items-center justify-center active:opacity-85">
        {banner ? <Image source={{ uri: banner }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : (
          <><Ionicons name="image-outline" size={22} color={C.ink3} /><Text className="text-ink-3 text-xs font-semibold mt-1">Banner</Text></>
        )}
      </Pressable>
      <Pressable onPress={() => pickImage(onLogo)} accessibilityRole="button" accessibilityLabel="Pick logo image" className="w-32 h-32 rounded-2xl bg-paper-2 border border-line overflow-hidden items-center justify-center active:opacity-85">
        {logo ? <Image source={{ uri: logo }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : (
          <><Ionicons name="camera-outline" size={22} color={C.ink3} /><Text className="text-ink-3 text-xs font-semibold mt-1">Logo</Text></>
        )}
      </Pressable>
    </View>
  );
}

export function ToggleRow({ on, icon, title, hint, onToggle }: { on: boolean; icon: IconName; title: string; hint?: string; onToggle: () => void }) {
  return (
    <ListRow
      icon={icon}
      title={title}
      subtitle={hint}
      subtitleLines={2}
      right={<Switch value={on} onValueChange={onToggle} accessibilityLabel={title} trackColor={{ true: C.brand[500], false: C.line }} thumbColor="#FFFFFF" />}
    />
  );
}

export function ContactsEditor({ contacts, onChange }: { contacts: ContactDetail[]; onChange: (c: ContactDetail[]) => void }) {
  const set = (idx: number, patch: Partial<ContactDetail>) => {
    const next = [...contacts];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  return (
    <View>
      <SectionHeader title="Contacts" action="Add" onAction={() => onChange([...contacts, { name: '', mobile: '', email: '' }])} />
      {contacts.map((c, idx) => (
        <Card padded key={idx} style={{ marginBottom: 12, gap: 12 }}>
          <View className="flex-row items-end" style={{ gap: 8 }}>
            <FormField label="Name" placeholder="Contact name" value={c.name} onChangeText={(t) => set(idx, { name: t })} containerStyle={{ flex: 1 }} />
            <IconBtn name="trash-outline" color={C.danger} accessibilityLabel="Remove contact" onPress={() => onChange(contacts.filter((_, i) => i !== idx))} />
          </View>
          <View className="flex-row" style={{ gap: 12 }}>
            <FormField label="Mobile" placeholder="Mobile" value={c.mobile} keyboardType="phone-pad" onChangeText={(t) => set(idx, { mobile: t })} containerStyle={{ flex: 1 }} />
            <FormField label="Email" placeholder="Email" value={c.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(t) => set(idx, { email: t })} containerStyle={{ flex: 1 }} />
          </View>
        </Card>
      ))}
    </View>
  );
}

export function CollaboratorsEditor({
  value, onChangeText, onAdd, adding, searching, suggestions, onPick, admins, canRemove, onRemove,
}: {
  value: string; onChangeText: (t: string) => void; onAdd: () => void; adding: boolean; searching?: boolean;
  suggestions: { _id: string; name: string; username: string; avatar?: string }[];
  onPick: (username: string) => void;
  admins: { id: string; label: string }[];
  canRemove: boolean; onRemove: (id: string) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-end" style={{ gap: 8 }}>
        <FormField
          label="Collaborators"
          placeholder="Username"
          autoCapitalize="none"
          value={value}
          onChangeText={onChangeText}
          containerStyle={{ flex: 1 }}
          right={searching ? <ActivityIndicator size="small" color={C.ink3} /> : null}
        />
        <Button title="Add" icon="person-add-outline" onPress={onAdd} loading={adding} />
      </View>
      {suggestions.length > 0 ? (
        <Card style={{ paddingHorizontal: 12 }}>
          {suggestions.map((u) => (
            <ListRow
              key={u._id}
              leading={<Avatar uri={u.avatar} initials={u.name} size={40} />}
              title={u.name}
              subtitle={`@${u.username}`}
              chevron={false}
              onPress={() => onPick(u.username)}
            />
          ))}
        </Card>
      ) : null}
      {admins.length ? (
        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
          {admins.map((a) => canRemove ? (
            <Chip key={a.id} label={a.label} icon="close-circle" accessibilityLabel={`Remove ${a.label}`} onPress={() => onRemove(a.id)} />
          ) : (
            <Tag key={a.id} label={a.label} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
