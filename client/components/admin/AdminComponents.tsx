import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const PUBLIC_PROFILE_SCREEN = 'PublicProfile';

export const AdItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-card rounded-card mb-4 border border-line overflow-hidden">
        <Image
            source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x150?text=No+Image' }}
            className="w-full h-36"
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
                <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => onEdit(item, 'ad')} className="w-9 h-9 bg-paper-2 rounded-full items-center justify-center border border-line">
                        <Ionicons name="pencil" size={16} color="#12100E" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id, 'ad')} className="w-9 h-9 bg-danger/10 rounded-full items-center justify-center border border-danger/15">
                        <Ionicons name="trash" size={16} color="#DC2626" />
                    </TouchableOpacity>
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
        <View className="bg-card rounded-card mb-4 p-4 border border-line">
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-10 h-10 rounded-full bg-paper-2" />
                    <View>
                        <Text className="text-ink font-semibold text-base">{item.name}</Text>
                        <Text className="text-ink-3 text-xs font-semibold">@{item.username}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => item.mobileNumber && Linking.openURL(`tel:${item.mobileNumber}`)}
                    className="p-2 bg-success/10 rounded-full"
                >
                    <Ionicons name="call" size={18} color="#047857" />
                </TouchableOpacity>
            </View>

            <View className="bg-paper-2 rounded-xl p-3">
                <Text className="text-ink-3 text-label font-display mb-2">Redemption History</Text>
                {item.redeemedItems?.map((prod: any, idx: number) => (
                    <View key={idx} className="mb-4 last:mb-0 border-b border-line pb-3 last:border-0 last:pb-0">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="gift-outline" size={14} color="#F97316" />
                            <Text className="text-ink font-semibold text-sm">{prod.product_name}</Text>
                            <View className="ml-auto bg-warning/15 px-2 py-0.5 rounded-full">
                                <Text className="text-label text-warning font-semibold">{prod.coins_required}</Text>
                            </View>
                        </View>
                        <View className="bg-card p-2 rounded-lg border border-line">
                            <View className="flex-row justify-between items-start mb-1.5">
                                <View className="flex-row items-start gap-1.5 flex-1">
                                    <Ionicons name="location-outline" size={12} color="#8B857E" />
                                    <View className="flex-1">
                                        <Text className="text-ink-2 text-label leading-4">{prod.address}</Text>
                                        <Text className="text-ink font-display text-label mt-0.5">Pincode: {prod.pincode}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => onToggleStatus(item._id, prod._id)}
                                    className={`w-7 h-7 rounded-full items-center justify-center border ${prod.isProcessed ? 'bg-success border-success' : 'bg-card border-line'}`}
                                >
                                    <Ionicons name="checkmark" size={16} color={prod.isProcessed ? "white" : "#C4BEB6"} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                                <Ionicons name="call-outline" size={12} color="#8B857E" />
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${prod.mobileNumber}`)}>
                                    <Text className="text-recruiter text-label font-semibold">{prod.mobileNumber}</Text>
                                </TouchableOpacity>
                                {prod.isProcessed && (
                                    <View className="ml-2 bg-success/15 px-1.5 py-0.5 rounded">
                                        <Text className="text-success text-label font-semibold">Processed</Text>
                                    </View>
                                )}
                                <Text className="text-ink-4 text-label ml-auto">{prod.redeemDate ? new Date(prod.redeemDate).toLocaleDateString() : 'No date'}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            <View className="mt-4 flex-row justify-between items-center">
                <Text className="text-ink-3 text-label font-medium">{item.college}</Text>
                <TouchableOpacity
                    onPress={handleViewProfile}
                    className="flex-row items-center gap-1"
                >
                    <Text className="text-accent-text font-semibold text-xs">View Profile</Text>
                    <Ionicons name="chevron-forward" size={12} color="#F97316" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const MarketPlaceItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-card rounded-card mb-4 border border-line overflow-hidden">
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#EDE8E0' }}>
            <Image
                source={{ uri: item.product_image || 'https://via.placeholder.com/300x150?text=No+Image' }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
            />
        </View>
        <View className="p-4">
            <View className="flex-row justify-between items-start">
                <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                        <Text className="text-ink font-semibold text-base">{item.product_name}</Text>
                        {!item.is_available && (
                            <View className="bg-danger/15 px-2 py-0.5 rounded-md">
                                <Text className="text-danger text-label font-display">Hidden</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-ink-3 text-xs mt-1" numberOfLines={2}>{item.product_description}</Text>
                    <View className="flex-row items-center gap-2 mt-2">
                        <View className="bg-warning/15 self-start px-2.5 py-1 rounded-full">
                            <Text className="text-warning font-display text-label">
                                {item.coins_required} Coins Required
                            </Text>
                        </View>
                    </View>
                </View>
                <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => onEdit(item, 'product')} className="w-9 h-9 bg-paper-2 rounded-full items-center justify-center border border-line">
                        <Ionicons name="pencil" size={16} color="#12100E" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id, 'product')} className="w-9 h-9 bg-danger/10 rounded-full items-center justify-center border border-danger/15">
                        <Ionicons name="trash" size={16} color="#DC2626" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </View>
);

export const ReportItem = ({ item, onDelete }: any) => (
    <View className="rounded-card mb-4 p-4 border border-danger/30 bg-danger/10">
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-ink font-semibold text-base">Reported Post</Text>
                    <View className="bg-danger/15 px-1.5 py-0.5 rounded">
                        <Text className="text-danger text-label font-display">Pending Review</Text>
                    </View>
                </View>
                <Text className="text-ink-3 text-label mt-1">Reason: <Text className="text-danger font-semibold">{item.reason}</Text></Text>
            </View>
            <TouchableOpacity onPress={() => onDelete(item._id, 'report')} className="w-9 h-9 bg-danger/10 rounded-full items-center justify-center border border-danger/15">
                <Ionicons name="trash" size={16} color="#DC2626" />
            </TouchableOpacity>
        </View>

        <View className="bg-paper-2 rounded-xl p-3 mb-3 border border-line">
            <View className="flex-row items-center gap-2 mb-2">
                <Image source={{ uri: item.post?.user?.avatar || 'https://via.placeholder.com/40' }} className="w-6 h-6 rounded-full" />
                <Text className="text-ink font-semibold text-xs">@{item.post?.user?.username || 'unknown'}</Text>
            </View>
            <Text className="text-ink text-sm leading-5" numberOfLines={3}>{item.post?.description}</Text>
            {item.post?.image && item.post.image.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    {item.post.image.map((img: string, i: number) => (
                        <Image key={i} source={{ uri: img }} className="w-20 h-20 rounded-lg mr-2" />
                    ))}
                </ScrollView>
            )}
        </View>

        <View className="flex-row items-center justify-between border-t border-line pt-3">
            <View className="flex-row items-center gap-2">
                <Text className="text-ink-3 text-label font-semibold">Reported By:</Text>
                <Text className="text-ink font-semibold text-label">@{item.reporter?.username}</Text>
            </View>
            <Text className="text-ink-3 text-label">{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
    </View>
);

export const ContactMessageItem = ({ item, onDelete, onToggleRead }: any) => (
    <View className={`bg-card rounded-card mb-4 p-4 border ${item.isRead ? 'border-line' : 'border-recruiter/25 bg-recruiter/10'}`}>
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-ink font-semibold text-base">{item.name}</Text>
                    {!item.isRead && (
                        <View className="bg-recruiter/15 px-1.5 py-0.5 rounded">
                            <Text className="text-recruiter text-label font-display">New</Text>
                        </View>
                    )}
                </View>
                <Text className="text-ink-3 text-xs">{item.email}</Text>
                <Text className="text-ink-3 text-label mt-1">{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View className="flex-row gap-2">
                <TouchableOpacity
                    onPress={() => onToggleRead(item._id)}
                    className={`w-9 h-9 rounded-full items-center justify-center border ${item.isRead ? 'bg-success border-success' : 'bg-card border-line'}`}
                >
                    <Ionicons name="checkmark" size={16} color={item.isRead ? "white" : "#C4BEB6"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id, 'message')} className="w-9 h-9 bg-danger/10 rounded-full items-center justify-center border border-danger/15">
                    <Ionicons name="trash" size={16} color="#DC2626" />
                </TouchableOpacity>
            </View>
        </View>
        <View className="bg-paper-2 rounded-xl p-3 mb-3">
            <Text className="text-ink text-sm leading-5">{item.message}</Text>
        </View>
        <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} className="flex-row items-center gap-1.5 bg-success/10 px-3 py-1.5 rounded-full border border-success/15">
                <Ionicons name="call" size={14} color="#047857" />
                <Text className="text-success font-semibold text-label">{item.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} className="flex-row items-center gap-1.5 bg-fam-career/10 px-3 py-1.5 rounded-full border border-fam-career/15">
                <Ionicons name="mail" size={14} color="#2563EB" />
                <Text className="text-fam-career font-semibold text-label">Reply</Text>
            </TouchableOpacity>
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
    <View className="bg-card rounded-sheet mb-4 p-5 border border-paper-2 shadow-hair">
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
                <View className="w-14 h-14 rounded-card bg-paper-2 overflow-hidden">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-full h-full" />
                </View>
                <View>
                    <Text className="text-ink font-display text-sm">{item.name}</Text>
                    <Text className="text-ink-3 text-label font-semibold">@{item.username}</Text>
                    <View className="bg-paper-2 self-start mt-1.5 px-2.5 py-1 rounded-full">
                        <Text className="text-ink-3 text-label font-display">{item.user_access}</Text>
                    </View>
                </View>
            </View>
            <View className="flex-row gap-2">
                {item.user_access !== 'admin' && (
                    <TouchableOpacity 
                        onPress={() => onToggleBan(item._id, item.isBanned)}
                        className={`w-9 h-9 rounded-xl items-center justify-center border ${item.isBanned ? 'bg-ink border-ink' : 'bg-card border-paper-2'}`}
                    >
                        <Ionicons name={item.isBanned ? "lock-open" : "lock-closed"} size={16} color={item.isBanned ? "white" : "#12100E"} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
        <View className="mt-4 flex-row items-center justify-between border-t border-paper pt-4">
            <View className="flex-row items-center gap-2">
                <Ionicons name="mail-outline" size={12} color="#8B857E" />
                <Text className="text-ink-3 text-label font-medium">{item.email}</Text>
            </View>
            <Text className="text-ink-3 text-label font-display">Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
    </View>
);

export const MediaItem = ({ item, onDelete }: any) => (
    <View className="bg-card rounded-card mb-4 border border-line overflow-hidden">
        <View className="w-full aspect-video bg-paper-2">
            <Image source={{ uri: item.thumbnail }} className="w-full h-full" resizeMode="cover" />
            <View className="absolute top-3 right-3">
                <TouchableOpacity onPress={() => onDelete(item._id, 'media')} className="w-9 h-9 bg-danger rounded-full items-center justify-center border border-danger/20">
                    <Ionicons name="trash" size={16} color="white" />
                </TouchableOpacity>
            </View>
        </View>
        <View className="p-4">
            <Text className="text-ink font-semibold text-base mb-1" numberOfLines={1}>{item.title}</Text>
            <Text className="text-ink-3 text-xs" numberOfLines={2}>{item.description}</Text>
            <View className="flex-row items-center gap-2 mt-3">
                {item.tags?.map((tag: string, idx: number) => (
                    <Text key={idx} className="text-accent-text text-label font-semibold">#{tag}</Text>
                ))}
                <Text className="text-ink-4 ml-auto text-label font-medium">{new Date(item.date).toLocaleDateString()}</Text>
            </View>
        </View>
    </View>
);
