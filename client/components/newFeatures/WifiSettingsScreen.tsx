import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    Switch,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    saveWifiCredentials,
    getWifiCredentials,
    deleteWifiCredentials,
    getWifiSettings,
    saveWifiSettings,
    WifiCredentials
} from '../../utils/wifiManager';

const WifiSettingsScreen = ({ navigation }: any) => {
    const [portalUrl, setPortalUrl] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [creds, settings] = await Promise.all([
                getWifiCredentials(),
                getWifiSettings()
            ]);

            if (creds) {
                setPortalUrl(creds.portalUrl);
                setUsername(creds.username);
                setPassword(creds.password || '');
            }
            setIsEnabled(settings.enabled);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!portalUrl || !username || !password) {
            Alert.alert("Error", "Please fill in all fields");
            return;
        }

        setIsSaving(true);
        try {
            const creds: WifiCredentials = { portalUrl, username, password };
            await saveWifiCredentials(creds);

            const settings = await getWifiSettings();
            await saveWifiSettings({ ...settings, enabled: isEnabled });

            Alert.alert("Success", "WiFi Portal settings saved successfully! ✅");
        } catch (error) {
            Alert.alert("Error", "Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            "Delete Credentials",
            "Are you sure you want to delete your stored WiFi credentials?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        await deleteWifiCredentials();
                        setPortalUrl('');
                        setUsername('');
                        setPassword('');
                        setIsEnabled(false);
                        const settings = await getWifiSettings();
                        await saveWifiSettings({ ...settings, enabled: false });
                    }
                }
            ]
        );
    };

    const toggleSwitch = async (value: boolean) => {
        setIsEnabled(value);
        if (value && (!portalUrl || !username || !password)) {
            Alert.alert("Note", "Please save your credentials before enabling the manager.");
            setIsEnabled(false);
            return;
        }
        const settings = await getWifiSettings();
        await saveWifiSettings({ ...settings, enabled: value });
    };

    if (loading) {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <ActivityIndicator size="large" color="#ec4899" />
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-black">
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                className="flex-1"
            >
                <View className="flex-row items-center px-4 py-4 border-b border-gray-900">
                    <Pressable onPress={() => navigation.goBack()} className="p-2">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </Pressable>
                    <Text className="text-white text-xl font-bold ml-2">Smart WiFi Login</Text>
                </View>

                <ScrollView className="flex-1 px-5 pt-6">
                    {/* Info Card */}
                    <View className="bg-pink-900/20 border border-pink-500/30 p-4 rounded-2xl mb-8">
                        <View className="flex-row items-center mb-2">
                            <Ionicons name="information-circle-outline" size={20} color="#f472b6" />
                            <Text className="text-pink-400 font-bold ml-2">How it works</Text>
                        </View>
                        <Text className="text-gray-300 text-sm leading-5">
                            Automatically logs you out from previous building WiFi sessions and logs you into the new ones using your credentials.
                        </Text>
                    </View>

                    {/* Form Section */}
                    <View className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 shadow-sm mb-6">
                        <Text className="text-gray-400 text-xs font-bold uppercase mb-4 tracking-wider">Portal Details</Text>

                        <View className="mb-5">
                            <Text className="text-gray-300 mb-2 ml-1">Portal URL</Text>
                            <View className="flex-row items-center bg-black rounded-xl px-4 border border-gray-800 h-14">
                                <Ionicons name="globe-outline" size={20} color="#6b7280" />
                                <TextInput
                                    className="flex-1 ml-3 text-white h-full"
                                    placeholder="https://wifi.college.edu/login"
                                    placeholderTextColor="#4b5563"
                                    value={portalUrl}
                                    onChangeText={setPortalUrl}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View className="mb-5">
                            <Text className="text-gray-300 mb-2 ml-1">Username / Email</Text>
                            <View className="flex-row items-center bg-black rounded-xl px-4 border border-gray-800 h-14">
                                <Ionicons name="person-outline" size={20} color="#6b7280" />
                                <TextInput
                                    className="flex-1 ml-3 text-white h-full"
                                    placeholder="Roll number or email"
                                    placeholderTextColor="#4b5563"
                                    value={username}
                                    onChangeText={setUsername}
                                    autoCapitalize="none"
                                />
                            </View>
                        </View>

                        <View className="mb-2">
                            <Text className="text-gray-300 mb-2 ml-1">Password</Text>
                            <View className="flex-row items-center bg-black rounded-xl px-4 border border-gray-800 h-14">
                                <Ionicons name="lock-closed-outline" size={20} color="#6b7280" />
                                <TextInput
                                    className="flex-1 ml-3 text-white h-full"
                                    placeholder="WiFi Password"
                                    placeholderTextColor="#4b5563"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />
                            </View>
                        </View>
                    </View>

                    {/* Toggle Section */}
                    <View className="bg-gray-900/50 p-6 rounded-3xl border border-gray-800 flex-row items-center justify-between mb-8">
                        <View className="flex-1 mr-4">
                            <Text className="text-white font-bold text-lg">Smart WiFi Manager</Text>
                            <Text className="text-gray-400 text-xs mt-1">Enable auto login/logout in background</Text>
                        </View>
                        <Switch
                            trackColor={{ false: '#374151', true: '#ec4899' }}
                            thumbColor={isEnabled ? '#ffffff' : '#9ca3af'}
                            ios_backgroundColor="#3e3e3e"
                            onValueChange={toggleSwitch}
                            value={isEnabled}
                        />
                    </View>

                    {/* Action Buttons */}
                    <Pressable
                        onPress={handleSave}
                        disabled={isSaving}
                        className="bg-pink-600 h-14 rounded-2xl items-center justify-center shadow-lg shadow-pink-500/20 mb-4"
                    >
                        {isSaving ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <Text className="text-white font-bold text-lg">Save Settings</Text>
                        )}
                    </Pressable>

                    {portalUrl ? (
                        <Pressable
                            onPress={handleDelete}
                            className="h-14 rounded-2xl items-center justify-center border border-red-900/50 mb-10"
                        >
                            <Text className="text-red-500 font-medium">Delete Credentials</Text>
                        </Pressable>
                    ) : null}

                    <View className="h-20" />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

export default WifiSettingsScreen;
