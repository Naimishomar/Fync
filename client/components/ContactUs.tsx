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
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
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
            <View className="flex-1 bg-paper items-center justify-center">
                <StatusBar barStyle="dark-content" />
                <View className="absolute inset-0"  style={{ backgroundColor: '#EDE8E0' }} />
                
                <View className="items-center px-gutter">
                    <View className="w-24 h-24 bg-brand-500 rounded-full items-center justify-center mb-10 shadow-hair">
                        <Ionicons name="checkmark-done" size={48} color="#12100E" />
                    </View>
                    
                    <Text className="text-ink text-4xl font-[900] text-center leading-[45px] mb-8">
                        Nice to meet you, we will chat soon.
                    </Text>

                    <TouchableOpacity
                        className="bg-ink w-full py-6 items-center border-2 border-ink rounded-md"
                        onPress={() => navigation.navigate('Tabs')}
                    >
                        <Text className="text-white text-base font-semibold">Take me back home</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-paper">
            <StatusBar barStyle="dark-content" />
            
            {/* Background Aesthetic */}

            <KeyboardAvoidingView
                behavior="padding"
                className="flex-1"
            >
                <ScrollView 
                    showsVerticalScrollIndicator={false} 
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    <View className="px-gutter mt-5">
                        <View className="mb-10">
                            <TouchableOpacity
                              onPress={() => navigation.goBack()}
                              className="w-11 h-11 items-center justify-center rounded-xl"
                              accessibilityRole="button"
                              accessibilityLabel="Go back"
                              style={{ marginLeft: -11 }}
                            >
                              <Ionicons name="arrow-back" size={24} color="#12100E" />
                            </TouchableOpacity>
                            <Text className="text-ink text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Support</Text>
                            <Text className="text-accent-text text-display font-display uppercase" style={{ letterSpacing: -1.2 }}>Team</Text>
                            <Text className="text-ink-3 text-label font-display uppercase">Feel Free To Contact Us</Text>
                        </View>

                        <View
                            className="bg-card p-card-pad border-2 border-ink flex-row items-center mb-10 rounded-md"
                            style={{ shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 }}
                        >
                            <View className="w-12 h-12 bg-brand-50 rounded-card items-center justify-center">
                                <Ionicons name="business" size={20} color="#F97316" />
                            </View>
                            <View className="ml-4 flex-1">
                                <Text className="text-ink font-display uppercase text-label">Main HQ</Text>
                                <Text className="font-sans text-sm text-ink-2 mt-0.5">KIET Deemed University, UP</Text>
                            </View>
                            <View className="items-end">
                                <Text className="font-display text-label text-success uppercase">Active Now</Text>
                                <View className="w-1.5 h-1.5 bg-success rounded-full mt-1" />
                            </View>
                        </View>

                        {/* Form Card */}
                        <View className="bg-card rounded-sheet p-card-pad shadow-hair border border-line">
                            <View className="mb-8">
                                <Text className="text-label font-display text-ink-3 uppercase mb-3 ml-2">Operator Identity</Text>
                                <TextInput
                                    className="font-semibold text-base text-ink bg-card p-5 border-[1.5px] border-ink rounded-md"
                                    placeholder="e.g. Naimish Omar"
                                    placeholderTextColor="#C4BEB6"
                                    value={formData.name}
                                    onChangeText={(text) => setFormData({ ...formData, name: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-label font-display text-ink-3 uppercase mb-3 ml-2">Signal Frequency (Phone)</Text>
                                <TextInput
                                    className="font-semibold text-base text-ink bg-card p-5 border-[1.5px] border-ink rounded-md"
                                    placeholder="+91 1234567890"
                                    placeholderTextColor="#C4BEB6"
                                    keyboardType="phone-pad"
                                    value={formData.phone}
                                    onChangeText={(text) => setFormData({ ...formData, phone: text })}
                                />
                            </View>

                            <View className="mb-8">
                                <Text className="text-label font-display text-ink-3 uppercase mb-3 ml-2">Digital Ledger (Email)</Text>
                                <TextInput
                                    className="font-semibold text-base text-ink bg-card p-5 border-[1.5px] border-ink rounded-md"
                                    placeholder="dev.fync@email.com"
                                    placeholderTextColor="#C4BEB6"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    value={formData.email}
                                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                                />
                            </View>

                            <View className="mb-10">
                                <Text className="text-label font-display text-ink-3 uppercase mb-3 ml-2">Transmission Content</Text>
                                <TextInput
                                    className="bg-card p-6 text-xs text-ink-2 font-medium min-h-[160px] border-[1.5px] border-ink rounded-md"
                                    placeholder='Define the requirements / issues...'
                                    placeholderTextColor="#C4BEB6"
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
                                    <Text className="text-label font-display text-ink-3 uppercase">Visual Evidence (Max 3)</Text>
                                    <View className="bg-paper-2 border border-line px-2.5 py-1 rounded-full">
                                        <Text className="text-label text-ink-3 font-display uppercase">{selectedImages.length}/3</Text>
                                    </View>
                                </View>

                                <View className="flex-row gap-4">
                                    {selectedImages.map((uri, index) => (
                                        <View key={index} className="relative w-20 h-20 rounded-card overflow-hidden bg-paper-2 border border-line">
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
                                            className="w-20 h-20 rounded-card border border-dashed border-line justify-center items-center bg-card"
                                        >
                                            <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#C4BEB6" />
                                            <Text className="text-label font-display text-ink-4 mt-1 uppercase">Attach</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>

                            <TouchableOpacity
                                activeOpacity={0.9}
                                className={`bg-ink py-6 items-center rounded-sheet shadow-hair ${isLoading ? 'opacity-70' : ''}`}
                                onPress={handleSubmit}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="font-display text-paper uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Deploy Transmission</Text>
                                )}
                            </TouchableOpacity>

                            <Pressable
                                onPress={() => navigation.navigate('MeetOurTeam')}
                                className="mt-8 items-center"
                            >
                                <Text className="text-ink-3 text-label font-display uppercase">Meet <Text className="text-accent-text">Team HQ</Text></Text>
                                <View className="w-12 h-0.5 bg-brand-500/20 mt-1 rounded-full" />
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ContactUs;
