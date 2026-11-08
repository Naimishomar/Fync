import React from 'react';
import { View, ScrollView, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AppBar, Avatar, Card, IconBtn, ListRow, SectionHeader } from './ui/kit';

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
    }
];

const Socials = ({ member, openLink }: { member: typeof TEAM_MEMBERS[number]; openLink: (u: string) => void }) => (
    <View className="flex-row">
        <IconBtn name="logo-linkedin" color="#0077B5" size={20} onPress={() => openLink(member.linkedin)} accessibilityLabel={`${member.name} on LinkedIn`} />
        <IconBtn name="logo-instagram" color="#E4405F" size={20} onPress={() => openLink(member.instagram)} accessibilityLabel={`${member.name} on Instagram`} />
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
            <AppBar title="Meet the team" onBack={() => navigation.goBack()} />

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="flex-1 px-gutter">
                <SectionHeader title="Core" count={TEAM_MEMBERS.length} style={{ marginTop: 8 }} />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                    {TEAM_MEMBERS.map((member, index) => (
                        <ListRow
                            key={member.id}
                            leading={<Avatar uri={member.image} initials={member.name} size={index === 0 ? 52 : 44} />}
                            title={member.name}
                            subtitle={member.role}
                            right={<Socials member={member} openLink={openLink} />}
                        />
                    ))}
                </Card>

                <SectionHeader title="Team HQ" />
                <Card padded={false} style={{ paddingHorizontal: 16 }}>
                    <ListRow
                        icon="location-outline"
                        title="KIET Deemed University, UP"
                        subtitle="Contact us any time"
                        onPress={() => navigation.navigate('ContactUs')}
                        accessibilityLabel="Contact us"
                    />
                </Card>
                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
};

export default MeetOurTeam;
