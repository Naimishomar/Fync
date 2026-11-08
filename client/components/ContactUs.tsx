import React, { useState } from 'react';
import { View, Text, KeyboardAvoidingView, ScrollView, Image, Pressable, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import axios from '../context/axiosConfig';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { C } from '../constants/colors';
import { AppBar, Button, Card, Display, FormField, H1, IconTile, ListRow, Tag } from './ui/kit';

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
        const { name, phone, email, message } = formData;
        if (!name.trim() || !phone.trim() || !email.trim() || !message.trim()) {
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

            // Any 2xx is a success (axios throws on the rest); a 200 used to
            // leave the user on the form with no feedback at all.
            if (res.status >= 200 && res.status < 300) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
            <View className="flex-1 bg-paper items-center justify-center px-gutter">
                <StatusBar barStyle={C.barStyle} />
                <IconTile icon="checkmark-done" size={80} iconSize={36} bg={C.brand[100]} color={C.accentText} style={{ marginBottom: 24 }} />
                <H1 style={{ textAlign: 'center', marginBottom: 24 }}>Nice to meet you, we will chat soon.</H1>
                <Button title="Take me back home" variant="primary" block onPress={() => navigation.navigate('Tabs')} />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
            <StatusBar barStyle={C.barStyle} />

            <AppBar title="Contact us" onBack={() => navigation.goBack()} />

            <KeyboardAvoidingView behavior="padding" className="flex-1">
                <ScrollView keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 100 }}
                >
                    <View className="px-gutter mt-2">
                        <View className="mb-6">
                            <Display>Support team</Display>
                            <Text className="text-ink-3 text-sm mt-1">Feel free to contact us</Text>
                        </View>

                        <Card style={{ paddingHorizontal: 16, marginBottom: 24 }}>
                            <ListRow
                                icon="business-outline"
                                title="Main HQ"
                                subtitle="KIET Deemed University, UP"
                                right={<Tag label="Active now" icon="ellipse" tone={{ fg: C.success }} />}
                            />
                        </Card>

                        <Card padded style={{ gap: 16 }}>
                            <FormField
                                label="Name"
                                placeholder="e.g. Naimish Omar"
                                value={formData.name}
                                onChangeText={(text) => setFormData({ ...formData, name: text })}
                            />
                            <FormField
                                label="Phone"
                                placeholder="+91 1234567890"
                                keyboardType="phone-pad"
                                value={formData.phone}
                                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                            />
                            <FormField
                                label="Email"
                                placeholder="dev.fync@email.com"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={formData.email}
                                onChangeText={(text) => setFormData({ ...formData, email: text })}
                            />
                            <FormField
                                label="Message"
                                placeholder="Describe your requirement or issue"
                                multiline
                                numberOfLines={4}
                                value={formData.message}
                                onChangeText={(text) => setFormData({ ...formData, message: text })}
                            />

                            {/* Attachments */}
                            <View>
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-sm font-semibold text-ink-2">Screenshots (up to 3)</Text>
                                    <Text className="text-label text-ink-3">{selectedImages.length}/3</Text>
                                </View>
                                <View className="flex-row" style={{ gap: 12 }}>
                                    {selectedImages.map((uri, index) => (
                                        <View key={index} className="w-20 h-20 rounded-2xl overflow-hidden bg-paper-2 border border-line">
                                            <Image source={{ uri }} className="w-full h-full" />
                                            <Pressable
                                                onPress={() => removeImage(index)}
                                                hitSlop={12}
                                                className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1 active:opacity-85"
                                                accessibilityRole="button"
                                                accessibilityLabel={`Remove screenshot ${index + 1}`}
                                            >
                                                <Ionicons name="close" size={12} color="white" />
                                            </Pressable>
                                        </View>
                                    ))}
                                    {selectedImages.length < 3 && (
                                        <Pressable
                                            onPress={pickImages}
                                            className="w-20 h-20 rounded-2xl border border-dashed border-line justify-center items-center bg-paper-2 active:opacity-85"
                                            accessibilityRole="button"
                                            accessibilityLabel="Attach screenshot"
                                        >
                                            <MaterialCommunityIcons name="camera-plus-outline" size={24} color={C.ink3} />
                                            <Text className="text-label font-semibold text-ink-3 mt-1">Attach</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>

                            <Button title="Send message" variant="primary" block loading={isLoading} onPress={handleSubmit} style={{ marginTop: 8 }} />
                            <Button title="Meet the team" variant="tertiary" block onPress={() => navigation.navigate('MeetOurTeam')} />
                        </Card>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default ContactUs;
