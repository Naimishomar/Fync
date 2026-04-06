import React, { useState, useEffect } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, Modal, TextInput,
    ActivityIndicator, Image, Alert, ScrollView, Switch, Platform,
    KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth.context';
import Toast from 'react-native-toast-message';

const ManageAds = () => {
    const { user } = useAuth();
    const navigation = useNavigation<any>();
    
    useEffect(() => {
        if (user?.user_access !== 'admin') {
            Alert.alert("Access Denied", "You do not have permission to view this screen.");
            navigation.goBack();
        }
    }, [user]);

    if (user?.user_access !== 'admin') {
        return null;
    }
    const [ads, setAds] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [editingAd, setEditingAd] = useState<any>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState(''); // allow pasting URL directly

    useEffect(() => {
        fetchAds();
    }, []);

    const fetchAds = async () => {
        try {
            setLoading(true);
            const res = await axios.get('/ads/all');
            if (res.data.success) setAds(res.data.ads);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });
        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
            setImageUrl(''); // clear URL if image picked
        }
    };

    const resetForm = () => {
        setTitle('');
        setLinkUrl('');
        setIsActive(true);
        setImageUri(null);
        setImageUrl('');
        setEditingAd(null);
    };

    const openCreateModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = (ad: any) => {
        setEditingAd(ad);
        setTitle(ad.title || '');
        setLinkUrl(ad.linkUrl || '');
        setIsActive(ad.isActive);
        setImageUri(null);
        setImageUrl(ad.imageUrl || '');
        setModalVisible(true);
    };

    const handleSubmit = async () => {
        if (!imageUri && !imageUrl) {
            Toast.show({ type: 'error', text1: 'Please add an image or image URL' });
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            if (imageUri) {
                const filename = imageUri.split('/').pop() || 'ad.jpg';
                const ext = filename.split('.').pop() || 'jpg';
                formData.append('image', {
                    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
                    name: filename,
                    type: `image/${ext}`,
                } as any);
            } else if (imageUrl) {
                formData.append('imageUrl', imageUrl);
            }
            formData.append('title', title);
            formData.append('linkUrl', linkUrl);
            formData.append('isActive', String(isActive));

            if (editingAd) {
                await axios.patch(`/ads/${editingAd._id}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Toast.show({ type: 'success', text1: 'Ad updated!' });
            } else {
                await axios.post('/ads', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                Toast.show({ type: 'success', text1: 'Ad created!' });
            }
            setModalVisible(false);
            resetForm();
            fetchAds();
        } catch (e: any) {
            console.error(e?.response?.data || e.message);
            Toast.show({ type: 'error', text1: 'Failed. Try again.' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Ad?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await axios.delete(`/ads/${id}`);
                        setAds(ads.filter(a => a._id !== id));
                        Toast.show({ type: 'success', text1: 'Ad deleted' });
                    } catch {
                        Toast.show({ type: 'error', text1: 'Failed to delete' });
                    }
                }
            }
        ]);
    };

    const renderAd = ({ item }: { item: any }) => (
        <View className="bg-white rounded-2xl mb-4 shadow-sm border border-gray-100 overflow-hidden">
            <Image source={{ uri: item.imageUrl }} className="w-full h-36" resizeMode="cover" />
            <View className="p-4">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                        <Text className="text-zinc-900 font-bold text-sm">{item.title || 'Untitled Ad'}</Text>
                        {item.linkUrl ? (
                            <Text className="text-pink-500 text-xs mt-0.5" numberOfLines={1}>{item.linkUrl}</Text>
                        ) : null}
                        <View className="flex-row items-center gap-2 mt-2">
                            <View className={`px-2 py-0.5 rounded-full ${item.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                                <Text className={`text-[10px] font-bold ${item.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                    {item.isActive ? 'ACTIVE' : 'INACTIVE'}
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View className="flex-row gap-2 ml-2">
                        <TouchableOpacity
                            onPress={() => openEditModal(item)}
                            className="w-9 h-9 bg-gray-50 rounded-full items-center justify-center border border-gray-200"
                        >
                            <Ionicons name="pencil" size={16} color="#1A1A1A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleDelete(item._id)}
                            className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100"
                        >
                            <Ionicons name="trash" size={16} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            {/* Header */}
            <View className="px-5 py-4 flex-row items-center justify-between bg-white border-b border-gray-100 shadow-sm">
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-1.5 bg-gray-50 rounded-full border border-gray-200">
                        <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-zinc-900 text-xl font-black">Manage Ads</Text>
                        <Text className="text-gray-500 text-xs font-medium">{ads.length} banner{ads.length !== 1 ? 's' : ''}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={openCreateModal}
                    className="flex-row items-center gap-2 bg-pink-500 px-4 py-2.5 rounded-full shadow-sm shadow-pink-500/30"
                >
                    <Ionicons name="add" size={18} color="white" />
                    <Text className="text-white font-bold text-sm">Add Ad</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color="#ec4899" size="large" />
                </View>
            ) : ads.length === 0 ? (
                <View className="flex-1 items-center justify-center pb-20">
                    <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                        <Ionicons name="image-outline" size={36} color="#d1d5db" />
                    </View>
                    <Text className="text-zinc-900 font-black text-lg">No ads yet</Text>
                    <Text className="text-gray-500 text-sm mt-1">Tap "Add Ad" to create a banner</Text>
                </View>
            ) : (
                <FlatList
                    data={ads}
                    keyExtractor={item => item._id}
                    renderItem={renderAd}
                    contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Create / Edit Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => { setModalVisible(false); resetForm(); }}>
                <View className="flex-1 bg-black/50 justify-end">
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                        <View className="bg-white rounded-t-[36px] p-6 pb-10 border-t border-gray-200">
                            {/* Grab handle */}
                            <View className="items-center mb-5">
                                <View className="w-10 h-1.5 bg-gray-300 rounded-full" />
                            </View>

                            <View className="flex-row justify-between items-center mb-6">
                                <Text className="text-zinc-900 text-xl font-black">{editingAd ? 'Edit Ad' : 'New Ad Banner'}</Text>
                                <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center">
                                    <Ionicons name="close" size={18} color="#1A1A1A" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                {/* Image Picker */}
                                <TouchableOpacity onPress={pickImage} className="w-full h-40 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 items-center justify-center mb-4 overflow-hidden">
                                    {imageUri ? (
                                        <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
                                    ) : imageUrl ? (
                                        <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
                                    ) : (
                                        <View className="items-center">
                                            <Ionicons name="image-outline" size={36} color="#9ca3af" />
                                            <Text className="text-gray-400 font-medium text-sm mt-2">Tap to pick image</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>

                                {/* Or paste URL */}
                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1.5">Or paste image URL</Text>
                                <TextInput
                                    value={imageUrl}
                                    onChangeText={t => { setImageUrl(t); setImageUri(null); }}
                                    placeholder="https://..."
                                    placeholderTextColor="#9ca3af"
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-zinc-900 font-medium mb-4"
                                />

                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1.5">Title (optional)</Text>
                                <TextInput
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder="Ad title"
                                    placeholderTextColor="#9ca3af"
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-zinc-900 font-medium mb-4"
                                />

                                <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1.5">Tap-through URL (optional)</Text>
                                <TextInput
                                    value={linkUrl}
                                    onChangeText={setLinkUrl}
                                    placeholder="https://..."
                                    placeholderTextColor="#9ca3af"
                                    className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-zinc-900 font-medium mb-4"
                                />

                                <View className="flex-row gap-4 mb-4">
                                    <View className="flex-1 justify-end">
                                        <Text className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1.5">Active</Text>
                                        <View className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 flex-row items-center justify-between">
                                            <Text className="text-zinc-700 font-medium">{isActive ? 'Visible' : 'Hidden'}</Text>
                                            <Switch
                                                value={isActive}
                                                onValueChange={setIsActive}
                                                trackColor={{ true: '#ec4899', false: '#e5e7eb' }}
                                                thumbColor="white"
                                            />
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={submitting}
                                    className={`py-4 rounded-2xl items-center justify-center flex-row shadow-md mt-2 ${submitting ? 'bg-pink-300' : 'bg-pink-500 shadow-pink-500/30'}`}
                                >
                                    {submitting ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <>
                                            <Ionicons name={editingAd ? 'save-outline' : 'cloud-upload-outline'} size={18} color="white" />
                                            <Text className="text-white font-black ml-2 uppercase tracking-widest text-xs">
                                                {editingAd ? 'Save Changes' : 'Publish Ad'}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

export default ManageAds;
