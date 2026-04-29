import React, { useState } from 'react';
import { View, TextInput, Text, Alert, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import axios from '../../context/axiosConfig';

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
      const res = await axios.get(`/quiz/room/${roomId.toUpperCase()}`);
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
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header with Back Button */}
        <View className="flex-row items-center px-8 pt-8 mb-4">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
            className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm shadow-black/5 mr-4"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#18181b" />
          </TouchableOpacity>
          <View>
            <Text className="text-zinc-900 text-3xl font-black  tracking-tighter uppercase">
              Join <Text className="text-pink-500">Room</Text>
            </Text>
            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Initialize Remote Sync</Text>
          </View>
        </View>

        {/* Centered Content */}
        <View className="flex-1 justify-center px-8 pb-24">

          {/* Main Card */}
          <View className="bg-white p-10 rounded-[40px] border border-slate-100 items-center shadow-2xl shadow-black/5">

            <View className="bg-slate-50 w-24 h-24 rounded-[32px] items-center justify-center mb-8 border border-slate-100">
              <Ionicons name="keypad" size={40} color="#ec4899" />
            </View>

            <Text className="text-2xl font-black  text-zinc-900 mb-3 text-center uppercase tracking-tight">Enter Room Node</Text>
            <Text className="text-slate-400 text-center mb-12 text-[10px] font-black uppercase tracking-wider leading-5 px-4">
              Establish connection by entering the 6-character room identifier provided by the host.
            </Text>

            {/* Input Field */}
            <TextInput
              value={roomId}
              onChangeText={setRoomId}
              placeholder="000000"
              placeholderTextColor="#CBD5E1"
              className="w-full bg-slate-50 border border-slate-100 p-6 rounded-3xl mb-10 text-center text-zinc-900 text-4xl font-black  tracking-[12px] uppercase"
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
            />

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleJoin}
              disabled={loading}
              activeOpacity={0.9}
              className={`w-full py-6 rounded-[32px] shadow-2xl flex-row justify-center items-center ${loading ? 'bg-pink-400' : 'bg-pink-500 shadow-pink-500/20'
                }`}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text className="text-white text-center font-black  text-lg mr-3 tracking-[3px] uppercase">Initialize</Text>
                  <Ionicons name="rocket" size={20} color="white" />
                </>
              )}
            </TouchableOpacity>

          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default JoinRoomInput;
