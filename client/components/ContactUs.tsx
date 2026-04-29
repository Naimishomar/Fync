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
    StatusBar,
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
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {/* Header Section */}
                    <View className="px-8 pt-10 pb-10">
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            className="w-12 h-12 bg-white rounded-2xl items-center justify-center border border-slate-100 shadow-sm mb-10"
                        >
                            <Ionicons name="arrow-back" size={24} color="#18181b" />
                        </TouchableOpacity>

                        <View className="mb-10">
                            <Text className="text-zinc-900 text-5xl font-black  uppercase tracking-tighter leading-[50px]">
                                Establish <Text className="text-pink-500">Contact</Text>
                            </Text>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[3px] mt-2">Intelligence Support Protocol</Text>
                        </View>

                        <View className="flex-row justify-between items-end bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm shadow-black/5">
                            <View>
                                <Text className="text-[10px] text-zinc-900 font-black  uppercase tracking-tight">Main HQ</Text>
                                <Text className="text-[10px] text-slate-400 font-black  uppercase mt-1">KIET Deemed University</Text>
                                <Text className="text-[9px] text-slate-300 font-bold uppercase mt-0.5">Ghaziabad, Uttar Pradesh</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-[10px] text-pink-500 font-black  uppercase">dev.fync@gmail.com</Text>
                                <Text className="text-[9px] text-slate-400 font-bold uppercase mt-1">+91 98386*****</Text>
                            </View>
                        </View>
                    </View>

                    {/* Form Section */}
                    <View className="px-8">
                        <View className="bg-white border border-slate-100 rounded-[48px] px-8 pt-10 pb-10 shadow-2xl shadow-black/5">
                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2 ">Operator Identity</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black  uppercase tracking-tight"
                                    placeholder="e.g. Naimish Omar"
                                    placeholderTextColor="#CBD5E1"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2 ">Signal Frequency (Phone)</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black  uppercase tracking-tight"
                                    placeholder="+91 1234567890"
                                    placeholderTextColor="#CBD5E1"
                                    keyboardType="phone-pad"
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2 ">Digital Ledger (Email)</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black  uppercase tracking-tight"
                                    placeholder="dev.fync@email.com"
                                    placeholderTextColor="#CBD5E1"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                />
                            </View>

                            <View className="mb-10">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2 ">Transmission Content</Text>
                                <TextInput
                                    className="bg-slate-50 p-6 rounded-[32px] text-xs text-zinc-700 font-medium  min-h-[150px]"
                                    placeholder='Define the requirements / issues...'
                                    placeholderTextColor="#CBD5E1"
                                    multiline
                                    numberOfLines={4}
                                    value={formData.message}
                                    onChangeText={(text) => setFormData({ ...formData, message: text })}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Photo Section */}
                            <View className="mb-12">
                                <View className="flex-row justify-between items-center mb-4 px-2">
                                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] ">Visual Evidence (Max 3)</Text>
                                    <Text className="text-[9px] text-slate-400 font-black ">{selectedImages.length}/3</Text>
                                </View>

                                <View className="flex-row gap-4">
                                    {selectedImages.map((uri, index) => (
                                        <View key={index} className="relative w-20 h-20 rounded-[20px] overflow-hidden bg-slate-50 border border-slate-100">
                                            <Image source={{ uri }} className="w-full h-full" />
                                            <TouchableOpacity
                                                onPress={() => removeImage(index)}
                                                className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1"
                                            >
                                                <Ionicons name="close" size={12} color="white" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}

                                    {selectedImages.length < 3 && (
                                        <TouchableOpacity
                                            onPress={pickImages}
                                            className="w-20 h-20 rounded-[20px] border border-dashed border-slate-200 justify-center items-center bg-white"
                                        >
                                            <Ionicons name="camera-outline" size={24} color="#CBD5E1" />
                                            <Text className="text-[8px] font-black text-slate-300 mt-1 uppercase ">Attach</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity
                                className={`bg-zinc-900 py-6 items-center rounded-[24px] shadow-2xl shadow-black/20 ${isLoading ? 'opacity-70' : ''}`}
                                onPress={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white text-xs font-black  uppercase tracking-widest">Deploy Transmission</Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                activeOpacity={0.8}
                                className="bg-pink-50 py-5 items-center mt-6 rounded-[24px] border border-pink-100"
                                onPress={() => navigation.navigate('MeetOurTeam')}
                            >
                                <Text className="text-pink-500 text-[10px] font-black  uppercase tracking-widest">Meet Team HQ</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ContactUs;
