import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StatusBar, DevSettings } from 'react-native';
import { RefreshCcw, AlertTriangle } from './ui/icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Updates from 'expo-updates';
import { C } from '../constants/colors';
import { getCrashlytics, log, recordError } from '@react-native-firebase/crashlytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL APP ERROR:', error, errorInfo);
    // A caught render error never becomes a native fatal, so Crashlytics would
    // not see it on its own.
    try {
      const c = getCrashlytics();
      if (errorInfo.componentStack) log(c, errorInfo.componentStack.slice(0, 1000));
      recordError(c, error, 'ErrorBoundary');
    } catch { /* reporting must never break the fallback screen */ }
  }

  private handleReset = () => {
    // DevSettings.reload is a no-op in release builds, so the button did nothing
    // in the APK. expo-updates reloads the JS bundle in production.
    if (__DEV__) {
      DevSettings.reload();
      return;
    }
    Updates.reloadAsync().catch(() => this.setState({ hasError: false, error: null }));
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }}>
          <StatusBar barStyle={C.barStyle} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32, backgroundColor: C.paper2,
              alignItems: 'center', justifyContent: 'center', marginBottom: 8,
            }}>
              <AlertTriangle size={28} color={C.danger} />
            </View>

            <Text accessibilityRole="header" style={{
              color: C.ink, fontSize: 24, lineHeight: 29, fontFamily: 'SpaceGrotesk_700Bold',
              letterSpacing: -0.5, textAlign: 'center',
            }}>
              Something went wrong
            </Text>

            <Text style={{
              color: C.ink3, fontSize: 15, lineHeight: 22, fontFamily: 'Inter_400Regular',
              textAlign: 'center', maxWidth: 320, marginBottom: 16,
            }}>
              Fync hit an unexpected error. We’ve logged it. Reloading usually fixes it.
            </Text>

            <TouchableOpacity
              onPress={this.handleReset}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                alignSelf: 'stretch', maxWidth: 320, width: '100%',
                backgroundColor: C.brand[500], borderRadius: 999, minHeight: 48, paddingHorizontal: 20,
              }}
            >
              <RefreshCcw size={18} color={C.onBrand} />
              <Text style={{ color: C.onBrand, fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Reload app</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => this.setState({ hasError: false, error: null })}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={{
                alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', maxWidth: 320, width: '100%',
                backgroundColor: C.paper2, borderRadius: 999, minHeight: 48, paddingHorizontal: 20,
              }}
            >
              <Text style={{ color: C.ink, fontSize: 15, fontFamily: 'Inter_600SemiBold' }}>Try to continue</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
