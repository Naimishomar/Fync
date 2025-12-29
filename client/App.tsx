// App.js
import React from "react";
import './context/axiosConfig'
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import "./global.css";
import LoginScreen from "./components/login-screen";
import SignUpScreen from "./components/sign-up-screen";
import ProfileSetup1 from "./components/profile-setup-1";
import ProfileSetup2 from "./components/profile-setup-2";
import HomeScreen from "./components/home-screen";
import Profile from "./components/profile";
import BackgroundWrapper from "./components/background-wrapper";
import CreatePost from "./components/create-post";
import RazorpayWebView from "./utils/RazorpayWebView";
import PaymentVerify from "./utils/PaymentVerify";
import ReceiptWebview from "./utils/ReceiptWebview";
import TabLayout from "./components/TabLayout";
import Shorts from "./components/Shorts";
import SearchScreen from "components/SearchScreen";
import ChatList from "components/ChatList";
import { AuthProvider, useAuth } from "./context/auth.context";
import { View, ActivityIndicator } from "react-native";
import PublicProfile from "components/PublicProfile";
import Chat from "components/Chat";
import FollowersAndFollowing from "components/FollowersAndFollowing";

const Stack = createNativeStackNavigator<RootStackParamList>();

export type RootStackParamList = {
  Tabs: undefined;
  Login: undefined;
  Signup: undefined;
  ProfileSetup1: { email: any; username: any; phoneNumber: any; password: any;};
  ProfileSetup2: { email: any; username: any; phoneNumber: any; password: any; fullName: any; birthday: any; gender: any; college: any; major: any; year: any };
  Profile: undefined;
  CreatePost: undefined;
  SearchScreen: undefined;
  RazorpayWebView: { order: any; user: any; keyId: string };
  PaymentVerify: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; order: any; user: any };
  ReceiptWebview: { url: string };
  Shorts: undefined;
  Home: undefined;
  PublicProfile: undefined;
  FollowersAndFollowing: undefined;
  Chat: { conversationId: string, user: any };
  ChatList: undefined;
};

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login">
        {() => (
          <>
            <LoginScreen />
          </>
        )}
      </Stack.Screen>

      <Stack.Screen name="Signup">
        {() => (
          <>
            <SignUpScreen />
          </>
        )}
      </Stack.Screen>

      <Stack.Screen name="ProfileSetup1">
        {() => (
          <>
            <ProfileSetup1 />
          </>
        )}
      </Stack.Screen>

      <Stack.Screen name="ProfileSetup2">
        {() => (
          <>
            <ProfileSetup2 />
          </>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabLayout} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="CreatePost" component={CreatePost} />
      <Stack.Screen name="RazorpayWebView" component={RazorpayWebView} />
      <Stack.Screen name="PaymentVerify" component={PaymentVerify} />
      <Stack.Screen name="ReceiptWebview" component={ReceiptWebview} />
      <Stack.Screen name="Shorts" component={Shorts} />
      <Stack.Screen name="SearchScreen" component={SearchScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfile} />
      <Stack.Screen name="FollowersAndFollowing" component={FollowersAndFollowing} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="ChatList" component={ChatList} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <AppStack />
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RootNavigator />
      <Toast position="top" />
    </AuthProvider>
  );
}
