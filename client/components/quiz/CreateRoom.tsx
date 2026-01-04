import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Clipboard,
  Platform, // Import Platform
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
// Import DateTimePickerAndroid for Android support
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
  
  // Only used for iOS to show/hide the modal
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

  /* --- DATE TIME PICKER HANDLER (FIXED) --- */
  
  const handleDatePress = () => {
    if (Platform.OS === 'android') {
      showAndroidDatePicker();
    } else {
      setShowIOSPicker(true);
    }
  };

  const showAndroidDatePicker = () => {
    // 1. Open Date Picker
    DateTimePickerAndroid.open({
      value: startTime,
      onChange: (event, date) => {
        if (event.type === 'set' && date) {
          // 2. Once Date is picked, Open Time Picker
          showAndroidTimePicker(date);
        }
      },
      mode: 'date',
    });
  };

  const showAndroidTimePicker = (selectedDate: Date) => {
    DateTimePickerAndroid.open({
      value: selectedDate, // Start with the date we just picked
      onChange: (event, time) => {
        if (event.type === 'set' && time) {
          // 3. Combine Date and Time
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
    // On iOS we can just close it or keep it open. 
    // Usually, we keep it open and let user click "Done" or click outside, 
    // but here we just update state live.
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
        "Room Created Successfully! 🎉",
        `Here is your Room ID: ${newRoomId}\n\nShare this code with participants.`,
        [
          {
            text: "Copy & Exit",
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
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="px-4 pb-10" showsVerticalScrollIndicator={false}>
        <Text className="text-2xl font-bold mt-4 mb-4 text-gray-800">Design Quiz Room</Text>

        {/* DOMAIN SELECTION */}
        <Text className="font-semibold mb-2 text-gray-600">Select Domain</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {DOMAINS.map((d) => (
            <Pressable
              key={d}
              onPress={() => setDomain(d)}
              className={`px-4 py-2 mr-2 rounded-full ${
                domain === d ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <Text className={`${domain === d ? "text-white" : "text-gray-800"}`}>
                {d}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* SETTINGS */}
        <View className="space-y-4">
          <View>
            <Text className="font-semibold text-gray-600">Max Members</Text>
            <TextInput
              value={maxMembers}
              onChangeText={setMaxMembers}
              keyboardType="numeric"
              className="border border-gray-300 p-3 rounded-lg mt-1 bg-gray-50 text-black"
            />
          </View>

          <View>
            <Text className="font-semibold text-gray-600">Duration (minutes)</Text>
            <TextInput
              value={duration}
              onChangeText={setDuration}
              keyboardType="numeric"
              className="border border-gray-300 p-3 rounded-lg mt-1 bg-gray-50 text-black"
            />
          </View>

          {/* DATE PICKER BUTTON */}
          <View>
             <Text className="font-semibold text-gray-600 mb-1">Start Time</Text>
             <Pressable
                onPress={handleDatePress}
                className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex-row items-center justify-between"
             >
                <Text className="text-blue-800 font-semibold text-lg">
                  {startTime.toLocaleString([], { 
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                  })}
                </Text>
                <Ionicons name="calendar" size={20} color="#1e40af" />
             </Pressable>
          </View>

          {/* iOS ONLY PICKER */}
          {Platform.OS === 'ios' && showIOSPicker && (
             <View className="bg-gray-100 rounded-xl mt-2 p-2">
                <View className="flex-row justify-end border-b border-gray-300 pb-2 mb-2">
                   <Pressable onPress={() => setShowIOSPicker(false)}>
                      <Text className="text-blue-600 font-bold text-lg px-4">Done</Text>
                   </Pressable>
                </View>
                <DateTimePicker
                  value={startTime}
                  minimumDate={new Date()}
                  mode="datetime"
                  display="spinner"
                  onChange={onIOSChange}
                  textColor="black"
                />
             </View>
          )}
        </View>

        {/* QUESTIONS EDITOR */}
        <Text className="text-xl font-bold mt-8 mb-4 text-gray-800">Questions</Text>

        {questions.map((q, qIndex) => (
          <View key={qIndex} className="border border-gray-200 rounded-xl p-4 mb-6 shadow-sm bg-gray-50">
            <Text className="font-semibold mb-2 text-lg">Question {qIndex + 1}</Text>

            <TextInput
              placeholder="Enter your question here..."
              value={q.question}
              onChangeText={(t) => updateQuestion(qIndex, "question", t)}
              className="border border-gray-300 p-3 rounded-lg mb-4 bg-white text-black"
              multiline
            />

            {q.options.map((opt, i) => (
              <Pressable
                key={i}
                onPress={() => updateQuestion(qIndex, "correctAnswer", i)}
                className="flex-row items-center mb-3"
              >
                <View
                  className={`w-6 h-6 mr-3 rounded-full border-2 items-center justify-center ${
                    q.correctAnswer === i ? "bg-blue-600 border-blue-600" : "border-gray-400 bg-white"
                  }`}
                >
                    {q.correctAnswer === i && <View className="w-2.5 h-2.5 bg-white rounded-full" />}
                </View>

                <TextInput
                  value={opt}
                  placeholder={`Option ${i + 1}`}
                  onChangeText={(text) => updateOption(qIndex, i, text)}
                  className={`border p-3 rounded-lg flex-1 bg-white text-black ${
                      q.correctAnswer === i ? "border-blue-500 bg-blue-50" : "border-gray-300"
                  }`}
                />
              </Pressable>
            ))}
          </View>
        ))}

        <Pressable
          onPress={addQuestion}
          className="flex-row items-center justify-center gap-2 py-4 border-2 border-dashed border-gray-300 rounded-xl mb-8 bg-gray-50"
        >
          <Ionicons name="add-circle" size={24} color="#4b5563" />
          <Text className="font-bold text-gray-600 text-lg">Add Question</Text>
        </Pressable>

        <Pressable
          onPress={submitRoom}
          disabled={loading}
          className={`py-4 rounded-xl mb-12 shadow-md ${loading ? 'bg-blue-400' : 'bg-blue-600'}`}
        >
          <Text className="text-white text-center font-bold text-lg">
            {loading ? "Creating..." : "Save & Create Room"}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default CreateRoom;