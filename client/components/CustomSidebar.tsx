import React from 'react';
import { View, Text, Image, Pressable, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../context/auth.context';
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
        <View className="flex-1 bg-paper">
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false} bounces={false}>
                <View className="pt-16 pb-6 px-6 w-full">
                    <View className="flex-row justify-between items-start mb-5">
                        <Pressable
                            onPress={() => go('Profile')}
                            className="flex-row items-center gap-4 flex-1 mr-4"
                        >
                            <Image
                                source={{ uri: user?.avatar?.trim() ? user.avatar : `https://ui-avatars.com/api/?name=${user?.username || 'User'}` }}
                                className="h-14 w-14 rounded-full border-[3px] border-white/30 bg-card/10"
                            />
                            <View className="flex-1 justify-center">
                                <Text className="text-white text-lg font-display leading-tight" numberOfLines={1}>
                                    {user?.name || user?.username || 'Fync User'}
                                </Text>
                                <Text className="text-white/80 text-label font-semibold mt-0.5">
                                    @{user?.username || 'username'}
                                </Text>
                            </View>
                        </Pressable>

                        <Pressable
                            onPress={() => props.navigation.closeDrawer()}
                            className="w-9 h-9 bg-card rounded-full items-center justify-center border border-white/20 active:bg-black/20"
                        >
                            <Ionicons name="close" size={18} color="#F97316" />
                        </Pressable>
                    </View>

                    <Pressable
                        onPress={() => go('FyncProfileBuilder')}
                        className="flex-row items-center justify-between bg-card/10 border border-brand-300 px-4 py-3 rounded-card active:bg-card/20"
                    >
                        <View className="flex-row items-center gap-3">
                            <View className="w-10 h-10 bg-card/20 rounded-card items-center justify-center border border-brand-300">
                                {/* Vector, not emoji: emoji render differently on every
                                    OS version, cannot take a design token, and are the
                                    one icon rule the system states outright. */}
                                <Ionicons
                                    name={
                                        user?.fyncBadge === 'Legend' ? 'star'
                                        : user?.fyncBadge === 'Pioneer' ? 'rocket'
                                        : user?.fyncBadge === 'Innovator' ? 'bulb'
                                        : user?.fyncBadge === 'Builder' ? 'hammer'
                                        : user?.fyncBadge === 'Explorer' ? 'compass'
                                        : 'leaf'
                                    }
                                    size={18}
                                    color="#F97316"
                                />
                            </View>
                            <View>
                                <Text className="font-display text-label text-ink uppercase mb-0.5" style={{ letterSpacing: 1.4 }}>{user?.fyncBadge || 'Newcomer'}</Text>
                                <Text className="font-display text-lg text-ink">
                                    {user?.fyncScore || 0} <Text className="font-display text-label text-ink-3">/ 1000</Text>
                                </Text>
                            </View>
                        </View>
                        <View className="w-8 h-8 bg-card rounded-xl items-center justify-center shadow-hair">
                            <Ionicons name="arrow-forward" size={14} color="#12100E" />
                        </View>
                    </Pressable>
                </View>

                <View className="px-4 pt-4">
                    {/* The one pointer to where the features went. Without it the
                        drawer looks like features were removed, not moved. */}
                    <Pressable
                        onPress={() => go('TabNavigator', { screen: 'Explore' })}
                        className="flex-row items-center bg-card rounded-card p-4 border border-brand-100 shadow-hair mb-6 active:opacity-70"
                    >
                        <View className="w-11 h-11 rounded-card bg-paper-2 items-center justify-center border border-line mr-4">
                            <Ionicons name="compass" size={22} color="#F97316" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-semibold text-base text-ink">Explore Fync</Text>
                            <Text className="text-ink-3 text-label font-semibold mt-0.5">All features, searchable</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#C4BEB6" />
                    </Pressable>

                    <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-display uppercase">Your account</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>

                    <Pressable onPress={() => go('Profile')} className="flex-row items-center px-4 py-3.5 rounded-card active:bg-paper-2">
                        <Ionicons name="person-outline" size={20} color="#F97316" />
                        <Text className="text-ink text-sm ml-4 font-display uppercase">Profile</Text>
                    </Pressable>

                    <Pressable onPress={() => go('EditProfile')} className="flex-row items-center px-4 py-3.5 rounded-card active:bg-paper-2">
                        <Ionicons name="create-outline" size={20} color="#F97316" />
                        <Text className="text-ink text-sm ml-4 font-display uppercase">Edit Profile</Text>
                    </Pressable>

                    <Pressable onPress={() => go('SubscriptionScreen')} className="flex-row items-center px-4 py-3.5 rounded-card active:bg-paper-2">
                        <Ionicons name="diamond-outline" size={20} color="#F97316" />
                        <Text className="text-ink text-sm ml-4 font-display uppercase">Subscription</Text>
                    </Pressable>

                    <View className="flex-row items-center mt-5 mb-3" style={{ gap: 12 }}>
                      <Text className="text-ink-3 text-label font-display uppercase">Support</Text>
                      <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    </View>

                    {accountItems.map((item) => (
                        <Pressable
                            key={item.id}
                            onPress={() => go(item.route, item.params)}
                            className="flex-row items-center px-4 py-3.5 rounded-card active:bg-paper-2"
                        >
                            <Ionicons name={item.icon} size={20} color={item.tint} />
                            <Text className="text-ink text-sm ml-4 font-display uppercase flex-1">{item.label}</Text>
                            {item.id === 'admin' && (
                                <View className="bg-danger/10 border border-danger/30 px-2.5 py-1 rounded-full">
                                    <Text className="text-label text-danger font-semibold">ADMIN</Text>
                                </View>
                            )}
                        </Pressable>
                    ))}

                    <Pressable onPress={() => go('TermsAndCondition')} className="flex-row items-center px-4 py-3.5 rounded-card active:bg-paper-2">
                        <Ionicons name="document-text-outline" size={20} color="#8B857E" />
                        <Text className="text-ink text-sm ml-4 font-display uppercase">Terms & Privacy</Text>
                    </Pressable>
                </View>
            </ScrollView>
        </View>
    );
}
