import React from 'react';
import { View, Text, Pressable, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface CrushCardProps {
    onPress: () => void;
    crushCount: number;
    onCheckNearby?: () => void;
    isChecking?: boolean;
}

const CrushCard = ({ onPress, crushCount, onCheckNearby, isChecking }: CrushCardProps) => {
    return (
        <View className="mx-4 my-2">
            <Pressable onPress={onPress}>
                <LinearGradient
                    colors={['#ff3b82', '#ff8b3b']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="p-5 rounded-3xl flex-row items-center justify-between shadow-xl"
                >
                    <View className="flex-row items-center flex-1">
                        <View className="bg-white/20 p-3 rounded-full mr-4">
                            <Ionicons name="heart-half-outline" size={32} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-white font-bold text-xl italic tracking-tighter">Secret Crush</Text>
                            <Text className="text-white/80 text-sm" numberOfLines={1}>
                                {crushCount > 0 ? `${crushCount} people in your list` : "Add someone secretly!"}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-2">
                        <Pressable
                            onPress={onCheckNearby}
                            disabled={isChecking}
                            className="bg-white/20 p-3 rounded-2xl items-center justify-center"
                        >
                            {isChecking ? (
                                <ActivityIndicator size="small" color="white" />
                            ) : (
                                <Ionicons name="scan-outline" size={24} color="white" />
                            )}
                        </Pressable>
                        <View className="bg-white/20 p-3 rounded-2xl items-center justify-center">
                            <Ionicons name="add" size={24} color="white" />
                        </View>
                    </View>
                </LinearGradient>
            </Pressable>
            <View className="mt-1 px-4">
                <Text className="text-gray-500 text-[10px] italic">Tap scan icon to check if your crush is within 50 meters.</Text>
            </View>
        </View>
    );
};

export default CrushCard;
