import React, { memo, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, Animated, Easing, StatusBar } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import axios from '../../context/axiosConfig';
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import socket from '../../utils/socket';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Card, Empty, IconBtn, Label, ListRow, Num } from '../ui/kit';

// Top three get a trophy next to the rank number (the colour is not the only cue).
const TROPHY = [() => C.warning, () => C.ink3, () => C.brand[600]];
const ROW = { marginHorizontal: 20, paddingHorizontal: 16, marginBottom: 12 };

const LeaderRow = memo(function LeaderRow({ item, index }: { item: any; index: number }) {
  const name = item.user?.name || item.user?.username || 'Player';
  return (
    <Card style={ROW}>
      <ListRow
        leading={
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <View className="w-8 items-center">
              {index < 3 ? <Ionicons name="trophy" size={18} color={TROPHY[index]()} /> : null}
              <Text className="font-display text-ink-3 text-xs">#{index + 1}</Text>
            </View>
            <View className="w-11 h-11 bg-paper-2 rounded-full justify-center items-center overflow-hidden">
              {item.user?.avatar ? (
                <Image source={{ uri: item.user.avatar }} style={{ width: 44, height: 44 }} cachePolicy="memory-disk" />
              ) : (
                <Text className="font-display text-ink-3 text-lg">{item.user?.username?.[0]?.toUpperCase()}</Text>
              )}
            </View>
          </View>
        }
        title={name}
        subtitle={`@${item.user?.username || 'unknown'}`}
        right={<Num style={{ fontSize: 17 }}>{item.score} <Text className="text-ink-3 text-xs font-sans">pts</Text></Num>}
        accessibilityLabel={`Rank ${index + 1}, ${name}, ${item.score} points`}
      />
    </Card>
  );
});

type ScreenRouteProp = RouteProp<RootStackParamList, 'LeaderboardScreen'>;

const LeaderboardScreen = () => {
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<any>();
  const { roomId, myScore } = route.params;

  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Animation value for the refresh icon
  const spinAnim = useRef(new Animated.Value(0)).current;

  // 2. SETUP REAL-TIME LISTENERS
  useEffect(() => {
    fetchLeaderboard();

    socket.emit("watch_leaderboard", { roomId });

    const onUpdate = () => {
      fetchLeaderboard();
    };

    socket.on("leaderboard_updated", onUpdate);

    return () => {
      socket.off("leaderboard_updated", onUpdate);
    };
  }, [roomId]);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`/quiz/leaderboard/${roomId}`);
      setLeaders(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.log("Error fetching leaderboard", err);
    } finally {
      setLoading(false);
    }
  };

  // Animated Refresh Handler
  const handleManualRefresh = async () => {
    // Start spinning animation
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    await fetchLeaderboard();

    // Stop animation when done
    spinAnim.stopAnimation();
    spinAnim.setValue(0);
  };

  // Interpolate rotation value
  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const downloadPDF = async () => {
    if (leaders.length === 0) {
      return Alert.alert("Empty", "No data to download.");
    }
    setDownloading(true);
    try {
      const tableRows = leaders.map((item, index) => `
        <tr>
          <td style="text-align: center; color: #57534E; font-weight: bold;">${index + 1}</td>
          <td>
             <div style="font-weight: bold; color: #12100E;">${item.user?.name || "Unknown"}</div>
             <div style="font-size: 11px; color: #8B857E;">@${item.user?.username || "unknown"}</div>
          </td>
          <td style="text-align: center; font-weight: 900; font-size: 16px; color: #F97316;">${item.score}</td>
        </tr>
      `).join('');

      // Formatted PDF for light mode printing (since PDFs are usually printed on white paper)
      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; background: #ffffff; }
              h1 { text-align: center; color: #F97316; margin-bottom: 5px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;}
              h3 { text-align: center; color: #8B857E; font-weight: normal; margin-top: 0; }
              table { width: 100%; border-collapse: collapse; margin-top: 30px; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
              th, td { border-bottom: 1px solid #E3DDD3; padding: 16px 20px; text-align: left; }
              th { background-color: #12100E; color: #ffffff; font-weight: bold; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;}
              tr:last-child td { border-bottom: none; }
              .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #C4BEB6; }
            </style>
          </head>
          <body>
            <h1>Leaderboard Results</h1>
            <h3>Room ID: ${roomId}</h3>

            <table>
              <thead>
                <tr>
                  <th style="width: 10%; text-align: center;">Rank</th>
                  <th>Participant</th>
                  <th style="width: 15%; text-align: center;">Score</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>

            <div class="footer">
              Generated by Fync App • ${new Date().toLocaleDateString()}
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });

    } catch (error) {
      console.error("PDF Generation Error:", error);
      Alert.alert("Error", "Could not generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => <LeaderRow item={item} index={index} />;

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <SafeAreaView className="flex-1" edges={['bottom']}>
        {/* HEADER — kit AppBar; there's no back here (reached via replace), so Home leads the actions. */}
        <AppBar
          title="Leaderboard"
          right={
          <>
            <IconBtn name="home-outline" accessibilityLabel="Home" onPress={() => navigation.navigate("Tabs")} />
            <Animated.View style={{ transform: [{ rotate: spin }] }}>
              <IconBtn name="refresh" accessibilityLabel="Refresh" onPress={handleManualRefresh} />
            </Animated.View>
            {downloading ? (
              <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator size="small" color={C.ink} />
              </View>
            ) : (
              <IconBtn boxed name="download-outline" accessibilityLabel="Download results as PDF" onPress={downloadPDF} />
            )}
          </>
          }
        />

        {/* Room code */}
        <View className="items-center mb-4">
          <View className="bg-paper-2 px-3 py-1 rounded-full">
            <Text className="text-xs font-semibold text-ink-3">Room <Text className="text-ink">{roomId}</Text></Text>
          </View>
        </View>

        {/* Your score (if played) */}
        {myScore !== undefined && (
          <Card padded style={{ marginHorizontal: 20, marginBottom: 16, alignItems: 'center' }}>
            <Label>Your score</Label>
            <Num style={{ fontSize: 44, lineHeight: 48, marginTop: 4 }}>{myScore}</Num>
            <Text className="text-ink-3 text-xs mt-1">points</Text>
          </Card>
        )}

        {/* Leaderboard List */}
        {loading ? (
          <ActivityIndicator size="large" color={C.brand[500]} className="mt-20" />
        ) : (
          <FlatList keyboardShouldPersistTaps="handled"
            data={leaders}
            keyExtractor={(item, i) => item._id ?? String(i)}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            ListEmptyComponent={
              <Empty icon="people-outline" title="No entries yet" hint="Scores appear here as players finish." />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
};

export default LeaderboardScreen;
