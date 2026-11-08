import React, { memo, useCallback, useEffect, useState } from 'react';
import { View, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import axios from '../context/axiosConfig';
import { getFullUrl } from '../utils/imageUtils';
import { useBottomInset } from '../constants/layout';
import { AppBar, Avatar, Button, Empty, ListRow, Screen, C } from './ui/kit';

import FyncRefreshControl from './ui/FyncRefreshControl';
type BlockedUser = { _id: string; name?: string; username?: string; avatar?: string };

const BlockedRow = memo(function BlockedRow({ item, busy, onUnblock }: { item: BlockedUser; busy: boolean; onUnblock: (u: BlockedUser) => void }) {
  const name = item.name || item.username || 'User';
  return (
    <ListRow
      leading={<Avatar uri={getFullUrl(item.avatar) || undefined} initials={item.name || item.username} size={44} />}
      title={name}
      subtitle={item.username ? `@${item.username}` : undefined}
      right={<Button small title="Unblock" loading={busy} accessibilityLabel={`Unblock ${name}`} onPress={() => onUnblock(item)} />}
    />
  );
});

export default function BlockedUsersScreen() {
  const navigation = useNavigation<any>();
  const bottom = useBottomInset();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchBlocked = useCallback(async () => {
    try {
      const res = await axios.get('/safety/blocked', { params: { noCache: true } });
      setUsers(res.data?.users || []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBlocked(); }, [fetchBlocked]);

  const unblock = useCallback(async (u: BlockedUser) => {
    setBusyId(u._id);
    try {
      await axios.delete(`/safety/block/${u._id}`);
      setUsers((prev) => prev.filter((x) => x._id !== u._id));
      Toast.show({ type: 'success', text1: `Unblocked ${u.name || u.username || 'user'}` });
    } catch (e: any) {
      Toast.show({ type: 'error', text1: e?.response?.data?.message || "Couldn't unblock" });
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <Screen>
      <AppBar title="Blocked users" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator color={C.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u._id}
          refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBlocked(); }} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: bottom + 20, flexGrow: 1 }}
          renderItem={({ item }) => <BlockedRow item={item} busy={busyId === item._id} onUnblock={unblock} />}
          ListEmptyComponent={
            failed ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Empty title="Couldn't load blocked users" action={<Button title="Try again" onPress={() => { setLoading(true); fetchBlocked(); }} />} />
              </View>
            ) : (
              <Empty icon="ban-outline" title="No blocked users" hint="People you block will show up here." />
            )
          }
        />
      )}
    </Screen>
  );
}
