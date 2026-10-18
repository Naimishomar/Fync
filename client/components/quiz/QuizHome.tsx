import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

// --- TYPES ---
interface CyberCardProps {
    title: string;
    subtitle: string;
    onPress: () => void;
    iconName: keyof typeof Ionicons.glyphMap;
    neonColor: string; // Hex color for the glow
}

// --- CYBER CARD COMPONENT ---
const LightCard = ({ title, subtitle, onPress, iconName, neonColor }: CyberCardProps) => {
    return (
        <Pressable
            onPress={onPress}
            className="w-full mb-5"
        >
            {/* Pressed state in children: NativeWind can drop a style function. */}
            {({ pressed }) => (
            <View
                className="bg-card rounded-sheet p-5 shadow-hair border border-line flex-row items-center"
                style={{ transform: [{ scale: pressed ? 0.98 : 1 }] }}
            >
                {/* Left Box Icon */}
                <View
                    className="w-14 h-14 rounded-card items-center justify-center mr-5"
                    style={{ backgroundColor: `${neonColor}15` }}
                >
                    <Ionicons name={iconName} size={26} color={neonColor} />
                </View>

                {/* Center: Text */}
                <View className="flex-1">
                    <Text className="text-ink text-lg font-display uppercase">
                        {title}
                    </Text>
                    <Text className="text-ink-3 text-label font-display uppercase mt-0.5">
                        {subtitle}
                    </Text>
                </View>

                {/* Right: Tech Decoration */}
                <View className="bg-paper-2 w-10 h-10 rounded-full items-center justify-center border border-line">
                    <MaterialCommunityIcons name="chevron-right" size={24} color={C.ink4} />
                </View>
            </View>
            )}
        </Pressable>
    );
};

const QuizHome = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <SafeAreaView className="flex-1" edges={['bottom']}>
                <AppBar title="Quiz Arena" onBack={() => navigation.goBack()} />
                <ScrollView keyboardShouldPersistTaps="handled" className="flex-1 px-5" contentContainerStyle={{ paddingTop: 8 }} showsVerticalScrollIndicator={false}>

                    {/* --- CARDS GRID --- */}
                    <View className="flex-1">

                        {/* 1. Create Room - Cyan */}
                        <LightCard
                            title="Create Room"
                            subtitle="HOST A MATCH"
                            neonColor={C.fam.social}
                            iconName="add-circle"
                            onPress={() => navigation.navigate("CreateRoom")}
                        />

                        {/* 2. Join Room - Purple */}
                        <LightCard
                            title="Join Room"
                            subtitle="ENTER CODE"
                            neonColor={C.fam.study}
                            iconName="key-outline"
                            onPress={() => navigation.navigate("JoinRoomInput")}
                        />

                        {/* 3. Random 1v1 - Pink/Rose */}
                        <LightCard
                            title="1v1 Battle"
                            subtitle="FIND OPPONENT"
                            neonColor={C.fam.fun}
                            iconName="flash"
                            onPress={() => navigation.navigate("OneVsOneSetup")}
                        />

                        {/* 4. Interview - Amber */}
                        <LightCard
                            title="AI Interview"
                            subtitle="PRACTICE MODE"
                            neonColor={C.warning}
                            iconName="mic"
                            onPress={() => navigation.navigate("InterviewSetup")}
                        />

                    </View>


                    {/* --- BOTTOM DECORATION --- */}
                    <View className="items-center mt-8 mb-12 opacity-50">
                        <View className="h-[1px] w-full bg-paper-2 mb-6" />
                        <Text className="text-ink-3 font-semibold text-label uppercase">System Protocol Active • V.2.0.4</Text>
                    </View>


                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default QuizHome;
