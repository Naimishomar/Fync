import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, Dimensions, Image} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
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
            <View 
                className="rounded-sheet p-card-pad shadow-hair border border-line overflow-hidden"
             style={{ backgroundColor: '#ffffff' }}>
                {/* Decorative background elements */}
                <View className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-recruiter/10 rounded-full blur-3xl" />
                <View className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-brand-500/10 rounded-full blur-3xl" />

                <View className="items-center mb-10 mt-4">
                    <View className="w-24 h-24 bg-ink rounded-sheet justify-center items-center mb-6 shadow-hair border-2 border-recruiter/20">
                        <FontAwesome5 name="chess-knight" size={44} color="#4F46E5" />
                    </View>
                    <Text className="text-2xl font-display text-ink uppercase text-center leading-8">Fync Chess Arena</Text>
                    <View className="bg-recruiter/10 mt-3 border border-recruiter/15 px-2.5 py-1 rounded-full">
                        <Text className="text-label font-display text-recruiter uppercase">Global Multiplayer</Text>
                    </View>
                </View>

                {status === 'searching' ? (
                    <View className="items-center py-10 bg-paper-2/50 rounded-card border border-line">
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text className="mt-6 font-display text-ink-2 text-xs">SEARCHING FOR OPPONENT...</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                socket?.emit('leave_chess', { userId: user?._id });
                                setStatus('lobby');
                            }}
                            className="mt-8 px-gutter py-4 bg-danger/10 rounded-card border border-danger/15"
                        >
                            <Text className="text-danger font-display text-xs">CANCEL SEARCH</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View className="gap-y-4">
                        <TouchableOpacity 
                            onPress={findMatch}
                            activeOpacity={0.9}
                            className="h-20 rounded-card overflow-hidden shadow-hair border border-recruiter/20"
                        >
                            <View 
                                className="flex-1 flex-row items-center justify-between px-6"
                             style={{ backgroundColor: '#171320' }}>
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-card/10 rounded-full items-center justify-center border border-white/10">
                                        <Ionicons name="globe" size={24} color="#4F46E5" />
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-white font-display text-sm uppercase">Play Online</Text>
                                        <Text className="text-recruiter font-semibold text-label mt-0.5 uppercase">1v1 Matchmaking</Text>
                                    </View>
                                </View>
                                <View className="w-8 h-8 bg-card/10 rounded-full items-center justify-center">
                                    <Ionicons name="chevron-forward" size={16} color="#4F46E5" />
                                </View>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={playBot}
                            activeOpacity={0.9}
                            className="h-20 rounded-card overflow-hidden border border-line"
                        >
                            <View className="flex-1 bg-paper flex-row items-center justify-between px-6">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-paper-2 rounded-full items-center justify-center border border-line">
                                        <FontAwesome5 name="robot" size={20} color="#8B857E" />
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-ink font-display text-sm uppercase">Play VS AI</Text>
                                        <Text className="text-ink-3 font-semibold text-label mt-0.5 uppercase">Win 5 Coins</Text>
                                    </View>
                                </View>
                                <View className="w-8 h-8 bg-paper-2 rounded-full items-center justify-center">
                                    <Ionicons name="chevron-forward" size={16} color="#8B857E" />
                                </View>
                            </View>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
};

export default ChessHome;
