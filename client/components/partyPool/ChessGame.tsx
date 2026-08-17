import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/auth.context';
import { Chess } from 'chess.js';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';

interface ChessGameProps {
    socket: any;
    matchDetails: any;
    gameMode: 'pvp' | 'bot';
    onGameOver: () => void;
}

const ChessGame: React.FC<ChessGameProps> = ({ socket, matchDetails, gameMode, onGameOver }) => {
    const { user } = useAuth();
    const chessboardRef = useRef<ChessboardRef>(null);
    const [chess] = useState(new Chess());
    const [isMyTurn, setIsMyTurn] = useState(matchDetails.color === 'w');
    const [gameOver, setGameOver] = useState(false);
    const [botThinking, setBotThinking] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    
    // 1 minute timer state
    const [timeLeft, setTimeLeft] = useState(60);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Simulate loading time for board and connection setup
        const timer = setTimeout(() => {
            setIsInitializing(false);
            // If playing bot and bot is white, move after init
            if (gameMode === 'bot' && matchDetails.color === 'b') {
                makeBotMove();
            }
        }, 2000);

        if (gameMode === 'pvp' && socket) {
            socket.on('chess_move_received', ({ move, fen }: any) => {
                chess.load(fen);
                // `move` is now an object { from, to, promotion, san }
                chessboardRef.current?.move({ from: move.from, to: move.to });
                setIsMyTurn(true);
                setTimeLeft(60);
                checkEndGame();
            });

            socket.on('chess_turn_skipped', ({ fen }: any) => {
                // Opponent ran out of time, their turn was skipped.
                // We load the mutated FEN
                chess.load(fen);
                setIsMyTurn(true);
                setTimeLeft(60);
            });

            socket.on('chess_game_over', ({ reason, winnerId }: any) => {
                setGameOver(true);
                let title = "Game Over";
                let msg = reason;
                if (reason === 'checkmate') {
                    msg = winnerId === user?._id ? "You Won by Checkmate! 🎉" : "You Lost by Checkmate 😢";
                } else if (reason === 'resignation') {
                    msg = winnerId === user?._id ? "Opponent Resigned. You Won! 🎉" : "You Resigned.";
                }
                Alert.alert(title, msg, [{ text: "Leave", onPress: onGameOver }]);
            });
        }

        return () => {
            clearTimeout(timer);
            if (timerRef.current) clearInterval(timerRef.current);
            if (socket) {
                socket.off('chess_move_received');
                socket.off('chess_turn_skipped');
                socket.off('chess_game_over');
            }
        };
    }, []);

    // Timer Logic
    useEffect(() => {
        if (!isMyTurn || gameOver || isInitializing) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!);
                    handleTurnTimeout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isMyTurn, gameOver, isInitializing]);

    const handleTurnTimeout = () => {
        // Skip our turn because time ran out
        if (gameMode === 'pvp' && socket) {
            socket.emit('chess_skip_turn', { matchRoomId: matchDetails.matchRoomId, userId: user?._id });
        }
        setIsMyTurn(false);
        setTimeLeft(60);
    };

    const checkEndGame = () => {
        if (chess.isGameOver()) {
            setGameOver(true);
            let msg = "Draw";
            let won = false;

            if (chess.isCheckmate()) {
                // If it's my turn when checkmate happens, it means the opponent checkmated me.
                // If it's NOT my turn, it means I just moved and checkmated the opponent.
                won = !isMyTurn; 
                msg = won ? "You Won by Checkmate! 🎉" : "You Lost by Checkmate 😢";
            } else if (chess.isStalemate()) {
                msg = "Stalemate!";
            }

            if (gameMode === 'bot') {
                if (won && socket) {
                    socket.emit('bot_win', { userId: user?._id });
                    Alert.alert("Victory! 🏆", msg + "\n\n+5 Fync Coins awarded!", [{ text: "Leave", onPress: onGameOver }]);
                } else {
                    Alert.alert("Game Over", msg, [{ text: "Leave", onPress: onGameOver }]);
                }
            }
            return true;
        }
        return false;
    };

    const makeBotMove = async () => {
        if (chess.isGameOver()) return;
        setBotThinking(true);
        try {
            // Highly optimized: Zero load on our server. We use a free Stockfish API.
            const response = await fetch(`https://stockfish.online/api/s/v2.php?fen=${encodeURIComponent(chess.fen())}&depth=10`);
            const data = await response.json();
            if (data.success && data.bestmove) {
                // bestmove format: "bestmove e2e4 ponder e7e5"
                const parts = data.bestmove.split(' ');
                if (parts.length > 1) {
                    const moveStr = parts[1]; // e.g. "e2e4"
                    const from = moveStr.substring(0, 2);
                    const to = moveStr.substring(2, 4);
                    const promotion = moveStr.length > 4 ? moveStr.charAt(4) : undefined;
                    
                    chess.move({ from, to, promotion });
                    chessboardRef.current?.move({ from, to });
                    setIsMyTurn(true);
                    checkEndGame();
                }
            }
        } catch (e) {
            console.error("Bot Move Error", e);
            Alert.alert("Bot Error", "The AI is currently unavailable.");
        } finally {
            setBotThinking(false);
        }
    };

    const handleMove = ({ move }: any) => {
        if (gameOver) return;
        if (!isMyTurn) return; // Prevent moving out of turn

        try {
            const moveObj = chess.move({
                from: move.from,
                to: move.to,
                promotion: 'q', // default to queen for simplicity
            });

            if (moveObj) {
                setIsMyTurn(false);
                setTimeLeft(60); // Reset our timer since we moved
                
                if (gameMode === 'pvp' && socket) {
                    socket.emit('chess_move', {
                        matchRoomId: matchDetails.matchRoomId,
                        // Send the full move object instead of just SAN so the other side can parse it
                        move: { from: moveObj.from, to: moveObj.to, promotion: moveObj.promotion, san: moveObj.san },
                        fen: chess.fen(),
                        userId: user?._id
                    });
                }

                if (!checkEndGame() && gameMode === 'bot') {
                    setTimeout(makeBotMove, 500);
                }
            }
        } catch (e) {
            // Invalid move
            console.log("Invalid move", e);
        }
    };

    const handleResign = () => {
        Alert.alert("Resign", "Are you sure you want to resign?", [
            { text: "Cancel", style: "cancel" },
            { text: "Resign", style: "destructive", onPress: () => {
                if (gameMode === 'pvp' && socket) {
                    socket.emit('chess_resign', { matchRoomId: matchDetails.matchRoomId, userId: user?._id });
                } else {
                    onGameOver();
                }
            }}
        ]);
    };

    return (
        <Modal visible={true} animationType="slide" transparent={false}>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <LinearGradient 
                    colors={['#ffffff', '#f8fafc']} 
                    className="flex-1 px-4 py-12"
                >
                    {isInitializing ? (
                        <View className="flex-1 items-center justify-center">
                            <View className="w-24 h-24 bg-white rounded-3xl items-center justify-center mb-6 shadow-xl shadow-orange-500/20 border-2 border-orange-500/30">
                                <ActivityIndicator size="large" color="#f97316" />
                            </View>
                            <Text className="text-slate-900 text-xl font-black tracking-widest uppercase">Initializing Board</Text>
                            <Text className="text-slate-500 text-xs font-bold tracking-wide mt-2 uppercase">{gameMode === 'bot' ? 'Waking up AI...' : 'Connecting to peer...'}</Text>
                        </View>
                    ) : (
                        <>
                            {/* Top Bar / Opponent */}
                            <View className="flex-row items-center justify-between mb-auto mt-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                                <View className="flex-row items-center">
                                    <View className="w-14 h-14 bg-slate-50 rounded-full overflow-hidden border-2 border-orange-500/30 shadow-sm">
                                        {matchDetails.opponent?.avatar === 'fync_logo' ? (
                                            <Image source={require('../../assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
                                        ) : matchDetails.opponent?.avatar ? (
                                            <Image source={{ uri: matchDetails.opponent.avatar }} className="w-full h-full" />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-orange-50">
                                                {gameMode === 'bot' ? <Ionicons name="hardware-chip" size={24} color="#f97316" /> : <Ionicons name="person" size={24} color="#f97316" />}
                                            </View>
                                        )}
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-slate-900 text-base font-black uppercase tracking-wider">{matchDetails.opponent?.name || matchDetails.opponent?.username}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className="w-2 h-2 rounded-full bg-orange-500 mr-2" />
                                            <Text className="text-slate-500 font-bold text-2xs tracking-wide uppercase">Playing {matchDetails.color === 'w' ? 'Black' : 'White'}</Text>
                                        </View>
                                    </View>
                                </View>
                                {botThinking && (
                                    <View className="bg-orange-50 p-3 rounded-2xl border border-orange-100">
                                        <ActivityIndicator color="#f97316" size="small" />
                                    </View>
                                )}
                                {!botThinking && !isMyTurn && gameMode === 'pvp' && (
                                    <View className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                        <Text className="text-slate-600 font-black text-xs uppercase tracking-wide">{timeLeft}s</Text>
                                    </View>
                                )}
                            </View>

                            {/* Chess Board */}
                            <View className="items-center justify-center bg-white p-1 self-center shadow-2xl shadow-slate-200 border border-slate-100 w-full my-8">
                                <Chessboard 
                                    ref={chessboardRef} 
                                    onMove={handleMove}
                                    gestureEnabled={isMyTurn && !gameOver}
                                    colors={{ black: '#171717', white: '#f1f5f9' }}
                                    boardSize={Dimensions.get('window').width - 40}
                                />
                            </View>

                            {/* Bottom Bar / Me */}
                            <View className="flex-row items-center justify-between mt-auto mb-8 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                                <View className="flex-row items-center">
                                    <View className={`w-14 h-14 bg-slate-50 rounded-full overflow-hidden border-2 shadow-sm ${isMyTurn ? 'border-green-500' : 'border-slate-200'}`}>
                                        {user?.avatar ? (
                                            <Image source={{ uri: user.avatar }} className="w-full h-full" />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-slate-100">
                                                <Ionicons name="person" size={24} color={isMyTurn ? '#22c55e' : '#94a3b8'} />
                                            </View>
                                        )}
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-slate-900 text-base font-black uppercase tracking-wider">You</Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className={`w-2 h-2 rounded-full mr-2 ${isMyTurn ? 'bg-green-500' : 'bg-slate-300'}`} />
                                            <Text className={`font-bold text-2xs tracking-[2px] uppercase ${isMyTurn ? 'text-green-500' : 'text-slate-500'}`}>
                                                {isMyTurn ? "Your Turn" : "Waiting..."}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                
                                {isMyTurn && gameMode === 'pvp' && (
                                    <View className="absolute left-1/2 -ml-6 bg-red-100 px-4 py-2 rounded-xl border border-red-200 shadow-sm">
                                        <Text className={`font-black text-lg ${timeLeft <= 10 ? 'text-red-600' : 'text-red-500'}`}>{timeLeft}s</Text>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    onPress={handleResign}
                                    className="w-12 h-12 bg-red-50 rounded-2xl items-center justify-center border border-red-100 shadow-sm"
                                >
                                    <Ionicons name="flag" size={20} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </LinearGradient>
            </GestureHandlerRootView>
        </Modal>
    );
};

export default ChessGame;
