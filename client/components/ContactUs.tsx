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
    Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <View className="flex-1 bg-white items-center justify-center">
                <StatusBar barStyle="dark-content" />
                <LinearGradient colors={['#FFF7ED', '#FFFFFF']} className="absolute inset-0" />
                
                <View className="items-center px-10">
                    <View className="w-24 h-24 bg-orange-500 rounded-full items-center justify-center mb-10 shadow-2xl shadow-orange-500/40">
                        <Ionicons name="checkmark-done" size={48} color="white" />
                    </View>
                    
                    <Text className="text-zinc-900 text-4xl font-[900] text-center leading-[45px] mb-8 tracking-[-1px]">
                        Nice to meet you, we will chat soon.
                    </Text>

                    <TouchableOpacity
                        className="bg-black w-full py-6 rounded-[32px] items-center shadow-2xl shadow-black/20"
                        onPress={() => navigation.navigate('Tabs')}
                    >
                        <Text className="text-white text-base font-bold">Take me back home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Aesthetic */}
            <View className="absolute top-0 w-full h-96 opacity-20">
                <LinearGradient colors={['#f97316', 'transparent']} className="w-full h-full" />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                className="flex-1"
            >
                <ScrollView 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    <View className="px-8 mt-5">
                        <View className="mb-10">
                            <Text className="text-zinc-900 text-4xl font-black uppercase tracking-tighter">
                                Support <Text className="text-orange-500">Team</Text>
                            </Text>
                            <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[1px]">Feel Free To Contact Us</Text>
                        </View>

                        <View className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-2xl shadow-black/5 flex-row items-center mb-10">
                            <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                                <Ionicons name="business" size={20} color="#f97316" />
                            </View>
                            <View className="ml-4 flex-1">
                                <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-tight">Main HQ</Text>
                                <Text className="text-slate-400 font-bold text-[9px] uppercase mt-0.5">KIET Deemed University, UP</Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-orange-500 font-black text-[9px] uppercase">Active Now</Text>
                                <View className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shadow-sm shadow-emerald-500/50" />
                            </View>
                        </View>

                        {/* Form Card */}
                        <View className="bg-white rounded-[40px] p-8 shadow-2xl shadow-black/10 border border-slate-50">
                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2">Operator Identity</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black uppercase tracking-tight border border-slate-100"
                                    placeholder="e.g. Naimish Omar"
                                    placeholderTextColor="#CBD5E1"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2">Signal Frequency (Phone)</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black uppercase tracking-tight border border-slate-100"
                                    placeholder="+91 1234567890"
                                    placeholderTextColor="#CBD5E1"
                                    keyboardType="phone-pad"
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2">Digital Ledger (Email)</Text>
                                <TextInput
                                    className="bg-slate-50 p-5 rounded-3xl text-xs text-zinc-900 font-black uppercase tracking-tight border border-slate-100"
                                    placeholder="dev.fync@email.com"
                                    placeholderTextColor="#CBD5E1"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                />
                            </View>

                            <View className="mb-10">
                                <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px] mb-3 ml-2">Transmission Content</Text>
                                <TextInput
                                    className="bg-slate-50 p-6 rounded-[32px] text-xs text-zinc-700 font-medium min-h-[160px] border border-slate-100"
                                    placeholder='Define the requirements / issues...'
                                    placeholderTextColor="#CBD5E1"
                                    multiline
                                    numberOfLines={4}
                                    value={formData.message}
                                    onChangeText={(text) => setFormData({ ...formData, message: text })}
                                    textAlignVertical="top"
                                />
                            </View>

                            {/* Evidence */}
                            <View className="mb-12">
                                <View className="flex-row justify-between items-center mb-4 px-2">
                                    <Text className="text-[9px] font-black text-slate-400 uppercase tracking-[2px]">Visual Evidence (Max 3)</Text>
                                    <View className="bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                                        <Text className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{selectedImages.length}/3</Text>
                                    </View>
                                </View>

                                <View className="flex-row gap-4">
                                    {selectedImages.map((uri, index) => (
                                        <View key={index} className="relative w-20 h-20 rounded-[20px] overflow-hidden bg-slate-50 border border-slate-200">
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
                                            className="w-20 h-20 rounded-[20px] border border-dashed border-slate-300 justify-center items-center bg-white"
                                        >
                                            <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#CBD5E1" />
                                            <Text className="text-[8px] font-black text-slate-300 mt-1 uppercase">Attach</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.9}
                                className={`bg-zinc-900 py-6 items-center rounded-[32px] shadow-2xl shadow-black/30 ${isLoading ? 'opacity-70' : ''}`}
                                onPress={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white text-xs font-black uppercase tracking-[3px]">Deploy Transmission</Text>
                                )}
                            </TouchableOpacity>

                            <Pressable
                                onPress={() => navigation.navigate('MeetOurTeam')}
                                className="mt-8 items-center"
                            >
                                <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px]">Meet <Text className="text-orange-500">Team HQ</Text></Text>
                                <View className="w-12 h-0.5 bg-orange-500/20 mt-1 rounded-full" />
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ContactUs;
