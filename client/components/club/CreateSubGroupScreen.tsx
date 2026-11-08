import React, { useState } from 'react';
import { View, Pressable, Image, ScrollView, StatusBar, KeyboardAvoidingView, Platform } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button, Label, FormField } from '../ui/kit';

const CreateSubGroupScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params ?? {};
    const { user } = useAuth();
    
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [logo, setLogo] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const pickLogo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });

        if (!result.canceled) {
            setLogo(result.assets[0]);
        }
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            Alert.alert("Required", "Room name is mandatory");
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('clubId', clubId);
            formData.append('name', name);
            formData.append('description', description);
            formData.append('adminId', user?._id);

            if (logo) {
                const uriParts = logo.uri.split('.');
                const fileType = uriParts[uriParts.length - 1];
                formData.append('logo', {
                    uri: logo.uri,
                    name: `logo.${fileType}`,
                    type: `image/${fileType}`,
                } as any);
            }

            const res = await axios.post('/clubs/subgroup/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (res.data.success) {
                Alert.alert("Success", "Room generated successfully!");
                navigation.goBack();
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
            <AppBar title="New room" onBack={() => navigation.goBack()} />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                <ScrollView className="flex-1" contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View className="items-center mb-6 mt-4">
                        <Pressable onPress={pickLogo} accessibilityRole="button" accessibilityLabel={logo ? 'Change logo' : 'Add logo'} className="relative active:opacity-70">
                            {logo ? (
                                <Image source={{ uri: logo.uri }} className="w-24 h-24 rounded-2xl border border-line bg-paper-2" />
                            ) : (
                                <View className="w-24 h-24 bg-paper-2 rounded-2xl items-center justify-center">
                                    <Feather name="image" size={24} color={C.ink3} />
                                    <Label style={{ marginTop: 4 }}>Add logo</Label>
                                </View>
                            )}
                            <View className="absolute -bottom-1 -right-1 bg-ink w-8 h-8 rounded-full items-center justify-center border-4 border-card">
                                <Feather name="plus" size={14} color={C.paper} />
                            </View>
                        </Pressable>
                    </View>

                    <View style={{ gap: 16, marginBottom: 24 }}>
                        <FormField label="Room name" placeholder="e.g. Web Development, AI, Sports Talk" value={name} onChangeText={setName} />
                        <FormField label="About" placeholder="Briefly describe what happens in this room" multiline value={description} onChangeText={setDescription} />
                    </View>

                    <Button title="Create room" variant="primary" block loading={loading} onPress={handleCreate} />
                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

export default CreateSubGroupScreen;
