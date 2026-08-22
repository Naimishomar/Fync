import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const DSAAndDevelopmentContest = () => {
    const navigation = useNavigation();

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            

            <SafeAreaView className="flex-1" edges={['top']}>
                {/* BACKGROUND FAKE CONTENT (To be blurred) */}
                <ScrollView className="flex-1 px-6 pt-2" scrollEnabled={false} showsVerticalScrollIndicator={false}>
                    {/* Header Mockup */}
                    <View className="pb-6 flex-row items-center justify-between">
                        <View>
                            <TouchableOpacity
                              onPress={() => navigation.goBack()}
                              className="w-11 h-11 items-center justify-center rounded-xl"
                              accessibilityRole="button"
                              accessibilityLabel="Go back"
                              style={{ marginLeft: -11 }}
                            >
                              <Ionicons name="arrow-back" size={24} color="#12100E" />
                            </TouchableOpacity>
                            <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Coding</Text>
                            <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Arena</Text>
                            <Text className="text-ink-3 text-label font-display uppercase mt-1">Global Leaderboard</Text>
                        </View>
                        <View className="bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
                            <Text className="text-accent-text font-display text-xs text-center">45:00</Text>
                            <Text className="text-accent-text text-label font-semibold uppercase mt-0.5">Left</Text>
                        </View>
                    </View>

                    {/* Question Mockup */}
                    <View className="bg-card p-6 rounded-card border border-line shadow-hair mb-5">
                        <View className="flex-row items-center justify-between mb-4">
                            <View className="bg-ink px-2.5 py-1 rounded-full">
                                <Text className="text-white font-display text-label uppercase">Problem 1</Text>
                            </View>
                            <Text className="text-accent-text text-label font-display uppercase">+50 XP</Text>
                        </View>
                        <Text className="text-ink font-display text-xl mb-3 leading-tight">Graph Traversal Optimization</Text>
                        <Text className="text-ink-3 text-xs leading-5">
                            Given an unweighted directed graph consisting of N nodes and M edges, find the shortest path from node A to node B that visits exactly K distinct nodes.
                        </Text>
                        
                        <View className="bg-paper-2 p-4 rounded-lg mt-5 border border-line">
                            <Text className="font-mono text-ink-2 text-label">Input: N=5, M=6, K=3</Text>
                            <Text className="font-mono text-ink-2 text-label mt-2">Output: [1, 3, 5]</Text>
                        </View>
                    </View>

                    {/* IDE Space Mockup */}
                    <View className="bg-ink p-6 rounded-card mb-5 h-56 shadow-hair border border-ink">
                        <View className="flex-row gap-2 mb-5 border-b border-ink pb-3">
                            <View className="w-3 h-3 rounded-full bg-danger" />
                            <View className="w-3 h-3 rounded-full bg-warning" />
                            <View className="w-3 h-3 rounded-full bg-success" />
                        </View>
                        <Text className="font-mono text-accent-text text-xs">function <Text className="text-fam-career">solve</Text><Text className="text-warning">(N, M, K)</Text> {'{'}</Text>
                        <Text className="font-mono text-ink-3 text-xs mt-3 pl-4">// Write your optimized logic here</Text>
                        <Text className="font-mono text-white text-xs mt-3 pl-4">return path;</Text>
                        <Text className="font-mono text-accent-text text-xs mt-4">{'}'}</Text>
                    </View>

                    {/* Action Buttons Mockup */}
                    <View className="flex-row gap-3 mb-20">
                        <TouchableOpacity className="flex-1 bg-paper p-4 border border-line items-center shadow-hair rounded-md">
                            <Text className="font-semibold text-base text-ink">Run Code</Text>
                        </TouchableOpacity>
                        <TouchableOpacity className="flex-1 bg-brand-500 p-4 items-center border-2 border-ink rounded-md">
                            <Text className="text-ink font-display text-sm uppercase">Submit</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {/* MEDIUM BLUR OVERLAY */}
                <BlurView intensity={80} tint="light" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 10 }}>
                    <View className="flex-1 bg-paper/80 justify-center items-center">                           

                        <View className="items-center px-gutter bg-ink p-card-pad rounded-card mx-5">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <View 
                                    className="w-16 h-16 rounded-full items-center justify-center"
                                 style={{ backgroundColor: '#F97316' }}>
                                    <Ionicons name="lock-closed" size={32} color="#12100E" />
                                </View>
                            </View>
                            
                            <Text className="text-white text-4xl font-display uppercase text-center mb-2">
                                Coming <Text className="text-accent-text">Soon</Text>
                            </Text>
                            
                            <Text className="text-ink-3 text-xs font-semibold text-center leading-5 mb-8 px-4">
                                The ultimate coding arena is being forged. Prepare to test your logic, conquer the leaderboard, and unlock exclusive rewards.
                            </Text>
                            
                            <View className="px-6 py-3">
                                <Text className="text-accent-text font-display text-label uppercase">Systems Booting Up...</Text>
                            </View>
                        </View>

                    </View>
                </BlurView>
            </SafeAreaView>
        </View>
    );
};

export default DSAAndDevelopmentContest;
