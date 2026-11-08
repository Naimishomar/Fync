/**
 * What a student's shared links have produced.
 *
 * Taps only. There is deliberately no money on this screen: a tap is not a
 * sale, and nothing can be paid until an affiliate network confirms one. Showing
 * a rupee figure derived from clicks would be inventing a number.
 */
import React, { useCallback, useState, memo } from 'react';
import { View, FlatList, ActivityIndicator, Share, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, ListRow, IconBtn, SectionHeader, Empty, Button } from '../ui/kit';

import FyncRefreshControl from '../ui/FyncRefreshControl';
type ShareRow = {
  _id: string;
  code: string;
  clicks: number;
  selfClicks: number;
  createdAt: string;
  product?: { _id: string; name: string; image: string; price: number; isAvailable: boolean } | null;
};

const ShareItem = memo(function ShareItem({ item, onShare }: { item: ShareRow; onShare: (r: ShareRow) => void }) {
  return (
    <ListRow
      style={{ paddingHorizontal: 16, marginBottom: 12, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line }}
      leading={item.product?.image ? (
        <Image source={{ uri: item.product.image }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: C.paper2 }} contentFit="cover" cachePolicy="memory-disk" />
      ) : undefined}
      title={item.product?.name ?? 'Removed product'}
      subtitle={`${item.clicks} tap${item.clicks === 1 ? '' : 's'}${item.selfClicks > 0 ? ` · ${item.selfClicks} your own` : ''}`}
      right={<IconBtn name="share-outline" boxed onPress={() => onShare(item)} accessibilityLabel={`Share ${item.product?.name ?? 'again'}`} />}
    />
  );
});

export default function MySharesScreen() {
  const navigation = useNavigation<any>();
  const [rows, setRows] = useState<ShareRow[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axios.get('/affiliate/my-shares');
      setRows(res.data.shares ?? []);
      setTotalClicks(res.data.totalClicks ?? 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const reshare = async (row: ShareRow) => {
    const url = `fync://s/${row.code}`;
    try {
      await Share.share({ message: `${row.product?.name ?? 'This'} — spotted on Fync\n\n${url}` });
    } catch {
      Alert.alert('Not shared', 'Could not open the share sheet.');
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <View className="flex-1">
        <AppBar title="Your shares" onBack={() => navigation.goBack()} />
        <View className="px-gutter">
          <SectionHeader title="Taps" count={totalClicks} style={{ marginTop: 8 }} />
        </View>

        {loading ? (
          <ActivityIndicator color={C.brand[500]} style={{ marginTop: 40 }} />
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={rows}
            keyExtractor={(r) => r._id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand[500]} colors={[C.brand[500]]} />
            }
            renderItem={({ item }) => <ShareItem item={item} onShare={reshare} />}
            ListEmptyComponent={
              <View className="mt-16">
                <Empty
                  icon="link-outline"
                  title="Nothing shared yet"
                  hint="Share a product from Fync Store and the taps it gets will show up here."
                  action={<Button variant="primary" title="Open Fync Store" onPress={() => navigation.navigate('AffiliateStore')} />}
                />
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}
