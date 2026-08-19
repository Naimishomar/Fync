import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UtilityHubScreen() {
  const navigation = useNavigation<any>();

  const tools = [
    {
      id: 'imageToPdf',
      title: 'Image to PDF',
      description: 'Convert multiple images into a single PDF document instantly.',
      icon: 'document-text-outline',
      color: ['#f97316', '#fb923c'],
      route: 'ImageToPdfScreen',
    },
    {
      id: 'imageCompressor',
      title: 'Image Compressor',
      description: 'Reduce image file size for university portals and uploads.',
      icon: 'compress-outline',
      color: ['#0ea5e9', '#38bdf8'],
      route: 'ImageCompressorScreen',
    },
    {
      id: 'qrCode',
      title: 'QR Generator',
      description: 'Generate custom QR codes for your links or text instantly.',
      icon: 'qr-code-outline',
      color: ['#8b5cf6', '#a78bfa'],
      route: 'QRCodeToolScreen',
    },
  ];

  return (
    <LinearGradient colors={['#ffffff', '#fff7ed', '#ffedd5']} className="flex-1">
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
        {/* Header */}
        <View className="px-5 py-4 flex-row items-center justify-between border-b border-orange-100 bg-transparent">
          <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <Text className="text-xl font-black text-slate-900 tracking-tight">Utility Hub</Text>
        </View>
        <Ionicons name="construct-outline" size={24} color="#f97316" />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-slate-500 text-sm mb-6 leading-relaxed font-medium">
          Powerful offline tools that run directly on your device. Zero internet required, zero cost, and 100% private.
        </Text>

        <View className="flex-col gap-4 pb-10">
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(tool.route)}
              className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex-row items-center"
            >
              <LinearGradient
                colors={tool.color as any}
                className="w-14 h-14 rounded-2xl items-center justify-center shadow-sm"
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name={tool.icon as any} size={28} color="white" />
              </LinearGradient>
              <View className="flex-1 ml-4">
                <Text className="text-lg font-bold text-slate-900 mb-1">{tool.title}</Text>
                <Text className="text-xs text-slate-500 font-medium leading-tight pr-2">
                  {tool.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
