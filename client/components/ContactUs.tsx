import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
    Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';

const ContactUs = () => {
    const navigation = useNavigation<any>();
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        message: '',
    });

    const pickImages = async () => {
        if (selectedImages.length >= 3) {
            Toast.show({
                type: 'info',
                text1: 'Limit Reached',
                text2: 'You can only upload up to 3 photos.'
            });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 3 - selectedImages.length,
            quality: 0.7,
        });

        if (!result.canceled) {
            const newUris = result.assets.map(asset => asset.uri);
            const totalImages = [...selectedImages, ...newUris].slice(0, 3);
            setSelectedImages(totalImages);
        }
    };

    const removeImage = (index: number) => {
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        const { name, phone, email, message } = formData;
        if (!name || !phone || !email || !message) {
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'All fields are required'
            });
            return;
        }

        setIsLoading(true);
        try {
            const data = new FormData();
            data.append('name', name);
            data.append('phone', phone);
            data.append('email', email);
            data.append('message', message);

            selectedImages.forEach((uri, index) => {
                const filename = uri.split('/').pop();
                const match = /\.(\w+)$/.exec(filename || '');
                const type = match ? `image/${match[1]}` : `image`;
                
                data.append('images', {
                    uri,
                    name: filename || `p${index}.jpg`,
                    type,
                } as any);
            });

            const res = await axios.post('/contact-us', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (res.status === 201) {
                setIsSubmitted(true);
                setFormData({ name: '', phone: '', email: '', message: '' });
                setSelectedImages([]);
                Toast.show({
                    type: 'success',
                    text1: 'Success',
                    text2: 'Your message has been sent'
                });
            }
        } catch (error: any) {
            console.error(error);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: error.response?.data?.message || 'Something went wrong'
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <SafeAreaView className="flex-1 bg-[#BEE7DF] justify-center">
                <View className="px-10">
                    <Text className="text-6xl font-[900] text-[#1A1A1A] leading-[70px] mb-10 tracking-[-1px]">
                        Nice to meet you, we will chat soon.
                    </Text>
                    <TouchableOpacity
                        className="bg-black py-5 px-8 self-start"
                        onPress={() => navigation.navigate('Tabs')}
                    >
                        <Text className="text-white text-base font-bold">Take me back home</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white px-5">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <ScrollView showsVerticalScrollIndicator={false}>
                    {/* Header Section */}
                    <View className="pt-5 pb-6">
                        <TouchableOpacity 
                            onPress={() => navigation.goBack()}
                            className="mb-5"
                        >
                            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                        </TouchableOpacity>
                        
                        <View className="mb-4">
                            <Text className="text-6xl font-[900] text-[#1A1A1A] tracking-[-2px]">
                                Need Any Help?<Text className="text-pink-500">.</Text>
                            </Text>
                        </View>

                        <View className="flex-row justify-between mb-4">
                            <View className="flex-1">
                                <Text className="text-[13px] text-[#1A1A1A] font-semibold leading-5 italic">KIET Deemed To Be University</Text>
                                <Text className="text-[13px] text-[#1A1A1A] font-semibold leading-5 text-gray-500">Ghaziabad, Uttar Pradesh</Text>
                            </View>
                            <View className="flex-1 items-end">
                                <Text className="text-[13px] text-[#1A1A1A] font-semibold leading-5">+91 9838612359</Text>
                                <Text className="text-[13px] text-[#1A1A1A] font-semibold leading-5 text-pink-500">dev.fync@gmail.com</Text>
                            </View>
                        </View>
                    </View>

                    {/* Form Section */}
                    <View className="border border-gray-100 rounded-3xl px-5 pt-8 pb-8 flex-1 bg-zinc-50/50 mb-10">
                        <View className="mb-6">
                            <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-[2px] mb-1">Name</Text>
                            <TextInput
                                className="border-b border-gray-200 py-2 text-lg text-[#1A1A1A] font-medium"
                                placeholder="Naimish Omar"
                                placeholderTextColor="#ccc"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-[2px] mb-1">Phone</Text>
                            <TextInput
                                className="border-b border-gray-200 py-2 text-lg text-[#1A1A1A] font-medium"
                                placeholder="+91 1234567890"
                                placeholderTextColor="#ccc"
                                keyboardType="phone-pad"
                                value={formData.phone}
                                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-[2px] mb-1">Email</Text>
                            <TextInput
                                className="border-b border-gray-200 py-2 text-lg text-[#1A1A1A] font-medium"
                                placeholder="dev.fync@email.com"
                                placeholderTextColor="#ccc"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                            />
                        </View>

                        <View className="mb-6">
                            <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-[2px] mb-1">Message</Text>
                            <TextInput
                                className="border-b border-gray-200 py-2 text-lg text-[#1A1A1A] font-medium min-h-[100px]"
                                placeholder='Tell us more...'
                                placeholderTextColor="#ccc"
                                multiline
                                numberOfLines={4}
                                value={formData.message}
                                onChangeText={(text) => setFormData({ ...formData, message: text })}
                                textAlignVertical="top"
                            />
                        </View>

                        {/* Photo Section */}
                        <View className="mb-8">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-[12px] font-bold text-gray-400 uppercase tracking-[2px]">Photos (Optional, Max 3)</Text>
                                <Text className="text-xs text-gray-400">{selectedImages.length}/3</Text>
                            </View>
                            
                            <View className="flex-row gap-3">
                                {selectedImages.map((uri, index) => (
                                    <View key={index} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                                        <Image source={{ uri }} className="w-full h-full" />
                                        <TouchableOpacity 
                                            onPress={() => removeImage(index)}
                                            className="absolute top-1 right-1 bg-black/50 rounded-full p-1"
                                        >
                                            <Ionicons name="close" size={14} color="white" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                
                                {selectedImages.length < 3 && (
                                    <TouchableOpacity 
                                        onPress={pickImages}
                                        className="w-20 h-20 rounded-xl border border-dashed border-gray-300 justify-center items-center bg-white"
                                    >
                                        <Ionicons name="camera-outline" size={24} color="#999" />
                                        <Text className="text-[10px] text-gray-400 mt-1">Add Photo</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        <TouchableOpacity 
                            className={`bg-zinc-900 py-5 items-center rounded-2xl shadow-lg ${isLoading ? 'opacity-70' : ''}`}
                            onPress={handleSubmit}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-base font-bold uppercase tracking-[2px]">Send Message</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity 
                            activeOpacity={0.8}
                            className="bg-pink-500 py-5 items-center mt-4 rounded-2xl border border-pink-100"
                            onPress={() => navigation.navigate('MeetOurTeam')}
                        >
                            <Text className="text-white text-base font-bold uppercase tracking-widest">Meet Our Team</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ContactUs;
