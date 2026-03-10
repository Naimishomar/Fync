import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { ToolCard, SectionTitle } from './Common';
import { CONVERSIONS, GIT_COMMANDS_LIB, LINUX_COMMANDS_LIB } from './Constants';

export const UnitConvertTool = React.memo(() => {
    const [selected, setSelected] = useState(CONVERSIONS[0]);
    const [input, setInput] = useState('');
    const [result, setResult] = useState('');

    const convert = (val: string) => {
        setInput(val);
        if (!val) {
            setResult('');
            return;
        }

        let res = '';
        if (selected.id === 'hex-rgb') {
            const hex = val.replace('#', '');
            if (hex.length === 3 || hex.length === 6) {
                const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
                const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
                const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
                res = `rgba(${r}, ${g}, ${b}, 1)`;
            } else {
                res = 'Invalid Hex';
            }
        } else if (selected.id === 'rem-px') {
            res = (parseFloat(val) * (selected as any).base).toFixed(2);
        } else if (selected.id.includes('px-v')) {
            res = ((parseFloat(val) / (selected as any).base) * 100).toFixed(3) + (selected.id.endsWith('vw') ? 'vw' : 'vh');
        } else {
            res = (parseFloat(val) / (selected as any).base).toFixed(3);
        }
        setResult(res);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <ToolCard>
            <SectionTitle text="Dev Converter" subText="Web-standards unit transformation." />

            <Text className="text-gray-500 text-[10px] font-black uppercase mb-3 ml-1">Select Conversion</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-8">
                {CONVERSIONS.map(c => (
                    <TouchableOpacity
                        key={c.id}
                        onPress={() => {
                            setSelected(c);
                            setInput('');
                            setResult('');
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        }}
                        className={`mr-2 px-4 py-2 rounded-xl border border-white/5 ${selected.id === c.id ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-bold uppercase">{c.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <View className="flex-row items-center justify-between">
                <View className="w-[45%]">
                    <Text className="text-gray-500 text-[10px] mb-2 font-black uppercase">{selected.from}</Text>
                    <TextInput
                        value={input}
                        onChangeText={convert}
                        placeholder="0.00"
                        placeholderTextColor="#444"
                        className="bg-black p-5 rounded-2xl text-white text-center font-black text-lg border border-white/5"
                    />
                </View>
                <Ionicons name="swap-horizontal" size={24} color="#ec4899" />
                <View className="w-[45%]">
                    <Text className="text-pink-500 text-[10px] mb-2 font-black uppercase">{selected.to}</Text>
                    <TouchableOpacity
                        onPress={() => {
                            if (result) {
                                Clipboard.setStringAsync(result);
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            }
                        }}
                        className="bg-gray-800 p-5 rounded-2xl items-center justify-center border border-pink-500/20"
                    >
                        <Text className="text-white font-black text-lg" numberOfLines={1}>{result || '0.00'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {result ? (
                <Text className="text-gray-600 text-[9px] text-center mt-4 font-bold uppercase">Tap result to copy to clipboard</Text>
            ) : null}
        </ToolCard>
    );
});

export const GitMasterTool = React.memo(() => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');

    const categories = ['All', ...new Set(GIT_COMMANDS_LIB.map(c => c.cat))];

    const filtered = GIT_COMMANDS_LIB.filter(d =>
        (activeTab === 'All' || d.cat === activeTab) &&
        (d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.cmd.toLowerCase().includes(query.toLowerCase()) ||
            d.desc.toLowerCase().includes(query.toLowerCase()))
    );

    const copy = (cmd: string) => {
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    return (
        <ToolCard>
            <SectionTitle text="Git-Master" subText="The ultimate handbook for every Git scenario." />

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search: init, push, rebase..."
                placeholderTextColor="#666"
                className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                {categories.map(c => (
                    <TouchableOpacity
                        key={c}
                        onPress={() => {
                            setActiveTab(c);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`mr-2 px-4 py-2.5 rounded-2xl border border-white/5 ${activeTab === c ? 'bg-red-600' : 'bg-gray-900'}`}
                    >
                        <Text className={`text-[10px] font-black uppercase ${activeTab === c ? 'text-white' : 'text-gray-500'}`}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {filtered.map((d, i) => (
                    <View key={i} className="mb-4 bg-gray-900/50 p-4 rounded-3xl border border-white/5">
                        <View className="flex-row justify-between items-center mb-3">
                            <View>
                                <Text className="text-white font-black text-xs uppercase tracking-tight">{d.name}</Text>
                                <Text className="text-gray-500 text-[8px] font-bold uppercase mt-1 tracking-widest">{d.cat}</Text>
                            </View>
                            <TouchableOpacity onPress={() => copy(d.cmd)} className="bg-red-600/10 p-2.5 rounded-xl border border-red-500/20">
                                <Ionicons name="copy-outline" size={14} color="#ef4444" />
                            </TouchableOpacity>
                        </View>

                        <View className="bg-black p-4 rounded-2xl border border-white/5">
                            <Text className="text-red-400 font-mono text-[11px] leading-5">{d.cmd}</Text>
                            <View className="h-[1px] bg-white/5 w-full my-3" />
                            <Text className="text-gray-400 text-[9px] font-medium leading-4 italic">" {d.desc} "</Text>
                        </View>
                    </View>
                ))}

                {filtered.length === 0 && (
                    <View className="items-center py-20 opacity-30">
                        <Ionicons name="search-outline" size={48} color="white" />
                        <Text className="text-white text-[10px] font-black mt-4 uppercase">No commands found</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
});

export const LinuxMasterTool = React.memo(() => {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState('All');

    const categories = ['All', ...new Set(LINUX_COMMANDS_LIB.map(c => c.cat))];

    const filtered = LINUX_COMMANDS_LIB.filter(d =>
        (activeTab === 'All' || d.cat === activeTab) &&
        (d.name.toLowerCase().includes(query.toLowerCase()) ||
            d.cmd.toLowerCase().includes(query.toLowerCase()) ||
            d.desc.toLowerCase().includes(query.toLowerCase()))
    );

    const copy = (cmd: string) => {
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    };

    return (
        <ToolCard>
            <SectionTitle text="Linux-Master" subText="The essential CLI guide for every developer." />

            <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search: ls, grep, sudo, chmod..."
                placeholderTextColor="#666"
                className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5"
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                {categories.map(c => (
                    <TouchableOpacity
                        key={c}
                        onPress={() => {
                            setActiveTab(c);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                        className={`mr-2 px-4 py-2.5 rounded-2xl border border-white/5 ${activeTab === c ? 'bg-orange-600' : 'bg-gray-900'}`}
                    >
                        <Text className={`text-[10px] font-black uppercase ${activeTab === c ? 'text-white' : 'text-gray-500'}`}>{c}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView className="max-h-[500px]" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                {filtered.map((d, i) => (
                    <View key={i} className="mb-4 bg-gray-900/50 p-4 rounded-3xl border border-white/5">
                        <View className="flex-row justify-between items-center mb-3">
                            <View>
                                <Text className="text-white font-black text-xs uppercase tracking-tight">{d.name}</Text>
                                <Text className="text-gray-500 text-[8px] font-bold uppercase mt-1 tracking-widest">{d.cat}</Text>
                            </View>
                            <TouchableOpacity onPress={() => copy(d.cmd)} className="bg-orange-600/10 p-2.5 rounded-xl border border-orange-500/20">
                                <Ionicons name="copy-outline" size={14} color="#f59e0b" />
                            </TouchableOpacity>
                        </View>

                        <View className="bg-black p-4 rounded-2xl border border-white/5">
                            <Text className="text-orange-400 font-mono text-[11px] leading-5">{d.cmd}</Text>
                            <View className="h-[1px] bg-white/5 w-full my-3" />
                            <Text className="text-gray-400 text-[9px] font-medium leading-4 italic">" {d.desc} "</Text>
                        </View>
                    </View>
                ))}

                {filtered.length === 0 && (
                    <View className="items-center py-20 opacity-30">
                        <Ionicons name="search-outline" size={48} color="white" />
                        <Text className="text-white text-[10px] font-black mt-4 uppercase">No commands found</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
});

export const TerminalToEnglishTool = React.memo(() => {
    const [cmd, setCmd] = useState('');
    const [translation, setTranslation] = useState('');

    const explain = () => {
        let text = "This command ";
        if (cmd.includes('find .')) text += "searches the current directory ";
        if (cmd.includes('-name')) text += "for files matching a specific name ";
        if (cmd.includes('| xargs')) text += "and pipes the output as arguments into ";
        if (cmd.includes('grep')) text += "the grep search engine.";
        setTranslation(text || "Logic translation for this specific CLI chain is pending...");
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="Terminal Explainer" subText="Translate complex CLI scripts to plain English." />
            <TextInput value={cmd} onChangeText={setCmd} placeholder="find . -type f -name '*.ts' | xargs grep 'FIXME'" multiline placeholderTextColor="#666" className="bg-black p-5 rounded-2xl text-white mb-6 border border-white/5 font-mono text-xs h-24" />

            <TouchableOpacity onPress={explain} className="bg-green-600 py-4 rounded-xl items-center shadow-lg shadow-green-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Explain Script</Text>
            </TouchableOpacity>

            {translation ? (
                <View className="mt-8 bg-black/80 p-6 rounded-3xl border border-white/5 items-center">
                    <Ionicons name="language-outline" size={24} color="#10b981" />
                    <Text className="text-white font-medium text-center mt-3 italic leading-5">"{translation}"</Text>
                </View>
            ) : null}
        </ToolCard>
    );
});
