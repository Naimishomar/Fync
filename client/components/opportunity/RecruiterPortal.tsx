import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Alert,
  Linking,
  TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as Clipboard from 'expo-clipboard';

const RecruiterPortal = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState<'posts' | 'applicants' | 'shortlisted'>('posts');
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
    const [notifying, setNotifying] = useState(false);
    const [applicantSearchQuery, setApplicantSearchQuery] = useState("");

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [postsRes, appsRes] = await Promise.all([
                axios.get('/opportunity/recruiter/posts'),
                axios.get('/opportunity/recruiter/applications')
            ]);

            if (postsRes.data.success) setPosts(postsRes.data.data);
            if (appsRes.data.success) setApplications(appsRes.data.data);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to fetch portal data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleUpdateStatus = async (appId: string, status: string) => {
        try {
            const res = await axios.patch(`/opportunity/recruiter/application-status/${appId}`, { status });
            if (res.data.success) {
                setApplications(prev => prev.map(app => app._id === appId ? { ...app, status } : app));
            }
        } catch (error) {
            Alert.alert("Error", "Failed to update status.");
        }
    };

    const handleDeletePost = (id: string) => {
        Alert.alert("Delete Post", "Are you sure? All applications for this post will also be hidden.", [
            { text: "Cancel", style: 'cancel' },
            { text: "Delete", style: 'destructive', onPress: async () => {
                try {
                    await axios.delete(`/opportunity/delete/${id}`);
                    setPosts(prev => prev.filter(p => p._id !== id));
                } catch (e) { Alert.alert("Error", "Delete failed."); }
            }}
        ]);
    };

    const handleNotifyShortlisted = async () => {
        if (!selectedPostId) {
            return Alert.alert("Selection Required", "Please select a specific post from the 'My Posts' tab first to notify candidates for that role.");
        }

        const shortlistedCount = applications.filter(a => a.opportunity?._id === selectedPostId && a.status === 'shortlisted').length;
        if (shortlistedCount === 0) {
            return Alert.alert("No Candidates", "There are no shortlisted candidates for this post yet.");
        }

        Alert.alert(
            "Bulk Notify",
            `Send a notification to all ${shortlistedCount} shortlisted candidates?`,
            [
                { text: "Cancel", style: 'cancel' },
                { 
                    text: "Send Interview Invite", 
                    onPress: () => performNotify("Congratulations! You have been shortlisted. Please check your email/portal for the interview schedule.") 
                },
                { 
                    text: "Quick Update", 
                    onPress: () => performNotify("Your application is moving to the next stage. We will contact you soon.") 
                }
            ]
        );
    };

    const handleCopyEmails = async () => {
        const emails = filteredApplications
            .map(app => app.candidate?.email)
            .filter(email => !!email)
            .join(', ');
        
        if (!emails) {
            return Alert.alert("No Emails", "No shortlisted candidates with email addresses found for this role.");
        }

        await Clipboard.setStringAsync(emails);
        Alert.alert("Copied!", "All shortlisted emails have been copied to your clipboard. You can now paste them into Gmail or Outlook.");
    };

    const performNotify = async (message: string) => {
        setNotifying(true);
        try {
            await axios.post('/opportunity/recruiter/notify-shortlisted', { 
                opportunityId: selectedPostId,
                message 
            });
            Alert.alert("Success", "In-app notifications sent!");
        } catch (e) {
            Alert.alert("Error", "Failed to send notifications.");
        } finally {
            setNotifying(false);
        }
    };

    const renderPostItem = ({ item }: { item: any }) => (
        <View className="bg-white rounded-3xl m-4 p-5 shadow-sm border border-slate-100">
            <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1">
                    <Text className="text-zinc-900 text-lg font-black italic uppercase tracking-tighter">{item.title}</Text>
                    <Text className="text-pink-500 font-bold text-[10px] uppercase tracking-widest mt-1">{item.type} • {item.opportunityType}</Text>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity onPress={() => navigation.navigate('CreateOpportunity', { initialData: item })}>
                        <Ionicons name="create-outline" size={20} color="#6366f1" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeletePost(item._id)}>
                        <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>

            <View className="flex-row items-center justify-between mt-2 pt-4 border-t border-slate-50">
                <View className="flex-row items-center gap-4">
                    <View className="bg-slate-50 px-4 py-2 rounded-2xl items-center">
                        <Text className="text-zinc-900 font-black text-lg italic">{item.applicationCount || 0}</Text>
                        <Text className="text-slate-400 font-bold text-[8px] uppercase">Applicants</Text>
                    </View>
                </View>

                <TouchableOpacity 
                    onPress={() => {
                        setSelectedPostId(item._id);
                        setActiveTab('applicants');
                    }}
                    className="bg-zinc-900 px-6 py-3 rounded-2xl"
                >
                    <Text className="text-white font-black italic uppercase text-[10px] tracking-widest">Manage Outreach</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderApplicantItem = ({ item }: { item: any }) => (
        <View className="bg-white rounded-3xl m-4 p-5 shadow-sm border border-slate-100">
            <View className="flex-row items-center gap-4 mb-4">
                <Image source={{ uri: item.candidate?.avatar || 'https://via.placeholder.com/100' }} className="w-14 h-14 rounded-full" />
                <View className="flex-1">
                    <Text className="text-zinc-900 text-base font-black italic uppercase tracking-tighter">{item.candidate?.name}</Text>
                    <Text className="text-slate-500 text-[10px] font-bold uppercase">{item.candidate?.college} • {item.candidate?.graduationYear}</Text>
                </View>
                <View className={`px-3 py-1 rounded-full ${statusColors[item.status]?.bg || 'bg-slate-100'}`}>
                    <Text className={`text-[8px] font-black uppercase ${statusColors[item.status]?.text || 'text-slate-500'}`}>{item.status}</Text>
                </View>
            </View>

            <View className="bg-slate-50 p-3 rounded-2xl mb-4">
                <Text className="text-slate-400 text-[8px] font-bold uppercase mb-1">Applied For</Text>
                <Text className="text-zinc-700 font-bold text-xs" numberOfLines={1}>{item.opportunity?.title}</Text>
            </View>

            {item.coverLetter && (
                <View className="mb-4">
                   <Text className="text-slate-400 text-[8px] font-bold uppercase mb-1">Note / Pitch</Text>
                   <Text className="text-zinc-600 text-xs italic leading-4">{item.coverLetter}</Text>
                </View>
            )}

            <View className="flex-row gap-2">
                <TouchableOpacity 
                    onPress={() => item.resume && Linking.openURL(item.resume)}
                    className="flex-1 bg-slate-100 h-12 rounded-2xl items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="document-text-outline" size={16} color="#475569" />
                    <Text className="text-slate-700 font-black italic uppercase text-[10px]">Resume</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => {
                        const pdfUrl = `${axios.defaults.baseURL}/profile/resume/${item.candidate?._id}/pdf`;
                        Linking.openURL(pdfUrl);
                    }}
                    className="flex-1 bg-indigo-50 h-12 rounded-2xl items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="document-text-outline" size={16} color="#4f46e5" />
                    <Text className="text-indigo-600 font-black italic uppercase text-[10px]">Portfolio</Text>
                </TouchableOpacity>

                {item.status !== 'shortlisted' && activeTab === 'applicants' ? (
                    <TouchableOpacity 
                        onPress={() => {
                            Alert.alert("Update Status", "Move candidate to:", [
                                { text: "Shortlist", onPress: () => handleUpdateStatus(item._id, 'shortlisted') },
                                { text: "Reject", style: 'destructive', onPress: () => handleUpdateStatus(item._id, 'rejected') },
                                { text: "Close", style: 'cancel' }
                            ]);
                        }}
                        className="flex-1 bg-pink-500 h-12 rounded-2xl items-center justify-center"
                    >
                        <Text className="text-white font-black italic uppercase text-[10px]">Action</Text>
                    </TouchableOpacity>
                ) : (
                    activeTab === 'shortlisted' && (
                        <TouchableOpacity 
                            onPress={() => {
                                Alert.alert("Remove from Shortlist", "Are you sure you want to reject this candidate?", [
                                    { text: "Reject / Remove", style: 'destructive', onPress: () => handleUpdateStatus(item._id, 'rejected') },
                                    { text: "Keep Shortlisted", style: 'cancel' }
                                ]);
                            }}
                            className="flex-1 bg-zinc-900 h-12 rounded-2xl items-center justify-center border border-zinc-800"
                        >
                            <Text className="text-white font-black italic uppercase text-[10px]">Reject / Remove</Text>
                        </TouchableOpacity>
                    )
                )}
            </View>
        </View>
    );

    const filteredApplications = (activeTab === 'shortlisted'
        ? applications.filter(app => app.status === 'shortlisted' && (!selectedPostId || app.opportunity?._id === selectedPostId))
        : (selectedPostId 
            ? applications.filter(app => app.opportunity?._id === selectedPostId)
            : applications))
        .filter(app => 
            !applicantSearchQuery || 
            app.candidate?.name?.toLowerCase().includes(applicantSearchQuery.toLowerCase()) ||
            app.candidate?.username?.toLowerCase().includes(applicantSearchQuery.toLowerCase())
        );

    const currentData = activeTab === 'posts' ? posts : filteredApplications;

    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {/* Header */}
            <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-slate-100">
                <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 items-center justify-center rounded-full bg-slate-50">
                    <Ionicons name="chevron-back" size={24} color="black" />
                </TouchableOpacity>
                <View className="items-center">
                    <Text className="text-xl font-black italic uppercase tracking-tighter">Recruiter <Text className="text-pink-500">Portal</Text></Text>
                    <Text className="text-slate-400 text-[8px] font-bold tracking-[2px] uppercase">Admin Dashboard</Text>
                </View>
                <TouchableOpacity onPress={fetchData} className="w-10 h-10 items-center justify-center">
                    <Ionicons name="refresh" size={20} color="#ec4899" />
                </TouchableOpacity>
            </View>

            {/* Stats Overview */}
            <View className="bg-white px-6 pb-6 pt-2 border-b border-slate-100">
                 <View className="flex-row gap-3">
                    <View className="flex-1 bg-zinc-900 p-4 rounded-3xl">
                        <Text className="text-white text-[8px] font-black uppercase tracking-widest">Active Posts</Text>
                        <Text className="text-white text-2xl font-black italic mt-1">{posts.length}</Text>
                    </View>
                    <View className="flex-1 bg-pink-500 p-4 rounded-3xl">
                        <Text className="text-white text-[8px] font-black uppercase tracking-widest">New Applicants</Text>
                        <Text className="text-white text-2xl font-black italic mt-1">{applications.filter(a => a.status === 'applied').length}</Text>
                    </View>
                 </View>
            </View>

            {/* Tabs */}
            <View className="flex-row p-4 gap-4">
                <TouchableOpacity 
                    onPress={() => { setActiveTab('posts'); setSelectedPostId(null); }}
                    className={`flex-1 flex-row items-center justify-center h-12 rounded-2xl gap-2 ${activeTab === 'posts' ? 'bg-zinc-900' : 'bg-white border border-slate-100'}`}
                >
                    <Ionicons name="list" size={18} color={activeTab === 'posts' ? 'white' : '#64748b'} />
                    <Text className={`font-black italic uppercase text-[10px] ${activeTab === 'posts' ? 'text-white' : 'text-slate-500'}`}>My Posts</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('applicants')}
                    className={`flex-1 flex-row items-center justify-center h-12 rounded-2xl gap-2 ${activeTab === 'applicants' ? 'bg-zinc-900' : 'bg-white border border-slate-100'}`}
                >
                    <Ionicons name="people" size={18} color={activeTab === 'applicants' ? 'white' : '#64748b'} />
                    <Text className={`font-black italic uppercase text-[10px] ${activeTab === 'applicants' ? 'text-white' : 'text-slate-500'}`}>Applicants</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                    onPress={() => setActiveTab('shortlisted')}
                    className={`flex-1 flex-row items-center justify-center h-12 rounded-2xl gap-2 ${activeTab === 'shortlisted' ? 'bg-zinc-900' : 'bg-white border border-slate-100'}`}
                >
                    <Ionicons name="star" size={18} color={activeTab === 'shortlisted' ? 'white' : '#64748b'} />
                    <Text className={`font-black italic uppercase text-[10px] ${activeTab === 'shortlisted' ? 'text-white' : 'text-slate-500'}`}>Shortlist</Text>
                </TouchableOpacity>
            </View>

            {selectedPostId && (
                <View className="mx-6 mb-4 px-4 py-3 bg-pink-50 rounded-2xl border border-pink-100 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <Ionicons name="briefcase" size={16} color="#ec4899" />
                        <Text className="text-pink-600 text-[10px] font-black uppercase italic">
                            Managing: {posts.find(p => p._id === selectedPostId)?.title}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => setSelectedPostId(null)}>
                         <Ionicons name="close-circle" size={18} color="#ec4899" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Applicant Search Bar (Visible in Applicants/Shortlist tabs) */}
            {activeTab !== 'posts' && (
                <View className="px-6 mb-4">
                    <View className="flex-row items-center bg-white rounded-2xl px-5 py-3 border border-slate-100 shadow-sm shadow-black/5">
                        <Ionicons name="search" size={18} color="#ec4899" />
                        <TextInput 
                            placeholder="Find candidate by name..."
                            placeholderTextColor="#94a3b8"
                            value={applicantSearchQuery}
                            onChangeText={setApplicantSearchQuery}
                            className="flex-1 ml-3 text-zinc-900 font-bold italic text-xs"
                        />
                        {applicantSearchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setApplicantSearchQuery("")} className="bg-slate-50 p-1 rounded-full">
                                <Ionicons name="close" size={14} color="#94a3b8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            )}



            {(selectedPostId || activeTab === 'shortlisted') && (
                <View className="px-6 flex-row items-center justify-between mb-2">
                    <Text className="text-slate-400 text-[10px] font-bold italic uppercase">
                        {activeTab === 'shortlisted' ? 'Showing Shortlisted Candidates' : 'Filtering for specific post'}
                    </Text>
                    {selectedPostId && (
                        <TouchableOpacity onPress={() => setSelectedPostId(null)}>
                            <Text className="text-pink-500 text-[10px] font-black uppercase underline">Clear Post Filter</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color="#ec4899" />
                </View>
            ) : (
                <FlatList
                    data={currentData}
                    keyExtractor={(item) => item._id}
                    renderItem={activeTab === 'posts' ? renderPostItem : renderApplicantItem}
                    ListHeaderComponent={
                        activeTab === 'shortlisted' ? (
                            <View className="px-4 mb-4">
                                <TouchableOpacity 
                                    onPress={handleCopyEmails}
                                    className="bg-indigo-600 h-14 rounded-3xl flex-row items-center justify-center gap-3 shadow-lg shadow-indigo-200"
                                >
                                    <Ionicons name="copy-outline" size={20} color="white" />
                                    <Text className="text-white font-black italic uppercase text-xs tracking-widest">Copy All Emails</Text>
                                </TouchableOpacity>
                                
                                <View className="mt-4 p-4 bg-white rounded-2xl border border-slate-100">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-slate-400 font-black uppercase text-[8px] tracking-widest">Email List ({selectedPostId ? 'This Role' : 'Global Shortlist'})</Text>
                                        <Text className="text-slate-300 font-bold text-[8px] uppercase">{filteredApplications.filter(a => a.candidate?.email).length} Found</Text>
                                    </View>
                                    <View className="flex-row flex-wrap gap-2">
                                        {filteredApplications.map((app, idx) => (
                                            app.candidate?.email && (
                                                <View key={idx} className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                                                    <Text className="text-slate-600 font-bold text-[10px]">{app.candidate.email}</Text>
                                                </View>
                                            )
                                        ))}
                                    </View>
                                </View>
                            </View>
                        ) : null
                    }
                    contentContainerStyle={{ paddingBottom: 100 }}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
                    ListEmptyComponent={
                        <View className="items-center justify-center py-20 px-10">
                            <Ionicons name="file-tray-outline" size={60} color="#cbd5e1" />
                            <Text className="text-slate-400 font-black italic uppercase text-center mt-4">Nothing to show yet</Text>
                            <Text className="text-slate-300 text-[10px] text-center mt-2 px-10">When you post opportunities or receive applications, they will appear here.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
};

const statusColors: any = {
    applied: { bg: 'bg-blue-50', text: 'text-blue-500' },
    shortlisted: { bg: 'bg-emerald-50', text: 'text-emerald-500' },
    rejected: { bg: 'bg-rose-50', text: 'text-rose-500' },
    reviewing: { bg: 'bg-amber-50', text: 'text-amber-500' },
};

export default RecruiterPortal;
