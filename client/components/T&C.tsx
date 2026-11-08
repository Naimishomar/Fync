import React from 'react';
import { View, Text, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { C } from '../constants/colors';
import { AppBar, Card, IconTile } from './ui/kit';

const TCSection = ({ icon, title, content }: { icon: any; title: string; content: string }) => (
  <Card style={{ marginBottom: 12 }}>
    <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
      <IconTile icon={icon} size={40} iconSize={20} />
      <Text className="text-ink text-base font-semibold" accessibilityRole="header">{title}</Text>
    </View>
    <Text className="text-ink-2 text-sm leading-5">{content}</Text>
  </Card>
);

export default function TermsAndCondition() {
  const navigation = useNavigation<any>();

  return (
    <View className="flex-1 bg-paper">
      <StatusBar barStyle={C.barStyle} />
      <SafeAreaView className="flex-1" edges={['bottom']}>

        <AppBar title="Terms & Conditions" onBack={() => navigation.goBack()} />

        <ScrollView keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 }}
        >
          {/* Hero Section */}
          <View className="rounded-2xl bg-paper-2 p-4 mb-6 overflow-hidden">
            <Text className="text-ink-2 text-sm leading-5">
              Please read these terms carefully before joining the exclusive student network.
            </Text>
          </View>

          {/* Sections */}
          <TCSection
            icon="shield-checkmark"
            title="1. Usage"
            content="You agree to use this app only for lawful purposes. Any activity that harms, harasses, or violates the rights of other students is strictly prohibited and may result in permanent termination of your account."
          />

          <TCSection
            icon="lock-closed"
            title="2. User Data"
            content="Your privacy is our priority. We collect data to improve your experience and match you with relevant opportunities. We will never sell your personal information to third parties without your explicit consent."
          />

          <TCSection
            icon="card"
            title="3. Payments"
            content="All financial transactions, including funding and gig payments, are processed through secure, industry-standard third-party providers. Fync is not liable for transaction failures caused by external banking systems."
          />

          <TCSection
            icon="sync"
            title="4. Updates"
            content="The student ecosystem is fast-moving. We reserve the right to modify these terms at any time. Significant changes will be announced via the dashboard or email."
          />

          <TCSection
            icon="mail"
            title="5. Contact"
            content="Questions or concerns? Reach out to our legal and support team directly at fync.dev@gmail.com — we're here to help you build your future."
          />

          <View className="mt-4 items-center">
            <Text className="text-ink-3 text-label font-semibold">Verified by Fync Legal</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
