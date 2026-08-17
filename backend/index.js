import 'dotenv/config.js';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 50;
import cors from 'cors';
import morgan from 'morgan';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import redisClient from './utils/redis.js';
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
import webrtcRoute from './routes/webrtc.route.js';
import gameRoute from './routes/game.route.js';
import ContestManager from './services/contestManager.js';

import { setCollegeChatIo } from './controllers/collegeChat.controller.js';
import { setAlumniChatIo } from './controllers/alumniChat.controller.js';
import { setMentorshipIo } from './controllers/mentorshipChat.controller.js';
import { setEventCommunityIo } from './controllers/events/eventActivity.controller.js';
import { setCommunityIo } from './controllers/community/community.controller.js';
import { setClubIo } from './controllers/club/message.controller.js';
import { setChatIo } from './controllers/chat.controller.js';
import { setChessIo } from './controllers/chess.socket.js';
import { initCollegeChatCleanup } from './utils/collegeChatCleanup.js';
import { initMentorshipCleanup } from './utils/mentorshipCleanup.js';
import { initNightClubCleanup } from './utils/nightClubCleanup.js';
import { initAlumniChatCleanup } from './utils/alumniChatCleanup.js';
import { initEventCleanup } from './utils/eventCleanup.js';
import { initCommunityCleanup } from './utils/communityCleanup.js';
import { initFyncMediaCleanup } from './utils/fyncMediaCleanup.js';
import { initChatMediaCleanup } from './utils/chatMediaCleanup.js';
import startCleanupCron from './services/cleanup.service.js';

import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import { socketController } from './controllers/socket.controller.js';
import codingBattleSockets from './controllers/coding/battle.socket.js';
import compression from 'compression';
import helmet from 'helmet';
import { monitoringMiddleware } from './middlewares/monitoring.middleware.js';
import { generalLimiter } from './middlewares/rateLimit.middleware.js';
import { mongoSanitize } from './middlewares/mongoSanitize.js';
import { validateConfig } from './utils/validateConfig.js';

// CORS: allow configurable origins for production. Wildcard cannot be combined
// with credentials, so we only enable credentials for explicit origins.
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : '*';

const app = express();
// Behind ALB/nginx every request otherwise reports the proxy's IP, so the
// per-IP rate limiter would throttle the entire user base as one client.
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));
app.use(generalLimiter);


const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

const io = new Server(server, {
  cors: {
    origin: corsOrigins === '*' ? '*' : corsOrigins,
    methods: ["GET", "POST"],
    credentials: corsOrigins !== '*',
    allowedHeaders: ["my-custom-header"],
  },
  // websocket-only: PM2 cluster mode has no sticky sessions, and HTTP long-polling
  // handshakes would land on a different worker than the one holding the session
  // ("Session ID unknown"). The Redis adapter fixes broadcasts, not sticky routing.
  transports: ['websocket'],
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 45000,
  maxHttpBufferSize: 1e6,
});

// Authenticate the socket handshake. Without this any client could emit
// `register` with someone else's id and join their private `user:<id>` room.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = String(id);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

const pubClient = redisClient.duplicate();
const subClient = redisClient.duplicate();

pubClient.on('error', (err) => console.error("Redis PubClient Error ❌", err));
subClient.on('error', (err) => console.error("Redis SubClient Error ❌", err));

// Read by /health. In cluster mode a missing adapter means a broadcast from one
// worker never reaches sockets held by another — chat and notifications reach
// roughly half the users, with no error anywhere. Reporting it keeps the deploy
// health check from calling that a success.
let adapterReady = false;

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  adapterReady = true;
  console.log("✅ Socket.IO Redis Adapter Connected");
}).catch(err => {
  console.error("❌ Redis Adapter Connection Error:", err);
});

io.engine.on("connection_error", (err) => {
  console.log("❌ Engine Connection Error:", err.req ? err.req.url : "No Req", err.code, err.message, err.context);
});

app.use(helmet({
  crossOriginResourcePolicy: false, 
}));
app.use(compression());

app.use(cors({
  origin: corsOrigins === '*' ? '*' : corsOrigins,
  credentials: corsOrigins !== '*',
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());

app.set("io", io);

app.use(monitoringMiddleware);

app.use(cookieParser());
// Removed: this served ./receipts as a public directory, so anyone could
// enumerate <host>/receipts/<order_id>.pdf and read another user's name, email,
// amount and UPI id. Receipts are no longer written to disk at all — they were
// also lost on every deploy and duplicated per cluster worker.

app.use('/user', authRoute);
app.use('/post', postRoute);
app.use('/opportunity', opportunityRoute);
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
app.use('/games', gameRoute);
app.use('/webrtc', webrtcRoute);

const startServer = async (retries = 5) => {
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
    setChatIo(io);
    setChessIo(io);
    codingBattleSockets(io);

    // 3. Initialize Monitors & Cleanups — only on one worker. In PM2 cluster mode
    // every worker would otherwise run the same crons, multiplying deletes,
    // notifications and contest transitions by the number of CPU cores.
    const isCronWorker = !process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0';
    if (isCronWorker) {
      initCollegeChatCleanup();
      initMentorshipCleanup();
      initNightClubCleanup();
      initAlumniChatCleanup();
      initCommunityCleanup();
      initFyncMediaCleanup();
      initChatMediaCleanup();
      initEventCleanup();
      startCleanupCron();

      // 4. Start Contest Monitor
      setInterval(() => {
        ContestManager.monitorContests(io).catch((err) =>
          console.error('Contest monitor error:', err)
        );
      }, 60000).unref();
    }

    // 5. Start Listening
    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      // Tell PM2 (wait_ready) this worker is accepting traffic, so a reload only
      // kills the old worker once the new one can actually serve.
      if (process.send) process.send('ready');
    });

  } catch (err) {
    console.error(`❌ Critical: Failed to start server (${retries} retries left):`, err.message);
    if (retries > 0) {
      console.log("Retrying in 5 seconds...");
      setTimeout(() => startServer(retries - 1), 5000);
    } else {
      console.error("❌ Max retries reached. Exiting...");
      process.exit(1);
    }
  }
};

app.get('/', (req, res) => {
  res.send('Fync never gets down!🚀');
});

// PM2 Health Check — also the deploy gate, so it must fail when Redis is
// missing rather than reporting UP on a half-working cluster.
app.get('/health', (req, res) => {
  if (!adapterReady) {
    return res.status(503).json({ status: 'DEGRADED', reason: 'socket.io redis adapter not connected', timestamp: new Date() });
  }
  res.status(200).json({ status: 'UP', timestamp: new Date() });
});

// Deep Linking Verification Routes
app.get('/.well-known/assetlinks.json', (req, res) => {
  res.json([
    {
      "relation": ["delegate_permission/common.handle_all_urls"],
      "target": {
        "namespace": "android_app",
        "package_name": "com.naimishomar.fync",
        "sha256_cert_fingerprints": [
          "YOUR_APP_SHA256_FINGERPRINT" // Replace with your actual SHA256 fingerprint
        ]
      }
    }
  ]);
});

app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.json({
    "applinks": {
      "apps": [],
      "details": [
        {
          "appID": "YOUR_APPLE_TEAM_ID.com.naimishomar.fync", // Replace YOUR_APPLE_TEAM_ID
          "paths": ["*"]
        }
      ]
    }
  });
});

// Sharing Redirect Routes (Handles cases where app is not installed)
const SHARING_PATHS = ['/view', '/movie', '/community', '/club', '/product', '/fync-media'];
SHARING_PATHS.forEach(path => {
  app.get(path, (req, res) => {
    // Redirect to Play Store or a landing page
    res.redirect('https://play.google.com/store/apps/details?id=com.fync.app');
  });
});

// 404 — must sit after every route, before the error handler.
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Translates the errors Mongoose throws into the status codes they actually
// mean. Bad input was surfacing as 500 with the raw driver message attached —
// wrong for the client and an information leak.
const classify = (err) => {
  if (err.name === 'ValidationError') {
    return { status: 400, message: Object.values(err.errors || {}).map((e) => e.message).join('; ') || 'Invalid input' };
  }
  if (err.name === 'CastError') {
    return { status: 400, message: `Invalid value for ${err.path}` };
  }
  if (err.code === 11000) {
    return { status: 409, message: `${Object.keys(err.keyValue || {}).join(', ') || 'Value'} already exists` };
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return { status: 401, message: 'Invalid or expired token' };
  }
  if (err.type === 'entity.too.large') {
    return { status: 413, message: 'Payload too large' };
  }
  return null;
};

// Global Error Handler
app.use((err, req, res, next) => {
  const mapped = classify(err);
  if (mapped) {
    if (res.headersSent) return next(err);
    return res.status(mapped.status).json({ success: false, message: mapped.message });
  }
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("🔥 GLOBAL ERROR:", err);
  if (res.headersSent) return next(err);
  res.status(status).json({
    success: false,
    // Never surface raw 5xx messages: they leak driver errors, paths and queries.
    message: status >= 500 ? "Internal server error" : (err.message || "Request failed"),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// 🛡️ Process Safety Guards
process.on('uncaughtException', (err) => {
  console.error('☣️ UNCAUGHT EXCEPTION:', err);
  // Graceful exit to let PM2 restart the process
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚫 UNHANDLED REJECTION:', reason);
});

// Drain in-flight work before exiting, otherwise a deploy drops every open
// request and websocket instead of letting them finish.
let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`🔴 ${signal} received. Draining...`);

  // Hard deadline: never let a stuck socket block the deploy forever.
  const forceExit = setTimeout(() => {
    console.error('⏱️ Drain timed out. Forcing exit.');
    process.exit(1);
  }, 15000);
  forceExit.unref();

  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close(false);
    if (redisClient.isOpen) await redisClient.quit();
    console.log('✅ Shutdown complete.');
    process.exit(0);
  } catch (err) {
    console.error('Shutdown error:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Validate before anything starts. A bad environment is not a transient
// failure, so this runs outside startServer's retry loop.
try {
  validateConfig();
} catch (err) {
  console.error(`❌ ${err.message}`);
  process.exit(1);
}

startServer();