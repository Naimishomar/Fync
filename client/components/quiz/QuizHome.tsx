import React from 'react';
import { View, Text, Pressable, StyleSheet, StatusBar, Platform, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../App';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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
                className="bg-white rounded-4xl p-5 shadow-sm shadow-black/5 border border-slate-100 flex-row items-center"
            >
                {/* Left Box Icon */}
                <View
                    className="w-14 h-14 rounded-2xl items-center justify-center mr-5 shadow-inner"
                    style={{ backgroundColor: `${neonColor}15` }}
                >
                    <Ionicons name={iconName} size={26} color={neonColor} />
                </View>

                {/* Center: Text */}
                <View className="flex-1">
                    <Text className="text-slate-900 text-lg font-black  tracking-tight uppercase">
                        {title}
                    </Text>
                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">
                        {subtitle}
                    </Text>
                </View>

                {/* Right: Tech Decoration */}
                <View className="bg-slate-50 w-10 h-10 rounded-full items-center justify-center border border-slate-100">
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#CBD5E1" />
                </View>
            </View>
        </Pressable>
    );
};

const QuizHome = () => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />

            <SafeAreaView className="flex-1">
                <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

                    {/* --- HEADER SECTION --- */}
                    <View className="mb-10 pb-4">
                        <View className="flex-row items-center gap-3">
                            <View className="w-12 h-12 bg-pink-500 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20">
                                <Ionicons name="trophy" size={24} color="white" />
                            </View>
                            <View>
                                <Text className="text-slate-900 text-4xl font-black  tracking-tighter">
                                    QUIZ <Text className="text-pink-500">ARENA</Text>
                                </Text>
                                <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-0.5">
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
                            neonColor="#e11d48"
                            iconName="flash"
                            onPress={() => navigation.navigate("OneVsOneSetup")}
                        />

                        {/* 4. Interview - Amber */}
                        <LightCard
                            title="AI Interview"
                            subtitle="PRACTICE MODE"
                            neonColor="#d97706"
                            iconName="mic"
                            onPress={() => navigation.navigate("InterviewSetup")}
                        />

                    </View>


                    {/* --- BOTTOM DECORATION --- */}
                    <View className="items-center mt-8 mb-12 opacity-50">
                        <View className="h-[1px] w-full bg-slate-200 mb-6" />
                        <Text className="text-slate-500 font-bold text-2xs tracking-wide uppercase">System Protocol Active • V.2.0.4</Text>
                    </View>


                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

export default QuizHome;
