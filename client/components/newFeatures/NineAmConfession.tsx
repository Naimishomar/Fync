import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, Alert, Vibration, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import socket from '../../utils/socket'; 

const BG_IMAGE = "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?q=80&w=1000&auto=format&fit=crop";

export default function NineAmConfession() {
    const { user } = useAuth();
    const navigation = useNavigation<any>();

    const [status, setStatus] = useState('CHECKING'); 
    const [messages, setMessages] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [roomId, setRoomId] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState("");
    const [profiles, setProfiles] = useState<any[]>([]);
    const [hasVoted, setHasVoted] = useState(false);
    const [partnerVoted, setPartnerVoted] = useState(false);

    useEffect(() => {
        // 1. Initial Time Check (Frontend)
        const checkTime = () => {
            const now = new Date();
            const h = now.getHours();
            const m = now.getMinutes();
            // Allow entry between 9:55 PM and 10:05 PM
            if (h === 21 && m >= 55) setStatus('LOBBY');
            else if (h === 22 && m < 6) setStatus('LOBBY');
            else setStatus('CLOSED');
        };
        checkTime();

        // 2. Define Event Handlers
        const onConnect = () => console.log("Connected to Lottery Socket");
        
        const onStatusChange = (data: any) => {
            if (data.status === 'CLOSED') setStatus('CLOSED');
            if (data.status === 'LOBBY') setStatus('LOBBY');
        };

        const onJoinedSuccess = () => setStatus('WAITING');

        const onMatchFound = (data: any) => {
            setRoomId(data.roomId);
            setStatus('MATCHED');
            Vibration.vibrate();
            startTimer(data.expiresAt);
        };

        const onReceiveMessage = (msg: any) => {
            setMessages(prev => [...prev, msg]);
        };

        const onTimeUp = () => {
            setStatus('DECISION');
            Vibration.vibrate([500, 500, 500]);
        };

        const onPartnerVoted = () => setPartnerVoted(true);

        const onRevealSuccess = (data: any) => {
            setProfiles(data.profiles);
            setStatus('REVEALED');
        };

        const onGameOver = (data: any) => {
            Alert.alert("Ended", data.message);
            navigation.goBack();
        };

        const onError = (msg: string) => {
            Alert.alert("Access Denied", msg, [{ text: "OK", onPress: () => navigation.goBack() }]);
        };

        // 3. Attach Listeners
        // We use the imported 'socket' directly
        socket.on("connect", onConnect);
        socket.on("status_change", onStatusChange);
        socket.on("joined_success", onJoinedSuccess);
        socket.on("match_found", onMatchFound);
        socket.on("receive_message", onReceiveMessage);
        socket.on("time_up", onTimeUp);
        socket.on("partner_voted", onPartnerVoted);
        socket.on("reveal_success", onRevealSuccess);
        socket.on("game_over", onGameOver);
        socket.on("error", onError);

        // 4. Cleanup Listeners on Unmount
        return () => {
            socket.off("connect", onConnect);
            socket.off("status_change", onStatusChange);
            socket.off("joined_success", onJoinedSuccess);
            socket.off("match_found", onMatchFound);
            socket.off("receive_message", onReceiveMessage);
            socket.off("time_up", onTimeUp);
            socket.off("partner_voted", onPartnerVoted);
            socket.off("reveal_success", onRevealSuccess);
            socket.off("game_over", onGameOver);
            socket.off("error", onError);
        };
    }, []);

    const joinLobby = () => {
        socket.emit("join_lobby", { userId: user._id });
    };

    const sendMessage = () => {
        if (!inputText.trim()) return;
        setMessages(prev => [...prev, { text: inputText, senderId: user._id, timestamp: new Date() }]);
        socket.emit("send_message", { roomId, text: inputText, senderId: user._id });
        setInputText("");
    };

    const voteReveal = (vote: boolean) => {
        setHasVoted(true);
        socket.emit("vote_reveal", { roomId, userId: user._id, vote });
        if(!vote) navigation.goBack(); 
    };

    const startTimer = (endTimeIso: string) => {
        const end = new Date(endTimeIso).getTime();
        const interval = setInterval(() => {
            const now = new Date().getTime();
            const distance = end - now;
            if (distance < 0) {
                clearInterval(interval);
                setTimeLeft("00:00");
            } else {
                const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
                const s = Math.floor((distance % (1000 * 60)) / 1000);
                setTimeLeft(`${m}:${s < 10 ? '0' + s : s}`);
            }
        }, 1000);
    };

    // --- RENDERING (UI Unchanged) ---

    if (status === 'CLOSED') {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <LinearGradient colors={['rgba(236, 72, 153, 0.4)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                <Text className="text-white text-3xl font-black mb-2">CLOSED 🔒</Text>
                <Text className="text-gray-500 text-center">The Lottery runs daily from 10:00 PM to 10:05 PM.</Text>
                <TouchableOpacity onPress={() => navigation.goBack()} className="mt-8 bg-gray-800 px-6 py-3 rounded-full">
                    <Text className="text-white font-bold">Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (status === 'LOBBY') {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <LinearGradient colors={['rgba(236, 72, 153, 0.15)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                <Text className="text-pink-500 text-5xl font-black mb-4 tracking-tighter">LOTTERY</Text>
                <Text className="text-gray-300 text-center text-lg mb-10 leading-6">
                    One chance per day.{"\n"}Anonymous until you both agree.
                </Text>
                <TouchableOpacity onPress={joinLobby} className="bg-white w-full py-4 rounded-full shadow-lg shadow-white/20">
                    <Text className="text-black text-center font-bold text-lg">ENTER POOL</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (status === 'WAITING') {
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <LinearGradient colors={['rgba(236, 72, 153, 0.15)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                <ActivityIndicator size="large" color="#ec4899" />
                <Text className="text-white text-xl font-bold mt-6">In the Pool...</Text>
                <Text className="text-gray-500 text-center mt-2">Matching starts at 10:00 PM exactly.</Text>
            </View>
        );
    }

    if (status === 'MATCHED') {
        return (
            <SafeAreaView className="flex-1 bg-black">
                <LinearGradient colors={['rgba(236, 72, 153, 0.15)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                {/* Header */}
                <View className="p-4 border-b border-gray-800 flex-row justify-between items-center bg-gray-900/50">
                    <View className="flex-row items-center">
                        <View className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" />
                        <Text className="text-white font-bold text-lg">Anonymous</Text>
                    </View>
                    <Text className="text-red-500 font-mono font-bold text-xl">{timeLeft}</Text>
                </View>
                
                {/* Chat Area */}
                <View className="flex-1 px-4 py-2">
                    {messages.map((msg, index) => (
                        <View key={index} className={`mb-3 max-w-[80%] p-3 rounded-2xl ${msg.senderId === user._id ? 'bg-pink-600 self-end rounded-tr-none' : 'bg-gray-800 self-start rounded-tl-none'}`}>
                            <Text className="text-white font-medium">{msg.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Input */}
                <View className="p-4 flex-row items-center bg-gray-900">
                    <TextInput 
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Say hello..." 
                        placeholderTextColor="#666"
                        className="flex-1 bg-black text-white p-4 rounded-full mr-3 border border-gray-800"
                    />
                    <TouchableOpacity onPress={sendMessage} className="bg-pink-600 w-12 h-12 rounded-full items-center justify-center">
                        <Ionicons name="send" size={20} color="white" />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    if (status === 'DECISION') {
        return (
            <View className="flex-1 bg-black justify-center items-center px-6">
                <LinearGradient colors={['rgba(236, 72, 153, 0.2)', 'rgba(0,0,0,0)']} className="absolute w-full h-full" />
                
                <Text className="text-white text-4xl font-black mb-2">TIME IS UP 🎉</Text>
                <Text className="text-gray-400 text-center mb-12 px-4">
                    Do you want to reveal your identity to this person?{"\n"}Both must say YES.
                </Text>
                
                {!hasVoted ? (
                    <View className="flex-row gap-4 w-full">
                        <TouchableOpacity onPress={() => voteReveal(false)} className="flex-1 bg-gray-800 py-5 rounded-2xl border border-gray-700">
                            <Text className="text-gray-300 text-center font-bold text-lg">NO (Delete)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => voteReveal(true)} className="flex-1 bg-pink-600 py-5 rounded-2xl shadow-lg shadow-pink-600/30">
                            <Text className="text-white text-center font-bold text-lg">YES (Reveal)</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="items-center">
                        <ActivityIndicator color="#ec4899" className="mb-4"/>
                        <Text className="text-white font-bold text-xl">Waiting for partner...</Text>
                        {partnerVoted && <Text className="text-green-500 mt-2">Partner has voted!</Text>}
                    </View>
                )}
            </View>
        );
    }

    if (status === 'REVEALED') {
        const partner = profiles.find(p => p._id !== user._id);
        return (
            <View className="flex-1 bg-black justify-center items-center">
                <LinearGradient colors={['rgba(236, 72, 153, 0.15)', 'rgba(0,0,0,0.85)', '#000000']} className="absolute w-full h-full" />
                <Image source={{ uri: BG_IMAGE }} className="absolute w-full h-full opacity-30" />
                
                <Text className="text-pink-500 text-4xl font-black mb-8 shadow-lg">IT IS A MATCH!</Text>
                
                <View className="bg-gray-900/80 p-6 rounded-3xl border border-pink-500/30 items-center w-full shadow-2xl backdrop-blur-md">
                    <Image 
                        source={{ uri: partner?.avatar || "https://via.placeholder.com/150" }} 
                        className="w-32 h-32 rounded-full border-4 border-pink-500 mb-4"
                    />
                    <Text className="text-white text-2xl font-bold">{partner?.name}</Text>
                    <Text className="text-gray-400 mb-6">@{partner?.username} • {partner?.college}</Text>
                    
                    <TouchableOpacity onPress={() => navigation.navigate("PublicProfile", { user: partner })} className="bg-white w-full py-4 rounded-xl">
                        <Text className="text-black text-center font-bold text-lg">View Profile</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return null;
}