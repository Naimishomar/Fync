import React, { useState, useEffect, useRef, useCallback } from 'react';
import {View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, StatusBar, ActivityIndicator, Pressable} from 'react-native'
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import Feather from '@expo/vector-icons/Feather';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker'; 
import { useAuth } from '../../context/auth.context';
import socket from '../../utils/socket';
import { checkClubStatus } from '../../utils/nightClub'; 
import axios from '../../context/axiosConfig';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, IconBtn } from '../ui/kit';
import { pickReportReason } from '../../utils/safety';

const BG_IMAGE = "https://images.unsplash.com/photo-1531685250784-7569949d48b3?q=80&w=1000&auto=format&fit=crop";

const ADJECTIVES = ["Neon", "Silent", "Hollow", "Cyber", "Mist", "Void", "Lunar", "Solar", "Glitch", "Shadow", "Retro", "Lost", "Vivid", "Dark", "Pale"];
const NOUNS = ["Walker", "Ghost", "Echo", "Mind", "Rider", "Surfer", "Drifter", "Phantom", "Signal", "Soul", "Viper", "Nomad", "Wolf", "Owl", "Rebel"];

// Seeded from the server's per-night pseudonym, never a real user id. The
// pseudonym already rotates each night, so this needs no date of its own — and
// there is no longer an account id on the client to leak or correlate.
const getNightIdentity = (nightId: string | undefined) => {
    if (!nightId) return { username: "Unknown Soul", avatar: "https://api.dicebear.com/9.x/glass/png?seed=unknown" };
    const seed = nightId;
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    const adjIndex = Math.abs(hash) % ADJECTIVES.length;
    const nounIndex = Math.abs(hash >> 3) % NOUNS.length; 
    const username = `${ADJECTIVES[adjIndex]} ${NOUNS[nounIndex]}`;
    const avatar = `https://api.dicebear.com/9.x/dylan/png?seed=${hash}`;
    return { username, avatar };
};

// Pseudonyms whose messages the viewer reported. Module-level so they stay
// hidden for the rest of the app session, not just this mount.
const hiddenNightSenders = new Set<string>();

type NightAck = { ok?: boolean; message?: string };
// Timed so a dropped socket still resolves the ack (err set) instead of hanging.
const emitReport = (event: string, payload: object, done: (ack: NightAck) => void) =>
    socket.timeout(10000).emit(event, payload, (err: any, ack: NightAck) =>
        done(err ? { ok: false, message: "Couldn't reach the club. Try again." } : ack || {}));

export default function TwelveAMClub() {
  const [isOpen, setIsOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(""); 
  const [mode, setMode] = useState<'global' | 'private'>('global'); // Added mode toggle
  const [messages, setMessages] = useState<any[]>([]);
  const [privateMessages, setPrivateMessages] = useState<any[]>([]); // Messages for 1v1
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false); // Matchmaking state
  const [matchRoomId, setMatchRoomId] = useState<string | null>(null);
  // Our own alias for tonight, issued by the server on join.
  const [myNightId, setMyNightId] = useState<string | null>(null);
  // Bumped when a pseudonym is added to hiddenNightSenders, to re-filter.
  const [, setHiddenTick] = useState(0);

  const { user } = useAuth();
  const navigation = useNavigation();
  const CURRENT_USER_ID = user?._id || user?.id; 
  const myIdentity = getNightIdentity(myNightId ?? undefined);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const checkTime = () => {
      // IST, matching the server's gate. `date-fns` startOfDay/addDays worked on
      // the device's calendar day, which is a different midnight abroad.
      const { isOpen: open, secondsUntilOpen } = checkClubStatus();
      setIsOpen(open);
      if (!open) {
        const h = Math.floor(secondsUntilOpen / 3600);
        const m = Math.floor((secondsUntilOpen % 3600) / 60);
        setTimeLeft(`${h}h ${m}m ${secondsUntilOpen % 60}s`);
      }
    };
    checkTime(); 
    const timer = setInterval(checkTime, 1000); 
    return () => clearInterval(timer);
  }, []);

  // Use a ref to prevent stale closures in socket listeners
  const matchRoomIdRef = useRef<string | null>(null);
  useEffect(() => { matchRoomIdRef.current = matchRoomId; }, [matchRoomId]);

  useEffect(() => {
    if (!isOpen) return;
    socket.emit("join_night_club");

    const handleJoined = (data: any) => {
      setMyNightId(data.youAre ?? null);
      setMessages([...(data.history || [])].reverse());
    };

    const handleNewMessage = (msg: any) => {
      setMessages((prev) => {
        if (msg._id && prev.some(m => m._id === msg._id)) return prev;
        const pendingIndex = prev.findIndex(m => m.pending && m.tempId === msg.tempId);
        if (pendingIndex !== -1) {
            const newMessages = [...prev];
            newMessages[pendingIndex] = msg; 
            return newMessages;
        }
        return [msg, ...prev];
      });
    };

    const handleSearching = () => setIsSearching(true);
    const handleMatchFound = ({ roomId }: { roomId: string }) => {
        setMatchRoomId(roomId);
        setIsSearching(false);
        setPrivateMessages([]);
        Alert.alert("Matched!", "You are now connected to a stranger. Be nice!");
    };
    const handleNewPrivateMessage = (msg: any) => {
        setPrivateMessages(prev => [msg, ...prev]);
    };
    const handlePartnerLeft = () => {
        setMatchRoomId(null);
        Alert.alert("Disconnected", "Your partner left the chat. Finding someone new...");
        findMatch();
    };

    const handleError = (err: any) => Alert.alert("Club Error", err.message);

    socket.on("night_club_joined", handleJoined);
    socket.on("new_night_message", handleNewMessage);
    socket.on("night_club_error", handleError);
    socket.on("night_1v1_searching", handleSearching);
    socket.on("night_1v1_found", handleMatchFound);
    socket.on("new_night_1v1_message", handleNewPrivateMessage);
    socket.on("night_1v1_partner_left", handlePartnerLeft);

    const onConnect = () => {
        socket.emit("join_night_club");
    };
    socket.on("connect", onConnect);

    return () => {
      socket.off("night_club_joined", handleJoined);
      socket.off("new_night_message", handleNewMessage);
      socket.off("night_club_error", handleError);
      socket.off("night_1v1_searching", handleSearching);
      socket.off("night_1v1_found", handleMatchFound);
      socket.off("new_night_1v1_message", handleNewPrivateMessage);
      socket.off("night_1v1_partner_left", handlePartnerLeft);
      socket.off("connect", onConnect);
      
      // Notify partner if exiting while in a match
      if (matchRoomIdRef.current && CURRENT_USER_ID) {
        socket.emit("leave_night_1v1", { roomId: matchRoomIdRef.current });
      }
    };
  }, [isOpen]);

  // Handle mode-based matchmaking triggers
  useEffect(() => {
    if (isOpen && mode === 'private' && !matchRoomId && !isSearching) {
        findMatch();
    }
  }, [mode, matchRoomId, isSearching, isOpen]);

  const findMatch = () => {
      if (!CURRENT_USER_ID) return;
      setIsSearching(true);
      setMatchRoomId(null);
      setPrivateMessages([]);
      socket.emit("find_night_1v1");
  };

  const skipMatch = () => {
      if (!CURRENT_USER_ID || !matchRoomId) return;
      socket.emit("skip_night_1v1", { roomId: matchRoomId });
      
      // Clear current match and immediately requeue by invoking findMatch
      setMatchRoomId(null);
      setPrivateMessages([]);
      findMatch();
  };

  // Report & leave: the server ends the 1v1 on a successful report, so only
  // requeue; if the report failed, still leave via a normal skip.
  const reportPartner = () => pickReportReason((reason) => {
      emitReport("report_night_partner", { reason }, (ack) => {
          Alert.alert(ack.ok ? "Reported" : "Couldn't report", ack.message || (ack.ok ? "You won't be matched with them again." : undefined));
          if (ack.ok) findMatch(); else skipMatch();
      });
  }, "Report & leave");

  const openMessageMenu = (item: any) => {
      const senderKey = item.sender?.id ?? item.sender?._id;
      const isMe = !!senderKey && senderKey === myNightId;
      Alert.alert("Message", undefined, [
          { text: "Reply", onPress: () => setReplyingTo(item) },
          ...(!isMe && !item.pending ? [{
              text: "Report", style: "destructive" as const,
              onPress: () => pickReportReason((reason) => emitReport("report_night_message", { messageId: item._id, reason }, (ack) => {
                  if (ack.ok && senderKey) {
                      hiddenNightSenders.add(senderKey);
                      setHiddenTick(t => t + 1);
                  }
                  Alert.alert(ack.ok ? "Reported" : "Couldn't report", ack.message || (ack.ok ? "You won't see their messages tonight." : undefined));
              })),
          }] : []),
          { text: "Cancel", style: "cancel" },
      ]);
  };

  const processAndSendMedia = async (uri: string) => {
      if (!CURRENT_USER_ID) return;
      setIsProcessing(true);
      const tempId = Date.now().toString();
      
      const optimisticMsg = {
          _id: tempId, tempId, message: "", messageType: 'image', fileUrl: uri,
          // senderId: the 1v1 renderer keys "is me" off it, not off sender.id.
          sender: { id: myNightId }, senderId: myNightId,
          createdAt: new Date().toISOString(), pending: true,
          replyTo: replyingTo ? {
              messageId: replyingTo._id,
              text: replyingTo.messageType === 'image' ? 'Image' : replyingTo.message,
              senderName: getNightIdentity(replyingTo.sender?.id ?? replyingTo.sender?._id).username
          } : null
      };

      if (mode === 'global') setMessages(prev => [optimisticMsg, ...prev]);
      else setPrivateMessages(prev => [optimisticMsg, ...prev]);

      try {
          const formData = new FormData();
          const cleanUri = Platform.OS === 'android' ? uri : uri.replace('file://', '');
          formData.append("file", { 
              uri: cleanUri, 
              name: "night_club.jpg", 
              type: "image/jpeg" 
          } as any);
          
          const res = await axios.post("/night-chat/upload", formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (res.data.success) {
              if (mode === 'global') {
                  socket.emit("send_night_message", {
                      text: "", tempId, type: 'image', mediaUrl: res.data.fileUrl,
                      replyTo: optimisticMsg.replyTo
                  });
              } else {
                  socket.emit("send_night_1v1_message", {
                      roomId: matchRoomId, text: "", type: 'image', mediaUrl: res.data.fileUrl
                  });
                  // The server only relays 1v1 messages to the partner, so nothing
                  // ever replaces this optimistic row: settle it here or it spins forever.
                  setPrivateMessages(prev => prev.map(m => m._id === tempId ? { ...m, pending: false, fileUrl: res.data.fileUrl } : m));
              }
          }
      } catch (e) {
          console.error("Media Error:", e);
          if (mode === 'global') setMessages(prev => prev.filter(m => m.tempId !== tempId));
          else setPrivateMessages(prev => prev.filter(m => m._id !== tempId));
          Alert.alert("Error", "Failed to send image.");
      } finally {
          setIsProcessing(false);
          setReplyingTo(null);
      }
  };

  const pickImage = async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
          Alert.alert('Permission needed', 'Access to gallery required.');
          return;
          }
      const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.3,
      });
      if (!result.canceled) {
          processAndSendMedia(result.assets[0].uri);
      }
  };

  const sendMessage = () => {
    if (!inputText.trim() || !CURRENT_USER_ID) return;
    const textToSend = inputText.trim();
    const tempId = Date.now().toString();

    if (mode === 'global') {
        const optimisticMsg = {
            _id: tempId, tempId, message: textToSend, type: 'text',
            sender: { id: myNightId },
            createdAt: new Date().toISOString(), pending: true,
            replyTo: replyingTo ? {
                messageId: replyingTo._id,
                text: replyingTo.messageType === 'image' ? 'Image' : replyingTo.message,
                senderName: getNightIdentity(replyingTo.sender?.id ?? replyingTo.sender?._id).username
            } : null
        };
        setMessages(prev => [optimisticMsg, ...prev]);
        socket.emit("send_night_message", {
          text: textToSend, tempId, type: 'text',
          replyTo: optimisticMsg.replyTo
        });
    } else {
        if (!matchRoomId) return findMatch();
        const optimisticMsg = {
            _id: tempId, message: textToSend, senderId: myNightId,
            createdAt: new Date().toISOString()
        };
        setPrivateMessages(prev => [optimisticMsg, ...prev]);
        socket.emit("send_night_1v1_message", {
            roomId: matchRoomId, text: textToSend, type: 'text'
        });
    }

    setInputText("");
    setReplyingTo(null);
  };

  const renderMessage = useCallback(({ item }: { item: any }) => {
    const senderKey = mode === 'global'
      ? (item.sender?.id ?? item.sender?._id)   // sender._id: pre-pseudonym backlog
      : item.senderId;
    const isMe = !!senderKey && senderKey === myNightId;
    const identity = mode === 'global'
      ? getNightIdentity(senderKey)
      : { username: "Stranger", avatar: "https://api.dicebear.com/9.x/fun-emoji/png?seed=stranger" };

    return (
        <View className={`mb-4 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
            {!isMe && (
                <Image
                    source={{ uri: identity.avatar }}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.night, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginRight: 8, alignSelf: 'flex-end', marginBottom: 4 }}
                    cachePolicy="memory-disk"
                />
            )}
            <View className={`max-w-[80%] rounded-xl px-4 py-3 ${isMe ? 'bg-recruiter' : 'bg-night/90 border border-white/5'}`}>
                <Pressable
                  onLongPress={() => mode === 'global' && openMessageMenu(item)}
                  delayLongPress={300}
                >
                    {!isMe && (
                        <Text className="text-white/60 font-display text-label mb-1 uppercase">{identity.username}</Text>
                    )}

                    {mode === 'global' && item.replyTo && (
                        <View className="bg-night/50 border-l-2 border-recruiter rounded-md mb-2 p-2">
                             <Text className="text-recruiter text-label font-display uppercase">{item.replyTo.senderName}</Text>
                             <Text className="text-white/50 text-xs" numberOfLines={1}>{item.replyTo.text}</Text>
                        </View>
                    )}
                    
                    {item.messageType === 'image' || item.type === 'image' ? (
                        <View className="mb-1">
                            <Image
                                source={{ uri: item.fileUrl || item.mediaUrl }}
                                style={{ width: 220, height: 160, borderRadius: 12 }}
                                contentFit="cover"
                                cachePolicy="memory-disk"
                            />
                            {item.pending && (
                                <View className="absolute inset-0 items-center justify-center bg-black/30 rounded-xl">
                                    <ActivityIndicator size="small" color="white" />
                                </View>
                            )}
                        </View>
                    ) : (
                        <Text className="text-white text-sm leading-5 font-medium">
                            {item.message}
                        </Text>
                    )}

                    <View className="flex-row justify-end mt-1.5">
                         <Text className={`text-label font-semibold ${isMe ? 'text-violet/50' : 'text-night-3'}`}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                </Pressable>
            </View>
        </View>
    );
  // openMessageMenu only reads myNightId, already a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, myNightId, setReplyingTo]);

  if (!isOpen) {
    return (
      <View className="flex-1 bg-night justify-center items-center">
        <Image source={{ uri: BG_IMAGE }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.6 }} />
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} className="absolute w-full h-full" />
        {/* No way out on iOS without this: the locked state had no back button. */}
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
          <AppBar night title="12 AM Club" onBack={() => navigation.goBack()} />
        </View>
        <View className="items-center p-card-pad bg-black/40 rounded-sheet border border-white/10 shadow-hair w-[85%]">
            <Ionicons name="lock-closed" size={42} color={C.recruiter} />
            <Text className="text-white text-3xl font-display mt-4 uppercase">Club Locked</Text>
            <Text className="text-recruiter text-xl font-display mt-2">{timeLeft}</Text>
            <Text className="text-night-3 text-label uppercase font-display mt-8 text-center">Doors Open At Midnight</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-night">
        <StatusBar barStyle="light-content" />
        <Image source={{ uri: BG_IMAGE }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0.3 }} />
        <LinearGradient colors={['rgba(79, 70, 229, 0.1)', 'rgba(0,0,0,0.9)', '#12100E']} className="absolute w-full h-full" />

        <View className="flex-1">
                <AppBar
                    night
                    title={mode === 'global' ? 'Night Club' : 'Secret 1v1'}
                    onBack={() => navigation.goBack()}
                    right={<>
                        {mode === 'private' && matchRoomId && (
                            <TouchableOpacity
                                onPress={reportPartner}
                                accessibilityLabel="Report and leave"
                                className="bg-night border border-danger/40 px-2.5 py-1 rounded-full mr-2"
                            >
                                <Text className="text-danger text-label font-display uppercase">Report</Text>
                            </TouchableOpacity>
                        )}
                        {mode === 'private' && matchRoomId && (
                            <TouchableOpacity
                                onPress={skipMatch}
                                className="bg-night border border-white/10 px-2.5 py-1 rounded-full mr-2"
                            >
                                <Text className="text-recruiter text-label font-display uppercase">Next</Text>
                            </TouchableOpacity>
                        )}
                        {mode === 'global' && (
                            <View className="flex-row items-center bg-danger/10 px-3 py-1.5 rounded-full border border-danger/20 mr-2">
                                <View className="w-1.5 h-1.5 rounded-full bg-danger mr-2" />
                                <Text className="text-danger text-label font-display uppercase">Live</Text>
                            </View>
                        )}
                        <IconBtn
                            name={mode === 'global' ? 'earth' : 'eye-off-outline'}
                            color={C.recruiter}
                            onPress={() => setMode(mode === 'global' ? 'private' : 'global')}
                        />
                    </>}
                />

            <View className="flex-1">
                {mode === 'private' && isSearching ? (
                    <View className="flex-1 justify-center items-center">
                        <View className="w-32 h-32 rounded-full border-2 border-recruiter/30 items-center justify-center">
                            <ActivityIndicator size="large" color={C.recruiter} />
                        </View>
                        <Text className="text-white font-display uppercase text-sm mt-6">Searching for souls...</Text>
                        <Text className="text-night-3 text-label uppercase mt-2">Connecting you to a random stranger</Text>
                    </View>
                ) : mode === 'private' && !matchRoomId ? (
                    <View className="flex-1 justify-center items-center px-gutter">
                        <MaterialCommunityIcons name="comment-search-outline" size={60} color={C.night3} />
                        <Text className="text-white text-xl font-display uppercase mt-4 text-center">Ready to Chat?</Text>
                        <Text className="text-night-3 text-sm text-center mt-2 leading-5">Match with someone anonymous and start a private conversation. Completely secret.</Text>
                        <TouchableOpacity 
                            onPress={findMatch}
                            className="bg-recruiter px-gutter py-4 rounded-card mt-8 w-full items-center shadow-hair"
                        >
                            <Text className="text-white font-display uppercase">Connect Now</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        ref={flatListRef}
                        data={mode === 'global'
                            ? (hiddenNightSenders.size ? messages.filter(m => !hiddenNightSenders.has(m.sender?.id ?? m.sender?._id)) : messages)
                            : privateMessages}
                        inverted
                        keyExtractor={(item, index) => item._id || item.tempId || String(index)}
                        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        renderItem={renderMessage}
                        ListEmptyComponent={
                            <View className="items-center py-10">
                                <Text className="text-night-3 text-label font-display uppercase text-center">
                                    {mode === 'global' ? 'Quiet so far. Say something.' : 'Matched. Say hi.'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>

            <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}>
                
                {mode === 'global' && replyingTo && (
                  <BlurView intensity={80} tint="dark" className="px-5 py-3 border-t border-white/5 flex-row items-center justify-between">
                    <View className="border-l-2 border-recruiter pl-3 flex-1">
                      <Text className="text-recruiter text-label font-display uppercase">
                        Replying to {getNightIdentity(replyingTo.sender?.id ?? replyingTo.sender?._id).username}
                      </Text>
                      <Text className="text-white/60 text-xs" numberOfLines={1}>
                        {replyingTo.messageType === 'image' ? 'Shared an image' : replyingTo.message}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={12}>
                      <Ionicons name="close-circle" size={20} color={C.night3} />
                    </TouchableOpacity>
                  </BlurView>
                )}

                {/* Hide input if searching or no match in private mode */}
                {!(mode === 'private' && (isSearching || !matchRoomId)) && (
                  <View className="bg-night/80 px-5 pt-4 pb-8 border-t border-white/5">
                      <View className="flex-row items-end gap-3">
                          {mode === 'global' && (
                              <TouchableOpacity 
                                  onPress={pickImage}
                                  disabled={isProcessing}
                                  className="w-11 h-11 bg-night items-center justify-center mb-1 border-2 border-night rounded-md"
                              >
                                  {isProcessing ? (
                                      <ActivityIndicator size="small" color={C.recruiter} />
                                  ) : (
                                      <Feather name="image" size={20} color={C.recruiter} />
                                  )}
                              </TouchableOpacity>
                          )}
                          
                          <View className="flex-1 min-h-[44px] max-h-32 bg-night/50 rounded-card px-4 border border-white/5 justify-center">
                              <TextInput 
                                  placeholder={isProcessing ? "Sending binary data..." : mode === 'global' ? `Posting as ${myIdentity.username}...` : "Type a secret message..."}
                                  placeholderTextColor={C.night3}
                                  className="text-white text-sm font-semibold"
                                  multiline
                                  value={inputText}
                                  onChangeText={setInputText}
                                  editable={!isProcessing}
                              />
                          </View>

                          <TouchableOpacity 
                              onPress={sendMessage}
                              disabled={isProcessing || !inputText.trim()}
                              className={`w-11 h-11 rounded-card items-center justify-center mb-1 ${inputText.trim() ? 'bg-recruiter' : 'bg-night'}`}
                          >
                              <Feather name="arrow-up" size={24} color={inputText.trim() ? "white" : C.night3} />
                          </TouchableOpacity>
                      </View>
                      
                      <Text className="text-night-ink text-label font-display uppercase text-center mt-4">
                          {mode === 'global' ? 'All chat history vanishes at 6 AM' : '1-on-1 chats are not stored and vanish instantly'}
                      </Text>
                  </View>
                )}
            </KeyboardAvoidingView>
        </View>
    </View>
  );
}
