import React from 'react';
import { View, Text, Pressable, Image, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { C } from '../../constants/colors';
import { IconBtn, Button, Label } from '../ui/kit';

const PUBLIC_PROFILE_SCREEN = 'PublicProfile';

export const AdItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-card rounded-2xl mb-4 border border-line overflow-hidden">
        <Image
            source={{ uri: item.imageUrl }}
            className="w-full h-36 bg-paper-2"
            resizeMode="cover"
        />
        <View className="p-4">
            <View className="flex-row justify-between items-start">
                <View className="flex-1">
                    <Text className="text-ink font-semibold text-sm">{item.title || 'Untitled Ad'}</Text>
                    {item.linkUrl ? (
                        <Text className="text-accent-text text-xs mt-0.5" numberOfLines={1}>{item.linkUrl}</Text>
                    ) : null}
                </View>
                <View className="flex-row gap-1 ml-2">
                    <IconBtn name="pencil-outline" size={18} boxed onPress={() => onEdit(item, 'ad')} accessibilityLabel="Edit ad" />
                    <IconBtn name="trash-outline" size={18} boxed color={C.danger} onPress={() => onDelete(item._id, 'ad')} accessibilityLabel="Delete ad" />
                </View>
            </View>
        </View>
    </View>
);

export const RedemptionItem = ({ item, navigation, onToggleStatus }: any) => {
    const handleViewProfile = () => {
        if (item._id) {
            navigation.navigate(PUBLIC_PROFILE_SCREEN, { userId: item._id });
        }
    };

    return (
        <View className="bg-card rounded-2xl mb-4 p-4 border border-line">
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3 flex-1 mr-2">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-10 h-10 rounded-full bg-paper-2" />
                    <View className="flex-1">
                        <Text className="text-ink font-semibold text-base" numberOfLines={1}>{item.name}</Text>
                        <Text className="text-ink-3 text-xs font-semibold" numberOfLines={1}>@{item.username}</Text>
                    </View>
                </View>
                <IconBtn name="call-outline" size={18} boxed color={C.success} onPress={() => item.mobileNumber && Linking.openURL(`tel:${item.mobileNumber}`)} accessibilityLabel={`Call ${item.name}`} />
            </View>

            <View className="bg-paper-2 rounded-xl p-3">
                <Label style={{ marginBottom: 8 }}>Redemption history</Label>
                {item.redeemedItems?.map((prod: any, idx: number) => (
                    <View key={idx} className="mb-4 last:mb-0 border-b border-line pb-3 last:border-0 last:pb-0">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="gift-outline" size={14} color={C.brand[500]} />
                            <Text className="text-ink font-semibold text-sm flex-shrink" numberOfLines={1}>{prod.product_name}</Text>
                            <View className="ml-auto bg-warning/15 px-2 py-0.5 rounded-full">
                                <Text className="text-xs text-warning font-semibold">{prod.coins_required}</Text>
                            </View>
                        </View>
                        <View className="bg-card p-2 rounded-lg border border-line">
                            <View className="flex-row justify-between items-start mb-1.5">
                                <View className="flex-row items-start gap-1.5 flex-1">
                                    <Ionicons name="location-outline" size={12} color={C.ink3} />
                                    <View className="flex-1">
                                        <Text className="text-ink-2 text-xs leading-4">{prod.address}</Text>
                                        <Text className="text-ink font-semibold text-xs mt-0.5">Pincode: {prod.pincode}</Text>
                                    </View>
                                </View>
                                <Pressable
                                    onPress={() => onToggleStatus(item._id, prod._id)}
                                    hitSlop={8}
                                    className={`w-7 h-7 rounded-full items-center justify-center border active:opacity-70 ${prod.isProcessed ? 'bg-success border-success' : 'bg-card border-line'}`}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: !!prod.isProcessed }}
                                    accessibilityLabel={`Mark ${prod.product_name} processed`}
                                >
                                    <Ionicons name="checkmark" size={16} color={prod.isProcessed ? "white" : C.ink3} />
                                </Pressable>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                                <Ionicons name="call-outline" size={12} color={C.ink3} />
                                <Pressable onPress={() => Linking.openURL(`tel:${prod.mobileNumber}`)} hitSlop={12} className="active:opacity-70" accessibilityRole="link">
                                    <Text className="text-recruiter text-xs font-semibold">{prod.mobileNumber}</Text>
                                </Pressable>
                                {prod.isProcessed && (
                                    <View className="ml-2 bg-success/15 px-2 py-0.5 rounded-full">
                                        <Text className="text-success text-xs font-semibold">Processed</Text>
                                    </View>
                                )}
                                <Text className="text-ink-3 text-xs ml-auto">{prod.redeemDate ? new Date(prod.redeemDate).toLocaleDateString() : 'No date'}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            <View className="mt-4 flex-row justify-between items-center">
                <Text className="text-ink-3 text-xs font-medium">{item.college}</Text>
                <Pressable
                    onPress={handleViewProfile}
                    hitSlop={12}
                    className="flex-row items-center gap-1 active:opacity-70"
                    accessibilityRole="link"
                >
                    <Text className="text-accent-text font-semibold text-xs">View profile</Text>
                    <Ionicons name="chevron-forward" size={12} color={C.accentText} />
                </Pressable>
            </View>
        </View>
    );
};

export const MarketPlaceItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-card rounded-2xl mb-4 border border-line overflow-hidden">
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: C.paper2 }}>
            <Image
                source={{ uri: item.product_image }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
            />
        </View>
        <View className="p-4">
            <View className="flex-row justify-between items-start">
                <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-ink font-semibold text-base flex-shrink" numberOfLines={1}>{item.product_name}</Text>
                        {!item.is_available && (
                            <View className="bg-danger/15 px-2 py-0.5 rounded-full">
                                <Text className="text-danger text-xs font-semibold">Hidden</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-ink-3 text-xs mt-1" numberOfLines={2}>{item.product_description}</Text>
                    <View className="flex-row items-center gap-2 mt-2">
                        <View className="bg-warning/15 self-start px-2.5 py-1 rounded-full">
                            <Text className="text-warning font-semibold text-xs">
                                {item.coins_required} coins required
                            </Text>
                        </View>
                    </View>
                </View>
                <View className="flex-row gap-1 ml-2">
                    <IconBtn name="pencil-outline" size={18} boxed onPress={() => onEdit(item, 'product')} accessibilityLabel="Edit item" />
                    <IconBtn name="trash-outline" size={18} boxed color={C.danger} onPress={() => onDelete(item._id, 'product')} accessibilityLabel="Delete item" />
                </View>
            </View>
        </View>
    </View>
);

const REPORT_TARGET_LABEL: Record<string, string> = {
    post: 'Post', short: 'Short', user: 'User', chat_message: 'Chat message',
    confession: 'Confession', confession_comment: 'Confession comment',
    night_message: '12 AM Club message', night_user: '12 AM Club 1v1 partner',
};

export const ReportItem = ({ item, onDelete, onResolve }: any) => {
    // Post reports keep the post preview and its delete; everything else (shorts,
    // users, chat, confessions, 12 AM Club) shows what the server snapshotted.
    const isPost = !!item.post;
    const label = isPost ? 'Post' : item.short ? 'Short' : REPORT_TARGET_LABEL[item.targetType] || item.targetType || 'Content';
    const reportedUser = item.targetUser || item.short?.user;
    return (
    <View className="rounded-2xl mb-4 p-4 border border-danger/30 bg-danger/10">
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-ink font-semibold text-base">Reported {label}</Text>
                    <View className="bg-danger/15 px-2 py-0.5 rounded-full">
                        <Text className="text-danger text-xs font-semibold">Pending review</Text>
                    </View>
                </View>
                <Text className="text-ink-3 text-xs mt-1">Reason: <Text className="text-danger font-semibold">{item.reason}</Text></Text>
            </View>
            {isPost && (
                <IconBtn name="trash-outline" size={18} boxed color={C.danger} onPress={() => onDelete(item._id, 'report')} accessibilityLabel="Delete reported post" />
            )}
        </View>

        {isPost ? (
        <View className="bg-paper-2 rounded-xl p-3 mb-3 border border-line">
            <View className="flex-row items-center gap-2 mb-2">
                <Image source={{ uri: item.post?.user?.avatar }} className="w-6 h-6 rounded-full bg-paper-2" />
                <Text className="text-ink font-semibold text-xs">@{item.post?.user?.username || 'unknown'}</Text>
            </View>
            <Text className="text-ink text-sm leading-5" numberOfLines={3}>{item.post?.description}</Text>
            {item.post?.image && item.post.image.length > 0 && (
                <ScrollView keyboardShouldPersistTaps="handled" horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    {item.post.image.map((img: string, i: number) => (
                        <Image key={i} source={{ uri: img }} className="w-20 h-20 rounded-lg mr-2 bg-paper-2" />
                    ))}
                </ScrollView>
            )}
        </View>
        ) : (
        <View className="bg-paper-2 rounded-xl p-3 mb-3 border border-line">
            {reportedUser ? (
                <View className="flex-row items-center gap-2 mb-2">
                    {!!reportedUser.avatar && <Image source={{ uri: reportedUser.avatar }} className="w-6 h-6 rounded-full" />}
                    <Text className="text-ink font-semibold text-xs">{reportedUser.name ? `${reportedUser.name} ` : ''}@{reportedUser.username || 'unknown'}</Text>
                </View>
            ) : null}
            <Text className="text-ink text-sm leading-5" numberOfLines={6}>
                {item.snapshot || item.short?.description || item.short?.caption || 'No content snapshot'}
            </Text>
        </View>
        )}

        <View className="flex-row items-center justify-between border-t border-line pt-3">
            <View className="flex-row items-center gap-2">
                <Text className="text-ink-3 text-xs">Reported by</Text>
                <Text className="text-ink font-semibold text-xs">@{item.reporter?.username}</Text>
            </View>
            <Text className="text-ink-3 text-xs">{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>

        {onResolve && (
            <View className="flex-row gap-2 mt-3">
                <Button title="Resolve" variant="solid" small onPress={() => onResolve(item._id, 'resolved')} style={{ flex: 1 }} />
                <Button title="Dismiss" small onPress={() => onResolve(item._id, 'dismissed')} style={{ flex: 1 }} />
            </View>
        )}
    </View>
    );
};

export const ContactMessageItem = ({ item, onDelete, onToggleRead }: any) => (
    <View className={`bg-card rounded-2xl mb-4 p-4 border ${item.isRead ? 'border-line' : 'border-recruiter/25 bg-recruiter/10'}`}>
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-ink font-semibold text-base">{item.name}</Text>
                    {!item.isRead && (
                        <View className="bg-recruiter/15 px-2 py-0.5 rounded-full">
                            <Text className="text-recruiter text-xs font-semibold">New</Text>
                        </View>
                    )}
                </View>
                <Text className="text-ink-3 text-xs">{item.email}</Text>
                <Text className="text-ink-3 text-xs mt-1">{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View className="flex-row gap-2">
                <Pressable
                    onPress={() => onToggleRead(item._id)}
                    hitSlop={4}
                    className={`w-10 h-10 rounded-full items-center justify-center border active:opacity-70 ${item.isRead ? 'bg-success border-success' : 'bg-card border-line'}`}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !!item.isRead }}
                    accessibilityLabel="Mark as read"
                >
                    <Ionicons name="checkmark" size={16} color={item.isRead ? "white" : C.ink3} />
                </Pressable>
                <IconBtn name="trash-outline" size={18} boxed color={C.danger} onPress={() => onDelete(item._id, 'message')} accessibilityLabel="Delete message" />
            </View>
        </View>
        <View className="bg-paper-2 rounded-xl p-3 mb-3">
            <Text className="text-ink text-sm leading-5">{item.message}</Text>
        </View>
        <View className="flex-row items-center gap-2">
            <Button title={String(item.phone ?? '')} icon="call-outline" small onPress={() => Linking.openURL(`tel:${item.phone}`)} accessibilityLabel={`Call ${item.phone}`} />
            <Button title="Reply" icon="mail-outline" small onPress={() => Linking.openURL(`mailto:${item.email}`)} accessibilityLabel={`Reply to ${item.email}`} />
        </View>
        {item.images && item.images.length > 0 && (
            <View className="mt-4 flex-row flex-wrap gap-2">
                {item.images.map((img: string, i: number) => (
                    <Image key={i} source={{ uri: img }} className="w-16 h-16 rounded-lg bg-paper-2" />
                ))}
            </View>
        )}
    </View>
);

export const UserItem = ({ item, onToggleBan }: any) => (
    <View className="bg-card rounded-2xl mb-4 p-5 border border-line">
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
                <View className="w-14 h-14 rounded-full bg-paper-2 overflow-hidden">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-full h-full" />
                </View>
                <View className="flex-1">
                    <Text className="text-ink font-semibold text-sm" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-ink-3 text-xs font-semibold" numberOfLines={1}>@{item.username}</Text>
                    <View className="bg-paper-2 self-start mt-1.5 px-2.5 py-1 rounded-full">
                        <Text className="text-ink-3 text-xs font-semibold">{item.user_access}</Text>
                    </View>
                </View>
            </View>
            <View className="flex-row gap-2">
                {item.user_access !== 'admin' && (
                    <IconBtn
                        name={item.isBanned ? "lock-open-outline" : "lock-closed-outline"}
                        size={18}
                        boxed
                        onPress={() => onToggleBan(item._id, item.isBanned)}
                        accessibilityLabel={item.isBanned ? `Unban ${item.name}` : `Ban ${item.name}`}
                    />
                )}
            </View>
        </View>
        <View className="mt-4 flex-row items-center justify-between border-t border-line pt-4">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Ionicons name="mail-outline" size={12} color={C.ink3} />
                <Text className="text-ink-3 text-xs font-medium flex-shrink" numberOfLines={1}>{item.email}</Text>
            </View>
            <Text className="text-ink-3 text-xs">Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
    </View>
);

export const MediaItem = ({ item, onDelete }: any) => (
    <View className="bg-card rounded-2xl mb-4 border border-line overflow-hidden">
        <View className="w-full aspect-video bg-paper-2">
            <Image source={{ uri: item.thumbnail }} className="w-full h-full" resizeMode="cover" />
            <View className="absolute top-3 right-3">
                <IconBtn name="trash-outline" size={18} overlay color="#FFFFFF" onPress={() => onDelete(item._id, 'media')} accessibilityLabel="Delete media" />
            </View>
        </View>
        <View className="p-4">
            <Text className="text-ink font-semibold text-base mb-1" numberOfLines={1}>{item.title}</Text>
            <Text className="text-ink-3 text-xs" numberOfLines={2}>{item.description}</Text>
            <View className="flex-row items-center gap-2 mt-3">
                {item.tags?.map((tag: string, idx: number) => (
                    <Text key={idx} className="text-accent-text text-xs font-semibold">#{tag}</Text>
                ))}
                <Text className="text-ink-3 ml-auto text-xs font-medium">{new Date(item.date).toLocaleDateString()}</Text>
            </View>
        </View>
    </View>
);

// ─── Payments ────────────────────────────────────────────────────────────────
// Amounts are stored in paise, like everything else on the payment path.
const rupees = (paise: number) =>
    `₹${((paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Razorpay's own vocabulary, in the words an admin uses when a student writes in.
const PAYMENT_STATUS: Record<string, { label: string; text: string; chip: string; icon: string }> = {
    paid: { label: 'Successful', text: 'text-success', chip: 'bg-success/10 border-success/25', icon: 'checkmark-circle' },
    created: { label: 'Pending', text: 'text-warning', chip: 'bg-warning/10 border-warning/25', icon: 'time' },
    failed: { label: 'Failed', text: 'text-danger', chip: 'bg-danger/10 border-danger/25', icon: 'close-circle' },
};

// What the student was actually buying, rather than the catalog key.
const PURPOSE_LABEL: Record<string, string> = {
    notice_boost: 'Global notice',
    funding_listing: 'Funding listing',
    interview_session: 'Mock interview',
    community_creation: 'Community creation',
    community_spark: 'Community spark',
};

export const PaymentItem = ({ item, onCopy }: any) => {
    const status = PAYMENT_STATUS[item.status] ?? PAYMENT_STATUS.created;
    return (
        <View className="bg-card rounded-2xl mb-4 p-5 border border-line">
            <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 mr-3">
                    <Text className="text-ink font-display text-lg">{rupees(item.amount)}</Text>
                    <Text className="text-ink-3 text-xs font-semibold mt-0.5">
                        {PURPOSE_LABEL[item.purpose] ?? item.purpose}
                    </Text>
                </View>
                <View className={`flex-row items-center border px-2.5 py-1 rounded-full ${status.chip}`}>
                    <Ionicons name={status.icon as any} size={12} color={
                        item.status === 'paid' ? C.success : item.status === 'failed' ? C.danger : C.warning
                    } />
                    <Text className={`text-xs font-semibold ml-1.5 ${status.text}`}>{status.label}</Text>
                </View>
            </View>

            {/* Who to look up when a query comes in */}
            <View className="flex-row items-center border-t border-line pt-3">
                <View className="w-8 h-8 rounded-full bg-paper-2 overflow-hidden mr-2.5">
                    <Image source={{ uri: item.user?.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-full h-full" />
                </View>
                <View className="flex-1">
                    <Text className="text-ink text-sm font-semibold" numberOfLines={1}>
                        {item.user?.name ?? 'Deleted account'}
                    </Text>
                    <Text className="text-ink-3 text-xs font-semibold" numberOfLines={1}>
                        {item.user?.username ? `@${item.user.username}` : ''}
                        {item.user?.email ? ` · ${item.user.email}` : ''}
                    </Text>
                </View>
            </View>

            {/* The reference a student can read off their bank statement. Tap to
                copy — retyping "pay_RkQ9x2..." from a support chat is how the
                wrong refund gets issued. */}
            <View className="mt-3 bg-paper-2 rounded-2xl p-3">
                {[
                    ['Order ID', item.orderId],
                    ['Payment ID', item.paymentId],
                ].map(([label, value]: any) => (
                    <Pressable
                        key={label}
                        onPress={() => value && onCopy?.(value)}
                        disabled={!value}
                        className="flex-row items-center justify-between py-2 active:opacity-70"
                        accessibilityRole="button"
                        accessibilityLabel={value ? `Copy ${label} ${value}` : `${label} not available`}
                    >
                        <Text className="text-ink-3 text-xs font-semibold">{label}</Text>
                        <View className="flex-row items-center flex-1 justify-end ml-3">
                            <Text className="text-ink text-xs font-mono" numberOfLines={1}>
                                {value ?? '—'}
                            </Text>
                            {value ? (
                                <Ionicons name="copy-outline" size={12} color={C.ink3} style={{ marginLeft: 6 }} />
                            ) : null}
                        </View>
                    </Pressable>
                ))}
            </View>

            <View className="flex-row items-center justify-between mt-3">
                <Text className="text-ink-3 text-xs font-semibold">
                    Started {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </Text>
                {item.paidAt ? (
                    <Text className="text-success text-xs font-semibold">
                        Paid {new Date(item.paidAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </Text>
                ) : null}
            </View>

            {/* Whatever the order was bound to — plan, community, duration. */}
            {item.meta && Object.keys(item.meta).length ? (
                <View className="flex-row flex-wrap mt-2.5" style={{ gap: 6 }}>
                    {Object.entries(item.meta).map(([k, v]: any) => (
                        <View key={k} className="bg-paper-2 px-2.5 py-1 rounded-full">
                            <Text className="text-ink-3 text-xs font-semibold">{k}: {String(v)}</Text>
                        </View>
                    ))}
                </View>
            ) : null}
        </View>
    );
};
