import React, { useRef, useState } from 'react';
import { View, Text, Keyboard, ScrollView, KeyboardAvoidingView, StatusBar } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert } from '../ui/AlertModal';

import { useNavigation } from '@react-navigation/native';
import { AppBar, Card, Button, FormField, Label, Num } from '../ui/kit';
import { C } from '../../constants/colors';

export default function BunkOMeter() {
    const [attended, setAttended] = useState('');
    const [total, setTotal] = useState('');
    const [targetInput, setTargetInput] = useState('');
    const [result, setResult] = useState<any>(null);
    const navigation = useNavigation<any>();
    const scrollRef = useRef<ScrollView>(null);

    const calculateAttendance = () => {
        Keyboard.dismiss();
        const present = parseInt(attended);
        const held = parseInt(total);
        const target = parseFloat(targetInput) || 75;

        if (isNaN(present) || isNaN(held) || held <= 0 || present < 0) {
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
            analysis.color = C.brand[500]; // Platform Orange
            analysis.bg = [C.paper2, C.paper2];
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
                analysis.color = C.danger;
                analysis.bg = [C.paper2, C.paper2];
                analysis.icon = 'alert-circle';
                analysis.message = `Impossible`;
                analysis.detail = `You cannot reach 100% if you have already missed a class.`;
            } else {
                const needed = (decimalTarget * held - present) / (1 - decimalTarget);
                const toAttend = Math.ceil(needed);

                analysis.status = 'DANGER';
                analysis.color = C.danger;
                analysis.bg = [C.paper2, C.paper2];
                analysis.icon = 'warning';
                analysis.message = `Attend Next ${toAttend} Classes`;
                analysis.detail = `You must attend the next ${toAttend} lectures continuously to reach ${target}%.`;
            }
        }

        setResult(analysis);
        // The result renders below the fold on most phones; bring it into view.
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Bunk-O-Meter" onBack={() => navigation.goBack()} />
                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    <ScrollView ref={scrollRef} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

                        <Card padded style={{ marginHorizontal: 20, marginTop: 16, gap: 16 }}>
                            <View className="flex-row" style={{ gap: 12 }}>
                                <FormField
                                    label="Attended"
                                    containerStyle={{ flex: 1 }}
                                    value={attended}
                                    onChangeText={setAttended}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                                <FormField
                                    label="Total held"
                                    containerStyle={{ flex: 1 }}
                                    value={total}
                                    onChangeText={setTotal}
                                    keyboardType="numeric"
                                    placeholder="0"
                                />
                            </View>

                            <FormField
                                label="Target percentage"
                                value={targetInput}
                                onChangeText={setTargetInput}
                                keyboardType="numeric"
                                placeholder="75"
                                right={<Text className="text-ink-3 font-semibold">%</Text>}
                            />

                            <Button title="Calculate" variant="primary" block onPress={calculateAttendance} />
                        </Card>

                        {result ? (
                            <Card padded style={{ marginHorizontal: 20, marginTop: 24, alignItems: 'center' }}>
                                <Label style={{ marginBottom: 12 }}>Attendance</Label>

                                <View className="mb-6 w-36 h-36 rounded-full items-center justify-center border border-line bg-paper-2">
                                    <Num style={{ fontSize: 32, lineHeight: 36 }}>{result.percentage}%</Num>
                                </View>

                                <View className="flex-row items-center mb-4 bg-paper-2 px-4 py-2 rounded-full" style={{ gap: 8 }}>
                                    <Ionicons name={result.icon} size={18} color={result.color} />
                                    <Text className="font-semibold text-sm text-ink">
                                        {result.status === 'SAFE' ? 'Safe zone' : 'Danger zone'}
                                    </Text>
                                </View>

                                <Text className="text-2xl font-display text-center mb-2" style={{ color: result.color }}>
                                    {result.message}
                                </Text>

                                <Text className="text-ink-2 font-sans text-center text-sm leading-5">
                                    {result.detail}
                                </Text>
                            </Card>
                        ) : null}

                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
}
