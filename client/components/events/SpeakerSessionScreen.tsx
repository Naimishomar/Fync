import React, { useState, useEffect, useCallback, memo, useMemo } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl,
  TextInput,
  Dimensions,
  StatusBar,
  Modal,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import axios from '../../context/axiosConfig';
import { navigate, goBack } from '../../utils/navigation';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/auth.context';
import * as ImagePicker from 'expo-image-picker';
import { collegesInIndia } from '../../data/college';
// @ts-ignore
import { RAZORPAY_KEY_ID } from '@env';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get('window');

// --- TYPES ---
interface User {
  _id: string;
  name: string;
  email: string;
  mobileNumber?: string;
  college?: string;
  year?: string;
  department?: string;
  avatar?: string;
}

interface Speaker {
  _id: string;
  name: string;
  designation: string;
  image: string;
}

interface ContactDetail {
  name: string;
  mobile: string;
  email: string;
}

interface SpeakerSession {
  _id: string;
  eventId: number;
  eventName: string;
  description: string;
  college: string;
  venue: string;
  date: string;
  startTime: string;
  endTime: string;
  admin_email: string;
  admin_upi_id?: string;
  speakers?: Speaker[];
  agenda?: string;
  fee?: number;
  userLimit?: number;
  logo?: string;
  banner?: string;
  status: 'open' | 'closed';
  isCollegeSpecific?: boolean;
  secondaryAdmins?: (string | any)[];
  isCommunityActive?: boolean;
  registrationsCount?: number;
  contactDetails?: ContactDetail[];
}

interface Registration {
  _id: string;
  eventId: SpeakerSession | string;
  userId: User | string;
  isPaid: boolean;
  isPresent?: boolean;
  qrCode: string;
  createdAt: string;
}

// --- 1. SESSION CARD ---
const SessionCard = memo(({ item, onRegister, isAdmin, onAddSpeaker, onEditSession, onEditSpeaker, isRegistered, onViewAttendees, onOpenScanner, isPrimaryAdmin }: { 
  item: SpeakerSession; 
  onRegister: (item: SpeakerSession) => void;
  isAdmin: boolean;
  onAddSpeaker: (sessionId: number) => void;
  onEditSession: (session: SpeakerSession) => void;
  onEditSpeaker: (speaker: Speaker, sessionId: number) => void;
  isRegistered?: boolean;
  onViewAttendees: (eventId: number) => void;
  onOpenScanner: () => void;
  isPrimaryAdmin?: boolean;
}) => {
  const isLimitReached = !isAdmin && !isRegistered && (item.userLimit ?? 0) > 0 && (item.userLimit ?? 0) < 1000000 && (item.registrationsCount ?? 0) >= (item.userLimit ?? 0);

  return (
    <View className="bg-white rounded-[40px] mb-8 mx-5 overflow-hidden shadow-2xl shadow-black/10 border border-gray-100">
      {/* Banner / Header */}
      <View className="h-44 relative">
        {item.banner ? (
          <Image source={{ uri: item.banner }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#ec4899', '#be185d']} className="w-full h-full" />
        )}
        
        <View className="absolute top-5 left-5 bg-white/90 px-4 py-2 rounded-2xl backdrop-blur-md">
            <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest">{item.college}</Text>
        </View>

        {isAdmin && (
            <View className="absolute top-5 right-5 flex-row gap-2">
                <TouchableOpacity 
                    onPress={onOpenScanner}
                    className="w-10 h-10 bg-indigo-500 rounded-xl items-center justify-center shadow-sm"
                >
                    <Ionicons name="scan" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity 
                    onPress={() => onViewAttendees(item.eventId)}
                    className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center backdrop-blur-md shadow-sm"
                >
                    <Ionicons name="people" size={20} color="#ec4899" />
                </TouchableOpacity>
                {isPrimaryAdmin && (
                    <TouchableOpacity 
                        onPress={() => onEditSession(item)}
                        className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center backdrop-blur-md shadow-sm"
                    >
                        <Ionicons name="settings-outline" size={20} color="black" />
                    </TouchableOpacity>
                )}
            </View>
        )}
        
        <View className="absolute -bottom-6 left-8 w-20 h-20 bg-white rounded-3xl p-1.5 shadow-lg">
            {item.logo ? (
                <Image source={{ uri: item.logo }} className="w-full h-full rounded-[22px]" />
            ) : (
                <View className="w-full h-full bg-pink-100 rounded-[22px] items-center justify-center">
                    <Ionicons name="mic" size={24} color="#ec4899" />
                </View>
            )}
        </View>
      </View>

      <View className="mt-10 p-6">
        <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter mb-2" numberOfLines={2}>
          {item.eventName}
        </Text>

        <View className="flex-row items-center mb-6 gap-3">
          <View className="flex-row items-center bg-zinc-50 px-4 py-2 rounded-2xl border border-gray-100">
            <Ionicons name="calendar-outline" size={14} color="#ec4899" />
            <Text className="text-zinc-600 text-[10px] font-bold ml-2">
              {new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </Text>
          </View>
          <View className="flex-row items-center bg-zinc-50 px-4 py-2 rounded-2xl border border-gray-100">
            <Ionicons name="time-outline" size={14} color="#ec4899" />
            <Text className="text-zinc-600 text-[10px] font-bold ml-2">
              {item.startTime} - {item.endTime}
            </Text>
          </View>
          {item.isCollegeSpecific && (
            <View className="flex-row items-center bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
                <Ionicons name="lock-closed" size={14} color="#d97706" />
                <Text className="text-amber-700 text-[10px] font-bold ml-2 uppercase tracking-tighter">Internal</Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center mb-6 bg-zinc-50 px-4 py-2 rounded-2xl border border-gray-100 self-start">
            <Ionicons name="location-outline" size={14} color="#ec4899" />
            <Text className="text-zinc-600 text-[10px] font-bold ml-2" numberOfLines={1}>{item.venue}</Text>
        </View>

        {/* Speakers Section */}
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
                <Text className="text-zinc-400 font-bold uppercase text-[10px] tracking-widest">Our Speakers</Text>
                {isPrimaryAdmin && (
                    <TouchableOpacity 
                        onPress={() => onAddSpeaker(item.eventId)}
                        className="bg-indigo-600 px-3 py-1.5 rounded-lg ml-auto"
                    >
                        <Text className="text-white text-[8px] font-bold uppercase tracking-widest">+ Add Speaker</Text>
                    </TouchableOpacity>
                )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
              {item.speakers && item.speakers.length > 0 ? (
                  item.speakers.map((speaker, idx) => (
                    <TouchableOpacity 
                        key={speaker._id || idx} 
                        onPress={() => isPrimaryAdmin ? onEditSpeaker(speaker, item.eventId) : null}
                        className="items-center mr-6"
                    >
                      <View className="relative">
                        <Image 
                            source={{ uri: speaker.image }} 
                            className="w-16 h-16 rounded-[24px] bg-gray-100 border border-gray-100"
                            resizeMode="cover"
                        />
                        {isPrimaryAdmin && (
                            <View className="absolute -top-1 -right-1 bg-zinc-900 w-5 h-5 rounded-full items-center justify-center border-2 border-white">
                                <Ionicons name="pencil" size={10} color="white" />
                            </View>
                        )}
                      </View>
                      <Text className="text-zinc-900 text-[9px] font-bold mt-2 text-center" numberOfLines={1}>{speaker.name}</Text>
                      <Text className="text-gray-400 text-[7px] font-bold text-center uppercase" numberOfLines={1}>{speaker.designation}</Text>
                    </TouchableOpacity>
                  ))
              ) : (
                  <View className="w-full flex-row items-center py-4 px-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                      <Ionicons name="people-outline" size={16} color="#94a3b8" />
                      <Text className="text-slate-400 text-[10px] font-bold ml-3 italic">No speakers added yet</Text>
                  </View>
              )}
            </ScrollView>
          </View>

        <Text className="text-zinc-500 text-xs mt-6 mb-8 leading-5" numberOfLines={3}>
          {item.description}
        </Text>

        {item.contactDetails && item.contactDetails.length > 0 && (
            <View className="mb-6 bg-zinc-50/50 p-5 rounded-[25px] border border-zinc-100/50">
                <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-3 px-1">Connect with Organizers</Text>
                {item.contactDetails.map((contact, idx) => (
                    <View key={idx} className="flex-row items-center justify-between mb-4 last:mb-0">
                        <View className="flex-1">
                            <Text className="text-zinc-900 font-black italic uppercase text-[10px]">{contact.name}</Text>
                            <View className="flex-row items-center gap-3 mt-1">
                                {contact.mobile && (
                                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${contact.mobile}`)} className="flex-row items-center">
                                        <Ionicons name="call" size={10} color="#6366f1" />
                                        <Text className="text-indigo-500 font-bold text-[8px] ml-1 uppercase">{contact.mobile}</Text>
                                    </TouchableOpacity>
                                )}
                                {contact.email && (
                                    <TouchableOpacity onPress={() => Linking.openURL(`mailto:${contact.email}`)} className="flex-row items-center">
                                        <Ionicons name="mail" size={10} color="#db2777" />
                                        <Text className="text-pink-500 font-bold text-[8px] ml-1 uppercase">{contact.email}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        <View className="w-8 h-8 bg-white rounded-xl items-center justify-center border border-zinc-100 shadow-sm">
                            <Ionicons name="person" size={14} color="#6366f1" />
                        </View>
                    </View>
                ))}
            </View>
        )}

        {(isRegistered || isAdmin) && item.isCommunityActive !== false && (
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => navigate('EventCommunityChat', { eventId: item._id, eventName: item.eventName, type: 'SpeakerSession' })}
                className="mb-6 bg-pink-50 p-5 rounded-[25px] flex-row items-center justify-between border border-pink-100"
            >
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-pink-600 rounded-2xl items-center justify-center">
                        <Ionicons name="chatbubbles" size={18} color="white" />
                    </View>
                    <View>
                        <Text className="text-pink-900 font-black italic uppercase text-[10px]">Session Community</Text>
                        <Text className="text-pink-400 font-bold text-[8px] uppercase tracking-widest mt-0.5">Ask questions & network</Text>
                    </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#db2777" />
            </TouchableOpacity>
        )}

        <View className="flex-row justify-between items-center bg-zinc-900 p-5 rounded-[30px] shadow-lg shadow-black/20">
          <View>
            <Text className="text-white/40 font-bold uppercase text-[7px] tracking-[2px]">Registration Fee</Text>
            <Text className="text-white text-xl font-black italic">
              {item.fee && item.fee > 0 ? `₹${item.fee}` : 'FREE'}
            </Text>
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => !isRegistered && item.status === 'open' && !isLimitReached && onRegister(item)}
            className={`${(isRegistered || item.status === 'closed' || isLimitReached) ? 'bg-zinc-800' : 'bg-white'} px-8 py-4 rounded-2xl`}
            disabled={!!isRegistered || item.status === 'closed' || isLimitReached}
          >
            <Text className={`${(isRegistered || item.status === 'closed' || isLimitReached) ? 'text-zinc-500' : 'text-zinc-900'} font-black italic text-[10px] uppercase tracking-widest`}>
              {item.status === 'closed' ? 'Closed' : isRegistered ? 'Joined' : isLimitReached ? 'FULL' : 'Register'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

// --- 2. JOINED SESSION CARD ---
const JoinedSessionCard = memo(({ item, onShowQR, onRefresh }: { item: Registration; onShowQR: (reg: Registration) => void; onRefresh: () => void }) => {
  const session = item.eventId as SpeakerSession;
  if (!session || typeof session === 'string') return null;

  return (
    <View className="bg-white rounded-3xl mb-6 mx-5 overflow-hidden shadow-xl shadow-black/5 border border-indigo-50 border-l-4 border-l-indigo-500">
      <View className="p-5">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-0.5">Joined Event</Text>
            <Text className="text-zinc-900 text-lg font-black italic tracking-tighter" numberOfLines={1}>
              {session.eventName}
            </Text>
          </View>
          <View className="flex-row gap-2">
              {(item as any).isAdmin && (
                <View className="bg-purple-100 px-3 py-1 rounded-full border border-purple-200">
                    <Text className="text-purple-600 text-[8px] font-black uppercase">Admin</Text>
                </View>
              )}
              {item.isPresent ? (
                <View className="bg-green-500 px-3 py-1 rounded-full flex-row items-center gap-1">
                    <Ionicons name="checkmark-circle" size={12} color="white" />
                    <Text className="text-white text-[8px] font-black uppercase">Present</Text>
                </View>
              ) : (
                <View className="bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
                    <Text className="text-indigo-600 text-[8px] font-black uppercase">
                        {(item as any).isAdmin ? 'Organizer' : 'Reserved'}
                    </Text>
                </View>
              )}
              {!(item as any).isAdmin && (
                <View className={`px-2 py-1 rounded-lg ${item.isPaid ? 'bg-green-100' : 'bg-amber-100'}`}>
                    <Text className={`text-[8px] font-bold uppercase ${item.isPaid ? 'text-green-600' : 'text-amber-600'}`}>
                        {item.isPaid ? 'Access Granted' : 'Payment Pending'}
                    </Text>
                </View>
              )}
          </View>
        </View>

        <View className="flex-row items-center mb-4 gap-3">
            <View className="flex-row items-center">
                <Ionicons name="calendar-clear-outline" size={12} color="#6366f1" />
                <Text className="text-zinc-500 text-[10px] font-bold ml-1 italic">{new Date(session.date).toLocaleDateString()}</Text>
            </View>
            <View className="flex-row items-center">
                <Ionicons name="time-outline" size={12} color="#6366f1" />
                <Text className="text-zinc-500 text-[10px] font-bold ml-1 italic">{session.startTime}</Text>
            </View>
        </View>

        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => item.isPaid ? onShowQR(item) : Alert.alert(
              "Payment Incomplete", 
              "This ticket is locked because payment is pending. Do you want to cancel this reservation so you can try again?",
              [
                  { text: "Keep Pending", style: "cancel" },
                  { 
                      text: "Drop Ticket", 
                      style: "destructive",
                      onPress: async () => {
                          try {
                              await axios.delete(`/speakers/register/${item._id}`);
                              onRefresh();
                          } catch(e) { console.log(e); }
                      }
                  }
              ]
          )}
          className={`flex-row items-center justify-center py-3 rounded-2xl border ${item.isPaid ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100 opacity-50'}`}
        >
          <Ionicons name="qr-code" size={16} color={item.isPaid ? "#4f46e5" : "#9ca3af"} />
          <Text className={`${item.isPaid ? 'text-indigo-600' : 'text-gray-400'} font-bold text-xs ml-2 uppercase tracking-widest`}>
            {item.isPaid 
                ? ((item as any).isAdmin ? 'Organizer Pass' : 'View Entry Pass') 
                : 'Locked (Tap to Drop)'
            }
          </Text>
        </TouchableOpacity>

        {session.isCommunityActive !== false && (
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => navigate('EventCommunityChat', { eventId: session._id, eventName: session.eventName, type: 'SpeakerSession' })}
                className="flex-row items-center justify-center py-4 rounded-2xl bg-pink-50 border border-pink-100 mt-3"
            >
                <Ionicons name="chatbubbles" size={16} color="#db2777" />
                <Text className="text-pink-600 font-bold text-xs ml-2 uppercase tracking-widest">Community Hub</Text>
            </TouchableOpacity>
        )}
      </View>
    </View>
  );
});



export default function SpeakerSessionScreen() {
  const { user } = useAuth();

  
  const [sessions, setSessions] = useState<SpeakerSession[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<Registration[]>([]);
  const [ticketsModalVisible, setTicketsModalVisible] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userSuggestions, setUserSuggestions] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  
  const [selectedReg, setSelectedReg] = useState<Registration | null>(null);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // --- ADMIN MODALS ---
  const [speakerModalVisible, setSpeakerModalVisible] = useState(false);
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [collegeModalVisible, setCollegeModalVisible] = useState(false);
  
  // Create / Update Session State
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [editSessionData, setEditSessionData] = useState<Partial<SpeakerSession>>({});
  const [eventLogo, setEventLogo] = useState<string | null>(null);
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const [savingSession, setSavingSession] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [feeType, setFeeType] = useState<'free' | 'paid'>('free');
  const [limitType, setLimitType] = useState<'unlimited' | 'custom'>('unlimited');

  // --- ATTENDEE MANAGEMENT ---
  const [attendeeModalVisible, setAttendeeModalVisible] = useState(false);
  const [attendees, setAttendees] = useState<Registration[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentEventForAttendees, setCurrentEventForAttendees] = useState<SpeakerSession | null>(null);

  // --- ATTENDANCE SCANNER ---
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  // Date/Time Picker State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    console.log("👉 [Scanner] RAW Scan Data:", data);
    try {
      let qrInfo: any;
      if (typeof data === 'string') {
        qrInfo = JSON.parse(data);
      } else {
        qrInfo = data;
      }

      if (!qrInfo || !qrInfo.registrationId) {
        console.log("⚠️ [Scanner] Parsed data missing registrationId:", qrInfo);
        throw new Error(`Missing registrationId in QR (Data: ${typeof data})`);
      }

      const res = await axios.post('/speakers/mark-attendance', {
        registrationId: qrInfo.registrationId
      });

      if (res.data.success) {
        Alert.alert("Attendance", res.data.message || "Attendance recorded.");
        onRefresh(); // Refresh main lists
        // If we're viewing attendees for this specific event, refresh that list too
        if (currentEventForAttendees) {
          fetchRegistrations(currentEventForAttendees.eventId as any);
        }
      } else {
        Alert.alert("Error", res.data.message);
      }
    } catch (error: any) {
      console.log("❌ [Scanner] Scan error:", error);
      Alert.alert("Scan Failed", error.message || "This QR code is not recognized.");
    } finally {
      setScanned(false);
      setScannerVisible(false);
    }
  };





  const fetchRegistrations = async (eventId: number) => {
    setLoadingAttendees(true);
    setAttendeeModalVisible(true);
    try {
      const res = await axios.get(`/speakers/registrations/${eventId}`);
      if (res.data.success) {
        setAttendees(res.data.registrations);
      }
    } catch (error: any) {
      console.log("Error fetching attendees:", error.response?.data || error.message);
      Alert.alert("Error", "Could not fetch attendee list.");
    } finally {
      setLoadingAttendees(false);
    }
  };

  const exportToExcel = async (eventName: string) => {
    if (attendees.length === 0) {
      Alert.alert("Empty List", "No attendees to export.");
      return;
    }

    setExporting(true);
    try {
      // Prepare data for Excel
      const excelData = attendees.map((reg, index) => {
        const u = reg.userId as User;
        return {
          'S.No': index + 1,
          'Name': u.name || 'N/A',
          'Email': u.email || 'N/A',
          'Mobile': u.mobileNumber || 'N/A',
          'College': u.college || 'N/A',
          'Year': u.year || 'N/A',
          'Department/Branch': u.department || 'N/A',
          'Payment Status': reg.isPaid ? 'PAID' : 'PENDING',
          'Present': reg.isPresent ? 'YES' : 'NO'
        };
      });

      // Create Worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Attendees");

      // Set column widths
      ws['!cols'] = [
        { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }
      ];

      // Write to base64
      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + `${eventName.replace(/ /g, '_')}_Attendees.xlsx`;

      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Attendee List',
        UTI: 'com.microsoft.excel.xlsx'
      });

    } catch (error: any) {
      console.error("Export error:", error);
      Alert.alert("Export Error", "Failed to generate Excel sheet.");
    } finally {
      setExporting(false);
    }
  };

  // Add / Edit Speaker State
  const [isEditingSpeaker, setIsEditingSpeaker] = useState(false);
  const [speakerId, setSpeakerId] = useState<string | null>(null);
  const [targetEventId, setTargetEventId] = useState<number | null>(null);
  const [speakerName, setSpeakerName] = useState('');
  const [speakerDesignation, setSpeakerDesignation] = useState('');
  const [speakerImage, setSpeakerImage] = useState<string | null>(null);
  const [addingSpeaker, setAddingSpeaker] = useState(false);
  const [removingSpeaker, setRemovingSpeaker] = useState(false);
  const [localSpeakers, setLocalSpeakers] = useState<any[]>([]);
  const [isLocalSpeaker, setIsLocalSpeaker] = useState(false);

  // --- FETCH DATA ---
  const fetchData = async (pageNum: number, isNew: boolean = false) => {
    if (pageNum === 1) setLoading(isNew);
    else setLoadingMore(true);

    try {
      // Parallel fetch for efficiency
      const sessionsPromise = axios.get("/speakers/all", { params: { page: pageNum, limit: 10 } });
      const registrationsPromise = axios.get("/speakers/my-sessions");

      const [sessionsRes, registrationsRes] = await Promise.all([sessionsPromise, registrationsPromise]);

      if (sessionsRes.data.success) {
        setSessions(isNew ? sessionsRes.data.sessions : [...sessions, ...sessionsRes.data.sessions]);
        setHasMore(sessionsRes.data.hasMore);
      }

      if (registrationsRes.data.success) {
        setMyRegistrations(registrationsRes.data.registrations || registrationsRes.data.sessions || []);
      }
    } catch (error: any) {
      console.log("Error fetching Speaker data:", error.response?.data || error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(1, true);
  }, []);

  // --- USERSEARCH FOR ADMIN ADDING ---
  useEffect(() => {
    if (!adminEmailInput.trim() || !sessionModalVisible) {
      setUserSuggestions([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await axios.post('/user/search', { name: adminEmailInput });
        if (res.data.success) {
          setUserSuggestions(res.data.users || []);
        }
      } catch (e) {
        console.log("Search error:", e);
      } finally {
        setSearchingUsers(false);
      }
    }, 1000); // 1s delay

    return () => clearTimeout(timeout);
  }, [adminEmailInput, sessionModalVisible]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    fetchData(1, true);
  };

  const loadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage);
    }
  };

  const handleRegister = async (session: SpeakerSession) => {
    const isAdmin = user?._id === session.admin_email || !!(session.secondaryAdmins?.some((a: any) => a === user?._id || a?._id === user?._id));
    if (isAdmin) {
        Alert.alert("Admin Access", "You are an organizer for this event. You have full access without registration.");
        return;
    }
    try {
      const res = await axios.post(`/speakers/register`, { eventId: session.eventId });
      if (res.data.success) {
          const { registration, order, fee } = res.data;
          
          if (fee > 0 && order) {
              Alert.alert(
                  "Payment Required",
                  `This session costs ₹${fee}. Complete the payment via Razorpay to confirm your seat.`,
                  [
                      { 
                          text: "Later", 
                          style: "cancel",
                          onPress: async () => {
                              try {
                                  // Wait, we need to delete the registration here so they can re-register later!
                                  await axios.delete(`/speakers/register/${registration._id}`);
                                  fetchData(1, true); // Refresh to clear local state
                              } catch(e) { console.log("Failed to delete un-paid reg", e) }
                          }
                      },
                      { 
                          text: "Pay Now", 
                          onPress: () => {
                              navigate('RazorpayWebView', {
                                  order: order,
                                  user: user,
                                  keyId: RAZORPAY_KEY_ID || 'rzp_test_RipeosWeZjGxlD',
                                  merchantName: 'Fync speaker events'
                              });
                          }
                      }
                  ]
              );
          } else {
              Alert.alert("Registration Successful", "You have registered successfully! Your pass is now in 'My Tickets' (top-right icon).");
          }
          fetchData(1, true);
      }
    } catch (error: any) {
        Alert.alert("Registration", error.response?.data?.message || "Something went wrong");
    }
  };

  const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setter(result.assets[0].uri);
  };

  const handleSpeakerAction = async () => {
    if (!speakerName || !speakerDesignation || !speakerImage) {
        Alert.alert("Information Required", "Please fill in all details and upload an image.");
        return;
    }

    if (isLocalSpeaker) {
        // Add to local list for new session creation
        const newSpeaker = {
            id: Date.now().toString(), // temp ID
            name: speakerName,
            designation: speakerDesignation,
            image: speakerImage
        };
        setLocalSpeakers([...localSpeakers, newSpeaker]);
        setSpeakerModalVisible(false);
        return;
    }

    if (!isEditingSpeaker && !targetEventId) {
        Alert.alert("Error", "Target session not found.");
        return;
    }

    setAddingSpeaker(true);
    try {
        const formData = new FormData();
        if (isEditingSpeaker) formData.append('speakerId', speakerId!);
        else formData.append('eventId', targetEventId!.toString());
        
        formData.append('name', speakerName);
        formData.append('designation', speakerDesignation);
        
        if (speakerImage.startsWith('file://')) {
            const filename = speakerImage.split('/').pop();
            const match = /\.(\w+)$/.exec(filename || '');
            const type = match ? `image/${match[1]}` : `image`;
            formData.append('image', { uri: speakerImage, name: filename, type } as any);
        }

        const url = isEditingSpeaker ? '/speakers/update-speaker' : '/speakers/add-speaker';
        const method = isEditingSpeaker ? 'put' : 'post';
        
        const res = await (axios as any)[method](url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
            Alert.alert("Success", isEditingSpeaker ? "Speaker updated successfully!" : "Speaker added successfully!");
            setSpeakerModalVisible(false);
            fetchData(1, true);
        }
    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Process failed");
    } finally {
        setAddingSpeaker(false);
    }
  };

  const handleRemoveSpeaker = async () => {
      if (!speakerId) return;
      Alert.alert(
          "Remove Speaker",
          "Are you sure you want to remove this speaker from the session?",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Remove", 
                  style: "destructive", 
                   onPress: async () => {
                       setRemovingSpeaker(true);
                       try {
                           const res = await axios.post('/speakers/delete-speaker', { speakerId });
                           if (res.data.success) {
                               Alert.alert("Success", "Speaker removed successfully.");
                               setSpeakerModalVisible(false);
                               fetchData(1, true);
                           }
                       } catch (e: any) {
                           Alert.alert("Error", e.response?.data?.message || "Deletion failed");
                       } finally {
                           setRemovingSpeaker(false);
                       }
                   }
              }
          ]
      );
  };

  const handleSessionAction = async () => {
    if (!editSessionData.eventName || !editSessionData.college || !editSessionData.venue || !editSessionData.date) {
        Alert.alert("Information Required", "Please fill in the core event details (Name, College, Venue, Date).");
        return;
    }

    if (feeType === 'paid' && (!editSessionData.fee || editSessionData.fee <= 0)) {
        Alert.alert("Information Required", "Please enter a valid fee amount for paid events.");
        return;
    }

    if (feeType === 'paid' && !editSessionData.admin_upi_id) {
        Alert.alert("Information Required", "Recipient UPI ID is mandatory for paid events.");
        return;
    }

    if (limitType === 'custom' && (!editSessionData.userLimit || editSessionData.userLimit <= 0)) {
        Alert.alert("Information Required", "Please enter a valid limit size.");
        return;
    }

    setSavingSession(true);
    try {
        const formData = new FormData();
        const payload = {
            ...editSessionData,
            fee: feeType === 'free' ? 0 : editSessionData.fee,
            userLimit: limitType === 'unlimited' ? 1000000 : editSessionData.userLimit
        };

        Object.keys(payload).forEach(key => {
            if ((payload as any)[key] !== undefined) {
                if (key === 'contactDetails' || key === 'secondaryAdmins') {
                    formData.append(key, JSON.stringify((payload as any)[key]));
                } else {
                    formData.append(key, (payload as any)[key]);
                }
            }
        });
        
        if (eventLogo?.startsWith('file://')) {
            const name = eventLogo.split('/').pop();
            formData.append('logo', { uri: eventLogo, name, type: 'image/jpeg' } as any);
        }
        if (eventBanner?.startsWith('file://')) {
            const name = eventBanner.split('/').pop();
            formData.append('banner', { uri: eventBanner, name, type: 'image/jpeg' } as any);
        }

        const url = isEditingSession ? '/speakers/update' : '/speakers/create';
        const method = isEditingSession ? 'put' : 'post';
        
        if (!isEditingSession) {
            formData.append('admin_email', user?._id);
        }

        const res = await (axios as any)[method](url, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
            const createdSession = res.data.speakerSession;
            
            // If it's a new session, upload local speakers
            if (!isEditingSession && localSpeakers.length > 0) {
                for (const speaker of localSpeakers) {
                    try {
                        const sData = new FormData();
                        sData.append('eventId', createdSession.eventId.toString());
                        sData.append('name', speaker.name);
                        sData.append('designation', speaker.designation);
                        if (speaker.image.startsWith('file://')) {
                            const filename = speaker.image.split('/').pop();
                            const match = /\.(\w+)$/.exec(filename || '');
                            const type = match ? `image/${match[1]}` : `image`;
                            sData.append('image', { uri: speaker.image, name: filename, type } as any);
                        }
                        await axios.post('/speakers/add-speaker', sData, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    } catch (e) {
                        console.log("Failed to upload local speaker:", speaker.name);
                    }
                }
            }

            Alert.alert("Success", isEditingSession ? "Session updated successfully!" : "Session created successfully with speakers!");
            setSessionModalVisible(false);
            fetchData(1, true);
        }
    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Update failed");
    } finally {
        setSavingSession(false);
    }
  };

  const handlePurgeSession = async () => {
      if (!editSessionData.eventId) return;
      Alert.alert(
          "Delete Session",
          "This will delete the session, all speakers, and registration records. This action cannot be undone. Do you want to continue?",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive", 
                  onPress: async () => {
                      setDeletingSession(true);
                      try {
                          const res = await axios.post('/speakers/delete-session', { eventId: editSessionData.eventId });
                          if (res.data.success) {
                              Alert.alert("Success", "Speaker session has been deleted.");
                              setSessionModalVisible(false);
                              fetchData(1, true);
                          }
                      } catch (e: any) {
                          Alert.alert("Error", e.response?.data?.message || "Deletion failed");
                      } finally {
                          setDeletingSession(false);
                      }
                  }
              }
          ]
      );
  };

  const handleAddAdmin = async () => {
    if (!adminEmailInput.trim()) return;
    if (!editSessionData._id) {
        Alert.alert("Note", "Please save the session settings first before adding collaborators.");
        return;
    }
    setAddingAdmin(true);
    try {
        const res = await axios.post('/speakers/admin/add', {
            eventId: editSessionData._id,
            type: 'SpeakerSession',
            username: adminEmailInput
        });
        if (res.data.success) {
            setEditSessionData({ ...editSessionData, secondaryAdmins: res.data.secondaryAdmins });
            setAdminEmailInput('');
            Alert.alert("Success", "Collaborator added successfully!");
        }
    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Failed to add collaborator");
    } finally {
        setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (id: string) => {
    try {
        const res = await axios.post('/speakers/admin/remove', {
            eventId: editSessionData._id,
            type: 'SpeakerSession',
            adminValue: id
        });
        if (res.data.success) {
            setEditSessionData({ ...editSessionData, secondaryAdmins: res.data.secondaryAdmins });
        }
    } catch (error: any) {
        Alert.alert("Error", "Failed to remove collaborator");
    }
  };

  const openSessionModal = (session?: SpeakerSession) => {
    if (session) {
        setIsEditingSession(true);
        setEditSessionData(session);
        setEventLogo(session.logo || null);
        setEventBanner(session.banner || null);
        setFeeType(session.fee && session.fee > 0 ? 'paid' : 'free');
        setLimitType(session.userLimit && session.userLimit >= 1000000 ? 'unlimited' : 'custom');
    } else {
        setIsEditingSession(false);
        setEditSessionData({ 
            eventName: '', description: '', college: user?.college || '', venue: '', date: new Date().toISOString(), 
            startTime: '10:00 AM', endTime: '12:00 PM', userLimit: undefined, fee: undefined, admin_upi_id: '',
            status: 'open'
        });
        setEventLogo(null);
        setEventBanner(null);
        setLocalSpeakers([]);
        setFeeType('free');
        setLimitType('unlimited');
    }
    setSessionModalVisible(true);
  };

  const openSpeakerModal = (speaker?: Speaker | any, targetId?: number, isLocal = false) => {
    setIsLocalSpeaker(isLocal);
    if (speaker) {
        setIsEditingSpeaker(!isLocal); // If local, it's just adding/editing in local state
        setSpeakerId(isLocal ? null : speaker._id);
        setSpeakerName(speaker.name);
        setSpeakerDesignation(speaker.designation);
        setSpeakerImage(speaker.image);
    } else {
        setIsEditingSpeaker(false);
        setTargetEventId(targetId || null);
        setSpeakerName('');
        setSpeakerDesignation('');
        setSpeakerImage(null);
    }
    setSpeakerModalVisible(true);
  };

  const filteredColleges = collegesInIndia.filter(c => 
    c.toLowerCase().includes(collegeSearch.toLowerCase())
  );

  const renderHeader = () => (
    <View className="px-8 pt-6 pb-2">
      <View className="flex-row justify-between items-center mb-4">
        <TouchableOpacity 
            onPress={() => goBack()}
            className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-lg border border-gray-100"
        >
            <Ionicons name="chevron-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-zinc-900 text-xl font-black italic uppercase tracking-tighter">Speaker Hub</Text>
        <View className="flex-row gap-2">
            <TouchableOpacity 
                onPress={() => setTicketsModalVisible(true)}
                className="w-10 h-10 bg-white rounded-xl items-center justify-center shadow-lg border border-gray-100"
            >
                <Ionicons name="ticket" size={20} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity 
                onPress={() => openSessionModal()}
                className="w-10 h-10 bg-zinc-900 rounded-xl items-center justify-center shadow-lg"
            >
                <Ionicons name="add" size={24} color="white" />
            </TouchableOpacity>
        </View>
      </View>
    </View>
  );


  return (
    <View className="flex-1 bg-[#FDFDFF]">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1" edges={['top']}>
        {renderHeader()}

        <FlatList
          data={sessions}
          keyExtractor={(item: any) => item._id}
          renderItem={({ item }) => {
            const myReg = myRegistrations.find(reg => (reg.eventId as any)?._id === item._id);
            const isRegistered = !!(myReg && myReg.isPaid);
            
            return <SessionCard 
                item={item} 
                onRegister={isRegistered ? () => {} : handleRegister} 
                isAdmin={user?._id === item.admin_email || !!(item.secondaryAdmins?.some((a: any) => a === user?._id || a?._id === user?._id))}
                isPrimaryAdmin={user?._id === item.admin_email}
                onAddSpeaker={(id) => openSpeakerModal(undefined, id)}
                onEditSession={openSessionModal}
                onEditSpeaker={openSpeakerModal}
                isRegistered={isRegistered}
                onViewAttendees={(id) => {
                  setCurrentEventForAttendees(item);
                  fetchRegistrations(id);
                }}
                onOpenScanner={async () => {
                  const { status } = await requestPermission();
                  if (status === 'granted') {
                    setCurrentEventForAttendees(item); // So scanner knows what to refresh
                    setScanned(false);
                    setScannerVisible(true);
                  } else {
                    Alert.alert("Required", "Camera access is needed to scan tickets.");
                  }
                }}
              />
          }}
          contentContainerStyle={{ paddingBottom: 100 }}
          onEndReached={loadMore}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ec4899" />}
          ListEmptyComponent={!loading ? <View className="items-center mt-20"><Ionicons name="cube-outline" size={60} color="#E5E7EB" /><Text className="mt-4 font-black italic text-gray-400">No events found</Text></View> : <ActivityIndicator size="large" color="#ec4899" className="mt-20" />}
        />
      </SafeAreaView>

      {/* Entry Pass Modal (Existing) */}
      <Modal visible={qrModalVisible} transparent onRequestClose={() => setQrModalVisible(false)}>
        <View className="flex-1 bg-black/80 justify-center items-center px-8">
            <View className="bg-white w-full rounded-[40px] overflow-hidden">
                <LinearGradient colors={['#4f46e5', '#3730a3']} className="p-8 items-center flex-row justify-between">
                    <View className="w-8" />
                    <Text className="text-white text-xl font-black italic text-center tracking-tighter">{(selectedReg?.eventId as any)?.eventName}</Text>
                    <TouchableOpacity onPress={() => setQrModalVisible(false)} className="w-8 h-8 items-center justify-center">
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                </LinearGradient>
                <View className="p-8 items-center bg-gray-50/50">
                    <View className="flex-row items-center gap-4">
                        <View className="p-3 bg-white border-2 border-indigo-100 rounded-3xl shadow-sm">
                            {selectedReg?.qrCode && <Image source={{ uri: selectedReg.qrCode }} style={{ width: 140, height: 140 }} resizeMode="contain" />}
                        </View>
                        <View className="p-3 bg-white border-2 border-pink-100 rounded-3xl shadow-sm">
                            <Image 
                                source={{ uri: (selectedReg?.userId as any)?.avatar || user?.avatar }} 
                                style={{ width: 140, height: 140 }} 
                                className="rounded-2xl"
                                resizeMode="cover"
                            />
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setQrModalVisible(false)} className="mt-8 bg-zinc-900 w-full py-5 rounded-[22px] items-center shadow-lg">
                        <Text className="text-white font-black italic text-xs uppercase tracking-widest">Close Ticket</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* Speaker Modal (Enlist / Update) */}
      <Modal visible={speakerModalVisible} transparent animationType="slide" onRequestClose={() => setSpeakerModalVisible(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <View className="bg-white rounded-t-[40px] p-8">
                <View className="flex-row justify-between items-center mb-8">
                    <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter uppercase">{isEditingSpeaker ? 'Edit Speaker' : 'Add New Speaker'}</Text>
                    <View className="flex-row items-center gap-3">
                        {isEditingSpeaker && (
                            <TouchableOpacity onPress={handleRemoveSpeaker} disabled={removingSpeaker} className="w-12 h-12 bg-red-50 rounded-2xl items-center justify-center border border-red-100">
                                {removingSpeaker ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="trash-outline" size={20} color="#ef4444" />}
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => setSpeakerModalVisible(false)} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                             <Ionicons name="close" size={24} color="black" />
                        </TouchableOpacity>
                    </View>
                </View>

                <TouchableOpacity onPress={() => pickImage(setSpeakerImage)} className="w-24 h-24 bg-gray-50 rounded-3xl self-center mb-8 items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                    {speakerImage ? <Image source={{ uri: speakerImage }} className="w-full h-full" /> : <Ionicons name="camera" size={32} color="#CBD5E1" />}
                </TouchableOpacity>
                <TextInput placeholder="Name" placeholderTextColor="#94a3b8" value={speakerName} onChangeText={setSpeakerName} className="bg-gray-50 rounded-2xl px-6 py-4 mb-4 font-bold border border-gray-100" />
                <TextInput placeholder="Designation" placeholderTextColor="#94a3b8" value={speakerDesignation} onChangeText={setSpeakerDesignation} className="bg-gray-50 rounded-2xl px-6 py-4 mb-8 font-bold border border-gray-100" />
                <TouchableOpacity onPress={handleSpeakerAction} disabled={addingSpeaker} className="bg-pink-500 py-5 rounded-2xl items-center">
                    {addingSpeaker ? <ActivityIndicator color="white" /> : <Text className="text-white font-black italic uppercase">Save Speaker</Text>}
                </TouchableOpacity>
                <View className="h-10" />
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* College Selection Modal */}
      <Modal visible={collegeModalVisible} transparent animationType="fade" onRequestClose={() => setCollegeModalVisible(false)}>
          <View className="flex-1 bg-black/50 items-center justify-center px-10">
              <View className="bg-white w-full max-h-[70%] rounded-[40px] overflow-hidden">
                  <View className="p-6 bg-zinc-900">
                      <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-lg font-black italic tracking-tighter uppercase">Select College</Text>
                        <TouchableOpacity onPress={() => setCollegeModalVisible(false)} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center">
                            <Ionicons name="close" size={20} color="white" />
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row items-center bg-white/10 rounded-2xl px-4 border border-white/10">
                          <Ionicons name="search" size={16} color="#94a3b8" />
                          <TextInput 
                            placeholder="Search colleges..." 
                            placeholderTextColor="#64748b"
                            value={collegeSearch}
                            onChangeText={setCollegeSearch}
                            className="flex-1 h-12 text-white font-bold ml-3"
                          />
                      </View>
                  </View>
                  <FlatList 
                    data={filteredColleges}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => {
                                setEditSessionData({ ...editSessionData, college: item });
                                setCollegeModalVisible(false);
                                setCollegeSearch('');
                            }}
                            className="p-5 border-b border-gray-50 flex-row items-center"
                        >
                            <Ionicons name="business-outline" size={16} color="#ec4899" />
                            <Text className="text-zinc-900 font-bold ml-3 text-xs">{item}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<View className="p-10 items-center"><Text className="text-gray-400 font-bold">No college found</Text></View>}
                  />
                  <TouchableOpacity onPress={() => setCollegeModalVisible(false)} className="p-6 items-center">
                      <Text className="text-pink-600 font-black italic text-xs uppercase tracking-widest">Cancel</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {sessionModalVisible && (
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/60 justify-end z-[1000]">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="h-[85%]">
            <View className="bg-white rounded-t-[50px] p-8 h-full">
                <ScrollView showsVerticalScrollIndicator={false}>
                    <View className="flex-row justify-between items-center mb-6">
                        <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter uppercase">{isEditingSession ? 'Update Session' : 'Create New Session'}</Text>
                        <View className="flex-row items-center gap-3">
                            {isEditingSession && (
                                <TouchableOpacity onPress={handlePurgeSession} disabled={deletingSession} className="w-14 h-14 bg-red-50 rounded-3xl items-center justify-center border border-red-100">
                                    {deletingSession ? <ActivityIndicator size="small" color="#ef4444" /> : <Ionicons name="trash-outline" size={24} color="#ef4444" />}
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={() => setSessionModalVisible(false)} className="w-14 h-14 bg-gray-50 rounded-3xl items-center justify-center border border-gray-100">
                                <Ionicons name="close" size={28} color="black" />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-3">Event Branding</Text>
                    <View className="flex-row gap-4 mb-8">
                        <TouchableOpacity onPress={pickImage.bind(null, setEventBanner)} className="flex-1 h-32 bg-gray-50 rounded-3xl items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                            {eventBanner ? <Image source={{ uri: eventBanner }} className="w-full h-full" /> : <Text className="text-[10px] font-black text-gray-400 uppercase">Banner</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={pickImage.bind(null, setEventLogo)} className="w-32 h-32 bg-gray-50 rounded-3xl items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                            {eventLogo ? <Image source={{ uri: eventLogo }} className="w-full h-full" /> : <Text className="text-[10px] font-black text-gray-400 uppercase">Logo</Text>}
                        </TouchableOpacity>
                    </View>

                    <TextInput 
                        placeholder="Event Name" 
                        placeholderTextColor="#94a3b8"
                        value={editSessionData.eventName} 
                        onChangeText={(t) => setEditSessionData({...editSessionData, eventName: t})} 
                        className="bg-gray-50 rounded-2xl px-6 py-4 mb-4 font-bold border border-gray-100" 
                    />
                    
                    <TouchableOpacity 
                        onPress={() => setCollegeModalVisible(true)}
                        className="bg-zinc-50 rounded-2xl px-6 py-4 mb-4 flex-row justify-between items-center border border-gray-100"
                    >
                        <Text className={editSessionData.college ? 'text-zinc-900 font-bold text-xs' : 'text-zinc-400 font-bold text-xs'}>
                            {editSessionData.college || 'Hosted at (College Name)'}
                        </Text>
                        <Ionicons name="chevron-down" size={16} color="#94a3b8" />
                    </TouchableOpacity>

                    <TextInput 
                        placeholder="Description" 
                        placeholderTextColor="#94a3b8"
                        multiline value={editSessionData.description} 
                        onChangeText={(t) => setEditSessionData({...editSessionData, description: t})} 
                        className="bg-gray-50 rounded-2xl px-6 py-4 mb-4 font-bold border border-gray-100 h-24" 
                    />

                    {/* Local Speakers Management Section */}
                    {!isEditingSession && (
                        <View className="mb-6">
                            <View className="flex-row justify-between items-center mb-3">
                                <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest">Added Speakers ({localSpeakers.length})</Text>
                                <TouchableOpacity 
                                    onPress={() => openSpeakerModal(undefined, undefined, true)}
                                    className="bg-white px-3 py-1.5 rounded-xl border border-pink-100"
                                >
                                    <Text className="text-pink-600 text-[8px] font-black italic uppercase">+ Add Speaker</Text>
                                </TouchableOpacity>
                            </View>
                            
                            {localSpeakers.length > 0 ? (
                                <View className="flex-row flex-wrap gap-4">
                                    {localSpeakers.map((s, i) => (
                                        <View 
                                            key={s.id} 
                                            className="bg-zinc-50 p-2 rounded-2xl border border-gray-100 items-center w-24 relative"
                                        >
                                            <Image source={{ uri: s.image }} className="w-12 h-12 rounded-xl mb-2" />
                                            <Text className="text-[8px] font-bold text-zinc-900" numberOfLines={1}>{s.name}</Text>
                                            <TouchableOpacity 
                                                onPress={() => setLocalSpeakers(localSpeakers.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1 -right-1 bg-white rounded-full shadow-sm p-0.5"
                                            >
                                                <Ionicons name="close-circle" size={16} color="#ef4444" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                </View>
                            ) : (
                                <View className="bg-gray-50/50 p-6 rounded-3xl items-center border border-dashed border-gray-200">
                                    <Text className="text-gray-400 text-[10px] font-bold italic">No speakers added yet</Text>
                                </View>
                            )}
                        </View>
                    )}
                    
                    <TextInput 
                        placeholder="Venue" 
                        placeholderTextColor="#94a3b8"
                        value={editSessionData.venue} 
                        onChangeText={(t) => setEditSessionData({...editSessionData, venue: t})} 
                        className="bg-gray-50 rounded-2xl px-6 py-4 mb-4 font-bold border border-gray-100" 
                    />

                    <View className="flex-row gap-4 mb-4">
                        <TouchableOpacity 
                            onPress={() => setShowStartTimePicker(true)}
                            className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100 justify-center"
                        >
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-1">Start Time</Text>
                            <Text className="text-zinc-900 font-bold text-xs">{editSessionData.startTime || '--:--'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            onPress={() => setShowEndTimePicker(true)}
                            className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100 justify-center"
                        >
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-1">End Time</Text>
                            <Text className="text-zinc-900 font-bold text-xs">{editSessionData.endTime || '--:--'}</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row gap-4 mb-4">
                        <TouchableOpacity 
                            onPress={() => setShowDatePicker(true)}
                            className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100 justify-center"
                        >
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-1">Event Date</Text>
                            <Text className="text-zinc-900 font-bold text-xs">
                                {editSessionData.date ? new Date(editSessionData.date).toLocaleDateString() : 'Select Date'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {showDatePicker && (
                        <DateTimePicker
                            value={editSessionData.date ? new Date(editSessionData.date) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => {
                                setShowDatePicker(false);
                                if (date) setEditSessionData({ ...editSessionData, date: date.toISOString() });
                            }}
                        />
                    )}

                    {showStartTimePicker && (
                        <DateTimePicker
                            value={new Date()} // Current date with time irrelevant, will extract time
                            mode="time"
                            is24Hour={false}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => {
                                setShowStartTimePicker(false);
                                if (date) setEditSessionData({ ...editSessionData, startTime: formatTime(date) });
                            }}
                        />
                    )}

                    {showEndTimePicker && (
                        <DateTimePicker
                            value={new Date()}
                            mode="time"
                            is24Hour={false}
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => {
                                setShowEndTimePicker(false);
                                if (date) setEditSessionData({ ...editSessionData, endTime: formatTime(date) });
                            }}
                        />
                    )}
                    <View className="mb-4">
                        <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-2 px-1">Participation Limit</Text>
                        <TouchableOpacity 
                            onPress={() => setLimitType(limitType === 'unlimited' ? 'custom' : 'unlimited')}
                            className="flex-row justify-between items-center bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100"
                        >
                            <Text className="text-zinc-900 font-black italic text-[10px] uppercase">
                                {limitType === 'unlimited' ? 'Unlimited Access' : 'Custom Capacity'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#6366f1" />
                        </TouchableOpacity>
                    </View>
                    {limitType === 'custom' && (
                        <TextInput 
                            placeholder="Limit Size (Number)" 
                            keyboardType="numeric" 
                            placeholderTextColor="#94a3b8"
                            value={editSessionData.userLimit && editSessionData.userLimit < 1000000 ? editSessionData.userLimit.toString() : ''} 
                            onChangeText={(t) => setEditSessionData({...editSessionData, userLimit: t === '' ? 1000000 : parseInt(t)})} 
                            className="bg-gray-50 rounded-2xl px-6 py-4 mb-4 font-bold border border-gray-100" 
                        />
                    )}

                    <View className="mb-4">
                        <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-2 px-1">Payment Details</Text>
                        <TouchableOpacity 
                            onPress={() => {
                                const newType = feeType === 'free' ? 'paid' : 'free';
                                setFeeType(newType);
                                if (newType === 'free') setEditSessionData({...editSessionData, fee: 0});
                            }}
                            className="flex-row justify-between items-center bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100"
                        >
                            <Text className="text-zinc-900 font-black italic text-[10px] uppercase">
                                {feeType === 'free' ? 'Free Event' : 'Paid Access'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#6366f1" />
                        </TouchableOpacity>
                    </View>

                    {feeType === 'paid' && (
                        <View className="flex-row gap-4 mb-4">
                            <TextInput 
                                placeholder="Fee (₹)" 
                                keyboardType="numeric" 
                                placeholderTextColor="#94a3b8"
                                value={editSessionData.fee ? editSessionData.fee.toString() : ''} 
                                onChangeText={(t) => setEditSessionData({...editSessionData, fee: t === '' ? 0 : parseInt(t)})} 
                                className="w-32 bg-gray-50 rounded-2xl px-6 py-4 font-bold border border-gray-100 text-center" 
                            />
                            <TextInput 
                                placeholder="UPI ID *" 
                                placeholderTextColor="#94a3b8"
                                value={editSessionData.admin_upi_id} 
                                onChangeText={(t) => setEditSessionData({...editSessionData, admin_upi_id: t})} 
                                className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 font-bold border border-pink-100 text-xs" 
                            />
                        </View>
                    )}

                    <View className="mb-4">
                        <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-2 px-1">Session Lifecycle</Text>
                        <TouchableOpacity 
                            onPress={() => setEditSessionData({...editSessionData, status: (editSessionData.status || 'open') === 'open' ? 'closed' : 'open'})}
                            className="flex-row justify-between items-center bg-gray-50 rounded-2xl px-6 py-4 border border-gray-100"
                        >
                            <Text className="text-zinc-900 font-black italic text-[10px] uppercase">
                                {(editSessionData.status || 'open') === 'open' ? 'Open Registration' : 'Close Registration'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#6366f1" />
                        </TouchableOpacity>
                    </View>

                    {isEditingSession && (
                        <View className="mb-8">
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-4 px-1">Collaborators (Secondary Admins)</Text>
                            <View className="flex-row items-center gap-2 mb-4">
                                <View className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 flex-row items-center border border-gray-100">
                                    <Ionicons name="mail" size={16} color="#94a3b8" />
                                    <TextInput 
                                        placeholder="Add by username..." 
                                        placeholderTextColor="#94a3b8"
                                        value={adminEmailInput}
                                        onChangeText={setAdminEmailInput}
                                        className="flex-1 ml-3 font-bold text-zinc-900 text-[10px]"
                                        autoCapitalize="none"
                                    />
                                    {searchingUsers && <ActivityIndicator size="small" color="#db2777" className="mr-2" />}
                                </View>
                                <TouchableOpacity 
                                    onPress={handleAddAdmin}
                                    disabled={addingAdmin}
                                    className="w-14 h-14 bg-pink-600 rounded-2xl items-center justify-center shadow-lg"
                                >
                                    {addingAdmin ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="person-add" size={24} color="white" />}
                                </TouchableOpacity>
                            </View>

                            {/* Suggestions List */}
                            {userSuggestions.length > 0 && (
                                <View className="bg-white border border-pink-100 rounded-2xl mb-4 p-2 shadow-sm">
                                    {userSuggestions.map(u => (
                                        <TouchableOpacity 
                                            key={u._id} 
                                            onPress={() => {
                                                setAdminEmailInput(u.username);
                                                setUserSuggestions([]);
                                            }}
                                            className="flex-row items-center p-3 border-b border-gray-50 last:border-0"
                                        >
                                            <Image source={{ uri: u.avatar || 'https://via.placeholder.com/150' }} className="w-8 h-8 rounded-full bg-gray-100" />
                                            <View className="ml-3">
                                                <Text className="text-zinc-900 font-black italic uppercase text-[10px]">{u.name}</Text>
                                                <Text className="text-pink-500 font-bold text-[8px]">@{u.username}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                            
                            <View className="flex-row flex-wrap gap-2">
                                {editSessionData.secondaryAdmins?.map((admin: any) => {
                                    const adminId = typeof admin === 'string' ? admin : admin._id;
                                    const adminDisplay = typeof admin === 'string' ? admin : admin.username || admin.name;
                                    return (
                                        <View key={adminId} className="bg-gray-50 flex-row items-center py-2 px-4 rounded-xl border border-gray-100">
                                            <Text className="text-zinc-600 font-bold text-[8px] mr-2">{adminDisplay}</Text>
                                            {(editSessionData.admin_email as any === user?._id) && (
                                                <TouchableOpacity onPress={() => handleRemoveAdmin(adminId)}>
                                                    <Ionicons name="close-circle" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    <View className="mb-4">
                        <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-2 px-1">Community Features</Text>
                        <TouchableOpacity 
                            onPress={() => setEditSessionData({...editSessionData, isCommunityActive: !editSessionData.isCommunityActive})}
                            className={`flex-row items-center gap-4 p-5 rounded-2xl border ${editSessionData.isCommunityActive !== false ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}
                        >
                            <View className={`w-10 h-10 rounded-xl items-center justify-center ${editSessionData.isCommunityActive !== false ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                <Ionicons name="chatbubbles" size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className={`font-black uppercase text-[10px] ${editSessionData.isCommunityActive !== false ? 'text-indigo-600' : 'text-zinc-600'}`}>
                                    {editSessionData.isCommunityActive !== false ? "Community Hub Enabled" : "Community Hub Disabled"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View className="mb-4">
                        <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-2 px-1">Privacy & Reach</Text>
                        <TouchableOpacity 
                            onPress={() => setEditSessionData({...editSessionData, isCollegeSpecific: !editSessionData.isCollegeSpecific})}
                            className={`flex-row items-center gap-4 p-5 rounded-2xl border ${editSessionData.isCollegeSpecific ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}
                        >
                            <View className={`w-10 h-10 rounded-xl items-center justify-center ${editSessionData.isCollegeSpecific ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                                <Ionicons name={editSessionData.isCollegeSpecific ? "shield-checkmark" : "globe-outline"} size={20} color="white" />
                            </View>
                            <View className="flex-1">
                                <Text className={`font-black uppercase text-[10px] ${editSessionData.isCollegeSpecific ? 'text-indigo-600' : 'text-zinc-600'}`}>
                                    {editSessionData.isCollegeSpecific ? "College Specific (Locked)" : "Global Session"}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4 px-1">
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest">Connect Personnel (Optional)</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    const contacts = [...(editSessionData.contactDetails || []), { name: '', mobile: '', email: '' }];
                                    setEditSessionData({...editSessionData, contactDetails: contacts});
                                }}
                                className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                            >
                                <Text className="text-indigo-600 font-black text-[8px] uppercase">+ Add More</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {(editSessionData.contactDetails || []).map((contact, idx) => (
                            <View key={idx} className="bg-zinc-50 p-6 rounded-3xl mb-4 border border-zinc-100 relative">
                                <TouchableOpacity 
                                    onPress={() => {
                                        const contacts = (editSessionData.contactDetails || []).filter((_, i) => i !== idx);
                                        setEditSessionData({...editSessionData, contactDetails: contacts});
                                    }}
                                    className="absolute top-4 right-4 z-10"
                                >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>

                                <TextInput 
                                    placeholder="Organizer Name"
                                    placeholderTextColor="#94a3b8"
                                    value={contact.name}
                                    onChangeText={(t) => {
                                        const contacts = [...(editSessionData.contactDetails || [])];
                                        contacts[idx].name = t;
                                        setEditSessionData({...editSessionData, contactDetails: contacts});
                                    }}
                                    className="bg-white p-4 rounded-xl mb-3 font-bold text-zinc-900 text-[10px] border border-gray-100"
                                />
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <TextInput 
                                            placeholder="Mobile Number"
                                            placeholderTextColor="#94a3b8"
                                            value={contact.mobile}
                                            onChangeText={(t) => {
                                                const contacts = [...(editSessionData.contactDetails || [])];
                                                contacts[idx].mobile = t;
                                                setEditSessionData({...editSessionData, contactDetails: contacts});
                                            }}
                                            keyboardType="phone-pad"
                                            className="bg-white p-4 rounded-xl font-bold text-zinc-900 text-[10px] border border-gray-100"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <TextInput 
                                            placeholder="Email Address"
                                            placeholderTextColor="#94a3b8"
                                            value={contact.email}
                                            onChangeText={(t) => {
                                                const contacts = [...(editSessionData.contactDetails || [])];
                                                contacts[idx].email = t;
                                                setEditSessionData({...editSessionData, contactDetails: contacts});
                                            }}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            className="bg-white p-4 rounded-xl font-bold text-zinc-900 text-[10px] border border-gray-100"
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}
                        
                        {(editSessionData.contactDetails || []).length === 0 && (
                            <View className="items-center py-6 bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                                <Ionicons name="call-outline" size={24} color="#94a3b8" />
                                <Text className="text-gray-400 font-bold text-[8px] uppercase mt-2">No contact persons added</Text>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={handleSessionAction} disabled={savingSession} className="bg-zinc-900 py-5 rounded-[22px] items-center mb-10 shadow-lg shadow-black/20">
                        {savingSession ? <ActivityIndicator color="white" /> : <Text className="text-white font-black italic uppercase">Save Settings</Text>}
                    </TouchableOpacity>
                </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
      {/* Attendee List Modal */}
      <Modal visible={attendeeModalVisible} transparent animationType="slide" onRequestClose={() => setAttendeeModalVisible(false)}>
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white h-[90%] rounded-t-[50px] overflow-hidden">
                  <View className="p-8 bg-zinc-900 flex-row justify-between items-center shadow-lg">
                      <View className="flex-1 mr-4">
                          <Text className="text-white text-2xl font-black italic tracking-tighter uppercase mb-1" numberOfLines={1}>{currentEventForAttendees?.eventName || 'Attendees'}</Text>
                          <Text className="text-white/50 text-[10px] uppercase tracking-widest font-bold">{attendees.length} Registered Users</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <TouchableOpacity 
                            onPress={() => exportToExcel(currentEventForAttendees?.eventName || 'Event')}
                            disabled={exporting || loadingAttendees}
                            className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center"
                        >
                            {exporting ? <ActivityIndicator size="small" color="#ec4899" /> : <MaterialIcons name="file-download" size={24} color="white" />}
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setAttendeeModalVisible(false)}
                            className="w-12 h-12 bg-white rounded-2xl items-center justify-center"
                        >
                            <Ionicons name="close" size={24} color="#ec4899" />
                        </TouchableOpacity>
                      </View>
                  </View>

                  <View className="bg-amber-50 px-8 py-3 border-b border-amber-100 flex-row items-center gap-3">
                      <Ionicons name="information-circle" size={18} color="#d97706" />
                      <Text className="text-amber-800 text-[9px] font-bold uppercase tracking-tight flex-1">
                          Download the list now. All attendee details and chats will be permanently deleted 7 days after event completion.
                      </Text>
                  </View>

                  {loadingAttendees ? (
                      <View className="flex-1 items-center justify-center">
                          <ActivityIndicator size="large" color="#ec4899" />
                          <Text className="mt-4 text-gray-400 font-bold italic">Loading list...</Text>
                      </View>
                  ) : (
                      <FlatList 
                          data={attendees}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item, index }) => {
                              const u = item.userId as User;
                              return (
                                  <View className="p-6 border-b border-gray-50 bg-white">
                                      <View className="flex-row justify-between items-start mb-3">
                                          <View className="flex-1">
                                              <View className="flex-row items-center gap-2 mb-1">
                                                  <Text className="text-zinc-900 font-black text-lg">{u.name}</Text>
                                                  {item.isPaid && (
                                                      <View className="bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                                                          <Text className="text-green-600 text-[8px] font-black uppercase">Paid</Text>
                                                      </View>
                                                  )}
                                                                                                              {item.isPresent && (
                                                            <View className="bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 flex-row items-center gap-1">
                                                          <Ionicons name="checkmark" size={10} color="#6366f1" />
                                                          <Text className="text-indigo-600 text-[8px] font-black uppercase">Present</Text>
                                                      </View>
                                                  )}
                                              </View>
                                              <Text className="text-gray-400 text-xs font-bold">{u.email}</Text>
                                          </View>
                                          <Text className="text-gray-300 font-black italic text-xs">#{index + 1}</Text>
                                      </View>
                                      
                                       <View className="flex-row items-center justify-between mt-4 border-t border-gray-50 pt-4">
                                           <View className="flex-row flex-wrap gap-2 flex-1 mr-4">
                                               {u.college && <View className="bg-zinc-50 px-3 py-1.5 rounded-xl border border-gray-100"><Text className="text-zinc-600 text-[10px] font-bold">{u.college}</Text></View>}
                                               {u.mobileNumber && <View className="bg-zinc-50 px-3 py-1.5 rounded-xl border border-gray-100"><Text className="text-zinc-600 text-[10px] font-bold">{u.mobileNumber}</Text></View>}
                                               {u.department && <View className="bg-pink-50 px-3 py-1.5 rounded-xl border border-pink-100"><Text className="text-pink-600 text-[10px] font-bold">{u.department}</Text></View>}
                                           </View>
                                                                                       {item.isPresent && (
                                                <View className="bg-indigo-600 px-8 py-3 rounded-2xl shadow-sm">
                                                    <Text className="text-[10px] font-black uppercase text-white">Present</Text>
                                                </View>
                                            )}
                                           

                                       </View>
                                  </View>
                              );
                          }}
                          ListEmptyComponent={
                              <View className="flex-1 items-center mt-20 p-10">
                                  <Ionicons name="people-outline" size={80} color="#f1f5f9" />
                                  <Text className="mt-6 text-slate-400 font-black italic text-center">No one has registered for this event yet.</Text>
                              </View>
                          }
                          contentContainerStyle={{ paddingBottom: 50 }}
                      />
                  )}

                  <TouchableOpacity 
                    onPress={() => setAttendeeModalVisible(false)} 
                    className="p-8 items-center bg-gray-50 border-t border-gray-100"
                  >
                      <Text className="text-zinc-400 font-black italic text-[10px] uppercase tracking-[3px]">Close Dashboard</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal visible={scannerVisible} transparent animationType="fade" onRequestClose={() => setScannerVisible(false)}>
          <View className="flex-1 bg-black">
              <CameraView
                  style={{ flex: 1 }}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              >
                  <View className="flex-1 justify-between items-center py-20 px-10">
                      <View className="w-full h-12 flex-row justify-end absolute top-10 right-10">
                          <TouchableOpacity onPress={() => setScannerVisible(false)} className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center border border-white/20">
                              <Ionicons name="close" size={24} color="white" />
                          </TouchableOpacity>
                      </View>
                      <View className="items-center">
                          <Text className="text-white text-2xl font-black italic tracking-tighter uppercase mb-2">Ticket Scanner</Text>
                          <Text className="text-white/60 text-xs font-bold uppercase tracking-widest">Aim at Attendee's QR Code</Text>
                      </View>

                      <View className="w-72 h-72 border-2 border-white/30 rounded-3xl items-center justify-center">
                          <View className="w-64 h-64 border-2 border-indigo-500 rounded-2xl" />
                      </View>

                      <TouchableOpacity 
                          onPress={() => setScannerVisible(false)}
                          className="bg-white/10 px-10 py-4 rounded-3xl border border-white/20"
                      >
                          <Text className="text-white text-xs font-black uppercase tracking-widest">Cancel Scan</Text>
                      </TouchableOpacity>
                  </View>
              </CameraView>
          </View>
      </Modal>

      {/* My Tickets Dashboard Modal */}
      <Modal visible={ticketsModalVisible} transparent animationType="slide" onRequestClose={() => setTicketsModalVisible(false)}>
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white h-[90%] rounded-t-[50px] overflow-hidden">
                  <View className="p-10 pt-12 flex-1">
                      <View className="flex-row justify-between items-center mb-8">
                          <View>
                            <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">My Tickets</Text>
                            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{myRegistrations.length} Active Passes</Text>
                          </View>
                          <TouchableOpacity onPress={() => setTicketsModalVisible(false)} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                             <Ionicons name="close" size={24} color="black" />
                          </TouchableOpacity>
                      </View>

                      <FlatList 
                          data={myRegistrations}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item }) => (
                            <JoinedSessionCard 
                                item={item} 
                                onShowQR={(reg) => { setSelectedReg(reg); setQrModalVisible(true); }} 
                                onRefresh={onRefresh}
                            />
                          )}
                          ListEmptyComponent={
                              <View className="items-center mt-20">
                                  <View className="w-24 h-24 bg-slate-50 rounded-full items-center justify-center mb-6">
                                      <Ionicons name="ticket-outline" size={40} color="#CBD5E1" />
                                  </View>
                                  <Text className="text-slate-400 font-black italic text-center uppercase tracking-widest text-[10px]">No active tickets found</Text>
                              </View>
                          }
                          contentContainerStyle={{ paddingBottom: 50 }}
                      />
                  </View>
              </View>
          </View>
      </Modal>
    </View>
  );
}
