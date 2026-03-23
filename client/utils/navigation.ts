import { createNavigationContainerRef } from "@react-navigation/native";

export type RootStackParamList = {
  Tabs: undefined;
  SplashScreen: undefined;
  Profile: undefined;
  EditProfile: undefined;
  CreatePost: undefined;
  SearchScreen: undefined;
  RazorpayWebView: { order: any; user: any; keyId: string, merchantName?: string };
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
    questions: any[];
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
  InterviewSetup: undefined;
  ActiveInterview: undefined;
  BunkOMeter: undefined;
  ConfessionFeed: undefined;
  TwelveAMClub: undefined;
  FindTeammate: undefined;
  Notification: undefined;
  SpeakerSessionScreen: undefined;
  // Add others if needed
};

export const navigationRef = createNavigationContainerRef<any>();

export function navigate(name: string, params?: any) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as any, params);
  }
}

export function goBack() {
  if (navigationRef.isReady() && navigationRef.canGoBack()) {
    navigationRef.goBack();
  }
}
