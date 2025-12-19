import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";

interface ReceiptWebviewProps {
  route: {
    params: {
      url: string;
    };
  };
}

export default function ReceiptWebview({ route }: ReceiptWebviewProps) {
  const { url } = route.params;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: url }}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        )}
      />
    </View>
  );
}
