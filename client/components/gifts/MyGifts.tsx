import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Linking, Pressable } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, Screen, Empty, Button } from '../ui/kit';
import { GiftOrder, rupees, STATUS_LABEL, TIMELINE } from './shared';

const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');

/** Status timeline: paid → being made → shipped → delivered, or a stop sign for cancelled/refunded. */
const Timeline = ({ o }: { o: GiftOrder }) => {
  if (o.status === 'cancelled' || o.status === 'refunded') {
    return <Text style={{ color: C.danger, marginTop: 10, fontWeight: '600' }}>{STATUS_LABEL[o.status]}</Text>;
  }
  const at = TIMELINE.indexOf(o.status);
  const when = (s: string) => fmt(o.statusHistory.find((h) => h.status === s)?.at);
  return (
    <View className="flex-row mt-3">
      {TIMELINE.map((s, i) => {
        const done = i <= at;
        return (
          <View key={s} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 2, backgroundColor: i === 0 ? 'transparent' : done ? C.success : C.line }} />
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: done ? C.success : C.line }} />
              <View style={{ flex: 1, height: 2, backgroundColor: i === TIMELINE.length - 1 ? 'transparent' : i < at ? C.success : C.line }} />
            </View>
            <Text className={done ? 'text-ink' : 'text-ink-3'} style={{ fontSize: 11, marginTop: 4, textAlign: 'center' }}>{STATUS_LABEL[s]}</Text>
            {done && <Text className="text-ink-3" style={{ fontSize: 10 }}>{when(s)}</Text>}
          </View>
        );
      })}
    </View>
  );
};

const MyGifts = () => {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<GiftOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get('/gifts/orders/mine');
      setOrders(r.data.orders ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  // Refetch on focus: the usual way here is straight back from a payment.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <Screen>
      <AppBar title="My Gifts" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.ink3} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o._id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={error
            ? <Empty icon="cloud-offline-outline" title="Couldn't load your gifts" action={<Button title="Retry" onPress={load} />} />
            : <Empty icon="gift-outline" title="No gifts yet" hint="Surprise your person with something made just for them."
                action={<Button title="Browse gifts" variant="primary" onPress={() => navigation.navigate('GiftShop')} />} />}
          renderItem={({ item: o }) => (
            <View className="mb-4 rounded-card border border-line bg-card p-4">
              <View className="flex-row">
                <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {o.productSnapshot.image
                    ? <Image source={{ uri: o.productSnapshot.image }} style={{ width: 56, height: 56 }} contentFit="cover" />
                    : <Ionicons name="gift-outline" size={24} color={C.ink3} />}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text className="text-ink font-semibold" numberOfLines={1}>{o.productSnapshot.title}</Text>
                  <Text className="text-ink-2 text-sm mt-0.5">{rupees(o.amount)} · ordered {fmt(o.paidAt || o.createdAt)}</Text>
                  {o.shipping && <Text className="text-ink-3 text-xs mt-0.5" numberOfLines={1}>To {o.shipping.name}, {o.shipping.city}{o.shipping.surprise ? ' · surprise 🤫' : ''}</Text>}
                </View>
              </View>
              <Timeline o={o} />
              {!!o.tracking?.awb && (
                <Pressable
                  disabled={!o.tracking.url}
                  onPress={() => o.tracking?.url && Linking.openURL(o.tracking.url)}
                  className="mt-3 flex-row items-center"
                >
                  <Ionicons name="navigate-outline" size={14} color={C.ink2} />
                  <Text className="text-ink-2 text-xs ml-1.5">
                    {o.tracking.courier || 'Courier'} · AWB {o.tracking.awb}{o.tracking.url ? '  (track →)' : ''}
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </Screen>
  );
};

export default MyGifts;
