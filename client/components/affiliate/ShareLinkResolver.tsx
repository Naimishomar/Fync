/**
 * Landing screen for fync://s/{code}.
 *
 * Resolving happens here rather than in the product screen so the tap is counted
 * exactly once, and so an expired or delisted link says so plainly instead of
 * dropping the user on an empty product page.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from 'axios';
import { Alert } from '../ui/AlertModal';

export default function ShareLinkResolver() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const code = route.params?.code;
  const done = useRef(false);

  useEffect(() => {
    // StrictMode and re-focus both re-run effects; without this guard the tap
    // would be counted more than once for a single open.
    if (done.current) return;
    done.current = true;

    (async () => {
      try {
        const res = await axios.get(`/affiliate/share/${code}`);
        navigation.replace('AffiliateProductDetail', {
          productId: res.data.product._id,
          shareCode: code,
        });
      } catch (e: any) {
        Alert.alert(
          'Link not available',
          e?.response?.data?.message ?? 'That link could not be opened.',
          [{ text: 'OK', onPress: () => navigation.replace('AffiliateStore') }],
        );
      }
    })();
  }, [code, navigation]);

  return (
    <View className="flex-1 bg-paper items-center justify-center">
      <ActivityIndicator color="#F97316" />
      <Text className="text-ink-3 text-sm mt-3">Opening…</Text>
    </View>
  );
}
