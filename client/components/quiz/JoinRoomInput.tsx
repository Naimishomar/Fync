import React, { useState } from 'react';
import { View, TextInput, Text, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button, Card, H2, IconTile } from '../ui/kit';

const JoinRoomInput = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [roomId, setRoomId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!roomId.trim()) {
      return Alert.alert("Required", "Please enter a Room ID");
    }

    setLoading(true);
    try {
      const res = await axios.get(`/quiz/room/${encodeURIComponent(roomId.trim().toUpperCase())}`);
      navigation.navigate("WaitingRoom", {
        roomId: res.data.roomId,
        startTime: res.data.startTime
      });
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || "Something went wrong";
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />

      <SafeAreaView className="flex-1" edges={['bottom']}>

        <AppBar title="Join Room" onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-1 justify-center px-gutter pb-24">
          <Card padded style={{ alignItems: 'center' }}>
            <IconTile icon="keypad-outline" size={64} style={{ marginBottom: 16 }} />

            <H2 style={{ textAlign: 'center', marginBottom: 8 }}>Enter room code</H2>
            <Text className="font-sans text-sm text-ink-3 text-center mb-6 px-4">
              Enter the 6-character room code from the host.
            </Text>

            <TextInput
              value={roomId}
              onChangeText={setRoomId}
              placeholder="000000"
              placeholderTextColor={C.ink3}
              accessibilityLabel="Room code"
              className="w-full bg-paper-2 border border-line p-4 rounded-2xl mb-6 text-center text-ink text-4xl font-display"
              style={{ letterSpacing: 8 }}
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleJoin}
            />

            <Button title="Join room" icon="enter-outline" variant="primary" block loading={loading} onPress={handleJoin} />
          </Card>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default JoinRoomInput;
