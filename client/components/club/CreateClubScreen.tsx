import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, TextInput, Image, ScrollView, 
  ActivityIndicator, Alert, StatusBar, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';

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
                navigation.navigate('ClubHub', { clubId: res.data.club._id });
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
                <View className="px-5 py-4 flex-row items-center justify-between border-b border-slate-100">
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Ionicons name="close" size={28} color="black" />
                    </TouchableOpacity>
                    <Text className="text-slate-900 text-lg font-black uppercase tracking-widest">Establish Club</Text>
                    <View className="w-7"></View>
                </View>

                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
                        
                        {/* Banner Upload */}
                        <TouchableOpacity 
                            onPress={() => pickImage('banner')}
                            className="w-full h-40 bg-slate-100 rounded-3xl overflow-hidden items-center justify-center border border-dashed border-slate-300"
                        >
                            {banner ? (
                                <Image source={{ uri: banner.uri }} className="w-full h-full" />
                            ) : (
                                <View className="items-center">
                                    <Feather name="image" size={32} color="#a1a1aa" />
                                    <Text className="text-slate-500 font-bold text-2xs uppercase mt-2">Upload Banner (16:9)</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {/* Logo Upload */}
                        <TouchableOpacity 
                            onPress={() => pickImage('logo')}
                            className="w-24 h-24 rounded-3xl bg-white border-4 border-white shadow-lg overflow-hidden -mt-12 ml-6 items-center justify-center"
                        >
                            {logo ? (
                                <Image source={{ uri: logo.uri }} className="w-full h-full" />
                            ) : (
                                <Feather name="camera" size={24} color="#a1a1aa" />
                            )}
                        </TouchableOpacity>

                        {/* Form Fields */}
                        <View className="mt-8">
                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2 ml-1">Identity</Text>
                            <TextInput 
                                placeholder="Club Name"
                                className="bg-slate-50 p-5 rounded-2xl mb-4 font-bold border border-slate-100 text-slate-900"
                                value={name}
                                onChangeText={setName}
                            />
                            
                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2 ml-1">Specialization</Text>
                            <TextInput 
                                placeholder="Category (e.g. Technical, Sports)"
                                className="bg-slate-50 p-5 rounded-2xl mb-4 font-bold border border-slate-100 text-slate-900"
                                value={category}
                                onChangeText={setCategory}
                            />

                            <Text className="text-slate-500 font-black text-2xs uppercase tracking-wide mb-2 ml-1">Mission Statement</Text>
                            <TextInput 
                                placeholder="Describe the club's goal..."
                                className="bg-slate-50 p-5 rounded-2xl mb-6 font-semibold border border-slate-100 text-slate-900"
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
                                <Text className="text-white font-black uppercase tracking-widest">Establish Community</Text>
                            )}
                        </TouchableOpacity>
                        
                        <View className="h-20" />
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

export default CreateClubScreen;
