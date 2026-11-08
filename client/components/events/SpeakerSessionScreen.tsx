import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, StatusBar, ScrollView, Platform, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import axios from '../../context/axiosConfig';
import { navigate, goBack } from '../../utils/navigation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../context/auth.context';
// @ts-ignore
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Avatar, Button, Empty, FormField, IconBtn, Label, SectionHeader, SegmentedTabs, Sheet } from '../ui/kit';
import type { ListingTag } from '../opportunity/OpportunityCard';
import {
    AttendeeRow, AttendeesSheet, BrandingPicker, CollaboratorsEditor, CollegePickerSheet, ContactsEditor, EventCard,
    JoinedCard, PassSheet, PickerField, ScannerModal, TicketsSheet, ToggleRow, formatTime, pickImage,
} from './EventShared';

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

// --- SPEAKERS ROW (inside the session card) ---
const SpeakersRow = memo(({ speakers, canEdit, onAdd, onEdit }: {
    speakers?: Speaker[]; canEdit: boolean; onAdd: () => void; onEdit: (s: Speaker) => void;
}) => (
    <View className="mt-4">
        <SectionHeader title="Speakers" right={canEdit ? <Button small title="Add" icon="add" onPress={onAdd} accessibilityLabel="Add speaker" /> : undefined} />
        {speakers && speakers.length > 0 ? (
            <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {speakers.map((speaker, idx) => (
                    <Pressable
                        key={speaker._id || idx}
                        onPress={canEdit ? () => onEdit(speaker) : undefined}
                        disabled={!canEdit}
                        accessibilityRole={canEdit ? 'button' : undefined}
                        accessibilityLabel={canEdit ? `Edit ${speaker.name}` : `${speaker.name}, ${speaker.designation}`}
                        className="items-center w-24 active:opacity-70"
                    >
                        <Avatar uri={speaker.image} initials={speaker.name} size={64} />
                        {canEdit ? (
                            <View className="absolute top-0 right-3 bg-card w-6 h-6 rounded-full items-center justify-center border border-line">
                                <Ionicons name="pencil" size={12} color={C.ink2} />
                            </View>
                        ) : null}
                        <Text className="text-ink text-xs font-semibold mt-2 text-center" numberOfLines={1}>{speaker.name}</Text>
                        <Text className="text-ink-3 text-xs font-sans text-center" numberOfLines={1}>{speaker.designation}</Text>
                    </Pressable>
                ))}
            </ScrollView>
        ) : (
            <Text className="text-ink-3 text-sm font-sans">No speakers yet.</Text>
        )}
    </View>
));

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


    // A ref, not just state: the camera delivers several frames of the same code
    // before `scanned` re-renders, and each one used to POST.
    const scanLock = useRef(false);
    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanLock.current) return;
        scanLock.current = true;
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
            scanLock.current = false;
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
                setAttendees(res.data.registrations ?? []);
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
                // Unpopulated/deleted users come back as an id or null.
                const u = (reg.userId && typeof reg.userId === 'object' ? reg.userId : {}) as User;
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
            // Loaded on demand: xlsx is large and only this export needs it.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const XLSX: typeof import('@e965/xlsx') = require('@e965/xlsx');
            const ws = XLSX.utils.json_to_sheet(excelData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Attendees");

            // Set column widths
            ws['!cols'] = [
                { wch: 5 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 10 }
            ];

            // Write to base64
            const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
            const uri = FileSystem.cacheDirectory + `${eventName.replace(/[^\w-]+/g, '_')}_Attendees.xlsx`;

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

            // Settled, not all: a failing my-sessions call used to hide every session too.
            const [sessionsSettled, registrationsSettled] = await Promise.allSettled([sessionsPromise, registrationsPromise]);
            if (sessionsSettled.status === 'rejected') throw sessionsSettled.reason;
            const sessionsRes = sessionsSettled.value;

            if (sessionsRes.data.success) {
                const batch: SpeakerSession[] = sessionsRes.data.sessions ?? [];
                // Functional + de-duped: `sessions` in this closure can be a page behind.
                setSessions(prev => {
                    if (isNew) return batch;
                    const seen = new Set(prev.map(s => s._id));
                    return [...prev, ...batch.filter(s => !seen.has(s._id))];
                });
                setHasMore(sessionsRes.data.hasMore);
            }

            const registrationsRes = registrationsSettled.status === 'fulfilled' ? registrationsSettled.value : null;
            if (registrationsRes?.data?.success) {
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

        let alive = true; // a slower, older search must not overwrite a newer one
        const timeout = setTimeout(async () => {
            setSearchingUsers(true);
            try {
                const res = await axios.post('/user/search', { name: adminEmailInput });
                if (alive && res.data.success) {
                    setUserSuggestions(res.data.users || []);
                }
            } catch (e) {
                console.log("Search error:", e);
            } finally {
                if (alive) setSearchingUsers(false);
            }
        }, 1000); // 1s delay

        return () => { alive = false; clearTimeout(timeout); };
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

    const registering = useRef(false);
    const handleRegister = async (session: SpeakerSession) => {
        if (registering.current) return;
        const isAdmin = user?._id === session.admin_email || !!(session.secondaryAdmins?.some((a: any) => a === user?._id || a?._id === user?._id));
        if (isAdmin) {
            Alert.alert("Admin Access", "You are an organizer for this event. You have full access without registration.");
            return;
        }
        registering.current = true;
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
                                    } catch (e) { console.log("Failed to delete un-paid reg", e) }
                                }
                            },
                            {
                                text: "Pay Now",
                                onPress: () => {
                                    navigate('RazorpayWebView', {
                                        order: order,
                                        user: user,
                                        keyId: RAZORPAY_KEY_ID,
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
        } finally {
            registering.current = false;
        }
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

            if (speakerImage && speakerImage.startsWith('file://')) {
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

            if (eventLogo && eventLogo.startsWith('file://')) {
                const name = eventLogo.split('/').pop();
                formData.append('logo', { uri: eventLogo, name, type: 'image/jpeg' } as any);
            }
            if (eventBanner && eventBanner.startsWith('file://')) {
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
                            if (speaker.image && speaker.image.startsWith('file://')) {
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



    const closeSessionSheet = () => { setSessionModalVisible(false); setIsEditingSession(false); setLocalSpeakers([]); };

    const isAdminOf = (item: SpeakerSession) => item.admin_email === user?._id ||
        (item.secondaryAdmins || []).some((a: any) => (typeof a === 'string' ? a === user?._id || a === user?.email : a._id === user?._id || a.email === user?.email));

    const renderAttendee = useCallback(({ item, index }: { item: Registration; index: number }) => {
        const u = (item.userId && typeof item.userId === 'object' ? item.userId : {}) as User;
        const status: ListingTag[] = [];
        if (item.isPaid) status.push({ icon: 'shield-checkmark-outline', label: 'Verified' });
        if (item.isPresent) status.push({ icon: 'checkmark-circle', label: 'Present' });
        return <AttendeeRow name={u.name} email={u.email} index={index} status={status} tags={[u.college, u.mobileNumber, u.department]} />;
    }, []);

    const renderTicket = useCallback(({ item }: { item: Registration }) => {
        const session = item.eventId as SpeakerSession;
        if (!session || typeof session === 'string') return null;
        const isAdmin = !!(item as any).isAdmin;
        return (
            <JoinedCard
                title={session.eventName}
                eyebrow={isAdmin ? 'Organizer' : 'Speaker session'}
                timeLabel={`${session.startTime} - ${session.endTime}`}
                isAdmin={isAdmin}
                isPresent={item.isPresent}
                locked={!item.isPaid}
                passLabel={item.isPaid ? (isAdmin ? 'Organizer pass' : 'Entry pass') : 'Payment pending'}
                onPress={() => item.isPaid ? (setSelectedReg(item), setQrModalVisible(true)) : Alert.alert(
                    "Payment pending",
                    "This ticket is locked because payment is pending. Drop the reservation to register again?",
                    [
                        { text: "Keep pending", style: "cancel" },
                        {
                            text: "Drop reservation",
                            style: "destructive",
                            onPress: async () => {
                                try {
                                    await axios.delete(`/speakers/register/${item._id}`);
                                    onRefresh();
                                } catch (e) { console.log(e); }
                            }
                        }
                    ]
                )}
            />
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pickCollege = useCallback((college: string) => {
        setEditSessionData(d => ({ ...d, college }));
        setCollegeModalVisible(false);
    }, []);

    const setField = (patch: Partial<SpeakerSession>) => setEditSessionData({ ...editSessionData, ...patch });

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Speaker sessions" onBack={() => goBack()}
                    right={<>
                        <IconBtn name="ticket-outline" boxed onPress={() => setTicketsModalVisible(true)} accessibilityLabel="My tickets" />
                        {/* openSessionModal resets edit mode, speakers, fee and limit —
                            setting only the data here reopened a previous edit as "Update". */}
                        <IconBtn name="add" boxed onPress={() => openSessionModal()} accessibilityLabel="Create session" />
                    </>} />
                <FlatList keyboardShouldPersistTaps="handled"
                    data={sessions}
                    keyExtractor={(item: any) => item._id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.5}
                    renderItem={({ item }: { item: SpeakerSession }) => {
                        const isPrimaryAdmin = item.admin_email === user?._id;
                        return (
                            <EventCard
                                item={item}
                                fallbackIcon="mic-outline"
                                chatType="SpeakerSession"
                                tags={[
                                    { icon: 'calendar-outline', label: new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) },
                                    { icon: 'time-outline', label: item.startTime },
                                    ...(item.venue ? [{ icon: 'location-outline' as const, label: item.venue }] : []),
                                    ...(item.isCollegeSpecific ? [{ icon: 'shield-checkmark-outline' as const, label: 'College only' }] : []),
                                ]}
                                isAdmin={isAdminOf(item)}
                                isPrimaryAdmin={isPrimaryAdmin}
                                isRegistered={myRegistrations.some(r => (r.eventId as any)?._id === item._id)}
                                onRegister={() => handleRegister(item)}
                                onAttendees={() => {
                                    setCurrentEventForAttendees(item);
                                    fetchRegistrations(item.eventId);
                                }}
                                onScan={() => {
                                    if (permission?.granted) setScannerVisible(true);
                                    else requestPermission();
                                }}
                                onEdit={() => {
                                    setEditSessionData(item);
                                    setEventLogo(item.logo || null);
                                    setEventBanner(item.banner || null);
                                    setLimitType(item.userLimit && item.userLimit < 1000000 ? 'custom' : 'unlimited');
                                    setFeeType(item.fee && item.fee > 0 ? 'paid' : 'free');
                                    setIsEditingSession(true);
                                    setSessionModalVisible(true);
                                }}
                            >
                                <SpeakersRow
                                    speakers={item.speakers}
                                    canEdit={isPrimaryAdmin}
                                    onAdd={() => {
                                        setTargetEventId(item.eventId);
                                        setIsEditingSpeaker(false);
                                        setIsLocalSpeaker(false);
                                        setSpeakerName('');
                                        setSpeakerDesignation('');
                                        setSpeakerImage(null);
                                        setSpeakerModalVisible(true);
                                    }}
                                    onEdit={(speaker) => {
                                        setTargetEventId(item.eventId);
                                        setSpeakerId(speaker._id);
                                        setSpeakerName(speaker.name);
                                        setSpeakerDesignation(speaker.designation);
                                        setSpeakerImage(speaker.image);
                                        setIsEditingSpeaker(true);
                                        setIsLocalSpeaker(false);
                                        setSpeakerModalVisible(true);
                                    }}
                                />
                            </EventCard>
                        );
                    }}
                    ListEmptyComponent={loading ? (
                        <View className="items-center justify-center mt-20"><ActivityIndicator size="large" color={C.brand[500]} /></View>
                    ) : (
                        <Empty icon="mic-outline" title="No sessions yet" hint="Tap + to host a speaker session." />
                    )}
                    ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={C.brand[500]} className="mb-10" /> : <View className="h-20" />}
                />
            </View>

            {/* Session form. Rendered before the speaker / college sheets so they stack above it. */}
            <Sheet
                visible={sessionModalVisible}
                onClose={closeSessionSheet}
                title={isEditingSession ? 'Edit session' : 'New session'}
                height="88%"
                footer={<Button block variant="primary" title={isEditingSession ? 'Update session' : 'Create session'} loading={savingSession} onPress={handleSessionAction} />}
            >
                <View style={{ gap: 16 }}>
                    <Label>Branding (optional)</Label>
                    <BrandingPicker banner={eventBanner} logo={eventLogo} onBanner={setEventBanner} onLogo={setEventLogo} />

                    <FormField label="Title" placeholder="Event title" value={editSessionData.eventName || ''} onChangeText={(t) => setField({ eventName: t })} />
                    <PickerField label="College" value={editSessionData.college} placeholder="Select college" icon="business-outline" onPress={() => setCollegeModalVisible(true)} />
                    <FormField label="Description" placeholder="What is this session about?" multiline value={editSessionData.description || ''} onChangeText={(t) => setField({ description: t })} />

                    {!isEditingSession && (
                        <View>
                            <SectionHeader title="Speakers" count={localSpeakers.length || undefined} right={
                                <Button small title="Add speaker" icon="add" onPress={() => openSpeakerModal(undefined, undefined, true)} />
                            } />
                            {localSpeakers.length > 0 ? (
                                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                                    {localSpeakers.map((s, i) => (
                                        <View key={s.id} className="bg-paper-2 p-3 rounded-2xl items-center w-28">
                                            <Avatar uri={s.image} initials={s.name} size={56} />
                                            <Text className="text-ink text-xs font-semibold mt-2" numberOfLines={1}>{s.name}</Text>
                                            <IconBtn name="close-circle" color={C.danger} size={20} accessibilityLabel={`Remove ${s.name}`} onPress={() => setLocalSpeakers(localSpeakers.filter((_, idx) => idx !== i))} style={{ position: 'absolute', top: -4, right: -4 }} />
                                        </View>
                                    ))}
                                </ScrollView>
                            ) : (
                                <Text className="text-ink-3 text-sm font-sans">No speakers added yet.</Text>
                            )}
                        </View>
                    )}

                    <FormField label="Venue" placeholder="Where is it happening?" value={editSessionData.venue || ''} onChangeText={(t) => setField({ venue: t })} />

                    <View className="flex-row" style={{ gap: 12 }}>
                        <PickerField label="Start time" value={editSessionData.startTime} placeholder="--:--" icon="time-outline" onPress={() => setShowStartTimePicker(true)} style={{ flex: 1 }} />
                        <PickerField label="End time" value={editSessionData.endTime} placeholder="--:--" icon="time-outline" onPress={() => setShowEndTimePicker(true)} style={{ flex: 1 }} />
                    </View>
                    <PickerField
                        label="Date"
                        value={editSessionData.date ? new Date(editSessionData.date).toLocaleDateString() : undefined}
                        placeholder="Select date"
                        icon="calendar-outline"
                        onPress={() => setShowDatePicker(true)}
                    />

                    {showDatePicker && (
                        <DateTimePicker
                            value={editSessionData.date ? new Date(editSessionData.date) : new Date()}
                            mode="date"
                            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => { setShowDatePicker(false); if (date) setEditSessionData({ ...editSessionData, date: date.toISOString() }); }}
                        />
                    )}
                    {showStartTimePicker && (
                        <DateTimePicker
                            value={new Date()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => { setShowStartTimePicker(false); if (date) setEditSessionData({ ...editSessionData, startTime: formatTime(date) }); }}
                        />
                    )}
                    {showEndTimePicker && (
                        <DateTimePicker
                            value={new Date()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                            onChange={(event, date) => { setShowEndTimePicker(false); if (date) setEditSessionData({ ...editSessionData, endTime: formatTime(date) }); }}
                        />
                    )}

                    <View style={{ gap: 8 }}>
                        <Label>Capacity</Label>
                        <SegmentedTabs items={['unlimited', 'custom'] as const} labels={{ unlimited: 'Unlimited', custom: 'Custom limit' }} value={limitType} onChange={setLimitType} />
                    </View>
                    {limitType === 'custom' && (
                        <FormField
                            label="Max capacity" placeholder="e.g. 120" keyboardType="numeric"
                            value={editSessionData.userLimit && editSessionData.userLimit < 1000000 ? editSessionData.userLimit.toString() : ''}
                            onChangeText={(t) => setField({ userLimit: t === '' ? 1000000 : parseInt(t) })}
                        />
                    )}

                    <View style={{ gap: 8 }}>
                        <Label>Entry fee</Label>
                        <SegmentedTabs
                            items={['free', 'paid'] as const}
                            labels={{ free: 'Free', paid: 'Paid' }}
                            value={feeType}
                            onChange={(v) => { setFeeType(v); if (v === 'free') setEditSessionData({ ...editSessionData, fee: 0 }); }}
                        />
                    </View>
                    {feeType === 'paid' && (
                        <View className="flex-row" style={{ gap: 12 }}>
                            <FormField
                                label="Fee (₹)" placeholder="0" keyboardType="numeric"
                                value={editSessionData.fee ? editSessionData.fee.toString() : ''}
                                onChangeText={(t) => setField({ fee: t === '' ? 0 : parseInt(t) })}
                                containerStyle={{ width: 112 }}
                            />
                            <FormField
                                label="UPI ID" placeholder="name@bank" autoCapitalize="none"
                                value={editSessionData.admin_upi_id} onChangeText={(t) => setField({ admin_upi_id: t })}
                                containerStyle={{ flex: 1 }}
                            />
                        </View>
                    )}

                    <View style={{ gap: 8 }}>
                        <Label>Registrations</Label>
                        <SegmentedTabs
                            items={['open', 'closed'] as const}
                            labels={{ open: 'Open', closed: 'Closed' }}
                            value={editSessionData.status || 'open'}
                            onChange={(v) => setField({ status: v })}
                        />
                    </View>

                    {isEditingSession && (
                        <CollaboratorsEditor
                            value={adminEmailInput}
                            onChangeText={setAdminEmailInput}
                            onAdd={handleAddAdmin}
                            adding={addingAdmin}
                            searching={searchingUsers}
                            suggestions={userSuggestions}
                            onPick={(username) => { setAdminEmailInput(username); setUserSuggestions([]); }}
                            admins={(editSessionData.secondaryAdmins || []).map((a: any) => ({ id: typeof a === 'string' ? a : a._id, label: typeof a === 'string' ? a : a.username || a.name }))}
                            canRemove={editSessionData.admin_email === user?._id}
                            onRemove={handleRemoveAdmin}
                        />
                    )}

                    <View>
                        <ToggleRow
                            on={editSessionData.isCommunityActive !== false}
                            icon="chatbubbles-outline"
                            title="Community chat"
                            hint={editSessionData.isCommunityActive !== false ? 'Group chat is on for attendees' : 'Group chat is off'}
                            onToggle={() => setField({ isCommunityActive: !editSessionData.isCommunityActive })}
                        />
                        <ToggleRow
                            on={!!editSessionData.isCollegeSpecific}
                            icon={editSessionData.isCollegeSpecific ? 'shield-checkmark-outline' : 'globe-outline'}
                            title="College only"
                            hint={editSessionData.isCollegeSpecific ? 'Only your campus can see and join' : 'Open to everyone on Fync'}
                            onToggle={() => setField({ isCollegeSpecific: !editSessionData.isCollegeSpecific })}
                        />
                    </View>

                    <ContactsEditor contacts={editSessionData.contactDetails || []} onChange={(c) => setField({ contactDetails: c })} />

                    {isEditingSession && (
                        <Button block variant="danger" icon="trash-outline" title="Delete session" loading={deletingSession} onPress={handlePurgeSession} />
                    )}
                </View>
            </Sheet>

            <Sheet
                visible={speakerModalVisible}
                onClose={() => setSpeakerModalVisible(false)}
                title={isEditingSpeaker ? 'Edit speaker' : 'Add speaker'}
                footer={<>
                    <Button block variant="primary" title={isEditingSpeaker ? 'Save speaker' : 'Add speaker'} loading={addingSpeaker} onPress={handleSpeakerAction} />
                    {isEditingSpeaker ? <Button block variant="tertiary" icon="trash-outline" title="Remove speaker" loading={removingSpeaker} onPress={handleRemoveSpeaker} /> : null}
                </>}
            >
                <View style={{ gap: 16 }}>
                    <Pressable
                        onPress={() => pickImage(setSpeakerImage)}
                        accessibilityRole="button"
                        accessibilityLabel="Pick speaker photo"
                        className="w-28 h-28 rounded-full self-center bg-paper-2 border border-line overflow-hidden items-center justify-center active:opacity-70"
                    >
                        {speakerImage ? <ExpoImage source={{ uri: speakerImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Ionicons name="camera-outline" size={28} color={C.ink3} />}
                    </Pressable>
                    <FormField label="Name" placeholder="Speaker name" value={speakerName} onChangeText={setSpeakerName} />
                    <FormField label="Designation" placeholder="e.g. SDE at Google" value={speakerDesignation} onChangeText={setSpeakerDesignation} />
                </View>
            </Sheet>

            <CollegePickerSheet visible={collegeModalVisible} onClose={() => setCollegeModalVisible(false)} onSelect={pickCollege} />

            <AttendeesSheet
                visible={attendeeModalVisible}
                onClose={() => setAttendeeModalVisible(false)}
                title={currentEventForAttendees?.eventName || 'Attendees'}
                subtitle={`${attendees.length} registered`}
                actions={
                    <IconBtn
                        name="download-outline"
                        onPress={() => exportToExcel(currentEventForAttendees?.eventName || 'Event')}
                        disabled={exporting || loadingAttendees}
                        accessibilityLabel="Export to Excel"
                    />
                }
                notice="Attendee data is deleted 7 days after the session ends. Export it before then."
                loading={loadingAttendees}
                data={attendees}
                renderItem={renderAttendee}
            />

            <TicketsSheet
                visible={ticketsModalVisible}
                onClose={() => setTicketsModalVisible(false)}
                subtitle={`${myRegistrations.length} entries`}
                data={myRegistrations}
                renderItem={renderTicket}
                emptyText="Sessions you register for show up here."
            />

            <PassSheet
                visible={qrModalVisible}
                onClose={() => setQrModalVisible(false)}
                title={(selectedReg?.eventId as any)?.eventName}
                qrCode={selectedReg?.qrCode}
                caption={selectedReg?._id ? `Entry ID ${selectedReg._id.slice(-8).toUpperCase()}` : undefined}
            />

            <ScannerModal
                visible={scannerVisible}
                onClose={() => setScannerVisible(false)}
                onScanned={scanned ? undefined : handleBarCodeScanned}
                title="Scan ticket"
                hint="Point at the attendee's QR pass"
            />
        </View>
    );
}
