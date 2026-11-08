import React, { memo, useEffect, useState } from 'react';
import {View, Text, FlatList, ActivityIndicator} from 'react-native'
import { useBottomInset } from '../constants/layout';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import axios from '../context/axiosConfig';
import { Alert } from './ui/AlertModal';
import { C } from '../constants/colors';
import { Sheet, IconBtn, ListRow, Empty } from './ui/kit';
import Avatar from './Avatar';

interface LeaderboardUser {
  _id: string;
  name: string;
  username: string;
  avatar: string;
  streakCount: number;
  college: string;
}

const StreakLeaderboardModal = ({ isVisible, onClose }: { isVisible: boolean; onClose: () => void }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LeaderboardUser[]>([]);
  const [userRank, setUserRank] = useState(-1);
  const [userStreak, setUserStreak] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const bottomInset = useBottomInset();

  useEffect(() => {
    if (isVisible) {
      fetchLeaderboard();
    }
  }, [isVisible]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/user/streak-leaderboard');
      if (res.data.success) {
        setData(res.data.leaderboard ?? []);
        setUserRank(res.data.userRank ?? -1);
        setUserStreak(res.data.userStreak ?? 0);
        setCompletedToday(!!res.data.completedToday);
      }
    } catch (error) {
      console.error("Leaderboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: LeaderboardUser; index: number }) => <LeaderRow item={item} index={index} />;

  return (
    <Sheet
      visible={isVisible}
      onClose={onClose}
      height="80%"
      scroll={false}
      closeLabel="Close leaderboard"
      header={
        <View className="flex-row items-center">
          <View className="flex-1 min-w-0">
            <Text className="text-ink font-semibold text-[17px]" numberOfLines={1} accessibilityRole="header">Campus legends</Text>
            <Text className="text-ink-3 text-[13px]" numberOfLines={1}>Longest daily posting streaks</Text>
          </View>
          <IconBtn
            name="information-circle-outline"
            color={C.ink2}
            accessibilityLabel="Streak rules"
            onPress={() => {
              Alert.alert(
                "Streak rules",
                "Keep the flame alive and climb the ranks!\n\n1. Post a Daily Post or Short to increase your streak.\n2. Consistency is key: You must post every single day.\n3. If you miss a day, your streak resets to 0 by the end of the day.\n\nTop 10 users with the highest streaks get featured as Campus Legends!",
                [{ text: "Got it" }]
              );
            }}
          />
        </View>
      }
    >
      {/* Your rank */}
      <View className="px-gutter pt-4 pb-2">
        <View className="bg-paper-2 p-4 rounded-2xl flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="bg-card w-12 h-12 rounded-full items-center justify-center mr-3">
              <Text className="text-ink font-display text-lg">#{userRank > 0 ? userRank : '–'}</Text>
            </View>
            <View>
              <Text className="text-ink-3 text-xs font-semibold">Your position</Text>
              <Text className="text-ink text-base font-semibold">Global ranking</Text>
            </View>
          </View>
          <View className="items-end">
            <View className="flex-row items-center">
              <Text className="text-ink text-2xl font-display">{userStreak}</Text>
              <MaterialCommunityIcons name="fire" size={22} color={C.brand[500]} />
            </View>
            {completedToday ? (
              <View className="flex-row items-center mt-1">
                <MaterialCommunityIcons name="check-circle" size={12} color={C.success} />
                <Text className="text-ink-2 text-xs font-semibold ml-1">Secured today</Text>
              </View>
            ) : (
              <View className="flex-row items-center mt-1">
                <MaterialCommunityIcons name="clock-alert-outline" size={12} color={C.danger} />
                <Text className="text-danger text-xs font-semibold ml-1">Post to keep it</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* List Section */}
      <View className="flex-1 px-gutter">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={C.brand[500]} />
          </View>
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={data}
            renderItem={renderItem}
            keyExtractor={(item) => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 + bottomInset, paddingTop: 4 }}
            ListEmptyComponent={
              <View className="mt-10">
                <Empty icon="flame-outline" title="No streaks yet" hint="Post today to be the first on the board." />
              </View>
            }
          />
        )}
      </View>
    </Sheet>
  );
};

const MEDAL = ['#F5B700', '#8B857E', '#B45309'];
const LeaderRow = memo(function LeaderRow({ item, index }: { item: LeaderboardUser; index: number }) {
  return (
    <ListRow
      leading={
        <View className="flex-row items-center">
          <View className="w-7 items-center mr-2">
            {index < 3 ? (
              <MaterialCommunityIcons name="crown" size={20} color={MEDAL[index]} accessibilityLabel={`Rank ${index + 1}`} />
            ) : (
              <Text className="text-ink-3 font-semibold text-sm">#{index + 1}</Text>
            )}
          </View>
          <Avatar user={item as any} size={40} showBadge={false} />
        </View>
      }
      title={item.name}
      subtitle={item.college || 'Fync student'}
      right={
        <View className="flex-row items-center bg-paper-2 px-2.5 py-1 rounded-full">
          <Text className="text-ink font-semibold text-xs mr-0.5">{item.streakCount}</Text>
          <MaterialCommunityIcons name="fire" size={14} color={C.brand[500]} />
        </View>
      }
    />
  );
});

export default StreakLeaderboardModal;
