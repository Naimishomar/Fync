import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Clipboard,
  Platform,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient"; // Added LinearGradient
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Question } from "../../App";
import axios from "../../context/axiosConfig";

const DOMAINS = ["DSA", "Frontend", "Backend", "Full Stack", "AI", "ML", "DBMS", "OS", "Custom"];

const CreateRoom = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [domain, setDomain] = useState<string>("DSA");
  const [maxMembers, setMaxMembers] = useState<string>("5");
  const [duration, setDuration] = useState<string>("10");
  const [startTime, setStartTime] = useState<Date>(new Date());
  
  const [showIOSPicker, setShowIOSPicker] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0 },
  ]);

  /* --- QUESTION HANDLERS --- */
  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      { question: "", options: ["", "", "", ""], correctAnswer: 0 },
    ]);
  };

  const updateQuestion = (qIndex: number, key: keyof Question, value: any) => {
    const copy = [...questions];
    (copy[qIndex] as any)[key] = value;
    setQuestions(copy);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const copy = [...questions];
    copy[qIndex].options[optIndex] = value;
    setQuestions(copy);
  };

  /* --- DATE TIME PICKER HANDLER --- */
  const handleDatePress = () => {
    if (Platform.OS === 'android') {
      showAndroidDatePicker();
    } else {
      setShowIOSPicker(true);
    }
  };

  const showAndroidDatePicker = () => {
    DateTimePickerAndroid.open({
      value: startTime,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          showAndroidTimePicker(date);
        }
      },
      mode: 'date',
    });
  };

  const showAndroidTimePicker = (selectedDate: Date) => {
    DateTimePickerAndroid.open({
      value: selectedDate,
      onChange: (event, time) => {
        if (event.type === 'set' && time) {
          const finalDate = new Date(selectedDate);
          finalDate.setHours(time.getHours());
          finalDate.setMinutes(time.getMinutes());
          setStartTime(finalDate);
        }
      },
      mode: 'time',
    });
  };

  const onIOSChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (selectedDate) {
      setStartTime(selectedDate);
    }
  };

  /* --- SUBMIT LOGIC --- */
  const submitRoom = async () => {
    try {
      if (!questions[0].question.trim()) {
        Alert.alert("Missing Content", "Please add at least one question.");
        return;
      }
      setLoading(true);

      const res = await axios.post("/quiz/create-room", {
        domain,
        maxMembers: Number(maxMembers),
        startTime,
        duration: Number(duration),
        questions,
      });

      const newRoomId = res.data.roomId;

      Alert.alert(
        "Room Created! 🎉",
        `Room ID: ${newRoomId}\nShare this with participants.`,
        [
          {
            text: "Copy & Enter",
            onPress: () => {
              Clipboard.setString(newRoomId); 
              navigation.replace("LeaderboardScreen", { roomId: newRoomId });
            },
          },
        ]
      );
    } catch (err: any) {
      console.log(err);
      Alert.alert("Error", "Could not create room. Please try again.");
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
        <View className="flex-row items-center px-6 pt-4 mb-4">
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            className="p-2 bg-white/10 rounded-full mr-4 border border-white/10"
          >
            <Ionicons name="chevron-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-3xl font-black italic tracking-tighter">
            ROOM <Text className="text-pink-500">BUILDER</Text> 🛠️
          </Text>
        </View>

        <ScrollView className="px-6 pb-10" showsVerticalScrollIndicator={false}>
          
          {/* DOMAIN SELECTION */}
          <Text className="text-gray-400 font-bold mb-3 text-xs uppercase tracking-wider">Select Domain</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {DOMAINS.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setDomain(d)}
                className={`px-5 py-2.5 mr-3 rounded-full border transition-all ${
                  domain === d 
                    ? "bg-pink-600/20 border-pink-500" 
                    : "bg-[#2a2a2a] border-white/5"
                }`}
              >
                <Text className={`font-bold ${domain === d ? "text-white" : "text-gray-400"}`}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* SETTINGS CARD */}
          <View className="bg-[#1e1e1e]/80 rounded-3xl p-5 border border-white/10 mb-8 shadow-2xl">
            <Text className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Room Configuration</Text>
            
            <View className="mb-4">
              <Text className="text-gray-300 font-semibold mb-2 ml-1">Max Members</Text>
              <TextInput
                value={maxMembers}
                onChangeText={setMaxMembers}
                keyboardType="numeric"
                placeholderTextColor="#666"
                className="border border-white/10 p-4 rounded-xl bg-[#2a2a2a] text-white font-medium"
              />
            </View>

            <View className="mb-4">
              <Text className="text-gray-300 font-semibold mb-2 ml-1">Duration (minutes)</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholderTextColor="#666"
                className="border border-white/10 p-4 rounded-xl bg-[#2a2a2a] text-white font-medium"
              />
            </View>

            {/* DATE PICKER BUTTON */}
            <View>
               <Text className="text-gray-300 font-semibold mb-2 ml-1">Start Time</Text>
               <TouchableOpacity
                  onPress={handleDatePress}
                  className="bg-[#2a2a2a] p-4 rounded-xl border border-white/10 flex-row items-center justify-between"
               >
                  <Text className="text-white font-semibold text-base">
                    {startTime.toLocaleString([], { 
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                    })}
                  </Text>
                  <Ionicons name="calendar" size={20} color="#ec4899" />
               </TouchableOpacity>
            </View>

            {/* iOS ONLY PICKER */}
            {Platform.OS === 'ios' && showIOSPicker && (
               <View className="bg-[#2a2a2a] rounded-xl mt-3 p-2 border border-white/10">
                  <View className="flex-row justify-end border-b border-white/10 pb-2 mb-2">
                     <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                        <Text className="text-pink-500 font-bold text-lg px-4">Done</Text>
                     </TouchableOpacity>
                  </View>
                  <DateTimePicker
                    value={startTime}
                    minimumDate={new Date()}
                    mode="datetime"
                    display="spinner"
                    onChange={onIOSChange}
                    textColor="white" // Force white text for dark mode
                    themeVariant="dark" // Ensures the picker respects dark theme
                  />
               </View>
            )}
          </View>

          {/* QUESTIONS EDITOR */}
          <Text className="text-gray-400 font-bold mb-4 text-xs uppercase tracking-wider">Quiz Questions ({questions.length})</Text>

          {questions.map((q, qIndex) => (
            <View key={qIndex} className="bg-[#1e1e1e]/80 border border-white/10 rounded-3xl p-5 mb-6 shadow-2xl">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="font-bold text-white text-lg">Question {qIndex + 1}</Text>
                {questions.length > 1 && (
                  <TouchableOpacity onPress={() => setQuestions(questions.filter((_, i) => i !== qIndex))}>
                     <Ionicons name="trash" size={20} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                placeholder="Enter your question here..."
                placeholderTextColor="#666"
                value={q.question}
                onChangeText={(t) => updateQuestion(qIndex, "question", t)}
                className="border border-white/10 p-4 rounded-xl mb-4 bg-[#2a2a2a] text-white font-medium min-h-[80px]"
                multiline
                textAlignVertical="top"
              />

              {q.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => updateQuestion(qIndex, "correctAnswer", i)}
                  activeOpacity={0.8}
                  className="flex-row items-center mb-3"
                >
                  <View
                    className={`w-6 h-6 mr-3 rounded-full border-2 items-center justify-center ${
                      q.correctAnswer === i ? "bg-pink-500/20 border-pink-500" : "border-gray-500 bg-[#2a2a2a]"
                    }`}
                  >
                      {q.correctAnswer === i && <View className="w-2.5 h-2.5 bg-pink-500 rounded-full" />}
                  </View>

                  <TextInput
                    value={opt}
                    placeholder={`Option ${i + 1}`}
                    placeholderTextColor="#666"
                    onChangeText={(text) => updateOption(qIndex, i, text)}
                    className={`border p-3.5 rounded-xl flex-1 bg-[#2a2a2a] text-white font-medium ${
                        q.correctAnswer === i ? "border-pink-500/50" : "border-white/5"
                    }`}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* ADD QUESTION BUTTON */}
          <TouchableOpacity
            onPress={addQuestion}
            className="flex-row items-center justify-center gap-2 py-4 border-2 border-dashed border-white/20 rounded-2xl mb-8 bg-[#1e1e1e]/50"
          >
            <Ionicons name="add-circle" size={24} color="#ec4899" />
            <Text className="font-bold text-gray-300 text-lg">Add Next Question</Text>
          </TouchableOpacity>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            onPress={submitRoom}
            disabled={loading}
            className={`py-5 rounded-2xl mb-12 shadow-lg flex-row justify-center items-center ${
              loading ? 'bg-pink-600/50 border-pink-500/30' : 'bg-pink-600 border-pink-500/50'
            } border`}
          >
            {loading ? (
               <ActivityIndicator color="white" />
            ) : (
               <>
                 <Text className="text-white text-center font-black text-xl mr-2 tracking-widest">CREATE ROOM</Text>
                 <Ionicons name="rocket" size={20} color="white" />
               </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default CreateRoom;