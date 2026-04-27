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
      analysis.color = '#f97316'; // Platform Orange
      analysis.bg = ['#fff7ed', '#ffedd5'];
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
         analysis.bg = ['#fef2f2', '#fee2e2'];
         analysis.icon = 'alert-circle';
         analysis.message = `Impossible`;
         analysis.detail = `You cannot reach 100% if you have already missed a class.`;
      } else {
         const needed = (decimalTarget * held - present) / (1 - decimalTarget);
         const toAttend = Math.ceil(needed);
    
         analysis.status = 'DANGER';
         analysis.color = '#ef4444'; 
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
      
      {/* HEADER DECORATION */}
      <View className="absolute top-0 w-full h-80 opacity-20">
        <LinearGradient 
          colors={['#f97316', 'transparent']} 
          className="w-full h-full"
        />
      </View>

      <SafeAreaView className="flex-1" edges={['top']}>
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                
                {/* Arena Header */}
                <View className="px-8 pt-2">
                    <View className="flex-row items-center justify-between mb-6">
                        <View className="flex-1">
                            <View className="flex-row items-center">
                                <Text className="text-zinc-900 text-3xl font-black tracking-tighter leading-tight">
                                    BunkO<Text className="text-orange-500">Meter</Text>
                                </Text>
                            </View>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">Attendance Prediction Engine</Text>
                        </View>
                    </View>
                </View>

                {/* --- INPUT CARD (Arena Style) --- */}
                <View className="bg-white mx-8 mt-4 p-8 rounded-xl border border-slate-100 shadow-xl shadow-black/5">
                    
                    {/* Row 1: Attended & Total */}
                    <View className="flex-row gap-5 mb-6">
                        <View className="flex-1">
                            <Text className="text-slate-400 mb-2 font-black text-[9px] uppercase tracking-widest ml-1">Attended</Text>
                            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-xl px-4 h-14">
                                <Ionicons name="checkmark-done" size={18} color="#f97316" />
                                <TextInput
                                    value={attended}
                                    onChangeText={setAttended}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    className="flex-1 text-zinc-900 text-lg font-black italic ml-3 uppercase tracking-tighter"
                                />
                            </View>
                        </View>

                        <View className="flex-1">
                            <Text className="text-slate-400 mb-2 font-black text-[9px] uppercase tracking-widest ml-1">Total Held</Text>
                            <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-xl px-4 h-14">
                                <Ionicons name="list" size={18} color="#94a3b8" />
                                <TextInput
                                    value={total}
                                    onChangeText={setTotal}
                                    keyboardType="numeric"
                                    placeholder="0"
                                    placeholderTextColor="#94a3b8"
                                    className="flex-1 text-zinc-900 text-lg font-black italic ml-3 uppercase tracking-tighter"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Row 2: Target */}
                    <View className="mb-8">
                        <Text className="text-slate-400 mb-2 font-black text-[9px] uppercase tracking-widest ml-1">Target Percentage (%)</Text>
                        <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-xl px-4 h-14">
                            <Ionicons name="flash" size={18} color="#f97316" />
                            <TextInput
                                value={targetInput}
                                onChangeText={setTargetInput}
                                keyboardType="numeric"
                                placeholder="75 (Threshold)"
                                placeholderTextColor="#94a3b8"
                                className="flex-1 text-zinc-900 text-lg font-black italic ml-3 uppercase tracking-tighter"
                            />
                        </View>
                    </View>

                    {/* Execute Button */}
                    <TouchableOpacity 
                        onPress={calculateAttendance} 
                        activeOpacity={0.9} 
                        className="bg-zinc-900 h-16 rounded-xl flex-row items-center justify-center shadow-xl shadow-black/20"
                    >
                        <Text className="text-white font-black italic uppercase tracking-widest text-[11px]">Execute Analysis 📉</Text>
                    </TouchableOpacity>
                </View>

                {/* --- RESULT DISPLAY (Arena Style) --- */}
                {result && (
                    <View className="mx-8 mt-8 rounded-[36px] overflow-hidden border border-orange-100 shadow-xl shadow-orange-500/10 bg-white">
                        <LinearGradient
                            colors={['#fff7ed', '#ffffff']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            className="p-8 items-center"
                        >
                            <Text className="text-orange-500 font-black uppercase text-[10px] tracking-[2px] mb-8">Attendance Score</Text>

                            {/* Circular Percentage */}
                            <View className="mb-8 w-40 h-40 rounded-full items-center justify-center border-[2px] border-orange-100 bg-white shadow-xl shadow-orange-500/5">
                                <View className="w-32 h-32 rounded-full bg-white items-center justify-center shadow-inner border border-slate-50">
                                    <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter">{result.percentage}%</Text>
                                    <View className="h-[2px] w-8 rounded-full bg-orange-500 my-1" />
                                    <Text className="text-slate-400 font-black uppercase text-[8px] tracking-widest">Protocol</Text>
                                </View>
                            </View>

                            {/* Status Body */}
                            <View className="items-center w-full">
                                <View className="flex-row items-center gap-3 mb-6 bg-white px-6 py-3 rounded-2xl border border-orange-100 shadow-sm shadow-orange-500/5">
                                    <Ionicons name={result.icon} size={20} color={result.color} />
                                    <Text className="text-xs font-black text-zinc-900 uppercase tracking-widest">
                                        {result.status === 'SAFE' ? 'The Great Escape' : 'System Critical'}
                                    </Text>
                                </View>

                                <Text className="text-2xl font-black text-center mb-4 tracking-tighter leading-tight" style={{ color: result.color }}>
                                    {result.message}
                                </Text>

                                <View className="bg-white/60 p-3 rounded-xl border border-orange-50 border-2 border-dashed w-full mb-8">
                                    <Text className="text-slate-500 font-bold text-center text-[12px] leading-5 tracking-tight">
                                        {result.detail}
                                    </Text>
                                </View>

                                {/* Technical Advisory Box */}
                                <View className="bg-orange-500/10 p-5 rounded-[24px] w-full flex-row items-center border border-orange-500/20">
                                    <View className="bg-white p-2.5 rounded-xl border border-orange-100">
                                        <Ionicons 
                                            name="flash" 
                                            size={18} 
                                            color="#f97316" 
                                        />
                                    </View>
                                    <View className="ml-4 flex-1">
                                        <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">Technical Advisory</Text>
                                        <Text className="text-slate-500 text-[10px] font-bold leading-4 mt-0.5">
                                            {result.status === 'SAFE' 
                                                ? "Bunk protocols confirmed safe. Maintain current trajectory." 
                                                : "System failure imminent. Immediate lecture attendance required."}
                                        </Text>
                                    </View>
                                </View>
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