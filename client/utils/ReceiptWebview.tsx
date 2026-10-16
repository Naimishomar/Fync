import { View, ActivityIndicator } from "react-native";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { AppBar } from "../components/ui/kit";

interface ReceiptWebviewProps {
  route: {
    params: {
      url: string;
    };
  };
}

export default function ReceiptWebview({ route }: ReceiptWebviewProps) {
  const { url } = route.params;
  const navigation = useNavigation();

  // headerShown is off app-wide, so without these the page sat under the status
  // bar with no way back but the system gesture.
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <AppBar title="Receipt" onBack={() => navigation.goBack()} />
      <View style={{ flex: 1 }}>
      <WebView
        source={{ uri: url }}
        startInLoadingState
        renderLoading={() => (
          <ActivityIndicator size="large" style={{ marginTop: 20 }} />
        )}
      />
      </View>
    </SafeAreaView>
  );
}
