import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';

const QuizHome = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View className="flex-1 justify-center items-center bg-white space-y-6">
      <Text className="text-3xl font-bold mb-10 text-gray-800">Quiz Arena</Text>

      {/* CREATE ROOM */}
      <TouchableOpacity 
        onPress={() => navigation.navigate("CreateRoom")}
        className="w-3/4 bg-blue-600 p-4 rounded-xl shadow-sm"
      >
        <Text className="text-white text-center font-bold text-lg">Create Room</Text>
      </TouchableOpacity>

      {/* JOIN ROOM */}
      <TouchableOpacity 
        onPress={() => navigation.navigate("JoinRoomInput")}
        className="w-3/4 bg-green-600 p-4 rounded-xl shadow-sm"
      >
        <Text className="text-white text-center font-bold text-lg">Join Room</Text>
      </TouchableOpacity>

      {/* 1v1 MATCH */}
      <TouchableOpacity 
        onPress={() => navigation.navigate("OneVsOneSetup")}
        className="w-3/4 bg-purple-600 p-4 rounded-xl shadow-sm"
      >
        <Text className="text-white text-center font-bold text-lg">Random 1v1</Text>
      </TouchableOpacity>
    </View>
  );
};

export default QuizHome;