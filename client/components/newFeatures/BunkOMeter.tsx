import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  Keyboard, 
  Image, 
  ScrollView,
  KeyboardAvoidingView,
  Platform 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- 🌌 BACKGROUND IMAGE ---
const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

export default function BunkOMeter() {
  const [attended, setAttended] = useState('');
  const [total, setTotal] = useState('');
  const [targetInput, setTargetInput] = useState(''); 
  const [result, setResult] = useState<any>(null);

  const calculateAttendance = () => {
    Keyboard.dismiss();
    const present = parseInt(attended);
    const held = parseInt(total);
    const target = parseFloat(targetInput) || 75; 

    if (isNaN(present) || isNaN(held) || held === 0) {
      Alert.alert("Invalid Input", "Please enter valid class numbers.");
      return;
    }
    if (present > held) {
      Alert.alert("Math Error", "You can't attend more classes than held!");
      return;
    }
    if (target <= 0 || target > 100) {
        Alert.alert("Invalid Target", "Target percentage must be between 1 and 100.");
        return;
    }

    const currentPercentage = (present / held) * 100;

    let analysis = {
      percentage: currentPercentage.toFixed(2),
      status: '', 
      message: '',
      color: '',
      detail: '',
      icon: '' as keyof typeof Ionicons.glyphMap
    };

    if (currentPercentage >= target) {
      // --- SAFE ZONE ---
      const maxTotal = present / (target / 100);
      const canBunk = Math.floor(maxTotal - held);

      analysis.status = 'SAFE';
      analysis.color = '#4ade80'; // Green
      analysis.icon = 'checkmark-circle';
      if (canBunk > 0) {
        analysis.message = `Safe to Bunk ${canBunk} Classes!`;
        analysis.detail = `You can skip the next ${canBunk} lectures and still stay above ${target}%.`;
      } else {
        analysis.message = `On the Edge!`;
        analysis.detail = `You are safe, but you cannot afford to miss the next class.`;
      }
    } else {
      // --- DANGER ZONE ---
      const decimalTarget = target / 100;
      
      if (decimalTarget >= 1) {
         analysis.status = 'DANGER';
         analysis.color = '#ef4444';
         analysis.icon = 'alert-circle';
         analysis.message = `Impossible`;
         analysis.detail = `You cannot reach 100% if you have already missed a class.`;
      } else {
         const needed = (decimalTarget * held - present) / (1 - decimalTarget);
         const toAttend = Math.ceil(needed);
    
         analysis.status = 'DANGER';
         analysis.color = '#ef4444'; // Red
         analysis.icon = 'warning';
         analysis.message = `Attend Next ${toAttend} Classes`;
         analysis.detail = `You must attend the next ${toAttend} lectures continuously to reach ${target}%.`;
      }
    }

    setResult(analysis);
  };

  return (
    <View className="flex-1 bg-black">
      {/* 🌸 BACKGROUND 🌸 */}
      <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-50" />
      <LinearGradient 
        colors={['rgba(236, 72, 153, 0.40)', 'rgba(0,0,0,0.85)', '#000000']} 
        className="absolute w-full h-full" 
      />

      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 px-2"
        >
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* Header */}
                <View className="px-6 pt-6 pb-2">
                    <Text className="text-white text-3xl font-black shadow-lg">Bunk-O-<Text className="text-pink-500">Meter</Text> 📉</Text>
                    <Text className="text-gray-300 text-sm mt-1 font-medium">
                        Calculate your attendance fate instantly.
                    </Text>
                </View>

                {/* --- INPUT CARD --- */}
                <View className="bg-[#1e1e1e]/80 mx-5 mt-6 p-6 rounded-3xl border border-white/10 shadow-lg">
                    
                    {/* Row 1: Attended & Total */}
                    <View className="flex-row gap-4 mb-5">
                        <View className="flex-1">
                            <Text className="text-gray-400 mb-2 font-bold text-[10px] uppercase tracking-wider">Attended</Text>
                            <View className="flex-row items-center bg-black/50 border border-white/10 rounded-xl px-3 py-3">
                                <Ionicons name="checkmark-done" size={18} color="#4ade80" />
                                <TextInput
                                    value={attended}
                                    onChangeText={setAttended}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#555"
                                    className="flex-1 text-white text-lg font-bold ml-2 text-center"
                                />
                            </View>
                        </View>

                        <View className="flex-1">
                            <Text className="text-gray-400 mb-2 font-bold text-[10px] uppercase tracking-wider">Total Held</Text>
                            <View className="flex-row items-center bg-black/50 border border-white/10 rounded-xl px-3 py-3">
                                <Ionicons name="list" size={18} color="#60a5fa" />
                                <TextInput
                                    value={total}
                                    onChangeText={setTotal}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#555"
                                    className="flex-1 text-white text-lg font-bold ml-2 text-center"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Row 2: Target */}
                    <View className="mb-6">
                        <Text className="text-gray-400 mb-2 font-bold text-[10px] uppercase tracking-wider">Target Percentage (%)</Text>
                        <View className="flex-row items-center bg-black/50 border border-white/10 rounded-xl px-3 py-3">
                            <Ionicons name="pie-chart-outline" size={18} color="#f472b6" />
                            <TextInput
                                value={targetInput}
                                onChangeText={setTargetInput}
                                keyboardType="numeric"
                                placeholder="75 (Default)"
                                placeholderTextColor="#555"
                                className="flex-1 text-white text-lg font-bold ml-2"
                            />
                        </View>
                    </View>

                    {/* Calculate Button */}
                    <TouchableOpacity onPress={calculateAttendance} activeOpacity={0.8} className='rounded-full'>
                        <LinearGradient
                            colors={['#6366f1', '#a855f7']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            className="py-4 rounded-full items-center shadow-lg shadow-indigo-500/30"
                        >
                            <Text className="text-white font-bold text-base uppercase tracking-widest rounded-full">Predict Fate</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* --- RESULT DISPLAY --- */}
                {result && (
                    <View className="mx-5 mt-6 px-2 rounded-2xl border">
                        <LinearGradient
                            colors={result.status === 'SAFE' 
                                ? ['rgba(6, 78, 59, 0.8)', 'rgba(0,0,0,0.8)'] 
                                : ['rgba(69, 10, 10, 0.8)', 'rgba(0,0,0,0.8)']}
                            className="p-6 rounded-3xl border border-white/10 items-center"
                        >
                            {/* Circular Percentage */}
                            <View className="mb-4 bg-black/40 w-28 h-28 rounded-full items-center justify-center border-4"
                                  style={{ borderColor: result.color }}>
                                <Text className="text-white text-2xl font-black">{result.percentage}%</Text>
                                <Text className="text-gray-400 text-[10px]">Current</Text>
                            </View>

                            {/* Status Text */}
                            <View className="flex-row items-center mb-2">
                                <Ionicons name={result.icon} size={24} color={result.color} className='animate-pulse' />
                                <Text className="text-2xl font-bold ml-2 text-white">
                                    {result.status === 'SAFE' ? 'You are Safe!' : 'Danger Zone!'}
                                </Text>
                            </View>

                            <Text className="text-lg font-semibold text-center mb-2" style={{ color: result.color }}>
                                {result.message}
                            </Text>

                            <Text className="text-gray-300 text-center text-sm px-2 leading-5 opacity-90">
                                {result.detail}
                            </Text>

                            {/* Tip Box */}
                            <View className="mt-6 bg-black/30 p-3 rounded-xl w-full flex-row items-center border border-white/5">
                                <MaterialCommunityIcons 
                                    name="lightbulb-on-outline" 
                                    size={20} 
                                    color="#fbbf24" 
                                />
                                <Text className="text-gray-400 ml-2 text-xs flex-1 italic">
                                    {result.status === 'SAFE' 
                                        ? "Tip: Sleep in tomorrow. The numbers say you can." 
                                        : "Tip: Set 5 alarms. You cannot afford to miss the bus."}
                                </Text>
                            </View>

                        </LinearGradient>
                    </View>
                )}

            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}