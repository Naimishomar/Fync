import React from 'react';
import { WebView } from 'react-native-webview';
import { View, ActivityIndicator, StatusBar } from 'react-native';

const CodeViewerScreen = ({ route, navigation } : any) => {
  const { url, title, language = 'javascript' } = route.params;
  
  React.useLayoutEffect(() => {
    navigation.setOptions({ title: title });
  }, [navigation, title]);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code&display=swap" rel="stylesheet">
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: #1d1f21;
            font-family: 'Fira Code', monospace;
          }
          pre {
            margin: 0 !important;
            padding: 20px !important;
            font-size: 14px !important;
            line-height: 1.5 !important;
            background: transparent !important;
          }
          code {
            font-family: 'Fira Code', monospace !important;
          }
          #loading {
            color: #ffffff;
            padding: 20px;
            font-family: sans-serif;
          }
        </style>
      </head>
      <body>
        <div id="loading">Loading code protocol...</div>
        <pre><code class="language-${language}" id="code"></code></pre>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-cpp.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js"></script>
        <script>
          fetch('${url}')
            .then(response => response.text())
            .then(text => {
              const codeElement = document.getElementById('code');
              codeElement.textContent = text;
              document.getElementById('loading').style.display = 'none';
              Prism.highlightElement(codeElement);
            })
            .catch(err => {
              document.getElementById('loading').innerHTML = 'Error loading code: ' + err.message;
            });
        </script>
      </body>
    </html>
  `;

  return (
    <View className="flex-1 bg-[#1d1f21]">
      <StatusBar barStyle="light-content" />
      <WebView 
        source={{ html: htmlContent }} 
        style={{ flex: 1, backgroundColor: '#1d1f21' }}
        startInLoadingState={true}
        renderLoading={() => (
          <View className="absolute inset-0 items-center justify-center bg-[#1d1f21]">
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        )}
      />
    </View>
  );
};

export default CodeViewerScreen;
