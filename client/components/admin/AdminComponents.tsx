import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const PUBLIC_PROFILE_SCREEN = 'PublicProfile';

export const AdItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 border border-slate-100 overflow-hidden">
        <Image
            source={{ uri: item.imageUrl || 'https://via.placeholder.com/300x150?text=No+Image' }}
            className="w-full h-36"
            resizeMode="cover"
        />
        <View className="p-4">
            <View className="flex-row justify-between items-start">
                <View className="flex-1">
                    <Text className="text-slate-900 font-bold text-sm">{item.title || 'Untitled Ad'}</Text>
                    {item.linkUrl ? (
                        <Text className="text-pink-500 text-xs mt-0.5" numberOfLines={1}>{item.linkUrl}</Text>
                    ) : null}
                </View>
                <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => onEdit(item, 'ad')} className="w-9 h-9 bg-slate-50 rounded-full items-center justify-center border border-slate-200">
                        <Ionicons name="pencil" size={16} color="#1A1A1A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id, 'ad')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                        <Ionicons name="trash" size={16} color="#ef4444" />
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
        <View className="bg-white rounded-2xl mb-4 p-4 border border-slate-100">
            <View className="flex-row items-center justify-between mb-4">
                <View className="flex-row items-center gap-3">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-10 h-10 rounded-full bg-slate-100" />
                    <View>
                        <Text className="text-slate-900 font-bold text-base">{item.name}</Text>
                        <Text className="text-slate-500 text-xs text-indigo-500 font-semibold ">@{item.username}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => item.mobileNumber && Linking.openURL(`tel:${item.mobileNumber}`)}
                    className="p-2 bg-green-50 rounded-full"
                >
                    <Ionicons name="call" size={18} color="#16a34a" />
                </TouchableOpacity>
            </View>

            <View className="bg-slate-50 rounded-xl p-3">
                <Text className="text-slate-500 text-2xs  font-black tracking-wide mb-2">Redemption History</Text>
                {item.redeemedItems?.map((prod: any, idx: number) => (
                    <View key={idx} className="mb-4 last:mb-0 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                        <View className="flex-row items-center gap-2 mb-2">
                            <Ionicons name="gift-outline" size={14} color="#ec4899" />
                            <Text className="text-slate-800 font-bold text-sm">{prod.product_name}</Text>
                            <View className="ml-auto bg-amber-100 px-2 py-0.5 rounded-full">
                                <Text className="text-2xs text-amber-700 font-bold">{prod.coins_required} 🪙</Text>
                            </View>
                        </View>
                        <View className="bg-white p-2 rounded-lg border border-slate-100">
                            <View className="flex-row justify-between items-start mb-1.5">
                                <View className="flex-row items-start gap-1.5 flex-1">
                                    <Ionicons name="location-outline" size={12} color="#6b7280" />
                                    <View className="flex-1">
                                        <Text className="text-slate-600 text-2xs leading-4">{prod.address}</Text>
                                        <Text className="text-slate-900 font-black text-2xs mt-0.5">Pincode: {prod.pincode}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => onToggleStatus(item._id, prod._id)}
                                    className={`w-7 h-7 rounded-full items-center justify-center border ${prod.isProcessed ? 'bg-green-500 border-green-500' : 'bg-white border-slate-200'}`}
                                >
                                    <Ionicons name="checkmark" size={16} color={prod.isProcessed ? "white" : "#d1d5db"} />
                                </TouchableOpacity>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                                <Ionicons name="call-outline" size={12} color="#6b7280" />
                                <TouchableOpacity onPress={() => Linking.openURL(`tel:${prod.mobileNumber}`)}>
                                    <Text className="text-indigo-500 text-2xs font-bold">{prod.mobileNumber}</Text>
                                </TouchableOpacity>
                                {prod.isProcessed && (
                                    <View className="ml-2 bg-green-100 px-1.5 py-0.5 rounded">
                                        <Text className="text-green-700 text-2xs font-bold ">Processed</Text>
                                    </View>
                                )}
                                <Text className="text-slate-300 text-2xs ml-auto">{prod.redeemDate ? new Date(prod.redeemDate).toLocaleDateString() : 'No date'}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            <View className="mt-4 flex-row justify-between items-center">
                <Text className="text-slate-500 text-2xs font-medium">{item.college}</Text>
                <TouchableOpacity
                    onPress={handleViewProfile}
                    className="flex-row items-center gap-1"
                >
                    <Text className="text-pink-500 font-bold text-xs">View Profile</Text>
                    <Ionicons name="chevron-forward" size={12} color="#ec4899" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

export const MarketPlaceItem = ({ item, onEdit, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 border border-slate-100 overflow-hidden">
        <View style={{ width: '100%', aspectRatio: 1, backgroundColor: '#f9fafb' }}>
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
                        <Text className="text-slate-900 font-bold text-base">{item.product_name}</Text>
                        {!item.is_available && (
                            <View className="bg-red-100 px-2 py-0.5 rounded-md">
                                <Text className="text-red-600 text-2xs font-black ">Hidden</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-slate-500 text-xs mt-1" numberOfLines={2}>{item.product_description}</Text>
                    <View className="flex-row items-center gap-2 mt-2">
                        <View className="bg-amber-100 px-3 py-1 rounded-full self-start">
                            <Text className="text-amber-700 font-black text-2xs ">
                                {item.coins_required} 🪙 Coins Required
                            </Text>
                        </View>
                    </View>
                </View>
                <View className="flex-row gap-2 ml-2">
                    <TouchableOpacity onPress={() => onEdit(item, 'product')} className="w-9 h-9 bg-slate-50 rounded-full items-center justify-center border border-slate-200">
                        <Ionicons name="pencil" size={16} color="#1A1A1A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(item._id, 'product')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                        <Ionicons name="trash" size={16} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </View>
);

export const ReportItem = ({ item, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 p-4 border border-red-100 bg-red-50/5">
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-slate-900 font-bold text-base">Reported Post</Text>
                    <View className="bg-red-100 px-1.5 py-0.5 rounded">
                        <Text className="text-red-600 text-2xs font-black ">Pending Review</Text>
                    </View>
                </View>
                <Text className="text-slate-500 text-2xs mt-1">Reason: <Text className="text-red-500 font-bold">{item.reason}</Text></Text>
            </View>
            <TouchableOpacity onPress={() => onDelete(item._id, 'report')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                <Ionicons name="trash" size={16} color="#ef4444" />
            </TouchableOpacity>
        </View>

        <View className="bg-slate-50 rounded-xl p-3 mb-3 border border-slate-100">
            <View className="flex-row items-center gap-2 mb-2">
                <Image source={{ uri: item.post?.user?.avatar || 'https://via.placeholder.com/40' }} className="w-6 h-6 rounded-full" />
                <Text className="text-slate-800 font-bold text-xs">@{item.post?.user?.username || 'unknown'}</Text>
            </View>
            <Text className="text-slate-800 text-sm leading-5" numberOfLines={3}>{item.post?.description}</Text>
            {item.post?.image && item.post.image.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                    {item.post.image.map((img: string, i: number) => (
                        <Image key={i} source={{ uri: img }} className="w-20 h-20 rounded-lg mr-2" />
                    ))}
                </ScrollView>
            )}
        </View>

        <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
            <View className="flex-row items-center gap-2">
                <Text className="text-slate-500 text-2xs font-bold  tracking-wider">Reported By:</Text>
                <Text className="text-slate-900 font-bold text-2xs">@{item.reporter?.username}</Text>
            </View>
            <Text className="text-slate-500 text-2xs">{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
    </View>
);

export const ContactMessageItem = ({ item, onDelete, onToggleRead }: any) => (
    <View className={`bg-white rounded-2xl mb-4 p-4 border ${item.isRead ? 'border-slate-100' : 'border-indigo-200 bg-indigo-50/10'}`}>
        <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-2">
                    <Text className="text-slate-900 font-bold text-base">{item.name}</Text>
                    {!item.isRead && (
                        <View className="bg-indigo-100 px-1.5 py-0.5 rounded">
                            <Text className="text-indigo-600 text-2xs font-black ">New</Text>
                        </View>
                    )}
                </View>
                <Text className="text-slate-500 text-xs ">{item.email}</Text>
                <Text className="text-slate-500 text-2xs mt-1">{new Date(item.createdAt).toLocaleString()}</Text>
            </View>
            <View className="flex-row gap-2">
                <TouchableOpacity
                    onPress={() => onToggleRead(item._id)}
                    className={`w-9 h-9 rounded-full items-center justify-center border ${item.isRead ? 'bg-green-500 border-green-500' : 'bg-white border-slate-200'}`}
                >
                    <Ionicons name="checkmark" size={16} color={item.isRead ? "white" : "#d1d5db"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onDelete(item._id, 'message')} className="w-9 h-9 bg-red-50 rounded-full items-center justify-center border border-red-100">
                    <Ionicons name="trash" size={16} color="#ef4444" />
                </TouchableOpacity>
            </View>
        </View>
        <View className="bg-slate-50 rounded-xl p-3 mb-3">
            <Text className="text-slate-800 text-sm leading-5">{item.message}</Text>
        </View>
        <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.phone}`)} className="flex-row items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
                <Ionicons name="call" size={14} color="#16a34a" />
                <Text className="text-green-700 font-bold text-2xs ">{item.phone}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${item.email}`)} className="flex-row items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                <Ionicons name="mail" size={14} color="#2563eb" />
                <Text className="text-blue-700 font-bold text-2xs ">Reply</Text>
            </TouchableOpacity>
        </View>
        {item.images && item.images.length > 0 && (
            <View className="mt-4 flex-row flex-wrap gap-2">
                {item.images.map((img: string, i: number) => (
                    <Image key={i} source={{ uri: img }} className="w-16 h-16 rounded-lg bg-slate-100" />
                ))}
            </View>
        )}
    </View>
);

export const UserItem = ({ item, onToggleBan }: any) => (
    <View className="bg-white rounded-4xl mb-4 p-5 border border-[#F1F5F9] shadow-sm">
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
                <View className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden">
                    <Image source={{ uri: item.avatar || 'https://cdn-icons-png.freepik.com/512/219/219988.png' }} className="w-full h-full" />
                </View>
                <View>
                    <Text className="text-[#1A1A1A] font-black text-sm  tracking-[0.5px]">{item.name}</Text>
                    <Text className="text-[#64748B] text-2xs font-bold">@{item.username}</Text>
                    <View className="bg-[#F1F5F9] px-2 py-1 rounded-lg self-start mt-1.5">
                        <Text className="text-[#64748B] text-2xs font-black  tracking-wide">{item.user_access}</Text>
                    </View>
                </View>
            </View>
            <View className="flex-row gap-2">
                {item.user_access !== 'admin' && (
                    <TouchableOpacity 
                        onPress={() => onToggleBan(item._id, item.isBanned)}
                        className={`w-9 h-9 rounded-xl items-center justify-center border ${item.isBanned ? 'bg-slate-900 border-slate-900' : 'bg-white border-[#F1F5F9]'}`}
                    >
                        <Ionicons name={item.isBanned ? "lock-open" : "lock-closed"} size={16} color={item.isBanned ? "white" : "#1A1A1A"} />
                    </TouchableOpacity>
                )}
            </View>
        </View>
        <View className="mt-4 flex-row items-center justify-between border-t border-[#F8FAFC] pt-4">
            <View className="flex-row items-center gap-2">
                <Ionicons name="mail-outline" size={12} color="#94A3B8" />
                <Text className="text-[#64748B] text-2xs font-medium">{item.email}</Text>
            </View>
            <Text className="text-[#94A3B8] text-2xs font-black ">Joined {new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
    </View>
);

export const MediaItem = ({ item, onDelete }: any) => (
    <View className="bg-white rounded-2xl mb-4 border border-slate-100 overflow-hidden">
        <View className="w-full aspect-video bg-slate-100">
            <Image source={{ uri: item.thumbnail }} className="w-full h-full" resizeMode="cover" />
            <View className="absolute top-3 right-3">
                <TouchableOpacity onPress={() => onDelete(item._id, 'media')} className="w-9 h-9 bg-red-500 rounded-full items-center justify-center border border-red-500/20">
                    <Ionicons name="trash" size={16} color="white" />
                </TouchableOpacity>
            </View>
        </View>
        <View className="p-4">
            <Text className="text-slate-900 font-bold text-base mb-1" numberOfLines={1}>{item.title}</Text>
            <Text className="text-slate-500 text-xs" numberOfLines={2}>{item.description}</Text>
            <View className="flex-row items-center gap-2 mt-3">
                {item.tags?.map((tag: string, idx: number) => (
                    <Text key={idx} className="text-pink-500 text-2xs font-bold">#{tag}</Text>
                ))}
                <Text className="text-slate-300 ml-auto text-2xs font-medium">{new Date(item.date).toLocaleDateString()}</Text>
            </View>
        </View>
    </View>
);
