import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import React from "react";
import { View, ActivityIndicator, Image, Text, StyleSheet } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import NoInternetScreen from "./components/NoInternetScreen";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from '@react-navigation/drawer';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import Toast from "react-native-toast-message";

import './context/axiosConfig';
import ErrorBoundary from './components/ErrorBoundary';
import { AlertHost } from './components/ui/AlertModal';
//@ts-ignore
import "./global.css";
import { cssInterop, colorScheme as nwColorScheme, useColorScheme } from "nativewind";
import { C, setPalette } from "./constants/colors";
import { loadThemePref } from "./utils/theme";
import { Image as ExpoImage } from "expo-image";

// NativeWind only maps `className` for React Native's own components.
// expo-image wasn't registered, so `<Image className="w-9 h-9">` got no size
// and rendered 0x0 — invisible avatars and thumbnails across the app.
cssInterop(ExpoImage, { className: "style" });

// Campus Press type: Space Grotesk carries every heading, numeral and label;
// Inter carries everything a user actually reads. Both SIL Open Font Licence.
import {
  useFonts,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { StatusBar } from 'expo-status-bar';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import { setupBackgroundHandler } from './services/NotificationService';
// Initialize background push handler early
setupBackgroundHandler();

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
import CreatePost from "./components/create-post";
import Shorts from "./components/Shorts";
import SearchScreen from "./components/SearchScreen";
import ChatList from "./components/ChatList";
import PublicProfile from "./components/PublicProfile";
import Chat from "./components/Chat";

// Startup / first-tap screens stay static. Every other screen loads through
// getComponent so its module (pdf-lib, WebView, webrtc, games...) isn't
// evaluated before first paint.
/* eslint-disable @typescript-eslint/no-require-imports */
import RecruiterPortal from './components/opportunity/RecruiterPortal';
import IndividualPostOrShort from './components/IndividualPostOrShort';
import Notification from "./components/Notification";
import SplashScreen from "./components/SplashScreen";
import CreateShorts from 'components/CreateShorts';
import SubscriptionGuard from './components/newFeatures/SubscriptionGuard';
import TermsAndCondition from './components/T&C';

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
  RecruiterProfileSetup: { email: string; phoneNumber: string; username: string; verificationToken?: string };
  AlumniProfileSetup: { 
    email: string; 
    username: string; 
    phoneNumber: string; 
    password: string; 
    name: string; 
    verificationToken?: string;
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
    verificationToken?: string;
  };
  ProfileSetup1: { email: any; username: any; phoneNumber: any; password: any; verificationToken?: string };
  ProfileSetup2: { email: any; username: any; phoneNumber: any; password: any; fullName: any; birthday: any; gender: any; college: any; major: any; year: any; verificationToken?: string };
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
  CouplesCorner: undefined;
  TwelveAMClub: undefined;
  FindTeammate: undefined;
  Notification: undefined;
  CodingLeaderboard: undefined;
  ShadowRival: undefined;
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
  CommunityFeed: { subId: string; subName: string; communityId: string };
  CommunityPostDetail: { postId: string; subName: string };
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
  FundingFeed: undefined;
  AdminPortal: undefined;
  ContactUs: undefined;
  MeetOurTeam: undefined;
  // Hackathon Ecosystem
  HackathonHub: undefined;
  HackathonCreate: { hackathonId?: string } | undefined;
  HackathonDetail: { hackathonId: string };
  HackathonWinners: { hackathonId: string; hackathonTitle?: string };
  // Profile Builder
  FyncProfileBuilder: undefined;
  // Entertainment Module
  EntertainmentHome: undefined;
  MovieDetail: { movieId: number };
  TrailerReels: { movies?: any[], initialIndex?: number };
  MovieSearch: undefined;
  MovieList: { title: string; type?: 'trending' | 'popular' | 'upcoming' | 'bollywood'; genre?: number };
  PartyPool: undefined;
  SubscriptionScreen: undefined;
  AudioCallLobby: undefined;
  VideoCallLobby: undefined;
  UtilityHubScreen: undefined;
  ImageToPdfScreen: undefined;
  ImageCompressorScreen: undefined;
  QRCodeToolScreen: undefined;
  AffiliateStore: undefined;
  AffiliateProductDetail: { productId: string };
  AffiliateWebView: { url: string; productId: string; saleId?: string };
  AffiliateAdminScreen: undefined;
  TechPulseScreen: undefined;
  ArticleScreen: { url: string; title?: string; source?: string };
  NotesExchange: undefined;
  ArenaAdminScreen: undefined;
  CodingArena: undefined;
  SolveProblem: { problemId: string; title?: string };
  SettingsScreen: undefined;
  MySharesScreen: undefined;
  BlockedUsersScreen: undefined;
  ShareLinkResolver: { code: string };
  MergePdfScreen: undefined;
  SplitPdfScreen: undefined;
  ExtractPagesScreen: undefined;
  RemovePagesScreen: undefined;
  OrganizePagesScreen: undefined;
  RotatePdfScreen: undefined;
  PageNumbersScreen: undefined;
  WatermarkPdfScreen: undefined;
  CropPdfScreen: undefined;
  ScanToPdfScreen: undefined;
  UrlToPdfScreen: undefined;
  PdfToImagesScreen: undefined;
  PdfToTextScreen: undefined;
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
          // Paper, not black: the drawer edge flashed black in light mode while sliding.
          backgroundColor: C.paper,
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
      <Stack.Screen name="EditProfile" getComponent={() => isRecruiter ? require('./components/RecruiterEditProfile').default : require('./components/EditProfile').default} />
      <Stack.Screen name="CreatePost" component={CreatePost} />
      <Stack.Screen name="CreateShorts" component={CreateShorts} />
      <Stack.Screen name="RazorpayWebView" getComponent={() => require('./utils/RazorpayWebView').default} />
      <Stack.Screen name="PaymentVerify" getComponent={() => require('./utils/PaymentVerify').default} />
      <Stack.Screen name="ReceiptWebview" getComponent={() => require('./utils/ReceiptWebview').default} />
      <Stack.Screen name="Shorts" component={Shorts} />
      <Stack.Screen name="SearchScreen" component={SearchScreen} />
      <Stack.Screen name="PublicProfile" component={PublicProfile} />
      <Stack.Screen name="FollowersAndFollowing" getComponent={() => require('./components/FollowersAndFollowing').default} />
      <Stack.Screen name="Chat" component={Chat} />
      <Stack.Screen name="ChatList" component={ChatList} />
      <Stack.Screen name="CreateRoom" getComponent={() => require('./components/quiz/CreateRoom').default} />
      <Stack.Screen name="JoinRoomInput" getComponent={() => require('./components/quiz/JoinRoomInput').default} />
      <Stack.Screen name="WaitingRoom" getComponent={() => require('./components/quiz/WaitingRoom').default} />
      <Stack.Screen name="OneVsOneSetup" getComponent={() => require('./components/quiz/OneVsOneSetup').default} />
      <Stack.Screen name="QuizScreen" getComponent={() => require('./components/quiz/QuizScreen').default} />
      <Stack.Screen name="QuizHome" getComponent={() => require('./components/quiz/QuizHome').default} />
      <Stack.Screen name="LeaderboardScreen" getComponent={() => require('./components/quiz/LeaderboardScreen').default} />
      <Stack.Screen name="HackathonList" getComponent={() => require('./components/opportunity/HackathonList').default} />
      <Stack.Screen name="InternshipList" getComponent={() => require('./components/opportunity/InternshipList').default} />
      <Stack.Screen name="JobList" getComponent={() => require('./components/opportunity/JobList').default} />
      <Stack.Screen name="WorkshopList" getComponent={() => require('./components/opportunity/WorkshopList').default} />
      <Stack.Screen name="CreateOpportunity" getComponent={() => require('./components/opportunity/CreateOpportunity').default} />
      <Stack.Screen name="RecruiterPortal" component={RecruiterPortal} />
      <Stack.Screen name="InterviewSetup" getComponent={() => require('./components/interview/InterviewSetup').default} />
      <Stack.Screen name="ActiveInterview" getComponent={() => require('./components/interview/ActiveInterview').default} />
      <Stack.Screen name="BunkOMeter" getComponent={() => require('./components/newFeatures/BunkOMeter').default} />
      <Stack.Screen name="ConfessionFeed" getComponent={() => require('./components/newFeatures/ConfessionFeed').default} />
      <Stack.Screen name="TwelveAMHomeCard" getComponent={() => require('./components/newFeatures/TwelveAMHomeCard').default} />
      <Stack.Screen name="CouplesCorner" getComponent={() => require('./components/couples/CouplesCorner').default} />
      <Stack.Screen name="TwelveAMClub" getComponent={() => require('./components/newFeatures/TwelveAMClub').default} />
      <Stack.Screen name="FindTeammate" getComponent={() => require('./components/FindTeammate').default} />
      <Stack.Screen name="Notification" component={Notification} />
      <Stack.Screen name="CodingLeaderboard" getComponent={() => require('./components/newFeatures/CodingLeaderboard').default} />
      <Stack.Screen name="ShadowRival" getComponent={() => require('./components/newFeatures/ShadowRival').default} />
      <Stack.Screen name="DriveFolderScreen" getComponent={() => require('./components/studyMaterial/DriveFolderScreen').default} />
      <Stack.Screen name="PDFViewerScreen" getComponent={() => require('./components/studyMaterial/PDFViewerScreen').default} />
      <Stack.Screen name="DSAPrep" getComponent={() => require('./components/studyMaterial/DSAPrep').default} />
      <Stack.Screen name="GitHubFolderScreen" getComponent={() => require('./components/studyMaterial/GitHubFolderScreen').default} />
      <Stack.Screen name="MarkdownViewerScreen" getComponent={() => require('./components/studyMaterial/MarkdownViewerScreen').default} />
      <Stack.Screen name="CodeViewerScreen" getComponent={() => require('./components/studyMaterial/CodeViewerScreen').default} />
      <Stack.Screen name="MasterStudyHub" getComponent={() => require('./components/studyMaterial/MasterStudyHub').default} />
      <Stack.Screen name="IndividualPostOrShort" component={IndividualPostOrShort} />
      <Stack.Screen name="RewardsMarketplace" getComponent={() => require('./components/marketplace/MarketplaceScreen').default} />
      <Stack.Screen name="OLXMarketplace" getComponent={() => require('./components/olx/MarketplaceScreen').default} />
      <Stack.Screen name="LostAndFound" getComponent={() => require('./components/LostAndFound').default} />
      <Stack.Screen name="NoticeBoard" getComponent={() => require('./components/NoticeBoard').default} />
      <Stack.Screen name="PaidGigs" getComponent={() => require('./components/PaidGigs').default} />
      <Stack.Screen name="StudyAssistant" getComponent={() => require('./components/newFeatures/StudyAssistant').default} />
      <Stack.Screen name="CollegeChatScreen" getComponent={() => require('./components/newFeatures/CollegeChatScreen').default} />
      <Stack.Screen name="AlumniConnect" getComponent={() => require('./components/AlumniConnect').default} />
      <Stack.Screen name="ProfessionalHub" getComponent={() => require('./components/ProfessionalHub').default} />
      <Stack.Screen name="FindAlumni" getComponent={() => require('./components/FindAlumni').default} />
      <Stack.Screen name="PlacementHub" getComponent={() => require('./components/newFeatures/PlacementHub').default} />
      <Stack.Screen name="AlumniJobs" getComponent={() => require('./components/newFeatures/AlumniJobs').default} />
      <Stack.Screen name="PlacementPredictor" getComponent={() => require('./components/newFeatures/PlacementPredictor').default} />
      <Stack.Screen name="SpeakerSessionScreen" getComponent={() => require('./components/events/SpeakerSessionScreen').default} />
      <Stack.Screen name="BootcampScreen" getComponent={() => require('./components/events/BootcampScreen').default} />
      <Stack.Screen name="AudioCallLobby" getComponent={() => require('./components/audioCall/AudioCallLobby').default} />
      <Stack.Screen name="VideoCallLobby" getComponent={() => require('./components/videoCall/VideoCallLobby').default} />
      
      {/* Utility Hub */}
      <Stack.Screen name="UtilityHubScreen" getComponent={() => require('./components/utility/UtilityHubScreen').default} />
      <Stack.Screen name="ImageToPdfScreen" getComponent={() => require('./components/utility/ImageToPdfScreen').default} />
      <Stack.Screen name="ImageCompressorScreen" getComponent={() => require('./components/utility/ImageCompressorScreen').default} />
      <Stack.Screen name="QRCodeToolScreen" getComponent={() => require('./components/utility/QRCodeToolScreen').default} />
      <Stack.Screen name="AffiliateStore" getComponent={() => require('./components/affiliate/AffiliateStore').default} />
      <Stack.Screen name="AffiliateProductDetail" getComponent={() => require('./components/affiliate/AffiliateProductDetail').default} />
      <Stack.Screen name="AffiliateWebView" getComponent={() => require('./components/affiliate/AffiliateWebView').default} />
      <Stack.Screen name="AffiliateAdminScreen" getComponent={() => require('./components/affiliate/AffiliateAdminScreen').default} />
      <Stack.Screen name="TechPulseScreen" getComponent={() => require('./components/news/TechPulseScreen').default} />
      <Stack.Screen name="ArticleScreen" getComponent={() => require('./components/news/ArticleScreen').default} />
      <Stack.Screen name="NotesExchange" getComponent={() => require('./components/notes/NotesExchange').default} />
      <Stack.Screen name="ArenaAdminScreen" getComponent={() => require('./components/admin/ArenaAdminScreen').default} />
      <Stack.Screen name="CodingArena" getComponent={() => require('./components/arena/CodingArena').default} />
      <Stack.Screen name="SolveProblem" getComponent={() => require('./components/arena/SolveProblem').default} />
      <Stack.Screen name="SettingsScreen" getComponent={() => require('./components/SettingsScreen').default} />
      <Stack.Screen name="MySharesScreen" getComponent={() => require('./components/affiliate/MySharesScreen').default} />
      <Stack.Screen name="BlockedUsersScreen" getComponent={() => require('./components/BlockedUsersScreen').default} />
      <Stack.Screen name="ShareLinkResolver" getComponent={() => require('./components/affiliate/ShareLinkResolver').default} />
      <Stack.Screen name="MergePdfScreen" getComponent={() => require('./components/utility/pdf/MergePdfScreen').default} />
      <Stack.Screen name="SplitPdfScreen" getComponent={() => require('./components/utility/pdf/SplitPdfScreen').default} />
      <Stack.Screen name="ExtractPagesScreen" getComponent={() => require('./components/utility/pdf/ExtractPagesScreen').default} />
      <Stack.Screen name="RemovePagesScreen" getComponent={() => require('./components/utility/pdf/RemovePagesScreen').default} />
      <Stack.Screen name="OrganizePagesScreen" getComponent={() => require('./components/utility/pdf/OrganizePagesScreen').default} />
      <Stack.Screen name="RotatePdfScreen" getComponent={() => require('./components/utility/pdf/RotatePdfScreen').default} />
      <Stack.Screen name="PageNumbersScreen" getComponent={() => require('./components/utility/pdf/PageNumbersScreen').default} />
      <Stack.Screen name="WatermarkPdfScreen" getComponent={() => require('./components/utility/pdf/WatermarkPdfScreen').default} />
      <Stack.Screen name="CropPdfScreen" getComponent={() => require('./components/utility/pdf/CropPdfScreen').default} />
      <Stack.Screen name="ScanToPdfScreen" getComponent={() => require('./components/utility/pdf/ScanToPdfScreen').default} />
      <Stack.Screen name="UrlToPdfScreen" getComponent={() => require('./components/utility/pdf/UrlToPdfScreen').default} />
      <Stack.Screen name="PdfToImagesScreen" getComponent={() => require('./components/utility/pdf/PdfToImagesScreen').default} />
      <Stack.Screen name="PdfToTextScreen" getComponent={() => require('./components/utility/pdf/PdfToTextScreen').default} />

      <Stack.Screen name="EventCommunityChat" getComponent={() => require('./components/events/EventCommunityChat').default} />
      <Stack.Screen name="CommunityList" getComponent={() => require('./components/community/CommunityListScreen').default} />
      <Stack.Screen name="CreateCommunity" getComponent={() => require('./components/community/CreateCommunityScreen').default} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CommunityHub" getComponent={() => require('./components/community/CommunityHubScreen').default} />
      <Stack.Screen name="SubCommunityChat" getComponent={() => require('./components/community/SubCommunityChat').default} />
      <Stack.Screen name="CommunityFeed" getComponent={() => require('./components/community/CommunityFeed').default} />
      <Stack.Screen name="CommunityPostDetail" getComponent={() => require('./components/community/CommunityPostDetail').default} />
      <Stack.Screen name="ClubList" getComponent={() => require('./components/club/ClubListScreen').default} />
      <Stack.Screen name="ClubHub" getComponent={() => require('./components/club/ClubHubScreen').default} />
      <Stack.Screen name="CreateClub" getComponent={() => require('./components/club/CreateClubScreen').default} options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="CreateSubGroup" getComponent={() => require('./components/club/CreateSubGroupScreen').default} />
      <Stack.Screen name="EditSubGroup" getComponent={() => require('./components/club/EditSubGroupScreen').default} />
      <Stack.Screen name="SubGroupChat" getComponent={() => require('./components/club/SubGroupChat').default} />
      <Stack.Screen name="ClubAdminPanel" getComponent={() => require('./components/club/ClubAdminPanel').default} />
      <Stack.Screen name="FocusProductivity" getComponent={() => require('./components/focus/FocusProductivity').default} />
      <Stack.Screen name="TermsAndCondition" component={TermsAndCondition} />
      <Stack.Screen name="FyncMediaFeed" getComponent={() => require('./components/FyncMediaFeed').default} />
      <Stack.Screen name="CreateFundingFeed" getComponent={() => require('./components/CreateFundingFeed').default} />
      <Stack.Screen name="FundingFeed" getComponent={() => require('./components/FundingFeed').default} />
      <Stack.Screen name="AdminPortal" getComponent={() => require('./components/admin/AdminPortal').default} />
      <Stack.Screen name="ContactUs" getComponent={() => require('./components/ContactUs').default} />
      <Stack.Screen name="MeetOurTeam" getComponent={() => require('./components/MeetOurTeam').default} />
      
      {/* GAMES */}
      <Stack.Screen name="FlappyBird" getComponent={() => require('./components/games/FlappyBird').default} options={{ headerShown: false }} />
      <Stack.Screen name="DrawAndGuess" getComponent={() => require('./components/games/DrawAndGuess').default} options={{ headerShown: false }} />
      <Stack.Screen name="GameLeaderboard" getComponent={() => require('./components/games/GameLeaderboard').default} options={{ headerShown: false }} />
      
      {/* Hackathon Ecosystem */}
      <Stack.Screen name="HackathonHub" getComponent={() => require('./components/hackathon/HackathonHub').default} />
      <Stack.Screen name="HackathonCreate" getComponent={() => require('./components/hackathon/HackathonCreate').default} />
      <Stack.Screen name="HackathonDetail" getComponent={() => require('./components/hackathon/HackathonDetail').default} />
      <Stack.Screen name="HackathonWinners" getComponent={() => require('./components/hackathon/HackathonWinners').default} />
      {/* Profile Builder */}
      <Stack.Screen name="FyncProfileBuilder" getComponent={() => require('./components/profile/FyncProfileBuilder').default} />
      
      {/* Entertainment Module */}
      <Stack.Screen name="EntertainmentHome" getComponent={() => require('./components/entertainment/EntertainmentHome').default} />
      <Stack.Screen name="MovieDetail" getComponent={() => require('./components/entertainment/MovieDetail').default} />
      <Stack.Screen name="TrailerReels" getComponent={() => require('./components/entertainment/TrailerReels').default} />
      <Stack.Screen name="MovieSearch" getComponent={() => require('./components/entertainment/MovieSearch').default} />
      <Stack.Screen name="MovieList" getComponent={() => require('./components/entertainment/MovieList').default} />
      <Stack.Screen name="PartyPool" getComponent={() => require('./components/partyPool/PartyPoolHub').default} />
      <Stack.Screen name="SubscriptionScreen" getComponent={() => require('./components/newFeatures/SubscriptionScreen').default} />
      

    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <>
      {isLoggedIn ? (
        <SubscriptionGuard>
          <AppStack />
        </SubscriptionGuard>
      ) : (
        <AuthStack />
      )}
    </>
  );
}


const makeNavTheme = (dark: boolean) => {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: { ...base.colors, background: C.paper, card: C.card, text: C.ink, border: C.line, primary: C.brand[500] },
  };
};

const linking = {
  prefixes: ['fync://', 'https://fync-api.duckdns.org'],
  config: {
    // Cold-starting from a link otherwise builds a one-screen stack, and back
    // from the shared post/product exits the app instead of landing on home.
    initialRouteName: 'Tabs' as const,
    screens: {
      IndividualPostOrShort: {
        path: 'view',
      },
      FyncProfileBuilder: {
        path: 'github-connected',
      },
      ShareLinkResolver: {
        path: 's/:code',
      },
    },
  },
};

export default function App() {
  const [isConnected, setIsConnected] = React.useState(true);

  // Theme: NativeWind owns the scheme (classes); the JS palette follows it
  // before anything below renders, so every C.* read in this pass matches.
  const { colorScheme: scheme } = useColorScheme();
  setPalette(scheme);
  React.useEffect(() => {
    loadThemePref().then((pref) => nwColorScheme.set(pref)).catch(() => {});
  }, []);
  const navTheme = React.useMemo(() => makeNavTheme(scheme === 'dark'), [scheme]);
  // Screens read C.* during render, so a scheme change remounts the navigator
  // (keyed by scheme) and restores where the user was from this snapshot.
  const navState = React.useRef<any>(undefined);

  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  React.useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected !== false);
    });
    return () => unsubscribe();
  }, []);

  // Hold on paper rather than white: a white flash before the first paint reads
  // as a different app than the one that follows.
  // A font that fails to load falls back to the system face; never spin forever on it.
  if (!fontsLoaded && !fontError) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={C.accentText} />
      </View>
    );
  }

  const toastConfig = {
    success: (props: any) => (
      <View className="mx-5 my-2 p-4 bg-card rounded-3xl flex-row items-center shadow-xl border border-line">
        <View className="w-10 h-10 bg-paper-2 rounded-2xl items-center justify-center mr-3 border border-line overflow-hidden">
          <Image source={require('./assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-sm tracking-tight">{props.text1}</Text>
          {!!props.text2 && <Text className="text-ink-3 text-xs mt-0.5">{props.text2}</Text>}
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
          {!!props.text2 && <Text className="text-zinc-400 text-xs mt-0.5">{props.text2}</Text>}
        </View>
        <View className="bg-indigo-500 w-1.5 h-6 rounded-full ml-2" />
      </View>
    ),
    error: (props: any) => (
      <View className="mx-5 my-2 p-4 bg-card rounded-3xl flex-row items-center shadow-xl border border-danger/10">
        <View className="w-10 h-10 bg-danger/10 rounded-2xl items-center justify-center mr-3 border border-danger/20 overflow-hidden">
          <Image source={require('./assets/Fync.png')} className="w-full h-full" resizeMode="cover" />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-bold text-sm tracking-tight">{props.text1}</Text>
          {!!props.text2 && <Text className="text-danger text-xs mt-0.5">{props.text2}</Text>}
        </View>
        <View className="bg-red-500 w-1.5 h-6 rounded-full ml-2" />
      </View>
    ),
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SafeAreaProvider>
          <NavigationContainer
            key={scheme ?? 'light'}
            ref={navigationRef}
            linking={linking}
            theme={navTheme}
            initialState={navState.current}
            onStateChange={(state) => { navState.current = state; }}
          >
            <StatusBar style={C.statusStyle} backgroundColor="transparent" translucent={true} />
            <RootNavigator />
            <AlertHost />
            <Toast config={toastConfig} position="top" visibilityTime={4000} topOffset={60} />
          </NavigationContainer>
          {/* Overlay, not a replacement: unmounting the tree on a network blip would
              throw away the whole navigation stack and re-run the auth bootstrap. */}
          {!isConnected && (
            <View style={StyleSheet.absoluteFill}>
              <NoInternetScreen onRetry={() => setIsConnected(true)} />
            </View>
          )}
        </SafeAreaProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
