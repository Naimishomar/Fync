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
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as Clipboard from 'expo-clipboard';

/**
 * view: 'posts'        → My Posts list (default)
 * view: 'applicants'   → Applicants for selectedPost
 * view: 'shortlisted'  → Shortlisted for selectedPost
 */
type PortalView = 'posts' | 'applicants' | 'shortlisted';

const RecruiterPortal = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [view, setView] = useState<PortalView>('posts');
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedPosts, setExpandedPosts] = useState<{ [key: string]: boolean }>({});

    // ─── Data fetching ────────────────────────────────────────────────────
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [postsRes, appsRes] = await Promise.all([
                axios.get('/opportunity/recruiter/posts'),
                axios.get('/opportunity/recruiter/applications'),
            ]);
            if (postsRes.data.success) setPosts(postsRes.data.data);
            if (appsRes.data.success) setApplications(appsRes.data.data);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch portal data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Helpers ────────────────────────────────────────────────────────
    const openView = (post: any, target: PortalView) => {
        setSelectedPost(post);
        setSearchQuery('');
        setView(target);
    };

    const toggleExpand = (id: string) => {
        setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const goBack = () => {
        setView('posts');
        setSelectedPost(null);
        setSearchQuery('');
    };

    const handleUpdateStatus = async (appId: string, status: string) => {
        try {
            const res = await axios.patch(`/opportunity/recruiter/application-status/${appId}`, { status });
            if (res.data.success) {
                setApplications(prev => prev.map(a => a._id === appId ? { ...a, status } : a));
            }
        } catch {
            Alert.alert('Error', 'Failed to update status.');
        }
    };

    const handleDeletePost = (id: string) => {
        Alert.alert('Delete Post', 'Are you sure? All applications for this post will also be hidden.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await axios.delete(`/opportunity/delete/${id}`);
                        setPosts(prev => prev.filter(p => p._id !== id));
                        if (selectedPost?._id === id) goBack();
                    } catch { Alert.alert('Error', 'Delete failed.'); }
                }
            },
        ]);
    };

    const handleToggleActive = (item: any) => {
        const next = !item.isActive;
        Alert.alert(
            next ? 'Activate Post' : 'Pause Post',
            next
                ? `"${item.title}" will be visible to students and accept new applications.`
                : `"${item.title}" will be hidden from students. Existing applications are preserved.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: next ? 'Activate' : 'Pause',
                    style: next ? 'default' : 'destructive',
                    onPress: async () => {
                        try {
                            await axios.patch(`/opportunity/update/${item._id}`, { isActive: next });
                            setPosts(prev => prev.map(p =>
                                p._id === item._id ? { ...p, isActive: next } : p
                            ));
                        } catch {
                            Alert.alert('Error', 'Failed to update post status.');
                        }
                    },
                },
            ]
        );
    };

    const handleCopyEmails = async () => {
        const emails = visibleApplications
            .map(a => a.candidate?.email)
            .filter(Boolean)
            .join(', ');
        if (!emails) return Alert.alert('No Emails', 'No candidates with email addresses found.');
        await Clipboard.setStringAsync(emails);
        Alert.alert('Copied!', 'All emails copied to clipboard.');
    };

    const handleOpenGmail = () => {
        const bccEmails = visibleApplications
            .map(a => a.candidate?.email)
            .filter(Boolean)
            .join(',');
        if (!bccEmails) return Alert.alert('No Emails', 'No shortlisted candidates with email addresses found.');
        const subject = encodeURIComponent(`Next Steps — ${selectedPost?.title || 'Your Application'}`);
        const body = encodeURIComponent(
            `Dear Candidate,\n\nCongratulations! You have been shortlisted for the role of ${selectedPost?.title || 'the position'}.\n\nWe will reach out shortly with further details.\n\nBest regards,\n${user?.name || user?.company || 'The Recruiter'}`
        );
        const mailtoUrl = `mailto:?bcc=${encodeURIComponent(bccEmails)}&subject=${subject}&body=${body}`;
        Linking.openURL(mailtoUrl).catch(() =>
            Alert.alert('Error', 'Could not open mail app. Please make sure a mail app is installed.')
        );
    };

    const handleNotifyShortlisted = () => {
        const count = visibleApplications.length;
        if (count === 0) return Alert.alert('No Candidates', 'No shortlisted candidates for this post yet.');
        Alert.alert(
            'Bulk Notify',
            `Send an in-app notification to all ${count} shortlisted candidates for this post?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send Notification',
                    onPress: () => performNotify('Your application is moving to the next stage. We will contact you soon.'),
                },
            ]
        );
    };

    const performNotify = async (message: string) => {
        try {
            await axios.post('/opportunity/recruiter/notify-shortlisted', {
                opportunityId: selectedPost?._id,
                message,
            });
            Alert.alert('Success', 'In-app notifications sent!');
        } catch {
            Alert.alert('Error', 'Failed to send notifications.');
        }
    };

    // ─── Derived data ────────────────────────────────────────────────────
    const visibleApplications = applications
        .filter(a => a.opportunity?._id === selectedPost?._id)
        .filter(a => view === 'shortlisted' ? a.status === 'shortlisted' : true)
        .filter(a =>
            !searchQuery ||
            a.candidate?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.candidate?.username?.toLowerCase().includes(searchQuery.toLowerCase())
        );

    // ─── Renderers – Post card ───────────────────────────────────────────
    const renderPostCard = ({ item }: { item: any }) => {
        const appliedCount = applications.filter(a => a.opportunity?._id === item._id).length;
        const shortlistCount = applications.filter(a => a.opportunity?._id === item._id && a.status === 'shortlisted').length;
        const isActive = item.isActive !== false; // default true if undefined

        return (
            <View className={`rounded-3xl mx-4 mb-4 p-5 shadow-sm border ${isActive ? 'bg-white border-slate-100' : 'bg-slate-50 border-slate-200'
                }`}>
                {/* Title row */}
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 mr-3">
                        <Text className={`text-lg font-black  uppercase tracking-tighter ${isActive ? 'text-zinc-900' : 'text-slate-400'
                            }`} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text className="text-pink-500 font-bold text-[10px] uppercase tracking-widest mt-1">
                            {item.type} • {item.opportunityType}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        {/* Status Toggle Switch */}
                        <TouchableOpacity
                            onPress={() => handleToggleActive(item)}
                            activeOpacity={0.8}
                            className={`w-10 h-5.5 rounded-full justify-center ${isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                }`}
                        >
                            <View style={{
                                width: 17,
                                height: 17,
                                borderRadius: 9,
                                backgroundColor: 'white',
                                alignSelf: isActive ? 'flex-end' : 'flex-start',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 1 },
                                shadowOpacity: 0.1,
                                shadowRadius: 1,
                                elevation: 2
                            }} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('CreateOpportunity', { initialData: item })}>
                            <Ionicons name="create-outline" size={20} color="#6366f1" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePost(item._id)}>
                            <Ionicons name="trash-outline" size={20} color="#ef4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats row */}
                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1 bg-slate-50 rounded-2xl p-3 items-center">
                        <Text className="text-zinc-900 text-xl font-black ">{appliedCount}</Text>
                        <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest mt-0.5">Applied</Text>
                    </View>
                    <View className="flex-1 bg-emerald-50 rounded-2xl p-3 items-center">
                        <Text className="text-emerald-600 text-xl font-black ">{shortlistCount}</Text>
                        <Text className="text-emerald-400 text-[8px] font-black uppercase tracking-widest mt-0.5">Shortlisted</Text>
                    </View>
                </View>

                {/* Description snippet */}
                {item.description && (
                    <View className="mb-4 bg-slate-50/50 p-4 rounded-2xl border border-dashed border-slate-200">
                        <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">Description</Text>
                            {item.description.length > 60 && (
                                <TouchableOpacity onPress={() => toggleExpand(item._id)}>
                                    <Text className="text-pink-500 text-[9px] font-black uppercase ">
                                        {expandedPosts[item._id] ? 'Show Less' : 'Show More'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text
                            className="text-zinc-600 text-[11px]  leading-5"
                            numberOfLines={expandedPosts[item._id] ? undefined : 3}
                        >
                            {item.description}
                        </Text>
                    </View>
                )}

                {/* Paused notice */}
                {!isActive && (
                    <View className="flex-row items-center gap-2 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2.5 mb-3">
                        <Ionicons name="pause-circle-outline" size={16} color="#f59e0b" />
                        <Text className="text-amber-600 text-[10px] font-black uppercase tracking-wide">
                            This post is inactive — not visible to students
                        </Text>
                    </View>
                )}

                {/* Action buttons */}
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => openView(item, 'applicants')}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-zinc-900 h-12 rounded-2xl"
                    >
                        <Ionicons name="people-outline" size={15} color="white" />
                        <Text className="text-white font-black  uppercase text-[10px] tracking-wide">Applicants</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => openView(item, 'shortlisted')}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-blue-500 h-12 rounded-2xl"
                    >
                        <Ionicons name="star-outline" size={15} color="white" />
                        <Text className="text-white font-black  uppercase text-[10px] tracking-wide">Shortlist</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // ─── Renderer – Applicant card ───────────────────────────────────────
    const renderApplicantCard = ({ item }: { item: any }) => (
        <View className="bg-white rounded-3xl mx-4 mb-4 p-5 shadow-sm border border-slate-100">
            {/* Candidate info */}
            <View className="flex-row items-center gap-4 mb-4">
                <Image
                    source={{ uri: item.candidate?.avatar || 'https://via.placeholder.com/100' }}
                    className="w-14 h-14 rounded-full"
                />
                <View className="flex-1">
                    <Text className="text-zinc-900 text-base font-black  uppercase tracking-tighter">
                        {item.candidate?.name}
                    </Text>
                    <Text className="text-slate-500 text-[10px] font-bold uppercase">
                        {item.candidate?.college}
                    </Text>
                    {item.candidate?.year && (
                        <Text className="text-slate-400 text-[10px]">Year {item.candidate.year}</Text>
                    )}
                </View>
                <View className={`px-3 py-1.5 rounded-full ${statusColors[item.status]?.bg || 'bg-slate-100'}`}>
                    <Text className={`text-[8px] font-black uppercase ${statusColors[item.status]?.text || 'text-slate-500'}`}>
                        {item.status}
                    </Text>
                </View>
            </View>
            
            {/* GitHub Stats Preview (NEW) */}
            {item.candidate?.githubUsername && (
                <View className="mb-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                             <Ionicons name="logo-github" size={16} color="#18181b" />
                             <Text className="text-zinc-900 font-black uppercase text-[10px] tracking-widest">GitHub Stats Preview</Text>
                        </View>
                        <View className="bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            <Text className="text-emerald-600 font-black text-[8px] uppercase">Verified</Text>
                        </View>
                    </View>
                    
                    <View className="flex-row gap-2">
                         <View className="flex-1 bg-white p-2 rounded-xl border border-slate-50 items-center">
                             <Text className="text-zinc-900 font-black text-xs">{item.candidate.githubStats?.totalCommits || 0}</Text>
                             <Text className="text-slate-400 text-[6px] font-black uppercase tracking-tighter">Commits</Text>
                         </View>
                         <View className="flex-1 bg-white p-2 rounded-xl border border-slate-50 items-center">
                             <Text className="text-zinc-900 font-black text-xs">{item.candidate.githubStats?.totalStars || 0}</Text>
                             <Text className="text-slate-400 text-[6px] font-black uppercase tracking-tighter">Stars</Text>
                         </View>
                         <View className="flex-1 bg-white p-2 rounded-xl border border-slate-50 items-center">
                             <Text className="text-zinc-900 font-black text-xs">{item.candidate.githubStats?.contributionStreak || 0}d</Text>
                             <Text className="text-slate-400 text-[6px] font-black uppercase tracking-tighter">Streak</Text>
                         </View>
                    </View>

                    <TouchableOpacity 
                        onPress={() => Linking.openURL(`https://github.com/${item.candidate.githubUsername}`)}
                        className="mt-3 flex-row items-center justify-center gap-1.5"
                    >
                         <Text className="text-zinc-400 font-black uppercase text-[8px] tracking-widest">View Repo Analysis</Text>
                         <Ionicons name="arrow-forward" size={10} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Cover letter / pitch */}
            {item.coverLetter ? (
                <View className="bg-slate-50 p-3 rounded-2xl mb-4">
                    <Text className="text-slate-400 text-[8px] font-bold uppercase mb-1">Note / Pitch</Text>
                    <Text className="text-zinc-600 text-xs  leading-4" numberOfLines={3}>
                        {item.coverLetter}
                    </Text>
                </View>
            ) : null}

            {/* Action row */}
            <View className="flex-row gap-2">
                <TouchableOpacity
                    onPress={() => item.resume && Linking.openURL(item.resume)}
                    className="flex-1 bg-slate-100 h-12 rounded-2xl items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="document-text-outline" size={15} color="#475569" />
                    <Text className="text-slate-700 font-black  uppercase text-[10px]">Resume</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        const pdfUrl = `${axios.defaults.baseURL}/profile/resume/${item.candidate?._id}/pdf`;
                        Linking.openURL(pdfUrl);
                    }}
                    className="flex-1 bg-indigo-50 h-12 rounded-2xl items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="person-outline" size={15} color="#4f46e5" />
                    <Text className="text-indigo-600 font-black  uppercase text-[10px]">Portfolio</Text>
                </TouchableOpacity>

                {/* Status action */}
                {view === 'applicants' ? (
                    item.status === 'rejected' ? (
                        // Rejected → show Approve to re-shortlist
                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert('Re-approve Candidate', 'Move this candidate back to shortlisted?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Shortlist ⭐', onPress: () => handleUpdateStatus(item._id, 'shortlisted') },
                                ])
                            }
                            className="flex-1 bg-emerald-500 h-12 rounded-2xl items-center justify-center flex-row gap-1"
                        >
                            <Ionicons name="checkmark-circle-outline" size={15} color="white" />
                            <Text className="text-white font-black  uppercase text-[10px]">Approve</Text>
                        </TouchableOpacity>
                    ) : item.status !== 'shortlisted' ? (
                        // Pending / reviewing → Shortlist or Reject
                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert('Update Status', 'Move candidate to:', [
                                    { text: 'Shortlist ⭐', onPress: () => handleUpdateStatus(item._id, 'shortlisted') },
                                    { text: 'Reject ✕', style: 'destructive', onPress: () => handleUpdateStatus(item._id, 'rejected') },
                                    { text: 'Close', style: 'cancel' },
                                ])
                            }
                            className="flex-1 bg-pink-500 h-12 rounded-2xl items-center justify-center"
                        >
                            <Text className="text-white font-black  uppercase text-[10px]">Action</Text>
                        </TouchableOpacity>
                    ) : null
                ) : view === 'shortlisted' ? (
                    <TouchableOpacity
                        onPress={() =>
                            Alert.alert('Remove from Shortlist', 'Reject this candidate?', [
                                { text: 'Reject / Remove', style: 'destructive', onPress: () => handleUpdateStatus(item._id, 'rejected') },
                                { text: 'Keep', style: 'cancel' },
                            ])
                        }
                        className="flex-1 bg-zinc-900 h-12 rounded-2xl items-center justify-center"
                    >
                        <Text className="text-white font-black  uppercase text-[10px]">Remove</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );

    // ─── Sub-view header (Applicants / Shortlisted) ───────────────────────
    const renderSubHeader = () => (
        <View className="bg-white border-b border-slate-100">
            {/* Back + title */}
            <View className="px-4 pt-3 pb-3 flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={goBack}
                    className="w-9 h-9 bg-slate-100 rounded-full items-center justify-center"
                >
                    <Ionicons name="arrow-back" size={18} color="#0f172a" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-zinc-900 text-sm font-black  uppercase tracking-tighter" numberOfLines={1}>
                        {selectedPost?.title}
                    </Text>
                    <Text className="text-pink-500 text-[9px] font-black uppercase tracking-widest">
                        {view === 'shortlisted' ? '⭐ Shortlisted Candidates' : '👥 All Applicants'}
                    </Text>
                </View>
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleCopyEmails}
                        className="flex-row items-center gap-1.5 bg-indigo-600 px-3 py-2 rounded-xl"
                    >
                        <Ionicons name="copy-outline" size={13} color="white" />
                        <Text className="text-white font-black  uppercase text-[9px]">Copy</Text>
                    </TouchableOpacity>
                )}
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleOpenGmail}
                        className="flex-row items-center gap-1.5 bg-red-500 px-3 py-2 rounded-xl"
                    >
                        <Ionicons name="mail-outline" size={13} color="white" />
                        <Text className="text-white font-black  uppercase text-[9px]">Gmail</Text>
                    </TouchableOpacity>
                )}
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleNotifyShortlisted}
                        className="flex-row items-center gap-1.5 bg-pink-500 px-3 py-2 rounded-xl"
                    >
                        <Ionicons name="notifications-outline" size={13} color="white" />
                        <Text className="text-white font-black  uppercase text-[9px]">Notify</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Count badge */}
            <View className="flex-row items-center gap-2 px-4 pb-3">
                <View className={`px-3 py-1 rounded-full ${view === 'shortlisted' ? 'bg-emerald-100' : 'bg-zinc-100'}`}>
                    <Text className={`text-[10px] font-black uppercase ${view === 'shortlisted' ? 'text-emerald-600' : 'text-zinc-600'}`}>
                        {visibleApplications.length} {view === 'shortlisted' ? 'shortlisted' : 'applicant(s)'}
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View className="px-4 pb-3">
                <View className="flex-row items-center bg-slate-50 rounded-2xl px-4 py-2.5 border border-slate-100">
                    <Ionicons name="search" size={15} color="#ec4899" />
                    <TextInput
                        placeholder="Search by name..."
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="flex-1 ml-2 text-zinc-900 font-bold  text-xs"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} className="bg-slate-200 p-1 rounded-full">
                            <Ionicons name="close" size={12} color="#94a3b8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </View>
    );

    // ─── Main header ─────────────────────────────────────────────────────
    const renderMainHeader = () => (
        <>
            {/* Top bar */}
            <View className="px-6 pb-4 flex-row items-center justify-between border-b border-slate-100">
                <View>
                    <Text className="text-2xl font-black  uppercase tracking-tighter">
                        Recruiter <Text className="text-pink-500">Portal</Text>
                    </Text>
                    <Text className="text-slate-400 text-[8px] font-bold tracking-[2px] uppercase">
                        Applicant Tracking
                    </Text>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Notification')}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <Ionicons name="notifications-outline" size={25} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={fetchData} className="w-10 h-10 items-center justify-center">
                        <Ionicons name="refresh" size={25} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats */}
            <View className="px-5 pb-5 pt-3 border-b border-slate-100">
                <View className="flex-row gap-3">
                    <View className="flex-1 bg-zinc-900 p-4 rounded-2xl items-center">
                        <Text className="text-white text-[8px] font-black uppercase tracking-widest">Active Posts</Text>
                        <Text className="text-white text-2xl font-black  mt-1">{posts.length}</Text>
                    </View>
                    <View className="flex-1 bg-black p-4 rounded-2xl items-center">
                        <Text className="text-white text-[8px] font-black uppercase tracking-widest">New Applicants</Text>
                        <Text className="text-white text-2xl font-black  mt-1">
                            {applications.filter(a => a.status === 'applied').length}
                        </Text>
                    </View>
                    <View className="flex-1 bg-black p-4 rounded-2xl items-center">
                        <Text className="text-white text-[8px] font-black uppercase tracking-widest">Shortlisted</Text>
                        <Text className="text-white text-2xl font-black  mt-1">
                            {applications.filter(a => a.status === 'shortlisted').length}
                        </Text>
                    </View>
                </View>

            </View>

            {/* Quick Access Opportunities */}
            <View className="flex-row px-5 pt-3 gap-3">
                <TouchableOpacity
                    onPress={() => navigation.navigate('InternshipList')}
                    activeOpacity={0.7}
                    className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 flex-row items-center gap-3 shadow-sm"
                >
                    <View className="w-10 h-10 bg-indigo-50 rounded-2xl items-center justify-center">
                        <Ionicons name="school-outline" size={20} color="#6366f1" />
                    </View>
                    <View>
                        <Text className="text-zinc-900 font-black  uppercase text-[10px]">Internships</Text>
                        <Text className="text-slate-400 text-[8px] font-bold">Hiring</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => navigation.navigate('JobList')}
                    activeOpacity={0.7}
                    className="flex-1 bg-white p-4 rounded-3xl border border-slate-100 flex-row items-center gap-3 shadow-sm"
                >
                    <View className="w-10 h-10 bg-pink-50 rounded-2xl items-center justify-center">
                        <Ionicons name="business-outline" size={20} color="#ec4899" />
                    </View>
                    <View>
                        <Text className="text-zinc-900 font-black  uppercase text-[10px]">Jobs</Text>
                        <Text className="text-slate-400 text-[8px] font-bold">Full-time</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Section label */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <Text className="text-slate-400 text-[8px] font-black uppercase tracking-widest">My Posts</Text>
                <Text className="text-slate-300 text-[8px] font-bold">{posts.length} active</Text>
            </View>
        </>
    );

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-[#F8FAFC]">
            {view === 'posts' ? (
                <>
                    {renderMainHeader()}
                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#ec4899" />
                        </View>
                    ) : (
                        <FlatList
                            data={posts}
                            keyExtractor={item => item._id}
                            renderItem={renderPostCard}
                            contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
                            ListEmptyComponent={
                                <View className="items-center justify-center py-24 px-10">
                                    <Ionicons name="file-tray-outline" size={60} color="#cbd5e1" />
                                    <Text className="text-slate-400 font-black  uppercase text-center mt-4">
                                        No posts yet
                                    </Text>
                                    <Text className="text-slate-300 text-[10px] text-center mt-2">
                                        Tap "Post New Opportunity" above to create your first listing.
                                    </Text>
                                </View>
                            }
                        />
                    )}
                </>
            ) : (
                <>
                    {renderSubHeader()}
                    <FlatList
                        data={visibleApplications}
                        keyExtractor={item => item._id}
                        renderItem={renderApplicantCard}
                        contentContainerStyle={{ paddingTop: 12, paddingBottom: 120 }}
                        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
                        ListEmptyComponent={
                            <View className="items-center justify-center py-24 px-10">
                                <Ionicons
                                    name={view === 'shortlisted' ? 'star-outline' : 'people-outline'}
                                    size={60}
                                    color="#cbd5e1"
                                />
                                <Text className="text-slate-400 font-black  uppercase text-center mt-4">
                                    {view === 'shortlisted' ? 'No shortlisted candidates' : 'No applicants yet'}
                                </Text>
                                <Text className="text-slate-300 text-[10px] text-center mt-2">
                                    {view === 'shortlisted'
                                        ? 'Shortlist candidates from the Applicants view.'
                                        : 'Applications will appear here once students apply.'}
                                </Text>
                            </View>
                        }
                    />
                </>
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
