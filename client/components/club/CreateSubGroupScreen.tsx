import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, 
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';

const CreateSubGroupScreen = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const { clubId } = route.params;
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
        <View className="flex-1 bg-white">
            <StatusBar barStyle="dark-content" />
            <SafeAreaView className="flex-1" edges={['top']}>
                {/* Header */}
                <View className="px-5 py-4 flex-row items-center justify-between border-b border-zinc-100">
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={28} color="black" />
                    </TouchableOpacity>
                    <View className="items-center">
                        <Text className="text-zinc-900 text-lg font-black uppercase tracking-widest">Generate Room</Text>
                        <Text className="text-zinc-400 text-[8px] font-bold uppercase tracking-widest mt-0.5">Expanding your Hub</Text>
                    </View>
                    <View className="w-8" />
                </View>

                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
                    <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
                        
                        {/* Logo Picker */}
                        <View className="items-center mb-8 mt-4">
                            <TouchableOpacity onPress={pickLogo} activeOpacity={0.8} className="relative">
                                {logo ? (
                                    <Image source={{ uri: logo.uri }} className="w-24 h-24 rounded-[32px] border-2 border-zinc-100 bg-zinc-50" />
                                ) : (
                                    <View className="w-24 h-24 bg-zinc-50 rounded-[32px] items-center justify-center border-2 border-dashed border-zinc-200">
                                        <Feather name="image" size={24} color="#a1a1aa" />
                                        <Text className="text-[8px] font-black uppercase text-zinc-400 mt-2">Add Logo</Text>
                                    </View>
                                )}
                                <View className="absolute -bottom-1 -right-1 bg-black w-8 h-8 rounded-full items-center justify-center border-4 border-white">
                                    <Feather name="plus" size={14} color="white" />
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Form Fields */}
                        <View className="mt-2">
                            <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Room Identity</Text>
                            <TextInput 
                                placeholder="e.g. Web Development, AI, Sports Talk"
                                className="bg-zinc-50 p-5 rounded-2xl mb-4 font-bold border border-zinc-100 text-zinc-900"
                                value={name}
                                onChangeText={setName}
                            />
                            
                            <Text className="text-zinc-400 font-black text-[10px] uppercase tracking-widest mb-2 ml-1">Scope & Mission</Text>
                            <TextInput 
                                placeholder="Briefly describe what happens in this room..."
                                className="bg-zinc-50 p-5 rounded-2xl mb-10 font-semibold border border-zinc-100 text-zinc-900"
                                multiline
                                numberOfLines={4}
                                value={description}
                                onChangeText={setDescription}
                            />
                        </View>

                        <TouchableOpacity 
                            onPress={handleCreate}
                            disabled={loading}
                            className="bg-black py-5 rounded-3xl items-center shadow-xl shadow-black/20"
                        >
                            {loading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-black uppercase tracking-widest">Launch Room</Text>
                            )}
                        </TouchableOpacity>
                        
                        <View className="h-20" />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default CreateSubGroupScreen;
