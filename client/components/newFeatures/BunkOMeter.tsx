import React, { useState } from 'react';
import {View, Text, TextInput, TouchableOpacity, Keyboard, Image, ScrollView, KeyboardAvoidingView, Platform, StatusBar} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert } from '../ui/AlertModal';

import { StampCard } from '../ui/kit';
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
            analysis.color = '#F97316'; // Platform Orange
            analysis.bg = ['#EDE8E0', '#EDE8E0'];
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
                analysis.color = '#DC2626';
                analysis.bg = ['#EDE8E0', '#EDE8E0'];
                analysis.icon = 'alert-circle';
                analysis.message = `Impossible`;
                analysis.detail = `You cannot reach 100% if you have already missed a class.`;
            } else {
                const needed = (decimalTarget * held - present) / (1 - decimalTarget);
                const toAttend = Math.ceil(needed);

                analysis.status = 'DANGER';
                analysis.color = '#DC2626';
                analysis.bg = ['#EDE8E0', '#EDE8E0'];
                analysis.icon = 'warning';
                analysis.message = `Attend Next ${toAttend} Classes`;
                analysis.detail = `You must attend the next ${toAttend} lectures continuously to reach ${target}%.`;
            }
        }

        setResult(analysis);
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            {/* HEADER DECORATION */}

            <SafeAreaView className="flex-1" edges={['top']}>
                <KeyboardAvoidingView
                    behavior="padding"
                    className="flex-1"
                >
                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                        {/* Arena Header */}
                        <View className="px-gutter pt-2">
                            <View className="flex-row items-center justify-between mb-6">
                                <View className="flex-1">
                                    <View className="flex-row items-center">
                                        <Text className="text-ink text-3xl font-display leading-tight">
                                            BunkO<Text className="text-accent-text">Meter</Text>
                                        </Text>
                                    </View>
                                    <Text className="text-ink-3 text-label font-display uppercase">Attendance Prediction Engine</Text>
                                </View>
                            </View>
                        </View>

                        {/* --- INPUT CARD (Arena Style) --- */}
                        <View className="bg-card mx-gutter mt-4 p-card-pad rounded-xl border border-line shadow-hair">

                            {/* Row 1: Attended & Total */}
                            <View className="flex-row gap-5 mb-6">
                                <View className="flex-1">
                                    <Text className="text-ink-3 mb-2 font-display text-label uppercase ml-1">Attended</Text>
                                    <View className="flex-row items-center bg-paper-2 border-2 border-ink px-4 h-14 rounded-md">
                                        <Ionicons name="checkmark-done" size={18} color="#F97316" />
                                        <TextInput
                                            value={attended}
                                            onChangeText={setAttended}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#8B857E"
                                            className="flex-1 text-ink text-lg font-display ml-3 uppercase"
                                        />
                                    </View>
                                </View>

                                <View className="flex-1">
                                    <Text className="text-ink-3 mb-2 font-display text-label uppercase ml-1">Total Held</Text>
                                    <View className="flex-row items-center bg-paper-2 border-2 border-ink px-4 h-14 rounded-md">
                                        <Ionicons name="list" size={18} color="#8B857E" />
                                        <TextInput
                                            value={total}
                                            onChangeText={setTotal}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor="#8B857E"
                                            className="flex-1 text-ink text-lg font-display ml-3 uppercase"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Row 2: Target */}
                            <View className="mb-8">
                                <Text className="text-ink-3 mb-2 font-display text-label uppercase ml-1">Target Percentage (%)</Text>
                                <View className="flex-row items-center bg-paper-2 border-2 border-ink px-4 h-14 rounded-md">
                                    <Ionicons name="flash" size={18} color="#F97316" />
                                    <TextInput
                                        value={targetInput}
                                        onChangeText={setTargetInput}
                                        keyboardType="numeric"
                                        placeholder="75 (Threshold)"
                                        placeholderTextColor="#8B857E"
                                        className="flex-1 text-ink text-lg font-display ml-3 uppercase"
                                    />
                                </View>
                            </View>

                            {/* Execute Button */}
                            <TouchableOpacity
                                onPress={calculateAttendance}
                                activeOpacity={0.9}
                                className="bg-ink h-16 flex-row items-center justify-center border-2 border-ink rounded-md"
                            >
                                <Text className="text-white font-display uppercase text-label">Execute Analysis</Text>
                            </TouchableOpacity>
                        </View>

                        {/* --- RESULT DISPLAY (Arena Style) --- */}
                        {result && (
                            <StampCard radius={26} style={{ marginHorizontal: 20, marginTop: 32 }}>
                                <View
                                    className="p-card-pad items-center"
                                 style={{ backgroundColor: '#EDE8E0' }}>
                                    <Text className="font-display text-label text-ink-3 uppercase mb-3" style={{ letterSpacing: 1.4 }}>Attendance Score</Text>

                                    {/* Circular Percentage */}
                                    <View className="mb-8 w-40 h-40 rounded-full items-center justify-center border-[2px] border-brand-100 bg-card shadow-hair">
                                        <View className="w-32 h-32 rounded-full bg-card items-center justify-center border border-line">
                                            <Text className="text-ink text-3xl font-display">{result.percentage}%</Text>
                                            <View className="h-[2px] w-8 rounded-full bg-brand-500 my-1" />
                                            <Text className="text-ink-3 font-display text-label uppercase">Protocol</Text>
                                        </View>
                                    </View>

                                    {/* Status Body */}
                                    <View className="items-center w-full">
                                        <View className="flex-row items-center gap-3 mb-6 bg-card px-6 py-3 rounded-card border border-brand-100 shadow-hair">
                                            <Ionicons name={result.icon} size={20} color={result.color} />
                                            <Text className="font-semibold text-base text-ink">
                                                {result.status === 'SAFE' ? 'The Great Escape' : 'System Critical'}
                                            </Text>
                                        </View>

                                        <Text className="text-2xl font-display text-center mb-4 leading-tight" style={{ color: result.color }}>
                                            {result.message}
                                        </Text>

                                        <View className="bg-card/60 p-3 rounded-xl border border-brand-50 border-2 border-dashed w-full mb-8">
                                            <Text className="text-ink-3 font-semibold text-center text-xs leading-5">
                                                {result.detail}
                                            </Text>
                                        </View>

                                        {/* Technical Advisory Box */}
                                        <View className="bg-brand-500/10 p-5 rounded-card w-full flex-row items-center border border-brand-500/20">
                                            <View className="bg-card p-2.5 rounded-xl border border-brand-100">
                                                <Ionicons
                                                    name="flash"
                                                    size={18}
                                                    color="#F97316"
                                                />
                                            </View>
                                            <View className="ml-4 flex-1">
                                                <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>Technical Advisory</Text>
                                                <Text className="text-ink-3 text-label font-semibold leading-4 mt-0.5">
                                                    {result.status === 'SAFE'
                                                        ? "Bunk protocols confirmed safe. Maintain current trajectory."
                                                        : "System failure imminent. Immediate lecture attendance required."}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </StampCard>
                        )}

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}
