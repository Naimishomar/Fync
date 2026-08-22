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
  /** 3D emoji artwork (Microsoft Fluent Emoji, MIT). Falls back to `icon`. */
  art?: string;
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

/** Artwork lives on a CDN, not in the bundle: 42 PNGs would add ~1.2 MB to it. */
export const ART_BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/';
export const artUrl = (art?: string) => (art ? ART_BASE + encodeURI(art) : undefined);

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
  { id: 'studyAssistant', art: 'assets/Robot/3D/robot_3d.png', label: 'Study Assistant', hint: 'AI help with any subject', icon: 'sparkles-outline', route: 'StudyAssistant', tint: '#8b5cf6', category: 'study', keywords: ['ai', 'doubt', 'homework'] },
  { id: 'studyMaterial', art: 'assets/Books/3D/books_3d.png', label: 'Study Material', hint: 'B.Tech notes and papers', icon: 'folder-outline', route: 'DriveFolderScreen', params: { folderId: '1idOWdlHnISpZVvvY0Ett8O_uJALAf_Qv', title: 'B.Tech' }, tint: '#8b5cf6', category: 'study', keywords: ['notes', 'pdf', 'drive', 'btech'] },
  { id: 'academy', art: 'assets/Graduation cap/3D/graduation_cap_3d.png', label: 'Fync Academy', hint: 'Structured learning tracks', icon: 'library-outline', route: 'MasterStudyHub', tint: '#8b5cf6', category: 'study', keywords: ['course', 'dsa', 'roadmap'] },
  { id: 'focus', art: 'assets/Hourglass done/3D/hourglass_done_3d.png', label: 'Focus Mode', hint: 'Pomodoro timer and streaks', icon: 'timer-outline', route: 'FocusProductivity', tint: '#10b981', category: 'study', keywords: ['pomodoro', 'productivity'] },
  { id: 'bunk', art: 'assets/Bar chart/3D/bar_chart_3d.png', label: 'BunkOMeter', hint: 'Attendance calculator', icon: 'flashlight-outline', route: 'BunkOMeter', tint: '#10b981', category: 'study', keywords: ['attendance', 'bunk'] },
  { id: 'utilities', art: 'assets/Wrench/3D/wrench_3d.png', label: 'Utility Hub', hint: 'PDF, compress, QR tools', icon: 'construct-outline', route: 'UtilityHubScreen', tint: '#10b981', category: 'study', keywords: ['tools', 'pdf', 'qr', 'compress'] },

  // ---------- CAREER ----------
  { id: 'internships', art: 'assets/Briefcase/3D/briefcase_3d.png', label: 'Internships', hint: 'Openings for students', icon: 'school-outline', route: 'InternshipList', tint: '#3b82f6', category: 'career' },
  { id: 'jobs', art: 'assets/Necktie/3D/necktie_3d.png', label: 'Jobs', hint: 'Full-time roles', icon: 'business-outline', route: 'JobList', tint: '#3b82f6', category: 'career', keywords: ['hiring', 'placement'] },
  { id: 'workshops', art: 'assets/Hammer and wrench/3D/hammer_and_wrench_3d.png', label: 'Workshops', hint: 'Short skill programs', icon: 'easel-outline', route: 'WorkshopList', tint: '#3b82f6', category: 'career' },
  { id: 'placement', art: 'assets/Handshake/3D/handshake_3d.png', label: 'Placement Hub', hint: 'Drives, prep and predictor', icon: 'trending-up-outline', route: 'PlacementHub', tint: '#3b82f6', category: 'career', keywords: ['campus placement', 'ctc'] },
  { id: 'gigs', art: 'assets/Money bag/3D/money_bag_3d.png', label: 'Paid Gigs', hint: 'Short paid freelance work', icon: 'cash-outline', route: 'PaidGigs', tint: '#f59e0b', category: 'career', keywords: ['freelance', 'money'] },
  { id: 'profileBuilder', art: 'assets/Identification card/3D/identification_card_3d.png', label: 'Profile Builder', hint: 'Raise your Fync score', icon: 'ribbon-outline', route: 'FyncProfileBuilder', tint: '#f59e0b', category: 'career', keywords: ['resume', 'score', 'portfolio', 'github'] },

  // ---------- EVENTS & CONTESTS ----------
  { id: 'hackathons', art: 'assets/Laptop/3D/laptop_3d.png', label: 'Hackathons', hint: 'Browse and join hackathons', icon: 'rocket-outline', route: 'HackathonHub', tint: '#f97316', category: 'events' },
  { id: 'bootcamps', art: 'assets/Fire/3D/fire_3d.png', label: 'Bootcamps', hint: 'Multi-day campus bootcamps', icon: 'bonfire-outline', route: 'BootcampScreen', tint: '#a855f7', category: 'events' },
  { id: 'speakers', art: 'assets/Microphone/3D/microphone_3d.png', label: 'Speaker Sessions', hint: 'Talks and guest lectures', icon: 'mic-outline', route: 'SpeakerSessionScreen', tint: '#6366f1', category: 'events', keywords: ['talk', 'seminar', 'guest'] },
  { id: 'contests', art: 'assets/Trophy/3D/trophy_3d.png', label: 'Contests', hint: 'DSA and dev challenges', icon: 'code-slash-outline', route: 'DSAAndDevelopmentContest', tint: '#4f46e5', category: 'events', keywords: ['coding', 'competitive'] },
  { id: 'battle1v1', art: 'assets/Crossed swords/3D/crossed_swords_3d.png', label: '1v1 Battle', hint: 'Live quiz duel', icon: 'flash-outline', route: 'OneVsOneSetup', tint: '#f97316', category: 'events', keywords: ['quiz', 'duel', 'versus'] },
  { id: 'createRoom', art: 'assets/Memo/3D/memo_3d.png', label: 'Create Quiz Room', hint: 'Host a quiz for friends', icon: 'add-circle-outline', route: 'CreateRoom', tint: '#f97316', category: 'events', keywords: ['quiz', 'host'] },
  { id: 'joinRoom', art: 'assets/Bullseye/3D/bullseye_3d.png', label: 'Join Quiz Room', hint: 'Enter a room code', icon: 'enter-outline', route: 'JoinRoomInput', tint: '#f97316', category: 'events', keywords: ['quiz', 'code'] },
  { id: 'codingBoard', art: 'assets/Chart increasing/3D/chart_increasing_3d.png', label: 'Coding Leaderboard', hint: 'Campus coding ranks', icon: 'podium-outline', route: 'CodingLeaderboard', tint: '#4f46e5', category: 'events', keywords: ['rank', 'leetcode'] },
  { id: 'shadowRival', art: 'assets/Alien monster/3D/alien_monster_3d.png', label: 'Shadow Rival', hint: 'Race an anonymous rival', icon: 'eye-off-outline', route: 'ShadowRival', tint: '#4f46e5', category: 'events', keywords: ['rival', 'compete'] },

  // ---------- SOCIAL ----------
  { id: 'alumni', art: 'assets/People hugging/3D/people_hugging_3d.png', label: 'Campus Alumni', hint: 'Find seniors from your college', icon: 'school-outline', route: 'FindAlumni', tint: '#0ea5e9', category: 'social' },
  { id: 'alumniConnect', art: 'assets/Telephone receiver/3D/telephone_receiver_3d.png', label: 'Alumni Connect', hint: 'Alumni-only chat rooms', icon: 'chatbubbles-outline', route: 'AlumniConnect', tint: '#0ea5e9', category: 'social', access: ['alumni'] },
  { id: 'proHub', art: 'assets/Office building/3D/office_building_3d.png', label: 'Professional Hub', hint: 'Global alumni network', icon: 'globe-outline', route: 'ProfessionalHub', tint: '#0ea5e9', category: 'social', access: ['user', 'alumni'] },
  { id: 'teammate', art: 'assets/Busts in silhouette/3D/busts_in_silhouette_3d.png', label: 'Find Teammate', hint: 'Match for projects and hacks', icon: 'people-outline', route: 'FindTeammate', tint: '#0ea5e9', category: 'social', keywords: ['team', 'partner'] },
  { id: 'communities', art: 'assets/Houses/3D/houses_3d.png', label: 'Community Hubs', hint: 'Interest-based groups', icon: 'megaphone-outline', route: 'CommunityList', tint: '#14b8a6', category: 'social' },
  { id: 'clubs', art: 'assets/Performing arts/3D/performing_arts_3d.png', label: 'College Clubs', hint: 'Official campus clubs', icon: 'people-circle-outline', route: 'ClubList', tint: '#14b8a6', category: 'social' },
  { id: 'startups', art: 'assets/Rocket/3D/rocket_3d.png', label: 'Startup Feed', hint: 'Ideas looking for funding', icon: 'bulb-outline', route: 'FundingFeed', tint: '#f59e0b', category: 'social', keywords: ['funding', 'idea', 'founder', 'pitch'] },
  { id: 'fyncMedia', art: 'assets/Clapper board/3D/clapper_board_3d.png', label: 'Fync Media', hint: 'Campus news and features', icon: 'newspaper-outline', route: 'FyncMediaFeed', tint: '#f43f5e', category: 'social', keywords: ['news', 'blog'] },

  // ---------- CAMPUS ----------
  { id: 'collegeChat', art: 'assets/Left speech bubble/3D/left_speech_bubble_3d.png', label: 'College Chat', hint: '24hr campus-wide room', icon: 'chatbox-ellipses-outline', route: 'CollegeChatScreen', tint: '#f97316', category: 'campus', needsCollege: true },
  { id: 'notice', art: 'assets/Pushpin/3D/pushpin_3d.png', label: 'Notice Board', hint: 'Official announcements', icon: 'reader-outline', route: 'NoticeBoard', tint: '#64748b', category: 'campus' },
  { id: 'olx', art: 'assets/Shopping bags/3D/shopping_bags_3d.png', label: 'Campus OLX', hint: 'Buy and sell on campus', icon: 'cart-outline', route: 'OLXMarketplace', tint: '#64748b', category: 'campus', keywords: ['marketplace', 'sell', 'buy'] },
  { id: 'lostFound', art: 'assets/Magnifying glass tilted left/3D/magnifying_glass_tilted_left_3d.png', label: 'Lost & Found', hint: 'Report or claim items', icon: 'search-outline', route: 'LostAndFound', tint: '#64748b', category: 'campus' },
  { id: 'rewards', art: 'assets/Wrapped gift/3D/wrapped_gift_3d.png', label: 'Rewards Store', hint: 'Spend your Fync points', icon: 'gift-outline', route: 'RewardsMarketplace', tint: '#f59e0b', category: 'campus', keywords: ['points', 'redeem', 'shop'] },

  // ---------- FUN ----------
  { id: 'partyPool', art: 'assets/Party popper/3D/party_popper_3d.png', label: 'Party Pool', hint: 'Mini games with friends', icon: 'game-controller-outline', route: 'PartyPool', tint: '#db2777', category: 'fun', keywords: ['games', 'flappy', 'draw'] },
  { id: 'nightClub', art: 'assets/Crescent moon/3D/crescent_moon_3d.png', label: '12 AM Club', hint: 'Anonymous, midnight only', icon: 'moon-outline', route: 'TwelveAMHomeCard', tint: '#6366f1', category: 'fun', keywords: ['night', 'anonymous', 'midnight'] },
  { id: 'confessions', art: 'assets/Shushing face/3D/shushing_face_3d.png', label: 'Confessions', hint: 'Post anonymously', icon: 'chatbubble-ellipses-outline', route: 'ConfessionFeed', tint: '#14b8a6', category: 'fun', keywords: ['anonymous', 'secret'] },
  { id: 'audioCall', art: 'assets/Headphone/3D/headphone_3d.png', label: 'Audio Rooms', hint: 'Live voice calls', icon: 'call-outline', route: 'AudioCallLobby', tint: '#db2777', category: 'fun', keywords: ['voice', 'call'] },
  { id: 'videoCall', art: 'assets/Movie camera/3D/movie_camera_3d.png', label: 'Video Rooms', hint: 'Live video calls', icon: 'videocam-outline', route: 'VideoCallLobby', tint: '#db2777', category: 'fun', keywords: ['call', 'face'] },
  { id: 'movies', art: 'assets/Film frames/3D/film_frames_3d.png', label: 'Entertainment', hint: 'Movies and trailers', icon: 'film-outline', route: 'EntertainmentHome', tint: '#e11d48', category: 'fun', keywords: ['movie', 'trailer', 'cinema'] },

  { id: 'store', art: 'assets/Shopping cart/3D/shopping_cart_3d.png', label: 'Fync Store', hint: 'Student deals, curated', icon: 'pricetags-outline', route: 'AffiliateStore', tint: '#EA580C', category: 'campus', keywords: ['shop', 'deals', 'buy', 'discount', 'affiliate'] },
  { id: 'techPulse', art: 'assets/Newspaper/3D/newspaper_3d.png', label: 'Tech Pulse', hint: "Today's biggest tech stories", icon: 'newspaper-outline', route: 'TechPulseScreen', tint: '#2563EB', category: 'career', keywords: ['news', 'industry', 'trending', 'hacker news'] },
  { id: 'myShares', art: 'assets/Link/3D/link_3d.png', label: 'Your Shares', hint: 'Links you shared from the store', icon: 'link-outline', route: 'MySharesScreen', tint: '#EA580C', category: 'account', keywords: ['share', 'refer', 'earn', 'affiliate'] },
  // ---------- ACCOUNT ----------
  { id: 'contact', art: 'assets/Envelope/3D/envelope_3d.png', label: 'Contact Us', hint: 'Support and feedback', icon: 'headset-outline', route: 'ContactUs', tint: '#64748b', category: 'account', keywords: ['help', 'support'] },
  { id: 'team', art: 'assets/Person with bunny ears/3D/person_with_bunny_ears_3d.png', label: 'Meet Our Team', hint: 'The people behind Fync', icon: 'heart-outline', route: 'MeetOurTeam', tint: '#64748b', category: 'account' },
  { id: 'storeAdmin', art: 'assets/Receipt/3D/receipt_3d.png', label: 'Store Admin', hint: 'List products, track commission', icon: 'cash-outline', route: 'AffiliateAdminScreen', tint: '#e11d48', category: 'account', access: ['admin'] },
  { id: 'admin', art: 'assets/Shield/3D/shield_3d.png', label: 'Admin Portal', hint: 'Moderation and broadcasts', icon: 'shield-checkmark-outline', route: 'AdminPortal', tint: '#e11d48', category: 'account', access: ['admin'] },
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
