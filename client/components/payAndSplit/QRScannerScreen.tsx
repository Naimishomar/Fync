import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import axios from '../../context/axiosConfig';
import Toast from 'react-native-toast-message';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'QRScannerScreen'>;

const QRScannerScreen = () => {
    const navigation = useNavigation<NavigationProp>();
    const [manualUpi, setManualUpi] = useState('');
    const [scanned, setScanned] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();


    const proceedWithUpi = (upiId: string, name: string = 'Merchant') => {
        if (!upiId) return;
        navigation.navigate('EnterAmountScreen' as any, {
            merchantUpiId: upiId,
            merchantName: name
        });
    };

    const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
        setScanned(true);
        if (data.includes('upi://')) {
            const paMatch = data.match(/pa=([^&]+)/);
            const pnMatch = data.match(/pn=([^&]+)/);
            const vendorUpiId = paMatch ? decodeURIComponent(paMatch[1]) : '';
            let vendorName = pnMatch ? decodeURIComponent(pnMatch[1]) : 'Merchant';
            vendorName = vendorName.replace(/\+/g, ' ');

            if (vendorUpiId) {
                proceedWithUpi(vendorUpiId, vendorName);
            } else {
                Alert.alert('Invalid QR', 'No UPI ID found in barcode. Please scan a valid merchant QR.', [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]);
            }
        } else {
            // Attempt to just pass the string if it's a raw UPI id, otherwise error
            if (data.includes('@')) {
                proceedWithUpi(data, 'Merchant');
            } else {
                Alert.alert('Invalid QR', 'Not a valid UPI QR code.', [
                    { text: 'OK', onPress: () => setScanned(false) }
                ]);
            }
        }
    };

    const handleUploadFromGallery = async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
            Toast.show({ type: 'error', text1: 'Gallery permission required' });
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 1,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setIsUploading(true);
            try {
                const formData = new FormData();
                const uri = result.assets[0].uri;
                const filename = uri.split('/').pop() || 'qr.jpg';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `image/${match[1]}` : 'image/jpeg';

                console.log("📤 Sending Scan QR Request...");
                console.log("📍 URI:", uri);
                console.log("📄 Filename:", filename);
                console.log("🏷️ Type:", type);
                console.log("🔗 BaseURL:", axios.defaults.baseURL);

                formData.append('qrImage', {
                    uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
                    name: filename,
                    type,
                } as any);

                const res = await axios.post('/payment/scan-qr', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });

                console.log("📥 Scan QR Response Received:", res.data);

                if (res.data.success && res.data.data) {
                    handleBarCodeScanned({ type: 'gallery', data: res.data.data });
                } else {
                    Alert.alert('Scan Failed', 'No QR code could be read.');
                }
            } catch (error: any) {
                console.log("❌ Axios Error:", error);
                if (error.response) {
                    console.log("❌ Response Data:", error.response.data);
                    console.log("❌ Response Status:", error.response.status);
                } else if (error.request) {
                    console.log("❌ Request Object [No Response]:", error.request);
                }
                Alert.alert('Scan Failed', error?.response?.data?.message || 'Network error while scanning QR.');
            } finally {
                setIsUploading(false);
            }
        }
    };


    if (!permission) {
        return <View className="flex-1 bg-black" />;
    }

    if (!permission.granted) {
        return (
            <SafeAreaView className="flex-1 bg-[#F5F7FA] justify-center items-center p-8">
                <View className="bg-white p-10 rounded-3xl items-center border border-gray-100 shadow-sm">
                    <Ionicons name="camera-outline" size={64} color="#ec4899" className="mb-6" />
                    <Text className="text-zinc-900 text-xl font-black italic tracking-tighter text-center mb-2">Camera Access Required</Text>
                    <Text className="text-gray-500 text-sm text-center mb-8 font-medium">We need your camera permission to scan merchant QR codes and process payments.</Text>
                    <TouchableOpacity onPress={requestPermission} className="bg-pink-500 py-4 px-10 rounded-2xl shadow-lg shadow-pink-500/20">
                        <Text className="text-white font-black italic uppercase tracking-tight">Allow Access</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8">
                    <Text className="text-gray-400 font-bold uppercase tracking-widest text-xs">Maybe Later</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-black">
            <StatusBar barStyle="light-content" />
            
            {/* Full Screen Camera */}
            <CameraView
                onBarcodeScanned={scanned || isUploading ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
                style={StyleSheet.absoluteFillObject}
            />

            {/* Top Header Overlay */}
            <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
                <View className="flex-row items-center p-4 w-full">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 bg-black/50 p-3 rounded-full border border-white/20">
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-xl font-black italic tracking-tighter text-white shadow-xl">Scan & <Text className="text-pink-500">Pay</Text> ⚡️</Text>
                </View>

                {/* Center Target Box */}
                <View className="flex-1 justify-center items-center pointer-events-none">
                    <View className="w-64 h-64 border-2 border-white/40 rounded-2xl relative">
                         <View className="absolute top-0 left-0 w-8 h-8 border-t-[4px] border-l-[4px] border-pink-500 rounded-tl-xl -mt-1 -ml-1" />
                         <View className="absolute top-0 right-0 w-8 h-8 border-t-[4px] border-r-[4px] border-pink-500 rounded-tr-xl -mt-1 -mr-1" />
                         <View className="absolute bottom-0 left-0 w-8 h-8 border-b-[4px] border-l-[4px] border-pink-500 rounded-bl-xl -mb-1 -ml-1" />
                         <View className="absolute bottom-0 right-0 w-8 h-8 border-b-[4px] border-r-[4px] border-pink-500 rounded-br-xl -mb-1 -mr-1" />
                    </View>
                    
                    <View className="bg-black/60 px-6 py-2.5 rounded-full mt-10 border border-white/10">
                        <Text className="text-white font-bold text-xs uppercase tracking-widest">
                            {scanned ? "Scanned Successfully" : "Center the QR in frame"}
                        </Text>
                    </View>

                    {scanned && (
                        <TouchableOpacity
                            className="bg-pink-500 mt-6 px-8 py-3.5 rounded-2xl shadow-lg pointer-events-auto"
                            onPress={() => setScanned(false)}
                        >
                            <Text className="text-white font-black italic uppercase tracking-tight">Scan Again</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Action Sheet */}
                <View className="bg-white px-6 pt-6 pb-10 rounded-t-3xl border-t border-gray-100 shadow-2xl">
                    <View className="w-12 h-1.5 bg-gray-100 rounded-full self-center mb-6" />
                    
                    <Text className="text-gray-400 ml-2 mb-4 font-black uppercase text-[10px] tracking-widest">Or enter manually</Text>

                    <View className="flex-row items-center mb-6 bg-gray-50 border border-gray-100 px-3 rounded-2xl">
                        <View className="flex-1 flex-row items-center bg-gray-50 rounded-2xl py-3.5">
                            <Ionicons name="at" size={20} color="#ec4899" />
                            <TextInput
                                className="flex-1 text-zinc-900 font-bold ml-1 text-base"
                                placeholder="UPI ID"
                                placeholderTextColor="#9ca3af"
                                value={manualUpi}
                                onChangeText={setManualUpi}
                                autoCapitalize="none"
                            />
                        </View>

                        <TouchableOpacity
                            className="bg-zinc-900 h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-black/10"
                            onPress={() => proceedWithUpi(manualUpi)}
                        >
                            <Ionicons name="arrow-forward" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Gallery Button */}
                    <TouchableOpacity
                        className="bg-white flex-row items-center justify-center py-4 rounded-2xl border border-gray-100 shadow-sm"
                        onPress={handleUploadFromGallery}
                        disabled={isUploading}
                    >
                        <Ionicons name="images-outline" size={22} color="#4b5563" />
                        <Text className="text-zinc-600 font-black italic uppercase tracking-tighter ml-3">
                            {isUploading ? "Reading QR..." : "Upload from Gallery"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default QRScannerScreen;
