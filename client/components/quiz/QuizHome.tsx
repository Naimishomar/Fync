import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
            style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
        >
            <View
                className="bg-card rounded-sheet p-5 shadow-hair border border-line flex-row items-center"
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
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#C4BEB6" />
                </View>
            </View>
        </Pressable>
    );
};

const QuizHome = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

                    {/* --- HEADER SECTION --- */}
                    <View className="mb-10 pb-4">
                        <View className="flex-row items-center gap-3">
                            <View className="w-12 h-12 bg-brand-500 rounded-card items-center justify-center shadow-hair">
                                <Ionicons name="trophy" size={24} color="#12100E" />
                            </View>
                            <View>
                                <Text className="text-ink text-4xl font-display">
                                    QUIZ <Text className="text-accent-text">ARENA</Text>
                                </Text>
                                <Text className="text-ink-3 text-label font-display uppercase mt-0.5">
                                    GLOBAL BATTLEGROUND SITE
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* --- CARDS GRID --- */}
                    <View className="flex-1">

                        {/* 1. Create Room - Cyan */}
                        <LightCard
                            title="Create Room"
                            subtitle="HOST A MATCH"
                            neonColor="#0891b2"
                            iconName="add-circle"
                            onPress={() => navigation.navigate("CreateRoom")}
                        />

                        {/* 2. Join Room - Purple */}
                        <LightCard
                            title="Join Room"
                            subtitle="ENTER CODE"
                            neonColor="#7c3aed"
                            iconName="key-outline"
                            onPress={() => navigation.navigate("JoinRoomInput")}
                        />

                        {/* 3. Random 1v1 - Pink/Rose */}
                        <LightCard
                            title="1v1 Battle"
                            subtitle="FIND OPPONENT"
                            neonColor="#DB2777"
                            iconName="flash"
                            onPress={() => navigation.navigate("OneVsOneSetup")}
                        />

                        {/* 4. Interview - Amber */}
                        <LightCard
                            title="AI Interview"
                            subtitle="PRACTICE MODE"
                            neonColor="#B45309"
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
