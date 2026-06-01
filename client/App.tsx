import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React from "react";
import { View, ActivityIndicator, Image, Text, Alert, Keyboard } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import NoInternetScreen from "./components/NoInternetScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from '@react-navigation/drawer';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Toast from "react-native-toast-message";

import './context/axiosConfig';
import ErrorBoundary from './components/ErrorBoundary';
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
import RecruiterSignup from "./components/RecruiterSignup";
import RecruiterProfileSetup from "./components/RecruiterProfileSetup";
import ForgotPassword from "./components/ForgotPassword";

// Core Components
import TabLayout from "./components/TabLayout";
import CustomSidebar from "./components/CustomSidebar";
import AlumniSidebar from "./components/AlumniSidebar";
import RecruiterTabLayout from "./components/RecruiterTabLayout";
import Profile from "./components/profile";
import RecruiterProfile from "./components/RecruiterProfile";
import EditProfile from "./components/EditProfile";
import RecruiterEditProfile from "./components/RecruiterEditProfile";
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
import CreateOpportunity from './components/opportunity/CreateOpportunity';
import RecruiterPortal from './components/opportunity/RecruiterPortal';
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
import DSAPrep from './components/studyMaterial/DSAPrep';
import GitHubFolderScreen from './components/studyMaterial/GitHubFolderScreen';
import MarkdownViewerScreen from './components/studyMaterial/MarkdownViewerScreen';
import CodeViewerScreen from './components/studyMaterial/CodeViewerScreen';
import MasterStudyHub from './components/studyMaterial/MasterStudyHub';

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
import FlappyBird from './components/games/FlappyBird';
import DrawAndGuess from './components/games/DrawAndGuess';
import GameLeaderboard from './components/games/GameLeaderboard';
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
import SubscriptionGuard from './components/newFeatures/SubscriptionGuard';
import PlacementPredictor from './components/newFeatures/PlacementPredictor';
import DSAAndDevelopmentContest from './components/contest/DSAAndDevelopmentContest';

// Profile Builder
const FyncProfileBuilder = React.lazy(() => import('./components/profile/FyncProfileBuilder'));

// Hackathon Ecosystem
const HackathonHub = React.lazy(() => import('./components/hackathon/HackathonHub'));
const HackathonCreate = React.lazy(() => import('./components/hackathon/HackathonCreate'));
const HackathonDetail = React.lazy(() => import('./components/hackathon/HackathonDetail'));
const HackathonTeamScreen = React.lazy(() => import('./components/hackathon/HackathonTeamScreen'));
const HackathonSubmission = React.lazy(() => import('./components/hackathon/HackathonSubmission'));
const HackathonLeaderboard = React.lazy(() => import('./components/hackathon/HackathonLeaderboard'));
const HackathonJudgePanel = React.lazy(() => import('./components/hackathon/HackathonJudgePanel'));
const HackathonChannel = React.lazy(() => import('./components/hackathon/HackathonChannel'));

// Entertainment Module
const EntertainmentHome = React.lazy(() => import('./components/entertainment/EntertainmentHome'));
const MovieDetail = React.lazy(() => import('./components/entertainment/MovieDetail'));
const TrailerReels = React.lazy(() => import('./components/entertainment/TrailerReels'));
const MovieSearch = React.lazy(() => import('./components/entertainment/MovieSearch'));
const MovieList = React.lazy(() => import('./components/entertainment/MovieList'));
const PartyPoolHub = React.lazy(() => import('./components/partyPool/PartyPoolHub'));
const SubscriptionScreen = React.lazy(() => import('./components/newFeatures/SubscriptionScreen'));

// Secondary Screens
const TermsAndCondition = React.lazy(() => import('./components/T&C'));
const ContactUs = React.lazy(() => import('./components/ContactUs'));
const MeetOurTeam = React.lazy(() => import('./components/MeetOurTeam'));
const AdminPortal = React.lazy(() => import('./components/admin/AdminPortal'));

// Daily Hub Utilities
import './utils/commuteGuardTask';

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
  RecruiterSignup: undefined;
  RecruiterProfileSetup: { email: string; phoneNumber: string; username: string };
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
  CreateOpportunity: { type: 'internship' | 'job' };
  RecruiterPortal: undefined;
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
  DriveFolderScreen: { folderId: string; title: string };
  PDFViewerScreen: { title: string; fileId?: string; url?: string };
  DSAPrep: undefined;
  GitHubFolderScreen: { path?: string; title?: string };
  MarkdownViewerScreen: { title: string; url: string };
  CodeViewerScreen: { title: string; url: string; language?: string };
  MasterStudyHub: undefined;
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
  FlappyBird: undefined;
  DrawAndGuess: undefined;
  GameLeaderboard: undefined;
  ClubList: undefined;
  ClubHub: { clubId: string };
  CreateClub: undefined;
  CreateSubGroup: { clubId: string };
  EditSubGroup: { subGroupId: string };
  SubGroupChat: { subGroupId: string; subGroupName: string; clubId: string };
  ClubAdminPanel: { clubId: string };
  FyncMediaFeed: undefined;
  CreateFundingFeed: { project?: any } | undefined;
  AdminPortal: undefined;
  DSAAndDevelopmentContest: undefined;
  ContactUs: undefined;
  MeetOurTeam: undefined;
  // Hackathon Ecosystem
  HackathonHub: undefined;
  HackathonCreate: undefined;
  HackathonDetail: { hackathonId: string };
  HackathonTeamScreen: { hackathonId: string; mode?: 'create' | 'browse' };
  HackathonSubmission: { hackathonId: string };
  HackathonLeaderboard: { hackathonId: string; hackathonTitle?: string };
  HackathonJudgePanel: { hackathonId: string; judgingCriteria?: any[] };
  HackathonChannel: { hackathonId: string; hackathonTitle?: string };
  // Profile Builder
  FyncProfileBuilder: undefined;
  // Entertainment Module
  EntertainmentHome: undefined;
  MovieDetail: { movieId: number };
  TrailerReels: { movies?: any[], initialIndex?: number };
  MovieSearch: undefined;
  MovieList: { title: string; type: 'trending' | 'popular' | 'upcoming' | 'bollywood' };
  PartyPool: undefined;
  SubscriptionScreen: undefined;
};



function HomeDrawer() {
  const { user } = useAuth();
  const isAlumni = user?.user_access === 'alumni';

  return (
    <Drawer.Navigator
      id="LeftDrawer"
      drawerContent={(props) => isAlumni ? <AlumniSidebar {...props} /> : <CustomSidebar {...props} />}
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
      <Stack.Screen name="RecruiterSignup">
        {() => <RecruiterSignup />}
      </Stack.Screen>
      <Stack.Screen name="RecruiterProfileSetup">
        {() => <RecruiterProfileSetup />}
      </Stack.Screen>
      <Stack.Screen name="TermsAndCondition">
        {() => <TermsAndCondition />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function AppStack() {
  const { user } = useAuth();

  const isRecruiter = user?.user_access === 'recruiter';

  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "simple_push" }}>
      <Stack.Screen name="Tabs" component={isRecruiter ? RecruiterTabLayout : HomeDrawer} />
      <Stack.Screen name="Profile" component={isRecruiter ? RecruiterProfile : Profile} />
      <Stack.Screen name="EditProfile" component={isRecruiter ? RecruiterEditProfile : EditProfile} />
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
      <Stack.Screen name="CreateOpportunity" component={CreateOpportunity} />
      <Stack.Screen name="RecruiterPortal" component={RecruiterPortal} />
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
      <Stack.Screen name="DSAPrep" component={DSAPrep} />
      <Stack.Screen name="GitHubFolderScreen" component={GitHubFolderScreen} />
      <Stack.Screen name="MarkdownViewerScreen" component={MarkdownViewerScreen} />
      <Stack.Screen name="CodeViewerScreen" component={CodeViewerScreen} />
      <Stack.Screen name="MasterStudyHub" component={MasterStudyHub} />
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
      <Stack.Screen name="CreateCommunity" component={CreateCommunityScreen} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CommunityHub" component={CommunityHubScreen} />
      <Stack.Screen name="SubCommunityChat" component={SubCommunityChat} />
      <Stack.Screen name="ClubList" component={ClubListScreen} />
      <Stack.Screen name="ClubHub" component={ClubHubScreen} />
      <Stack.Screen name="CreateClub" component={CreateClubScreen} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CreateSubGroup" component={CreateSubGroupScreen} />
      <Stack.Screen name="EditSubGroup" component={EditSubGroupScreen} />
      <Stack.Screen name="SubGroupChat" component={SubGroupChat} />
      <Stack.Screen name="ClubAdminPanel" component={ClubAdminPanel} />
      <Stack.Screen name="FocusProductivity" component={FocusProductivity} />
      <Stack.Screen name="TermsAndCondition" component={TermsAndCondition} />
      <Stack.Screen name="FyncMediaFeed" component={FyncMediaFeed} />
      <Stack.Screen name="CreateFundingFeed" component={CreateFundingFeed} />
      <Stack.Screen name="AdminPortal" component={AdminPortal} />
      <Stack.Screen name="DSAAndDevelopmentContest" component={DSAAndDevelopmentContest} />
      <Stack.Screen name="ContactUs" component={ContactUs} />
      <Stack.Screen name="MeetOurTeam" component={MeetOurTeam} />
      
      {/* GAMES */}
      <Stack.Screen name="FlappyBird" component={FlappyBird} options={{ headerShown: false }} />
      <Stack.Screen name="DrawAndGuess" component={DrawAndGuess} options={{ headerShown: false }} />
      <Stack.Screen name="GameLeaderboard" component={GameLeaderboard} options={{ headerShown: false }} />
      
      {/* Hackathon Ecosystem */}
      <Stack.Screen name="HackathonHub" component={HackathonHub} />
      <Stack.Screen name="HackathonCreate" component={HackathonCreate} />
      <Stack.Screen name="HackathonDetail" component={HackathonDetail} />
      <Stack.Screen name="HackathonTeamScreen" component={HackathonTeamScreen} />
      <Stack.Screen name="HackathonSubmission" component={HackathonSubmission} />
      <Stack.Screen name="HackathonLeaderboard" component={HackathonLeaderboard} />
      <Stack.Screen name="HackathonJudgePanel" component={HackathonJudgePanel} />
      <Stack.Screen name="HackathonChannel" component={HackathonChannel} />
      {/* Profile Builder */}
      <Stack.Screen name="FyncProfileBuilder" component={FyncProfileBuilder} />
      
      {/* Entertainment Module */}
      <Stack.Screen name="EntertainmentHome" component={EntertainmentHome} />
      <Stack.Screen name="MovieDetail" component={MovieDetail} />
      <Stack.Screen name="TrailerReels" component={TrailerReels} />
      <Stack.Screen name="MovieSearch" component={MovieSearch} />
      <Stack.Screen name="MovieList" component={MovieList} />
      <Stack.Screen name="PartyPool" component={PartyPoolHub} />
      <Stack.Screen name="SubscriptionScreen" component={SubscriptionScreen as any} />
      

    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();
  const [isSplashDone, setIsSplashDone] = React.useState(false);

  React.useEffect(() => {
    // Ensure splash screen runs for at least 3 seconds (full animation)
    const timer = setTimeout(() => {
      setIsSplashDone(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !isSplashDone) {
    return <SplashScreen />;
  }

  return (
    <React.Suspense fallback={<SplashScreen />}>
      {isLoggedIn ? (
        <SubscriptionGuard>
          <AppStack />
        </SubscriptionGuard>
      ) : (
        <AuthStack />
      )}
    </React.Suspense>
  );
}


const linking = {
  prefixes: ['fync://', 'https://fync-api.duckdns.org'],
  config: {
    screens: {
      IndividualPostOrShort: {
        path: 'view',
      },
      FyncProfileBuilder: {
        path: 'github-connected',
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

  const toastConfig = {
    success: (props: any) => (
      <View className="mx-5 my-2 p-4 bg-white rounded-3xl flex-row items-center shadow-xl border border-slate-100">
        <View className="w-10 h-10 bg-slate-50 rounded-2xl items-center justify-center mr-3 border border-slate-100 overflow-hidden">
          <Image source={require('./assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="text-zinc-900 font-bold text-sm tracking-tight">{props.text1}</Text>
          {props.text2 && <Text className="text-slate-500 text-xs mt-0.5">{props.text2}</Text>}
        </View>
        <View className="bg-green-500 w-1.5 h-6 rounded-full ml-2" />
      </View>
    ),
    info: (props: any) => (
      <View className="mx-5 my-2 p-4 bg-zinc-900 rounded-3xl flex-row items-center shadow-2xl">
        <View className="w-10 h-10 bg-zinc-800 rounded-2xl items-center justify-center mr-3 border border-zinc-700 overflow-hidden">
          <Image source={require('./assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="text-white font-bold text-sm tracking-tight">{props.text1}</Text>
          {props.text2 && <Text className="text-zinc-400 text-xs mt-0.5">{props.text2}</Text>}
        </View>
        <View className="bg-indigo-500 w-1.5 h-6 rounded-full ml-2" />
      </View>
    ),
    error: (props: any) => (
      <View className="mx-5 my-2 p-4 bg-white rounded-3xl flex-row items-center shadow-xl border border-red-50">
        <View className="w-10 h-10 bg-red-50 rounded-2xl items-center justify-center mr-3 border border-red-100 overflow-hidden">
          <Image source={require('./assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="text-red-900 font-bold text-sm tracking-tight">{props.text1}</Text>
          {props.text2 && <Text className="text-red-400 text-xs mt-0.5">{props.text2}</Text>}
        </View>
        <View className="bg-red-500 w-1.5 h-6 rounded-full ml-2" />
      </View>
    ),
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SafeAreaProvider>
          <NavigationContainer ref={navigationRef} linking={linking}>
            <StatusBar style="dark" backgroundColor="#ffffff" />
            <RootNavigator />
            <Toast config={toastConfig} position="top" visibilityTime={4000} topOffset={60} />
          </NavigationContainer>
        </SafeAreaProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
