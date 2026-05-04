import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import connectDB from './db/db.js';
import authRoute from './routes/auth.route.js';
import postRoute from './routes/post.route.js';
import chatRoute from './routes/chat.route.js';
import paymentRoute from './routes/payment.route.js';
import shortRoute from './routes/short.route.js';
import fundingRoute from './routes/funding.route.js';
import quizRoute from './routes/quiz.route.js';
import interviewRoute from './routes/interview.route.js';
import notificationRoute from './routes/notification.route.js';
import codingRoute from './routes/coding.route.js';
import codingArenaRoute from './routes/codingArena.route.js';
import OLXRoute from './routes/olx.route.js';
import LostAndFoundRoute from './routes/lostAndFound.route.js';
import noticeRoute from './routes/notice.route.js';
import paidGigsRoute from './routes/paidGigs.route.js';
import AiIntelligenceRoute from './routes/aiItelligence.route.js';
import subscriptionRoute from './routes/subscription.route.js';
import collegeChatRoute from './routes/collegeChat.route.js';
import alumniConnectRoute from './routes/alumniChat.route.js';
import placementHubRoute from './routes/placementHub.route.js';
import mentorshipChatRoute from './routes/mentorshipChat.route.js';
import nightChatRoute from './routes/nightChat.route.js';
import jobOpeningRoute from './routes/jobOpening.route.js';
import placementPredictorRoute from './routes/placementPredictor.route.js';
import confessionRoute from './routes/newFeatures/confession.route.js';
import speakerRoute from './routes/events/speakers.route.js';
import bootcampRoute from './routes/events/bootcamp.route.js';
import communityRoute from './routes/community/community.routes.js';
import fyncMediaRoute from './routes/fyncMedia.route.js';
import clubRoute from './routes/club/club.routes.js';
import marketplaceRoute from './routes/marketplace/marketplace.route.js';
import adRoute from './routes/ad.route.js';
import contactUsRoute from './routes/contactUs/contactUs.route.js';
import hackathonRoute from './routes/hackathon/hackathon.route.js';
import teamRoute from './routes/hackathon/team.route.js';
import submissionRoute from './routes/hackathon/submission.route.js';
import announcementRoute from './routes/hackathon/announcement.route.js';
import scoreRoute from './routes/hackathon/score.route.js';
import leaderboardRoute from './routes/hackathon/leaderboard.route.js';
import profileRoute from './routes/profile/profile.route.js';
import opportunityRoute from './routes/opportunity.route.js';
import arenaRoute from './routes/coding/arena.route.js';
import arenaAdminRoute from './routes/coding/arenaAdmin.route.js';
import entertainmentRoute from './routes/entertainment.routes.js';
import ContestManager from './services/contestManager.js';

import { setCollegeChatIo } from './controllers/collegeChat.controller.js';
import { setAlumniChatIo } from './controllers/alumniChat.controller.js';
import { setMentorshipIo } from './controllers/mentorshipChat.controller.js';
import { setEventCommunityIo } from './controllers/events/eventActivity.controller.js';
import { setCommunityIo } from './controllers/community/community.controller.js';
import { setClubIo } from './controllers/club/message.controller.js';
import { initCollegeChatCleanup } from './utils/collegeChatCleanup.js';
import { initMentorshipCleanup } from './utils/mentorshipCleanup.js';
import { initNightClubCleanup } from './utils/nightClubCleanup.js';
import { initAlumniChatCleanup } from './utils/alumniChatCleanup.js';
import { initEventCleanup } from './utils/eventCleanup.js';
import { initCommunityCleanup } from './utils/communityCleanup.js';
import { initFyncMediaCleanup } from './utils/fyncMediaCleanup.js';
import startCleanupCron from './services/cleanup.service.js';

import { rateLimit } from 'express-rate-limit';

import { socketController } from './controllers/socket.controller.js';
import codingBattleSockets from './controllers/coding/battle.socket.js';
import compression from 'compression';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { monitoringMiddleware } from './middlewares/monitoring.middleware.js';
import { generalLimiter } from './middlewares/rateLimit.middleware.js';

const app = express();
app.use(generalLimiter);


const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"],
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  allowEIO3: true
});

io.engine.on("connection_error", (err) => {
  console.log("❌ Engine Connection Error:", err.req ? err.req.url : "No Req", err.code, err.message, err.context);
});

app.use(helmet({
  crossOriginResourcePolicy: false, 
}));
app.use(compression());
app.use(cors({
  origin: "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize());

app.use(monitoringMiddleware);

app.use(cookieParser());
app.use("/receipts", express.static("receipts"));

app.use('/user', authRoute);
app.use('/post', postRoute);
app.use('/opportunity', opportunityRoute);
app.use('/chat', chatRoute);
app.use('/chat', chatRoute);
app.use('/payment', paymentRoute);
app.use('/api/payment', paymentRoute);
app.use('/communities', communityRoute);
app.use('/api/communities', communityRoute);
app.use('/subscription', subscriptionRoute);
app.use('/api/subscription', subscriptionRoute);
app.use('/shorts', shortRoute);
app.use('/funding', fundingRoute);
app.use('/quiz', quizRoute);
app.use('/interview', interviewRoute);
app.use('/notifications', notificationRoute);
app.use('/leaderboard', codingRoute);
app.use('/coding-arena', codingArenaRoute);
app.use('/olx', OLXRoute);
app.use('/lostAndFound', LostAndFoundRoute);
app.use('/notice', noticeRoute);
app.use('/gigs', paidGigsRoute);
app.use('/api', AiIntelligenceRoute);
app.use('/college-chat', collegeChatRoute);
app.use('/alumni-chat', alumniConnectRoute);
app.use('/placement', placementHubRoute);
app.use('/mentorship-chat', mentorshipChatRoute);
app.use('/night-chat', nightChatRoute);
app.use('/job-openings', jobOpeningRoute);
app.use('/placement-predictor', placementPredictorRoute);
app.use('/confessions', confessionRoute);
app.use('/speakers', speakerRoute);
app.use('/bootcamp', bootcampRoute);
app.use('/fync-media', fyncMediaRoute);
app.use('/clubs', clubRoute);
app.use('/api/marketplace', marketplaceRoute);
app.use('/ads', adRoute);
app.use('/contact-us', contactUsRoute);
app.use('/hackathons', hackathonRoute);
app.use('/teams', teamRoute);
app.use('/submissions', submissionRoute);
app.use('/announcements', announcementRoute);
app.use('/scores', scoreRoute);
app.use('/hackathon-leaderboard', leaderboardRoute);
app.use('/profile', profileRoute);
app.use('/arena', arenaRoute);
app.use('/arena/admin', arenaAdminRoute);
app.use('/entertainment', entertainmentRoute);

const startServer = async () => {
  try {
    // 1. Connect to Database First
    await connectDB();
    console.log("✅ Database Connected");

    // 2. Initialize Core Services
    socketController(io);
    setCollegeChatIo(io);
    setAlumniChatIo(io);
    setMentorshipIo(io);
    setEventCommunityIo(io);
    setCommunityIo(io);
    setClubIo(io);

    // 3. Initialize Monitors & Cleanups
    initCollegeChatCleanup();
    initMentorshipCleanup();
    initNightClubCleanup();
    initAlumniChatCleanup();
    initCommunityCleanup();
    initFyncMediaCleanup();
    initEventCleanup();
    startCleanupCron();

    // 4. Start Contest Monitor
    setInterval(() => {
      ContestManager.monitorContests(io);
    }, 60000);

    // 5. Start Listening
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Critical: Failed to start server:", err);
    process.exit(1);
  }
};

app.get('/', (req, res) => {
  res.send('Fync never gets down!🚀');
});

startServer();