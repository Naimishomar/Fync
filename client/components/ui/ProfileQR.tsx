import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Pressable, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from './kit';
import { Sheet } from './Sheet';
import { Alert } from './AlertModal';
import { ScannerModal } from '../events/EventShared';
import { C } from '../../constants/colors';

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://fync-api.duckdns.org';

/** The link a profile QR encodes. Opens the app on PublicProfile (linking: `u/:userId`). */
export const profileLink = (userId: string) => `${BASE}/u/${userId}`;

/** A Fync profile id out of a scanned QR, or null if it is not one of ours. */
export const parseProfileLink = (data: string): string | null => {
  const m = /\/u\/([a-f0-9]{24})(?:[/?#]|$)/i.exec(data ?? '');
  return m ? m[1] : null;
};

// QR stays black on white in both themes: scanners read dark-on-light.
const QR = ({ value, size }: { value: string; size: number }) => (
  <View className="rounded-2xl" style={{ backgroundColor: '#FFFFFF', padding: 10 }}>
    <QRCode value={value} size={size} color="#12100E" backgroundColor="#FFFFFF" />
  </View>
);

/**
 * The user's own QR, Paytm-style, for the sidebar: scan it to land on their
 * profile. Tap the code for a large version; Share sends the link; Scan opens
 * the camera to read someone else's.
 */
export default function ProfileQRCard({ user, onNavigate }: {
  user: { _id?: string; name?: string; username?: string } | null | undefined;
  /** Called before navigating, so the drawer can close itself first. */
  onNavigate?: () => void;
}) {
  const navigation = useNavigation<any>();
  const [big, setBig] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const share = useCallback(() => {
    if (!user?._id) return;
    Share.share({ message: `Find me on Fync: ${profileLink(user._id)}` }).catch(() => {});
  }, [user?._id]);

  const openScanner = useCallback(async () => {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      Alert.alert('Camera needed', 'Allow camera access to scan a Fync QR.', [{ text: 'Okay' }]);
      return;
    }
    handled.current = false;
    setScanning(true);
  }, [permission?.granted, requestPermission]);

  const onScanned = useCallback(({ data }: { data: string }) => {
    // The camera fires many frames per code; act on the first only.
    if (handled.current) return;
    handled.current = true;
    setScanning(false);
    const id = parseProfileLink(data);
    if (!id) {
      Alert.alert('Not a Fync QR', 'That code is not a Fync profile.', [{ text: 'Okay' }]);
      return;
    }
    onNavigate?.();
    navigation.navigate('PublicProfile', { userId: id });
  }, [navigation, onNavigate]);

  if (!user?._id) return null;
  const link = profileLink(user._id);

  return (
    <>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <Pressable
          onPress={() => setBig(true)}
          className="active:opacity-70"
          accessibilityRole="imagebutton"
          accessibilityLabel="Show your profile QR code larger"
        >
          <QR value={link} size={92} />
        </Pressable>
        <View className="flex-1 min-w-0" style={{ gap: 8 }}>
          <View>
            <Text className="font-semibold text-ink" style={{ fontSize: 15 }}>Your Fync QR</Text>
            <Text className="font-sans text-ink-3" style={{ fontSize: 12, lineHeight: 16 }}>
              Scan to open your profile
            </Text>
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            <Button title="Share" small variant="secondary" onPress={share} />
            <Button title="Scan" small variant="primary" onPress={openScanner} />
          </View>
        </View>
      </Card>

      <Sheet visible={big} onClose={() => setBig(false)} title="Your Fync QR" subtitle="Anyone can scan this to open your profile"
        footer={<Button title="Share link" variant="primary" block onPress={share} />}>
        <View className="items-center py-4" style={{ gap: 12 }}>
          <QR value={link} size={220} />
          <Text className="font-semibold text-ink" style={{ fontSize: 17 }} numberOfLines={1}>{user.name || user.username}</Text>
          {!!user.username && <Text className="font-sans text-ink-3 text-sm">@{user.username}</Text>}
        </View>
      </Sheet>

      <ScannerModal
        visible={scanning}
        onClose={() => setScanning(false)}
        onScanned={onScanned}
        title="Scan a Fync QR"
        hint="Point the camera at someone's profile code"
      />
    </>
  );
}
