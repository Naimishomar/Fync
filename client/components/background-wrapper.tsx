import React from 'react';
import {
  StyleSheet,
  ImageBackground,
  SafeAreaView,
  View,
  Platform,
  ImageSourcePropType,
} from 'react-native';

interface BackgroundWrapperProps extends React.PropsWithChildren<{}> {}

// --- IMPORTANT: CHANGE THIS LINE ---
// Replace the path below with the actual relative path to your image file.
// Example: require('../assets/my-login-bg.jpg')
const BACKGROUND_IMAGE_SOURCE: ImageSourcePropType = require('../assets/background.png');
// ------------------------------------

const BackgroundWrapper: React.FC<BackgroundWrapperProps> = ({ children }) => {
  return (
    // ImageBackground is a standard RN component that renders an image as the BG
    <ImageBackground
      source={BACKGROUND_IMAGE_SOURCE}
      style={styles.backgroundImage}
      resizeMode="cover">
      {/* The content (your navigation stack) goes here. */}
      <View style={styles.overlay}>
        {/* SafeAreaView ensures content doesn't get hidden under notches/status bar */}
        <SafeAreaView style={styles.safeArea}>{children}</SafeAreaView>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  // Setting overlay to transparent allows the ImageBackground to show through
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0)', // Fully transparent
  },
  // Ensures the content itself takes up the full space minus the safe areas
  safeArea: {
    flex: 1,
    // On Android, we sometimes need extra paddingTop for the status bar if not using StatusBar component
    paddingTop: Platform.OS === 'android' ? 25 : 0,
  },
});

export default BackgroundWrapper;
