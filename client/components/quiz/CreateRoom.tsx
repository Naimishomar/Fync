import React, { useState } from "react";
import {View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, StatusBar, Clipboard, Platform} from 'react-native'
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Question } from "../../App";
import axios from "../../context/axiosConfig";
import { Alert } from '../ui/AlertModal';

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
        "Room Created",
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
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />

      <SafeAreaView className="flex-1">

        {/* Header with Back Button */}
        <View className="flex-row items-center px-gutter pt-8 mb-6">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.9}
            className="w-11 h-11 items-center justify-center rounded-xl"
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <View>
            <Text className="text-ink text-3xl font-display uppercase">
              Room <Text className="text-accent-text">Builder</Text>
            </Text>
            <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Initialize Custom Node</Text>
          </View>
        </View>

        <ScrollView className="px-gutter pb-12" showsVerticalScrollIndicator={false}>

          {/* DOMAIN SELECTION */}
          <View className="flex-row items-center mt-6 mb-4" style={{ gap: 12 }}>
            <Text className="text-ink-3 font-display text-label uppercase">Select Specialization</Text>
            <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8 p-1">
            {DOMAINS.map((d) => (
              <TouchableOpacity
                key={d}
                activeOpacity={0.9}
                onPress={() => setDomain(d)}
                className={`px-6 py-3 mr-4 rounded-card border transition-all ${domain === d ? "bg-card border-brand-500 shadow-hair " : "bg-card border-line shadow-hair" }`}
              >
                <Text className={`font-display uppercase text-sm ${domain === d ? "text-accent-text" : "text-ink-3"}`}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* SETTINGS CARD */}
          <View className="bg-card rounded-sheet p-card-pad border border-line mb-10 shadow-hair">
            <Text className="text-ink-3 font-display text-label mb-6 uppercase">Global Configuration</Text>

            <View className="mb-6">
              <Text className="font-semibold text-base text-ink mb-3">Capacity (Members)</Text>
              <TextInput
                value={maxMembers}
                onChangeText={setMaxMembers}
                keyboardType="numeric"
                placeholderTextColor="#8B857E"
                className="border-[1.5px] border-ink p-5 bg-card text-ink font-display rounded-md"
              />
            </View>

            <View className="mb-6">
              <Text className="font-semibold text-base text-ink mb-3">Duration (Minutes)</Text>
              <TextInput
                value={duration}
                onChangeText={setDuration}
                keyboardType="numeric"
                placeholderTextColor="#8B857E"
                className="border-[1.5px] border-ink p-5 bg-card text-ink font-display rounded-md"
              />
            </View>

            {/* DATE PICKER BUTTON */}
            <View>
              <Text className="font-semibold text-base text-ink mb-3">Execution Time</Text>
              <TouchableOpacity
                onPress={handleDatePress}
                activeOpacity={0.9}
                className="bg-paper-2 p-5 rounded-card border border-line flex-row items-center justify-between"
              >
                <Text className="text-ink font-display text-base">
                  {startTime.toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
                <Ionicons name="stopwatch" size={20} color="#F97316" />
              </TouchableOpacity>
            </View>

            {/* iOS ONLY PICKER */}
            {Platform.OS === 'ios' && showIOSPicker && (
              <View className="bg-card rounded-card mt-4 p-4 border border-line shadow-hair">
                <View className="flex-row justify-end border-b border-line pb-3 mb-3">
                  <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                    <Text className="text-accent-text font-display text-base px-4 uppercase">Sync</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={startTime}
                  minimumDate={new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={onIOSChange}
                  textColor="#12100E"
                  themeVariant="light"
                />
              </View>
            )}
          </View>

          {/* QUESTIONS EDITOR */}
          <View className="flex-row justify-between items-center mb-6 px-1">
            <Text className="text-ink-3 font-display text-label uppercase">Core Dataset ({questions.length})</Text>
            <TouchableOpacity onPress={addQuestion} className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
              <Text className="text-accent-text font-display text-label uppercase">+ Add Question</Text>
            </TouchableOpacity>
          </View>

          {questions.map((q, qIndex) => (
            <View key={qIndex} className="bg-card border border-line rounded-sheet p-card-pad mb-8 shadow-hair">
              <View className="flex-row justify-between items-center mb-6">
                <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                  <Text className="font-display text-ink text-label uppercase">Question {qIndex + 1}</Text>
                </View>
                {questions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => setQuestions(questions.filter((_, i) => i !== qIndex))}
                    className="w-10 h-10 bg-paper-2 rounded-xl items-center justify-center border border-line"
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                placeholder="Initialize primary prompt..."
                placeholderTextColor="#8B857E"
                value={q.question}
                onChangeText={(t) => updateQuestion(qIndex, "question", t)}
                className="border border-line p-6 rounded-card mb-6 bg-paper-2 text-ink font-display text-base min-h-[100px]"
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
                    className={`w-6 h-6 mr-4 rounded-full border-2 items-center justify-center transition-all ${q.correctAnswer === i ? "bg-brand-500 border-brand-500 shadow-hair " : "border-line bg-card" }`}
                  >
                    {q.correctAnswer === i && <Ionicons name="checkmark" size={14} color="#12100E" />}
                  </View>

                  <TextInput
                    value={opt}
                    placeholder={`Buffer Option ${i + 1}`}
                    placeholderTextColor="#8B857E"
                    onChangeText={(text) => updateOption(qIndex, i, text)}
                    className={`border p-5 rounded-card flex-1 font-display uppercase text-sm ${q.correctAnswer === i ? "bg-card border-brand-500 text-ink shadow-hair " : "bg-card border-line text-ink-3" }`}
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
            className={`py-6 rounded-sheet mb-16 shadow-hair flex-row justify-center items-center ${loading ? 'bg-brand-400' : 'bg-brand-500 ' }`}
          >
            {loading ? (
              <ActivityIndicator color="#12100E" />
            ) : (
              <>
                <Text className="font-display text-ink uppercase mr-2" style={{ fontSize: 14, letterSpacing: 0.3 }}>Finalize Node</Text>
                <Ionicons name="rocket" size={20} color="#12100E" />
              </>
            )}
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export default CreateRoom;
