import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet } from 'react-native';
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

                formData.append('qrImage', {
                    uri,
                    name: filename,
                    type,
                } as any);

                const res = await axios.post('/payment/api/scan-qr', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });

                if (res.data.success && res.data.data) {
                    handleBarCodeScanned({ type: 'gallery', data: res.data.data });
                } else {
                    Alert.alert('Scan Failed', 'No QR code could be read.');
                }
            } catch (error: any) {
                console.log(error);
                Alert.alert('Scan Failed', error?.response?.data?.message || 'Failed to read QR code from image.');
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
            <SafeAreaView className="flex-1 bg-black justify-center items-center p-6">
                <Text className="text-white text-lg font-bold text-center mb-4">We need your camera permission to scan QR codes</Text>
                <TouchableOpacity onPress={requestPermission} className="bg-blue-600 p-4 rounded-xl">
                    <Text className="text-white font-bold px-4 text-lg">Grant Permission</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8">
                    <Text className="text-gray-400">Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    return (
        <View className="flex-1 bg-black">
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
                    <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4 bg-black/40 p-2 rounded-full">
                        <Ionicons name="close" size={28} color="white" />
                    </TouchableOpacity>
                    <Text className="text-xl font-bold text-white shadow-lg">Scan & Pay</Text>
                </View>

                {/* Center Target Box */}
                <View className="flex-1 justify-center items-center pointer-events-none">
                    <View className="w-64 h-64 border-[3px] border-white/70 rounded-3xl" />
                    <Text className="text-white mt-8 font-semibold bg-black/40 px-4 py-2 rounded-full overflow-hidden">
                        Align QR code within the frame
                    </Text>

                    {scanned && (
                        <TouchableOpacity
                            className="bg-blue-600 mt-6 px-6 py-3 rounded-full shadow-lg pointer-events-auto"
                            onPress={() => setScanned(false)}
                        >
                            <Text className="text-white font-bold text-lg">Tap to Scan Again</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bottom Action Sheet */}
                <View className="bg-black/80 px-4 pt-6 pb-2 rounded-t-[40px] border-t border-white/10">

                    <Text className="text-gray-300 ml-2 mb-3 font-semibold text-sm uppercase tracking-wide">Or enter manually</Text>

                    <View className="flex-row items-center">
                        <TextInput
                            className="flex-1 bg-white/10 border border-white/20 rounded-2xl p-4 text-white font-bold text-base"
                            placeholder="Mobile number or UPI ID"
                            placeholderTextColor="#9ca3af"
                            value={manualUpi}
                            onChangeText={setManualUpi}
                            autoCapitalize="none"
                        />

                        <TouchableOpacity
                            className="bg-blue-600 ml-3 h-14 w-14 items-center justify-center rounded-2xl"
                            onPress={() => proceedWithUpi(manualUpi)}
                        >
                            <Ionicons name="arrow-forward" size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    {/* Gallery Button */}
                    <View className="flex-row items-center justify-center mt-6 py-4">
                        <TouchableOpacity
                            className="bg-white/10 flex-row items-center px-6 py-3.5 rounded-full border border-white/20"
                            onPress={handleUploadFromGallery}
                            disabled={isUploading}
                        >
                            <Ionicons name="images-outline" size={22} color="white" />
                            <Text className="text-white font-bold ml-2 text-base">
                                {isUploading ? "Scanning..." : "Upload from Gallery"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

export default QRScannerScreen;
