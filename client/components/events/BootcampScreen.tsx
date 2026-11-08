import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, FlatList, ActivityIndicator, StatusBar, Platform } from 'react-native';
import axios from '../../context/axiosConfig';
import { navigate, goBack } from '../../utils/navigation';
import { useAuth } from '../../context/auth.context';
// @ts-ignore
import { RAZORPAY_KEY_ID } from '../../constants/keys';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert } from '../ui/AlertModal';
import { C } from '../../constants/colors';
import { AppBar, Button, Empty, FilterChips, FormField, IconBtn, Label, Sheet } from '../ui/kit';
import {
    AttendeeRow, AttendeesSheet, BrandingPicker, CollaboratorsEditor, CollegePickerSheet, ContactsEditor, EventCard,
    JoinedCard, PassSheet, PickerField, ScannerModal, TicketsSheet, ToggleRow, formatTime,
} from './EventShared';

import FyncRefreshControl from '../ui/FyncRefreshControl';
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


    // Attendees
    const [attendees, setAttendees] = useState<BootcampRegistration[]>([]);
    const [currentEventForAttendees, setCurrentEvent] = useState<string | null>(null);
    const [loadingAttendees, setLoadingAttendees] = useState(false);

    useEffect(() => {
        if (adminEmailInput.length < 2) {
            setAdminSuggestions([]);
            return;
        }

        let stale = false;
        const timer = setTimeout(async () => {
            setIsSearchingAdmins(true);
            try {
                const res = await axios.post('/user/search', { name: adminEmailInput });
                if (!stale && res.data.success) {
                    // Filter out already added admins
                    const existingAdmins = (editData.secondaryAdmins || []).map(a => typeof a === 'string' ? a : a.username);
                    const filtered = (res.data.users || []).filter((u: User) => !existingAdmins.includes(u.username) && u.email !== user?.email);
                    setAdminSuggestions(filtered);
                }
            } catch (err) {
                console.error("Suggest admin error:", err);
            } finally {
                setIsSearchingAdmins(false);
            }
        }, 1000);

        return () => { stale = true; clearTimeout(timer); };
    }, [adminEmailInput]);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        // Settled, not all: a failing registrations call used to hide every session too.
        const [res, regRes] = await Promise.allSettled([
            axios.get('/bootcamp/all'),
            axios.get('/bootcamp/my-registrations')
        ]);
        if (res.status === 'fulfilled') setSessions(res.value.data.sessions || []);
        else console.error(res.reason);
        if (regRes.status === 'fulfilled') setUserRegistrations(regRes.value.data.registrations || []);
        setLoading(false);
        setRefreshing(false);
    };

    const registering = useRef(false);
    const handleRegister = async (session: BootcampSession) => {
        const isAdmin = session.admin_email?.toLowerCase() === user?.email?.toLowerCase() ||
            (session.secondaryAdmins || []).some(a => (typeof a === 'string' ? a === user?.id || a === user?.email : a._id === user?._id || a.email === user?.email));
        if (isAdmin) {
            Alert.alert("Admin Access", "You are an organizer for this Bootcamp. You have full access without enrollment.");
            return;
        }
        if (registering.current) return;
        registering.current = true;
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
                                    } catch (e) { }
                                }
                            },
                            {
                                text: "Pay Now",
                                onPress: () => {
                                    navigate('RazorpayWebView', {
                                        order: order,
                                        user: user,
                                        keyId: RAZORPAY_KEY_ID,
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
        } finally {
            registering.current = false;
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
                const u = (reg.userId || {}) as User;
                const dayRecord = reg.attendance?.find(a => a.date === attendanceDate);
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

            // Loaded on demand: xlsx is large and only this export needs it.
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const XLSX: typeof import('@e965/xlsx') = require('@e965/xlsx');
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
            Alert.alert("Invalid QR", e.message || "Could not parse ticket data.");
        }
    };


    const openScanner = async (id?: string) => {
        const { status } = await requestPermission();
        if (status === 'granted') {
            if (id) setCurrentEvent(id);
            setScanned(false);
            setScannerVisible(true);
        } else {
            Alert.alert("Required", "Camera access is needed to scan tickets.");
        }
    };

    const openEditor = (s?: BootcampSession) => {
        if (s) {
            setEditData(s);
            setEventLogo(s.logo || null);
            setEventBanner(s.banner || null);
        } else {
            setEditData({ admin_email: user?.email });
            setEventLogo(null);
            setEventBanner(null);
        }
        setSessionModalVisible(true);
    };

    const isAdminOf = (item: BootcampSession) => item.admin_email?.toLowerCase() === user?.email?.toLowerCase() ||
        (item.secondaryAdmins || []).some(a => (typeof a === 'string' ? a === user?.id || a === user?.email : a._id === user?._id || a.email === user?.email));

    const activeSession = sessions.find(s => s.eventId === currentEventForAttendees);
    const attendanceDates = useMemo(
        () => (activeSession ? getDatesInRange(activeSession.startDate, activeSession.endDate) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [activeSession?.startDate, activeSession?.endDate]
    );
    const dateLabels = useMemo(
        () => Object.fromEntries(attendanceDates.map(d => [d, new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })])),
        [attendanceDates]
    );
    const isPrimaryAdminForActive = activeSession?.admin_email?.toLowerCase() === user?.email?.toLowerCase();

    const renderAttendee = useCallback(({ item, index }: { item: BootcampRegistration; index: number }) => {
        const u = (item.userId || {}) as User;
        const isPresentToday = !!item.attendance?.find(a => a.date === attendanceDate)?.isPresent;
        return (
            <AttendeeRow
                name={u.name}
                email={u.email}
                index={index}
                status={[isPresentToday ? { icon: 'checkmark-circle', label: 'Present' } : { icon: 'ellipse-outline', label: 'Absent' }]}
                tags={[u.college, u.department]}
                right={item.status === 'pending' && isPrimaryAdminForActive ? (
                    <Button small variant="primary" title="Approve" onPress={() => approvePayment(item._id)} />
                ) : undefined}
            />
        );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attendanceDate, isPrimaryAdminForActive, currentEventForAttendees]);

    const renderTicket = useCallback(({ item }: { item: BootcampRegistration }) => {
        const session = item.eventId as any;
        if (!session) return null;
        const isAdmin = !!(item as any).isAdmin;
        return (
            <JoinedCard
                title={session.eventName}
                eyebrow={isAdmin ? 'Organizer' : 'Bootcamp'}
                timeLabel={`${session.startTime} - ${session.endTime}`}
                isAdmin={isAdmin}
                passLabel="Entry pass"
                onPress={() => { setSelectedReg(item); setQrModalVisible(true); }}
            />
        );
    }, []);

    const pickCollege = useCallback((college: string) => {
        setEditData(d => ({ ...d, college }));
        setCollegeModalVisible(false);
    }, []);

    if (loading) return <View className="flex-1 bg-paper items-center justify-center"><ActivityIndicator color={C.brand[500]} size="large" /></View>;

    const setField = (patch: Partial<BootcampSession>) => setEditData({ ...editData, ...patch });
    const isOwner = !!editData._id && editData.admin_email === user?.email;

    return (
        <View className="flex-1 bg-paper">
            <StatusBar barStyle={C.barStyle} />

            <View className="flex-1">
                <AppBar title="Bootcamps" onBack={() => goBack()}
                    right={<>
                        <IconBtn name="ticket-outline" boxed onPress={() => setTicketsModalVisible(true)} accessibilityLabel="My tickets" />
                        <IconBtn name="add" boxed onPress={() => openEditor()} accessibilityLabel="Create bootcamp" />
                    </>} />
                <FlatList keyboardShouldPersistTaps="handled"
                    data={sessions}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <EventCard
                            item={item}
                            fallbackIcon="rocket-outline"
                            chatType="Bootcamp"
                            tags={[
                                { icon: 'calendar-outline', label: new Date(item.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) },
                                { icon: 'time-outline', label: item.startTime },
                                ...(item.isCollegeSpecific ? [{ icon: 'shield-checkmark-outline' as const, label: 'College only' }] : []),
                            ]}
                            isAdmin={isAdminOf(item)}
                            isPrimaryAdmin={item.admin_email?.toLowerCase() === user?.email?.toLowerCase()}
                            isRegistered={userRegistrations.some(r => (r.eventId as any)?._id === item._id)}
                            onRegister={() => handleRegister(item)}
                            onAttendees={() => viewAttendees(item.eventId)}
                            onScan={() => openScanner(item.eventId)}
                            onEdit={() => openEditor(item)}
                        />
                    )}
                    refreshControl={<FyncRefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSessions(); }} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
                    ListEmptyComponent={<Empty icon="rocket-outline" title="No bootcamps yet" hint="Run one for your campus and fill the room." action={<Button variant="primary" title="Create bootcamp" onPress={() => openEditor()} />} />}
                />

                <AttendeesSheet
                    visible={attendeeModalVisible}
                    onClose={() => setAttendeeModalVisible(false)}
                    title="Participants"
                    subtitle="Attendance by day"
                    actions={<>
                        <IconBtn name="scan-outline" onPress={() => openScanner()} accessibilityLabel="Scan tickets" />
                        <IconBtn name="download-outline" onPress={() => exportToExcel('Bootcamp_Attendees')} disabled={exporting} accessibilityLabel="Export to Excel" />
                    </>}
                    top={attendanceDates.length ? (
                        <FilterChips items={attendanceDates} value={attendanceDate} onChange={setAttendanceDate} labels={dateLabels} style={{ marginTop: 12 }} />
                    ) : null}
                    notice="Download the list now. Participant details and community messages are deleted 7 days after the event ends."
                    loading={loadingAttendees}
                    data={attendees}
                    renderItem={renderAttendee}
                />

                <ScannerModal
                    visible={scannerVisible}
                    onClose={() => setScannerVisible(false)}
                    onScanned={scanned ? undefined : handleBarCodeScanned}
                    title="Scan ticket"
                    hint="Bootcamp entry and attendance"
                />

                <Sheet
                    visible={sessionModalVisible}
                    onClose={() => setSessionModalVisible(false)}
                    title={editData._id ? 'Edit bootcamp' : 'New bootcamp'}
                    subtitle="Design your training session"
                    height="88%"
                    footer={<Button block variant="primary" title={editData._id ? 'Update bootcamp' : 'Create bootcamp'} loading={saving} onPress={handleSave} />}
                >
                    <View style={{ gap: 16 }}>
                        <Label>Branding (optional)</Label>
                        <BrandingPicker banner={eventBanner} logo={eventLogo} onBanner={setEventBanner} onLogo={setEventLogo} />

                        <FormField label="Title" placeholder="e.g. MERN masterclass" value={editData.eventName} onChangeText={(t) => setField({ eventName: t })} />
                        <FormField label="Description" placeholder="Describe the curriculum" multiline value={editData.description} onChangeText={(t) => setField({ description: t })} />

                        <ContactsEditor contacts={editData.contactDetails || []} onChange={(c) => setField({ contactDetails: c })} />

                        <View className="flex-row" style={{ gap: 12 }}>
                            <PickerField label="Starts" value={editData.startDate} placeholder="Select date" icon="calendar-outline" onPress={() => setShowStartDatePicker(true)} style={{ flex: 1 }} />
                            <PickerField label="Ends" value={editData.endDate} placeholder="Select date" icon="calendar-outline" onPress={() => setShowEndDatePicker(true)} style={{ flex: 1 }} />
                        </View>
                        <View className="flex-row" style={{ gap: 12 }}>
                            <PickerField label="Start time" value={editData.startTime} placeholder="Select time" icon="time-outline" onPress={() => setShowStartTimePicker(true)} style={{ flex: 1 }} />
                            <PickerField label="End time" value={editData.endTime} placeholder="Select time" icon="time-outline" onPress={() => setShowEndTimePicker(true)} style={{ flex: 1 }} />
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

                        <PickerField label="College" value={editData.college} placeholder="Select college" icon="business-outline" onPress={() => setCollegeModalVisible(true)} />
                        <FormField label="Venue" placeholder="e.g. Auditorium" value={editData.venue} onChangeText={(t) => setField({ venue: t })} />
                        <View className="flex-row" style={{ gap: 12 }}>
                            <FormField label="Student limit" placeholder="100" keyboardType="numeric" value={editData.userLimit?.toString()} onChangeText={(t) => setField({ userLimit: parseInt(t) || 0 })} containerStyle={{ flex: 1 }} />
                            <FormField label="Fee (INR)" placeholder="0 (free)" keyboardType="numeric" value={editData.fee?.toString()} onChangeText={(t) => setField({ fee: parseInt(t) || 0 })} containerStyle={{ flex: 1 }} />
                        </View>

                        {editData._id ? (
                            <CollaboratorsEditor
                                value={adminEmailInput}
                                onChangeText={setAdminEmailInput}
                                onAdd={handleAddAdmin}
                                adding={addingAdmin}
                                searching={isSearchingAdmins}
                                suggestions={adminSuggestions}
                                onPick={(username) => { setAdminEmailInput(username); setAdminSuggestions([]); }}
                                admins={(editData.secondaryAdmins || []).map(a => ({ id: typeof a === 'string' ? a : a._id, label: typeof a === 'string' ? a : a.username }))}
                                canRemove={editData.admin_email === user?.email}
                                onRemove={handleRemoveAdmin}
                            />
                        ) : null}

                        <View>
                            <ToggleRow
                                on={editData.isCommunityActive !== false}
                                icon="people-outline"
                                title="Community chat"
                                hint={editData.isCommunityActive !== false ? 'Group chat is on for all participants' : 'Group chat is off'}
                                onToggle={() => setField({ isCommunityActive: !editData.isCommunityActive })}
                            />
                            <ToggleRow
                                on={!!editData.isCollegeSpecific}
                                icon={editData.isCollegeSpecific ? 'shield-checkmark-outline' : 'globe-outline'}
                                title="College only"
                                hint={editData.isCollegeSpecific ? 'Only students of your college can see and join' : 'Anyone on Fync can discover and enrol'}
                                onToggle={() => setField({ isCollegeSpecific: !editData.isCollegeSpecific })}
                            />
                        </View>

                        {isOwner ? (
                            <Button block variant="danger" icon="trash-outline" title="Delete bootcamp" onPress={handleDeleteBootcamp} />
                        ) : null}
                    </View>
                </Sheet>

                <TicketsSheet
                    visible={ticketsModalVisible}
                    onClose={() => setTicketsModalVisible(false)}
                    subtitle={`${userRegistrations.length} active`}
                    data={userRegistrations}
                    renderItem={renderTicket}
                    emptyText="Bootcamps you join show up here."
                />

                <PassSheet
                    visible={qrModalVisible}
                    onClose={() => setQrModalVisible(false)}
                    title={(selectedReg?.eventId as any)?.eventName}
                    qrCode={selectedReg?.qrCode}
                    caption={user?.name}
                />

                <CollegePickerSheet visible={collegeModalVisible} onClose={() => setCollegeModalVisible(false)} onSelect={pickCollege} />
            </View>
        </View>
    );
}
