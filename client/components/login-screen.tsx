import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/auth.context';
import { useNavigation } from '@react-navigation/native';


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
      await login(email, password);
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
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView 
        contentContainerStyle={{ flexGrow: 1 }} 
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 bg-paper">

          {/* A poster, not a photo. The old stock image said nothing about the
              product; the wordmark and the promise do. */}
          <View className="px-gutter pt-16 pb-2">
            <Text className="font-display text-5xl text-ink uppercase" style={{ letterSpacing: -1.6 }}>Fync</Text>
            <Text className="font-sans text-base text-ink-2 mt-3">Login to the exclusive student network</Text>
          </View>

          {/* The one stamped card on this screen. */}
          <View className="px-gutter mt-6">
            <View className="relative">
              <View pointerEvents="none" className="absolute left-1 top-1 -right-1 -bottom-1 bg-ink rounded-card" />
              <View className="bg-card border-2 border-ink rounded-card p-card-pad">

                <Text className="font-display text-label text-ink-3 uppercase" style={{ letterSpacing: 1.4 }}>Email or username</Text>
                <View className="mt-2 flex-row items-center border-[1.5px] border-ink bg-card px-4 rounded-md" style={{ minHeight: 50 }}>
                  <TextInput
                    className="flex-1 font-sans text-base text-ink"
                    placeholder="you@college.ac.in"
                    placeholderTextColor="#8B857E"
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
                    placeholderTextColor="#8B857E"
                    secureTextEntry={!passwordVisible}
                    value={password}
                    onChangeText={setPassword}
                    autoComplete="password"
                  />
                  <Pressable onPress={togglePassword} hitSlop={12} accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}>
                    <Ionicons name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color="#8B857E" />
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
                    ? <ActivityIndicator size="small" color="#12100E" />
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
          <View className="px-gutter">
            <View className="flex-row items-center mt-6 mb-3" style={{ gap: 12 }}>
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
                <Ionicons name="school-outline" size={15} color="#12100E" style={{ marginRight: 7 }} />
                <Text className="font-display text-ink uppercase" style={{ fontSize: 12, letterSpacing: 0.3 }}>Join as Alumni</Text>
              </Pressable>
              <Pressable
                className="flex-1 flex-row items-center justify-center bg-ink border-2 border-ink rounded-md"
                style={{ minHeight: 44 }}
                onPress={() => navigation.navigate('RecruiterSignup')}
                accessibilityRole="button"
              >
                <Ionicons name="briefcase-outline" size={15} color="#F5F2EC" style={{ marginRight: 7 }} />
                <Text className="font-display text-paper uppercase" style={{ fontSize: 12, letterSpacing: 0.3 }}>Join as Recruiter</Text>
              </Pressable>
            </View>

            <Text className="font-sans text-sm text-ink-3 mt-4">
              Alumni and recruiter accounts are verified separately and see a different app.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
