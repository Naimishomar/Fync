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
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';
import { Button, FormField } from './ui/kit';
import { isFeatureOn } from '../constants/features';
import { useBottomInset } from '../constants/layout';


export default function LoginScreen() {
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
        contentContainerStyle={{ flexGrow: 1, backgroundColor: C.paper }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 bg-night">

          <AuthPoster mode="login" grow />

          {/* The paper sheet. Rounded at the top and pulled up over the
              masthead so the content curves away from it, rather than the two
              meeting on a hard horizontal seam. */}
          <View
            className="bg-paper rounded-t-sheet"
            style={{ marginTop: -22, paddingTop: 8, paddingBottom: bottomInset }}
          >

          <View className="px-gutter pt-6 pb-2 mb-5">
            <Image
              source={require('../assets/fync-logo.jpg')}
              style={{ width: 72, height: 72, borderRadius: 36, alignSelf: 'center' }}
              resizeMode="cover"
              accessibilityLabel="Fync"
            />
          </View>

          <View className="px-gutter">
            <View className="bg-card border border-line rounded-2xl p-4" style={{ gap: 16 }}>
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
          </View>

          <View className="px-gutter" style={{ paddingTop: 24 }}>
            <Text className="font-semibold text-sm text-ink-3 mb-3">Other ways to join</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {isFeatureOn('alumniSignup') && (
                <Button style={{ flex: 1 }} icon="school-outline" title="Join as alumni"
                  onPress={() => navigation.navigate('AlumniSignup')} />
              )}
              <Button style={{ flex: 1 }} icon="briefcase-outline" title="Join as recruiter"
                onPress={() => navigation.navigate('RecruiterSignup')} />
            </View>
          </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
