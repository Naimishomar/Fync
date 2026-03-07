import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cookieParser from 'cookie-parser';
import connectDB from './db/db.js';
import authRoute from './routes/auth.route.js';
import postRoute from './routes/post.route.js';
import chatRoute from './routes/chat.route.js';
import cafeRoute from './routes/cafe.route.js';
import paymentRoute from './routes/payment.route.js';
import collaborationRoute from './routes/collaboration.route.js';
import shortRoute from './routes/short.route.js';
import fundingRoute from './routes/funding.route.js';
import quizRoute from './routes/quiz.route.js';
import interviewRoute from './routes/interview.route.js';
import confessionRoute from './routes/confession.route.js';
import notificationRoute from './routes/notification.route.js';
import codingRoute from './routes/coding.route.js';
import OLXRoute from './routes/olx.route.js';
import LostAndFoundRoute from './routes/lostAndFound.route.js';
import noticeRoute from './routes/notice.route.js';
import mapRoute from './routes/map.route.js';
import paidGigsRoute from './routes/paidGigs.route.js';
import AiIntelligenceRoute from './routes/aiItelligence.route.js';
import splitRoute from './routes/split.route.js';
import crushRoute from './routes/crush.routes.js';
import subscriptionRoute from './routes/subscription.route.js';
import collegeChatRoute from './routes/collegeChat.route.js';
import { setCollegeChatIo } from './controllers/collegeChat.controller.js';
import { initCollegeChatCleanup } from './utils/collegeChatCleanup.js';

import { rateLimit } from 'express-rate-limit';
import { logout } from './controllers/auth.controller.js';

import { socketController } from './controllers/socket.controller.js';
import { lotterySocketController } from './socket/9pmConfession.socket.js';
import { setupVideoSocket } from './socket/videoLobby.js'
import { setupMusicSocket } from './socket/musicSocket.js';

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again later",
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

const io = new Server(server, {
  cors: { origin: "*", credentials: true }
});

app.use(limiter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/receipts", express.static("receipts"));

app.use((req, res, next) => {
  console.log("REQ:", req.method, req.url);
  next();
});

app.use('/user', authRoute);
app.use('/post', postRoute);
app.use('/cafe', cafeRoute);
app.use('/collaboration', collaborationRoute);
app.use('/chat', chatRoute);
app.use('/payment', paymentRoute);
app.use('/shorts', shortRoute);
app.use('/funding', fundingRoute);
app.use('/quiz', quizRoute);
app.use('/interview', interviewRoute);
app.use('/confession', confessionRoute);
app.use('/notifications', notificationRoute);
app.use('/leaderboard', codingRoute);
app.use('/olx', OLXRoute);
app.use('/lostAndFound', LostAndFoundRoute);
app.use('/notice', noticeRoute);
app.use('/map', mapRoute);
app.use('/gigs', paidGigsRoute);
app.use('/api', AiIntelligenceRoute);
app.use('/split', splitRoute);
app.use('/crush', crushRoute);
app.use('/subscription', subscriptionRoute);
app.use('/college-chat', collegeChatRoute);



socketController(io);
lotterySocketController(io);
setupVideoSocket(io);
setupMusicSocket(io);
setCollegeChatIo(io);
initCollegeChatCleanup();

app.get('/', (req, res) => {
  res.send('Fync never gets down!🚀');
});

const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}🚀`);
    });
  } catch (err) {
    console.error("Critical: Failed to start server:", err);
    process.exit(1);
  }
};

startServer();