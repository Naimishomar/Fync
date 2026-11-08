import React, { useCallback, useState } from 'react';
import { FlatList, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import Avatar from '../Avatar';
import { AppBar, BottomBar, Button, Card, Empty, IconBtn, Screen, Tag, TagRow } from '../ui/kit';
import { Alert } from '../ui/AlertModal';
import { ProgressiveImage } from '../ui/ProgressiveImage';
import { PressScale, tick } from '../ui/motion';
import Skeleton from '../Skeleton';
import { TYPE } from '../../constants/type';
import { AmenityTags, FOOD_LABEL, GENDER_LABEL, HABIT_LABEL, KIND_LABEL, StayCard, expiresText, rupees } from './StayFinder';

type Stay = Omit<StayCard, 'photo'> & {
  photos: string[]; deposit?: number | null; description?: string; moveIn?: string | null; budget?: number | null;
  habits: string[]; renewed: boolean; mine: boolean; owner: { _id: string; name?: string; avatar?: string; year?: number };
};
const REASONS = ['Fake or scam listing', 'Wrong details', 'Asking for money upfront', 'Offensive content'];

const Fact = ({ label, value }: { label: string; value: string }) => (
  <View style={{ width: '50%', paddingVertical: 8, paddingRight: 8 }}>
    <Text className="text-ink-3" style={TYPE.caption} numberOfLines={1}>{label}</Text>
    <Text className="text-ink" style={[TYPE.heading, { marginTop: 2 }]} numberOfLines={1}>{value}</Text>
  </View>
);

const DetailSkeleton = ({ photoH }: { photoH: number }) => (
  <View>
    <Skeleton lightMode width="100%" height={photoH} borderRadius={0} />
    <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8 }}>
      <Skeleton lightMode width={140} height={12} />
      <Skeleton lightMode width="80%" height={24} />
      <Skeleton lightMode width="55%" height={14} />
      <Skeleton lightMode height={120} borderRadius={16} style={{ marginTop: 8 }} />
    </View>
  </View>
);

export default function StayDetail() {
  const navigation = useNavigation<any>();
  const { id } = useRoute<any>().params as { id: string };
  const { width } = useWindowDimensions();
  const [stay, setStay] = useState<Stay | null>(null);
  const [gone, setGone] = useState(false);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`/stays/${id}`, { params: { noCache: true } });
      setStay(res.data?.stay || null);
      if (!res.data?.stay) setGone(true);
      setFailed(false);
    } catch (e: any) {
      if (e?.response?.status === 404) setGone(true);
      else setFailed(true);
    }
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const report = () => Alert.alert('Report this listing', 'Why are you reporting it?', [
    ...REASONS.map((reason) => ({
      text: reason,
      onPress: async () => {
        try {
          const r = await axios.post(`/stays/${id}/report`, { reason });
          Toast.show({ type: 'success', text1: r.data?.message || 'Reported' });
        } catch (e: any) { Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not report' }); }
      },
    })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  const toggleFilled = async () => {
    if (!stay) return;
    setBusy(true);
    try {
      await axios.patch(`/stays/${id}`, { status: stay.status === 'active' ? 'filled' : 'active' });
      tick();
      load();
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || 'Could not update' });
    } finally { setBusy(false); }
  };

  if (gone) {
    return (
      <Screen>
        <AppBar title="Listing" onBack={() => navigation.goBack()} />
        <Empty art="assets/House/3D/house_3d.png" title="This listing is gone" hint="It was filled, deleted or expired" />
      </Screen>
    );
  }
  const photoH = Math.round(width * 0.66);
  if (!stay) {
    return (
      <Screen>
        <AppBar title="Listing" onBack={() => navigation.goBack()} />
        {failed ? (
          <Empty icon="cloud-offline-outline" title="Couldn't load this listing" hint="Check your connection and try again"
            action={<Button title="Retry" variant="primary" onPress={() => { setFailed(false); load(); }} />} />
        ) : <DetailSkeleton photoH={photoH} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <AppBar title={KIND_LABEL[stay.kind]} onBack={() => navigation.goBack()}
        right={stay.mine ? null : <IconBtn name="flag-outline" accessibilityLabel="Report listing" onPress={report} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {stay.photos.length ? (
          <View>
            <FlatList
              data={stay.photos}
              keyExtractor={(p) => p}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item, index }) => (
                <ProgressiveImage path={item} style={{ width, height: photoH }}
                  accessibilityLabel={`Photo ${index + 1} of ${stay.photos.length}`} />
              )}
            />
            {stay.photos.length > 1 ? (
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                {stay.photos.map((p, i) => (
                  <View key={p} accessible={false} style={{ width: i === page ? 16 : 6, height: 6, borderRadius: 3, backgroundColor: i === page ? C.brand[500] : C.line }} />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
          <Text className="text-ink-3 font-semibold" style={TYPE.sm}>
            {KIND_LABEL[stay.kind]} · {expiresText(stay.expiresAt)}{stay.status === 'filled' ? ' · Filled' : ''}
          </Text>
          <Text className="text-ink" style={[TYPE.subtitle, { marginTop: 4 }]} accessibilityRole="header" numberOfLines={3}>{stay.title}</Text>
          <Text className="text-ink-2" style={[TYPE.body, { marginTop: 4 }]} numberOfLines={2}>
            📍 {stay.area}{stay.distanceKm != null ? ` · ${stay.distanceKm} km from college` : ''}
          </Text>

          <Card style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 8 }}>
            <Fact label={stay.kind === 'roommate' ? 'Rent share' : 'Rent'} value={`${rupees(stay.rent)}/mo`} />
            {stay.deposit != null ? <Fact label="Deposit" value={rupees(stay.deposit)} /> : null}
            <Fact label="For" value={GENDER_LABEL[stay.forGender]} />
            <Fact label="Food" value={FOOD_LABEL[stay.food]} />
            {stay.budget != null ? <Fact label="Budget" value={rupees(stay.budget)} /> : null}
            {stay.moveIn ? <Fact label="Move in" value={new Date(stay.moveIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} /> : null}
          </Card>

          {stay.amenities.length ? (
            <View style={{ marginTop: 16 }}>
              <Text className="text-ink" style={[TYPE.heading, { marginBottom: 8 }]} accessibilityRole="header">Amenities</Text>
              <AmenityTags items={stay.amenities} />
            </View>
          ) : null}
          {stay.habits.length ? (
            <View style={{ marginTop: 16 }}>
              <Text className="text-ink" style={[TYPE.heading, { marginBottom: 8 }]} accessibilityRole="header">Looking for someone who is</Text>
              <TagRow>{stay.habits.map((h) => <Tag key={h} label={HABIT_LABEL[h] || h} />)}</TagRow>
            </View>
          ) : null}
          {stay.description ? (
            <Text className="text-ink" style={[TYPE.body, { marginTop: 16 }]}>{stay.description}</Text>
          ) : null}

          <PressScale onPress={() => navigation.navigate('PublicProfile', { userId: stay.owner._id })} haptic={false}
            accessibilityRole="button" accessibilityLabel={`Listed by ${stay.owner.name}. Open profile`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, minHeight: 56 }}>
            <Avatar user={stay.owner} size={44} />
            <View style={{ flex: 1 }}>
              <Text className="text-ink" style={TYPE.heading} numberOfLines={1}>{stay.owner.name}{stay.mine ? ' (you)' : ''}</Text>
              <Text className="text-ink-3" style={TYPE.caption} numberOfLines={1}>{stay.owner.year ? `Year ${stay.owner.year} · ` : ''}Listed by a student</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={C.ink3} />
          </PressScale>
          <Text className="text-ink-3" style={[TYPE.caption, { marginTop: 12 }]}>
            Visit before you pay anything. Never send a deposit to someone you haven{"'"}t met.
          </Text>
        </View>
      </ScrollView>

      <BottomBar>
        {stay.mine ? (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Button title="Edit" style={{ flex: 1 }} onPress={() => navigation.navigate('StayForm', { id })} />
            <Button title={stay.status === 'active' ? 'Mark filled' : 'Mark available'} variant="primary" style={{ flex: 1 }} loading={busy} onPress={toggleFilled} />
          </View>
        ) : (
          <Button title="Message owner" icon="chatbubble-outline" variant="primary" block
            onPress={() => { tick(); navigation.navigate('PublicProfile', { userId: stay.owner._id }); }} />
        )}
      </BottomBar>
    </Screen>
  );
}
