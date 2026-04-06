import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React from "react";
import { View, ActivityIndicator, Image, Text, Alert } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import NoInternetScreen from "./components/NoInternetScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from '@react-navigation/drawer';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Toast from "react-native-toast-message";

import './context/axiosConfig';
//@ts-ignore
import "./global.css";
import { StatusBar } from 'expo-status-bar';

import { SafeAreaProvider } from 'react-native-safe-area-context';

// Context
import { AuthProvider, useAuth } from "./context/auth.context";
import { navigationRef } from "./utils/navigation";

// Auth Components
import LoginScreen from "./components/login-screen";
import SignUpScreen from "./components/sign-up-screen";
import ProfileSetup1 from "./components/profile-setup-1";
import ProfileSetup2 from "./components/profile-setup-2";
import AlumniSignup from "./components/AlumniSignup";
import AlumniProfileSetup from "./components/AlumniProfileSetup";
import AlumniAvatarSetup from "./components/AlumniAvatarSetup";
import ForgotPassword from "./components/ForgotPassword";

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
import FindAlumni from "./components/FindAlumni";

// New Features
import BunkOMeter from "./components/newFeatures/BunkOMeter";
import ConfessionFeed from "./components/newFeatures/ConfessionFeed";
import TwelveAMHomeCard from "./components/newFeatures/TwelveAMHomeCard";
import TwelveAMClub from "./components/newFeatures/TwelveAMClub";
import CodingLeaderboard from './components/newFeatures/CodingLeaderboard';
import StudyAssistant from './components/newFeatures/StudyAssistant';
import CollegeChatScreen from './components/newFeatures/CollegeChatScreen';
import AlumniConnect from './components/AlumniConnect';
import PlacementHub from './components/newFeatures/PlacementHub';
import ProfessionalHub from './components/ProfessionalHub';
import AlumniJobs from './components/newFeatures/AlumniJobs';

// Notification
import Notification from "./components/Notification";

//SplashScreen
import SplashScreen from "./components/SplashScreen";

// Study Material
import DriveFolderScreen from './components/studyMaterial/DriveFolderScreen';
import PDFViewerScreen from './components/studyMaterial/PDFViewerScreen';

// OLX & Notice Board
import OLXMarketplaceScreen from './components/olx/MarketplaceScreen';
import RewardsMarketplaceScreen from './components/marketplace/MarketplaceScreen';
import LostAndFound from './components/LostAndFound';
import NoticeBoard from './components/NoticeBoard';

// Paid Gigs
import PaidGigs from './components/PaidGigs';
import CreateShorts from 'components/CreateShorts';
import CreateFundingFeed from './components/CreateFundingFeed';
import SpeakerSessionScreen from './components/events/SpeakerSessionScreen';
import BootcampScreen from './components/events/BootcampScreen';
import EventCommunityChat from './components/events/EventCommunityChat';
import CommunityListScreen from './components/community/CommunityListScreen';
import CreateCommunityScreen from './components/community/CreateCommunityScreen';
import CommunityHubScreen from './components/community/CommunityHubScreen';
import SubCommunityChat from './components/community/SubCommunityChat';
import ClubListScreen from './components/club/ClubListScreen';
import ClubHubScreen from './components/club/ClubHubScreen';
import CreateClubScreen from './components/club/CreateClubScreen';
import CreateSubGroupScreen from './components/club/CreateSubGroupScreen';
import EditSubGroupScreen from './components/club/EditSubGroupScreen';
import SubGroupChat from './components/club/SubGroupChat';
import ClubAdminPanel from './components/club/ClubAdminPanel';
import FyncMediaFeed from './components/FyncMediaFeed';
import FocusProductivity from './components/focus/FocusProductivity';
import ManageAds from './components/admin/ManageAds';

import SubscriptionGuard from './components/newFeatures/SubscriptionGuard';
import PlacementPredictor from './components/newFeatures/PlacementPredictor';

import TermsAndCondition from 'components/T&C';


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
  ForgotPassword: { email?: string };
  AlumniSignup: undefined;
  AlumniProfileSetup: { 
    email: string; 
    username: string; 
    phoneNumber: string; 
    password: string; 
    name: string; 
  };
  AlumniAvatarSetup: {
    email: string;
    phoneNumber: string;
    name: string;
    username: string;
    password: string;
    college: string;
    graduationYear: string;
    company: string;
    role: string;
    experienceLevel: string;
    domains: string;
    linkedIn: string;
  };
  ProfileSetup1: { email: any; username: any; phoneNumber: any; password: any; };
  ProfileSetup2: { email: any; username: any; phoneNumber: any; password: any; fullName: any; birthday: any; gender: any; college: any; major: any; year: any };
  Profile: undefined;
  EditProfile: undefined;
  CreatePost: undefined;
  SearchScreen: undefined;
  RazorpayWebView: { order: any; user: any; keyId: string };
  PaymentVerify: { 
    razorpay_order_id: string; 
    razorpay_payment_id: string; 
    razorpay_signature: string; 
    order: any; 
    user: any;
    keyId?: string;
    merchantName?: string;
    merchantUpiId?: string;
  };
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
  FocusProductivity: undefined;
  ConfessionFeed: undefined;
  TwelveAMHomeCard: undefined;
  TwelveAMClub: undefined;
  FindTeammate: undefined;
  Notification: undefined;
  CodingLeaderboard: undefined;
  DriveFolderScreen: undefined;
  PDFViewerScreen: undefined;
  IndividualPostOrShort: { postId: string };
  RewardsMarketplace: undefined;
  OLXMarketplace: undefined;
  LostAndFound: undefined;
  NoticeBoard: undefined;
  PaidGigs: undefined;
  PlacementHub: undefined;
  StudyAssistant: undefined;
  CreateShorts: undefined;
  CollegeChatScreen: undefined;
  AlumniConnect: undefined;
  ProfessionalHub: undefined;
  FindAlumni: undefined;
  AlumniJobs: undefined;
  PlacementPredictor: undefined;
  SpeakerSessionScreen: undefined;
  BootcampScreen: undefined;
  TermsAndCondition: undefined;
  EventCommunityChat: { eventId: string; eventName: string; type: 'Bootcamp' | 'SpeakerSession' };
  CommunityList: undefined;
  CreateCommunity: undefined;
  CommunityHub: { communityId: string };
  SubCommunityChat: { subId: string; subName: string; communityId: string };
  ClubList: undefined;
  ClubHub: { clubId: string };
  CreateClub: undefined;
  CreateSubGroup: { clubId: string };
  EditSubGroup: { subGroupId: string };
  SubGroupChat: { subGroupId: string; subGroupName: string; clubId: string };
  ClubAdminPanel: { clubId: string };
  FyncMediaFeed: undefined;
  CreateFundingFeed: { project?: any } | undefined;
  ManageAds: undefined;
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
      <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
      <Stack.Screen name="ProfileSetup1">
        {() => <ProfileSetup1 />}
      </Stack.Screen>
      <Stack.Screen name="ProfileSetup2">
        {() => <ProfileSetup2 />}
      </Stack.Screen>
      <Stack.Screen name="AlumniSignup">
        {() => <AlumniSignup />}
      </Stack.Screen>
      <Stack.Screen name="AlumniProfileSetup">
        {() => <AlumniProfileSetup />}
      </Stack.Screen>
      <Stack.Screen name="AlumniAvatarSetup">
        {() => <AlumniAvatarSetup />}
      </Stack.Screen>
      <Stack.Screen name="TermsAndCondition">
        {() => <TermsAndCondition />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  const { user } = useAuth();


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
      <Stack.Screen name="ConfessionFeed" component={ConfessionFeed} />
      <Stack.Screen name="TwelveAMHomeCard" component={TwelveAMHomeCard} />
      <Stack.Screen name="TwelveAMClub" component={TwelveAMClub} />
      <Stack.Screen name="FindTeammate" component={FindTeammate} />
      <Stack.Screen name="Notification" component={Notification} />
      <Stack.Screen name="CodingLeaderboard" component={CodingLeaderboard} />
      <Stack.Screen name="DriveFolderScreen" component={DriveFolderScreen} />
      <Stack.Screen name="PDFViewerScreen" component={PDFViewerScreen} />
      <Stack.Screen name="IndividualPostOrShort" component={IndividualPostOrShort} />
      <Stack.Screen name="RewardsMarketplace" component={RewardsMarketplaceScreen} />
      <Stack.Screen name="OLXMarketplace" component={OLXMarketplaceScreen} />
      <Stack.Screen name="LostAndFound" component={LostAndFound} />
      <Stack.Screen name="NoticeBoard" component={NoticeBoard} />
      <Stack.Screen name="PaidGigs" component={PaidGigs} />
      <Stack.Screen name="StudyAssistant" component={StudyAssistant} />
      <Stack.Screen name="CollegeChatScreen" component={CollegeChatScreen} />
      <Stack.Screen name="AlumniConnect" component={AlumniConnect} />
      <Stack.Screen name="ProfessionalHub" component={ProfessionalHub} />
      <Stack.Screen name="FindAlumni" component={FindAlumni} />
      <Stack.Screen name="PlacementHub" component={PlacementHub} />
      <Stack.Screen name="AlumniJobs" component={AlumniJobs} />
      <Stack.Screen name="PlacementPredictor" component={PlacementPredictor} />
      <Stack.Screen name="SpeakerSessionScreen" component={SpeakerSessionScreen} />
      <Stack.Screen name="BootcampScreen" component={BootcampScreen} />

      <Stack.Screen name="EventCommunityChat" component={EventCommunityChat} />
      <Stack.Screen name="CommunityList" component={CommunityListScreen} />
      <Stack.Screen name="CreateCommunity" component={CreateCommunityScreen} />
      <Stack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <Stack.Screen name="SubCommunityChat" component={SubCommunityChat} />
      <Stack.Screen name="ClubList" component={ClubListScreen} />
      <Stack.Screen name="ClubHub" component={ClubHubScreen} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} />
      <Stack.Screen name="CreateSubGroup" component={CreateSubGroupScreen} />
      <Stack.Screen name="EditSubGroup" component={EditSubGroupScreen} />
      <Stack.Screen name="SubGroupChat" component={SubGroupChat} />
      <Stack.Screen name="ClubAdminPanel" component={ClubAdminPanel} />
      <Stack.Screen name="FocusProductivity" component={FocusProductivity} />
      <Stack.Screen name="TermsAndCondition" component={TermsAndCondition} />
      <Stack.Screen name="FyncMediaFeed" component={FyncMediaFeed} />
      <Stack.Screen name="CreateFundingFeed" component={CreateFundingFeed} />
      <Stack.Screen name="ManageAds" component={ManageAds} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" }}>
        <Image source={require('./assets/Fync.jpg')} className='w-56 h-56 object-contain rounded-full mb-5' />
        <View className='flex-row gap-2 items-center'>
          <Text className='text-black text-lg font-semibold'>Loading</Text>
          <ActivityIndicator size="small" color="#000" />
        </View>
      </View>
    );
  }

  return isLoggedIn ? (
    <SubscriptionGuard>
      <AppStack />
    </SubscriptionGuard>
  ) : <AuthStack />;
}


const linking = {
  prefixes: ['fync://', 'https://fync.app'],
  config: {
    screens: {
      IndividualPostOrShort: {
        path: 'view',
      },
    },
  },
};

export default function App() {
  const [isConnected, setIsConnected] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  if (!isConnected) {
    return (
      <View className="flex-1">
        <NoInternetScreen onRetry={() => setIsConnected(true)} />
      </View>
    );
  }

  return (
    <AuthProvider>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} linking={linking}>
          <StatusBar style="dark" backgroundColor="#ffffff" />
          <RootNavigator />
          <Toast position="top" />
        </NavigationContainer>
      </SafeAreaProvider>
    </AuthProvider>
  );
}