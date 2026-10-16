import React, { useState } from 'react';
import {View, Text, TouchableOpacity, TextInput, Image, ScrollView, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform} from 'react-native'
import Feather from '@expo/vector-icons/Feather';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar } from '../ui/kit';

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
            <StatusBar barStyle="dark-content" />
            <View className="flex-1">
                <AppBar title="Generate Room" onBack={() => navigation.goBack()} />

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
                    <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        
                        {/* Logo Picker */}
                        <View className="items-center mb-8 mt-4">
                            <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} className="relative">
                                {logo ? (
                                    <Image source={{ uri: logo.uri }} className="w-24 h-24 rounded-sheet border-2 border-line bg-paper-2" />
                                ) : (
                                    <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center">
                                        <Feather name="image" size={24} color={C.ink3} />
                                        <Text className="text-label font-display uppercase text-ink-3 mt-2">Add Logo</Text>
                                    </View>
                                )}
                                <View className="absolute -bottom-1 -right-1 bg-ink w-8 h-8 rounded-full items-center justify-center border-4 border-white">
                                    <Feather name="plus" size={14} color="white" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View className="mt-2">
                            <Text className="text-ink-3 font-display text-label uppercase mb-2 ml-1">Room Identity</Text>
                            <TextInput 
                                placeholder="e.g. Web Development, AI, Sports Talk"
                                className="bg-card p-5 mb-4 font-semibold border-[1.5px] border-ink text-ink rounded-md"
                                value={name}
                                onChangeText={setName}
                            />
                            
                            <Text className="text-ink-3 font-display text-label uppercase mb-2 ml-1">Scope & Mission</Text>
                            <TextInput 
                                placeholder="Briefly describe what happens in this room..."
                                className="bg-card p-5 mb-10 font-semibold border-[1.5px] border-ink text-ink rounded-md"
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleCreate}
                            disabled={loading}
                            className="bg-ink py-5 items-center border-2 border-ink rounded-md"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-display uppercase">Launch Room</Text>
                            )}
                        </TouchableOpacity>
                        
                        <View className="h-20" />
                    </ScrollView>
                </KeyboardAvoidingView>
            </View>
        </View>
    );
};

export default CreateSubGroupScreen;
