import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Clipboard,
  Platform
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
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header with Back Button */}
        <View className="flex-row items-center px-8 pt-8 mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
            className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm shadow-black/5 mr-4"
          >
            <Ionicons name="arrow-back" size={24} color="#18181b" />
          </TouchableOpacity>
          <View>
            <Text className="text-slate-900 text-3xl font-black  tracking-tighter uppercase">
              Room <Text className="text-pink-500">Builder</Text>
            </Text>
            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">Initialize Custom Node</Text>
          </View>
        </View>

        <ScrollView className="px-8 pb-12" showsVerticalScrollIndicator={false}>

          {/* DOMAIN SELECTION */}
          <Text className="text-slate-500 font-black  text-2xs mb-4 uppercase tracking-wide">Select Specialization</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 p-1">
            {DOMAINS.map((d) => (
              <TouchableOpacity
                key={d}
                activeOpacity={0.9}
                onPress={() => setDomain(d)}
                className={`px-6 py-3 mr-4 rounded-2xl border transition-all ${domain === d
                    ? "bg-white border-pink-500 shadow-lg shadow-pink-500/10"
                    : "bg-white border-slate-100 shadow-sm"
                  }`}
              >
                <Text className={`font-black  uppercase text-xs tracking-tight ${domain === d ? "text-pink-500" : "text-slate-500"}`}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* SETTINGS CARD */}
          <View className="bg-white rounded-5xl p-8 border border-slate-100 mb-10 shadow-2xl shadow-black/5">
            <Text className="text-slate-500 font-black  text-2xs mb-6 uppercase tracking-wide">Global Configuration</Text>

            <View className="mb-6">
              <Text className="text-slate-900 font-black  text-xs mb-3 uppercase tracking-tight">Capacity (Members)</Text>
              <TextInput
                value={maxMembers}
                onChangeText={setMaxMembers}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                className="border border-slate-100 p-5 rounded-3xl bg-slate-50 text-slate-900 font-black "
              />
            </View>

            <View className="mb-6">
              <Text className="text-slate-900 font-black  text-xs mb-3 uppercase tracking-tight">Duration (Minutes)</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
                className="border border-slate-100 p-5 rounded-3xl bg-slate-50 text-slate-900 font-black "
              />
            </View>

            {/* DATE PICKER BUTTON */}
            <View>
              <Text className="text-slate-900 font-black  text-xs mb-3 uppercase tracking-tight">Execution Time</Text>
              <TouchableOpacity
                onPress={handleDatePress}
                activeOpacity={0.9}
                className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex-row items-center justify-between"
              >
                <Text className="text-slate-900 font-black  text-base">
                  {startTime.toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
                <Ionicons name="stopwatch" size={20} color="#ec4899" />
              </TouchableOpacity>
            </View>

            {/* iOS ONLY PICKER */}
            {Platform.OS === 'ios' && showIOSPicker && (
              <View className="bg-white rounded-3xl mt-4 p-4 border border-slate-100 shadow-xl">
                <View className="flex-row justify-end border-b border-slate-50 pb-3 mb-3">
                  <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                    <Text className="text-pink-500 font-black  text-base px-4 uppercase">Sync</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={startTime}
                  minimumDate={new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={onIOSChange}
                  textColor="#18181b"
                  themeVariant="light"
                />
              </View>
            )}
          </View>

          {/* QUESTIONS EDITOR */}
          <View className="flex-row justify-between items-center mb-6 px-1">
            <Text className="text-slate-500 font-black  text-2xs uppercase tracking-wide">Core Dataset ({questions.length})</Text>
            <TouchableOpacity onPress={addQuestion} className="bg-pink-50 px-4 py-2 rounded-xl border border-pink-100">
              <Text className="text-pink-500 font-black  text-2xs uppercase tracking-tighter">+ Add Question</Text>
            </TouchableOpacity>
          </View>

          {questions.map((q, qIndex) => (
            <View key={qIndex} className="bg-white border border-slate-100 rounded-5xl p-8 mb-8 shadow-2xl shadow-black/5">
              <View className="flex-row justify-between items-center mb-6">
                <View className="bg-slate-50 border border-slate-100 px-4 py-1.5 rounded-full">
                  <Text className="font-black  text-slate-900 text-2xs uppercase tracking-wide">Question {qIndex + 1}</Text>
                </View>
                {questions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setQuestions(questions.filter((_, i) => i !== qIndex))}
                    className="w-10 h-10 bg-slate-50 rounded-xl items-center justify-center border border-slate-100"
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                placeholder="Initialize primary prompt..."
                placeholderTextColor="#94a3b8"
                value={q.question}
                onChangeText={(t) => updateQuestion(qIndex, "question", t)}
                className="border border-slate-100 p-6 rounded-3xl mb-6 bg-slate-50 text-slate-900 font-black  text-base min-h-[100px]"
                multiline
                textAlignVertical="top"
              />

              {q.options.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => updateQuestion(qIndex, "correctAnswer", i)}
                  activeOpacity={0.9}
                  className="flex-row items-center mb-4"
                >
                  <View
                    className={`w-6 h-6 mr-4 rounded-full border-2 items-center justify-center transition-all ${q.correctAnswer === i ? "bg-pink-500 border-pink-500 shadow-sm shadow-pink-500/50" : "border-slate-300 bg-white"
                      }`}
                  >
                    {q.correctAnswer === i && <Ionicons name="checkmark" size={14} color="white" />}
                  </View>

                  <TextInput
                    value={opt}
                    placeholder={`Buffer Option ${i + 1}`}
                    placeholderTextColor="#94a3b8"
                    onChangeText={(text) => updateOption(qIndex, i, text)}
                    className={`border p-5 rounded-2xl flex-1 font-black  uppercase tracking-tight text-sm ${q.correctAnswer === i ? "bg-white border-pink-500 text-slate-900 shadow-lg shadow-pink-500/5" : "bg-white border-slate-100 text-slate-500"
                      }`}
                  />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            onPress={submitRoom}
            disabled={loading}
            activeOpacity={0.9}
            className={`py-6 rounded-4xl mb-16 shadow-2xl flex-row justify-center items-center ${loading ? 'bg-pink-400' : 'bg-pink-500 shadow-pink-500/20'
              }`}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text className="text-white text-center font-black  text-lg mr-3 tracking-[3px] uppercase">Finalize Node</Text>
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
