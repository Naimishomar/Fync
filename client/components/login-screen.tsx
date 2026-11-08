import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import AuthHeader from './onboarding/AuthHeader';
import OnboardingGate from './onboarding/Onboarding';
import { C } from '../constants/colors';
import { Button, FormField } from './ui/kit';
import { isFeatureOn } from '../constants/features';
import { useBottomInset } from '../constants/layout';


export default function LoginScreen() {
  return <OnboardingGate><LoginForm /></OnboardingGate>;
}

function LoginForm() {
  const navigation = useNavigation<any>();
  const { login } = useAuth();
  const bottomInset = useBottomInset();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePassword = useCallback(
    () => setPasswordVisible((prev) => !prev),
    []
  );

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Toast.show({ type: 'error', text1: 'Enter your email and password' });
      return;
    }
    try {
      setIsLoading(true);
      // Keyboards and autofill leave a trailing space that fails the lookup.
      await login(email.trim(), password);
      Toast.show({
        type: 'success',
        text1: 'Logged in successfully!',

      });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Login failed',
        text2: error?.response?.data?.message || 'Something went wrong',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 'padding' on both platforms, not undefined on Android. targetSdkVersion
    // 35 puts the app in Android 15's enforced edge-to-edge mode, where the
    // window no longer resizes for the keyboard — so softwareKeyboardLayoutMode
    // "resize" in app.json stops having any effect, and an undefined behavior
    // meant no avoidance at all.
    <KeyboardAvoidingView
      behavior="padding"
      style={{ flex: 1 }}
      className="bg-paper"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: bottomInset + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthHeader title="Welcome back" sub="Log in to pick up where your campus left off." />

        <View className="px-gutter" style={{ gap: 16 }}>
          <FormField
            label="Email or username"
            placeholder="you@college.ac.in"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="username"
          />
          <View>
            <FormField
              label="Password"
              placeholder="••••••••"
              secureTextEntry={!passwordVisible}
              value={password}
              onChangeText={setPassword}
              autoComplete="password"
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
              right={
                <Pressable onPress={togglePassword} hitSlop={12} accessibilityRole="button" className="active:opacity-85"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                  <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
                </Pressable>
              }
            />
            <Pressable className="self-end mt-3 active:opacity-85" hitSlop={12} accessibilityRole="button"
              onPress={() => navigation.navigate('ForgotPassword', { email })}>
              <Text className="font-semibold text-sm text-accent-text">Forgot password?</Text>
            </Pressable>
          </View>

          <Button variant="primary" block title="Log in" onPress={handleSubmit} loading={isLoading} />

          <View className="flex-row justify-center items-center">
            <Text className="font-sans text-sm text-ink-2">Don’t have an account? </Text>
            <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={12} accessibilityRole="button" className="active:opacity-85">
              <Text className="font-semibold text-sm text-accent-text">Sign up</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-1" />

        <View className="px-gutter pt-8">
          <View className="flex-row items-center mb-4" style={{ gap: 12 }}>
            <View className="flex-1 h-px bg-line" />
            <Text className="font-semibold text-sm text-ink-3">Other ways to join</Text>
            <View className="flex-1 h-px bg-line" />
          </View>
          <View className="flex-row" style={{ gap: 12 }}>
            {isFeatureOn('alumniSignup') && (
              <Button style={{ flex: 1 }} icon="school-outline" title="Alumni"
                accessibilityLabel="Join as alumni" onPress={() => navigation.navigate('AlumniSignup')} />
            )}
            <Button style={{ flex: 1 }} icon="briefcase-outline" title="Recruiter"
              accessibilityLabel="Join as recruiter" onPress={() => navigation.navigate('RecruiterSignup')} />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
