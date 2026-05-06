import React from 'react';
import { WebView } from 'react-native-webview';
import { View, ActivityIndicator } from 'react-native';

const PDFViewerScreen = ({ route, navigation } : any) => {
  const { fileId, title, url } = route.params;
  
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: title });
  }, [navigation, title]);

  // If a direct URL is provided (like GitHub), wrap it in Google Docs Viewer for Android/iOS display without download
  // If fileId is provided, use Google Drive preview link
  const pdfUrl = url 
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : `https://drive.google.com/file/d/${fileId}/preview`;

  return (
    <View className="flex-1 bg-white">
      <WebView 
        source={{ uri: pdfUrl }} 
        style={{ flex: 1 }}
        startInLoadingState={true}
        renderLoading={() => (
          <View className="absolute inset-0 items-center justify-center bg-white">
            <ActivityIndicator size="large" color="#8b5cf6" />
          </View>
        )}
      />
    </View>
  );
};

export default PDFViewerScreen;
