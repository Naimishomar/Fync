import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StampCard } from '../ui/kit';
export default function UtilityHubScreen() {
  const navigation = useNavigation<any>();

  const tools = [
    {
      id: 'imageToPdf',
      title: 'Image to PDF',
      description: 'Convert multiple images into a single PDF document instantly.',
      icon: 'document-text-outline',
      color: ['#F97316', '#F97316'],
      route: 'ImageToPdfScreen',
    },
    {
      id: 'imageCompressor',
      title: 'Image Compressor',
      description: 'Reduce image file size for university portals and uploads.',
      icon: 'compress-outline',
      color: ['#0891B2', '#0891B2'],
      route: 'ImageCompressorScreen',
    },
    {
      id: 'qrCode',
      title: 'QR Generator',
      description: 'Generate custom QR codes for your links or text instantly.',
      icon: 'qr-code-outline',
      color: ['#7C3AED', '#7C3AED'],
      route: 'QRCodeToolScreen',
    },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: '#ffffff' }}>
      <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 25 : 0 }}>
        {/* Header */}
        <View className="px-5 py-4 flex-row items-center justify-between border-b border-brand-100 bg-transparent">
          <View className="flex-row items-center">
          <TouchableOpacity onPress={() => navigation.goBack()} className="w-11 h-11 items-center justify-center rounded-xl"
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <Text className="text-xl font-display text-ink">Utility Hub</Text>
        </View>
        <Ionicons name="construct-outline" size={24} color="#F97316" />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <StampCard style={{ marginBottom: 24 }}>
          <View className="p-card-pad flex-row items-start" style={{ gap: 12 }}>
            <Ionicons name="lock-closed-outline" size={26} color="#047857" />
            <View className="flex-1">
              <Text className="font-semibold text-base text-ink">Everything runs on your phone</Text>
              <Text className="font-sans text-sm text-ink-2 mt-2">
                Files never leave the device. No internet, no cost, no account.
              </Text>
            </View>
          </View>
        </StampCard>

        <View className="flex-row items-center mt-2 mb-3" style={{ gap: 12 }}>
          <Text className="font-display text-label text-ink uppercase">Tools</Text>
          <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
          <Text className="font-display text-label text-ink-3">{tools.length}</Text>
        </View>

        <View className="flex-col gap-4 pb-10">
          {tools.map((tool) => (
            <TouchableOpacity
              key={tool.id}
              activeOpacity={0.7}
              onPress={() => navigation.navigate(tool.route)}
              className="bg-card rounded-card p-5 border border-line shadow-hair flex-row items-center"
            >
              <View
                style={{ backgroundColor: tool.color[0] }}
                className="w-14 h-14 rounded-card items-center justify-center shadow-hair"
              >
                <Ionicons name={tool.icon as any} size={26} color="#12100E" />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-lg font-display text-ink mb-1">{tool.title}</Text>
                <Text className="text-xs text-ink-3 font-medium leading-tight pr-2">
                  {tool.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#C4BEB6" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}
