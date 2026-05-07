import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StatusBar, DevSettings } from 'react-native';
import { RefreshCcw, AlertTriangle } from 'lucide-react-native';
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
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <StatusBar barStyle="light-content" />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <View style={{ 
              width: 80, 
              height: 80, 
              backgroundColor: 'rgba(239, 68, 68, 0.1)', 
              borderRadius: 40, 
              alignItems: 'center', 
              justifyContent: 'center',
              marginBottom: 24
            }}>
              <AlertTriangle size={40} color="#ef4444" />
            </View>
            
            <Text style={{ 
              color: '#fff', 
              fontSize: 24, 
              fontWeight: 'bold', 
              textAlign: 'center',
              marginBottom: 12
            }}>
              Oops! Something went wrong
            </Text>
            
            <Text style={{ 
              color: '#94a3b8', 
              fontSize: 16, 
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
                backgroundColor: '#ec4899',
                paddingVertical: 14,
                paddingHorizontal: 28,
                borderRadius: 999,
                shadowColor: "#ec4899",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8
              }}
            >
              <RefreshCcw size={20} color="#fff" style={{ marginRight: 10 }} />
              <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Reload App</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => this.setState({ hasError: false, error: null })}
              style={{ marginTop: 20 }}
            >
              <Text style={{ color: '#64748b', fontSize: 14 }}>Try to ignore</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
