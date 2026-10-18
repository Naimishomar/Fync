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
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              backgroundColor: C.paper2, 
              borderRadius: 16, 
              borderWidth: 2,
              borderColor: C.ink, 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 24
            }}>
              <AlertTriangle size={40} color={C.danger} />
            </View>
            
            <Text style={{ 
              color: C.ink, 
              fontSize: 26, 
              fontFamily: 'SpaceGrotesk_700Bold', 
              letterSpacing: -0.6, 
              textAlign: 'center',
              marginBottom: 12
            }}>
              Oops! Something went wrong
            </Text>
            
            <Text style={{ 
              color: C.ink2, 
              fontSize: 15, 
              fontFamily: 'Inter_400Regular', 
              textAlign: 'center',
              lineHeight: 24,
              marginBottom: 32
            }}>
              Fync encountered an unexpected error. Don't worry, we've logged the issue and are working on it.
            </Text>

            <TouchableOpacity 
              onPress={this.handleReset}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: C.brand[500],
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: C.ink,
                minHeight: 48
              }}
            >
              <RefreshCcw size={18} color={C.onBrand} style={{ marginRight: 8 }} />
              <Text style={{ color: C.onBrand, fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, letterSpacing: 0.3, textTransform: 'uppercase' }}>Reload App</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: C.ink2, fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Try to ignore</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
