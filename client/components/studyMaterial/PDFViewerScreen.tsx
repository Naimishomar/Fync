import React from 'react';
import { WebView } from 'react-native-webview';

const PDFViewerScreen = ({ route, navigation } : any) => {
  const { fileId, title } = route.params;
  
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: title });
  }, [navigation, title]);

  const pdfUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  return <WebView source={{ uri: pdfUrl }} style={{ flex: 1 }} />;
};

export default PDFViewerScreen;