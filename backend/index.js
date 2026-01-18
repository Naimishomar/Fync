import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
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
import { rateLimit } from 'express-rate-limit';
import { logout } from './controllers/auth.controller.js';

import { socketController } from './controllers/socket.controller.js';
import { lotterySocketController } from './socket/9pmConfession.socket.js';
import { setupSocket } from './socket/videoLobby.js' 

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100,
  statusCode: 429,
  message: "Too many requests from this IP, please try again after an hour",
  handler: logout,
});

dotenv.config({quiet: true});
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

const io = new Server(server, {
    cors: { origin: ["http://localhost:5173"], credentials: true }
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

socketController(io);
lotterySocketController(io);
setupSocket(io);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}🚀`);
  connectDB();
});