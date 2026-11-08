import React, { useState } from "react";
import { View, Text, TextInput, ScrollView, Pressable, StatusBar, Platform, KeyboardAvoidingView } from 'react-native';
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList, Question } from "../../App";
import axios from "../../context/axiosConfig";
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button, Card, FilterChips, FormField, IconBtn, Label, SectionHeader } from '../ui/kit';

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
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, [key]: value } : q)));
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => (
      i === qIndex ? { ...q, options: q.options.map((o, j) => (j === optIndex ? value : o)) } : q
    )));
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
              Clipboard.setStringAsync(String(newRoomId)).catch(() => {});
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
      <StatusBar barStyle={C.barStyle} />

      <SafeAreaView className="flex-1" edges={['bottom']}>

        <AppBar title="Create room" onBack={() => navigation.goBack()} />

        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView className="px-gutter" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Domain */}
          <SectionHeader title="Domain" style={{ marginTop: 8 }} />
          <FilterChips items={DOMAINS} value={domain} onChange={setDomain} style={{ marginHorizontal: -20 }} />

          {/* Settings */}
          <SectionHeader title="Settings" />
          <Card padded style={{ gap: 16 }}>
            <FormField
              label="Capacity (members)"
              value={maxMembers}
              onChangeText={setMaxMembers}
              keyboardType="numeric"
            />
            <FormField
              label="Duration (minutes)"
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
            />

            <View style={{ gap: 6 }}>
              <Text className="font-semibold text-sm text-ink-2">Start time</Text>
              <Pressable
                onPress={handleDatePress}
                className="bg-card px-4 rounded-2xl border border-line flex-row items-center justify-between active:opacity-70"
                style={{ minHeight: 48 }}
                accessibilityRole="button"
                accessibilityLabel="Change start time"
              >
                <Text className="text-ink font-sans text-base">
                  {startTime.toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}
                </Text>
                <Ionicons name="time-outline" size={20} color={C.ink2} />
              </Pressable>
            </View>

            {/* iOS only picker */}
            {Platform.OS === 'ios' && showIOSPicker && (
              <View className="bg-paper-2 rounded-2xl p-4">
                <View className="flex-row justify-end mb-2">
                  <Button title="Done" small onPress={() => setShowIOSPicker(false)} />
                </View>
                <DateTimePicker
                  value={startTime}
                  minimumDate={new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={onIOSChange}
                  textColor={C.ink}
                  themeVariant={C.scheme === "dark" ? "dark" : "light"}
                />
              </View>
            )}
          </Card>

          {/* Questions */}
          <SectionHeader title="Questions" count={questions.length} right={<Button title="Add question" icon="add" small onPress={addQuestion} />} />

          {questions.map((q, qIndex) => (
            <Card key={qIndex} padded style={{ marginBottom: 12 }}>
              <View className="flex-row justify-between items-center mb-3">
                <Text className="font-semibold text-ink text-sm">Question {qIndex + 1}</Text>
                {questions.length > 1 && (
                  <IconBtn
                    name="trash-outline"
                    size={18}
                    color={C.danger}
                    boxed
                    onPress={() => setQuestions((prev) => prev.filter((_, i) => i !== qIndex))}
                    accessibilityLabel={`Delete question ${qIndex + 1}`}
                  />
                )}
              </View>

              <FormField
                placeholder="Type the question"
                value={q.question}
                onChangeText={(t) => updateQuestion(qIndex, "question", t)}
                accessibilityLabel={`Question ${qIndex + 1}`}
                multiline
                containerStyle={{ marginBottom: 16 }}
              />

              <Label style={{ marginBottom: 8 }}>Options — tap the circle to mark the correct answer</Label>
              {q.options.map((opt, i) => {
                const correct = q.correctAnswer === i;
                return (
                  <View key={i} className="flex-row items-center mb-3">
                    <Pressable
                      onPress={() => updateQuestion(qIndex, "correctAnswer", i)}
                      hitSlop={10}
                      className={`w-6 h-6 mr-3 rounded-full border items-center justify-center active:opacity-70 ${correct ? "bg-brand-500 border-brand-500" : "border-line bg-card"}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: correct }}
                      accessibilityLabel={`Mark option ${i + 1} correct`}
                    >
                      {correct && <Ionicons name="checkmark" size={14} color={C.onBrand} />}
                    </Pressable>
                    <TextInput
                      value={opt}
                      placeholder={`Option ${i + 1}`}
                      placeholderTextColor={C.ink3}
                      onChangeText={(text) => updateOption(qIndex, i, text)}
                      accessibilityLabel={`Option ${i + 1}${correct ? ', correct answer' : ''}`}
                      className={`border px-4 rounded-2xl flex-1 font-sans text-base text-ink bg-card ${correct ? "border-brand-500" : "border-line"}`}
                      style={{ minHeight: 48 }}
                    />
                  </View>
                );
              })}
            </Card>
          ))}

          <Button title="Create room" icon="checkmark" variant="primary" block loading={loading} onPress={submitRoom} style={{ marginTop: 12, marginBottom: 32 }} />

        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
};

export default CreateRoom;
