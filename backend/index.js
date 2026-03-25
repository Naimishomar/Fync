import dotenv from 'dotenv';
dotenv.config({ silent: true });
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
import collaborationRoute from './routes/collaboration.route.js';
import shortRoute from './routes/short.route.js';
import fundingRoute from './routes/funding.route.js';
import quizRoute from './routes/quiz.route.js';
import interviewRoute from './routes/interview.route.js';
import notificationRoute from './routes/notification.route.js';
import codingRoute from './routes/coding.route.js';
import OLXRoute from './routes/olx.route.js';
import LostAndFoundRoute from './routes/lostAndFound.route.js';
import noticeRoute from './routes/notice.route.js';
import paidGigsRoute from './routes/paidGigs.route.js';
import AiIntelligenceRoute from './routes/aiItelligence.route.js';
import splitRoute from './routes/split.route.js';
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

import { setCollegeChatIo } from './controllers/collegeChat.controller.js';
import { setAlumniChatIo } from './controllers/alumniChat.controller.js';
import { setMentorshipIo } from './controllers/mentorshipChat.controller.js';
import { setEventCommunityIo } from './controllers/events/eventActivity.controller.js';
import { setCommunityIo } from './controllers/community/community.controller.js';
import { initCollegeChatCleanup } from './utils/collegeChatCleanup.js';
import { initMentorshipCleanup } from './utils/mentorshipCleanup.js';
import { initNightClubCleanup } from './utils/nightClubCleanup.js';
import { initAlumniChatCleanup } from './utils/alumniChatCleanup.js';
import { initEventCleanup } from './utils/eventCleanup.js';
import { initCommunityCleanup } from './utils/communityCleanup.js';
import { initFyncMediaCleanup } from './utils/fyncMediaCleanup.js';

import { rateLimit } from 'express-rate-limit';

import { socketController } from './controllers/socket.controller.js';
import compression from 'compression';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later",
});

const app = express();
app.use(limiter);

app.use((req, res, next) => {
  console.log(`📡 [${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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

app.use((req, res, next) => {
  console.log(`🔍 [${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

app.use(cookieParser());
// app.use(mongoSanitize());
app.use("/receipts", express.static("receipts"));

app.use('/user', authRoute);
app.use('/post', postRoute);
app.use('/collaboration', collaborationRoute);
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
app.use('/olx', OLXRoute);
app.use('/lostAndFound', LostAndFoundRoute);
app.use('/notice', noticeRoute);
app.use('/gigs', paidGigsRoute);
app.use('/api', AiIntelligenceRoute);
app.use('/split', splitRoute);
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
app.use('/api/fync-media', fyncMediaRoute);


socketController(io);
setCollegeChatIo(io);
setAlumniChatIo(io);
setMentorshipIo(io);
setEventCommunityIo(io);
setCommunityIo(io);
initCollegeChatCleanup();
initMentorshipCleanup();
initNightClubCleanup();
initAlumniChatCleanup();
initCommunityCleanup();
initFyncMediaCleanup();

app.get('/', (req, res) => {
  res.send('Fync never gets down!🚀');
});

const startServer = async () => {
  try {
    await connectDB();
    initEventCleanup();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}🚀`);
    });
  } catch (err) {
    console.error("Critical: Failed to start server:", err);
    process.exit(1);
  }
};

startServer();