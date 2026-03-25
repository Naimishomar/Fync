import { View, Text, ScrollView } from "react-native";

export default function TermsAndCondition() {
  return (
    <View className="flex-1 bg-white px-4 pt-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* Title */}
        <Text className="text-2xl font-bold text-gray-900 mb-4">
          Terms & Conditions
        </Text>

        {/* Intro */}
        <Text className="text-gray-600 leading-5 mb-3">
          Welcome to Fync. By using this app, you agree to the following terms and conditions.
        </Text>

        {/* Section 1 */}
        <Text className="text-lg font-semibold text-gray-800 mt-3">
          1. Usage
        </Text>
        <Text className="text-gray-600 leading-5 mt-1">
          You agree to use this app only for lawful purposes and in a way that does not harm others or violate any laws.
        </Text>

        {/* Section 2 */}
        <Text className="text-lg font-semibold text-gray-800 mt-3">
          2. User Data
        </Text>
        <Text className="text-gray-600 leading-5 mt-1">
          We may collect and store your data to improve our services. Your data will not be shared without your consent.
        </Text>

        {/* Section 3 */}
        <Text className="text-lg font-semibold text-gray-800 mt-3">
          3. Payments
        </Text>
        <Text className="text-gray-600 leading-5 mt-1">
          All payments are processed securely via third-party services. We are not responsible for failures caused by them.
        </Text>

        {/* Section 4 */}
        <Text className="text-lg font-semibold text-gray-800 mt-3">
          4. Updates
        </Text>
        <Text className="text-gray-600 leading-5 mt-1">
          We reserve the right to update these terms at any time without prior notice.
        </Text>

        {/* Section 5 */}
        <Text className="text-lg font-semibold text-gray-800 mt-3">
          5. Contact
        </Text>
        <Text className="text-gray-600 leading-5 mt-1 mb-6">
          If you have any questions, contact us at fync.dev@gmail.com
        </Text>

      </ScrollView>
    </View>
  );
}