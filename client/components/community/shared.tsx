/**
 * Pieces the club and community screens both draw: hub banner, image picker
 * tile, room tile, member row, approve/reject pair, chat composer, vote
 * control, payment web view. Soft style, tokens only.
 */
import React, { memo } from 'react';
import { View, Text, Pressable, TextInput, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { C } from '../../constants/colors';
import { AppBar, ListRow, Label } from '../ui/kit';
import Avatar from '../Avatar';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070';

export const PLANS = ['monthly', 'yearly'] as const;
export const PLAN_LABELS = { monthly: 'Monthly · ₹99', yearly: 'Yearly · ₹999' };

/** "5m", "3h", "2d". */
export const ago = (iso?: string) => {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(t)) return '';
    const mins = Math.floor((Date.now() - t) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
};

export const clock = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

/* ------------------------------------------------------------- hub banner */
/** Photo header with an overlay app bar, logo, name and one meta line. Fixed dark scrim: it sits on a photo. */
export function HubBanner({
    banner, logo, name, meta, onBack, right, height = 288,
}: {
    banner?: string; logo?: string; name: string; meta?: string;
    onBack: () => void; right?: React.ReactNode; height?: number;
}) {
    return (
        <View style={{ height, width: '100%' }}>
            <Image source={{ uri: banner || FALLBACK_BANNER }} style={[StyleSheet.absoluteFill, { backgroundColor: C.paper2 }]} contentFit="cover" cachePolicy="memory-disk" />
            <LinearGradient colors={['rgba(0,0,0,0.45)', 'transparent', 'rgba(0,0,0,0.8)']} style={StyleSheet.absoluteFill} />
            <View className="absolute top-0 left-0 right-0">
                <AppBar overlay onBack={onBack} right={right} />
            </View>
            <View className="absolute left-5 right-5 flex-row items-center" style={{ bottom: 20, gap: 16 }}>
                <View className="w-20 h-20 rounded-2xl overflow-hidden bg-paper-2" style={{ borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' }}>
                    {logo ? <Image source={{ uri: logo }} style={{ width: '100%', height: '100%' }} cachePolicy="memory-disk" /> : null}
                </View>
                <View className="flex-1" style={{ minWidth: 0 }}>
                    <Text className="text-white font-display" style={{ fontSize: 26, lineHeight: 30 }} numberOfLines={2} accessibilityRole="header">{name}</Text>
                    {meta ? <Text className="font-medium mt-1" style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }} numberOfLines={1}>{meta}</Text> : null}
                </View>
            </View>
        </View>
    );
}

/* ------------------------------------------------------------ image picker */
/** Dashed paper-2 tile: the picked image, or an icon and a label. */
export function ImagePick({
    uri, onPress, label, icon = 'image-outline', style, disabled,
}: { uri?: string | null; onPress?: () => void; label: string; icon?: IconName; style?: any; disabled?: boolean }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || !onPress}
            accessibilityRole="button"
            accessibilityLabel={uri ? `Change ${label.toLowerCase()}` : label}
            className="bg-paper-2 rounded-2xl border border-dashed border-line items-center justify-center overflow-hidden active:opacity-70"
            style={style}
        >
            {uri ? (
                <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
                <View className="items-center" style={{ gap: 6 }}>
                    <Ionicons name={icon} size={24} color={C.ink3} />
                    <Label>{label}</Label>
                </View>
            )}
        </Pressable>
    );
}

/* -------------------------------------------------------------- room tile */
/** 44px rounded tile for a room/channel row: its logo, or a line icon. */
export const RoomIcon = memo(function RoomIcon({ uri, icon = 'chatbubbles-outline', size = 44 }: { uri?: string; icon?: IconName; size?: number }) {
    return (
        <View className="bg-paper-2 items-center justify-center overflow-hidden" style={{ width: size, height: size, borderRadius: 12 }}>
            {uri ? <Image source={{ uri }} style={{ width: size, height: size }} cachePolicy="memory-disk" /> : <Ionicons name={icon} size={20} color={C.ink2} />}
        </View>
    );
});

/* ------------------------------------------------------------- member row */
/** Avatar + name + @username (or `subtitle`), trailing actions. */
export const MemberRow = memo(function MemberRow({
    person, subtitle, right, size = 44, dim,
}: { person: any; subtitle?: string; right?: React.ReactNode; size?: number; dim?: boolean }) {
    return (
        <ListRow
            leading={<Avatar user={person} size={size} showBadge={false} />}
            title={person?.name || person?.username || 'Member'}
            subtitle={subtitle ?? (person?.username ? `@${person.username}` : undefined)}
            right={right}
            style={dim ? { opacity: 0.6 } : undefined}
        />
    );
});

/* ------------------------------------------------------- approve / reject */
export function DecideButtons({
    onApprove, onReject, disabled, name,
}: { onApprove: () => void; onReject: () => void; disabled?: boolean; name?: string }) {
    return (
        <View className="flex-row" style={{ gap: 8 }}>
            <Pressable
                onPress={onApprove}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={name ? `Approve ${name}` : 'Approve'}
                className="w-11 h-11 rounded-full bg-success items-center justify-center active:opacity-70"
                style={disabled ? { opacity: 0.5 } : undefined}
            >
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable
                onPress={onReject}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={name ? `Decline ${name}` : 'Decline'}
                className="w-11 h-11 rounded-full bg-paper-2 items-center justify-center active:opacity-70"
                style={disabled ? { opacity: 0.5 } : undefined}
            >
                <Ionicons name="close" size={20} color={C.ink2} />
            </Pressable>
        </View>
    );
}

/* ---------------------------------------------------------- chat composer */
/** Card bar: optional attach, rounded input, round send. `locked` replaces it with a note. */
export function ChatComposer({
    value, onChangeText, onSend, sending, placeholder = 'Message', onAttach, locked, top,
}: {
    value: string; onChangeText: (t: string) => void; onSend: () => void; sending?: boolean;
    placeholder?: string; onAttach?: () => void; locked?: string | false; top?: React.ReactNode;
}) {
    if (locked) {
        return (
            <View className="bg-card px-5 py-3 border-t border-line">
                <View className="bg-paper-2 rounded-2xl flex-row items-center justify-center" style={{ minHeight: 48, gap: 8 }}>
                    <Ionicons name="lock-closed-outline" size={16} color={C.ink3} />
                    <Text className="text-ink-3 font-medium" style={{ fontSize: 13 }}>{locked}</Text>
                </View>
            </View>
        );
    }
    const canSend = !!value.trim() && !sending;
    return (
        <View className="bg-card px-5 py-3 border-t border-line">
            {top}
            <View className="flex-row items-end" style={{ gap: 8 }}>
                {onAttach ? (
                    <Pressable onPress={onAttach} accessibilityRole="button" accessibilityLabel="Attach file" className="w-11 h-11 rounded-full bg-paper-2 items-center justify-center active:opacity-70">
                        <Ionicons name="attach" size={22} color={C.ink2} />
                    </Pressable>
                ) : null}
                <View className="flex-1 bg-paper-2 rounded-3xl px-4 justify-center" style={{ minHeight: 44, maxHeight: 128 }}>
                    <TextInput
                        placeholder={placeholder}
                        placeholderTextColor={C.ink3}
                        className="text-ink font-sans"
                        style={{ fontSize: 15, paddingVertical: 10 }}
                        multiline
                        value={value}
                        onChangeText={onChangeText}
                        accessibilityLabel={placeholder}
                    />
                </View>
                <Pressable
                    onPress={onSend}
                    disabled={!canSend}
                    accessibilityRole="button"
                    accessibilityLabel="Send"
                    accessibilityState={{ disabled: !canSend, busy: !!sending }}
                    className={`w-11 h-11 rounded-full items-center justify-center active:opacity-70 ${canSend ? 'bg-brand-500' : 'bg-paper-2'}`}
                >
                    {sending ? <ActivityIndicator size="small" color={C.ink} /> : <Ionicons name="arrow-up" size={22} color={canSend ? C.onBrand : C.ink4} />}
                </Pressable>
            </View>
        </View>
    );
}

/* ----------------------------------------------------------- vote control */
/** Up / score / down. `vertical` for a feed rail. State shows by filled icon, not colour alone. */
export function VoteControl({
    score, myVote, onVote, vertical,
}: { score: number; myVote?: number; onVote: (dir: 1 | -1) => void; vertical?: boolean }) {
    const up = myVote === 1;
    const down = myVote === -1;
    return (
        <View className={`items-center bg-paper-2 rounded-full ${vertical ? '' : 'flex-row'}`} style={{ padding: 2 }}>
            <Pressable onPress={() => onVote(1)} hitSlop={4} accessibilityRole="button" accessibilityLabel="Upvote" accessibilityState={{ selected: up }} className="w-10 h-10 items-center justify-center active:opacity-60">
                <Ionicons name={up ? 'arrow-up-circle' : 'arrow-up-circle-outline'} size={24} color={up ? C.brand[500] : C.ink3} />
            </Pressable>
            <Text className="text-ink font-display" style={{ fontSize: 14, minWidth: 20, textAlign: 'center', fontVariant: ['tabular-nums'] }}>{score}</Text>
            <Pressable onPress={() => onVote(-1)} hitSlop={4} accessibilityRole="button" accessibilityLabel="Downvote" accessibilityState={{ selected: down }} className="w-10 h-10 items-center justify-center active:opacity-60">
                <Ionicons name={down ? 'arrow-down-circle' : 'arrow-down-circle-outline'} size={24} color={down ? C.info : C.ink3} />
            </Pressable>
        </View>
    );
}

/* -------------------------------------------------------- payment webview */
/** Full-screen Razorpay web checkout fallback. */
export function PayWebView({ html, visible, onMessage, onClose }: { html: string; visible: boolean; onMessage: (e: any) => void; onClose: () => void }) {
    return (
        <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-paper" edges={['bottom']}>
                <AppBar title="Secure payment" onBack={onClose} />
                <WebView
                    source={{ html }}
                    onMessage={onMessage}
                    javaScriptEnabled
                    domStorageEnabled
                    originWhitelist={['*']}
                    style={{ flex: 1, backgroundColor: C.paper }}
                />
            </SafeAreaView>
        </Modal>
    );
}
