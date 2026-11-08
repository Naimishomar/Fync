import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Avatar, Card, IconBtn, IconTile, ListRow, SectionHeader, Tag } from './ui/kit';
import { useAuth } from '../context/auth.context';
import { visibleFeatures } from '../constants/features';
import { C } from '../constants/colors';
import { getFullUrl } from '../utils/imageUtils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProfileQRCard from './ui/ProfileQR';

/**
 * The drawer used to be the app's only feature menu: ~35 rows across seven
 * collapsible sections, which is what made Fync read as "too many features".
 * Those now live in the Explore tab, where they are searchable and grouped.
 * What is left here is identity and account — the things that genuinely belong
 * behind a menu rather than in the main navigation.
 */
export default function CustomSidebar(props: any) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    // Sourced from the same registry Explore uses, so an access-gated item such
    // as Admin Portal cannot fall out of sync between the two surfaces.
    // Contact, Meet the Team and Terms moved into Settings, so the drawer keeps
    // only the access-gated tools. Store Admin is reached through the Admin
    // Portal itself, so listing it here as well was a second door to one room.
    const IN_ADMIN_PORTAL = ['storeAdmin'];
    const accountItems = visibleFeatures(user).filter(
        (f) => f.category === 'account' && f.access?.length && !IN_ADMIN_PORTAL.includes(f.id),
    );

    const go = (route: string, params?: object) => {
        props.navigation.closeDrawer();
        props.navigation.navigate(route, params);
    };

    const badge = user?.fyncBadge || 'Newcomer';
    const badgeIcon =
        badge === 'Legend' ? 'star'
        : badge === 'Pioneer' ? 'rocket'
        : badge === 'Innovator' ? 'bulb'
        : badge === 'Builder' ? 'hammer'
        : badge === 'Explorer' ? 'compass'
        : 'leaf';

    return (
        <View className="flex-1 bg-paper">
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 + insets.bottom }} showsVerticalScrollIndicator={false} bounces={false}>
                {/* Inset-based top so the header clears any status bar / notch. */}
                <View className="px-5 pb-4" style={{ paddingTop: insets.top + 16 }}>
                    <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
                        <Pressable
                            onPress={() => go('Profile')}
                            className="flex-row items-center flex-1 active:opacity-70"
                            style={{ gap: 12 }}
                            accessibilityRole="button"
                            accessibilityLabel="Open your profile"
                        >
                            <Avatar uri={getFullUrl(user?.avatar?.trim()) || undefined} initials={user?.name || user?.username} size={56} />
                            <View className="flex-1">
                                <Text className="text-ink text-lg font-semibold" numberOfLines={1}>
                                    {user?.name || user?.username || 'Fync User'}
                                </Text>
                                <Text className="text-ink-3 text-sm" numberOfLines={1}>
                                    @{user?.username || 'username'}
                                </Text>
                            </View>
                        </Pressable>
                        <IconBtn name="close" boxed onPress={() => props.navigation.closeDrawer()} accessibilityLabel="Close menu" style={{ marginRight: -4 }} />
                    </View>

                    {/* Paytm-style: your scannable profile code, right under your name. */}
                    <View className="mb-3">
                        <ProfileQRCard user={user as any} onNavigate={() => props.navigation.closeDrawer()} />
                    </View>

                    <Card padded={false} style={{ paddingHorizontal: 16 }}>
                        {/* Vector, not emoji: emoji render differently per OS and cannot take a token. */}
                        <ListRow
                            icon={badgeIcon}
                            title={`${user?.fyncScore || 0} / 1000`}
                            subtitle={`${badge} · Fync score`}
                            onPress={() => go('FyncProfileBuilder')}
                        />
                    </Card>
                </View>

                <View className="px-5">
                    {/* The one pointer to where the features went. Without it the
                        drawer looks like features were removed, not moved. */}
                    <Card padded={false} style={{ paddingHorizontal: 16 }}>
                        <ListRow
                            icon="compass-outline"
                            title="Explore Fync"
                            subtitle="All features, searchable"
                            onPress={() => go('TabNavigator', { screen: 'Explore' })}
                        />
                    </Card>

                    <SectionHeader title="Your account" />
                    <ListRow icon="person-outline" title="Profile" onPress={() => go('Profile')} />
                    <ListRow icon="settings-outline" title="Settings" onPress={() => go('SettingsScreen')} />

                    {accountItems.length > 0 && <SectionHeader title="Admin" />}
                    {accountItems.map((item) => (
                        <ListRow
                            key={item.id}
                            leading={<IconTile icon={item.icon} color={item.tint} />}
                            title={item.label}
                            onPress={() => go(item.route, item.params)}
                            right={item.id === 'admin' ? <Tag label="Admin" tone={{ fg: C.danger }} /> : undefined}
                            chevron
                        />
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
