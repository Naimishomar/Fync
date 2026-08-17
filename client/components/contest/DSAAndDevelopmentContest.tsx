import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DSAAndDevelopmentContest = () => {
    const navigation = useNavigation();

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Gradient (Fync style) */}
            <LinearGradient 
                colors={['rgba(249, 115, 22, 0.15)', 'rgba(249, 115, 22, 0)']} 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, zIndex: 0 }} 
                pointerEvents="none"
            />

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* BACKGROUND FAKE CONTENT (To be blurred) */}
                <ScrollView className="flex-1 px-6 pt-2" scrollEnabled={false} showsVerticalScrollIndicator={false}>
                    {/* Header Mockup */}
                    <View className="pb-6 flex-row items-center justify-between">
                        <View>
                            <Text className="text-slate-900 text-3xl font-black tracking-tighter uppercase leading-tight">
                                Coding <Text className="text-orange-500">Arena</Text>
                            </Text>
                            <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mt-1">Global Leaderboard</Text>
                        </View>
                        <View className="bg-orange-50 px-3 py-1.5 rounded-xl border border-orange-100">
                            <Text className="text-orange-600 font-black text-xs text-center">45:00</Text>
                            <Text className="text-orange-400 text-2xs font-bold uppercase tracking-wide mt-0.5">Left</Text>
                        </View>
                    </View>

                    {/* Question Mockup */}
                    <View className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mb-5">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="bg-slate-900 px-3 py-1.5 rounded-full">
                                <Text className="text-white font-black text-2xs uppercase">Problem 1</Text>
                            </View>
                            <Text className="text-orange-500 text-2xs font-black uppercase">+50 XP</Text>
                        </View>
                        <Text className="text-slate-900 font-black text-xl mb-3 leading-tight">Graph Traversal Optimization</Text>
                        <Text className="text-slate-500 text-xs leading-5">
                            Given an unweighted directed graph consisting of N nodes and M edges, find the shortest path from node A to node B that visits exactly K distinct nodes.
                        </Text>
                        
                        <View className="bg-slate-50 p-4 rounded-lg mt-5 border border-slate-100">
                            <Text className="font-mono text-slate-600 text-2xs font-bold">Input: N=5, M=6, K=3</Text>
                            <Text className="font-mono text-slate-600 text-2xs font-bold mt-2">Output: [1, 3, 5]</Text>
                        </View>
                    </View>

                    {/* IDE Space Mockup */}
                    <View className="bg-[#1e1e1e] p-6 rounded-2xl mb-5 h-56 shadow-sm border border-slate-800">
                        <View className="flex-row gap-2 mb-5 border-b border-slate-800 pb-3">
                            <View className="w-3 h-3 rounded-full bg-red-500" />
                            <View className="w-3 h-3 rounded-full bg-yellow-500" />
                            <View className="w-3 h-3 rounded-full bg-green-500" />
                        </View>
                        <Text className="font-mono text-pink-400 text-xs font-medium">function <Text className="text-blue-400">solve</Text><Text className="text-yellow-200">(N, M, K)</Text> {'{'}</Text>
                        <Text className="font-mono text-slate-500 text-xs mt-3 pl-4">// Write your optimized logic here</Text>
                        <Text className="font-mono text-white text-xs mt-3 pl-4">return path;</Text>
                        <Text className="font-mono text-pink-400 text-xs mt-4">{'}'}</Text>
                    </View>

                    {/* Action Buttons Mockup */}
                    <View className="flex-row gap-3 mb-20">
                        <TouchableOpacity className="flex-1 bg-white p-4 rounded-2xl border border-slate-200 items-center shadow-sm">
                            <Text className="text-slate-600 font-black text-xs uppercase tracking-wider">Run Code</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 bg-orange-500 p-4 rounded-2xl items-center shadow-lg shadow-orange-500/30">
                            <Text className="text-white font-black text-xs uppercase tracking-wider">Submit</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* MEDIUM BLUR OVERLAY */}
                <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }}>
                    <View className="flex-1 bg-white/80 justify-center items-center">                           

                        <View className="items-center px-10 bg-slate-800 p-8 rounded-2xl mx-5">
                            <View className="w-24 h-24 bg-white rounded-full items-center justify-center mb-6 shadow-2xl shadow-orange-500/20 border border-slate-100">
                                <LinearGradient 
                                    colors={['#f97316', '#ec4899']} 
                                    className="w-16 h-16 rounded-full items-center justify-center"
                                >
                                    <Ionicons name="lock-closed" size={32} color="white" />
                                </LinearGradient>
                            </View>
                            
                            <Text className="text-white text-4xl font-black tracking-tighter uppercase text-center mb-2">
                                Coming <Text className="text-orange-500">Soon</Text>
                            </Text>
                            
                            <Text className="text-slate-500 text-xs font-bold text-center leading-5 mb-8 px-4">
                                The ultimate coding arena is being forged. Prepare to test your logic, conquer the leaderboard, and unlock exclusive rewards.
                            </Text>
                            
                            <View className="px-6 py-3">
                                <Text className="text-orange-600 font-black text-2xs uppercase tracking-wide">Systems Booting Up...</Text>
                            </View>
                        </View>

                    </View>
                </BlurView>
            </SafeAreaView>
        </View>
    );
};

export default DSAAndDevelopmentContest;
