import React, { useState, useEffect, useRef } from 'react';
import {View, Text, TouchableOpacity, ActivityIndicator, Image, Modal, Dimensions} from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../context/auth.context';
import { Chess } from 'chess.js';
import Chessboard, { ChessboardRef } from 'react-native-chessboard';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Alert } from '../ui/AlertModal';

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
                    msg = winnerId === user?._id ? "You won by checkmate" : "You lost by checkmate";
                } else if (reason === 'resignation') {
                    msg = winnerId === user?._id ? "Opponent resigned — you won" : "You Resigned.";
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
                msg = won ? "You won by checkmate" : "You lost by checkmate";
            } else if (chess.isStalemate()) {
                msg = "Stalemate!";
            }

            if (gameMode === 'bot') {
                if (won && socket) {
                    socket.emit('bot_win', { userId: user?._id });
                    Alert.alert("Victory!", msg + "\n\n+5 Fync Coins awarded!", [{ text: "Leave", onPress: onGameOver }]);
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
                <View 
                    className="flex-1 px-4 py-12"
                 style={{ backgroundColor: '#F5F2EC' }}>
                    {isInitializing ? (
                        <View className="flex-1 items-center justify-center">
                            <View className="w-20 h-20 bg-paper-2 rounded-card items-center justify-center mb-6">
                                <ActivityIndicator size="large" color="#F97316" />
                            </View>
                            <Text className="text-ink text-xl font-display uppercase">Initializing Board</Text>
                            <Text className="text-ink-3 text-xs font-semibold mt-2 uppercase">{gameMode === 'bot' ? 'Waking up AI...' : 'Connecting to peer...'}</Text>
                        </View>
                    ) : (
                        <>
                            {/* Top Bar / Opponent */}
                            <View className="flex-row items-center justify-between mb-auto mt-4 bg-card p-4 rounded-card border border-line shadow-hair">
                                <View className="flex-row items-center">
                                    <View className="w-14 h-14 bg-paper-2 rounded-full overflow-hidden border-2 border-brand-500/30 shadow-hair">
                                        {matchDetails.opponent?.avatar === 'fync_logo' ? (
                                            <Image source={require('../../assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
                                        ) : matchDetails.opponent?.avatar ? (
                                            <Image source={{ uri: matchDetails.opponent.avatar }} className="w-full h-full" />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-brand-50">
                                                {gameMode === 'bot' ? <Ionicons name="hardware-chip" size={24} color="#F97316" /> : <Ionicons name="person" size={24} color="#F97316" />}
                                            </View>
                                        )}
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-ink text-base font-display uppercase">{matchDetails.opponent?.name || matchDetails.opponent?.username}</Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className="w-2 h-2 rounded-full bg-brand-500 mr-2" />
                                            <Text className="text-ink-3 font-semibold text-label uppercase">Playing {matchDetails.color === 'w' ? 'Black' : 'White'}</Text>
                                        </View>
                                    </View>
                                </View>
                                {botThinking && (
                                    <View className="bg-paper-2 p-3 rounded-card border border-line">
                                        <ActivityIndicator color="#F97316" size="small" />
                                    </View>
                                )}
                                {!botThinking && !isMyTurn && gameMode === 'pvp' && (
                                    <View className="bg-paper-2 px-3 py-1.5 rounded-xl border border-line">
                                        <Text className="font-semibold text-base text-ink">{timeLeft}s</Text>
                                    </View>
                                )}
                            </View>

                            {/* Chess Board */}
                            <View className="items-center justify-center bg-card p-1 self-center shadow-hair border border-line w-full my-8">
                                <Chessboard 
                                    ref={chessboardRef} 
                                    onMove={handleMove}
                                    gestureEnabled={isMyTurn && !gameOver}
                                    colors={{ black: '#12100E', white: '#EDE8E0' }}
                                    boardSize={Dimensions.get('window').width - 40}
                                />
                            </View>

                            {/* Bottom Bar / Me */}
                            <View className="flex-row items-center justify-between mt-auto mb-8 bg-card p-4 rounded-card border border-line shadow-hair">
                                <View className="flex-row items-center">
                                    <View className={`w-14 h-14 bg-paper-2 rounded-full overflow-hidden border-2 shadow-hair ${isMyTurn ? 'border-success' : 'border-line'}`}>
                                        {user?.avatar ? (
                                            <Image source={{ uri: user.avatar }} className="w-full h-full" />
                                        ) : (
                                            <View className="w-full h-full items-center justify-center bg-paper-2">
                                                <Ionicons name="person" size={24} color={isMyTurn ? '#047857' : '#8B857E'} />
                                            </View>
                                        )}
                                    </View>
                                    <View className="ml-4">
                                        <Text className="text-ink text-base font-display uppercase">You</Text>
                                        <View className="flex-row items-center mt-1">
                                            <View className={`w-2 h-2 rounded-full mr-2 ${isMyTurn ? 'bg-success' : 'bg-paper-2'}`} />
                                            <Text className={`font-semibold text-label uppercase ${isMyTurn ? 'text-success' : 'text-ink-3'}`}>
                                                {isMyTurn ? "Your Turn" : "Waiting..."}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                
                                {isMyTurn && gameMode === 'pvp' && (
                                    <View className="absolute left-1/2 -ml-6 bg-danger/15 px-4 py-2 rounded-xl border border-danger/25 shadow-hair">
                                        <Text className={`font-semibold text-lg ${timeLeft <= 10 ? 'text-danger' : 'text-danger'}`}>{timeLeft}s</Text>
                                    </View>
                                )}

                                <TouchableOpacity 
                                    onPress={handleResign}
                                    className="w-12 h-12 bg-danger/10 rounded-card items-center justify-center border border-danger/15 shadow-hair"
                                >
                                    <Ionicons name="flag" size={20} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </GestureHandlerRootView>
        </Modal>
    );
};

export default ChessGame;
