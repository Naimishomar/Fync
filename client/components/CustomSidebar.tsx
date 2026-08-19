import React from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';
import { LinearGradient } from 'expo-linear-gradient';
import { visibleFeatures } from '../constants/features';

/**
 * The drawer used to be the app's only feature menu: ~35 rows across seven
 * collapsible sections, which is what made Fync read as "too many features".
 * Those now live in the Explore tab, where they are searchable and grouped.
 * What is left here is identity and account — the things that genuinely belong
 * behind a menu rather than in the main navigation.
 */
export default function CustomSidebar(props: any) {
    const { user } = useAuth();

    // Sourced from the same registry Explore uses, so an access-gated item such
    // as Admin Portal cannot fall out of sync between the two surfaces.
    const accountItems = visibleFeatures(user).filter((f) => f.category === 'account');

    const go = (route: string, params?: object) => {
        props.navigation.closeDrawer();
        props.navigation.navigate(route, params);
    };

    return (
        <View className="flex-1 bg-[#F8FAFC]">
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} bounces={false}>
                <LinearGradient colors={['#f97316', 'transparent']} className="pt-16 pb-6 px-6 w-full">
                    <View className="flex-row justify-between items-start mb-5">
                        <Pressable
                            onPress={() => go('Profile')}
                            className="flex-row items-center gap-4 flex-1 mr-4"
                        >
                            <Image
                                source={{ uri: user?.avatar?.trim() ? user.avatar : `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                                className="h-14 w-14 rounded-full border-[3px] border-white/30 bg-white/10"
                            />
                            <View className="flex-1 justify-center">
                                <Text className="text-white text-lg font-black tracking-tight leading-tight" numberOfLines={1}>
                                    {user?.name || user?.username || 'Fync User'}
                                </Text>
                                <Text className="text-white/80 text-2xs font-bold mt-0.5 tracking-wide">
                                    @{user?.username || 'username'}
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => props.navigation.closeDrawer()}
                            className="w-9 h-9 bg-white rounded-full items-center justify-center border border-white/20 active:bg-black/20"
                        >
                            <Ionicons name="close" size={18} color="#f97316" />
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={() => go('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-white/10 border border-orange-300 px-4 py-3 rounded-3xl active:bg-white/20"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-white/20 rounded-2xl items-center justify-center border border-orange-300">
                                <Text style={{ fontSize: 18 }}>
                                    {user?.fyncBadge === 'Legend' ? '🌟' : user?.fyncBadge === 'Pioneer' ? '🚀' : user?.fyncBadge === 'Innovator' ? '💡' : user?.fyncBadge === 'Builder' ? '🔨' : user?.fyncBadge === 'Explorer' ? '🗺️' : '🌱'}
                                </Text>
                            </View>
                            <View>
                                <Text className="text-black text-2xs font-black uppercase tracking-wide mb-0.5">{user?.fyncBadge || 'Newcomer'}</Text>
                                <Text className="text-black text-base font-black uppercase tracking-tight">
                                    {user?.fyncScore || 0} <Text className="text-black text-2xs font-bold tracking-wide">/ 1000</Text>
                                </Text>
                            </View>
                        </View>
                        <View className="w-8 h-8 bg-white rounded-xl items-center justify-center shadow-lg shadow-black/20">
                            <Ionicons name="arrow-forward" size={14} color="#000" />
                        </View>
                    </Pressable>
                </LinearGradient>

                <View className="px-4 pt-4">
                    {/* The one pointer to where the features went. Without it the
                        drawer looks like features were removed, not moved. */}
                    <Pressable
                        onPress={() => go('TabNavigator', { screen: 'Explore' })}
                        className="flex-row items-center bg-white rounded-2xl p-4 border border-orange-100 shadow-sm mb-6 active:opacity-70"
                    >
                        <View className="w-11 h-11 rounded-2xl bg-orange-50 items-center justify-center border border-orange-100 mr-4">
                            <Ionicons name="compass" size={22} color="#f97316" />
                        </View>
                        <View className="flex-1">
                            <Text className="text-slate-900 font-black uppercase text-xs tracking-tight">Explore Fync</Text>
                            <Text className="text-slate-500 text-2xs font-bold tracking-wide mt-0.5">All features, searchable</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                    </Pressable>

                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-3 ml-2">Your account</Text>

                    <Pressable onPress={() => go('Profile')} className="flex-row items-center px-4 py-3.5 rounded-2xl active:bg-slate-100">
                        <Ionicons name="person-outline" size={20} color="#f97316" />
                        <Text className="text-slate-900 text-sm ml-4 font-black uppercase tracking-tight">Profile</Text>
                    </Pressable>

                    <Pressable onPress={() => go('EditProfile')} className="flex-row items-center px-4 py-3.5 rounded-2xl active:bg-slate-100">
                        <Ionicons name="create-outline" size={20} color="#f97316" />
                        <Text className="text-slate-900 text-sm ml-4 font-black uppercase tracking-tight">Edit Profile</Text>
                    </Pressable>

                    <Pressable onPress={() => go('SubscriptionScreen')} className="flex-row items-center px-4 py-3.5 rounded-2xl active:bg-slate-100">
                        <Ionicons name="diamond-outline" size={20} color="#f97316" />
                        <Text className="text-slate-900 text-sm ml-4 font-black uppercase tracking-tight">Subscription</Text>
                    </Pressable>

                    <Text className="text-slate-500 text-2xs font-black uppercase tracking-wide mb-3 mt-5 ml-2">Support</Text>

                    {accountItems.map((item) => (
                        <Pressable
                            key={item.id}
                            onPress={() => go(item.route, item.params)}
                            className="flex-row items-center px-4 py-3.5 rounded-2xl active:bg-slate-100"
                        >
                            <Ionicons name={item.icon} size={20} color={item.tint} />
                            <Text className="text-slate-900 text-sm ml-4 font-black uppercase tracking-tight flex-1">{item.label}</Text>
                            {item.id === 'admin' && (
                                <View className="bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/30">
                                    <Text className="text-2xs text-rose-600 font-bold">ADMIN</Text>
                                </View>
                            )}
                        </Pressable>
                    ))}

                    <Pressable onPress={() => go('TermsAndCondition')} className="flex-row items-center px-4 py-3.5 rounded-2xl active:bg-slate-100">
                        <Ionicons name="document-text-outline" size={20} color="#64748b" />
                        <Text className="text-slate-900 text-sm ml-4 font-black uppercase tracking-tight">Terms & Privacy</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}
