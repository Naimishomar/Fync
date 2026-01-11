import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React from "react";
import './context/axiosConfig';
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from '@react-navigation/drawer';
import Toast from "react-native-toast-message";
import "./global.css";

// Auth Components
import LoginScreen from "./components/login-screen";
import SignUpScreen from "./components/sign-up-screen";
import ProfileSetup1 from "./components/profile-setup-1";
import ProfileSetup2 from "./components/profile-setup-2";

// Core Components
import TabLayout from "./components/TabLayout";
import CustomSidebar from "./components/CustomSidebar";
import Profile from "./components/profile";
import EditProfile from "./components/EditProfile";
import CreatePost from "./components/create-post";
import Shorts from "./components/Shorts";
import SearchScreen from "components/SearchScreen";
import ChatList from "components/ChatList";
import PublicProfile from "components/PublicProfile";
import Chat from "components/Chat";
import FollowersAndFollowing from "components/FollowersAndFollowing";

// Utils
import RazorpayWebView from "./utils/RazorpayWebView";
import PaymentVerify from "./utils/PaymentVerify";
import ReceiptWebview from "./utils/ReceiptWebview";

// Context
import { AuthProvider, useAuth } from "./context/auth.context";
import { View, ActivityIndicator } from "react-native";

// Quiz & Opportunities
import CreateRoom from "components/quiz/CreateRoom";
import JoinRoomInput from "./components/quiz/JoinRoomInput";
import WaitingRoom from "./components/quiz/WaitingRoom";
import OneVsOneSetup from "./components/quiz/OneVsOneSetup";
import QuizScreen from "./components/quiz/QuizScreen";
import QuizHome from "components/quiz/QuizHome";
import LeaderboardScreen from "./components/quiz/LeaderboardScreen";
import HackathonList from "components/opportunity/HackathonList";
import InternshipList from "components/opportunity/InternshipList";
import JobList from "components/opportunity/JobList";
import WorkshopList from 'components/opportunity/WorkshopList';

//Interview
import InterviewSetup from "./components/interview/InterviewSetup";
import ActiveInterview from "./components/interview/ActiveInterview";

// Find Teammate
import FindTeammate from "./components/FindTeammate";

// New Features
import BunkOMeter from "./components/newFeatures/BunkOMeter";
import VibeSelector from "./components/newFeatures/VibeSelector";
import TwelveAMHomeCard from "./components/newFeatures/TwelveAMHomeCard";
import TwelveAMClub from "./components/newFeatures/TwelveAMClub";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

export type RootStackParamList = {
  Tabs: undefined; 
  Login: undefined;
  Signup: undefined;
  ProfileSetup1: { email: any; username: any; phoneNumber: any; password: any;};
  ProfileSetup2: { email: any; username: any; phoneNumber: any; password: any; fullName: any; birthday: any; gender: any; college: any; major: any; year: any };
  Profile: undefined;
  EditProfile: undefined;
  CreatePost: undefined;
  SearchScreen: undefined;
  RazorpayWebView: { order: any; user: any; keyId: string };
  PaymentVerify: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string; order: any; user: any };
  ReceiptWebview: { url: string };
  Shorts: undefined;
  Home: undefined;
  PublicProfile: {userId: string};
  FollowersAndFollowing: { userId: string; type: "followers" | "following" };
  Chat: { conversationId: string };
  ChatList: undefined;
  QuizHome: undefined;
  CreateRoom: undefined;
  JoinRoomInput: undefined;
  WaitingRoom: { roomId: string; startTime: string };
  OneVsOneSetup: undefined;
  QuizScreen: { 
    questions: Question[]; 
    roomId: string; 
    mode: 'custom' | '1v1' 
  };
  LeaderboardScreen: { roomId: string, myScore?: number };
  HackathonList: undefined;
  InternshipList: undefined;
  JobList: undefined;
  WorkshopList: undefined;
  PostItem: undefined;
  CommentsModal: undefined;
  InterviewSetup: undefined;
  ActiveInterview: undefined;
  BunkOMeter: undefined;
  VibeSelector: undefined;
  TwelveAMHomeCard: undefined;
  TwelveAMClub: undefined;
  FindTeammate: undefined;
};

function HomeDrawer() {
  return (
    <Drawer.Navigator
      id="LeftDrawer"
      drawerContent={(props) => <CustomSidebar {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: '#000',
          width: '75%',
        },
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.7)',
      }}
    >
      <Drawer.Screen name="TabNavigator" component={TabLayout} />
    </Drawer.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
      <Stack.Screen name="Login">
        {() => <LoginScreen />}
      </Stack.Screen>
      <Stack.Screen name="Signup">
        {() => <SignUpScreen />}
      </Stack.Screen>
      <Stack.Screen name="ProfileSetup1">
        {() => <ProfileSetup1 />}
      </Stack.Screen>
      <Stack.Screen name="ProfileSetup2">
        {() => <ProfileSetup2 />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "simple_push" }}>
      <Stack.Screen name="Tabs" component={HomeDrawer} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
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
      <Stack.Screen name="CreateRoom" component={CreateRoom} />
      <Stack.Screen name="JoinRoomInput" component={JoinRoomInput} />
      <Stack.Screen name="WaitingRoom" component={WaitingRoom} />
      <Stack.Screen name="OneVsOneSetup" component={OneVsOneSetup} />
      <Stack.Screen name="QuizScreen" component={QuizScreen} />
      <Stack.Screen name="QuizHome" component={QuizHome} />
      <Stack.Screen name="LeaderboardScreen" component={LeaderboardScreen} />
      <Stack.Screen name="HackathonList" component={HackathonList} />
      <Stack.Screen name="InternshipList" component={InternshipList} />
      <Stack.Screen name="JobList" component={JobList} />
      <Stack.Screen name="WorkshopList" component={WorkshopList} />
      <Stack.Screen name="InterviewSetup" component={InterviewSetup} />
      <Stack.Screen name="ActiveInterview" component={ActiveInterview} />
      <Stack.Screen name="BunkOMeter" component={BunkOMeter} />
      <Stack.Screen name="VibeSelector" component={VibeSelector} />
      <Stack.Screen name="TwelveAMHomeCard" component={TwelveAMHomeCard} />
      <Stack.Screen name="TwelveAMClub" component={TwelveAMClub} />
      <Stack.Screen name="FindTeammate" component={FindTeammate} />
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