import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React, { useEffect } from "react";
import { View, ActivityIndicator, Image, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from '@react-navigation/drawer';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Toast from "react-native-toast-message";

import './context/axiosConfig';
//@ts-ignore
import "./global.css";

// Context
import { AuthProvider, useAuth } from "./context/auth.context";

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
import SearchScreen from "./components/SearchScreen";
import ChatList from "./components/ChatList";
import PublicProfile from "./components/PublicProfile";
import Chat from "./components/Chat";
import FollowersAndFollowing from "./components/FollowersAndFollowing";

// Utils
import RazorpayWebView from "./utils/RazorpayWebView";
import PaymentVerify from "./utils/PaymentVerify";
import ReceiptWebview from "./utils/ReceiptWebview";

// Quiz & Opportunities
import CreateRoom from "./components/quiz/CreateRoom";
import JoinRoomInput from "./components/quiz/JoinRoomInput";
import WaitingRoom from "./components/quiz/WaitingRoom";
import OneVsOneSetup from "./components/quiz/OneVsOneSetup";
import QuizScreen from "./components/quiz/QuizScreen";
import QuizHome from "./components/quiz/QuizHome";
import LeaderboardScreen from "./components/quiz/LeaderboardScreen";
import HackathonList from "./components/opportunity/HackathonList";
import InternshipList from "./components/opportunity/InternshipList";
import JobList from "./components/opportunity/JobList";
import WorkshopList from './components/opportunity/WorkshopList';
import IndividualPostOrShort from './components/IndividualPostOrShort';

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
import ConfessionFeed from './components/newFeatures/ConfessionFeed';
import NineAmConfession from './components/newFeatures/NineAmConfession';
import CodingLeaderboard from './components/newFeatures/CodingLeaderboard';
import Map from './components/newFeatures/Map';
import LateNightFood from 'components/newFeatures/LateNightFood';
import CampusTravel from 'components/newFeatures/CampusTravel';
import StudyAssistant from 'components/newFeatures/StudyAssistant';
import WifiSettingsScreen from 'components/newFeatures/WifiSettingsScreen';
import WifiSessionMonitor from 'components/newFeatures/WifiSessionMonitor';
import CollegeChatScreen from './components/newFeatures/CollegeChatScreen';
import GroupJamSetup from 'components/GroupSongs/GroupJamSetup';
import GroupJamPlayer from 'components/GroupSongs/GroupJamPlayer';
import socket from 'utils/socket';
// import VideoLobby from './components/newFeatures/VideoLobby';

// Notification
import Notification from "./components/Notification";

//SplashScreen
import SplashScreen from "./components/SplashScreen";

// Study Material
import DriveFolderScreen from './components/studyMaterial/DriveFolderScreen';
import PDFViewerScreen from './components/studyMaterial/PDFViewerScreen';

// OLX & Notice Board
import MarketplaceScreen from './components/olx/MarketplaceScreen';
import LostAndFound from './components/LostAndFound';
import NoticeBoard from './components/NoticeBoard';

// Collaboration
import CollaborationScreen from './components/collaboration/CollaborationScreen';

// Paid Gigs
import PaidGigs from './components/PaidGigs';
import CreateShorts from 'components/CreateShorts';
import NearbyCrushDetector from './components/crush/NearbyCrushDetector';

// Pay & Split
import PayAndSplitHome from './components/payAndSplit/PayAndSplitHome';
import QRScannerScreen from './components/payAndSplit/QRScannerScreen';
import EnterAmountScreen from './components/payAndSplit/EnterAmountScreen';
import SplitMembersScreen from './components/payAndSplit/SplitMembersScreen';
import PendingPaymentsScreen from './components/payAndSplit/PendingPaymentsScreen';
import MonthlyAnalyticsScreen from './components/payAndSplit/MonthlyAnalyticsScreen';
import GroupManagementScreen from './components/payAndSplit/GroupManagementScreen';
import CreatedSplitsScreen from './components/payAndSplit/CreatedSplitsScreen';
import SubscriptionGuard from './components/newFeatures/SubscriptionGuard';





configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator();

export interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

export type RootStackParamList = {
  Tabs: undefined;
  SplashScreen: undefined;
  Login: undefined;
  Signup: undefined;
  ProfileSetup1: { email: any; username: any; phoneNumber: any; password: any; };
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
  PublicProfile: { userId: string };
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
    mode: 'custom' | '1v1';
    endTime?: string;
    opponent?: any;
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
  ConfessionFeed: undefined;
  Notification: undefined;
  NineAmConfession: undefined;
  CodingLeaderboard: undefined;
  DriveFolderScreen: undefined;
  PDFViewerScreen: undefined;
  VideoLobby: { myUserId: string, myUserName: string };
  IndividualPostOrShort: { postId: string };
  MarketplaceScreen: undefined;
  ZegoUIKitPrebuiltCallWaitingScreen: undefined;
  ZegoUIKitPrebuiltCallInCallScreen: undefined;
  LostAndFound: undefined;
  NoticeBoard: undefined;
  CollaborationScreen: undefined;
  Map: undefined;
  PaidGigs: undefined;
  LateNightFood: undefined;
  CampusTravel: undefined;
  StudyAssistant: undefined;
  CreateShorts: undefined;
  GroupJamSetup: undefined;
  GroupJamPlayer: undefined;
  PayAndSplitHome: undefined;
  QRScannerScreen: undefined;
  EnterAmountScreen: { merchantUpiId?: string; merchantName?: string };
  SplitMembersScreen: { amount: number; paymentTransactionId?: string };
  PendingPaymentsScreen: undefined;
  MonthlyAnalyticsScreen: undefined;
  GroupManagementScreen: undefined;
  CreatedSplitsScreen: undefined;
  WifiSettingsScreen: undefined;
  CollegeChatScreen: undefined;
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
  useEffect(() => {
    console.log("AppStack Socket Listener Mounted 👂 - Socket ID:", socket.id);

    socket.on('incoming-jam', (data) => {
      console.log("Invitation Received on Guest Phone!", data.host.username);

      Alert.alert(
        "Squad Jam! 🔥",
        `${data.host.username} is jamming to ${data.station.name}. Join?`,
        [
          { text: "No", style: "cancel" },
          {
            text: "Join Sync",
            onPress: () => {
              // 🔥 FIX: Use navigationRef instead of navigation
              if (navigationRef.isReady()) {
                navigationRef.navigate("GroupJamPlayer", data);
              } else {
                console.log("Navigation not ready yet");
              }
            }
          }
        ]
      );
    });

    return () => { socket.off('incoming-jam'); };
  }, []);


  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "simple_push" }}>
      <Stack.Screen name="SplashScreen" component={SplashScreen} />
      <Stack.Screen name="Tabs" component={HomeDrawer} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="CreatePost" component={CreatePost} />
      <Stack.Screen name="CreateShorts" component={CreateShorts} />
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
      <Stack.Screen name="ConfessionFeed" component={ConfessionFeed} />
      <Stack.Screen name="Notification" component={Notification} />
      <Stack.Screen name="NineAmConfession" component={NineAmConfession} />
      <Stack.Screen name="CodingLeaderboard" component={CodingLeaderboard} />
      <Stack.Screen name="DriveFolderScreen" component={DriveFolderScreen} />
      <Stack.Screen name="PDFViewerScreen" component={PDFViewerScreen} />
      <Stack.Screen name="IndividualPostOrShort" component={IndividualPostOrShort} />
      <Stack.Screen name="MarketplaceScreen" component={MarketplaceScreen} />
      <Stack.Screen name="LostAndFound" component={LostAndFound} />
      <Stack.Screen name="NoticeBoard" component={NoticeBoard} />
      <Stack.Screen name="CollaborationScreen" component={CollaborationScreen} />
      <Stack.Screen name="Map" component={Map} />
      <Stack.Screen name="PaidGigs" component={PaidGigs} />
      <Stack.Screen name="LateNightFood" component={LateNightFood} />
      <Stack.Screen name="CampusTravel" component={CampusTravel} />
      <Stack.Screen name="StudyAssistant" component={StudyAssistant} />
      <Stack.Screen name="GroupJamSetup" component={GroupJamSetup} />
      <Stack.Screen name="GroupJamPlayer" component={GroupJamPlayer} />
      <Stack.Screen name="PayAndSplitHome" component={PayAndSplitHome} />
      <Stack.Screen name="QRScannerScreen" component={QRScannerScreen} />
      <Stack.Screen name="EnterAmountScreen" component={EnterAmountScreen} />
      <Stack.Screen name="SplitMembersScreen" component={SplitMembersScreen} />
      <Stack.Screen name="PendingPaymentsScreen" component={PendingPaymentsScreen} />
      <Stack.Screen name="MonthlyAnalyticsScreen" component={MonthlyAnalyticsScreen} />
      <Stack.Screen name="GroupManagementScreen" component={GroupManagementScreen} />
      <Stack.Screen name="CreatedSplitsScreen" component={CreatedSplitsScreen} />
      <Stack.Screen name="WifiSettingsScreen" component={WifiSettingsScreen} />
      <Stack.Screen name="CollegeChatScreen" component={CollegeChatScreen} />
      {/* <Stack.Screen name="VideoLobby" component={VideoLobby} /> */}
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" }}>
        <Image source={require('./assets/logo.png')} className='w-56 h-28 object-contain' />
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return isLoggedIn ? (
    <SubscriptionGuard>
      <AppStack />
    </SubscriptionGuard>
  ) : <AuthStack />;
}

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  return (
    <AuthProvider>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 15 : 0}>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        <NearbyCrushDetector />
        <WifiSessionMonitor />
        <Toast position="top" />
      </KeyboardAvoidingView>
    </AuthProvider>
  );
}