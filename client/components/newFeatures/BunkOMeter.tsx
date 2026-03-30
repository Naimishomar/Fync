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
  Platform,
  StatusBar
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
      icon: '' as keyof typeof Ionicons.glyphMap,
      bg: [] as string[]
    };

    if (currentPercentage >= target) {
      // --- SAFE ZONE ---
      const maxTotal = present / (target / 100);
      const canBunk = Math.floor(maxTotal - held);

      analysis.status = 'SAFE';
      analysis.color = '#16a34a'; // Darker green for light theme
      analysis.bg = ['#f0fdf4', '#dcfce7'];
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
         analysis.color = '#dc2626';
         analysis.bg = ['#fef2f2', '#fee2e2'];
         analysis.icon = 'alert-circle';
         analysis.message = `Impossible`;
         analysis.detail = `You cannot reach 100% if you have already missed a class.`;
      } else {
         const needed = (decimalTarget * held - present) / (1 - decimalTarget);
         const toAttend = Math.ceil(needed);
    
         analysis.status = 'DANGER';
         analysis.color = '#dc2626'; // Darker red for light theme
         analysis.bg = ['#fef2f2', '#fee2e2'];
         analysis.icon = 'warning';
         analysis.message = `Attend Next ${toAttend} Classes`;
         analysis.detail = `You must attend the next ${toAttend} lectures continuously to reach ${target}%.`;
      }
    }

    setResult(analysis);
  };

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      
      <SafeAreaView className="flex-1">
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* Header */}
                <View className="px-8 pt-8 pb-4">
                    <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
                            <MaterialCommunityIcons name="calculator" size={24} color="white" />
                        </View>
                        <View>
                            <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter">BUNK<Text className="text-pink-500">-O-</Text>METER</Text>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">Predict Your Attendance Fate</Text>
                        </View>
                    </View>
                </View>

                {/* --- INPUT CARD --- */}
                <View className="bg-white mx-6 mt-6 p-8 rounded-[40px] shadow-lg shadow-black/5">
                    
                    {/* Row 1: Attended & Total */}
                    <View className="flex-row gap-5 mb-6">
                        <View className="flex-1">
                            <Text className="text-slate-400 mb-2 font-black text-[10px] uppercase tracking-widest ml-1">Attended</Text>
                            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1">
                                <Ionicons name="checkmark-done" size={20} color="#16a34a" />
                                <TextInput
                                    value={attended}
                                    onChangeText={setAttended}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    className="flex-1 text-zinc-900 text-xl font-black italic ml-2"
                                />
                            </View>
                        </View>

                        <View className="flex-1">
                            <Text className="text-slate-400 mb-2 font-black text-[10px] uppercase tracking-widest ml-1">Total Held</Text>
                            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1">
                                <Ionicons name="list" size={20} color="#2563eb" />
                                <TextInput
                                    value={total}
                                    onChangeText={setTotal}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    className="flex-1 text-zinc-900 text-xl font-black italic ml-2"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Row 2: Target */}
                    <View className="mb-8">
                        <Text className="text-slate-400 mb-2 font-black text-[10px] uppercase tracking-widest ml-1">Target Percentage (%)</Text>
                        <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-1">
                            <Ionicons name="pie-chart-outline" size={20} color="#ec4899" />
                            <TextInput
                                value={targetInput}
                                onChangeText={setTargetInput}
                                keyboardType="numeric"
                                placeholder="75 (Recommended)"
                                placeholderTextColor="#94a3b8"
                                className="flex-1 text-zinc-900 text-xl font-black italic ml-1"
                            />
                        </View>
                    </View>

                    {/* Calculate Button */}
                    <TouchableOpacity onPress={calculateAttendance} activeOpacity={0.9} className="overflow-hidden rounded-xl bg-pink-500 flex-row items-center justify-center">
                        <Text className="text-white font-black text-base uppercase py-4 shadow-xl shadow-pink-500/20">Predict Fate 📉</Text>
                    </TouchableOpacity>
                </View>

                {/* --- RESULT DISPLAY --- */}
                {result && (
                    <View className="mx-6 mt-8 p-1 rounded-[44px] overflow-hidden shadow-lg shadow-black/5">
                        <View className="p-8 rounded-[40px] items-center" style={{ backgroundColor: result.bg[0] }}>
                            
                            {/* Circular Percentage */}
                            <View className="mb-6 bg-white w-32 h-32 rounded-full items-center justify-center border-[6px]"
                                  style={{ borderColor: result.color }}>
                                <Text className="text-zinc-900 text-2xl font-black italic">{result.percentage}%</Text>
                                <View className="h-[1px] w-12 bg-slate-200 my-1" />
                                <Text className="text-slate-400 font-black uppercase text-[8px] tracking-widest">Score</Text>
                            </View>

                            {/* Status Body */}
                            <View className="items-center">
                                <View className="flex-row items-center gap-2 mb-3 bg-white px-5 py-2 rounded-full border border-slate-100">
                                    <Ionicons name={result.icon} size={20} color={result.color} />
                                    <Text className="text-lg font-black text-zinc-900 uppercase">
                                        {result.status === 'SAFE' ? 'The Great Escape' : 'System Critical'}
                                    </Text>
                                </View>

                                <Text className="text-xl font-black text-center mb-3" style={{ color: result.color }}>
                                    {result.message}
                                </Text>

                                <Text className="text-slate-500 font-bold text-center text-[13px] px-2 leading-5 tracking-tight">
                                    {result.detail}
                                </Text>

                                {/* Tip Box */}
                                <View className="mt-8 bg-white/70 p-4 rounded-2xl w-full flex-row items-center border border-white/50">
                                    <View className="bg-amber-100 p-2 rounded-xl">
                                        <MaterialCommunityIcons 
                                            name="lightbulb-variant" 
                                            size={20} 
                                            color="#d97706" 
                                        />
                                    </View>
                                    <Text className="text-slate-500 ml-3 text-[11px] font-bold flex-1 tracking-tight">
                                        {result.status === 'SAFE' 
                                            ? "Tip: Numbers confirm you're in the safe zone. Enjoy your bunk!" 
                                            : "Tip: Alarm set to maximum. Every lecture from now is critical."}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}

            </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}