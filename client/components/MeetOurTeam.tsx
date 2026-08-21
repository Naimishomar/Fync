import React from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const TEAM_MEMBERS = [
    {
        id: '1',
        name: 'Naimish Omar',
        role: 'Founder',
        image: 'https://i.ibb.co/8gdSMgt8/Screenshot-2026-04-07-233722.png',
        isHighlighted: true,
        linkedin: 'https://www.linkedin.com/in/Naimishomar/',
        instagram: 'https://www.instagram.com/naimishomar/'
    },
    {
        id: '2',
        name: 'Anand Kumar Singh',
        role: 'Co-Founder',
        image: 'https://i.ibb.co/G4x2WY3K/Whats-App-Image-2026-04-05-at-1-24-41-PM.jpg',
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com'
    },
    {
        id: '3',
        name: 'Pranjali Nagpal',
        role: 'Marketing & UI/UX Lead',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com'
    },
    {
        id: '4',
        name: 'Meghna Chaudhary',
        role: 'Chief Product Officer',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com'
    },
    {
        id: '5',
        name: 'Pranjali Nagpal',
        role: 'Chief Product Officer',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com'
    },
    {
        id: '6',
        name: 'Meghna Chaudhary',
        role: 'UI & UX Lead',
        image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80',
        linkedin: 'https://linkedin.com',
        instagram: 'https://instagram.com'
    }
];

// mockup .av.ring-student is box-shadow 0 0 0 2px card, 0 0 0 4px student.
// RN has no spread shadow, so the pair becomes a 2px card pad inside a 2px
// brand border.
const Avatar = ({ uri, size }: { uri: string; size: number }) => (
    <View className="rounded-full border-2 border-brand-500 bg-card" style={{ padding: 2 }}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: 999 }} resizeMode="cover" />
    </View>
);

const Socials = ({ member, openLink }: { member: typeof TEAM_MEMBERS[number]; openLink: (u: string) => void }) => (
    <View className="flex-row" style={{ gap: 8 }}>
        <TouchableOpacity
            onPress={() => openLink(member.linkedin)}
            className="w-11 h-11 items-center justify-center rounded-xl border border-line bg-card"
            accessibilityRole="button" accessibilityLabel={`${member.name} on LinkedIn`}
        >
            <Ionicons name="logo-linkedin" size={18} color="#0077B5" />
        </TouchableOpacity>
        <TouchableOpacity
            onPress={() => openLink(member.instagram)}
            className="w-11 h-11 items-center justify-center rounded-xl border border-line bg-card"
            accessibilityRole="button" accessibilityLabel={`${member.name} on Instagram`}
        >
            <Ionicons name="logo-instagram" size={18} color="#E4405F" />
        </TouchableOpacity>
    </View>
);

const MeetOurTeam = () => {
    const navigation = useNavigation<any>();

    const openLink = (url: string) => {
        if (url) {
            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
        }
    };

    return (
        <View className="flex-1 bg-paper">
        <SafeAreaView className="flex-1" edges={['top']}>
            {/* App bar */}
            <View className="px-gutter flex-row items-center py-3">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-11 h-11 items-center justify-center rounded-xl"
                    accessibilityRole="button" accessibilityLabel="Go back"
                    style={{ marginLeft: -11 }}
                >
                    <Ionicons name="arrow-back" size={24} color="#12100E" />
                </TouchableOpacity>
                <View className="flex-1 ml-1">
                    <Text className="font-display text-h2 text-ink uppercase">Meet</Text>
                    <Text className="text-sm text-ink-3" numberOfLines={1}>Responsible for making the magic happen</Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1 px-gutter">
                {/* Display headline */}
                <View className="mt-4 mb-2">
                    <Text className="font-display text-ink uppercase" style={{ fontSize: 40, lineHeight: 42, letterSpacing: -1.2 }}>Meet</Text>
                    <Text className="font-display text-accent-text uppercase" style={{ fontSize: 40, lineHeight: 42, letterSpacing: -1.2 }}>Team</Text>
                </View>

                <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
                    <Text className="text-ink text-label font-display uppercase">Core</Text>
                    <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                    <Text className="text-ink-3 font-mono text-label">{TEAM_MEMBERS.length}</Text>
                </View>

                {TEAM_MEMBERS.map((member, index) => (
                    // the first row is this screen's one stamped card; the offset is
                    // painted as a layer because Android ignores a zero-blur shadow
                    <View key={member.id} style={{ position: 'relative', marginBottom: index === 0 ? 20 : 12 }}>
                        {index === 0 && (
                            <View
                                pointerEvents="none"
                                style={{ position: 'absolute', left: 4, top: 4, right: -4, bottom: -4, backgroundColor: '#12100E', borderRadius: 20 }}
                            />
                        )}
                        <View className={`bg-card rounded-card p-card-pad flex-row items-center ${index === 0 ? 'border-2 border-ink' : 'border border-line'}`}>
                            <Avatar uri={member.image} size={index === 0 ? 52 : 40} />
                            <View className="flex-1 mx-3">
                                <Text className="text-ink font-bold" style={{ fontSize: index === 0 ? 16 : 15 }} numberOfLines={1}>
                                    {member.name}
                                </Text>
                                <Text className="text-sm text-ink-3 mt-0.5" numberOfLines={1}>{member.role}</Text>
                            </View>
                            <Socials member={member} openLink={openLink} />
                        </View>
                    </View>
                ))}

                <View className="flex-row items-center mt-8 mb-3" style={{ gap: 12 }}>
                    <Text className="text-ink text-label font-display uppercase">Team HQ</Text>
                    <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
                </View>

                <TouchableOpacity
                    onPress={() => navigation.navigate('ContactUs')}
                    className="bg-card rounded-card p-card-pad flex-row items-center border border-line mb-10"
                    accessibilityRole="button" accessibilityLabel="Contact us"
                >
                    <Ionicons name="location-outline" size={24} color="#57534E" />
                    <View className="flex-1 mx-3">
                        <Text className="text-ink font-bold" style={{ fontSize: 14 }}>KIET Deemed University, UP</Text>
                        <Text className="text-sm text-ink-3 mt-0.5">Contact us any time</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#C4BEB6" />
                </TouchableOpacity>
                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
        </View>
    );
};

export default MeetOurTeam;
