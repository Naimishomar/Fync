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
  Linking,
  Pressable
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
  avatar?: string;
  username: string; // Added to match backend
  department?: string;
  year?: string;
}

interface Speaker {
  _id: string;
  name: string;
  designation: string;
  image: string;
}

interface BootcampSession {
  _id: string;
  eventId: string;
  eventName: string;
  description: string;
  college: string;
  venue: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  admin_email: string;
  admin_upi_id?: string;
  instructors?: Speaker[];
  fee?: number;
  userLimit?: number;
  logo?: string;
  banner?: string;
  status: 'open' | 'closed';
  isCollegeSpecific?: boolean;
  secondaryAdmins?: (User | string)[];
  isCommunityActive?: boolean;
  registrationsCount?: number;
  contactDetails?: ContactDetail[];
}

interface ContactDetail {
  name: string;
  mobile: string;
  email: string;
}

interface BootcampRegistration {
  _id: string;
  eventId: BootcampSession | string;
  userId: User | string;
  isPaid: boolean;
  attendance: { date: string; isPresent: boolean }[];
  qrCode: string;
  createdAt: string;
  status?: 'pending' | 'approved';
}

// --- HELPER ---
const formatDate = (date: Date) => date.toISOString().split('T')[0];

const pickImage = async (setter: (uri: string) => void) => {
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
    });
    if (!result.canceled) setter(result.assets[0].uri);
};

// --- 1. BOOTCAMP CARD ---
const JoinedBootcampCard = memo(({ item, onShowQR, onRefresh }: { item: BootcampRegistration; onShowQR: (reg: BootcampRegistration) => void; onRefresh: () => void }) => {
  const session = item.eventId as any;
  if (!session) return null;

  return (
    <View className="bg-white rounded-3xl mb-6 mx-5 overflow-hidden shadow-xl shadow-black/5 border border-indigo-50 border-l-4 border-l-indigo-500">
      <View className="p-5">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1 mr-3">
            <Text className="text-indigo-500 text-[10px] font-black uppercase tracking-widest mb-0.5">
                {(item as any).isAdmin ? 'Organizer Pass' : 'Bootcamp Access'}
            </Text>
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
          </View>
        </View>

        <View className="flex-row items-center mb-4 bg-gray-50/50 self-start px-3 py-1.5 rounded-xl">
            <Ionicons name="time-outline" size={12} color="#6366f1" />
            <Text className="text-zinc-500 text-[10px] font-bold ml-1.5 uppercase">
                {session.startTime} - {session.endTime}
            </Text>
        </View>

        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => onShowQR(item)}
          className="flex-row items-center justify-center py-3 rounded-2xl border bg-indigo-50 border-indigo-100"
        >
          <Ionicons name="qr-code" size={16} color="#4f46e5" />
          <Text className="text-indigo-600 font-bold text-xs ml-2 uppercase tracking-widest">
            View QR Ticket
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const BootcampCard = memo(({ item, onRegister, isAdmin, isPrimaryAdmin, onViewAttendees, onOpenScanner, onEditSession, isRegistered }: { 
  item: BootcampSession; 
  onRegister: (item: BootcampSession) => void;
  isAdmin: boolean;
  isPrimaryAdmin: boolean;
  onViewAttendees: (eventId: string) => void;
  onOpenScanner: (eventId: string) => void;
  onEditSession: (session: BootcampSession) => void;
  isRegistered?: boolean;
}) => {
  const isLimitReached = !isAdmin && !isRegistered && (item.userLimit ?? 0) > 0 && (item.userLimit ?? 0) < 1000000 && (item.registrationsCount ?? 0) >= (item.userLimit ?? 0);

  return (
    <View className="bg-white rounded-[40px] mb-8 mx-5 overflow-hidden shadow-2xl shadow-black/10 border border-gray-100">
      <View className="h-44 relative">
        {item.banner ? (
          <Image source={{ uri: item.banner }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#6366f1', '#4338ca']} className="w-full h-full" />
        )}
        
        <View className="absolute top-5 left-5 bg-white/90 px-4 py-2 rounded-2xl backdrop-blur-md">
            <Text className="text-zinc-900 text-[10px] font-black uppercase tracking-widest">{item.college}</Text>
        </View>

        {isAdmin && (
            <View className="absolute top-5 right-5 flex-row gap-2">
                <TouchableOpacity onPress={() => onOpenScanner(item.eventId)} className="w-10 h-10 bg-indigo-500 rounded-xl items-center justify-center shadow-sm">
                    <Ionicons name="scan" size={20} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onViewAttendees(item.eventId)} className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center backdrop-blur-md shadow-sm">
                    <Ionicons name="people" size={20} color="#6366f1" />
                </TouchableOpacity>
                {isPrimaryAdmin && (
                    <TouchableOpacity onPress={() => onEditSession(item)} className="w-10 h-10 bg-white/90 rounded-xl items-center justify-center backdrop-blur-md shadow-sm">
                        <Ionicons name="settings-outline" size={20} color="black" />
                    </TouchableOpacity>
                )}
            </View>
        )}
        
        <View className="absolute -bottom-6 left-8 w-20 h-20 bg-white rounded-3xl p-1.5 shadow-lg">
            {item.logo ? (
                <Image source={{ uri: item.logo }} className="w-full h-full rounded-[22px]" />
            ) : (
                <View className="w-full h-full bg-indigo-100 rounded-[22px] items-center justify-center">
                    <Ionicons name="rocket" size={24} color="#6366f1" />
                </View>
            )}
        </View>
      </View>

      <View className="mt-10 p-6">
        <Text className="text-zinc-900 text-2xl font-black italic tracking-tighter mb-2" numberOfLines={2}>{item.eventName}</Text>
        
        <Text className="text-zinc-500 text-[10px] font-bold mb-6 leading-4" numberOfLines={2}>
            {item.description}
        </Text>

        {item.contactDetails && item.contactDetails.length > 0 && (
            <View className="mb-6 bg-zinc-50/50 p-4 rounded-3xl border border-zinc-100">
                <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest mb-3 px-1">Connect with Mentors</Text>
                {item.contactDetails.map((contact, idx) => (
                    <View key={idx} className="flex-row items-center justify-between mb-4 last:mb-3">
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
                                        <Ionicons name="mail" size={10} color="#6366f1" />
                                        <Text className="text-indigo-900 font-bold text-[8px] ml-1 uppercase">{contact.email}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        )}
        
        <View className="flex-row items-center mb-6">
            <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-xl mr-3">
                <Ionicons name="calendar" size={12} color="#6366f1" />
                <Text className="text-zinc-500 text-[10px] font-bold ml-1.5 uppercase">{new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}</Text>
            </View>
            <View className="flex-row items-center bg-gray-50 px-3 py-1.5 rounded-xl">
                <Ionicons name="time" size={12} color="#6366f1" />
                <Text className="text-zinc-500 text-[10px] font-bold ml-1.5 uppercase">{item.startTime} - {item.endTime}</Text>
            </View>
        </View>

        {item.isCollegeSpecific && (
          <View className="flex-row items-center bg-amber-50 px-3 py-1.5 rounded-xl self-start mb-4 border border-amber-100">
              <Ionicons name="lock-closed" size={12} color="#d97706" />
              <Text className="text-amber-700 text-[8px] font-black uppercase tracking-tighter ml-1.5">Internal College Only</Text>
          </View>
        )}

        {(isRegistered || isAdmin) && item.isCommunityActive !== false && (
            <TouchableOpacity 
                onPress={() => navigate('EventCommunityChat', { eventId: item._id, eventName: item.eventName, type: 'Bootcamp' })}
                className="mt-4 bg-indigo-50 p-5 rounded-[25px] flex-row items-center justify-between border border-indigo-100"
            >
                <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 bg-indigo-600 rounded-2xl items-center justify-center">
                        <Ionicons name="chatbubbles" size={18} color="white" />
                    </View>
                    <View>
                        <Text className="text-indigo-900 font-black italic uppercase text-[10px]">Event Community</Text>
                        <Text className="text-indigo-400 font-bold text-[8px] uppercase tracking-widest mt-0.5">Ask questions & network</Text>
                    </View>
                </View>
                <Ionicons name="arrow-forward" size={16} color="#4f46e5" />
            </TouchableOpacity>
        )}

        <View className="flex-row justify-between items-center bg-zinc-900 p-5 rounded-[30px] mt-4">
          <View>
            <Text className="text-white/40 font-bold uppercase text-[7px] tracking-[2px]">Bootcamp Fee</Text>
            <Text className="text-white text-xl font-black italic">{item.fee && item.fee > 0 ? `₹${item.fee}` : 'FREE'}</Text>
          </View>

          <TouchableOpacity 
            activeOpacity={0.8}
            onPress={() => !isRegistered && item.status === 'open' && !isLimitReached && onRegister(item)}
            className={`${(isRegistered || item.status === 'closed' || isLimitReached) ? 'bg-zinc-800' : 'bg-white'} px-8 py-4 rounded-2xl`}
            disabled={isRegistered || item.status === 'closed' || isLimitReached}
          >
            <Text className={`${(isRegistered || item.status === 'closed' || isLimitReached) ? 'text-zinc-500' : 'text-zinc-900'} font-black italic text-[10px] uppercase tracking-widest`}>
              {item.status === 'closed' ? 'Closed' : isRegistered ? 'Joined' : isLimitReached ? 'FULL' : 'Enroll'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function BootcampScreen() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<BootcampSession[]>([]);
  const [userRegistrations, setUserRegistrations] = useState<BootcampRegistration[]>([]);
  const [adminSuggestions, setAdminSuggestions] = useState<User[]>([]);
  const [isSearchingAdmins, setIsSearchingAdmins] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [collegeModalVisible, setCollegeModalVisible] = useState(false);
  const [collegeSearch, setCollegeSearch] = useState('');
  const [attendeeModalVisible, setAttendeeModalVisible] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [ticketsModalVisible, setTicketsModalVisible] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [selectedReg, setSelectedReg] = useState<BootcampRegistration | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(formatDate(new Date()));
  
  // Form State
  const [editData, setEditData] = useState<Partial<BootcampSession>>({});
  const [eventBanner, setEventBanner] = useState<string | null>(null);
  const [eventLogo, setEventLogo] = useState<string | null>(null);
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Date/Time Picker State
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  };
  
  // Attendees
  const [attendees, setAttendees] = useState<BootcampRegistration[]>([]);
  const [currentEventForAttendees, setCurrentEvent] = useState<string | null>(null);
  const [loadingAttendees, setLoadingAttendees] = useState(false);

  useEffect(() => {
    if (adminEmailInput.length < 2) {
        setAdminSuggestions([]);
        return;
    }

    const timer = setTimeout(async () => {
        setIsSearchingAdmins(true);
        try {
            const res = await axios.post('/user/search', { name: adminEmailInput });
            if (res.data.success) {
                // Filter out already added admins
                const existingAdmins = (editData.secondaryAdmins || []).map(a => typeof a === 'string' ? a : a.username);
                const filtered = res.data.users.filter((u: User) => !existingAdmins.includes(u.username) && u.email !== user?.email);
                setAdminSuggestions(filtered);
            }
        } catch (err) {
            console.error("Suggest admin error:", err);
        } finally {
            setIsSearchingAdmins(false);
        }
    }, 1000);

    return () => clearTimeout(timer);
  }, [adminEmailInput]);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const [res, regRes] = await Promise.all([
        axios.get('/bootcamp/all'),
        axios.get('/bootcamp/my-registrations')
      ]);
      setSessions(res.data.sessions || []);
      setUserRegistrations(regRes.data.registrations || []);
      setLoading(false);
      setRefreshing(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRegister = async (session: BootcampSession) => {
    const isAdmin = session.admin_email.toLowerCase() === user?.email?.toLowerCase() || 
                    (session.secondaryAdmins || []).some(a => (typeof a === 'string' ? a === user?.id || a === user?.email : a._id === user?._id || a.email === user?.email));
    if (isAdmin) {
        Alert.alert("Admin Access", "You are an organizer for this Bootcamp. You have full access without enrollment.");
        return;
    }
    try {
      const res = await axios.post('/bootcamp/register', { eventId: session.eventId });
      if (res.data.success) {
          const { registration, order } = res.data;
          const fee = session.fee || 0;

          if (fee > 0 && order) {
              Alert.alert(
                  "Enrollment Fee",
                  `This Bootcamp requires a one-time enrollment fee of ₹${fee}. Confirm payment to secure your seat.`,
                  [
                      { 
                          text: "Cancel", 
                          style: "cancel",
                          onPress: async () => {
                             try {
                                 // Clean up unpaid registration
                                 await axios.delete(`/bootcamp/registrations/cancel/${registration._id}`);
                             } catch(e) {}
                          }
                      },
                      { 
                          text: "Pay Now", 
                          onPress: () => {
                              navigate('RazorpayWebView', {
                                  order: order,
                                  user: user,
                                  keyId: RAZORPAY_KEY_ID || 'rzp_test_RipeosWeZjGxlD',
                                  merchantName: 'Fync Bootcamp Hub'
                              });
                          }
                      }
                  ]
              );
          } else {
              Alert.alert("Success", "Enrolled successfully! You can view your pass in 'My Tickets' (top right).");
          }
          fetchSessions();
      }
    } catch (err: any) {
        Alert.alert("Enrollment", err.response?.data?.message || "Error");
    }
  };

  const exportToExcel = async (eventName: string) => {
    if (attendees.length === 0) {
      Alert.alert("Empty List", "No attendees to export.");
      return;
    }

    setExporting(true);
    try {
      const excelData = attendees.map((reg, index) => {
        const u = reg.userId as User;
        const dayRecord = reg.attendance.find(a => a.date === attendanceDate);
        const isPresent = dayRecord?.isPresent;
        
        return {
          'S.No': index + 1,
          'Name': u.name || 'N/A',
          'Email': u.email || 'N/A',
          'Mobile': u.mobileNumber || 'N/A',
          'College': u.college || 'N/A',
          'Branch/Dept': u.department || 'N/A',
          'Present': isPresent ? 'YES' : 'NO'
        };
      });

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Participants");

      ws['!cols'] = [{ wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 10 }];

      const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const uri = FileSystem.cacheDirectory + `${eventName.replace(/ /g, '_')}_Participants.xlsx`;

      await FileSystem.writeAsStringAsync(uri, wbout, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: 'Export Participant List'
      });
    } catch (error: any) {
      Alert.alert("Export Error", "Failed to generate Excel sheet.");
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      Object.keys(editData).forEach(key => {
          if (editData[key as keyof BootcampSession] !== undefined) {
              if (key === 'contactDetails' || key === 'secondaryAdmins' || key === 'instructors') {
                  formData.append(key, JSON.stringify(editData[key as keyof BootcampSession]));
              } else if (key === '_id') {
                  // Skip _id for body, we use eventId for identification
              } else {
                  formData.append(key, String(editData[key as keyof BootcampSession]));
              }
          }
      });

      if (eventLogo?.startsWith('file://')) formData.append('logo', { uri: eventLogo, name: 'logo.jpg', type: 'image/jpeg' } as any);
      if (eventBanner?.startsWith('file://')) formData.append('banner', { uri: eventBanner, name: 'banner.jpg', type: 'image/jpeg' } as any);
      
      const isEditing = !!editData._id;
      const url = isEditing ? '/bootcamp/update' : '/bootcamp/create';
      const method = isEditing ? 'put' : 'post';

      await (axios as any)[method](url, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSessionModalVisible(false);
      fetchSessions();
      Alert.alert("Success", isEditing ? "Bootcamp updated!" : "Bootcamp created!");
    } catch (err) {
        Alert.alert("Error", "Could not save bootcamp");
    } finally {
        setSaving(false);
    }
  };

  const handleDeleteBootcamp = async () => {
    if (!editData.eventId) return;
    
    Alert.alert(
        "Delete Bootcamp",
        "Are you sure you want to permanently delete this Bootcamp? This will remove all registrations, tickets, and community messages. This action cannot be undone.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete Permanently", 
                style: "destructive",
                onPress: async () => {
                    try {
                        const res = await axios.delete('/bootcamp/delete', { data: { eventId: editData.eventId } });
                        if (res.data.success) {
                            setSessionModalVisible(false);
                            fetchSessions();
                            Alert.alert("Success", "Bootcamp deleted successfully");
                        }
                    } catch (err: any) {
                        Alert.alert("Error", err.response?.data?.message || "Could not delete bootcamp");
                    }
                }
            }
        ]
    );
  };

  const handleAddAdmin = async () => {
    if (!adminEmailInput.trim()) return;
    if (!editData._id) {
        Alert.alert("Note", "Please initialise the bootcamp hub first before adding collaborators.");
        return;
    }
    setAddingAdmin(true);
    try {
        const res = await axios.post('/bootcamp/admin/add', {
            eventId: editData._id,
            type: 'Bootcamp',
            username: adminEmailInput // Sending username instead of email
        });
        if (res.data.success) {
            setEditData({ ...editData, secondaryAdmins: res.data.secondaryAdmins });
            setAdminEmailInput('');
            Alert.alert("Success", "Collaborator added successfully!");
        }
    } catch (error: any) {
        Alert.alert("Error", error.response?.data?.message || "Failed to add collaborator");
    } finally {
        setAddingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    try {
        const res = await axios.post('/bootcamp/admin/remove', {
            eventId: editData._id,
            type: 'Bootcamp',
            adminValue: email
        });
        if (res.data.success) {
            setEditData({ ...editData, secondaryAdmins: res.data.secondaryAdmins });
        }
    } catch (error: any) {
        Alert.alert("Error", "Failed to remove collaborator");
    }
  };

  const viewAttendees = async (eventId: string) => {
    setCurrentEvent(eventId);
    setAttendeeModalVisible(true);
    setLoadingAttendees(true);

    // Set default attendance date based on session range
    const session = sessions.find(s => s.eventId === eventId);
    if (session) {
        const today = new Date().toISOString().split('T')[0];
        const isTodayInRange = today >= session.startDate && today <= session.endDate;
        setAttendanceDate(isTodayInRange ? today : session.startDate);
    }

    try {
      const res = await axios.get(`/bootcamp/registrations/${eventId}`);
      setAttendees(res.data.registrations || []);
    } catch (err) {
      Alert.alert("Error", "Could not fetch attendees");
    } finally {
      setLoadingAttendees(false);
    }
  };

  const approvePayment = async (regId: string) => {
    try {
        const res = await axios.post('/bootcamp/registrations/approve', { registrationId: regId });
        Alert.alert("Approved", res.data.message);
        if (currentEventForAttendees) viewAttendees(currentEventForAttendees);
    } catch (err: any) {
        Alert.alert("Error", err.response?.data?.message || "Failed to approve");
    }
  };

  const markAttendance = async (registrationId: string) => {
    try {
        const res = await axios.post('/bootcamp/attendance', { registrationId, date: attendanceDate });
        Alert.alert("Success", res.data.message || "Attendance marked.");
        if (currentEventForAttendees) {
            viewAttendees(currentEventForAttendees);
        }
    } catch (err: any) {
        Alert.alert("Attendance", err.response?.data?.message || "Error");
    } finally {
        setScanned(false);
    }
  };
 
  const getDatesInRange = (start: string, end: string) => {
    const dates = [];
    let current = new Date(start);
    const last = new Date(end);
    while (current <= last) {
        dates.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const [permission, requestPermission] = useCameraPermissions();
  const handleBarCodeScanned = ({ data }: any) => {
    if (scanned) return;
    setScanned(true);
    setScannerVisible(false);
    console.log("👉 [Bootcamp Scanner] RAW Scan Data:", data);
    try {
        let qrInfo: any;
        if (typeof data === 'string') {
            qrInfo = JSON.parse(data);
        } else {
            qrInfo = data;
        }

        if (qrInfo && qrInfo.registrationId) {
            markAttendance(qrInfo.registrationId);
        } else {
            throw new Error(`Invalid format - regId missing (Data type: ${typeof data})`);
        }
    } catch (e: any) {
        setScanned(false);
        console.log("❌ [Bootcamp Scanner] Detail Error:", e);
        Alert.alert("Invalid QR", e.message || "Could not parse ticket data.");
    }
  };

  const filteredColleges = useMemo(() => 
    collegesInIndia.filter(c => c.toLowerCase().includes(collegeSearch.toLowerCase())),
    [collegeSearch]
  );

  if (loading) return <View className="flex-1 bg-white items-center justify-center"><ActivityIndicator color="#6366f1" size="large" /></View>;

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <StatusBar barStyle="dark-content" />
      
      <View className="px-8 py-6 flex-row justify-between items-center">
          <View>
              <Text className="text-zinc-400 font-bold text-[10px] uppercase tracking-[3px] mb-1">Learning Hub</Text>
              <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">Bootcamps</Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity 
                onPress={() => setTicketsModalVisible(true)}
                className="w-14 h-14 bg-white rounded-[22px] items-center justify-center shadow-lg border border-gray-100"
            >
                <Ionicons name="ticket" size={24} color="#6366f1" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { 
                setEditData({ admin_email: user?.email }); 
                setEventLogo(null);
                setEventBanner(null);
                setSessionModalVisible(true); 
            }} className="w-14 h-14 bg-zinc-900 rounded-[22px] items-center justify-center shadow-lg">
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>
          </View>
      </View>

      <FlatList 
        data={sessions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <BootcampCard 
            item={item} 
            isAdmin={item.admin_email.toLowerCase() === user?.email?.toLowerCase() || 
                     (item.secondaryAdmins || []).some(a => (typeof a === 'string' ? a === user?.id || a === user?.email : a._id === user?._id || a.email === user?.email))}
            isPrimaryAdmin={item.admin_email.toLowerCase() === user?.email?.toLowerCase()}
            isRegistered={userRegistrations.some(r => (r.eventId as any)?._id === item._id)}
            onRegister={handleRegister}
            onViewAttendees={viewAttendees}
            onOpenScanner={async (id) => { 
                const { status } = await requestPermission();
                if (status === 'granted') {
                    setCurrentEvent(id);
                    setScanned(false);
                    setScannerVisible(true);
                } else {
                    Alert.alert("Required", "Camera access is needed to scan tickets.");
                }
            }}
            onEditSession={(s) => { 
                setEditData(s); 
                setEventLogo(s.logo || null);
                setEventBanner(s.banner || null);
                setSessionModalVisible(true); 
            }}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchSessions} />}
        ListEmptyComponent={<View className="py-20 items-center"><Text className="text-gray-400 font-bold italic">No bootcamps available</Text></View>}
      />

      {/* MODALS (Simplified for now, can expand UI same as Speaker) */}
      <Modal visible={attendeeModalVisible} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white h-[90%] rounded-t-[50px] overflow-hidden">
                   <View className="p-8 bg-zinc-900 h-48">
                       <View className="flex-row justify-between items-center mb-6">
                            <View>
                                <Text className="text-white text-2xl font-black italic tracking-tighter uppercase">Participants</Text>
                                <Text className="text-white/50 font-bold text-[10px] uppercase tracking-widest mt-1">Multi-Day Attendance Tracker</Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                                <TouchableOpacity 
                                    onPress={async () => {
                                        const { status } = await requestPermission();
                                        if (status === 'granted') {
                                           setScanned(false);
                                           setScannerVisible(true);
                                        }
                                    }}
                                    className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center"
                                >
                                    <Ionicons name="scan" size={24} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={() => exportToExcel('Bootcamp_Attendees')}
                                    className="w-12 h-12 bg-white/10 rounded-2xl items-center justify-center"
                                >
                                    <MaterialIcons name="file-download" size={24} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setAttendeeModalVisible(false)} className="w-12 h-12 bg-white rounded-2xl items-center justify-center">
                                    <Ionicons name="close" size={24} color="#6366f1" />
                                </TouchableOpacity>
                            </View>
                       </View>

                       {/* Daily Attendance Date Selector */}
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                            {(() => {
                                const activeSession = sessions.find(s => s.eventId === currentEventForAttendees);
                                if (!activeSession) return null;
                                const dates = getDatesInRange(activeSession.startDate, activeSession.endDate);
                                return dates.map(date => {
                                    const isSelected = attendanceDate === date;
                                    const dateObj = new Date(date);
                                    return (
                                        <TouchableOpacity 
                                            key={date}
                                            onPress={() => setAttendanceDate(date)}
                                            className={`mr-3 px-6 h-12 rounded-2xl items-center justify-center border ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white/10 border-white/20'}`}
                                        >
                                            <Text className={`font-black italic text-[10px] uppercase tracking-widest ${isSelected ? 'text-white' : 'text-white/40'}`}>
                                                {dateObj.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                });
                            })()}
                       </ScrollView>
                   </View>
                  <View className="bg-amber-50 px-8 py-3 border-b border-amber-100 flex-row items-center gap-3">
                      <Ionicons name="information-circle" size={18} color="#d97706" />
                      <Text className="text-amber-800 text-[9px] font-bold uppercase tracking-tight flex-1">
                          Download the list now. All participant details and and community messages will be permanently deleted 7 days after event completion.
                      </Text>
                  </View>

                  <FlatList 
                    data={attendees}
                    keyExtractor={(it) => it._id}
                    renderItem={({ item, index }) => {
                        const u = item.userId as User;
                        const dayRecord = item.attendance.find(a => a.date === attendanceDate);
                        const isPresentToday = dayRecord?.isPresent;
                        
                        const activeSession = sessions.find(s => s.eventId === currentEventForAttendees);
                        const isPrimaryAdminForThis = activeSession?.admin_email.toLowerCase() === user?.email?.toLowerCase();

                        return (
                           <View className="p-6 border-b border-gray-50 bg-white">
                               <View className="flex-row justify-between items-start mb-4">
                                   <View className="flex-1">
                                       <View className="flex-row items-center gap-2 mb-2">
                                           <Text className="text-zinc-900 font-black text-lg italic tracking-tighter uppercase">{u.name}</Text>
                                           <View className={`px-3 py-1 rounded-full border ${isPresentToday ? 'bg-indigo-100 border-indigo-200' : 'bg-gray-100 border-gray-200'}`}>
                                               <Text className={`text-[8px] font-black uppercase ${isPresentToday ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                   {isPresentToday ? 'Present' : 'Absent'}
                                               </Text>
                                           </View>
                                       </View>
                                       <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{u.email}</Text>
                                   </View>
                                   <Text className="text-gray-300 font-black italic text-xs">#{index + 1}</Text>
                               </View>
                                                        <View className="flex-row items-center justify-between border-t border-gray-50 pt-4">
                                    <View className="flex-row flex-wrap gap-2 flex-1 mr-4">
                                        {u.college && <View className="bg-zinc-50 px-2 py-1 rounded-lg border border-gray-100"><Text className="text-zinc-600 text-[8px] font-bold">{u.college}</Text></View>}
                                        {u.department && <View className="bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100"><Text className="text-indigo-600 text-[8px] font-bold">{u.department}</Text></View>}
                                    </View>
                                    <View className="flex-row items-center space-x-2">
                                        {item.status === 'pending' && isPrimaryAdminForThis && (
                                            <TouchableOpacity 
                                                onPress={() => approvePayment(item._id)}
                                                className="px-4 py-3 bg-green-600 rounded-2xl shadow-sm"
                                            >
                                                <Text className="text-[10px] font-black uppercase text-white">Approve</Text>
                                            </TouchableOpacity>
                                        )}
                                        {isPresentToday && (
                                            <View className="bg-indigo-600 px-8 py-3 rounded-2xl shadow-sm">
                                                <Text className="text-[10px] font-black uppercase text-white">Present</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    }}
                  />
              </View>
          </View>
      </Modal>

      {/* Creation Modal and Scanner Modal (UI similar to Speaker) */}
      <Modal visible={scannerVisible} transparent animationType="fade" onRequestClose={() => setScannerVisible(false)}>
           <View style={{ flex: 1, backgroundColor: 'black' }}>
               <CameraView 
                   style={{ flex: 1 }}
                   onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                   barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
               />
               <View className="absolute inset-0 items-center justify-between py-20 px-10">
                   <View className="items-center">
                       <Text className="text-white text-2xl font-black italic tracking-tighter uppercase mb-2">QR Ticket Scanner</Text>
                       <Text className="text-white/60 text-[10px] font-bold uppercase tracking-[3px]">Bootcamp Entry & Attendance</Text>
                   </View>
                   
                   <View className="w-72 h-72 border-2 border-white/30 rounded-[40px] items-center justify-center">
                       {/* Scanner Frame */}
                       <View className="w-64 h-64 border-2 border-indigo-500 rounded-[30px] shadow-2xl shadow-indigo-500/50" />
                   </View>

                   <TouchableOpacity 
                       onPress={() => setScannerVisible(false)} 
                       className="bg-white/10 px-12 py-5 rounded-[22px] border border-white/20 shadow-lg"
                   >
                       <Text className="text-white font-black italic uppercase tracking-widest text-xs">Cancel Scan</Text>
                   </TouchableOpacity>
               </View>
           </View>
       </Modal>

      <Modal visible={sessionModalVisible} transparent animationType="slide">
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white h-[90%] rounded-t-[50px] overflow-hidden">
                  <View className="p-8 bg-zinc-900 flex-row justify-between items-center h-44">
                      <View>
                          <Text className="text-white text-2xl font-black italic tracking-tighter uppercase">Configure Bootcamp Hub</Text>
                          <Text className="text-white/50 font-bold text-[10px] uppercase tracking-widest mt-1">Design your training session</Text>
                      </View>
                      <TouchableOpacity onPress={() => setSessionModalVisible(false)} className="w-12 h-12 bg-white rounded-2xl items-center justify-center">
                          <Ionicons name="close" size={24} color="#6366f1" />
                      </TouchableOpacity>
                  </View>
                  <ScrollView className="p-8">
                      <Text className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mb-3">Event Branding (Optional)</Text>
                       <View className="flex-row gap-4 mb-8">
                          <TouchableOpacity onPress={() => pickImage(setEventBanner)} className="flex-1 h-32 bg-gray-50 rounded-3xl items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                              {eventBanner ? <Image source={{ uri: eventBanner }} className="w-full h-full" /> : <Text className="text-[10px] font-black text-gray-400 uppercase">Banner</Text>}
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => pickImage(setEventLogo)} className="w-32 h-32 bg-gray-50 rounded-3xl items-center justify-center border border-dashed border-gray-300 overflow-hidden">
                              {eventLogo ? <Image source={{ uri: eventLogo }} className="w-full h-full" /> : <Text className="text-[10px] font-black text-gray-400 uppercase">Logo</Text>}
                          </TouchableOpacity>
                      </View>
                      <Text className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mb-4">Event Details</Text>
                      
                      <TextInput 
                          placeholder="Bootcamp Title (e.g., MERN Masterclass)"
                          placeholderTextColor="#94a3b8"
                          value={editData.eventName}
                          onChangeText={(t) => setEditData({...editData, eventName: t})}
                          className="bg-gray-50 p-6 rounded-2xl mb-4 font-bold text-zinc-900 border border-gray-100"
                      />
                      
                      <TextInput 
                          placeholder="Describe the curriculum..."
                          placeholderTextColor="#94a3b8"
                          multiline
                          value={editData.description}
                          onChangeText={(t) => setEditData({...editData, description: t})}
                          className="bg-gray-50 p-6 rounded-2xl mb-4 font-medium text-zinc-600 border border-gray-100 h-32"
                      />

                      <View className="mb-8">
                        <View className="flex-row justify-between items-center mb-4 px-1">
                            <Text className="text-zinc-400 font-bold text-[8px] uppercase tracking-widest">Connect Mentors (Optional)</Text>
                            <TouchableOpacity 
                                onPress={() => {
                                    const contacts = [...(editData.contactDetails || []), { name: '', mobile: '', email: '' }];
                                    setEditData({...editData, contactDetails: contacts});
                                }}
                                className="bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100"
                            >
                                <Text className="text-indigo-600 font-black text-[8px] uppercase">+ Add More</Text>
                            </TouchableOpacity>
                        </View>
                        
                        {(editData.contactDetails || []).map((contact, idx) => (
                            <View key={idx} className="bg-white p-6 rounded-[30px] mb-4 border border-indigo-50 relative">
                                <TouchableOpacity 
                                    onPress={() => {
                                        const contacts = (editData.contactDetails || []).filter((_, i) => i !== idx);
                                        setEditData({...editData, contactDetails: contacts});
                                    }}
                                    className="absolute top-4 right-4 z-10"
                                >
                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                </TouchableOpacity>

                                <TextInput 
                                    placeholder="Mentor Name"
                                    placeholderTextColor="#94a3b8"
                                    value={contact.name}
                                    onChangeText={(t) => {
                                        const contacts = [...(editData.contactDetails || [])];
                                        contacts[idx].name = t;
                                        setEditData({...editData, contactDetails: contacts});
                                    }}
                                    className="bg-gray-50 p-4 rounded-xl mb-3 font-bold text-zinc-900 text-[10px] border border-gray-100"
                                />
                                <View className="flex-row gap-3">
                                    <View className="flex-1">
                                        <TextInput 
                                            placeholder="Mobile"
                                            placeholderTextColor="#94a3b8"
                                            value={contact.mobile}
                                            onChangeText={(t) => {
                                                const contacts = [...(editData.contactDetails || [])];
                                                contacts[idx].mobile = t;
                                                setEditData({...editData, contactDetails: contacts});
                                            }}
                                            keyboardType="phone-pad"
                                            className="bg-gray-50 p-4 rounded-xl font-bold text-zinc-900 text-[10px] border border-gray-100"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <TextInput 
                                            placeholder="Email"
                                            placeholderTextColor="#94a3b8"
                                            value={contact.email}
                                            onChangeText={(t) => {
                                                const contacts = [...(editData.contactDetails || [])];
                                                contacts[idx].email = t;
                                                setEditData({...editData, contactDetails: contacts});
                                            }}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            className="bg-gray-50 p-4 rounded-xl font-bold text-zinc-900 text-[10px] border border-gray-100"
                                        />
                                    </View>
                                </View>
                            </View>
                        ))}
                      </View>

                      <View className="flex-row gap-4 mb-4">
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Starts</Text>
                              <TouchableOpacity 
                                onPress={() => setShowStartDatePicker(true)}
                                className="bg-gray-50 p-5 rounded-2xl border border-gray-100"
                              >
                                  <Text className="text-zinc-900 font-bold">{editData.startDate || 'Select Date'}</Text>
                              </TouchableOpacity>
                          </View>
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Ends</Text>
                              <TouchableOpacity 
                                onPress={() => setShowEndDatePicker(true)}
                                className="bg-gray-50 p-5 rounded-2xl border border-gray-100"
                              >
                                  <Text className="text-zinc-900 font-bold">{editData.endDate || 'Select Date'}</Text>
                              </TouchableOpacity>
                          </View>
                      </View>

                      <View className="flex-row gap-4 mb-4">
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Time Start</Text>
                              <TouchableOpacity 
                                onPress={() => setShowStartTimePicker(true)}
                                className="bg-gray-50 p-5 rounded-2xl border border-gray-100"
                              >
                                  <Text className="text-zinc-900 font-bold">{editData.startTime || 'Select Time'}</Text>
                              </TouchableOpacity>
                          </View>
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Time End</Text>
                              <TouchableOpacity 
                                onPress={() => setShowEndTimePicker(true)}
                                className="bg-gray-50 p-5 rounded-2xl border border-gray-100"
                              >
                                  <Text className="text-zinc-900 font-bold">{editData.endTime || 'Select Time'}</Text>
                              </TouchableOpacity>
                          </View>
                      </View>

                      {showStartDatePicker && (
                          <DateTimePicker
                              value={editData.startDate ? new Date(editData.startDate) : new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, date) => {
                                  setShowStartDatePicker(false);
                                  if (date) setEditData({ ...editData, startDate: date.toISOString().split('T')[0] });
                              }}
                          />
                      )}

                      {showEndDatePicker && (
                          <DateTimePicker
                              value={editData.endDate ? new Date(editData.endDate) : new Date()}
                              mode="date"
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, date) => {
                                  setShowEndDatePicker(false);
                                  if (date) setEditData({ ...editData, endDate: date.toISOString().split('T')[0] });
                              }}
                          />
                      )}

                      {showStartTimePicker && (
                          <DateTimePicker
                              value={new Date()}
                              mode="time"
                              is24Hour={false}
                              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                              onChange={(event, date) => {
                                  setShowStartTimePicker(false);
                                  if (date) setEditData({ ...editData, startTime: formatTime(date) });
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
                                  if (date) setEditData({ ...editData, endTime: formatTime(date) });
                              }}
                          />
                      )}

                      <TouchableOpacity 
                          onPress={() => setCollegeModalVisible(true)}
                          className="bg-gray-50 p-6 rounded-2xl mb-4 flex-row justify-between items-center border border-gray-100"
                      >
                          <Text className={editData.college ? 'text-zinc-900 font-bold' : 'text-slate-400 font-bold'}>
                              {editData.college || 'College'}
                          </Text>
                          <Ionicons name="business" size={18} color="#94a3b8" />
                      </TouchableOpacity>

                      <TextInput 
                          placeholder="Venue / Campus Location (e.g. Auditorium)"
                          placeholderTextColor="#94a3b8"
                          value={editData.venue}
                          onChangeText={(t) => setEditData({...editData, venue: t})}
                          className="bg-gray-50 p-6 rounded-2xl mb-4 font-bold text-zinc-900 border border-gray-100"
                      />
                      <View className="flex-row gap-4 mb-8">
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Student Limit</Text>
                              <TextInput 
                                  placeholder="100"
                                  placeholderTextColor="#94a3b8"
                                  keyboardType="numeric"
                                  value={editData.userLimit?.toString()}
                                  onChangeText={(t) => setEditData({...editData, userLimit: parseInt(t) || 0})}
                                  className="bg-gray-50 p-4 rounded-xl font-bold text-zinc-900 border border-gray-100"
                              />
                          </View>
                          <View className="flex-1">
                              <Text className="text-zinc-400 font-bold text-[10px] uppercase mb-2">Fee (INR)</Text>
                              <TextInput 
                                  placeholder="0 (Free)"
                                  placeholderTextColor="#94a3b8"
                                  keyboardType="numeric"
                                  value={editData.fee?.toString()}
                                  onChangeText={(t) => setEditData({...editData, fee: parseInt(t) || 0})}
                                  className="bg-gray-50 p-4 rounded-xl font-bold text-zinc-900 border border-gray-100"
                              />
                          </View>
                      </View>

                      {editData._id && (
                        <View className="mb-8">
                          <Text className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest mb-4">Collaborators (Secondary Admins)</Text>
                          <View className="flex-row items-center gap-2 mb-4">
                              <View className="flex-1 bg-gray-50 rounded-2xl px-6 py-4 flex-row items-center border border-gray-100">
                                  <Ionicons name="at" size={16} color="#94a3b8" />
                                  <TextInput 
                                      placeholder="Admin Username" 
                                      placeholderTextColor="#94a3b8"
                                      value={adminEmailInput}
                                      onChangeText={setAdminEmailInput}
                                      className="flex-1 ml-3 font-bold text-zinc-900 text-xs"
                                  />
                              </View>
                              <TouchableOpacity 
                                  onPress={handleAddAdmin}
                                  disabled={addingAdmin}
                                  className="w-14 h-14 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg"
                              >
                                  {addingAdmin ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="person-add" size={24} color="white" />}
                              </TouchableOpacity>
                          </View>

                          {/* Search Suggestions */}
                          {adminSuggestions.length > 0 && (
                            <View className="bg-white border border-gray-100 rounded-3xl mb-6 shadow-xl shadow-black/5 overflow-hidden">
                                {adminSuggestions.map((suggestion) => (
                                    <TouchableOpacity 
                                        key={suggestion._id}
                                        onPress={() => {
                                            setAdminEmailInput(suggestion.username);
                                            setAdminSuggestions([]);
                                        }}
                                        className="flex-row items-center p-4 border-b border-gray-50 active:bg-gray-50"
                                    >
                                        <Image 
                                            source={{ uri: suggestion.avatar }} 
                                            className="w-10 h-10 rounded-xl bg-gray-100"
                                        />
                                        <View className="ml-4 flex-1">
                                            <Text className="text-zinc-900 font-bold text-xs">{suggestion.name}</Text>
                                            <Text className="text-zinc-400 text-[10px] font-bold uppercase mt-0.5">@{suggestion.username}</Text>
                                        </View>
                                        <Ionicons name="add-circle" size={20} color="#6366f1" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                          )}
                          
                          <View className="flex-row flex-wrap gap-2">
                              {editData.secondaryAdmins?.map(admin => {
                                  const adminId = typeof admin === 'string' ? admin : admin._id;
                                  const display = typeof admin === 'string' ? admin : admin.username;
                                  return (
                                    <View key={adminId} className="bg-gray-50 flex-row items-center py-2 px-4 rounded-xl border border-gray-100">
                                        <Text className="text-zinc-600 font-bold text-[10px] mr-2">{display}</Text>
                                        {editData.admin_email === user?.email && (
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

                      <TouchableOpacity 
                          onPress={() => setEditData({...editData, isCommunityActive: !editData.isCommunityActive})}
                          className={`flex-row items-center gap-4 p-6 rounded-3xl mb-8 border ${editData.isCommunityActive !== false ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}
                      >
                          <View className={`w-12 h-12 rounded-2xl items-center justify-center ${editData.isCommunityActive !== false ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                              <Ionicons name="people" size={24} color="white" />
                          </View>
                          <View className="flex-1">
                              <Text className={`font-black uppercase text-xs ${editData.isCommunityActive !== false ? 'text-indigo-600' : 'text-zinc-600'}`}>
                                  {editData.isCommunityActive !== false ? "Community Active" : "Community Disabled"}
                              </Text>
                              <Text className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                                  {editData.isCommunityActive !== false ? "Enable group chat for all participants" : "Disable the interactive event group chat"}
                              </Text>
                          </View>
                      </TouchableOpacity>

                      <TouchableOpacity 
                          onPress={() => setEditData({...editData, isCollegeSpecific: !editData.isCollegeSpecific})}
                          className={`flex-row items-center gap-4 p-6 rounded-3xl mb-8 border ${editData.isCollegeSpecific ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-100'}`}
                      >
                          <View className={`w-12 h-12 rounded-2xl items-center justify-center ${editData.isCollegeSpecific ? 'bg-indigo-600' : 'bg-gray-200'}`}>
                              <Ionicons name={editData.isCollegeSpecific ? "shield-checkmark" : "globe-outline"} size={24} color="white" />
                          </View>
                          <View className="flex-1">
                              <Text className={`font-black uppercase text-xs ${editData.isCollegeSpecific ? 'text-indigo-600' : 'text-zinc-600'}`}>
                                  {editData.isCollegeSpecific ? "College Specific (Locked)" : "Open to All Colleges"}
                              </Text>
                              <Text className="text-[10px] text-zinc-400 font-bold uppercase mt-1">
                                  {editData.isCollegeSpecific ? "Only students of your college can see & join" : "Anyone on Fync can discover and enrol"}
                              </Text>
                          </View>
                      </TouchableOpacity>

                      <Pressable 
                          onPress={handleSave}
                          disabled={saving}
                          className="bg-zinc-900 p-8 rounded-[30px] items-center justify-center mb-6 shadow-xl"
                      >
                          {saving ? <ActivityIndicator color="white" /> : (
                              <Text className="text-white text-lg font-black italic tracking-tighter uppercase">
                                  {editData._id ? "Update Bootcamp" : "Create Bootcamp"}
                              </Text>
                          )}
                      </Pressable>

                      {editData._id && editData.admin_email === user?.email && (
                          <TouchableOpacity 
                              onPress={handleDeleteBootcamp}
                              className="bg-red-50 p-6 rounded-3xl items-center justify-center mb-20 border border-red-100 flex-row gap-2"
                          >
                              <Ionicons name="trash" size={18} color="#ef4444" />
                              <Text className="text-red-600 font-black italic text-xs uppercase tracking-widest">Delete Bootcamp Hub</Text>
                          </TouchableOpacity>
                      )}
                  </ScrollView>
              </View>
          </View>
      </Modal>
      
      {/* My Tickets Dashboard Modal */}
      <Modal visible={ticketsModalVisible} transparent animationType="slide" onRequestClose={() => setTicketsModalVisible(false)}>
          <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white h-[90%] rounded-t-[50px] overflow-hidden">
                  <View className="p-10 pt-12 flex-1">
                      <View className="flex-row justify-between items-center mb-8">
                          <View>
                            <Text className="text-zinc-900 text-3xl font-black italic tracking-tighter uppercase">My Passes</Text>
                            <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{userRegistrations.length} Active Tickets</Text>
                          </View>
                          <TouchableOpacity onPress={() => setTicketsModalVisible(false)} className="w-12 h-12 bg-gray-50 rounded-2xl items-center justify-center border border-gray-100">
                             <Ionicons name="close" size={24} color="black" />
                          </TouchableOpacity>
                      </View>

                      <FlatList 
                          data={userRegistrations}
                          keyExtractor={(item) => item._id}
                          renderItem={({ item }) => (
                            <JoinedBootcampCard 
                                item={item} 
                                onShowQR={(reg) => { setSelectedReg(reg); setQrModalVisible(true); }} 
                                onRefresh={() => fetchSessions()}
                            />
                          )}
                          ListEmptyComponent={
                              <View className="items-center mt-20">
                                  <View className="w-24 h-24 bg-slate-50 rounded-full items-center justify-center mb-6">
                                      <Ionicons name="ticket-outline" size={40} color="#CBD5E1" />
                                  </View>
                                  <Text className="text-slate-400 font-black italic text-center uppercase tracking-widest text-[10px]">No active bootcamps found</Text>
                              </View>
                          }
                          contentContainerStyle={{ paddingBottom: 50 }}
                      />
                  </View>
              </View>
          </View>
      </Modal>

      {/* Entry Pass Modal */}
      <Modal visible={qrModalVisible} transparent onRequestClose={() => setQrModalVisible(false)}>
        <View className="flex-1 bg-black/80 justify-center items-center px-8">
            <View className="bg-white w-full rounded-[40px] overflow-hidden">
                <LinearGradient colors={['#6366f1', '#4338ca']} className="p-8 items-center flex-row justify-between">
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
                            {user?.avatar && (
                                <Image 
                                    source={{ uri: user.avatar }} 
                                    style={{ width: 140, height: 140 }} 
                                    className="rounded-2xl"
                                    resizeMode="cover"
                                />
                            )}
                        </View>
                    </View>
                    <TouchableOpacity onPress={() => setQrModalVisible(false)} className="mt-8 bg-zinc-900 w-full py-5 rounded-[22px] items-center shadow-lg">
                        <Text className="text-white font-black italic text-xs uppercase tracking-widest">Done</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      <Modal visible={collegeModalVisible} transparent animationType="fade" onRequestClose={() => setCollegeModalVisible(false)}>
          <View className="flex-1 bg-black/50 items-center justify-center px-10">
              <View className="bg-white w-full max-h-[70%] rounded-[40px] overflow-hidden">
                  <View className="p-6 bg-zinc-900">
                      <View className="flex-row justify-between items-center mb-4">
                        <Text className="text-white text-lg font-black italic tracking-tighter uppercase">Select Bootcamp Base</Text>
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
                    keyExtractor={(it) => it}
                    renderItem={({ item }) => (
                        <TouchableOpacity 
                            onPress={() => {
                                setEditData({ ...editData, college: item });
                                setCollegeModalVisible(false);
                                setCollegeSearch('');
                            }}
                            className="p-5 border-b border-gray-50 flex-row items-center"
                        >
                            <Ionicons name="business-outline" size={16} color="#6366f1" />
                            <Text className="text-zinc-900 font-bold ml-3 text-xs">{item}</Text>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<View className="p-10 items-center"><Text className="text-gray-400 font-bold">No institution found</Text></View>}
                  />
                  <TouchableOpacity onPress={() => setCollegeModalVisible(false)} className="p-6 items-center">
                      <Text className="text-slate-400 font-black italic text-[10px] uppercase tracking-widest">Cancel</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>

    </SafeAreaView>
  );
}
