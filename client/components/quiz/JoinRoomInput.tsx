import React, { useState } from 'react';
import { View, TextInput, Text, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
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
    if(!roomId.trim()) {
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
    <View className="flex-1 bg-black">
      {/* Background Gradient */}
      <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />

      <SafeAreaView className="flex-1">
        {/* Header with Back Button */}
        <View className="flex-row items-center px-6 pt-4 mb-2">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white/10 rounded-full mr-4 border border-white/10"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-black italic tracking-tighter">
            JOIN <Text className="text-pink-500">ROOM</Text> 🚪
          </Text>
        </View>

        {/* Centered Content */}
        <View className="flex-1 justify-center px-6 pb-20">
          
          {/* Glassy Card */}
          <View className="bg-[#1e1e1e]/80 p-8 rounded-3xl border border-white/10 items-center shadow-2xl">
            
            <View className="bg-pink-500/20 p-4 rounded-full mb-6 border border-pink-500/30">
                <Ionicons name="keypad-outline" size={40} color="#ec4899" />
            </View>

            <Text className="text-2xl font-black text-white mb-2 text-center">Enter Room Code</Text>
            <Text className="text-gray-400 text-center mb-8 text-sm">
               Ask the host for the 6-character room ID to join the battlefield.
            </Text>
            
            {/* Input Field */}
            <TextInput 
              value={roomId}
              onChangeText={setRoomId}
              placeholder="e.g. 8A2F9C"
              placeholderTextColor="#6b7280"
              className="w-full bg-[#2a2a2a] border border-white/10 p-5 rounded-2xl mb-8 text-center text-white text-3xl font-black tracking-[8px] uppercase"
              autoCapitalize="characters"
              maxLength={6}
              autoCorrect={false}
            />
            
            {/* Submit Button */}
            <TouchableOpacity 
              onPress={handleJoin} 
              disabled={loading}
              className={`w-full py-5 rounded-2xl shadow-lg flex-row justify-center items-center border ${
                loading ? 'bg-pink-600/50 border-pink-500/30' : 'bg-pink-600 border-pink-500/50'
              }`}
            >
              {loading ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <>
                  <Text className="text-white text-center font-black text-xl mr-2 tracking-widest">JOIN NOW</Text>
                  <Ionicons name="arrow-forward" size={24} color="white" />
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