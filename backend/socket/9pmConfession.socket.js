import cron from "node-cron";
import redisClient from "../utils/redis.js";
import NineAMConfession from "../models/newFeatures/9pmConfession.model.js";
import User from "../models/user.model.js";

export const lotterySocketController = (io) => {
    const lotteryIo = io.of('/lottery');

    // --- ⏰ SCHEDULER ---

    // 1. 9:55 PM: Open Lobby
    cron.schedule('55 21 * * *', async () => {
        console.log("🎟️ LOTTERY LOBBY OPEN");
        await redisClient.set("lottery:status", "OPEN");
        // Clear old queues to be safe
        const keys = await redisClient.keys("lottery:queue:*");
        if (keys.length > 0) await redisClient.del(keys);
        
        lotteryIo.emit('status_change', { status: 'LOBBY', message: 'Lobby Open! Matching in 5 mins.' });
    });

    // 2. 10:00 PM: START MATCHING
    cron.schedule('00 22 * * *', async () => {
        console.log("🎰 MATCHING STARTED");
        await redisClient.set("lottery:status", "LIVE");
        lotteryIo.emit('status_change', { status: 'MATCHING', message: 'Pairing students...' });
        
        // Trigger the Matching Engine
        await processLotteryQueues(lotteryIo);
    });

    // 3. 10:06 PM: CLOSE (Cleanup)
    cron.schedule('06 22 * * *', async () => {
        console.log("🛑 LOTTERY CLOSED");
        await redisClient.set("lottery:status", "CLOSED");
        lotteryIo.emit('status_change', { status: 'CLOSED', message: 'See you tomorrow!' });
    });


    // --- 🔌 SOCKET EVENT HANDLERS ---

    lotteryIo.on("connection", (socket) => {
        // console.log(`Lottery Socket: ${socket.id}`);

        // A. JOIN LOBBY
        socket.on("join_lobby", async ({ userId }) => {
            const status = await redisClient.get("lottery:status");
            
            if (status === "CLOSED" || !status) {
                socket.emit("error", "Lottery is closed. Come back at 9:55 PM.");
                return;
            }

            // 1. Check Daily Limit
            const playedToday = await redisClient.get(`lottery:played:${userId}`);
            if (playedToday) {
                socket.emit("error", "You already played today! Come back tomorrow.");
                return;
            }

            // 2. Get User Details (Include Gender for Matching)
            const user = await User.findById(userId).select("college username gender");
            if (!user || !user.college) {
                socket.emit("error", "Update your college profile to join.");
                return;
            }

            // 3. Add to Redis Queue (Store Gender in Payload)
            // Storing gender here avoids 1000s of DB calls at 10:00 PM
            const userData = JSON.stringify({ 
                userId, 
                socketId: socket.id, 
                gender: user.gender // 'Male' or 'Female'
            });
            
            await redisClient.rPush(`lottery:queue:${user.college}`, userData);
            
            socket.join(`lobby:${user.college}`);
            socket.emit("joined_success", { message: "You are in the pool. Don't leave!" });
        });

        // B. HANDLE MESSAGES
        socket.on("send_message", ({ roomId, text, senderId }) => {
            socket.to(roomId).emit("receive_message", {
                text,
                senderId,
                timestamp: new Date()
            });
        });

        // C. REVEAL VOTE
        socket.on("vote_reveal", async ({ roomId, userId, vote }) => {
            if (!vote) {
                lotteryIo.to(roomId).emit("game_over", { result: "FAILED", message: "Partner disconnected or declined." });
                await NineAMConfession.findByIdAndUpdate(roomId, { status: 'FAILED' });
                return;
            }

            const voteKey = `lottery:votes:${roomId}`;
            await redisClient.sAdd(voteKey, userId);
            const voteCount = await redisClient.sCard(voteKey);

            if (voteCount === 2) {
                const session = await NineAMConfession.findById(roomId);
                const users = await User.find({ _id: { $in: session.participants } })
                    .select("name username avatar college bio");

                lotteryIo.to(roomId).emit("reveal_success", { 
                    profiles: users,
                    message: "It's a Match! Identities revealed. ❤️" 
                });

                session.status = 'REVEALED';
                session.revealVotes = session.participants;
                await session.save();
                
                await redisClient.del(voteKey);
            } else {
                socket.to(roomId).emit("partner_voted");
            }
        });

        // D. DISCONNECT
        socket.on("disconnect", async () => {
            // Optional: Remove from queue logic (complex for Redis lists, usually skipped for MVP)
        });
    });
};

// --- ⚙️ GENDER-BALANCED MATCHING ENGINE ---
const processLotteryQueues = async (lotteryIo) => {
    // 1. Get all college queues
    const keys = await redisClient.keys("lottery:queue:*");

    for (const queueKey of keys) {
        // 2. Pull ALL users from this college's queue
        const rawUsers = await redisClient.lRange(queueKey, 0, -1);
        let allUsers = rawUsers.map(u => JSON.parse(u));

        // 3. Separate by Gender
        let males = allUsers.filter(u => u.gender === 'Male');
        let females = allUsers.filter(u => u.gender === 'Female');
        let others = allUsers.filter(u => u.gender !== 'Male' && u.gender !== 'Female'); // Fallback

        // 4. Shuffle arrays to ensure randomness
        const shuffle = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        };
        shuffle(males);
        shuffle(females);
        shuffle(others);

        let matches = [];

        // 5. PRIORITY MATCHING: Male <-> Female
        // Pair up while both lists have people
        while (males.length > 0 && females.length > 0) {
            const m = males.pop();
            const f = females.pop();
            matches.push([m, f]);
        }

        // 6. FALLBACK MATCHING: Randomly pair the remainders
        // (Combine leftovers so nobody is left alone just because of gender imbalance)
        let leftovers = [...males, ...females, ...others];
        shuffle(leftovers);

        while (leftovers.length >= 2) {
            const u1 = leftovers.pop();
            const u2 = leftovers.pop();
            matches.push([u1, u2]);
        }

        // 7. EXECUTE MATCHES
        for (const pair of matches) {
            const [u1, u2] = pair;

            // Verify sockets are still connected
            const s1 = lotteryIo.sockets.get(u1.socketId);
            const s2 = lotteryIo.sockets.get(u2.socketId);

            if (!s1 || !s2) {
                // If one dropped, push the survivor back to 'leftovers' for a retry?
                // For MVP simplicity, we just skip this pair or inform the survivor.
                if (s1) s1.emit("match_failed", "Partner disconnected at the last second. Try again tomorrow.");
                if (s2) s2.emit("match_failed", "Partner disconnected at the last second. Try again tomorrow.");
                continue;
            }

            // Create DB Session
            try {
                const session = await NineAMConfession.create({
                    participants: [u1.userId, u2.userId],
                    college: queueKey.split(":")[2],
                    status: 'ACTIVE'
                });
                const roomId = session._id.toString();

                // Join Rooms
                s1.join(roomId);
                s2.join(roomId);

                // Mark as Played
                const expiry = 18 * 60 * 60; 
                await redisClient.set(`lottery:played:${u1.userId}`, "true", { EX: expiry });
                await redisClient.set(`lottery:played:${u2.userId}`, "true", { EX: expiry });

                // Notify
                lotteryIo.to(roomId).emit("match_found", {
                    roomId,
                    expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
                });

                // Start Timer
                setTimeout(() => {
                    lotteryIo.to(roomId).emit("time_up", { message: "Time's up! Reveal Identity?" });
                }, 300000); 

            } catch (err) {
                console.error("Session creation error:", err);
            }
        }

        // 8. Handle the single Odd One Out
        if (leftovers.length === 1) {
            const survivor = leftovers[0];
            const sSock = lotteryIo.sockets.get(survivor.socketId);
            if (sSock) sSock.emit("match_failed", "Odd numbers today! No match found. You get a free pass for tomorrow.");
        }

        // Clear Queue
        await redisClient.del(queueKey);
    }
};