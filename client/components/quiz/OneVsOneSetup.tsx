import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, Question } from '../../App';
import socket from '../../utils/socket';
import { useAuth } from '../../context/auth.context';

const OneVsOneSetup = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuth();

  const [domain, setDomain] = useState<string>("DSA");
  const [searching, setSearching] = useState<boolean>(false);

  useEffect(() => {
    const onMatchFound = ({ matchRoomId, questions, opponent, endTime }: any) => {
      setSearching(false);
      navigation.replace("QuizScreen", { 
        questions, 
        roomId: matchRoomId, 
        mode: '1v1',
        endTime,
        opponent
      });
    };

    socket.on("match_found", onMatchFound);
    socket.on("match_preparing", () => console.log("Preparing..."));

    return () => {
      socket.off("match_found", onMatchFound);
      socket.off("match_preparing");
    };
  }, [navigation]);

  const findMatch = () => {
    if(!user) return Alert.alert("Error", "You must be logged in");
    
    setSearching(true);
    socket.emit("find_1v1_match", { user, domain });
  };

  const cancelSearch = () => {
      setSearching(false);
  };

  if (searching) {
    return (
      <View className="flex-1 justify-center items-center bg-white space-y-6 px-6">
        <ActivityIndicator size="large" color="#7c3aed" />
        <Text className="text-xl font-bold text-gray-800 mt-4">Searching Opponent...</Text>
        <Text className="text-gray-500 text-center">
            Looking for a match in <Text className="font-bold text-purple-600">{domain}</Text>
        </Text>
        <TouchableOpacity onPress={cancelSearch} className="mt-8 px-8 py-3 bg-gray-200 rounded-full">
          <Text className="text-gray-600 font-semibold">Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center bg-white p-4">
      <Text className="text-2xl font-bold mb-8 text-gray-800">Select Topic</Text>
      <View className="flex-row flex-wrap justify-center gap-3 mb-12">
        {['DSA', 'Frontend', 'Backend', 'System Design'].map(d => (
          <TouchableOpacity 
            key={d} 
            onPress={() => setDomain(d)}
            className={`px-5 py-3 rounded-xl border ${
              domain === d ? 'bg-purple-600 border-purple-600' : 'bg-white border-gray-300'
            }`}
          >
            <Text className={domain === d ? 'text-white font-bold' : 'text-gray-700'}>{d}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={findMatch} className="bg-purple-600 w-3/4 py-4 rounded-full shadow-lg">
        <Text className="text-white text-center font-bold text-lg">Find Opponent</Text>
      </TouchableOpacity>
    </View>
  );
};

export default OneVsOneSetup;