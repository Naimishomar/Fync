import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StatusBar, DevSettings } from 'react-native';
import { RefreshCcw, AlertTriangle } from './ui/icons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    // You could send this to Sentry or another logging service here
  }

  private handleReset = () => {
    DevSettings.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F2EC' }}>
          <StatusBar barStyle="dark-content" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              backgroundColor: '#EDE8E0', 
              borderRadius: 16, 
              borderWidth: 2,
              borderColor: '#12100E', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 24
            }}>
              <AlertTriangle size={40} color="#DC2626" />
            </View>
            
            <Text style={{ 
              color: '#12100E', 
              fontSize: 26, 
              fontFamily: 'SpaceGrotesk_700Bold', 
              letterSpacing: -0.6, 
              textAlign: 'center',
              marginBottom: 12
            }}>
              Oops! Something went wrong
            </Text>
            
            <Text style={{ 
              color: '#57534E', 
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
                backgroundColor: '#F97316',
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: '#12100E',
                minHeight: 48
              }}
            >
              <RefreshCcw size={18} color="#12100E" style={{ marginRight: 8 }} />
              <Text style={{ color: '#12100E', fontFamily: 'SpaceGrotesk_700Bold', fontSize: 14, letterSpacing: 0.3, textTransform: 'uppercase' }}>Reload App</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: '#57534E', fontSize: 13, fontFamily: 'Inter_600SemiBold' }}>Try to ignore</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
