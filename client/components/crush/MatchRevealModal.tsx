import React from 'react';
import { View, Text, Modal, Pressable, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

interface MatchRevealProps {
    isVisible: boolean;
    onClose: () => void;
    crushUser: {
        _id: string;
        name: string;
        username: string;
        avatar?: string;
    };
    navigation: any;
}

const MatchRevealModal = ({ isVisible, onClose, crushUser, navigation }: MatchRevealProps) => {
    if (!crushUser) return null;
    return (
        <Modal visible={isVisible} animationType="fade" transparent={true}>
            <View className="flex-1 bg-black/95 justify-center items-center px-8">
                <View
                    className="w-full h-[70%] rounded-full overflow-hidden absolute top-[15%] opacity-10"
                >
                    <LinearGradient colors={['#ff3b82', '#000']} className="flex-1" />
                </View>

                <View className="items-center z-10">
                    <Text className="text-4xl font-bold text-pink-500 mb-2 italic">❤️ It's a Match ❤️</Text>
                    <Text className="text-gray-300 text-center mb-10 text-lg">You and {crushUser.name} like each other!</Text>
                </View>

                <View className="flex-row items-center justify-center mb-16 z-10">
                    <Image
                        source={{ uri: crushUser.avatar || `https://ui-avatars.com/api/?name=${crushUser.username}` }}
                        className="w-32 h-32 rounded-3xl border-4 border-pink-500 transform -rotate-12"
                    />
                    <View className="mx-4">
                        <Ionicons name="heart" size={60} color="#ff3b82" />
                    </View>
                    <View className="w-32 h-32 rounded-3xl border-4 border-pink-500 bg-gray-800 items-center justify-center rotate-12">
                        <Ionicons name="person" size={50} color="gray" />
                    </View>
                </View>

                <View className="w-full space-y-4 z-10 mt-10">
                    <Pressable
                        onPress={() => {
                            onClose();
                            navigation.navigate('PublicProfile', { user: crushUser });
                        }}
                        className="bg-white px-8 py-4 rounded-2xl flex-row items-center justify-center"
                    >
                        <Ionicons name="person" size={20} color="black" />
                        <Text className="text-black font-bold ml-2">View Profile</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            // In a real app, this would call a wave API
                            Toast.show({
                                type: 'success',
                                text1: 'Wave Sent! 👋',
                                text2: `You waved to ${crushUser.name}`
                            });
                        }}
                        className="bg-pink-100 px-8 py-4 rounded-2xl flex-row items-center justify-center mt-3 border border-pink-200"
                    >
                        <Ionicons name="hand-right" size={20} color="#ff3b82" />
                        <Text className="text-pink-600 font-bold ml-2">Send Wave</Text>
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            onClose();
                            navigation.navigate('ChatList');
                        }}
                        className="bg-pink-600 px-8 py-4 rounded-2xl flex-row items-center justify-center mt-3"
                    >
                        <Ionicons name="chatbubbles" size={20} color="white" />
                        <Text className="text-white font-bold ml-2">Start Chat</Text>
                    </Pressable>

                    <Pressable
                        onPress={onClose}
                        className="items-center mt-6"
                    >
                        <Text className="text-gray-400 font-semibold">Keep it secret for now</Text>
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

export default MatchRevealModal;
