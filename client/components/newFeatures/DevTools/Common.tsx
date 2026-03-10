import React from 'react';
import { View, Text } from 'react-native';

export interface Tool {
    id: string;
    title: string;
    description: string;
    icon: any;
    color: string[];
    category: 'Development' | 'Utility' | 'Design' | 'DevOps';
}

export const ToolCard = ({ children }: { children: React.ReactNode }) => (
    <View className="bg-gray-900/50 p-6 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        {children}
    </View>
);

export const SectionTitle = ({ text, subText }: { text: string; subText?: string }) => (
    <View className="mb-6">
        <Text className="text-white font-black text-lg tracking-tight uppercase leading-none">{text}</Text>
        {subText && <Text className="text-gray-500 text-[10px] mt-1 font-bold uppercase tracking-widest">{subText}</Text>}
        <View className="h-[2px] w-8 bg-pink-600 mt-2 rounded-full" />
    </View>
);
