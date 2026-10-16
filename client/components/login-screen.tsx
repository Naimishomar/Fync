import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';
import AuthPoster from './ui/AuthPoster';
import { C } from '../constants/colors';


export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const togglePassword = useCallback(
    () => setPasswordVisible((prev) => !prev),
    []
  );

  const handleSubmit = async () => {
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
        contentContainerStyle={{ flexGrow: 1, backgroundColor: '#F5F2EC' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-1 bg-ink">

          <AuthPoster mode="login" grow />

          {/* The paper sheet. Rounded at the top and pulled up over the
              masthead so the content curves away from it, rather than the two
              meeting on a hard horizontal seam. */}
          <View
            className="bg-paper rounded-t-sheet"
            style={{ marginTop: -22, paddingTop: 8, paddingBottom: 16 }}
          >

          <View className="px-gutter pt-6 pb-2 mb-5">
            {/* The logo carries its own stamp: an ink circle offset down and
                right behind it, which is the same device the cards on this
                screen use. It sits behind in source order so it renders under
                the mark without needing zIndex. */}
            <View style={{ width: 72, height: 72, alignSelf: 'center' }}>
              <View
                pointerEvents="none"
                className="absolute bg-ink rounded-full"
                style={{ left: 4, top: 4, width: 72, height: 72 }}
              />
              <Image
                source={require('../assets/fync-logo.jpg')}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  borderWidth: 2,
                  borderColor: '#12100E',
                }}
                resizeMode="cover"
                accessibilityLabel="Fync"
              />
            </View>

            {/* <Text className="font-sans text-base text-ink-2 mt-4 text-center">Sign in to continue</Text> */}
          </View>

          {/* The one stamped card on this screen. */}
          <View className="px-gutter">
            <View className="relative">
              <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
              <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Email or username</Text>
                <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                  <TextInput
                    className="flex-1 font-sans text-base text-ink"
                    placeholder="you@college.ac.in"
                    placeholderTextColor={C.ink3}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="username"
                  />
                </View>

                <Text className="font-display text-label text-ink-3 uppercase mt-4" style={{ letterSpacing: 1.4 }}>Password</Text>
                <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                  <TextInput
                    className="flex-1 font-sans text-base text-ink"
                    placeholder="••••••••"
                    placeholderTextColor={C.ink3}
                    secureTextEntry={!passwordVisible}
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="password"
                  />
                  <Pressable onPress={togglePassword} hitSlop={12} accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={C.ink3} />
                  </Pressable>
                </View>

                <Pressable className="items-end mt-3" hitSlop={8}
                  onPress={() => navigation.navigate('ForgotPassword', { email })}>
                  <Text className="font-semibold text-sm text-danger">Forgot Password?</Text>
                </Pressable>

                {/* Primary sits inside a card, so it takes the brand fill and the
                    2px rule but drops the stamp — one stamp per screen. */}
                <Pressable
                  className="mt-4 bg-brand-500 items-center justify-center border-2 border-ink rounded-md"
                  style={{ minHeight: 48 }}
                  onPress={isLoading ? undefined : handleSubmit}
                  disabled={isLoading}
                  accessibilityRole="button"
                >
                  {isLoading
                    ? <ActivityIndicator size="small" color={C.ink} />
                    : <Text className="font-display text-ink uppercase" style={{ fontSize: 14, letterSpacing: 0.3 }}>Login</Text>}
                </Pressable>

                <View className="mt-4 flex-row justify-center items-center">
                  <Text className="font-sans text-sm text-ink-2">Don’t have an account? </Text>
                  <Pressable onPress={() => navigation.navigate('Signup')} hitSlop={8}>
                    <Text className="font-semibold text-sm text-ink">Signup</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Section rule: eyebrow, 2px hard rule to the edge. */}
          <View className="px-gutter" style={{ paddingTop: 24 }}>
            <View className="flex-row items-center mb-3" style={{ gap: 12 }}>
              <Text className="font-display text-label text-ink uppercase" style={{ letterSpacing: 1.4 }}>Other ways to join</Text>
              <View className="flex-1 bg-ink" style={{ height: 2, opacity: 0.82 }} />
            </View>

            <View className="flex-row" style={{ gap: 12 }}>
              <Pressable
                className="flex-1 flex-row items-center justify-center border-[1.5px] border-line bg-card rounded-md"
                style={{ minHeight: 44 }}
                onPress={() => navigation.navigate('AlumniSignup')}
                accessibilityRole="button"
              >
                <Ionicons name="school-outline" size={15} color={C.ink} style={{ marginRight: 7 }} />
                <Text className="font-display text-ink uppercase" style={{ fontSize: 12, letterSpacing: 0.3 }}>Join as Alumni</Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md"
                style={{ minHeight: 44 }}
                onPress={() => navigation.navigate('RecruiterSignup')}
                accessibilityRole="button"
              >
                <Ionicons name="briefcase-outline" size={15} color={C.paper} style={{ marginRight: 7 }} />
                <Text className="font-display text-paper uppercase" style={{ fontSize: 12, letterSpacing: 0.3 }}>Join as Recruiter</Text>
              </Pressable>
            </View>
          </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
