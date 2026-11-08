import React, { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { View, Text, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Screen, Chip, Empty, Button, Num } from '../ui/kit';
import { GiftProduct, rupees } from './shared';

import FyncRefreshControl from '../ui/FyncRefreshControl';
const GiftCard = memo(function GiftCard({ item, onOpen }: { item: GiftProduct; onOpen: (id: string) => void }) {
  return (
    <Pressable
      onPress={() => onOpen(item._id)}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${rupees(item.price)}`}
      className="flex-1 mb-3 rounded-2xl border border-line bg-card overflow-hidden active:opacity-85"
      style={{ maxWidth: '50%' }}
    >
      <View style={{ aspectRatio: 1, backgroundColor: C.paper2, alignItems: 'center', justifyContent: 'center' }}>
        {item.images?.[0]
          ? <Image source={{ uri: item.images[0] }} style={{ width: '100%', height: '100%' }} contentFit="cover" transition={150} cachePolicy="memory-disk" recyclingKey={item._id} />
          : <Ionicons name="gift-outline" size={40} color={C.ink3} />}
      </View>
      <View className="p-3">
        <Text className="text-ink font-semibold text-sm" numberOfLines={2}>{item.title}</Text>
        <Num style={{ fontSize: 16, marginTop: 4 }}>{rupees(item.price)}</Num>
        <Text className="text-ink-3 text-xs mt-0.5">Delivery in {item.deliveryDays} days</Text>
      </View>
    </Pressable>
  );
});

/** Fync Gifts storefront: banner, category chips, 2-up product grid. */
const GiftShop = () => {
  const navigation = useNavigation<any>();
  const [products, setProducts] = useState<GiftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cat, setCat] = useState('All');

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/gifts/products');
      setProducts(res.data.products ?? []);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cats = useMemo(() => ['All', ...Array.from(new Set(products.map((p) => p.category)))], [products]);
  const shown = cat === 'All' ? products : products.filter((p) => p.category === cat);

  const open = useCallback((id: string) => navigation.navigate('GiftProduct', { id }), [navigation]);
  const renderItem = useCallback(({ item }: { item: GiftProduct }) => <GiftCard item={item} onOpen={open} />, [open]);

  const header = (
    <View>
      <View className="mx-gutter mt-2 mb-4 rounded-2xl p-5 overflow-hidden" style={{ backgroundColor: '#db2777' }}>
        <Text className="font-display text-white text-h1" style={{ color: '#fff' }}>Make it personal 💝</Text>
        <Text style={{ color: '#ffffffdd', marginTop: 6, fontSize: 14, lineHeight: 20 }}>
          Custom gifts for your person: your photos, your words. We make it and deliver to their door.
        </Text>
      </View>
      <View className="flex-row flex-wrap px-gutter mb-2" style={{ gap: 8 }}>
        {cats.map((c) => <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} />)}
      </View>
    </View>
  );

  return (
    <Screen>
      <AppBar
        title="Fync Gifts"
        onBack={() => navigation.goBack()}
        right={<IconBtn name="receipt-outline" onPress={() => navigation.navigate('MyGifts')} accessibilityLabel="My gift orders" />}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={C.ink3} />
      ) : error && !products.length ? (
        <Empty icon="cloud-offline-outline" title="Couldn't load gifts" hint="Check your connection and try again."
          action={<Button title="Retry" onPress={() => { setLoading(true); load(); }} />} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(p) => p._id}
          numColumns={2}
          ListHeaderComponent={header}
          columnWrapperStyle={{ paddingHorizontal: 20, gap: 12 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Empty icon="gift-outline" title="No gifts here yet" hint="New gifts are on the way." />}
          renderItem={renderItem}
        />
      )}
    </Screen>
  );
};

export default GiftShop;
