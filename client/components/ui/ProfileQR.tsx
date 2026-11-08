import React, { useCallback, useRef, useState } from 'react';
import { View, Text, Share, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Button, Card } from './kit';
import { Alert } from './AlertModal';
import { ScannerModal } from '../events/EventShared';
import { C } from '../../constants/colors';
import { shareCard } from '../../utils/shareCard';

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
  <View className="rounded-2xl" style={{ backgroundColor: '#FFFFFF', padding: 12 }}>
    <QRCode value={value} size={size} color="#12100E" backgroundColor="#FFFFFF" />
  </View>
);

/**
 * The user's own QR, Paytm/BHIM-style, for the sidebar: one large square code
 * across the full width, scan it to land on their profile. Share sends the
 * link; Scan opens the camera to read someone else's.
 */
export default function ProfileQRCard({ user, onNavigate }: {
  user: { _id?: string; name?: string; username?: string } | null | undefined;
  /** Called before navigating, so the drawer can close itself first. */
  onNavigate?: () => void;
}) {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  const [sharing, setSharing] = useState(false);
  const share = useCallback(async () => {
    const id = user?._id;
    if (!id) return;
    setSharing(true);
    await shareCard('u', id, 'Share my Fync profile', () => Share.share({ message: `Find me on Fync: ${profileLink(id)}` }));
    setSharing(false);
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

  // Sidebar gutter 20 + card padding 16 + QR quiet-zone padding 12, each side;
  // capped so it stays a sensible size on a tablet.
  const size = Math.min(width - 2 * (20 + 16 + 12), 360);

  return (
    <>
      <Card style={{ alignItems: 'center', padding: 16, gap: 14 }}>
        <View className="items-center">
          <Text className="font-semibold text-ink" style={{ fontSize: 16 }}>Your Fync QR</Text>
          <Text className="font-sans text-ink-3" style={{ fontSize: 13 }}>Scan to open my profile</Text>
        </View>
        <View accessible accessibilityRole="image" accessibilityLabel="Your profile QR code">
          <QR value={link} size={size} />
        </View>
        <View className="flex-row self-stretch" style={{ gap: 12 }}>
          <View className="flex-1"><Button title="Share" icon="share-social-outline" variant="secondary" block loading={sharing} onPress={share} /></View>
          <View className="flex-1"><Button title="Scan QR" icon="scan-outline" variant="primary" block onPress={openScanner} /></View>
        </View>
      </Card>

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
