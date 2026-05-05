import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';

const TCSection = ({ icon, title, content }: { icon: any; title: string; content: string }) => (
  <View className="mb-6 bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
    <View className="flex-row items-center mb-3">
      <View className="w-10 h-10 rounded-2xl bg-indigo-50 items-center justify-center mr-3">
        <Ionicons name={icon} size={20} color="#6366f1" />
      </View>
      <Text className="text-zinc-900 text-lg font-black  uppercase tracking-tighter">{title}</Text>
    </View>
    <Text className="text-slate-500 text-xs font-semibold leading-5 leading-relaxed">{content}</Text>
  </View>
);

export default function TermsAndCondition() {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="dark-content" />
      <SafeAreaView className="flex-1">

        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-12 h-12 rounded-2xl bg-white border border-slate-100 items-center justify-center shadow-sm"
          >
            <Ionicons name="arrow-back" size={24} color="#1e293b" />
          </TouchableOpacity>
          <View className="items-end">
            <Text className="text-zinc-900 text-xl font-black uppercase tracking-tighter">Legal Hub</Text>
            <Text className="text-indigo-500 text-[10px] font-black uppercase tracking-widest">Fync Ecosystem</Text>
          </View>
          <View className='w-10'></View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40 }}
        >
          {/* Hero Section */}
          <LinearGradient
            colors={['#6366f1', '#a855f7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-[40px] p-8 mb-8 overflow-hidden relative"
          >
            <Ionicons name="document-text" size={120} color="rgba(255,255,255,0.1)" style={{ position: 'absolute', right: -20, bottom: -20 }} />
            <Text className="text-white text-3xl font-black  tracking-tighter mb-2">Terms & Conditions</Text>
            <Text className="text-indigo-100 text-xs font-bold leading-5">
              Please read these terms carefully before joining the exclusive student network.
            </Text>
          </LinearGradient>

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
            <Text className="text-slate-300 text-[10px] font-black uppercase tracking-[4px]">Verified By Fync Legal</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
