import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ToolCard, SectionTitle } from './Common';

export const CommitGenTool = React.memo(() => {
    const [type, setType] = useState('feat');
    const [msg, setMsg] = useState('');

    const copy = () => {
        const cmd = `git commit -m "${type}: ${msg}"`;
        Clipboard.setStringAsync(cmd);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", cmd);
    };

    return (
        <ToolCard>
            <SectionTitle text="Commit Builder" subText="Follow conventional commit standards." />
            <View className="flex-row flex-wrap gap-2 mb-6">
                {['feat', 'fix', 'docs', 'chore', 'refactor', 'test'].map(t => (
                    <TouchableOpacity
                        key={t}
                        onPress={() => setType(t)}
                        className={`px-4 py-2 rounded-xl border border-white/5 ${type === t ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-bold uppercase">{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput value={msg} onChangeText={setMsg} placeholder="Describe your changes..." placeholderTextColor="#666" className="bg-black p-4 rounded-xl text-white mb-6 border border-white/5" />
            <TouchableOpacity onPress={copy} className="bg-blue-600 py-4 rounded-xl items-center shadow-lg shadow-blue-500/20">
                <Text className="text-white font-black uppercase tracking-widest text-xs">Copy Commit Command</Text>
            </TouchableOpacity>
        </ToolCard>
    );
});

export const CronVisualizerTool = React.memo(() => {
    const [m, setM] = useState('*');
    const [h, setH] = useState('*');
    const [d, setD] = useState('*');
    const [mon, setMon] = useState('*');
    const [w, setW] = useState('*');
    const [cron, setCron] = useState('* * * * *');
    const [mode, setMode] = useState<'build' | 'raw'>('build');

    useEffect(() => {
        if (mode === 'build') {
            setCron(`${m} ${h} ${d} ${mon} ${w}`);
        }
    }, [m, h, d, mon, w, mode]);

    const explainCron = (exp: string) => {
        const p = exp.split(' ');
        if (p.length < 5) return "Invalid Cron Expression";
        const [m1, h1, d1, mon1, w1] = p;

        const getPart = (val: string, type: string) => {
            if (val === '*') return `every ${type}`;
            if (val.includes('/')) return `every ${val.split('/')[1]} ${type}s`;
            if (val.includes('-')) return `from ${type} ${val.split('-')[0]} to ${val.split('-')[1]}`;
            if (type === 'hour') return `at ${val.padStart(2, '0')}:00`;
            if (type === 'weekday') {
                const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                return `on ${val.split(',').map(v => days[parseInt(v)] || v).join(', ')}`;
            }
            return `at ${type} ${val}`;
        };

        const minT = m1 === '*' ? 'every minute' : m1.includes('/') ? `every ${m1.split('/')[1]} mins` : `at :${m1.padStart(2, '0')}`;
        const hourT = getPart(h1, 'hour');
        const dayT = getPart(d1, 'day');
        const monthT = mon1 === '*' ? '' : ` in ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(mon1) - 1] || mon1}`;
        const weekT = getPart(w1, 'weekday');

        return `Executes ${minT}, ${hourT}, ${dayT}${monthT} ${w1 === '*' ? '' : weekT}.`.replace(/\s+/g, ' ').trim();
    };

    const copy = () => {
        Clipboard.setStringAsync(cron);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Copied", `Cron: ${cron}`);
    };

    const PRESETS = [
        { name: 'Every 5m', exp: '*/5 * * * *' },
        { name: 'Hourly', exp: '0 * * * *' },
        { name: 'Daily @ Mid', exp: '0 0 * * *' },
        { name: 'Weekly', exp: '0 0 * * 0' },
        { name: 'Month Start', exp: '0 0 1 * *' },
    ];

    const applyPreset = (exp: string) => {
        const p = exp.split(' ');
        setM(p[0]); setH(p[1]); setD(p[2]); setMon(p[3]); setW(p[4]);
        setCron(exp);
        setMode('build');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    return (
        <ToolCard>
            <SectionTitle text="Cron-Master" subText="Visual schedule builder & explainer." />

            <View className="flex-row bg-black p-1 rounded-2xl mb-8 border border-white/5">
                <TouchableOpacity onPress={() => setMode('build')} className={`flex-1 py-3 rounded-xl items-center ${mode === 'build' ? 'bg-gray-800' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'build' ? 'text-white' : 'text-gray-500'}`}>Visual Builder</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('raw')} className={`flex-1 py-3 rounded-xl items-center ${mode === 'raw' ? 'bg-gray-800' : ''}`}>
                    <Text className={`text-[10px] font-black uppercase ${mode === 'raw' ? 'text-white' : 'text-gray-500'}`}>Raw Expression</Text>
                </TouchableOpacity>
            </View>

            {mode === 'build' ? (
                <View className="mb-8">
                    <View className="flex-row justify-between mb-4">
                        {[
                            { label: 'Min', val: m, set: setM },
                            { label: 'Hour', val: h, set: setH },
                            { label: 'Day', val: d, set: setD },
                            { label: 'Mon', val: mon, set: setMon },
                            { label: 'Week', val: w, set: setW },
                        ].map((item, i) => (
                            <View key={i} className="w-[18%] items-center">
                                <Text className="text-gray-600 text-[8px] font-black uppercase mb-2">{item.label}</Text>
                                <TextInput
                                    value={item.val}
                                    onChangeText={item.set}
                                    className="bg-black w-full py-3 rounded-xl text-white text-center font-bold text-xs border border-white/10"
                                    placeholder="*"
                                    placeholderTextColor="#333"
                                />
                            </View>
                        ))}
                    </View>
                    <Text className="text-gray-600 text-[8px] font-bold italic mt-2">* Use numbers (0-59), ranges (1-5), or intervals (*/15)</Text>
                </View>
            ) : (
                <TextInput
                    value={cron}
                    onChangeText={setCron}
                    className="bg-black p-6 rounded-2xl text-white mb-8 text-center font-black text-2xl border border-white/10"
                    placeholder="* * * * *"
                    placeholderTextColor="#333"
                />
            )}

            <View className="bg-gray-900/80 p-6 rounded-3xl border border-pink-500/20 mb-8">
                <View className="flex-row justify-between items-center mb-4">
                    <Text className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Active Schedule</Text>
                    <TouchableOpacity onPress={copy} className="bg-pink-600/20 px-3 py-1 rounded-full border border-pink-500/20">
                        <Text className="text-pink-500 font-black text-[8px]">COPY EXP</Text>
                    </TouchableOpacity>
                </View>
                <Text className="text-white text-2xl font-black tracking-widest text-center mb-6">{cron}</Text>
                <View className="h-[1px] bg-white/5 w-full mb-6" />
                <View className="flex-row items-start bg-indigo-500/10 p-4 rounded-2xl border border-indigo-500/10">
                    <Ionicons name="sparkles" size={14} color="#818cf8" />
                    <Text className="text-indigo-300 text-[11px] font-medium leading-5 ml-3 italic flex-1">
                        "{explainCron(cron)}"
                    </Text>
                </View>
            </View>

            <SectionTitle text="Quick Presets" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                {PRESETS.map(p => (
                    <TouchableOpacity
                        key={p.name}
                        onPress={() => applyPreset(p.exp)}
                        className="mr-3 bg-gray-900 border border-white/5 px-5 py-3 rounded-2xl"
                    >
                        <Text className="text-gray-400 text-[9px] font-black uppercase">{p.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </ToolCard>
    );
});

export const SLACalculatorTool = React.memo(() => {
    const [nines, setNines] = useState(99.9);

    const calculate = () => {
        const total = 365 * 24 * 60;
        const downMins = total * (1 - nines / 100);
        const hours = Math.floor(downMins / 60);
        const mins = Math.round(downMins % 60);
        return `${hours}h ${mins}m / Year`;
    };

    return (
        <ToolCard>
            <SectionTitle text="SLA Calculator" subText="Visualize max downtime allowed by nines." />
            <View className="flex-row justify-between mb-8">
                {[99, 99.9, 99.99, 99.999].map(n => (
                    <TouchableOpacity
                        key={n}
                        onPress={() => setNines(n)}
                        className={`px-4 py-2 rounded-xl border border-white/5 ${nines === n ? 'bg-pink-600' : 'bg-gray-800'}`}
                    >
                        <Text className="text-white text-[10px] font-black">{n}%</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View className="items-center bg-black/50 p-8 rounded-3xl border border-white/5">
                <Text className="text-gray-500 text-[10px] uppercase font-bold tracking-widest mb-1">Max Allowable Downtime</Text>
                <Text className="text-white text-3xl font-black">{calculate()}</Text>
            </View>
        </ToolCard>
    );
});

export const VaultTool = React.memo(() => {
    const [secrets, setSecrets] = useState<{ k: string, v: string }[]>([]);
    const [key, setKey] = useState('');
    const [val, setVal] = useState('');

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        const stored = await AsyncStorage.getItem('@fync_vault');
        if (stored) setSecrets(JSON.parse(stored));
    };

    const add = async () => {
        if (!key || !val) return;
        const next = [...secrets, { k: key, v: val }];
        await AsyncStorage.setItem('@fync_vault', JSON.stringify(next));
        setSecrets(next);
        setKey(''); setVal('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    const del = async (idx: number) => {
        const next = secrets.filter((_, i) => i !== idx);
        await AsyncStorage.setItem('@fync_vault', JSON.stringify(next));
        setSecrets(next);
    };

    return (
        <ToolCard>
            <SectionTitle text="Secure Vault" subText="Local-only storage for your .env keys." />

            <View className="flex-row gap-2 mb-6">
                <TextInput value={key} onChangeText={setKey} placeholder="KEY" placeholderTextColor="#444" className="flex-1 bg-black p-3 rounded-xl text-white font-bold text-[10px] border border-white/5" />
                <TextInput value={val} onChangeText={setVal} placeholder="VALUE" placeholderTextColor="#444" secureTextEntry className="flex-1 bg-black p-3 rounded-xl text-white font-bold text-[10px] border border-white/5" />
                <TouchableOpacity onPress={add} className="bg-red-600 px-4 rounded-xl items-center justify-center">
                    <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView className="max-h-[300px]" showsVerticalScrollIndicator={false}>
                {secrets.map((s, i) => (
                    <View key={i} className="bg-gray-900/50 p-4 rounded-2xl mb-3 flex-row justify-between items-center border border-white/5">
                        <View className="flex-1">
                            <Text className="text-gray-400 font-bold text-[10px] mb-1">{s.k}</Text>
                            <Text className="text-white font-mono text-xs">••••••••••••</Text>
                        </View>
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={() => {
                                Clipboard.setStringAsync(s.v);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            }} className="bg-gray-800 p-2 rounded-lg">
                                <Ionicons name="copy-outline" size={14} color="#ef4444" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => del(i)} className="bg-gray-800 p-2 rounded-lg">
                                <Ionicons name="trash-outline" size={14} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
                {secrets.length === 0 && (
                    <View className="items-center py-10 opacity-30">
                        <Ionicons name="lock-closed-outline" size={40} color="white" />
                        <Text className="text-white text-[10px] mt-2 font-bold">Vault is empty</Text>
                    </View>
                )}
            </ScrollView>
        </ToolCard>
    );
});

export const CostEstimatorTool = React.memo(() => {
    const [cost, setCost] = useState('0.00');

    const update = (val: string) => {
        const num = parseFloat(val) || 0;
        setCost((num * 0.00042).toFixed(4));
    };

    return (
        <ToolCard>
            <SectionTitle text="Cloud Cost" subText="Deep infra cost analysis for student projects." />
            <Text className="text-gray-500 text-[10px] font-black uppercase mb-2 ml-1">Estimated Monthly Requests</Text>
            <TextInput onChangeText={update} keyboardType="numeric" placeholder="100,000" placeholderTextColor="#666" className="bg-black p-5 rounded-2xl text-white mb-6 border border-white/5 font-black text-xl" />

            <View className="bg-green-500/10 p-8 rounded-3xl border border-green-500/20 items-center">
                <Text className="text-green-500 text-3xl font-black">${cost}</Text>
                <Text className="text-gray-500 text-[10px] font-bold uppercase mt-2 tracking-widest">Est. Serverless Cost / Month</Text>
            </View>
        </ToolCard>
    );
});

export const SignatureGenTool = React.memo(() => {
    const [key, setKey] = useState('');
    const [payload, setPayload] = useState('');
    const [signature, setSignature] = useState('');

    const generate = () => {
        const sig = 'sha256_' + Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
        setSignature(sig);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    };

    return (
        <ToolCard>
            <SectionTitle text="Payload Signer" subText="Generate HMAC signatures for webhooks." />
            <TextInput value={key} onChangeText={setKey} placeholder="Secret API Key" placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-4 border border-white/5" />
            <TextInput value={payload} onChangeText={setPayload} multiline placeholder='{"event": "user.signup", "id": 1}' placeholderTextColor="#444" className="bg-black p-4 rounded-xl text-white mb-6 h-24 border border-white/5" />

            <TouchableOpacity onPress={generate} className="bg-red-600 py-4 rounded-xl items-center shadow-lg shadow-red-500/20 mb-8">
                <Text className="text-white font-black uppercase tracking-widest text-[10px]">Generate Signature</Text>
            </TouchableOpacity>

            {signature ? (
                <View className="bg-gray-900 p-5 rounded-3xl border border-white/5 flex-row justify-between items-center">
                    <Text className="text-red-400 font-mono text-[10px] flex-1 mr-4">{signature}</Text>
                    <TouchableOpacity onPress={() => {
                        Clipboard.setStringAsync(signature);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    }} className="bg-gray-800 p-2 rounded-lg">
                        <Ionicons name="copy-outline" size={14} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ) : null}
        </ToolCard>
    );
});

export const ArchitectTool = React.memo(() => {
    const [stack, setStack] = useState('');

    const suggest = (type: string) => {
        if (type === 'Real-time') setStack('WebSockets + Redis + Node.js');
        else if (type === 'SaaS') setStack('Next.js + Prisma + Stripe + AWS');
        else setStack('React Native + Firebase + Supabase');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    return (
        <ToolCard>
            <SectionTitle text="The Architect" subText="AI-driven system design decision tree." />
            <Text className="text-gray-500 text-[10px] font-bold uppercase mb-4 tracking-widest">Select Project Archetype</Text>
            <View className="flex-row flex-wrap gap-2 mb-8">
                {['Real-time', 'SaaS', 'E-commerce', 'Fintech'].map(t => (
                    <TouchableOpacity key={t} onPress={() => suggest(t)} className="bg-gray-900 px-5 py-3 rounded-2xl border border-white/5">
                        <Text className="text-white text-[10px] font-black uppercase">{t}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {stack ? (
                <View className="bg-blue-600/10 p-6 rounded-3xl border border-blue-500/20 items-center">
                    <Ionicons name="bulb-outline" size={32} color="#3b82f6" />
                    <Text className="text-white font-black text-center mt-4 tracking-tight">RECOMMENDED STACK</Text>
                    <Text className="text-blue-400 font-mono text-xs mt-2 text-center">{stack}</Text>
                    <TouchableOpacity onPress={() => {
                        Clipboard.setStringAsync(stack);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }} className="mt-6 bg-gray-900 px-6 py-2 rounded-full border border-white/5">
                        <Text className="text-white text-[10px] font-bold uppercase">Copy Stack</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View className="items-center py-10 opacity-20">
                    <Ionicons name="business-outline" size={60} color="white" />
                    <Text className="text-white text-[10px] font-black mt-4 uppercase">Waiting for input</Text>
                </View>
            )}
        </ToolCard>
    );
});
