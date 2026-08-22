/**
 * What a student's shared links have produced.
 *
 * Taps only. There is deliberately no money on this screen: a tap is not a
 * sale, and nothing can be paid until an affiliate network confirms one. Showing
 * a rupee figure derived from clicks would be inventing a number.
 */
import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl, Share, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';

type ShareRow = {
  _id: string;
  code: string;
  clicks: number;
  selfClicks: number;
  createdAt: string;
  product?: { _id: string; name: string; image: string; price: number; isAvailable: boolean } | null;
};

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
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1" edges={['top']}>
        <View className="px-gutter pt-3">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button" accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}
          >
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Your</Text>
          <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Shares</Text>
          <Text className="font-display text-label text-ink-3 uppercase mt-3" style={{ letterSpacing: 1.4 }}>
            What your links are doing
          </Text>

          <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
            <Text className="text-ink text-label font-display uppercase">Taps</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            <Text className="text-ink-3 font-mono text-label">{totalClicks}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator color="#F97316" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r._id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#F97316" colors={['#F97316']} />
            }
            renderItem={({ item }) => (
              <View className="flex-row items-center bg-card rounded-card p-4 border border-line mb-2">
                {!!item.product?.image && (
                  <Image source={{ uri: item.product.image }} style={{ width: 44, height: 44, borderRadius: 10 }} resizeMode="cover" />
                )}
                <View className="flex-1 mx-3">
                  <Text className="text-ink text-sm" numberOfLines={1}>{item.product?.name ?? 'Removed product'}</Text>
                  <Text className="text-ink-3 text-label mt-0.5">
                    {item.clicks} tap{item.clicks === 1 ? '' : 's'}
                    {item.selfClicks > 0 ? ` · ${item.selfClicks} your own` : ''}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => reshare(item)}
                  className="w-11 h-11 items-center justify-center rounded-xl border border-line bg-card"
                  accessibilityRole="button" accessibilityLabel={`Share ${item.product?.name ?? 'again'}`}
                >
                  <Ionicons name="share-outline" size={18} color="#12100E" />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center mt-16 px-8">
                <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-4">
                  <Ionicons name="link-outline" size={32} color="#57534E" />
                </View>
                <Text className="text-ink font-display uppercase text-h2 text-center">Nothing shared yet</Text>
                <Text className="text-ink-2 text-sm text-center mt-2">
                  Share a product from Fync Store and the taps it gets will show up here.
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('AffiliateStore')}
                  className="mt-6 px-6 py-4 rounded-md items-center justify-center border-2 border-ink bg-brand-500"
                  accessibilityRole="button"
                >
                  <Text className="font-display uppercase text-ink text-label">Open Fync Store</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
