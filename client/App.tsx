import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import LoginScreen from "./components/login-screen";
import SignUpScreen from "./components/sign-up-screen";
import ProfileSetup1 from "./components/profile-setup-1";
import ProfileSetup2 from "./components/profile-setup-2";
import HomeScreen from "./components/home-screen";
import Profile from "./components/profile";
import BackgroundWrapper from "./components/background-wrapper";
import CreatePost from "components/create-post";
import RazorpayWebView from "utils/RazorpayWebview";
import PaymentVerify from "utils/PaymentVerify";

import Toast from "react-native-toast-message";
import "./global.css"

import { AuthProvider, useAuth } from "./context/auth.context";
import { View, ActivityIndicator } from "react-native";

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {() => (
          <BackgroundWrapper>
            <LoginScreen />
          </BackgroundWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen name="Signup">
        {() => (
          <BackgroundWrapper>
            <SignUpScreen />
          </BackgroundWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen name="ProfileSetup1">
        {() => (
          <BackgroundWrapper>
            <ProfileSetup1 />
          </BackgroundWrapper>
        )}
      </Stack.Screen>

      <Stack.Screen name="ProfileSetup2">
        {() => (
          <BackgroundWrapper>
            <ProfileSetup2 />
          </BackgroundWrapper>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home1" component={HomeScreen} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="CreatePost" component={CreatePost} />
      <Stack.Screen name="RazorpayWebView" component={RazorpayWebView} />
      <Stack.Screen name="PaymentVerify" component={PaymentVerify} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <NavigationContainer>{isLoggedIn ? <AppStack /> : <AuthStack />}</NavigationContainer>;
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <Toast position="top" />
    </AuthProvider>
  );
}
