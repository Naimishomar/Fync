import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

/**
 * Every non-feed destination in the app, in one place.
 *
 * This used to be ~35 hand-written <Pressable> rows in CustomSidebar, which is
 * why adding a feature meant editing a 360-line JSX file and why the drawer
 * grew into an unscannable wall. The Explore hub renders this list; the sidebar
 * now only holds account items. Add a feature here and it appears in Explore,
 * in Explore's search, and in "Jump back in" — no screen edits.
 */
export type Feature = {
  id: string;
  label: string;
  /** Shown under the label in search results, and what search also matches on. */
  hint: string;
  icon: IoniconName;
  route: string;
  params?: Record<string, unknown>;
  tint: string;
  category: CategoryId;
  /** Extra words users might search for that aren't in the label or hint. */
  keywords?: string[];
  /** When set, only these user_access values see the tile. */
  access?: Array<'user' | 'alumni' | 'admin' | 'recruiter'>;
  /** When true, only users with a college on their profile see the tile. */
  needsCollege?: boolean;
};

export type CategoryId =
  | 'study'
  | 'career'
  | 'events'
  | 'social'
  | 'campus'
  | 'fun'
  | 'account';

export const CATEGORIES: Array<{ id: CategoryId; label: string; icon: IoniconName }> = [
  { id: 'study', label: 'Study', icon: 'book-outline' },
  { id: 'career', label: 'Career', icon: 'briefcase-outline' },
  { id: 'events', label: 'Events & Contests', icon: 'trophy-outline' },
  { id: 'social', label: 'Social', icon: 'people-outline' },
  { id: 'campus', label: 'Campus', icon: 'school-outline' },
  { id: 'fun', label: 'Fun', icon: 'game-controller-outline' },
  { id: 'account', label: 'Account', icon: 'settings-outline' },
];

export const FEATURES: Feature[] = [
  // ---------- STUDY ----------
  { id: 'studyAssistant', label: 'Study Assistant', hint: 'AI help with any subject', icon: 'sparkles-outline', route: 'StudyAssistant', tint: '#8b5cf6', category: 'study', keywords: ['ai', 'doubt', 'homework'] },
  { id: 'studyMaterial', label: 'Study Material', hint: 'B.Tech notes and papers', icon: 'folder-outline', route: 'DriveFolderScreen', params: { folderId: '1idOWdlHnISpZVvvY0Ett8O_uJALAf_Qv', title: 'B.Tech' }, tint: '#8b5cf6', category: 'study', keywords: ['notes', 'pdf', 'drive', 'btech'] },
  { id: 'academy', label: 'Fync Academy', hint: 'Structured learning tracks', icon: 'library-outline', route: 'MasterStudyHub', tint: '#8b5cf6', category: 'study', keywords: ['course', 'dsa', 'roadmap'] },
  { id: 'focus', label: 'Focus Mode', hint: 'Pomodoro timer and streaks', icon: 'timer-outline', route: 'FocusProductivity', tint: '#10b981', category: 'study', keywords: ['pomodoro', 'productivity'] },
  { id: 'bunk', label: 'BunkOMeter', hint: 'Attendance calculator', icon: 'flashlight-outline', route: 'BunkOMeter', tint: '#10b981', category: 'study', keywords: ['attendance', 'bunk'] },
  { id: 'utilities', label: 'Utility Hub', hint: 'PDF, compress, QR tools', icon: 'construct-outline', route: 'UtilityHubScreen', tint: '#10b981', category: 'study', keywords: ['tools', 'pdf', 'qr', 'compress'] },

  // ---------- CAREER ----------
  { id: 'internships', label: 'Internships', hint: 'Openings for students', icon: 'school-outline', route: 'InternshipList', tint: '#3b82f6', category: 'career' },
  { id: 'jobs', label: 'Jobs', hint: 'Full-time roles', icon: 'business-outline', route: 'JobList', tint: '#3b82f6', category: 'career', keywords: ['hiring', 'placement'] },
  { id: 'workshops', label: 'Workshops', hint: 'Short skill programs', icon: 'easel-outline', route: 'WorkshopList', tint: '#3b82f6', category: 'career' },
  { id: 'placement', label: 'Placement Hub', hint: 'Drives, prep and predictor', icon: 'trending-up-outline', route: 'PlacementHub', tint: '#3b82f6', category: 'career', keywords: ['campus placement', 'ctc'] },
  { id: 'gigs', label: 'Paid Gigs', hint: 'Short paid freelance work', icon: 'cash-outline', route: 'PaidGigs', tint: '#f59e0b', category: 'career', keywords: ['freelance', 'money'] },
  { id: 'profileBuilder', label: 'Profile Builder', hint: 'Raise your Fync score', icon: 'ribbon-outline', route: 'FyncProfileBuilder', tint: '#f59e0b', category: 'career', keywords: ['resume', 'score', 'portfolio', 'github'] },

  // ---------- EVENTS & CONTESTS ----------
  { id: 'hackathons', label: 'Hackathons', hint: 'Browse and join hackathons', icon: 'rocket-outline', route: 'HackathonHub', tint: '#f97316', category: 'events' },
  { id: 'bootcamps', label: 'Bootcamps', hint: 'Multi-day campus bootcamps', icon: 'bonfire-outline', route: 'BootcampScreen', tint: '#a855f7', category: 'events' },
  { id: 'speakers', label: 'Speaker Sessions', hint: 'Talks and guest lectures', icon: 'mic-outline', route: 'SpeakerSessionScreen', tint: '#6366f1', category: 'events', keywords: ['talk', 'seminar', 'guest'] },
  { id: 'contests', label: 'Contests', hint: 'DSA and dev challenges', icon: 'code-slash-outline', route: 'DSAAndDevelopmentContest', tint: '#4f46e5', category: 'events', keywords: ['coding', 'competitive'] },
  { id: 'battle1v1', label: '1v1 Battle', hint: 'Live quiz duel', icon: 'flash-outline', route: 'OneVsOneSetup', tint: '#f97316', category: 'events', keywords: ['quiz', 'duel', 'versus'] },
  { id: 'createRoom', label: 'Create Quiz Room', hint: 'Host a quiz for friends', icon: 'add-circle-outline', route: 'CreateRoom', tint: '#f97316', category: 'events', keywords: ['quiz', 'host'] },
  { id: 'joinRoom', label: 'Join Quiz Room', hint: 'Enter a room code', icon: 'enter-outline', route: 'JoinRoomInput', tint: '#f97316', category: 'events', keywords: ['quiz', 'code'] },
  { id: 'codingBoard', label: 'Coding Leaderboard', hint: 'Campus coding ranks', icon: 'podium-outline', route: 'CodingLeaderboard', tint: '#4f46e5', category: 'events', keywords: ['rank', 'leetcode'] },
  { id: 'shadowRival', label: 'Shadow Rival', hint: 'Race an anonymous rival', icon: 'eye-off-outline', route: 'ShadowRival', tint: '#4f46e5', category: 'events', keywords: ['rival', 'compete'] },

  // ---------- SOCIAL ----------
  { id: 'alumni', label: 'Campus Alumni', hint: 'Find seniors from your college', icon: 'school-outline', route: 'FindAlumni', tint: '#0ea5e9', category: 'social' },
  { id: 'alumniConnect', label: 'Alumni Connect', hint: 'Alumni-only chat rooms', icon: 'chatbubbles-outline', route: 'AlumniConnect', tint: '#0ea5e9', category: 'social', access: ['alumni'] },
  { id: 'proHub', label: 'Professional Hub', hint: 'Global alumni network', icon: 'globe-outline', route: 'ProfessionalHub', tint: '#0ea5e9', category: 'social', access: ['user', 'alumni'] },
  { id: 'teammate', label: 'Find Teammate', hint: 'Match for projects and hacks', icon: 'people-outline', route: 'FindTeammate', tint: '#0ea5e9', category: 'social', keywords: ['team', 'partner'] },
  { id: 'communities', label: 'Community Hubs', hint: 'Interest-based groups', icon: 'megaphone-outline', route: 'CommunityList', tint: '#14b8a6', category: 'social' },
  { id: 'clubs', label: 'College Clubs', hint: 'Official campus clubs', icon: 'people-circle-outline', route: 'ClubList', tint: '#14b8a6', category: 'social' },
  { id: 'startups', label: 'Startup Feed', hint: 'Ideas looking for funding', icon: 'bulb-outline', route: 'FundingFeed', tint: '#f59e0b', category: 'social', keywords: ['funding', 'idea', 'founder', 'pitch'] },
  { id: 'fyncMedia', label: 'Fync Media', hint: 'Campus news and features', icon: 'newspaper-outline', route: 'FyncMediaFeed', tint: '#f43f5e', category: 'social', keywords: ['news', 'blog'] },

  // ---------- CAMPUS ----------
  { id: 'collegeChat', label: 'College Chat', hint: '24hr campus-wide room', icon: 'chatbox-ellipses-outline', route: 'CollegeChatScreen', tint: '#f97316', category: 'campus', needsCollege: true },
  { id: 'notice', label: 'Notice Board', hint: 'Official announcements', icon: 'reader-outline', route: 'NoticeBoard', tint: '#64748b', category: 'campus' },
  { id: 'olx', label: 'Campus OLX', hint: 'Buy and sell on campus', icon: 'cart-outline', route: 'OLXMarketplace', tint: '#64748b', category: 'campus', keywords: ['marketplace', 'sell', 'buy'] },
  { id: 'lostFound', label: 'Lost & Found', hint: 'Report or claim items', icon: 'search-outline', route: 'LostAndFound', tint: '#64748b', category: 'campus' },
  { id: 'rewards', label: 'Rewards Store', hint: 'Spend your Fync points', icon: 'gift-outline', route: 'RewardsMarketplace', tint: '#f59e0b', category: 'campus', keywords: ['points', 'redeem', 'shop'] },

  // ---------- FUN ----------
  { id: 'partyPool', label: 'Party Pool', hint: 'Mini games with friends', icon: 'game-controller-outline', route: 'PartyPool', tint: '#db2777', category: 'fun', keywords: ['games', 'flappy', 'draw'] },
  { id: 'nightClub', label: '12 AM Club', hint: 'Anonymous, midnight only', icon: 'moon-outline', route: 'TwelveAMHomeCard', tint: '#6366f1', category: 'fun', keywords: ['night', 'anonymous', 'midnight'] },
  { id: 'confessions', label: 'Confessions', hint: 'Post anonymously', icon: 'chatbubble-ellipses-outline', route: 'ConfessionFeed', tint: '#14b8a6', category: 'fun', keywords: ['anonymous', 'secret'] },
  { id: 'audioCall', label: 'Audio Rooms', hint: 'Live voice calls', icon: 'call-outline', route: 'AudioCallLobby', tint: '#db2777', category: 'fun', keywords: ['voice', 'call'] },
  { id: 'videoCall', label: 'Video Rooms', hint: 'Live video calls', icon: 'videocam-outline', route: 'VideoCallLobby', tint: '#db2777', category: 'fun', keywords: ['call', 'face'] },
  { id: 'movies', label: 'Entertainment', hint: 'Movies and trailers', icon: 'film-outline', route: 'EntertainmentHome', tint: '#e11d48', category: 'fun', keywords: ['movie', 'trailer', 'cinema'] },

  // ---------- ACCOUNT ----------
  { id: 'contact', label: 'Contact Us', hint: 'Support and feedback', icon: 'headset-outline', route: 'ContactUs', tint: '#64748b', category: 'account', keywords: ['help', 'support'] },
  { id: 'team', label: 'Meet Our Team', hint: 'The people behind Fync', icon: 'heart-outline', route: 'MeetOurTeam', tint: '#64748b', category: 'account' },
  { id: 'admin', label: 'Admin Portal', hint: 'Moderation and broadcasts', icon: 'shield-checkmark-outline', route: 'AdminPortal', tint: '#e11d48', category: 'account', access: ['admin'] },
];

/** Tiles this user is allowed to see. */
export const visibleFeatures = (user: any) =>
  FEATURES.filter((f) => {
    if (f.access && !f.access.includes(user?.user_access)) return false;
    if (f.needsCollege && !user?.college) return false;
    return true;
  });

/**
 * Rank matches so an exact label prefix beats a stray keyword hit — typing
 * "job" should put "Jobs" first, not "Placement Hub" because its hint happens
 * to contain the word.
 */
export const searchFeatures = (features: Feature[], rawQuery: string) => {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const scored = features
    .map((f) => {
      const label = f.label.toLowerCase();
      const haystack = [label, f.hint.toLowerCase(), ...(f.keywords || [])].join(' ');
      let score = 0;
      if (label === q) score = 100;
      else if (label.startsWith(q)) score = 80;
      else if (label.includes(q)) score = 60;
      else if (haystack.includes(q)) score = 30;
      return { f, score };
    })
    .filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score || a.f.label.localeCompare(b.f.label));
  return scored.map((r) => r.f);
};
