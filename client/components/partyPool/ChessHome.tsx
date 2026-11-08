import React, { useState, useEffect, useRef } from 'react';
import {View, Text, ActivityIndicator} from 'react-native'
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import ChessGame from './ChessGame';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { Button, ListRow } from '../ui/kit';

const ROW = { paddingHorizontal: 16, paddingVertical: 12 };

const ChessHome = () => {
    const { user } = useAuth();
    const [status, setStatus] = useState<'lobby' | 'searching' | 'playing'>('lobby');
    const [matchDetails, setMatchDetails] = useState<any>(null);
    const [gameMode, setGameMode] = useState<'pvp' | 'bot'>('pvp');
    const statusRef = useRef(status);
    statusRef.current = status;
    const userIdRef = useRef(user?._id);
    userIdRef.current = user?._id;

    // Backing out of Party Pool mid-search used to leave this player queued on
    // the server, so the next opponent got matched against nobody.
    useEffect(() => () => {
        if (statusRef.current === 'searching') socket.emit('leave_chess', { userId: userIdRef.current });
    }, []);

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
            <View className="rounded-2xl p-5 border border-line bg-card">
                <View className="items-center mb-6 mt-2">
                    <View className="w-20 h-20 bg-paper-2 rounded-full justify-center items-center mb-4">
                        <FontAwesome5 name="chess-knight" size={36} color={C.ink} />
                    </View>
                    <Text className="text-2xl font-display text-ink text-center" accessibilityRole="header">Fync Chess Arena</Text>
                    <Text className="text-sm text-ink-3 mt-1">Global multiplayer</Text>
                </View>

                {status === 'searching' ? (
                    <View className="items-center py-8 bg-paper-2 rounded-2xl">
                        <ActivityIndicator size="large" color={C.brand[500]} />
                        <Text className="mt-4 font-semibold text-ink-2">Searching for an opponent...</Text>
                        <Button
                            title="Cancel search"
                            variant="secondary"
                            style={{ marginTop: 20 }}
                            onPress={() => {
                                socket?.emit('leave_chess', { userId: user?._id });
                                setStatus('lobby');
                            }}
                        />
                    </View>
                ) : (
                    <View className="rounded-2xl border border-line overflow-hidden">
                        <ListRow
                            icon="globe-outline"
                            title="Play online"
                            subtitle="1v1 matchmaking"
                            onPress={findMatch}
                            style={ROW}
                        />
                        <View className="h-px bg-line" />
                        <ListRow
                            leading={<View className="w-10 h-10 rounded-full bg-paper-2 items-center justify-center"><FontAwesome5 name="robot" size={16} color={C.ink} /></View>}
                            title="Play vs AI"
                            subtitle="Win 5 coins"
                            onPress={playBot}
                            style={ROW}
                        />
                    </View>
                )}
            </View>
        </View>
    );
};

export default ChessHome;
