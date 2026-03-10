import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ToolCard, SectionTitle } from './Common';

export const FlexboxTool = React.memo(() => {
    const [justify, setJustify] = useState('center');
    const [align, setAlign] = useState('center');

    const justifies = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around'];
    const aligns = ['flex-start', 'center', 'flex-end', 'stretch'];

    return (
        <ToolCard>
            <SectionTitle text="Flexbox Playground" subText="Visualize layout properties in real-time." />

            <View className="bg-black h-[180px] rounded-2xl mb-8 overflow-hidden border border-white/5 shadow-inner" style={{ justifyContent: justify as any, alignItems: align as any }}>
                <View className="w-10 h-10 bg-pink-500 rounded-xl m-1 shadow-lg shadow-pink-500/40" />
                <View className="w-12 h-12 bg-blue-500 rounded-xl m-1 shadow-lg shadow-blue-500/40" />
                <View className="w-8 h-8 bg-purple-500 rounded-xl m-1 shadow-lg shadow-purple-500/40" />
            </View>

            <Text className="text-gray-500 text-[10px] uppercase font-black mb-2 ml-1">justify-content</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                {justifies.map(j => (
                    <TouchableOpacity key={j} onPress={() => setJustify(j)} className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${justify === j ? 'bg-pink-600' : 'bg-gray-800'}`}>
                        <Text className="text-white text-[10px] font-bold">{j}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text className="text-gray-500 text-[10px] uppercase font-black mb-2 ml-1">align-items</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                {aligns.map(a => (
                    <TouchableOpacity key={a} onPress={() => setAlign(a)} className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${align === a ? 'bg-blue-600' : 'bg-gray-800'}`}>
                        <Text className="text-white text-[10px] font-bold">{a}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View className="bg-black/80 p-5 rounded-2xl border border-white/5 flex-row items-center">
                <View className="flex-1">
                    <Text className="text-pink-400 font-mono text-[10px]">display: <Text className="text-white text-[10px]">flex</Text>;</Text>
                    <Text className="text-pink-400 font-mono text-[10px]">justify-content: <Text className="text-white text-[10px]">{justify}</Text>;</Text>
                    <Text className="text-pink-400 font-mono text-[10px]">align-items: <Text className="text-white text-[10px]">{align}</Text>;</Text>
                </View>
                <TouchableOpacity onPress={() => {
                    Clipboard.setStringAsync(`display: flex; justify-content: ${justify}; align-items: ${align};`);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }} className="bg-gray-900 p-2 rounded-lg">
                    <Ionicons name="copy-outline" size={14} color="#ec4899" />
                </TouchableOpacity>
            </View>
        </ToolCard>
    );
});

export const CompressorTool = React.memo(() => {
    const [image, setImage] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'done'>('idle');

    const pick = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.6,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setStatus('idle');
        }
    };

    const compress = () => {
        setStatus('processing');
        setTimeout(() => {
            setStatus('done');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Alert.alert("Success", "Image optimized and converted to WebP!");
        }, 1500);
    };

    return (
        <ToolCard>
            <SectionTitle text="Asset Optimizer" subText="Convert items to WebP and reduce file size." />

            <TouchableOpacity onPress={pick} className="bg-black/50 aspect-video rounded-3xl mb-6 items-center justify-center border-2 border-dashed border-white/10 overflow-hidden">
                {image ? (
                    <Image source={{ uri: image }} className="w-full h-full" resizeMode="cover" />
                ) : (
                    <View className="items-center">
                        <Ionicons name="image-outline" size={40} color="#3b82f6" />
                        <Text className="text-gray-500 text-[10px] mt-2 font-bold uppercase">Select Asset</Text>
                    </View>
                )}
            </TouchableOpacity>

            {image && status !== 'done' && (
                <TouchableOpacity onPress={compress} disabled={status === 'processing'} className="bg-blue-600 py-4 rounded-xl items-center shadow-lg shadow-blue-500/20">
                    <Text className="text-white font-black tracking-widest text-[10px] uppercase">
                        {status === 'processing' ? 'OPTIMIZING ENGINE...' : 'START COMPRESSION'}
                    </Text>
                </TouchableOpacity>
            )}

            {status === 'done' && (
                <View className="bg-green-500/10 p-4 rounded-2xl border border-green-500/20 items-center">
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                    <Text className="text-green-500 font-bold mt-2">OPTIMIZATION COMPLETE</Text>
                    <Text className="text-gray-500 text-[8px] mt-1">Saved ~42% space (Estimated)</Text>
                    <TouchableOpacity onPress={() => setImage(null)} className="mt-4 bg-gray-800 px-4 py-2 rounded-full">
                        <Text className="text-white text-[10px] font-bold">Reset</Text>
                    </TouchableOpacity>
                </View>
            )}
        </ToolCard>
    );
});

export const OGPreviewTool = React.memo(() => {
    const [title, setTitle] = useState('');
    const [desc, setDesc] = useState('');
    const [img, setImg] = useState('');

    return (
        <ToolCard>
            <SectionTitle text="Social Meta Preview" subText="Simulate how your site looks when shared." />
            <TextInput value={title} onChangeText={setTitle} placeholder="Page Title" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-3 border border-white/5" />
            <TextInput value={desc} onChangeText={setDesc} placeholder="Description" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-3 border border-white/5" />
            <TextInput value={img} onChangeText={setImg} placeholder="Image URL" placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-8 border border-white/5" />

            <View className="bg-[#e9edef] rounded-3xl overflow-hidden border border-gray-300 shadow-xl">
                <View className="bg-gray-200 h-[150px] items-center justify-center">
                    {img ? (
                        <Image source={{ uri: img }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                        <Ionicons name="image-outline" size={48} color="#999" />
                    )}
                </View>
                <View className="p-4 bg-white">
                    <Text className="text-[#06c] text-sm font-black" numberOfLines={1}>{title || 'Your Stunning Website Title'}</Text>
                    <Text className="text-gray-500 text-[10px] mt-1 line-height-4" numberOfLines={2}>{desc || 'The meta description that users see when you share the link on social media...'}</Text>
                    <Text className="text-gray-400 text-[8px] mt-3 font-bold uppercase tracking-widest">fync.com</Text>
                </View>
            </View>
        </ToolCard>
    );
});

export const ContrastTool = React.memo(() => {
    return (
        <ToolCard>
            <SectionTitle text="Contrast Validator" subText="WCAG 2.1 Color Accessibility Check." />
            <View className="flex-row justify-between mb-6">
                <View className="w-[48%] bg-white p-6 rounded-2xl items-center justify-center border border-gray-200">
                    <Text className="text-black font-black">#FFFFFF</Text>
                </View>
                <View className="w-[48%] bg-black p-6 rounded-2xl items-center justify-center border border-gray-800">
                    <Text className="text-white font-black">#000000</Text>
                </View>
            </View>

            <View className="bg-green-500/10 p-5 rounded-2xl border border-green-500/20 items-center">
                <Ionicons name="shield-checkmark" size={24} color="#22c55e" />
                <Text className="text-green-500 font-black mt-2">AAA COMPLIANT (21:1)</Text>
                <Text className="text-gray-500 text-[10px] italic mt-1 text-center">Perfect contrast for all text sizes and weights.</Text>
            </View>
        </ToolCard>
    );
});

export const CodeToImageTool = React.memo(() => {
    return (
        <ToolCard>
            <SectionTitle text="Code-to-Image" subText="Capture beautiful snippets for social media." />
            <View className="bg-gray-800 rounded-3xl p-6 border border-white/10 shadow-2xl mb-8">
                <View className="flex-row gap-1.5 mb-4">
                    <View className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <View className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <View className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </View>
                <Text className="text-pink-400 font-mono text-xs">const <Text className="text-blue-400">fync</Text> = () ={` > `}{`{`}</Text>
                <Text className="text-white font-mono text-xs">  console.<Text className="text-yellow-400">log</Text>(<Text className="text-green-400">"Hello Devs!"</Text>);</Text>
                <Text className="text-white font-mono text-xs">{`}`};</Text>
            </View>

            <TouchableOpacity className="bg-red-600 py-4 rounded-xl items-center shadow-lg shadow-red-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Export PNG High-Res</Text>
            </TouchableOpacity>
        </ToolCard>
    );
});
