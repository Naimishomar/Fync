import React, { useState, useEffect, useCallback } from 'react';
import {View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView, RefreshControl, Linking, TextInput, Modal, Pressable, KeyboardAvoidingView} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';
import Toast from 'react-native-toast-message';

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
    const [portfolioLoading, setPortfolioLoading] = useState<string | null>(null);
    // Status is a filter over one list, not a separate screen. Shortlisted used
    // to be its own view reached from the post card, so comparing a shortlisted
    // candidate against the rest of the pile meant navigating back and forth.
    const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'shortlisted' | 'rejected'>('all');
    // Applications arrive newest-first from the server. That is the right
    // default, but it is not the order a recruiter wants when the pile is large
    // — then the question is who is strongest, not who is most recent.
    const [sortBy, setSortBy] = useState<'recent' | 'activity'>('recent');
    // Composing is scoped to one group at a time. The old single "Email all"
    // could reach anyone in the list, so an interview invite could land on a
    // candidate who had been rejected.
    const [mailTo, setMailTo] = useState<'shortlisted' | 'rejected' | null>(null);
    const [mailSubject, setMailSubject] = useState('');
    const [mailBody, setMailBody] = useState('');
    const [mailSending, setMailSending] = useState(false);

    /**
     * Fetch the candidate's portfolio PDF and open it locally.
     *
     * This used to hand the URL to Linking.openURL, which opens the system
     * browser — and the browser carries none of the app's auth, so the endpoint
     * answered "No token provided" every time. The PDF is behind verifyToken
     * and has to be fetched by the app itself.
     */
    const openPortfolio = async (candidate: any) => {
        const id = candidate?._id;
        if (!id) return;

        setPortfolioLoading(id);
        try {
            // arraybuffer, not the default JSON parse — this response is binary.
            const res = await axios.get(`/profile/resume/${id}/pdf`, { responseType: 'arraybuffer' });

            const base64 = Buffer.from(res.data, 'binary').toString('base64');
            const safeName = String(candidate?.name ?? 'portfolio').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
            const uri = `${FileSystem.cacheDirectory}${safeName}-portfolio.pdf`;

            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
            } else {
                await Linking.openURL(uri);
            }
        } catch (err: any) {
            const status = err?.response?.status;
            Alert.alert(
                'Could not open portfolio',
                status === 404
                    ? 'This candidate has not built a portfolio yet.'
                    : 'Something went wrong fetching it. Try again in a moment.',
                [{ text: 'Okay' }],
            );
        } finally {
            setPortfolioLoading(null);
        }
    };

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
    const openView = (post: any, target: PortalView, filter: 'all' | 'new' | 'shortlisted' | 'rejected' = 'all') => {
        setSelectedPost(post);
        setSearchQuery('');
        setStatusFilter(filter);
        setView(target);
    };

    const toggleExpand = (id: string) => {
        setExpandedPosts(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const goBack = () => {
        setView('posts');
        setSelectedPost(null);
        setSearchQuery('');
        setStatusFilter('all');
    };

    /**
     * Acknowledge a triage decision.
     *
     * Deliberately NOT tappable. This used to make the whole toast an undo
     * target, which silently reversed decisions: the toast covers the list, so
     * the recruiter's next tap — on the card that just moved up into that space
     * — landed on the toast instead and restored the candidate. It looked like
     * the removal had failed, because on reload the person really was back.
     *
     * Reversal lives on the card itself, under the Rejected filter, where it
     * cannot be hit by accident.
     */
    const confirmTriage = (status: string, name?: string) => {
        const who = name ? name.split(' ')[0] : 'Candidate';
        Toast.show({
            type: status === 'shortlisted' ? 'success' : 'info',
            text1: status === 'shortlisted' ? `${who} shortlisted` : `${who} rejected`,
            text2: status === 'shortlisted'
                ? 'Find them under Shortlisted'
                : 'Undo from the Rejected filter',
            visibilityTime: 2500,
        });
    };

    /** Sensible starting text, so the recruiter edits rather than starts blank. */
    const openMail = (group: 'shortlisted' | 'rejected') => {
        const role = selectedPost?.title ?? 'the role';
        setMailTo(group);
        setMailSubject(
            group === 'shortlisted'
                ? `Next steps for ${role}`
                : `Update on your application for ${role}`,
        );
        setMailBody(
            group === 'shortlisted'
                ? `You've been shortlisted for ${role}.\n\nWe'd like to take this forward — we'll follow up shortly with times and details.`
                : `Thank you for applying for ${role}.\n\nAfter reviewing every application we won't be moving forward this time. We'd genuinely encourage you to apply again for future roles.`,
        );
    };

    const sendMail = async () => {
        if (!mailTo || !mailSubject.trim() || !mailBody.trim()) return;
        setMailSending(true);
        try {
            const res = await axios.post('/opportunity/recruiter/email-candidates', {
                opportunityId: selectedPost?._id,
                status: mailTo,
                subject: mailSubject,
                message: mailBody,
            });
            setMailTo(null);
            Toast.show({
                type: res.data.failed ? 'info' : 'success',
                text1: res.data.message,
                visibilityTime: 3500,
            });
        } catch (err: any) {
            Alert.alert('Could not send', err?.response?.data?.message ?? 'Try again in a moment.', [{ text: 'Okay' }]);
        } finally {
            setMailSending(false);
        }
    };

    const handleUpdateStatus = async (appId: string, status: string, name?: string) => {
        // Applied first, confirmed after. Triage is a rapid, repeated action —
        // waiting on a round trip before the card changes makes every tap feel
        // like it missed, and recruiters tap again. The previous status is kept
        // so a failed request puts the card back rather than leaving the list
        // showing something the server never accepted.
        let previous: string | undefined;
        setApplications(prev => prev.map(a => {
            if (a._id !== appId) return a;
            previous = a.status;
            return { ...a, status };
        }));

        try {
            const res = await axios.patch(`/opportunity/recruiter/application-status/${appId}`, { status });
            if (!res.data.success) throw new Error('rejected');
            confirmTriage(status, name);
        } catch {
            setApplications(prev => prev.map(a => (a._id === appId ? { ...a, status: previous ?? a.status } : a)));
            Alert.alert('Could not update', 'That change did not save. Check your connection and try again.', [{ text: 'Okay' }]);
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





    // ─── Derived data ────────────────────────────────────────────────────
    const activeFilter = view === 'shortlisted' ? 'shortlisted' : statusFilter;

    const visibleApplications = applications
        .filter(a => a.opportunity?._id === selectedPost?._id)
        .filter(a => {
            if (activeFilter === 'all') return true;
            // "New" is anything not yet decided on, whatever the backend called
            // it — pending, reviewing, or a status added later.
            if (activeFilter === 'new') return a.status !== 'shortlisted' && a.status !== 'rejected';
            return a.status === activeFilter;
        })
        .filter(a => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            // Searching only names was too narrow: recruiters filter by course
            // and college far more often than by a name they do not know yet.
            return [
                a.candidate?.name,
                a.candidate?.username,
                a.candidate?.college,
                a.candidate?.major,
                a.candidate?.email,
            ].some(v => String(v ?? '').toLowerCase().includes(q));
        })
        .sort((a, b) => {
            if (sortBy === 'recent') return 0;   // already newest-first from the server
            // Commits and stars are the only proficiency signal in this payload.
            // Stars are weighted higher because they reflect other people's
            // judgement rather than sheer volume of activity.
            const score = (x: any) =>
                (x.candidate?.githubStats?.totalCommits ?? 0) +
                (x.candidate?.githubStats?.totalStars ?? 0) * 10;
            return score(b) - score(a);
        });

    const postApplications = applications.filter(a => a.opportunity?._id === selectedPost?._id);
    const counts = {
        all: postApplications.length,
        new: postApplications.filter(a => a.status !== 'shortlisted' && a.status !== 'rejected').length,
        shortlisted: postApplications.filter(a => a.status === 'shortlisted').length,
        rejected: postApplications.filter(a => a.status === 'rejected').length,
    };

    // ─── Renderers – Post card ───────────────────────────────────────────
    const renderPostCard = ({ item }: { item: any }) => {
        const appliedCount = applications.filter(a => a.opportunity?._id === item._id).length;
        const shortlistCount = applications.filter(a => a.opportunity?._id === item._id && a.status === 'shortlisted').length;
        const pendingCount = applications.filter(a => a.opportunity?._id === item._id && a.status !== 'shortlisted' && a.status !== 'rejected').length;
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
                {/* The primary button names the outstanding work rather than a
                    destination. "Applicants" told a recruiter nothing about
                    whether anything needed doing; "Review 12" does. */}
                <View className="flex-row gap-2">
                    {pendingCount > 0 ? (
                        <TouchableOpacity
                            onPress={() => openView(item, 'applicants', 'new')}
                            className="flex-1 flex-row items-center justify-center gap-2 bg-brand-500 border-2 border-ink h-12 rounded-card"
                            accessibilityRole="button"
                            accessibilityLabel={`Review ${pendingCount} new applicants`}
                        >
                            <Ionicons name="eye-outline" size={15} color="#12100E" />
                            <Text className="text-ink font-display uppercase text-label">Review {pendingCount}</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => openView(item, 'applicants', 'all')}
                            className="flex-1 flex-row items-center justify-center gap-2 bg-ink h-12 rounded-card"
                            accessibilityRole="button"
                            accessibilityLabel={`View all ${appliedCount} applicants`}
                        >
                            <Ionicons name="people-outline" size={15} color="white" />
                            <Text className="text-white font-display uppercase text-label">Applicants</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => openView(item, 'applicants', 'shortlisted')}
                        disabled={shortlistCount === 0}
                        className={`flex-1 flex-row items-center justify-center gap-2 h-12 rounded-card border-2 border-ink ${shortlistCount === 0 ? 'bg-paper-2' : 'bg-card'}`}
                        accessibilityRole="button"
                        accessibilityLabel={`View ${shortlistCount} shortlisted`}
                    >
                        <Ionicons name="star" size={15} color={shortlistCount === 0 ? '#C4BEB6' : '#12100E'} />
                        <Text className={`font-display uppercase text-label ${shortlistCount === 0 ? 'text-ink-4' : 'text-ink'}`}>
                            Shortlist {shortlistCount > 0 ? shortlistCount : ''}
                        </Text>
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
                    {/* The handle is the student's identifier on Fync — it is
                        what a recruiter quotes when following an application up,
                        and it was being fetched and thrown away. */}
                    {!!item.candidate?.username && (
                        <Text className="text-recruiter text-label font-semibold">@{item.candidate.username}</Text>
                    )}
                </View>
                <View className={`px-3 py-1.5 rounded-full ${statusColors[item.status]?.bg || 'bg-paper-2'}`}>
                    <Text className={`text-label font-display uppercase ${statusColors[item.status]?.text || 'text-ink-3'}`}>
                        {item.status}
                    </Text>
                </View>
            </View>
            
            {/* Identity and contact. Every field here was already arriving in
                the payload and being discarded, so a recruiter had no way to
                reach an applicant without leaving the app to guess. */}
            <View className="mb-4 bg-paper-2 p-4 rounded-card border border-line">
                <Text className="text-ink-3 font-display uppercase text-label mb-2">Candidate details</Text>

                {!!item.candidate?.email && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`mailto:${item.candidate.email}`)}
                        className="flex-row items-center mb-2"
                        style={{ minHeight: 32 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Email ${item.candidate.email}`}
                    >
                        <Ionicons name="mail-outline" size={14} color="#4F46E5" />
                        <Text className="text-ink ml-2 flex-1" style={{ fontSize: 12 }} numberOfLines={1}>
                            {item.candidate.email}
                        </Text>
                    </TouchableOpacity>
                )}

                {!!item.candidate?.mobileNumber && (
                    <TouchableOpacity
                        onPress={() => Linking.openURL(`tel:${item.candidate.mobileNumber}`)}
                        className="flex-row items-center mb-2"
                        style={{ minHeight: 32 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${item.candidate.mobileNumber}`}
                    >
                        <Ionicons name="call-outline" size={14} color="#4F46E5" />
                        <Text className="text-ink ml-2" style={{ fontSize: 12 }}>{item.candidate.mobileNumber}</Text>
                    </TouchableOpacity>
                )}

                <View className="flex-row items-center">
                    <Ionicons name="finger-print-outline" size={14} color="#8B857E" />
                    <Text className="text-ink-2 ml-2" style={{ fontSize: 11, fontFamily: 'monospace' }} selectable>
                        {item.candidate?._id}
                    </Text>
                </View>

                {(!!item.candidate?.major || !!item.candidate?.graduationYear) && (
                    <Text className="text-ink-2 mt-2" style={{ fontSize: 12 }}>
                        {[item.candidate?.major, item.candidate?.graduationYear && `Class of ${item.candidate.graduationYear}`]
                            .filter(Boolean).join(' · ')}
                    </Text>
                )}
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
                    onPress={() => openPortfolio(item.candidate)}
                    disabled={portfolioLoading === item.candidate?._id}
                    className="flex-1 bg-recruiter/10 h-12 rounded-card items-center justify-center flex-row gap-2"
                    accessibilityRole="button"
                    accessibilityLabel={`Open portfolio for ${item.candidate?.name ?? 'candidate'}`}
                >
                    {portfolioLoading === item.candidate?._id ? (
                        <ActivityIndicator size="small" color="#4F46E5" />
                    ) : (
                        <>
                            <Ionicons name="person-outline" size={15} color="#4F46E5" />
                            <Text className="text-recruiter font-display uppercase text-label">Portfolio</Text>
                        </>
                    )}
                </TouchableOpacity>

                {/* Triage, one tap per decision.
                    This used to be a single button labelled "Action" that opened
                    a dialog to choose Shortlist or Reject — three taps and a
                    modal for the most repeated action in the product. Reviewing
                    a hundred applicants meant three hundred taps. Both outcomes
                    are reversible from the card, so a confirm step buys nothing. */}
                {item.status === 'shortlisted' ? (
                    <TouchableOpacity
                        onPress={() => handleUpdateStatus(item._id, 'rejected', item.candidate?.name)}
                        className="flex-1 h-12 rounded-card items-center justify-center flex-row gap-1 border-2 border-ink bg-card"
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.candidate?.name ?? 'candidate'} from shortlist`}
                    >
                        <Ionicons name="close" size={15} color="#12100E" />
                        <Text className="text-ink font-display uppercase text-label">Remove</Text>
                    </TouchableOpacity>
                ) : item.status === 'rejected' ? (
                    <TouchableOpacity
                        onPress={() => handleUpdateStatus(item._id, 'shortlisted', item.candidate?.name)}
                        className="flex-1 h-12 rounded-card items-center justify-center flex-row gap-1 bg-success"
                        accessibilityRole="button"
                        accessibilityLabel={`Shortlist ${item.candidate?.name ?? 'candidate'} again`}
                    >
                        <Ionicons name="arrow-undo-outline" size={15} color="white" />
                        <Text className="text-white font-display uppercase text-label">Undo</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        <TouchableOpacity
                            onPress={() => handleUpdateStatus(item._id, 'rejected', item.candidate?.name)}
                            className="flex-1 h-12 rounded-card items-center justify-center flex-row gap-1 border-2 border-ink bg-card"
                            accessibilityRole="button"
                            accessibilityLabel={`Reject ${item.candidate?.name ?? 'candidate'}`}
                        >
                            <Ionicons name="close" size={15} color="#12100E" />
                            <Text className="text-ink font-display uppercase text-label">Reject</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleUpdateStatus(item._id, 'shortlisted', item.candidate?.name)}
                            className="flex-1 h-12 rounded-card items-center justify-center flex-row gap-1 bg-brand-500 border-2 border-ink"
                            accessibilityRole="button"
                            accessibilityLabel={`Shortlist ${item.candidate?.name ?? 'candidate'}`}
                        >
                            <Ionicons name="star" size={15} color="#12100E" />
                            <Text className="text-ink font-display uppercase text-label">Shortlist</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );

    // ─── Sub-view header (Applicants / Shortlisted) ───────────────────────
    const renderSubHeader = () => (
        <View className="bg-card border-b border-line">
            {/* Back + title. The subtitle states the one thing a recruiter
                needs on arrival: how much is left to do. */}
            <View className="px-4 pt-3 pb-3 flex-row items-center gap-3">
                <TouchableOpacity
                    onPress={goBack}
                    className="w-11 h-11 bg-paper-2 rounded-full items-center justify-center"
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Back to posts"
                >
                    <Ionicons name="arrow-back" size={20} color="#12100E" />
                </TouchableOpacity>

                <View className="flex-1">
                    <Text className="text-ink text-sm font-display uppercase" numberOfLines={1}>
                        {selectedPost?.title}
                    </Text>
                    <Text className="text-ink-2 text-label font-display uppercase">
                        {counts.new > 0 ? `${counts.new} left to review` : 'All reviewed'}
                    </Text>
                </View>

                {/* One optional action, not three. Copy-emails and email-all are
                    gone: shortlisting and rejecting now email the student
                    automatically, so those buttons duplicated work already done
                    and left the recruiter unsure whether mail had been sent. */}
                {/* The mail action names the group currently in view, so it is
                    never ambiguous who is about to receive it. It only appears
                    on Shortlisted and Rejected — the two groups a recruiter
                    actually writes to. */}
                {(activeFilter === 'shortlisted' || activeFilter === 'rejected') && counts[activeFilter] > 0 && (
                    <TouchableOpacity
                        onPress={() => openMail(activeFilter as 'shortlisted' | 'rejected')}
                        className={`flex-row items-center gap-1.5 px-3 border-2 border-ink rounded-xl ${activeFilter === 'shortlisted' ? 'bg-brand-500' : 'bg-card'}`}
                        style={{ minHeight: 44 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Email all ${counts[activeFilter]} ${activeFilter} candidates`}
                    >
                        <Ionicons name="mail-outline" size={14} color="#12100E" />
                        <Text className="text-ink font-display uppercase" style={{ fontSize: 10 }}>
                            Email {counts[activeFilter]}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Status filter. This is the screen's real navigation, so it gets
                its own row and carries the counts — no need to switch to find
                out how many are in each pile. */}
            <View className="pb-2">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {([
                        { key: 'new',         label: 'To review' },
                        { key: 'shortlisted', label: 'Shortlisted' },
                        { key: 'rejected',    label: 'Rejected' },
                        { key: 'all',         label: 'Everyone' },
                    ] as const).map(f => {
                        const on = activeFilter === f.key;
                        return (
                            <TouchableOpacity
                                key={f.key}
                                onPress={() => { setView('applicants'); setStatusFilter(f.key); }}
                                className={`flex-row items-center px-3 mr-2 rounded-xl border-2 border-ink ${on ? 'bg-brand-500' : 'bg-card'}`}
                                style={{ minHeight: 42 }}
                                accessibilityRole="button"
                                accessibilityState={{ selected: on }}
                                accessibilityLabel={`${f.label}, ${counts[f.key]}`}
                            >
                                <Text className="text-ink font-display uppercase text-label">{f.label}</Text>
                                <View className={`ml-2 px-1.5 rounded-full ${on ? 'bg-ink' : 'bg-paper-2'}`}>
                                    <Text className={`font-display ${on ? 'text-white' : 'text-ink-2'}`} style={{ fontSize: 10 }}>
                                        {counts[f.key]}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Search and sort share one row. They were two, which pushed the
                first candidate below the fold on a normal phone. */}
            <View className="flex-row items-center gap-2 px-4 pb-3">
                <View className="flex-1 flex-row items-center bg-card px-3 border-2 border-ink rounded-xl" style={{ minHeight: 44 }}>
                    <Ionicons name="search" size={16} color="#8B857E" />
                    <TextInput
                        placeholder="Name, college or course"
                        placeholderTextColor="#8B857E"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        className="flex-1 ml-2 text-ink"
                        style={{ fontSize: 14 }}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            onPress={() => setSearchQuery('')}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel="Clear search"
                        >
                            <Ionicons name="close-circle" size={18} color="#8B857E" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* A toggle, not a pair of buttons — there are only two orders,
                    so the control shows the one you would switch to. */}
                <TouchableOpacity
                    onPress={() => setSortBy(sortBy === 'recent' ? 'activity' : 'recent')}
                    className="flex-row items-center gap-1 px-3 bg-card border-2 border-ink rounded-xl"
                    style={{ minHeight: 44 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Sorted by ${sortBy === 'recent' ? 'newest first' : 'most active first'}. Tap to change.`}
                >
                    <Ionicons name="swap-vertical" size={14} color="#12100E" />
                    <Text className="text-ink font-display uppercase" style={{ fontSize: 10 }}>
                        {sortBy === 'recent' ? 'Newest' : 'Active'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    // ─── Main header ─────────────────────────────────────────────────────
    const renderMainHeader = () => (
        <>
            {/* Top bar */}
            <View className="px-6 pt-4 pb-4 flex-row items-center justify-between border-b border-line">
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
                        className="w-11 h-11 items-center justify-center"
                        accessibilityRole="button"
                        accessibilityLabel="Notifications"
                    >
                        <Ionicons name="notifications-outline" size={24} color="#12100E" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={fetchData}
                        className="w-11 h-11 items-center justify-center"
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Refresh"
                    >
                        <Ionicons name="refresh" size={24} color="#12100E" />
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
                                <View className="items-center justify-center py-20 px-gutter">
                                    <Ionicons name="file-tray-outline" size={60} color="#C4BEB6" />
                                    <Text className="text-ink-3 font-display uppercase text-center mt-4">
                                        No posts yet
                                    </Text>
                                    <Text className="text-ink-2 text-label text-center mt-2">
                                        Post a role and students can start applying today.
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('CreateOpportunity')}
                                        className="flex-row items-center justify-center gap-2 mt-5 px-6 bg-brand-500 border-2 border-ink rounded-card"
                                        style={{ minHeight: 48 }}
                                        accessibilityRole="button"
                                        accessibilityLabel="Post your first opportunity"
                                    >
                                        <Ionicons name="add" size={18} color="#12100E" />
                                        <Text className="text-ink font-display uppercase text-label">Post your first role</Text>
                                    </TouchableOpacity>
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
                            // The empty state has to distinguish "nobody applied"
                            // from "your filter hid everyone" — the old one said
                            // "No applicants yet" even when a search was active,
                            // which reads as the post having failed.
                            <View className="items-center justify-center py-24 px-gutter">
                                {(() => {
                                    const searching = !!searchQuery;
                                    const filtered = !searching && activeFilter !== 'all' && counts.all > 0;
                                    const icon = searching ? 'search-outline'
                                        : activeFilter === 'shortlisted' ? 'star-outline'
                                        : activeFilter === 'rejected' ? 'close-circle-outline'
                                        : activeFilter === 'new' ? 'checkmark-done-outline'
                                        : 'people-outline';
                                    const title = searching ? 'No matches'
                                        : filtered && activeFilter === 'new' ? 'All caught up'
                                        : filtered && activeFilter === 'shortlisted' ? 'Nobody shortlisted yet'
                                        : filtered ? 'Nobody rejected'
                                        : 'No applicants yet';
                                    const body = searching ? `Nothing matches "${searchQuery}". Try a college or course instead.`
                                        : filtered && activeFilter === 'new' ? 'Every applicant for this post has been reviewed.'
                                        : filtered && activeFilter === 'shortlisted' ? 'Tap Shortlist on a candidate to add them here.'
                                        : filtered ? 'You have not rejected anyone for this post.'
                                        : 'Applications will appear here once students apply.';
                                    return (
                                        <>
                                            <Ionicons name={icon as any} size={60} color="#C4BEB6" />
                                            <Text className="text-ink-3 font-display uppercase text-center mt-4">{title}</Text>
                                            <Text className="text-ink-2 text-label text-center mt-2">{body}</Text>
                                            {(searching || filtered) && (
                                                <TouchableOpacity
                                                    onPress={() => { setSearchQuery(''); setStatusFilter('all'); setView('applicants'); }}
                                                    className="mt-5 px-5 bg-card border-2 border-ink rounded-xl items-center justify-center"
                                                    style={{ minHeight: 44 }}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Show all applicants"
                                                >
                                                    <Text className="text-ink font-display uppercase text-label">Show all</Text>
                                                </TouchableOpacity>
                                            )}
                                        </>
                                    );
                                })()}
                            </View>
                        }
                    />
                </>
            )}
            {/* Compose sheet. The recipient group is stated in the header and
                cannot be changed from here — switching audience mid-draft is
                how the wrong message reaches the wrong people. */}
            <Modal visible={!!mailTo} transparent animationType="slide" onRequestClose={() => setMailTo(null)}>
                <KeyboardAvoidingView behavior="padding" className="flex-1 justify-end" style={{ backgroundColor: 'rgba(18,16,14,0.45)' }}>
                    <Pressable className="flex-1" onPress={() => setMailTo(null)} />

                    <View className="bg-paper rounded-t-sheet border-t-2 border-x-2 border-ink px-5 pt-4 pb-6">
                        <View className="items-center mb-3">
                            <View className="h-1 w-10 bg-ink-3 rounded-full" />
                        </View>

                        <View className="flex-row items-center mb-1">
                            <Text className="font-display text-xl text-ink">Email candidates</Text>
                            <View className="flex-1" />
                            <TouchableOpacity onPress={() => setMailTo(null)} hitSlop={10} accessibilityLabel="Close">
                                <Ionicons name="close" size={24} color="#12100E" />
                            </TouchableOpacity>
                        </View>

                        <View
                            className="self-start flex-row items-center px-3 py-1.5 rounded-sm mb-4"
                            style={{ backgroundColor: mailTo === 'shortlisted' ? '#FFEDD5' : '#EDE8E0' }}
                        >
                            <Ionicons
                                name={mailTo === 'shortlisted' ? 'star' : 'close-circle'}
                                size={12}
                                color={mailTo === 'shortlisted' ? '#C2410C' : '#57534E'}
                            />
                            <Text className="font-display uppercase ml-1.5" style={{ fontSize: 10, color: mailTo === 'shortlisted' ? '#C2410C' : '#57534E' }}>
                                To {mailTo ? counts[mailTo] : 0} {mailTo} candidate{mailTo && counts[mailTo] === 1 ? '' : 's'}
                            </Text>
                        </View>

                        <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Subject</Text>
                        <View className="mt-2 mb-4 border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 48, justifyContent: 'center' }}>
                            <TextInput
                                value={mailSubject}
                                onChangeText={setMailSubject}
                                placeholder="Subject line"
                                placeholderTextColor="#8B857E"
                                className="font-sans text-base text-ink"
                            />
                        </View>

                        <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Message</Text>
                        <View className="mt-2 mb-2 border-[1.5px] border-ink bg-card px-4 py-3 rounded-md">
                            <TextInput
                                value={mailBody}
                                onChangeText={setMailBody}
                                placeholder="What do you want to tell them?"
                                placeholderTextColor="#8B857E"
                                multiline
                                className="font-sans text-base text-ink"
                                style={{ minHeight: 120, textAlignVertical: 'top' }}
                            />
                        </View>

                        <Text className="font-sans text-ink-2 mb-4" style={{ fontSize: 11 }}>
                            Each person gets their own email addressed to them by name. Nobody sees the other recipients.
                        </Text>

                        <TouchableOpacity
                            onPress={sendMail}
                            disabled={mailSending || !mailSubject.trim() || !mailBody.trim()}
                            className="bg-brand-500 border-2 border-ink rounded-xl items-center justify-center"
                            style={{ height: 54, opacity: mailSending || !mailSubject.trim() || !mailBody.trim() ? 0.5 : 1 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Send to ${mailTo ? counts[mailTo] : 0} candidates`}
                        >
                            {mailSending
                                ? <ActivityIndicator color="#12100E" />
                                : <Text className="font-display text-ink uppercase">Send to {mailTo ? counts[mailTo] : 0}</Text>}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
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
