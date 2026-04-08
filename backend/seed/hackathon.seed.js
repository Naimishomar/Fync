/**
 * ============================================================
 *  Fync Hackathon Ecosystem — Seed Script
 * ============================================================
 *  Run from the backend folder:
 *    node seed/hackathon.seed.js
 * ============================================================
 */

import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { nanoid } from 'nanoid';

// Models
import User from '../models/user.model.js';
import Hackathon from '../models/hackathon/hackathons.model.js';
import HackathonTeam from '../models/hackathon/team.model.js';
import Announcement from '../models/hackathon/announcements.model.js';
import SubmissionModel from '../models/hackathon/submission.model.js';

// ─── Connect ─────────────────────────────────────────────────────────────────
await mongoose.connect(process.env.MONGO_URI, { family: 4 });
console.log('✅ Connected to DB');

const hash = (pw) => bcrypt.hashSync(pw, 10);
const now  = new Date();
const d    = (days) => new Date(now.getTime() + days * 86400000);

// ─── 1. Seed Users ────────────────────────────────────────────────────────────
console.log('\n👤 Seeding users...');

const USERS = [
  {
    name: 'Arjun Sharma',
    username: 'arjun_dev',
    email: 'arjun@fync.app',
    mobileNumber: '9000000001',
    password: hash('pass1234'),
    dob: new Date('2002-05-12'),
    college: 'IIT Bombay',
    year: 3,
    major: 'Computer Science',
    gender: 'Male',
    skills: ['React Native', 'Node.js', 'MongoDB'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=arjun',
    user_access: 'user',
  },
  {
    name: 'Priya Nair',
    username: 'priya_ml',
    email: 'priya@fync.app',
    mobileNumber: '9000000002',
    password: hash('pass1234'),
    dob: new Date('2001-08-25'),
    college: 'IIT Bombay',
    year: 4,
    major: 'Data Science',
    gender: 'Female',
    skills: ['Python', 'ML', 'TensorFlow', 'FastAPI'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=priya',
    user_access: 'user',
  },
  {
    name: 'Karan Mehta',
    username: 'karan_block',
    email: 'karan@fync.app',
    mobileNumber: '9000000003',
    password: hash('pass1234'),
    dob: new Date('2003-01-15'),
    college: 'NIT Trichy',
    year: 2,
    major: 'Electronics',
    gender: 'Male',
    skills: ['Solidity', 'Web3.js', 'React'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=karan',
    user_access: 'user',
  },
  {
    name: 'Sneha Patel',
    username: 'sneha_design',
    email: 'sneha@fync.app',
    mobileNumber: '9000000004',
    password: hash('pass1234'),
    dob: new Date('2002-11-30'),
    college: 'BITS Pilani',
    year: 3,
    major: 'Computer Science',
    gender: 'Female',
    skills: ['Figma', 'Flutter', 'Firebase'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=sneha',
    user_access: 'user',
  },
  {
    name: 'Dr. Rahul Verma',
    username: 'rahul_judge',
    email: 'rahul.judge@fync.app',
    mobileNumber: '9000000005',
    password: hash('pass1234'),
    dob: new Date('1985-03-20'),
    college: 'IIT Delhi',
    year: 1,
    major: 'Computer Science',
    gender: 'Male',
    skills: ['AI', 'Research', 'Cloud'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=rahul',
    user_access: 'user',
    role: 'Senior Engineer @ Google',
  },
  {
    name: 'Ananya Singh',
    username: 'ananya_judge',
    email: 'ananya.judge@fync.app',
    mobileNumber: '9000000006',
    password: hash('pass1234'),
    dob: new Date('1988-07-14'),
    college: 'IISc Bangalore',
    year: 1,
    major: 'Computer Science',
    gender: 'Female',
    skills: ['Blockchain', 'Security', 'ML'],
    avatar: 'https://api.dicebear.com/7.x/avataaars/png?seed=ananya',
    user_access: 'user',
    role: 'Tech Lead @ Microsoft',
  },
];

// Upsert users (don't duplicate if already seeded)
const createdUsers = [];
for (const u of USERS) {
  let user = await User.findOne({ email: u.email });
  if (!user) {
    user = await User.create(u);
    console.log(`  ✓ Created user: ${u.name}`);
  } else {
    console.log(`  ~ Exists: ${u.name}`);
  }
  createdUsers.push(user);
}

const [arjun, priya, karan, sneha, judgeRahul, judgeAnanya] = createdUsers;

// ─── 2. Remove old seed hackathons ───────────────────────────────────────────
await Hackathon.deleteMany({ title: /\[SEED\]/ });
console.log('\n🗑  Cleared old seed hackathons');

// ─── 3. Create Hackathons in all statuses ─────────────────────────────────────
console.log('\n🚀 Seeding hackathons...');

const hackathonDefs = [
  // ACTIVE 🔥
  {
    title: '[SEED] FyncThon 2026 — Build the Future',
    status: 'active',
    hackathonstarts: d(-2),
    hackathonends: d(3),
    registrationstart: d(-15),
    registrationends: d(-3),
    prizepool: '₹2,00,000',
    prizes: [
      { rank: 1, title: '1st Place', amount: '₹1,00,000' },
      { rank: 2, title: '2nd Place', amount: '₹60,000' },
      { rank: 3, title: '3rd Place', amount: '₹40,000' },
    ],
    tags: ['AI/ML', 'Web3', 'HealthTech', 'React Native'],
    MaxTeamSize: 4,
    organiser: arjun._id,
    createdBy: arjun._id,
    judges: [judgeRahul._id, judgeAnanya._id],
    participants: [arjun._id, priya._id, karan._id, sneha._id],
    eligibility: {
      colleges: ['IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'IISc Bangalore'],
      Year: ['1st', '2nd', '3rd', '4th'],
      branch: ['CSE', 'IT', 'ECE'],
    },
    judgingcriteria: [
      { name: 'Innovation', weightage: '30', description: 'How novel and creative is the solution?' },
      { name: 'Impact', weightage: '25', description: 'Real-world problem-solving potential' },
      { name: 'Technical Depth', weightage: '25', description: 'Quality of code and architecture' },
      { name: 'Presentation', weightage: '20', description: 'Demo clarity and pitch quality' },
    ],
    sponsors: [
      { name: 'Google', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Google_2015_logo.svg/800px-Google_2015_logo.svg.png' },
      { name: 'Microsoft', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/800px-Microsoft_logo.svg.png' },
    ],
    bannerImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop',
  },

  // UPCOMING 🔜
  {
    title: '[SEED] BlockChain Clash — Web3 Edition',
    status: 'upcoming',
    hackathonstarts: d(10),
    hackathonends: d(12),
    registrationstart: d(-2),
    registrationends: d(8),
    prizepool: '₹75,000',
    prizes: [
      { rank: 1, title: 'Champion', amount: '₹40,000' },
      { rank: 2, title: 'Runner Up', amount: '₹20,000' },
      { rank: 3, title: '3rd Place', amount: '₹15,000' },
    ],
    tags: ['Blockchain', 'Solidity', 'DeFi', 'NFT'],
    MaxTeamSize: 3,
    organiser: karan._id,
    createdBy: karan._id,
    judges: [judgeAnanya._id],
    participants: [karan._id, sneha._id],
    eligibility: {
      colleges: [],
      Year: ['2nd', '3rd', '4th'],
      branch: ['CSE', 'IT'],
    },
    judgingcriteria: [
      { name: 'Smart Contract Security', weightage: '40', description: 'Vulnerability-free contract logic' },
      { name: 'Use Case Relevance', weightage: '35', description: 'Real-world blockchain utility' },
      { name: 'Frontend UX', weightage: '25', description: 'dApp usability and design' },
    ],
    sponsors: [{ name: 'Polygon', logo: 'https://cryptologos.cc/logos/polygon-matic-logo.png' }],
    bannerImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop',
  },

  // JUDGING ⚖️
  {
    title: '[SEED] AI for Good — Healthcare Hackathon',
    status: 'judging',
    hackathonstarts: d(-10),
    hackathonends: d(-1),
    registrationstart: d(-25),
    registrationends: d(-12),
    prizepool: '₹1,50,000',
    prizes: [
      { rank: 1, title: 'Gold', amount: '₹80,000' },
      { rank: 2, title: 'Silver', amount: '₹45,000' },
      { rank: 3, title: 'Bronze', amount: '₹25,000' },
    ],
    tags: ['AI', 'HealthTech', 'ML', 'IoT'],
    MaxTeamSize: 5,
    organiser: priya._id,
    createdBy: priya._id,
    judges: [judgeRahul._id, judgeAnanya._id],
    participants: [arjun._id, priya._id, karan._id, sneha._id],
    eligibility: {
      colleges: [],
      Year: ['1st', '2nd', '3rd', '4th'],
      branch: ['CSE', 'Biotech', 'ECE'],
    },
    judgingcriteria: [
      { name: 'Clinical Impact', weightage: '35', description: 'How well does this address a real health problem?' },
      { name: 'AI Accuracy', weightage: '30', description: 'Model performance on test data' },
      { name: 'Scalability', weightage: '20', description: 'Can it work at population scale?' },
      { name: 'Data Privacy', weightage: '15', description: 'HIPAA/patient safety compliance' },
    ],
    sponsors: [
      { name: 'Apollo Hospitals', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Apollo_Hospitals_logo.svg/800px-Apollo_Hospitals_logo.svg.png' },
    ],
    bannerImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&auto=format&fit=crop',
  },

  // COMPLETED ✅
  {
    title: '[SEED] Campus Coders Cup — Season 1',
    status: 'completed',
    hackathonstarts: d(-30),
    hackathonends: d(-28),
    registrationstart: d(-45),
    registrationends: d(-32),
    prizepool: '₹50,000',
    prizes: [
      { rank: 1, title: '1st Place', amount: '₹25,000' },
      { rank: 2, title: '2nd Place', amount: '₹15,000' },
      { rank: 3, title: '3rd Place', amount: '₹10,000' },
    ],
    tags: ['DSA', 'Competitive', 'Open Source', 'Web Dev'],
    MaxTeamSize: 4,
    organiser: sneha._id,
    createdBy: sneha._id,
    judges: [judgeRahul._id],
    participants: [arjun._id, priya._id, karan._id, sneha._id],
    eligibility: {
      colleges: [],
      Year: ['1st', '2nd', '3rd'],
      branch: ['CSE', 'IT'],
    },
    judgingcriteria: [
      { name: 'Code Quality', weightage: '40', description: 'Clean, documented, efficient code' },
      { name: 'Problem Solving', weightage: '35', description: 'Complexity and correctness of solutions' },
      { name: 'Teamwork', weightage: '25', description: 'Collaboration and git hygiene' },
    ],
    sponsors: [],
    bannerImage: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop',
  },
];

const createdHacks = [];
for (const def of hackathonDefs) {
  const hack = await Hackathon.create({ ...def, hackathonId: nanoid(16) });
  createdHacks.push(hack);
  console.log(`  ✓ [${hack.status.toUpperCase()}] ${hack.title}`);
}

const [activeHack, upcomingHack, judgingHack, completedHack] = createdHacks;

// ─── 4. Announcements ─────────────────────────────────────────────────────────
console.log('\n📢 Seeding announcements...');

await Announcement.deleteMany({ hackathon: { $in: createdHacks.map(h => h._id) } });

const announcements = [
  // Active hackathon announcements
  {
    hackathon: activeHack._id,
    author: arjun._id,
    Title: '🚀 FyncThon is Now LIVE!',
    body: 'The hackathon has officially begun! You have 72 hours to build, ship, and impress. Head to the Submissions tab and start your draft. All the best! 💪',
    type: 'general',
    isPinned: true,
  },
  {
    hackathon: activeHack._id,
    author: judgeRahul._id,
    Title: '⚠️ Submission Deadline Reminder',
    body: 'Remember: Final submissions close in 3 days. Make sure your GitHub URL or demo link is working. Submissions without a working demo will be disqualified.',
    type: 'important',
    isPinned: false,
  },
  {
    hackathon: activeHack._id,
    author: arjun._id,
    Title: '📅 Schedule Change — Opening Ceremony',
    body: 'The opening ceremony keynote has been moved from 9 AM to 11 AM IST. Please update your calendars!',
    type: 'schedule_change',
    isPinned: false,
  },

  // Judging hackathon announcements
  {
    hackathon: judgingHack._id,
    author: priya._id,
    Title: '⚖️ Judging Has Begun',
    body: 'All 14 submissions are now under review by our judge panel. Results will be announced within 48 hours. Thank you for participating!',
    type: 'general',
    isPinned: true,
  },
  {
    hackathon: judgingHack._id,
    author: judgeRahul._id,
    Title: '🏆 Top 3 Shortlisted',
    body: 'The judges have shortlisted 3 projects for the final round. Shortlisted teams will be contacted for a 10-minute live demo.',
    type: 'result',
    isPinned: false,
  },

  // Completed hackathon announcement
  {
    hackathon: completedHack._id,
    author: sneha._id,
    Title: '🎉 Winners Announced!',
    body: '1st: Team Nebula (MediAI) • 2nd: Team Ctrl+Z (EduBot) • 3rd: Team ByteForce (GreenChain). Congratulations to all participants! Prize money will be transferred within 5 business days.',
    type: 'result',
    isPinned: true,
  },
];

for (const ann of announcements) {
  await Announcement.create(ann);
}
console.log(`  ✓ Created ${announcements.length} announcements`);

// ─── 5. Teams ─────────────────────────────────────────────────────────────────
console.log('\n👥 Seeding teams...');

await HackathonTeam.deleteMany({ hackathon: { $in: createdHacks.map(h => h._id) } });

const teams = [
  // Active hackathon teams
  {
    name: 'Team Nebula',
    hackathon: activeHack._id,
    leader: arjun._id,
    members: [
      { user: arjun._id, role: 'leader' },
      { user: priya._id, role: 'member' },
    ],
    requiredSkills: ['Flutter', 'Firebase', 'UI/UX'],
    description: 'Building an AI-powered skill gap analyzer for college students.',
    lookingForMembers: true,
    isLocked: false,
  },
  {
    name: 'Team Ctrl+Z',
    hackathon: activeHack._id,
    leader: karan._id,
    members: [
      { user: karan._id, role: 'leader' },
      { user: sneha._id, role: 'member' },
    ],
    requiredSkills: ['React', 'Node.js', 'MongoDB'],
    description: 'An undo-everything productivity suite for developers.',
    lookingForMembers: true,
    isLocked: false,
  },
  {
    name: 'Solo Thunder',
    hackathon: activeHack._id,
    leader: priya._id,
    members: [{ user: priya._id, role: 'leader' }],
    requiredSkills: ['Python', 'FastAPI', 'ML'],
    description: 'ML-powered crop disease detection for farmers.',
    lookingForMembers: true,
    isLocked: false,
  },

  // Upcoming hackathon — already forming up
  {
    name: 'ChainGang',
    hackathon: upcomingHack._id,
    leader: karan._id,
    members: [{ user: karan._id, role: 'leader' }],
    requiredSkills: ['Solidity', 'Hardhat', 'React'],
    description: 'Decentralized scholarship fund management on Polygon.',
    lookingForMembers: true,
    isLocked: false,
  },

  // Judging hackathon — closed teams
  {
    name: 'HealthBots',
    hackathon: judgingHack._id,
    leader: priya._id,
    members: [
      { user: priya._id, role: 'leader' },
      { user: arjun._id, role: 'member' },
      { user: sneha._id, role: 'member' },
    ],
    requiredSkills: ['ML', 'FastAPI', 'React Native'],
    description: 'AI medical diagnosis assistant for rural clinics.',
    lookingForMembers: false,
    isLocked: true,
  },
];

const createdTeams = [];
for (const team of teams) {
  const t = await HackathonTeam.create(team);
  createdTeams.push(t);
  console.log(`  ✓ ${t.name} (${t.members.length} members)`);
}

// ─── 6. Submissions ───────────────────────────────────────────────────────────
console.log('\n📦 Seeding submissions...');

try {
  await SubmissionModel.deleteMany({ hackathon: { $in: createdHacks.map(h => h._id) } });
} catch { /* Model may not exist yet */ }

try {
  const nebula = createdTeams[0]; // Team Nebula — active hack
  const healthbots = createdTeams[4]; // HealthBots — judging hack

  await SubmissionModel.create({
    hackathon: activeHack._id,
    team: nebula._id,
    submittedBy: arjun._id,
    ProjectName: 'SkillBridge AI',
    TagLine: 'Know what you lack. Learn what matters.',
    description: 'An AI-powered platform that analyzes a student\'s current skills vs job market demand and creates a personalized learning roadmap. Built using React Native, FastAPI, and GPT-4.',
    techStack: ['React Native', 'FastAPI', 'GPT-4', 'MongoDB', 'Node.js'],
    category: 'AI/ML',
    GithubUrl: 'https://github.com/arjun-dev/skillbridge-ai',
    demourl: 'https://skillbridge.demo.fync.app',
    videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    status: 'draft',
  });

  await SubmissionModel.create({
    hackathon: judgingHack._id,
    team: healthbots._id,
    submittedBy: priya._id,
    ProjectName: 'MediAI Assist',
    TagLine: 'AI diagnosis for the last mile.',
    description: 'A mobile-first AI doctor for rural India. Users describe symptoms via voice in Hindi/Tamil, and the ML model suggests possible diagnoses and nearby clinics. 94% accuracy on AIIMS dataset.',
    techStack: ['React Native', 'TensorFlow Lite', 'FastAPI', 'Python', 'Firebase'],
    category: 'HealthTech',
    GithubUrl: 'https://github.com/priya-ml/mediai',
    demourl: 'https://mediai.demo.fync.app',
    videoUrl: 'https://youtube.com/watch?v=abc123',
    status: 'submitted',
    submittedAt: d(-2),
  });

  console.log('  ✓ Created 2 submissions (1 draft, 1 finalized)');
} catch (e) {
  console.log('  ⚠ Skipped submissions (model may have schema issues):', e.message);
}

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log('\n🎉 Seed complete!\n');
console.log('─────────────────────────────────────────────────');
console.log('📊 Summary:');
console.log(`  👤 Users:        ${USERS.length} (arjun, priya, karan, sneha, 2 judges)`);
console.log(`  🚀 Hackathons:   ${createdHacks.length} (active, upcoming, judging, completed)`);
console.log(`  📢 Announcements: ${announcements.length}`);
console.log(`  👥 Teams:        ${teams.length}`);
console.log('  📦 Submissions:  2');
console.log('─────────────────────────────────────────────────');
console.log('\n🔑 Test Login Credentials (any account):');
console.log('  📧 Email:    arjun@fync.app     | 🔑 Pass: pass1234');
console.log('  📧 Email:    priya@fync.app     | 🔑 Pass: pass1234');
console.log('  📧 Email:    karan@fync.app     | 🔑 Pass: pass1234');
console.log('  📧 Email:    sneha@fync.app     | 🔑 Pass: pass1234');
console.log('─────────────────────────────────────────────────\n');

process.exit(0);
