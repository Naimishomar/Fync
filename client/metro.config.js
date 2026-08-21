const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The vendored pdf.js in assets/pdfjs is shipped as .txt so Metro treats it as
// an asset to copy rather than a module to parse. Parsed as a module it fails:
// pdf.js carries a Node-only `require('canvas')` fallback that cannot resolve
// in React Native, and we only ever need the file's text to inject into a WebView.
config.resolver.assetExts.push('txt');

module.exports = withNativeWind(config, { input: './global.css' });
