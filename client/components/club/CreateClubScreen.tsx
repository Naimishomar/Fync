import React, { useState } from 'react';
import { View, Pressable, Image, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn, Button, FormField } from '../ui/kit';
import { ImagePick } from '../community/shared';

const CreateClubScreen = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [logo, setLogo] = useState<any>(null);
    const [banner, setBanner] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const pickImage = async (type: 'logo' | 'banner') => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: type === 'logo' ? [1, 1] : [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            if (type === 'logo') setLogo(result.assets[0]);
            else setBanner(result.assets[0]);
        }
    };

    const handleCreate = async () => {
        if (!name.trim() || !category.trim()) {
            Alert.alert("Required", "Club name and category are mandatory");
            return;
        }

        setLoading(true);
        const formData = new FormData();
        formData.append('name', name);
        formData.append('description', description);
        formData.append('category', category);
        formData.append('creatorId', user?._id);

        if (logo) {
            formData.append('logo', {
                uri: logo.uri,
                name: 'logo.jpg',
                type: 'image/jpeg'
            } as any);
        }
        if (banner) {
            formData.append('banner', {
                uri: banner.uri,
                name: 'banner.jpg',
                type: 'image/jpeg'
            } as any);
        }

        try {
            const res = await axios.post('/clubs/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (res.data.success) {
                Alert.alert("Success", "Club generated successfully!");
                // replace: back from the new hub should not land on a filled-in create form.
                navigation.replace('ClubHub', { clubId: res.data.club?._id });
            }
        } catch (error: any) {
            Alert.alert("Failed", error.response?.data?.message || "Creation error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />
            <AppBar title="New club" right={<IconBtn name="close" onPress={() => navigation.goBack()} accessibilityLabel="Close" />} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <ImagePick uri={banner?.uri} onPress={() => pickImage('banner')} label="Upload banner (16:9)" style={{ width: '100%', height: 160 }} />

                    <Pressable
                        onPress={() => pickImage('logo')}
                        accessibilityRole="button"
                        accessibilityLabel={logo ? 'Change logo' : 'Upload logo'}
                        className="w-24 h-24 rounded-2xl bg-card border-4 border-card shadow-hair overflow-hidden -mt-12 ml-6 items-center justify-center active:opacity-70"
                    >
                        {logo ? (
                            <Image source={{ uri: logo.uri }} className="w-full h-full" />
                        ) : (
                            <Feather name="camera" size={24} color={C.ink3} />
                        )}
                    </Pressable>

                    <View style={{ gap: 16, marginTop: 24, marginBottom: 24 }}>
                        <FormField label="Club name" placeholder="Club name" value={name} onChangeText={setName} />
                        <FormField label="Category" placeholder="e.g. Technical, Sports" value={category} onChangeText={setCategory} />
                        <FormField label="About" placeholder="Describe the club's goal" multiline value={description} onChangeText={setDescription} />
                    </View>

                    <Button title="Create club" variant="primary" block loading={loading} onPress={handleCreate} />
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

export default CreateClubScreen;
