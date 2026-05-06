import React from 'react';
import { WebView } from 'react-native-webview';
import { View, ActivityIndicator, StatusBar } from 'react-native';

const MarkdownViewerScreen = ({ route, navigation } : any) => {
  const { url, title } = route.params;
  
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: title });
  }, [navigation, title]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Inter', -apple-system, sans-serif;
            padding: 24px;
            color: #1f2937;
            line-height: 1.6;
            background-color: #ffffff;
          }
          h1, h2, h3 {
            color: #111827;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 700;
          }
          h1 { font-size: 1.875rem; border-bottom: 2px solid #f3f4f6; padding-bottom: 0.5em; }
          h2 { font-size: 1.5rem; }
          code {
            background-color: #f3f4f6;
            padding: 2px 4px;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.875em;
          }
          pre {
            background-color: #f3f4f6;
            padding: 16px;
            border-radius: 12px;
            overflow-x: auto;
            margin: 1em 0;
          }
          pre code {
            background-color: transparent;
            padding: 0;
          }
          blockquote {
            border-left: 4px solid #3b82f6;
            padding-left: 16px;
            color: #4b5563;
            margin: 1em 0;
            font-style: italic;
          }
          ul, ol {
            padding-left: 1.5em;
            margin: 1em 0;
          }
          li {
            margin-bottom: 0.5em;
          }
          img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
          }
          hr {
            border: 0;
            border-top: 1px solid #e5e7eb;
            margin: 2em 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1em 0;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 8px 12px;
            text-align: left;
          }
          th {
            background-color: #f9fafb;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div id="content">Loading notes...</div>
        <script>
          fetch('${url}')
            .then(response => response.text())
            .then(text => {
              document.getElementById('content').innerHTML = marked.parse(text);
            })
            .catch(err => {
              document.getElementById('content').innerHTML = 'Error loading content: ' + err.message;
            });
        </script>
      </body>
    </html>
  `;

  return (
    <View className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <WebView 
        source={{ html: htmlContent }} 
        style={{ flex: 1 }}
        startInLoadingState={true}
        renderLoading={() => (
          <View className="absolute inset-0 items-center justify-center bg-white">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        )}
      />
    </View>
  );
};

export default MarkdownViewerScreen;
