import React from 'react';
import {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    Dimensions,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const TEAM_MEMBERS = [
    {
        id: '1',
        name: 'Naimish Omar',
        role: 'Founder & CEO',
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

const MeetOurTeam = () => {
    const navigation = useNavigation();

    const openLink = (url: string) => {
        if (url) {
            Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                {/* Title Section */}
                <View className="items-center px-10 mb-16 mt-3">
                    <View className="flex-row items-baseline">
                        <Text className="text-4xl font-extrabold text-[#1A1A1A] tracking-[4px]">
                            MEET
                        </Text>
                        <Text className="text-xl font-serif text-pink-500 mx-2 italic mb-[-5px]">
                            the
                        </Text>
                        <Text className="text-4xl font-extrabold text-[#1A1A1A] tracking-[4px]">
                            TEAM
                        </Text>
                    </View>
                    <Text className="text-[11px] text-gray-400 font-bold tracking-[2px] mt-4 uppercase text-center">
                        Responsible for making the magic happen
                    </Text>
                </View>

                {/* Team Grid */}
                <View className="flex-row flex-wrap px-4 pb-10">
                    {TEAM_MEMBERS.map((member) => {
                        return (
                            <View key={member.id} style={{ width: '50%' }} className="items-center mb-12 px-3">
                                {/* Circular Frame */}
                                <View 
                                    className={`relative w-36 h-36 rounded-full items-center justify-center p-1 overflow-hidden ${member.isHighlighted ? 'bg-cyan-400' : 'bg-gray-100'}`}
                                >
                                    <Image 
                                        source={{ uri: member.image }} 
                                        className="w-full h-full rounded-full"
                                        resizeMode="cover"
                                    />
                                    {/* Overlay for grayscale effect if not highlighted */}
                                    {!member.isHighlighted && (
                                        <View className="absolute inset-0 bg-gray-500/10" />
                                    )}
                                </View>

                                {/* Member Details */}
                                <View className="mt-5 items-center">
                                    <Text className="text-[14px] font-black text-[#1A1A1A] tracking-[1.5px] text-center uppercase">
                                        {member.name}
                                    </Text>
                                    <Text className="text-[11px] text-gray-400 font-semibold italic mt-1 text-center">
                                        {member.role}
                                    </Text>
                                    
                                    {/* Social Icons (matching the UI style) */}
                                    <View className="flex-row mt-3 gap-5">
                                        <TouchableOpacity onPress={() => openLink(member.linkedin)}>
                                            <Ionicons name="logo-linkedin" size={18} color="#0077B5" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => openLink(member.instagram)}>
                                            <Ionicons name="logo-instagram" size={18} color="#E4405F" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

export default MeetOurTeam;