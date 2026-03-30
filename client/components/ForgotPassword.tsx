import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Alert
} from 'react-native';
import React, { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from '../context/axiosConfig';
//@ts-ignore
import loginImage from '../assets/loginImage.png';

const ForgotPassword = ({ route, navigation }: any) => {
  const [email, setEmail] = useState(route.params?.email || '');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);

  const togglePassword = useCallback(() => {
    setPasswordVisible((prev) => !prev);
  }, []);

  const handleSendOtp = async () => {
    if (!email) {
      Alert.alert("Error", "Please enter your email address.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`/user/reset-password`, { email });
      if (response.data.success) {
        Alert.alert("OTP Sent", "Please check your email for the verification code.");
        setIsOtpSent(true);
      } else {
        Alert.alert("Error", response.data.message || "Failed to send OTP.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.response?.data?.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Step 2: Verify OTP & Reset Password ---
  const handleVerifyAndReset = async () => {
    if (!otp || !password) {
      Alert.alert("Error", "Please enter the OTP and your new password.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      // Call your backend verifyResetPassword endpoint
      const response = await axios.post(`/user/verify-reset-password`, {
        email,
        otp,
        password
      });

      if (response.data.success) {
        Alert.alert("Success", "Your password has been reset successfully!", [
          { text: "Login", onPress: () => navigation.navigate('Login') }
        ]);
      } else {
        Alert.alert("Error", response.data.message || "Failed to reset password.");
      }
    } catch (error: any) {
      console.error(error);
      Alert.alert("Error", error.response?.data?.message || "Invalid OTP or Server Error.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View className="flex-1 bg-[#F3F4F6]">
        {/* Background Feed */}
        <ScrollView
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View>
            <Image
              source={loginImage}
              className="w-full min-h-full rounded-2xl"
              resizeMode='cover'
            />
          </View>
          <View className="h-48" />
        </ScrollView>

        {/* Action Sheet */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          className="absolute bottom-0 w-full"
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <View className="rounded-t-[50px] bg-white px-6 pt-8 pb-10">
              <Image
                source={require('../assets/Fync.jpg')}
                className="h-20 w-20 self-center rounded-full mb-4"
                resizeMode='cover'
              />

              <Text className="text-3xl font-bold mb-6 text-center">
                {isOtpSent ? "Verify & Reset" : "Forgot Password"}
              </Text>

              {/* Email Input (Always Visible) */}
              <TextInput
                className={`mb-4 rounded-xl border border-gray-300 px-4 py-4 text-base ${isOtpSent ? 'bg-gray-100 text-gray-500' : 'bg-white text-black'}`}
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail} // Allow editing if OTP not sent yet
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isOtpSent} // Disable after OTP is sent
              />

              {/* CONDITIONAL RENDERING: Show OTP & Password only after OTP is sent */}
              {isOtpSent && (
                <>
                  {/* OTP Input */}
                  <TextInput
                    className="mb-4 rounded-xl border border-gray-300 px-4 py-4 text-base"
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#9CA3AF"
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    maxLength={6}
                  />

                  {/* Password Input */}
                  <View className="mb-6 flex-row items-center rounded-xl border border-gray-300 px-4">
                    <TextInput
                      className="flex-1 py-4 text-base"
                      placeholder="New Password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!passwordVisible}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={togglePassword}>
                      <Ionicons
                        name={passwordVisible ? 'eye-off' : 'eye'}
                        size={22}
                        color="#9CA3AF"
                      />
                    </Pressable>
                  </View>
                </>
              )}

              {/* Action Button */}
              {isLoading ? (
                <Pressable className="rounded-full bg-black py-4 items-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </Pressable>
              ) : (
                <Pressable
                  className="rounded-full bg-black py-4 items-center"
                  onPress={isOtpSent ? handleVerifyAndReset : handleSendOtp}
                >
                  <Text className="text-white text-lg font-semibold">
                    {isOtpSent ? "Reset Password" : "Send OTP"}
                  </Text>
                </Pressable>
              )}

              {/* Back to Edit Email (Optional UX improvement) */}
              {isOtpSent && !isLoading && (
                <Pressable onPress={() => setIsOtpSent(false)} className="mt-4 items-center">
                  <Text className="text-gray-500 font-medium">Change Email or Resend</Text>
                </Pressable>
              )}

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
};

export default ForgotPassword;