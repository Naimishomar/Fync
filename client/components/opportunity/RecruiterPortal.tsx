import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView, RefreshControl, Linking, TextInput} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import * as Clipboard from 'expo-clipboard';
import { Alert } from '../ui/AlertModal';

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
            <View className={`rounded-card mx-4 mb-4 p-5 shadow-hair border ${isActive ? 'bg-card border-line' : 'bg-paper-2 border-line' }`}>
                {/* Title row */}
                <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 mr-3">
                        <Text className={`text-lg font-display uppercase ${isActive ? 'text-ink' : 'text-ink-3' }`} numberOfLines={2}>
                            {item.title}
                        </Text>
                        <Text className="text-accent-text font-semibold text-label uppercase mt-1">
                            {item.type} • {item.opportunityType}
                        </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                        {/* Status Toggle Switch */}
                        <TouchableOpacity
                            onPress={() => handleToggleActive(item)}
                            activeOpacity={0.8}
                            className={`w-10 h-5.5 rounded-full justify-center ${isActive ? 'bg-success' : 'bg-paper-2' }`}
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
                            <Ionicons name="create-outline" size={20} color="#4F46E5" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePost(item._id)}>
                            <Ionicons name="trash-outline" size={20} color="#DC2626" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Stats row */}
                <View className="flex-row gap-3 mb-4">
                    <View className="flex-1 bg-paper rounded-card p-3 items-center">
                        <Text className="text-ink text-xl font-display">{appliedCount}</Text>
                        <Text className="text-ink-3 text-label font-display uppercase mt-0.5">Applied</Text>
                    </View>
                    <View className="flex-1 bg-success/10 rounded-card p-3 items-center">
                        <Text className="text-success text-xl font-display">{shortlistCount}</Text>
                        <Text className="text-success text-label font-display uppercase mt-0.5">Shortlisted</Text>
                    </View>
                </View>

                {/* Description snippet */}
                {item.description && (
                    <View className="mb-4 bg-paper-2/50 p-4 rounded-card border border-dashed border-line">
                        <View className="flex-row justify-between items-center mb-1.5">
                            <Text className="text-ink-3 text-label font-display uppercase">Description</Text>
                            {item.description.length > 60 && (
                                <TouchableOpacity onPress={() => toggleExpand(item._id)}>
                                    <Text className="text-accent-text text-label font-display uppercase">
                                        {expandedPosts[item._id] ? 'Show Less' : 'Show More'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text
                            className="text-ink-2 text-label leading-5"
                            numberOfLines={expandedPosts[item._id] ? undefined : 3}
                        >
                            {item.description}
                        </Text>
                    </View>
                )}

                {/* Paused notice */}
                {!isActive && (
                    <View className="flex-row items-center gap-2 bg-warning/10 border border-warning/15 rounded-card px-4 py-2.5 mb-3">
                        <Ionicons name="pause-circle-outline" size={16} color="#B45309" />
                        <Text className="text-warning text-label font-display uppercase">
                            This post is inactive — not visible to students
                        </Text>
                    </View>
                )}

                {/* Action buttons */}
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        onPress={() => openView(item, 'applicants')}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-ink h-12 rounded-card"
                    >
                        <Ionicons name="people-outline" size={15} color="white" />
                        <Text className="text-white font-display uppercase text-label">Applicants</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => openView(item, 'shortlisted')}
                        className="flex-1 flex-row items-center justify-center gap-2 bg-fam-career h-12 rounded-card"
                    >
                        <Ionicons name="star-outline" size={15} color="white" />
                        <Text className="text-white font-display uppercase text-label">Shortlist</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    // ─── Renderer – Applicant card ───────────────────────────────────────
    const renderApplicantCard = ({ item, index }: { item: any; index: number }) => (
        <View
            className={`bg-card rounded-card mx-4 mb-4 p-card-pad ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}
            style={index === 0 ? { shadowColor: '#12100E', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 4, height: 4 }, elevation: 0 } : undefined}
        >
            {/* Candidate info */}
            <View className="flex-row items-center gap-4 mb-4">
                <Image
                    source={{ uri: item.candidate?.avatar || 'https://via.placeholder.com/100' }}
                    className="w-14 h-14 rounded-full"
                />
                <View className="flex-1">
                    <Text className="text-ink text-base font-display uppercase">
                        {item.candidate?.name}
                    </Text>
                    <Text className="text-ink-3 text-label font-semibold uppercase">
                        {item.candidate?.college}
                    </Text>
                    {item.candidate?.year && (
                        <Text className="text-ink-3 text-label">Year {item.candidate.year}</Text>
                    )}
                </View>
                <View className={`px-3 py-1.5 rounded-full ${statusColors[item.status]?.bg || 'bg-paper-2'}`}>
                    <Text className={`text-label font-display uppercase ${statusColors[item.status]?.text || 'text-ink-3'}`}>
                        {item.status}
                    </Text>
                </View>
            </View>
            
            {/* GitHub Stats Preview (NEW) */}
            {item.candidate?.githubUsername && (
                <View className="mb-4 bg-paper-2 p-4 rounded-card border border-line">
                    <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-2">
                             <Ionicons name="logo-github" size={16} color="#12100E" />
                             <Text className="text-ink font-display uppercase text-label">GitHub Stats Preview</Text>
                        </View>
                        <View className="bg-success/10 border border-success/20 px-2.5 py-1 rounded-full">
                            <Text className="text-success font-display text-label uppercase">Verified</Text>
                        </View>
                    </View>
                    
                    <View className="flex-row gap-2">
                         <View className="flex-1 bg-paper p-2 border border-line items-center rounded-md">
                             <Text className="text-ink font-display text-xs">{item.candidate.githubStats?.totalCommits || 0}</Text>
                             <Text className="text-ink-3 text-label font-display uppercase">Commits</Text>
                         </View>
                         <View className="flex-1 bg-paper p-2 border border-line items-center rounded-md">
                             <Text className="text-ink font-display text-xs">{item.candidate.githubStats?.totalStars || 0}</Text>
                             <Text className="text-ink-3 text-label font-display uppercase">Stars</Text>
                         </View>
                         <View className="flex-1 bg-paper p-2 border border-line items-center rounded-md">
                             <Text className="text-ink font-display text-xs">{item.candidate.githubStats?.contributionStreak || 0}d</Text>
                             <Text className="text-ink-3 text-label font-display uppercase">Streak</Text>
                         </View>
                    </View>

                    <TouchableOpacity 
                        onPress={() => Linking.openURL(`https://github.com/${item.candidate.githubUsername}`)}
                        className="mt-3 flex-row items-center justify-center gap-1.5"
                    >
                         <Text className="text-ink-3 font-display uppercase text-label">View Repo Analysis</Text>
                         <Ionicons name="arrow-forward" size={10} color="#8B857E" />
                    </TouchableOpacity>
                </View>
            )}

            {/* Cover letter / pitch */}
            {item.coverLetter ? (
                <View className="bg-paper-2 p-3 rounded-card mb-4">
                    <View className="flex-row items-center mt-6 mb-1" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-semibold uppercase">Note / Pitch</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>
                    <Text className="text-ink-2 text-xs leading-4" numberOfLines={3}>
                        {item.coverLetter}
                    </Text>
                </View>
            ) : null}

            {/* Action row */}
            <View className="flex-row gap-2">
                <TouchableOpacity
                    onPress={() => item.resume && Linking.openURL(item.resume)}
                    className="flex-1 bg-paper-2 h-12 rounded-card items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="document-text-outline" size={15} color="#57534E" />
                    <Text className="text-ink-2 font-display uppercase text-label">Resume</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        const pdfUrl = `${axios.defaults.baseURL}/profile/resume/${item.candidate?._id}/pdf`;
                        Linking.openURL(pdfUrl);
                    }}
                    className="flex-1 bg-recruiter/10 h-12 rounded-card items-center justify-center flex-row gap-2"
                >
                    <Ionicons name="person-outline" size={15} color="#4F46E5" />
                    <Text className="text-recruiter font-display uppercase text-label">Portfolio</Text>
                </TouchableOpacity>

                {/* Status action */}
                {view === 'applicants' ? (
                    item.status === 'rejected' ? (
                        // Rejected → show Approve to re-shortlist
                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert('Re-approve Candidate', 'Move this candidate back to shortlisted?', [
                                    { text: 'Cancel', style: 'cancel' },
                                    { text: 'Shortlist', onPress: () => handleUpdateStatus(item._id, 'shortlisted') },
                                ])
                            }
                            className="flex-1 bg-success h-12 rounded-card items-center justify-center flex-row gap-1"
                        >
                            <Ionicons name="checkmark-circle-outline" size={15} color="white" />
                            <Text className="text-white font-display uppercase text-label">Approve</Text>
                        </TouchableOpacity>
                    ) : item.status !== 'shortlisted' ? (
                        // Pending / reviewing → Shortlist or Reject
                        <TouchableOpacity
                            onPress={() =>
                                Alert.alert('Update Status', 'Move candidate to:', [
                                    { text: 'Shortlist', onPress: () => handleUpdateStatus(item._id, 'shortlisted') },
                                    { text: 'Reject', style: 'destructive', onPress: () => handleUpdateStatus(item._id, 'rejected') },
                                    { text: 'Close', style: 'cancel' },
                                ])
                            }
                            className="flex-1 bg-brand-500 h-12 rounded-card items-center justify-center"
                        >
                            <Text className="text-ink font-display uppercase text-label">Action</Text>
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
                        className="flex-1 bg-ink h-12 rounded-card items-center justify-center"
                    >
                        <Text className="text-white font-display uppercase text-label">Remove</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );

    // ─── Sub-view header (Applicants / Shortlisted) ───────────────────────
    const renderSubHeader = () => (
        <View className="bg-card border-b border-line">
            {/* Back + title */}
            <View className="px-4 pt-3 pb-3 flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={goBack}
                    className="w-9 h-9 bg-paper-2 rounded-full items-center justify-center"
                 hitSlop={4}>
                    <Ionicons name="arrow-back" size={18} color="#12100E" />
                </TouchableOpacity>
                <View className="flex-1">
                    <Text className="text-ink text-sm font-display uppercase" numberOfLines={1}>
                        {selectedPost?.title}
                    </Text>
                    <Text className="text-accent-text text-label font-display uppercase">
                        {view === 'shortlisted' ? 'Shortlisted Candidates' : ' All Applicants'}
                    </Text>
                </View>
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleCopyEmails}
                        className="flex-row items-center gap-1.5 bg-recruiter px-3 py-2 rounded-xl"
                    >
                        <Ionicons name="copy-outline" size={13} color="white" />
                        <Text className="text-white font-display uppercase text-label">Copy</Text>
                    </TouchableOpacity>
                )}
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleOpenGmail}
                        className="flex-row items-center gap-1.5 bg-danger px-3 py-2 rounded-xl"
                    >
                        <Ionicons name="mail-outline" size={13} color="white" />
                        <Text className="text-white font-display uppercase text-label">Gmail</Text>
                    </TouchableOpacity>
                )}
                {view === 'shortlisted' && (
                    <TouchableOpacity
                        onPress={handleNotifyShortlisted}
                        className="flex-row items-center gap-1.5 bg-brand-500 px-3 py-2 border-2 border-ink rounded-md"
                    >
                        <Ionicons name="notifications-outline" size={13} color="#12100E" />
                        <Text className="text-ink font-display uppercase text-label">Notify</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Count badge */}
            <View className="flex-row items-center gap-2 px-4 pb-3">
                <View className={`px-3 py-1 rounded-full ${view === 'shortlisted' ? 'bg-success/15' : 'bg-paper-2'}`}>
                    <Text className={`text-label font-display uppercase ${view === 'shortlisted' ? 'text-success' : 'text-ink-2'}`}>
                        {visibleApplications.length} {view === 'shortlisted' ? 'shortlisted' : 'applicant(s)'}
                    </Text>
                </View>
            </View>

            {/* Search */}
            <View className="px-4 pb-3">
                <View className="flex-row items-center bg-paper-2 px-4 py-2.5 border-2 border-ink rounded-md">
                    <Ionicons name="search" size={15} color="#F97316" />
                    <TextInput
                        placeholder="Search by name..."
                        placeholderTextColor="#8B857E"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="flex-1 ml-2 text-ink font-semibold text-xs"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} className="bg-paper-2 p-1 rounded-full">
                            <Ionicons name="close" size={12} color="#8B857E" />
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
            <View className="px-6 pb-4 flex-row items-center justify-between border-b border-line">
                <View>
                    <Text className="text-2xl font-display uppercase">
                        Recruiter <Text className="text-accent-text">Portal</Text>
                    </Text>
                    <Text className="text-ink-3 text-label font-semibold uppercase">
                        Applicant Tracking
                    </Text>
                </View>
                <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                        onPress={() => navigation.navigate('Notification')}
                        className="w-10 h-10 items-center justify-center"
                    >
                        <Ionicons name="notifications-outline" size={25} color="#12100E" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={fetchData} className="w-10 h-10 items-center justify-center" hitSlop={2}>
                        <Ionicons name="refresh" size={25} color="#12100E" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Stats */}
            <View className="px-5 pb-5 pt-3 border-b border-line">
                <View className="flex-row gap-3">
                    {/* Stat tiles are cards, not ink slabs: three filled blocks in a
                        row read as three primary actions, and the numbers are the
                        thing worth seeing. */}
                    <View className="flex-1 bg-card border border-line p-4 items-center rounded-md">
                        <Text className="font-display text-h1 text-ink">{posts.length}</Text>
                        <Text className="font-display text-label text-ink-3 uppercase mt-1">Active Posts</Text>
                    </View>
                    <View className="flex-1 bg-card border border-line p-4 items-center rounded-md">
                        <Text className="font-display text-h1 text-ink">
                            {applications.filter(a => a.status === 'applied').length}
                        </Text>
                        <Text className="font-display text-label text-ink-3 uppercase mt-1">New Applicants</Text>
                    </View>
                    <View className="flex-1 bg-card border border-line p-4 items-center rounded-md">
                        <Text className="font-display text-h1 text-ink">
                            {applications.filter(a => a.status === 'shortlisted').length}
                        </Text>
                        <Text className="font-display text-label text-ink-3 uppercase mt-1">Shortlisted</Text>
                    </View>
                </View>

            </View>

            {/* Quick Access Opportunities */}
            <View className="flex-row px-5 pt-3 gap-3">
                <TouchableOpacity
                    onPress={() => navigation.navigate('InternshipList')}
                    activeOpacity={0.7}
                    className="flex-1 bg-paper p-4 border border-line flex-row items-center gap-3 shadow-hair rounded-md"
                >
                    <View className="w-10 h-10 bg-recruiter/10 rounded-card items-center justify-center">
                        <Ionicons name="school-outline" size={20} color="#4F46E5" />
                    </View>
                    <View>
                        <Text className="text-ink font-display uppercase text-label">Internships</Text>
                        <Text className="text-ink-3 text-label font-semibold">Hiring</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => navigation.navigate('JobList')}
                    activeOpacity={0.7}
                    className="flex-1 bg-paper p-4 border border-line flex-row items-center gap-3 shadow-hair rounded-md"
                >
                    <View className="w-10 h-10 bg-brand-50 rounded-card items-center justify-center">
                        <Ionicons name="business-outline" size={20} color="#F97316" />
                    </View>
                    <View>
                        <Text className="text-ink font-display uppercase text-label">Jobs</Text>
                        <Text className="text-ink-3 text-label font-semibold">Full-time</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Section label */}
            <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
                <Text className="text-ink-3 text-label font-display uppercase">My Posts</Text>
                <Text className="text-ink-4 text-label font-semibold">{posts.length} active</Text>
            </View>
        </>
    );

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <SafeAreaView className="flex-1 bg-paper">
            {view === 'posts' ? (
                <>
                    {renderMainHeader()}
                    {loading ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color="#F97316" />
                        </View>
                    ) : (
                        <FlatList
                            data={posts}
                            keyExtractor={item => item._id}
                            renderItem={renderPostCard}
                            contentContainerStyle={{ paddingTop: 8, paddingBottom: 120 }}
                            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} />}
                            ListEmptyComponent={
                                <View className="items-center justify-center py-24 px-gutter">
                                    <Ionicons name="file-tray-outline" size={60} color="#C4BEB6" />
                                    <Text className="text-ink-3 font-display uppercase text-center mt-4">
                                        No posts yet
                                    </Text>
                                    <Text className="text-ink-4 text-label text-center mt-2">
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
                            <View className="items-center justify-center py-24 px-gutter">
                                <Ionicons
                                    name={view === 'shortlisted' ? 'star-outline' : 'people-outline'}
                                    size={60}
                                    color="#C4BEB6"
                                />
                                <Text className="text-ink-3 font-display uppercase text-center mt-4">
                                    {view === 'shortlisted' ? 'No shortlisted candidates' : 'No applicants yet'}
                                </Text>
                                <Text className="text-ink-4 text-label text-center mt-2">
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
    applied: { bg: 'bg-fam-career/10', text: 'text-fam-career' },
    shortlisted: { bg: 'bg-success/10', text: 'text-success' },
    rejected: { bg: 'bg-danger/10', text: 'text-danger' },
    reviewing: { bg: 'bg-warning/10', text: 'text-warning' },
};

export default RecruiterPortal;
