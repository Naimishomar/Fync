import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Image} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import ChessGame from './ChessGame';
import { Alert } from '../ui/AlertModal';

const { width } = Dimensions.get('window');

const ChessHome = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState<'lobby' | 'searching' | 'playing'>('lobby');
    const [matchDetails, setMatchDetails] = useState<any>(null);
    const [gameMode, setGameMode] = useState<'pvp' | 'bot'>('pvp');

    // Use the app-wide authenticated socket. Opening a second connection here
    // meant a third TCP/websocket per user, and the server now rejects
    // handshakes without a token anyway.
    useEffect(() => {
        const onSearching = () => setStatus('searching');
        const onFound = (data: any) => {
            setMatchDetails(data);
            setStatus('playing');
        };
        const onError = (msg: string) => {
            Alert.alert("Chess Error", msg);
            setStatus('lobby');
        };
        const onOpponentLeft = () => {
            Alert.alert("Opponent Left", "Your opponent has disconnected or left the game.");
            setStatus('lobby');
            setMatchDetails(null);
        };

        socket.on('chess_match_searching', onSearching);
        socket.on('chess_match_found', onFound);
        socket.on('chess_error', onError);
        socket.on('chess_opponent_left', onOpponentLeft);

        return () => {
            // Detach only this screen's listeners — the socket is shared.
            socket.off('chess_match_searching', onSearching);
            socket.off('chess_match_found', onFound);
            socket.off('chess_error', onError);
            socket.off('chess_opponent_left', onOpponentLeft);
        };
    }, []);

    const findMatch = () => {
        // socket is now the shared singleton and always defined; what can be
        // missing is an established connection.
        if (!user) {
            Alert.alert("Error", "User profile not fully loaded yet.");
            return;
        }
        if (!socket.connected) {
            Alert.alert("Error", "Connecting to game server...");
            return;
        }
        setGameMode('pvp');
        setStatus('searching'); // Immediate UI update
        socket.emit('find_chess_match', {
            userId: user._id,
            username: user.username,
            name: user.name,
            avatar: user.avatar
        });
    };

    const playBot = () => {
        setGameMode('bot');
        setMatchDetails({
            color: 'w', 
            opponent: { name: 'Fync AI', username: 'FyncBot', avatar: 'fync_logo' }
        });
        setStatus('playing');
    };

    const handleGameOver = () => {
        setStatus('lobby');
        setMatchDetails(null);
    };

    if (status === 'playing') {
        return (
            <ChessGame 
                socket={socket} 
                matchDetails={matchDetails} 
                gameMode={gameMode} 
                onGameOver={handleGameOver}
            />
        );
    }

    return (
        <View className="flex-1 w-full mt-4">
            <LinearGradient 
                colors={['#ffffff', '#f8fafc']} 
                className="rounded-4xl p-8 shadow-2xl border border-slate-100 overflow-hidden"
            >
                {/* Decorative background elements */}
                <View className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
                <View className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-orange-500/10 rounded-full blur-3xl" />

                <View className="items-center mb-10 mt-4">
                    <View className="w-24 h-24 bg-slate-900 rounded-4xl justify-center items-center mb-6 shadow-2xl shadow-black border-2 border-indigo-500/20">
                        <FontAwesome5 name="chess-knight" size={44} color="#818cf8" />
                    </View>
                    <Text className="text-2xl font-black text-slate-900 tracking-tighter uppercase text-center leading-8">Fync Chess Arena</Text>
                    <View className="bg-indigo-50 px-3 py-1 rounded-full mt-3 border border-indigo-100">
                        <Text className="text-2xs font-black text-indigo-500 tracking-wide uppercase">Global Multiplayer</Text>
                    </View>
                </View>

                {status === 'searching' ? (
                    <View className="items-center py-10 bg-slate-50/50 rounded-3xl border border-slate-100">
                        <ActivityIndicator size="large" color="#4f46e5" />
                        <Text className="mt-6 font-black text-slate-600 tracking-wide text-xs">SEARCHING FOR OPPONENT...</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                socket?.emit('leave_chess', { userId: user?._id });
                                setStatus('lobby');
                            }}
                            className="mt-8 px-8 py-4 bg-red-50 rounded-2xl border border-red-100"
                        >
                            <Text className="text-red-500 font-black text-xs tracking-wide">CANCEL SEARCH</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="gap-y-4">
                        <TouchableOpacity 
                            onPress={findMatch}
                            activeOpacity={0.9}
                            className="h-20 rounded-2xl overflow-hidden shadow-xl shadow-indigo-500/20 border border-indigo-500/20"
                        >
                            <LinearGradient 
                                colors={['#312e81', '#1e1b4b']} 
                                className="flex-1 flex-row items-center justify-between px-6"
                            >
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-white/10 rounded-full items-center justify-center border border-white/10">
                                        <Ionicons name="globe" size={24} color="#818cf8" />
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-white font-black tracking-widest text-sm uppercase">Play Online</Text>
                                        <Text className="text-indigo-200 font-bold tracking-wide text-2xs mt-0.5 uppercase">1v1 Matchmaking</Text>
                                    </View>
                                </View>
                                <View className="w-8 h-8 bg-white/10 rounded-full items-center justify-center">
                                    <Ionicons name="chevron-forward" size={16} color="#818cf8" />
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={playBot}
                            activeOpacity={0.9}
                            className="h-20 rounded-2xl overflow-hidden border border-slate-200"
                        >
                            <View className="flex-1 bg-white flex-row items-center justify-between px-6">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-slate-50 rounded-full items-center justify-center border border-slate-100">
                                        <FontAwesome5 name="robot" size={20} color="#64748B" />
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-slate-900 font-black tracking-widest text-sm uppercase">Play VS AI</Text>
                                        <Text className="text-slate-500 font-bold tracking-wide text-2xs mt-0.5 uppercase">Win 5 Coins</Text>
                                    </View>
                                </View>
                                <View className="w-8 h-8 bg-slate-50 rounded-full items-center justify-center">
                                    <Ionicons name="chevron-forward" size={16} color="#64748B" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </LinearGradient>
        </View>
    );
};

export default ChessHome;
