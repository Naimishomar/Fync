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
import { socketController } from './controllers/socket.controller.js';

dotenv.config();
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 8000;

const io = new Server(server, {
    cors: { origin: ["http://localhost:5173"], credentials: true }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/receipts", express.static("receipts"));

app.use('/user', authRoute);
app.use('/post', postRoute);
app.use('/cafe', cafeRoute);
app.use('/collaboration', collaborationRoute);
app.use('/chat', chatRoute);
app.use('/payment', paymentRoute);
socketController(io);

app.get('/', (req, res) => {
  res.send('Hello World!');
});

server.listen(PORT, () => {
  console.log('Server is running on port 3000🚀');
  connectDB();
});