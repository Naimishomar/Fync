import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const TCSection = ({ icon, title, content }: { icon: any; title: string; content: string }) => (
  <View className="mb-6 bg-card rounded-card p-5 border border-line shadow-hair">
    <View className="flex-row items-center mb-3">
      <View className="w-10 h-10 rounded-card bg-recruiter/10 items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color="#4F46E5" />
      </View>
      <Text className="text-ink text-lg font-display uppercase">{title}</Text>
    </View>
    <Text className="text-ink-3 text-xs font-semibold leading-5 leading-relaxed">{content}</Text>
  </View>
);

export default function TermsAndCondition() {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-11 h-11 items-center justify-center rounded-xl"
          
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={{ marginLeft: -11 }}>
            <Ionicons name="arrow-back" size={24} color="#12100E" />
          </TouchableOpacity>
          <View className="items-end">
            <Text className="text-ink text-xl font-display uppercase">Legal Hub</Text>
            <Text className="text-recruiter text-label font-display uppercase">Fync Ecosystem</Text>
          </View>
          <View className='w-10'></View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 }}
        >
          {/* Hero Section */}
          <View
            className="rounded-sheet p-card-pad mb-8 overflow-hidden relative"
           style={{ backgroundColor: '#4F46E5' }}>
            <Ionicons name="document-text" size={120} color="rgba(255,255,255,0.1)" style={{ position: 'absolute', right: -20, bottom: -20 }} />
            <Text className="text-white text-3xl font-display mb-2">Terms & Conditions</Text>
            <Text className="text-white/80 text-xs font-semibold leading-5">
              Please read these terms carefully before joining the exclusive student network.
            </Text>
          </View>

          {/* Sections */}
          <TCSection
            icon="shield-checkmark"
            title="1.Usage"
            content="You agree to use this app only for lawful purposes. Any activity that harms, harasses, or violates the rights of other students is strictly prohibited and may result in permanent termination of your account."
          />

          <TCSection
            icon="lock-closed"
            title="2.User Data"
            content="Your privacy is our priority. We collect data to improve your experience and match you with relevant opportunities. We will never sell your personal information to third parties without your explicit consent."
          />

          <TCSection
            icon="card"
            title="3.Payments"
            content="All financial transactions, including funding and gig payments, are processed through secure, industry-standard third-party providers. Fync is not liable for transaction failures caused by external banking systems."
          />

          <TCSection
            icon="sync"
            title="4.Updates"
            content="The student ecosystem is fast-moving. We reserve the right to modify these terms at any time. Significant changes will be announced via the dashboard or email."
          />

          <TCSection
            icon="mail"
            title="5.Contact"
            content="Questions or concerns? Reach out to our legal and support team directly at fync.dev@gmail.com — we're here to help you build your future."
          />

          <View className="mt-4 items-center">
            <Text className="text-ink-4 text-label font-display uppercase">Verified By Fync Legal</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
