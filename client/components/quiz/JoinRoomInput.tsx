import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, Text, Alert } from 'react-native';
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
    <View className="flex-1 justify-center items-center bg-white p-6">
      <Text className="text-2xl font-bold mb-6 text-gray-800">Enter Room ID</Text>
      
      <TextInput 
        value={roomId}
        onChangeText={setRoomId}
        placeholder="e.g. 8A2F9C"
        placeholderTextColor="#9ca3af"
        className="border border-gray-300 w-full p-4 rounded-xl mb-6 text-center text-xl font-semibold tracking-widest bg-gray-50 text-black"
        autoCapitalize="characters"
        maxLength={6} // Set to 6 to match backend ID length
      />
      
      <TouchableOpacity 
        onPress={handleJoin} 
        disabled={loading}
        className={`w-full p-4 rounded-xl shadow-sm ${loading ? 'bg-green-400' : 'bg-green-600'}`}
      >
        <Text className="text-center text-white font-bold text-lg">
          {loading ? "Joining..." : "Enter Room"}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default JoinRoomInput;