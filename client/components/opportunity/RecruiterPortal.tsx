import React, { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, Linking, Pressable, Switch } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import axios from '../../context/axiosConfig';
import { useAuth } from '../../context/auth.context';
import { Alert } from '../ui/AlertModal';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Buffer } from 'buffer';
import Toast from 'react-native-toast-message';
import { C } from '../../constants/colors';
import { AppBar, Avatar, Button, Card, Chip, Empty, FilterChips, FormField, IconBtn, Label, ListRow, Meta, Num, SearchField, SectionHeader, Sheet, Tag } from '../ui/kit';
import { useTabBarAutoHide, useTabBarClearance } from '../../constants/layout';

/**
 * view: 'posts'        → My Posts list (default)
 * view: 'applicants'   → Applicants for selectedPost
 * view: 'shortlisted'  → Shortlisted for selectedPost
 */
type PortalView = 'posts' | 'applicants' | 'shortlisted';

const RecruiterPortal = () => {
  const autoHideTabBar = useTabBarAutoHide();
  const tabBarClearance = useTabBarClearance();
    const navigation = useNavigation<any>();
    const { user } = useAuth();

    const [view, setView] = useState<PortalView>('posts');
    const [loading, setLoading] = useState(true);
    const [posts, setPosts] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
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
    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [postsRes, appsRes] = await Promise.all([
                axios.get('/opportunity/recruiter/posts'),
                axios.get('/opportunity/recruiter/applications'),
            ]);
            if (postsRes.data.success) setPosts(postsRes.data.data ?? []);
            if (appsRes.data.success) setApplications(appsRes.data.data ?? []);
        } catch (error) {
            Alert.alert('Error', 'Failed to fetch portal data.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    // This is a tab: it stays mounted, so a role posted from CreateOpportunity
    // never appeared on return. Refetch quietly on refocus.
    const focusedOnce = useRef(false);
    useFocusEffect(useCallback(() => {
        if (focusedOnce.current) fetchData(true);
        else focusedOnce.current = true;
    }, [fetchData]));

    // ─── Helpers ────────────────────────────────────────────────────────
    const openView = (post: any, target: PortalView, filter: 'all' | 'new' | 'shortlisted' | 'rejected' = 'all') => {
        setSelectedPost(post);
        setSearchQuery('');
        setStatusFilter(filter);
        setView(target);
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

    const visibleApplications = useMemo(() => applications
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
        }), [applications, selectedPost, activeFilter, searchQuery, sortBy]);

    const postApplications = applications.filter(a => a.opportunity?._id === selectedPost?._id);

    // One pass over applications instead of three filters per post card per render.
    const postStats = useMemo(() => {
        const m: Record<string, { applied: number; shortlisted: number; pending: number }> = {};
        for (const a of applications) {
            const id = a.opportunity?._id;
            if (!id) continue;
            const st = m[id] || (m[id] = { applied: 0, shortlisted: 0, pending: 0 });
            st.applied++;
            if (a.status === 'shortlisted') st.shortlisted++;
            else if (a.status !== 'rejected') st.pending++;
        }
        return m;
    }, [applications]);
    const counts = {
        all: postApplications.length,
        new: postApplications.filter(a => a.status !== 'shortlisted' && a.status !== 'rejected').length,
        shortlisted: postApplications.filter(a => a.status === 'shortlisted').length,
        rejected: postApplications.filter(a => a.status === 'rejected').length,
    };

    const renderPostCard = ({ item }: { item: any }) => (
        <PostCard
            item={item}
            stats={postStats[item._id]}
            onOpen={openView}
            onToggle={handleToggleActive}
            onEdit={(p: any) => navigation.navigate('CreateOpportunity', { initialData: p })}
            onDelete={handleDeletePost}
        />
    );

    const renderApplicantCard = ({ item }: { item: any }) => (
        <ApplicantCard
            item={item}
            portfolioBusy={portfolioLoading === item.candidate?._id}
            onPortfolio={openPortfolio}
            onStatus={handleUpdateStatus}
        />
    );

    // ─── Sub-view header (Applicants / Shortlisted) ───────────────────────
    const renderSubHeader = () => (
        <>
            <AppBar
                title={selectedPost?.title}
                onBack={goBack}
                right={
                    // One optional action. It names the group in view so it is never
                    // ambiguous who receives it, and only shows on Shortlisted / Rejected.
                    (activeFilter === 'shortlisted' || activeFilter === 'rejected') && counts[activeFilter] > 0 ? (
                        <Button
                            small
                            icon="mail-outline"
                            title={`Email ${counts[activeFilter]}`}
                            variant={activeFilter === 'shortlisted' ? 'primary' : 'secondary'}
                            onPress={() => openMail(activeFilter as 'shortlisted' | 'rejected')}
                            accessibilityLabel={`Email all ${counts[activeFilter]} ${activeFilter} candidates`}
                        />
                    ) : undefined
                }
            />
            <View className="border-b border-line pb-3">
                {/* The one thing a recruiter needs on arrival: how much is left to do. */}
                <Meta style={{ paddingHorizontal: 20, paddingBottom: 8 }} numberOfLines={1}>
                    {counts.new > 0 ? `${counts.new} left to review` : 'All reviewed'}
                </Meta>

                {/* Status filter carries the counts, so no need to switch to see each pile. */}
                <FilterChips
                    items={FILTERS}
                    value={activeFilter}
                    labels={{
                        new: `To review · ${counts.new}`,
                        shortlisted: `Shortlisted · ${counts.shortlisted}`,
                        rejected: `Rejected · ${counts.rejected}`,
                        all: `Everyone · ${counts.all}`,
                    }}
                    onChange={(k) => { setView('applicants'); setStatusFilter(k); }}
                />

                {/* Search and sort share one row so the first candidate stays above the fold. */}
                <View className="flex-row items-center px-gutter mt-3" style={{ gap: 8 }}>
                    <SearchField
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Name, college or course"
                        containerStyle={{ flex: 1 }}
                    />
                    {/* A toggle: there are only two orders. */}
                    <Chip
                        icon="swap-vertical"
                        label={sortBy === 'recent' ? 'Newest' : 'Active'}
                        onPress={() => setSortBy(sortBy === 'recent' ? 'activity' : 'recent')}
                        accessibilityLabel={`Sorted by ${sortBy === 'recent' ? 'newest first' : 'most active first'}. Tap to change.`}
                    />
                </View>
            </View>
        </>
    );

    // ─── Main header ─────────────────────────────────────────────────────
    const renderMainHeader = () => (
        <>
            <AppBar
                title="Recruiter portal"
                right={
                    <>
                        <IconBtn name="notifications-outline" onPress={() => navigation.navigate('Notification')} accessibilityLabel="Notifications" />
                        <IconBtn name="refresh" onPress={() => fetchData()} accessibilityLabel="Refresh" />
                    </>
                }
            />

            <View className="px-gutter pb-4 pt-3 border-b border-line flex-row" style={{ gap: 12 }}>
                <StatTile value={posts.length} label="Active posts" />
                <StatTile value={applications.filter(a => a.status === 'applied').length} label="New applicants" />
                <StatTile value={applications.filter(a => a.status === 'shortlisted').length} label="Shortlisted" />
            </View>

            <View className="flex-row px-gutter pt-3" style={{ gap: 12 }}>
                <Card style={{ flex: 1, padding: 0 }}>
                    <ListRow icon="school-outline" title="Internships" subtitle="Hiring" onPress={() => navigation.navigate('InternshipList')} chevron={false} />
                </Card>
                <Card style={{ flex: 1, padding: 0 }}>
                    <ListRow icon="business-outline" title="Jobs" subtitle="Full-time" onPress={() => navigation.navigate('JobList')} chevron={false} />
                </Card>
            </View>

            <SectionHeader title="My posts" count={`${posts.length} active`} style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }} />
        </>
    );

    const searching = !!searchQuery;
    const filtered = !searching && activeFilter !== 'all' && counts.all > 0;

    // ─── Render ───────────────────────────────────────────────────────────
    return (
        <View className="flex-1 bg-paper">
            {view === 'posts' ? (
                <>
                    {renderMainHeader()}
                    {/* Spinner only on first load; a refresh keeps the list and uses the pull indicator. */}
                    {loading && posts.length === 0 ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator size="large" color={C.brand[500]} />
                        </View>
                    ) : (
                        <FlatList keyboardShouldPersistTaps="handled"
                            data={posts}
                            {...autoHideTabBar}
                            keyExtractor={item => item._id}
                            renderItem={renderPostCard}
                            contentContainerStyle={{ paddingTop: 8, paddingBottom: tabBarClearance }}
                            refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchData()} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
                            ListEmptyComponent={
                                <Empty
                                    icon="file-tray-outline"
                                    title="No posts yet"
                                    hint="Post a role and students can start applying today."
                                    action={<Button variant="primary" icon="add" title="Post your first role" onPress={() => navigation.navigate('CreateOpportunity')} />}
                                />
                            }
                        />
                    )}
                </>
            ) : (
                <>
                    {renderSubHeader()}
                    <FlatList keyboardShouldPersistTaps="handled"
                        data={visibleApplications}
                        {...autoHideTabBar}
                        keyExtractor={item => item._id}
                        renderItem={renderApplicantCard}
                        contentContainerStyle={{ paddingTop: 12, paddingBottom: tabBarClearance }}
                        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchData()} tintColor={C.brand[500]} colors={[C.brand[500]]} />}
                        ListEmptyComponent={
                            // Distinguish "nobody applied" from "your filter hid everyone".
                            <Empty
                                icon={searching ? 'search-outline'
                                    : activeFilter === 'shortlisted' ? 'star-outline'
                                    : activeFilter === 'rejected' ? 'close-circle-outline'
                                    : activeFilter === 'new' ? 'checkmark-done-outline'
                                    : 'people-outline'}
                                title={searching ? 'No matches'
                                    : filtered && activeFilter === 'new' ? 'All caught up'
                                    : filtered && activeFilter === 'shortlisted' ? 'Nobody shortlisted yet'
                                    : filtered ? 'Nobody rejected'
                                    : 'No applicants yet'}
                                hint={searching ? `Nothing matches "${searchQuery}". Try a college or course instead.`
                                    : filtered && activeFilter === 'new' ? 'Every applicant for this post has been reviewed.'
                                    : filtered && activeFilter === 'shortlisted' ? 'Tap Shortlist on a candidate to add them here.'
                                    : filtered ? 'You have not rejected anyone for this post.'
                                    : 'Applications will appear here once students apply.'}
                                action={searching || filtered ? (
                                    <Button title="Show all" onPress={() => { setSearchQuery(''); setStatusFilter('all'); setView('applicants'); }} />
                                ) : undefined}
                            />
                        }
                    />
                </>
            )}
            {/* Compose sheet. The recipient group is stated in the header and
                cannot be changed from here — switching audience mid-draft is
                how the wrong message reaches the wrong people. */}
            <Sheet
                visible={!!mailTo}
                onClose={() => setMailTo(null)}
                title="Email candidates"
                subtitle={`To ${mailTo ? counts[mailTo] : 0} ${mailTo ?? ''} candidate${mailTo && counts[mailTo] === 1 ? '' : 's'}`}
                footer={
                    <Button
                        variant="primary"
                        block
                        title={`Send to ${mailTo ? counts[mailTo] : 0}`}
                        onPress={sendMail}
                        loading={mailSending}
                        disabled={!mailSubject.trim() || !mailBody.trim()}
                        accessibilityLabel={`Send to ${mailTo ? counts[mailTo] : 0} candidates`}
                    />
                }
            >
                <View style={{ gap: 16 }}>
                    <FormField label="Subject" value={mailSubject} onChangeText={setMailSubject} placeholder="Subject line" />
                    <FormField
                        label="Message"
                        value={mailBody}
                        onChangeText={setMailBody}
                        placeholder="What do you want to tell them?"
                        multiline
                        hint="Each person gets their own email addressed to them by name. Nobody sees the other recipients."
                    />
                </View>
            </Sheet>
        </View>
    );
};

const FILTERS = ['new', 'shortlisted', 'rejected', 'all'] as const;

const StatTile = ({ value, label }: { value: number; label: string }) => (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 }}>
        <Num style={{ fontSize: 24, lineHeight: 28 }}>{value}</Num>
        <Text className="text-ink-3 text-xs font-semibold mt-1 text-center" numberOfLines={1}>{label}</Text>
    </Card>
);

const MiniStat = ({ value, label }: { value: string | number; label: string }) => (
    <View className="flex-1 bg-card rounded-xl py-2 items-center">
        <Text className="text-ink font-semibold text-sm">{value}</Text>
        <Text className="text-ink-3 text-xs">{label}</Text>
    </View>
);

const PostCard = memo(function PostCard({ item, stats, onOpen, onToggle, onEdit, onDelete }: {
    item: any;
    stats?: { applied: number; shortlisted: number; pending: number };
    onOpen: (post: any, target: PortalView, filter?: 'all' | 'new' | 'shortlisted' | 'rejected') => void;
    onToggle: (item: any) => void;
    onEdit: (item: any) => void;
    onDelete: (id: string) => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const appliedCount = stats?.applied ?? 0;
    const shortlistCount = stats?.shortlisted ?? 0;
    const pendingCount = stats?.pending ?? 0;
    const isActive = item.isActive !== false; // default true if undefined

    return (
        <View className={`rounded-2xl mx-gutter mb-3 p-4 border border-line ${isActive ? 'bg-card' : 'bg-paper-2'}`}>
            <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1 mr-3">
                    <Text className={`text-lg font-semibold ${isActive ? 'text-ink' : 'text-ink-3'}`} numberOfLines={2}>
                        {item.title}
                    </Text>
                    <Text className="text-accent-text font-semibold text-xs mt-1 capitalize">
                        {item.type} · {item.opportunityType}
                    </Text>
                </View>
                <View className="flex-row items-center">
                    <Switch
                        value={isActive}
                        onValueChange={() => onToggle(item)}
                        trackColor={{ false: C.line, true: C.success }}
                        thumbColor={C.card}
                        accessibilityLabel={isActive ? 'Pause post' : 'Activate post'}
                    />
                    <IconBtn name="create-outline" size={20} color={C.ink2} onPress={() => onEdit(item)} accessibilityLabel="Edit post" />
                    <IconBtn name="trash-outline" size={20} color={C.danger} onPress={() => onDelete(item._id)} accessibilityLabel="Delete post" />
                </View>
            </View>

            <View className="flex-row mb-3" style={{ gap: 12 }}>
                <View className="flex-1 bg-paper-2 rounded-xl p-3 items-center">
                    <Num style={{ fontSize: 20, lineHeight: 24 }}>{appliedCount}</Num>
                    <Text className="text-ink-3 text-xs font-semibold mt-0.5">Applied</Text>
                </View>
                <View className="flex-1 bg-success/10 rounded-xl p-3 items-center">
                    <Num style={{ fontSize: 20, lineHeight: 24, color: C.success }}>{shortlistCount}</Num>
                    <Text className="text-success text-xs font-semibold mt-0.5">Shortlisted</Text>
                </View>
            </View>

            {item.description ? (
                <View className="mb-3 bg-paper-2 p-3 rounded-xl">
                    <Text className="text-ink-2 text-sm leading-5" numberOfLines={expanded ? undefined : 3}>
                        {item.description}
                    </Text>
                    {item.description.length > 60 ? (
                        <Pressable onPress={() => setExpanded(e => !e)} hitSlop={12} className="mt-1 active:opacity-70" accessibilityRole="button">
                            <Text className="text-accent-text text-xs font-semibold">{expanded ? 'Show less' : 'Show more'}</Text>
                        </Pressable>
                    ) : null}
                </View>
            ) : null}

            {!isActive ? (
                <View className="flex-row items-center bg-warning/10 rounded-xl px-3 py-2 mb-3" style={{ gap: 8 }}>
                    <Ionicons name="pause-circle-outline" size={16} color={C.warning} />
                    <Text className="text-warning text-xs font-semibold flex-1">Paused: not visible to students</Text>
                </View>
            ) : null}

            {/* The primary button names the outstanding work ("Review 12"), not a destination. */}
            <View className="flex-row" style={{ gap: 8 }}>
                {pendingCount > 0 ? (
                    <Button
                        variant="primary"
                        icon="eye-outline"
                        title={`Review ${pendingCount}`}
                        onPress={() => onOpen(item, 'applicants', 'new')}
                        accessibilityLabel={`Review ${pendingCount} new applicants`}
                        style={{ flex: 1 }}
                    />
                ) : (
                    <Button
                        variant="solid"
                        icon="people-outline"
                        title="Applicants"
                        onPress={() => onOpen(item, 'applicants', 'all')}
                        accessibilityLabel={`View all ${appliedCount} applicants`}
                        style={{ flex: 1 }}
                    />
                )}
                <Button
                    icon="star-outline"
                    title={shortlistCount > 0 ? `Shortlist ${shortlistCount}` : 'Shortlist'}
                    onPress={() => onOpen(item, 'applicants', 'shortlisted')}
                    disabled={shortlistCount === 0}
                    accessibilityLabel={`View ${shortlistCount} shortlisted`}
                    style={{ flex: 1 }}
                />
            </View>
        </View>
    );
});

const ApplicantCard = memo(function ApplicantCard({ item, portfolioBusy, onPortfolio, onStatus }: {
    item: any;
    portfolioBusy: boolean;
    onPortfolio: (candidate: any) => void;
    onStatus: (appId: string, status: string, name?: string) => void;
}) {
    const c = item.candidate ?? {};
    const name = c.name ?? 'candidate';
    const tone = statusColors[item.status];
    return (
        <Card padded style={{ marginHorizontal: 20, marginBottom: 12 }}>
            <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
                <Avatar uri={c.avatar} initials={c.name} size={56} />
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="text-ink text-base font-semibold" numberOfLines={1}>{c.name}</Text>
                    <Text className="text-ink-3 text-sm" numberOfLines={1}>{c.college}</Text>
                    {c.year ? <Text className="text-ink-3 text-xs">Year {c.year}</Text> : null}
                    {/* The handle is what a recruiter quotes when following an application up. */}
                    {c.username ? <Text className="text-recruiter text-xs font-semibold">@{c.username}</Text> : null}
                </View>
                <View className={`px-3 py-1 rounded-full ${tone?.bg || 'bg-paper-2'}`}>
                    <Text className={`text-xs font-semibold capitalize ${tone?.text || 'text-ink-3'}`}>{item.status}</Text>
                </View>
            </View>

            {/* Identity and contact, so a recruiter can reach an applicant without leaving the app. */}
            <View className="mb-3 bg-paper-2 p-3 rounded-xl">
                <Label style={{ marginBottom: 4 }}>Candidate details</Label>
                {c.email ? (
                    <Pressable
                        onPress={() => Linking.openURL(`mailto:${c.email}`)}
                        className="flex-row items-center active:opacity-70"
                        style={{ minHeight: 44 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Email ${c.email}`}
                    >
                        <Ionicons name="mail-outline" size={16} color={C.recruiter} />
                        <Text className="text-ink text-sm ml-2 flex-1" numberOfLines={1}>{c.email}</Text>
                    </Pressable>
                ) : null}
                {c.mobileNumber ? (
                    <Pressable
                        onPress={() => Linking.openURL(`tel:${c.mobileNumber}`)}
                        className="flex-row items-center active:opacity-70"
                        style={{ minHeight: 44 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Call ${c.mobileNumber}`}
                    >
                        <Ionicons name="call-outline" size={16} color={C.recruiter} />
                        <Text className="text-ink text-sm ml-2">{c.mobileNumber}</Text>
                    </Pressable>
                ) : null}
                <View className="flex-row items-center mt-1">
                    <Ionicons name="finger-print-outline" size={14} color={C.ink3} />
                    <Text className="text-ink-2 ml-2" style={{ fontSize: 11, fontFamily: 'monospace' }} selectable>{c._id}</Text>
                </View>
                {c.major || c.graduationYear ? (
                    <Text className="text-ink-2 text-xs mt-2">
                        {[c.major, c.graduationYear && `Class of ${c.graduationYear}`].filter(Boolean).join(' · ')}
                    </Text>
                ) : null}
            </View>

            {c.githubUsername ? (
                <View className="mb-3 bg-paper-2 p-3 rounded-xl">
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center" style={{ gap: 8 }}>
                            <Ionicons name="logo-github" size={16} color={C.ink} />
                            <Text className="text-ink font-semibold text-sm">GitHub stats</Text>
                        </View>
                        <Tag label="Verified" icon="checkmark-circle" tone={{ fg: C.success }} />
                    </View>
                    <View className="flex-row" style={{ gap: 8 }}>
                        <MiniStat value={c.githubStats?.totalCommits || 0} label="Commits" />
                        <MiniStat value={c.githubStats?.totalStars || 0} label="Stars" />
                        <MiniStat value={`${c.githubStats?.contributionStreak || 0}d`} label="Streak" />
                    </View>
                    <Pressable
                        onPress={() => Linking.openURL(`https://github.com/${c.githubUsername}`)}
                        className="mt-2 flex-row items-center justify-center active:opacity-70"
                        style={{ minHeight: 44, gap: 4 }}
                        accessibilityRole="link"
                    >
                        <Text className="text-ink-2 font-semibold text-xs">View GitHub profile</Text>
                        <Ionicons name="arrow-forward" size={12} color={C.ink2} />
                    </Pressable>
                </View>
            ) : null}

            {item.coverLetter ? (
                <View className="bg-paper-2 p-3 rounded-xl mb-3">
                    <Label style={{ marginBottom: 4 }}>Note / pitch</Label>
                    <Text className="text-ink-2 text-sm leading-5" numberOfLines={3}>{item.coverLetter}</Text>
                </View>
            ) : null}

            <View className="flex-row" style={{ gap: 8 }}>
                <Button small variant="tertiary" icon="document-text-outline" title="Resume" onPress={() => item.resume && Linking.openURL(item.resume)} style={{ flex: 1 }} />
                <Button
                    small
                    variant="tertiary"
                    icon="person-outline"
                    title="Portfolio"
                    loading={portfolioBusy}
                    onPress={() => onPortfolio(item.candidate)}
                    accessibilityLabel={`Open portfolio for ${name}`}
                    style={{ flex: 1 }}
                />
            </View>
            {/* Triage, one tap per decision. Both outcomes are reversible from the card,
                so a confirm step buys nothing. */}
            <View className="flex-row mt-2" style={{ gap: 8 }}>
                {item.status === 'shortlisted' ? (
                    <Button icon="close" title="Remove" onPress={() => onStatus(item._id, 'rejected', c.name)} accessibilityLabel={`Remove ${name} from shortlist`} style={{ flex: 1 }} />
                ) : item.status === 'rejected' ? (
                    <Button variant="solid" icon="arrow-undo-outline" title="Undo" onPress={() => onStatus(item._id, 'shortlisted', c.name)} accessibilityLabel={`Shortlist ${name} again`} style={{ flex: 1 }} />
                ) : (
                    <>
                        <Button icon="close" title="Reject" onPress={() => onStatus(item._id, 'rejected', c.name)} accessibilityLabel={`Reject ${name}`} style={{ flex: 1 }} />
                        <Button variant="primary" icon="star" title="Shortlist" onPress={() => onStatus(item._id, 'shortlisted', c.name)} accessibilityLabel={`Shortlist ${name}`} style={{ flex: 1 }} />
                    </>
                )}
            </View>
        </Card>
    );
});

const statusColors: any = {
    applied: { bg: 'bg-fam-career/10', text: 'text-fam-career' },
    shortlisted: { bg: 'bg-success/10', text: 'text-success' },
    rejected: { bg: 'bg-danger/10', text: 'text-danger' },
    reviewing: { bg: 'bg-warning/10', text: 'text-warning' },
};

export default RecruiterPortal;
