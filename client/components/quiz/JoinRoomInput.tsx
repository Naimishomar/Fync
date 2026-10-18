import React, { useState } from 'react';
import {View, TextInput, Text, TouchableOpacity, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

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

        {/* Centered Content */}
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="flex-1 justify-center px-gutter pb-24">

          {/* Main Card */}
          <View className="bg-card p-card-pad rounded-sheet border border-line items-center shadow-hair">

            <View className="bg-paper-2 w-24 h-24 rounded-sheet items-center justify-center mb-8 border border-line">
              <Ionicons name="keypad" size={40} color={C.brand[500]} />
            </View>

            <Text className="text-2xl font-display text-ink mb-3 text-center uppercase">Enter Room Node</Text>
            <Text className="font-sans text-sm text-ink-3 text-center mb-12 px-4">
              Establish connection by entering the 6-character room identifier provided by the host.
            </Text>

            {/* Input Field */}
            <TextInput
              value={roomId}
              onChangeText={setRoomId}
              placeholder="000000"
              placeholderTextColor={C.ink4}
              className="w-full bg-card border-2 border-ink p-6 rounded-card mb-10 text-center text-ink text-4xl font-display uppercase"
              style={{ letterSpacing: 12, shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }}
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
            />

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleJoin}
              disabled={loading}
              activeOpacity={0.9}
              className={`w-full py-5 rounded-card border-2 border-ink flex-row justify-center items-center ${loading ? 'bg-brand-200' : 'bg-brand-500'}`}
            >
              {loading ? (
                <ActivityIndicator color={C.ink} size="small" />
              ) : (
                <>
                  <Text className="font-display text-on-brand uppercase mr-2" style={{ fontSize: 14, letterSpacing: 0.3 }}>Initialize</Text>
                  <Ionicons name="rocket" size={20} color={C.onBrand} />
                </>
              )}
            </TouchableOpacity>

          </View>
        </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default JoinRoomInput;
