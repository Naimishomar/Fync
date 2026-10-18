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

/** Artwork lives on a CDN, not in the bundle: 50 PNGs would add ~4 MB to it. */
export const ART_BASE = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/';
/** 3dicons by realvjy (CC0): glossy 3D renders, 400px, ~80 KB each. */
const D3_BASE = 'https://3dicons.sgp1.cdn.digitaloceanspaces.com/v1/dynamic/color/';
const d3 = (slug: string) => `${D3_BASE}${slug}-dynamic-color.png`;
/** `art` is a full URL (3dicons) or a Fluent emoji path relative to ART_BASE. */
export const artUrl = (art?: string) =>
  !art ? undefined : art.startsWith('http') ? art : ART_BASE + encodeURI(art);

export const CATEGORIES: Array<{ id: CategoryId; label: string; icon: IoniconName; art: string }> = [
  { id: 'study', label: 'Study', icon: 'book-outline', art: d3('bookmark') },
  { id: 'career', label: 'Career', icon: 'briefcase-outline', art: d3('medal') },
  { id: 'events', label: 'Events & Contests', icon: 'trophy-outline', art: d3('trophy') },
  { id: 'social', label: 'Social', icon: 'people-outline', art: d3('chat') },
  { id: 'campus', label: 'Campus', icon: 'school-outline', art: d3('location') },
  { id: 'fun', label: 'Fun', icon: 'game-controller-outline', art: d3('music') },
  { id: 'account', label: 'Account', icon: 'settings-outline', art: d3('setting') },
];

export const FEATURES: Feature[] = [
  // ---------- STUDY ----------
  { id: 'studyAssistant', art: d3('bulb'), label: 'Study Assistant', hint: 'AI help with any subject', icon: 'sparkles-outline', route: 'StudyAssistant', tint: '#8b5cf6', category: 'study', keywords: ['ai', 'doubt', 'homework'] },
  { id: 'studyMaterial', art: 'assets/Books/3D/books_3d.png', label: 'Study Material', hint: 'B.Tech notes and papers', icon: 'folder-outline', route: 'DriveFolderScreen', params: { folderId: '1idOWdlHnISpZVvvY0Ett8O_uJALAf_Qv', title: 'B.Tech' }, tint: '#8b5cf6', category: 'study', keywords: ['notes', 'pdf', 'drive', 'btech'] },
  { id: 'academy', art: 'assets/Graduation cap/3D/graduation_cap_3d.png', label: 'Fync Academy', hint: 'Structured learning tracks', icon: 'library-outline', route: 'MasterStudyHub', tint: '#8b5cf6', category: 'study', keywords: ['course', 'dsa', 'roadmap'] },
  { id: 'focus', art: d3('clock'), label: 'Focus Mode', hint: 'Pomodoro timer and streaks', icon: 'timer-outline', route: 'FocusProductivity', tint: '#10b981', category: 'study', keywords: ['pomodoro', 'productivity'] },
  { id: 'bunk', art: 'assets/Spiral calendar/3D/spiral_calendar_3d.png', label: 'BunkOMeter', hint: 'Attendance calculator', icon: 'flashlight-outline', route: 'BunkOMeter', tint: '#10b981', category: 'study', keywords: ['attendance', 'bunk'] },
  { id: 'notesExchange', art: d3('file-text'), label: 'Notes Exchange', hint: 'Share notes, earn coins', icon: 'documents-outline', route: 'NotesExchange', tint: '#10b981', category: 'study', keywords: ['notes', 'pyq', 'papers', 'exam', 'coins', 'share'] },
  { id: 'utilities', art: 'assets/Toolbox/3D/toolbox_3d.png', label: 'Utility Hub', hint: 'PDF, compress, QR tools', icon: 'construct-outline', route: 'UtilityHubScreen', tint: '#10b981', category: 'study', keywords: ['tools', 'pdf', 'qr', 'compress'] },

  // ---------- CAREER ----------
  { id: 'internships', art: 'assets/Briefcase/3D/briefcase_3d.png', label: 'Internships', hint: 'Openings for students', icon: 'school-outline', route: 'InternshipList', tint: '#3b82f6', category: 'career' },
  { id: 'jobs', art: 'assets/Office building/3D/office_building_3d.png', label: 'Jobs', hint: 'Full-time roles', icon: 'business-outline', route: 'JobList', tint: '#3b82f6', category: 'career', keywords: ['hiring', 'placement'] },
  { id: 'workshops', art: d3('paint-kit'), label: 'Workshops', hint: 'Short skill programs', icon: 'easel-outline', route: 'WorkshopList', tint: '#3b82f6', category: 'career' },
  { id: 'placement', art: d3('target'), label: 'Placement Hub', hint: 'Drives, prep and predictor', icon: 'trending-up-outline', route: 'PlacementHub', tint: '#3b82f6', category: 'career', keywords: ['campus placement', 'ctc'] },
  { id: 'gigs', art: 'assets/Money with wings/3D/money_with_wings_3d.png', label: 'Paid Gigs', hint: 'Short paid freelance work', icon: 'cash-outline', route: 'PaidGigs', tint: '#f59e0b', category: 'career', keywords: ['freelance', 'money'] },
  { id: 'profileBuilder', art: 'assets/Identification card/3D/identification_card_3d.png', label: 'Profile Builder', hint: 'Raise your Fync score', icon: 'ribbon-outline', route: 'FyncProfileBuilder', tint: '#f59e0b', category: 'career', keywords: ['resume', 'score', 'portfolio', 'github'] },

  // ---------- EVENTS & CONTESTS ----------
  { id: 'hackathons', art: 'assets/Laptop/3D/laptop_3d.png', label: 'Hackathons', hint: 'Browse and join hackathons', icon: 'rocket-outline', route: 'HackathonHub', tint: '#f97316', category: 'events' },
  { id: 'bootcamps', art: d3('fire'), label: 'Bootcamps', hint: 'Multi-day campus bootcamps', icon: 'bonfire-outline', route: 'BootcampScreen', tint: '#a855f7', category: 'events' },
  { id: 'speakers', art: d3('mic'), label: 'Speaker Sessions', hint: 'Talks and guest lectures', icon: 'mic-outline', route: 'SpeakerSessionScreen', tint: '#6366f1', category: 'events', keywords: ['talk', 'seminar', 'guest'] },
  { id: 'contests', art: d3('trophy'), label: 'Contests', hint: 'Weekly contests and battles', icon: 'trophy-outline', route: 'CodingArena', tint: '#f59e0b', category: 'events', keywords: ['coding', 'competitive', 'contest', 'weekly', 'arena', 'dsa', 'practice', 'leetcode', 'compiler', '1v1', 'battle'] },
  { id: 'battle1v1', art: d3('chess'), label: '1v1 Battle', hint: 'Live quiz duel', icon: 'flash-outline', route: 'OneVsOneSetup', tint: '#f97316', category: 'events', keywords: ['quiz', 'duel', 'versus'] },
  { id: 'createRoom', art: d3('plus'), label: 'Create Quiz Room', hint: 'Host a quiz for friends', icon: 'add-circle-outline', route: 'CreateRoom', tint: '#f97316', category: 'events', keywords: ['quiz', 'host'] },
  { id: 'joinRoom', art: d3('zoom'), label: 'Join Quiz Room', hint: 'Enter a room code', icon: 'enter-outline', route: 'JoinRoomInput', tint: '#f97316', category: 'events', keywords: ['quiz', 'code'] },
  { id: 'codingBoard', art: 'assets/Chart increasing/3D/chart_increasing_3d.png', label: 'Coding Leaderboard', hint: 'Campus coding ranks', icon: 'podium-outline', route: 'CodingLeaderboard', tint: '#4f46e5', category: 'events', keywords: ['rank', 'leetcode'] },
  { id: 'shadowRival', art: d3('magic-trick'), label: 'Shadow Rival', hint: 'Race an anonymous rival', icon: 'eye-off-outline', route: 'ShadowRival', tint: '#4f46e5', category: 'events', keywords: ['rival', 'compete'] },

  // ---------- SOCIAL ----------
  { id: 'alumni', art: d3('boy'), label: 'Campus Alumni', hint: 'Find seniors from your college', icon: 'school-outline', route: 'FindAlumni', tint: '#0ea5e9', category: 'social' },
  { id: 'alumniConnect', art: d3('phone-ringing'), label: 'Alumni Connect', hint: 'Alumni-only chat rooms', icon: 'chatbubbles-outline', route: 'AlumniConnect', tint: '#0ea5e9', category: 'social', access: ['alumni'] },
  { id: 'proHub', art: d3('explorer'), label: 'Professional Hub', hint: 'Global alumni network', icon: 'globe-outline', route: 'ProfessionalHub', tint: '#0ea5e9', category: 'social', access: ['user', 'alumni'] },
  { id: 'teammate', art: 'assets/Handshake/3D/handshake_3d.png', label: 'Find Teammate', hint: 'Match for projects and hacks', icon: 'people-outline', route: 'FindTeammate', tint: '#0ea5e9', category: 'social', keywords: ['team', 'partner'] },
  { id: 'communities', art: d3('chat-bubble'), label: 'Community Hubs', hint: 'Interest-based groups', icon: 'megaphone-outline', route: 'CommunityList', tint: '#14b8a6', category: 'social' },
  { id: 'clubs', art: 'assets/Performing arts/3D/performing_arts_3d.png', label: 'College Clubs', hint: 'Official campus clubs', icon: 'people-circle-outline', route: 'ClubList', tint: '#14b8a6', category: 'social' },
  { id: 'startups', art: d3('3d-coin'), label: 'Startup Feed', hint: 'Ideas looking for funding', icon: 'bulb-outline', route: 'FundingFeed', tint: '#f59e0b', category: 'social', keywords: ['funding', 'idea', 'founder', 'pitch'] },
  { id: 'fyncMedia', art: d3('picture'), label: 'Fync Media', hint: 'Campus news and features', icon: 'newspaper-outline', route: 'FyncMediaFeed', tint: '#f43f5e', category: 'social', keywords: ['news', 'blog'] },

  // ---------- CAMPUS ----------
  { id: 'collegeChat', art: d3('chat-text'), label: 'College Chat', hint: '24hr campus-wide room', icon: 'chatbox-ellipses-outline', route: 'CollegeChatScreen', tint: '#f97316', category: 'campus', needsCollege: true },
  { id: 'notice', art: 'assets/Pushpin/3D/pushpin_3d.png', label: 'Notice Board', hint: 'Official announcements', icon: 'reader-outline', route: 'NoticeBoard', tint: '#64748b', category: 'campus' },
  { id: 'olx', art: 'assets/Shopping bags/3D/shopping_bags_3d.png', label: 'Campus OLX', hint: 'Buy and sell on campus', icon: 'cart-outline', route: 'OLXMarketplace', tint: '#64748b', category: 'campus', keywords: ['marketplace', 'sell', 'buy'] },
  { id: 'lostFound', art: 'assets/Magnifying glass tilted left/3D/magnifying_glass_tilted_left_3d.png', label: 'Lost & Found', hint: 'Report or claim items', icon: 'search-outline', route: 'LostAndFound', tint: '#64748b', category: 'campus' },
  { id: 'rewards', art: d3('gift'), label: 'Rewards Store', hint: 'Spend your Fync points', icon: 'gift-outline', route: 'RewardsMarketplace', tint: '#f59e0b', category: 'campus', keywords: ['points', 'redeem', 'shop'] },

  // ---------- FUN ----------
  { id: 'partyPool', art: 'assets/Party popper/3D/party_popper_3d.png', label: 'Party Pool', hint: 'Mini games with friends', icon: 'game-controller-outline', route: 'PartyPool', tint: '#db2777', category: 'fun', keywords: ['games', 'chess', 'trivia', 'charades'] },
  { id: 'nightClub', art: 'assets/Night with stars/3D/night_with_stars_3d.png', label: '12 AM Club', hint: 'Anonymous, midnight only', icon: 'moon-outline', route: 'TwelveAMHomeCard', tint: '#6366f1', category: 'fun', keywords: ['night', 'anonymous', 'midnight'] },
  { id: 'confessions', art: 'assets/Shushing face/3D/shushing_face_3d.png', label: 'Confessions', hint: 'Post anonymously', icon: 'chatbubble-ellipses-outline', route: 'ConfessionFeed', tint: '#14b8a6', category: 'fun', keywords: ['anonymous', 'secret'] },
  { id: 'audioCall', art: d3('headphone'), label: 'Audio Rooms', hint: 'Live voice calls', icon: 'call-outline', route: 'AudioCallLobby', tint: '#db2777', category: 'fun', keywords: ['voice', 'call'] },
  { id: 'videoCall', art: d3('video-camera'), label: 'Video Rooms', hint: 'Live video calls', icon: 'videocam-outline', route: 'VideoCallLobby', tint: '#db2777', category: 'fun', keywords: ['call', 'face'] },
  { id: 'movies', art: d3('play'), label: 'Entertainment', hint: 'Movies and trailers', icon: 'film-outline', route: 'EntertainmentHome', tint: '#e11d48', category: 'fun', keywords: ['movie', 'trailer', 'cinema'] },

  { id: 'store', art: d3('card'), label: 'Fync Store', hint: 'Student deals, curated', icon: 'pricetags-outline', route: 'AffiliateStore', tint: '#EA580C', category: 'campus', keywords: ['shop', 'deals', 'buy', 'discount', 'affiliate'] },
  { id: 'techPulse', art: 'assets/Satellite antenna/3D/satellite_antenna_3d.png', label: 'Tech Pulse', hint: "Today's biggest tech stories", icon: 'newspaper-outline', route: 'TechPulseScreen', tint: '#2563EB', category: 'career', keywords: ['news', 'industry', 'trending', 'hacker news'] },
  { id: 'myShares', art: d3('link'), label: 'Your Shares', hint: 'Links you shared from the store', icon: 'link-outline', route: 'MySharesScreen', tint: '#EA580C', category: 'account', keywords: ['share', 'refer', 'earn', 'affiliate'] },
  // ---------- ACCOUNT ----------
  { id: 'contact', art: d3('mail'), label: 'Contact Us', hint: 'Support and feedback', icon: 'headset-outline', route: 'ContactUs', tint: '#64748b', category: 'account', keywords: ['help', 'support'] },
  { id: 'team', art: d3('girl'), label: 'Meet Our Team', hint: 'The people behind Fync', icon: 'heart-outline', route: 'MeetOurTeam', tint: '#64748b', category: 'account' },
  { id: 'storeAdmin', art: d3('dollar'), label: 'Store Admin', hint: 'List products, track commission', icon: 'cash-outline', route: 'AffiliateAdminScreen', tint: '#e11d48', category: 'account', access: ['admin'] },
  { id: 'admin', art: d3('sheild'), label: 'Admin Portal', hint: 'Moderation and broadcasts', icon: 'shield-checkmark-outline', route: 'AdminPortal', tint: '#e11d48', category: 'account', access: ['admin'] },
];

/** Off for the store launch; delete an id to bring the feature back. */
export const LAUNCH_HIDDEN = new Set<string>([
  // registry ids
  'studyAssistant', 'focus', 'notesExchange', 'workshops', 'placement', 'contests',
  'battle1v1', 'createRoom', 'joinRoom', 'shadowRival', 'alumni', 'alumniConnect',
  'proHub', 'communities', 'startups', 'fyncMedia', 'rewards', 'audioCall',
  'videoCall', 'movies', 'store', 'myShares', 'storeAdmin',
  // not in the registry, gated at their entry points
  'aiInterview', 'placementPredictor', 'coinToss', 'flappyBird', 'drawGuess',
  'alumniSignup',
  // no in-app purchases at launch (Play billing): Fync Pro, and paid digital extras
  'fyncProPaid', 'paidDigital', 'creatorTips',
]);
export const isFeatureOn = (id: string) => !LAUNCH_HIDDEN.has(id);

/** Tiles this user is allowed to see. */
export const visibleFeatures = (user: any) =>
  FEATURES.filter((f) => {
    if (!isFeatureOn(f.id)) return false;
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
