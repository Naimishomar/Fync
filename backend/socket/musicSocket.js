import client from '../utils/redis.js';

export const setupMusicSocket = (io) => {
  const pubClient = client.duplicate();
  const subClient = client.duplicate();

  pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err));
  subClient.on('error', (err) => console.error('Redis Sub Client Error:', err));

  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    console.log("Redis Pub/Sub Ready for Group Jam 🚀");
    subClient.pSubscribe('room:*', (message, channel) => {
      const roomId = channel.split(':')[1];
      io.to(roomId).emit('track-update', JSON.parse(message));
    });
  });

  io.on('connection', (socket) => { 
    console.log(`User connected to Group Jam system: ${socket.id}`);

    socket.on('invite-squad', (data) => {
        console.log("🔥 INVITE RECEIVED ON SERVER:", data.host.username);
        socket.broadcast.emit('incoming-jam', data); 
    });

    socket.on('join-room', async ({ roomId, user }) => {
    if (!roomId || !user) {
        console.error("❌ Join-room failed: roomId or user is undefined");
        return;
    }
    try {
        socket.join(roomId);
        const participantKey = `participants:${roomId}`;
        const userString = JSON.stringify(user);
        if (userString) {
        await client.sAdd(participantKey, userString);
        }
        const members = await client.sMembers(participantKey);
        io.to(roomId).emit('room-users', members.map(m => JSON.parse(m)));
        const currentState = await client.get(`state:${roomId}`);
        if (currentState) {
        socket.emit('track-update', JSON.parse(currentState));
        }
        console.log(`👤 ${user.username || 'Unknown'} joined ${roomId}`);
    } catch (err) {
        console.error("Redis Join Error:", err);
    }
    });

    socket.on('sync-music', async (data) => {
    if (!data?.roomId || !data?.station) {
        console.error("❌ Sync-music failed: data is missing roomId or station");
        return;
    }
    try {
        const payload = JSON.stringify({ ...data, serverTime: Date.now() });
        await client.set(`state:${data.roomId}`, payload, { EX: 3600 });
        await pubClient.publish(`room:${data.roomId}`, payload);
    } catch (err) {
        console.error("Redis Sync Error:", err);
    }
    });

    const handleLeave = async (socket, roomId, user) => {
        if (!roomId || !user) return;
        const participantKey = `participants:${roomId}`;
        await client.sRem(participantKey, JSON.stringify(user));
        const members = await client.sMembers(participantKey);
        io.to(roomId).emit('room-users', members.map(m => JSON.parse(m)));
        socket.leave(roomId);
        console.log(`${user.username} left room ${roomId}`);
    };

    socket.on('leave-room', async ({ roomId, user }) => {
        await handleLeave(socket, roomId, user);
    });

    socket.on('disconnect', async () => {
        console.log('User Disconnected 💨');
    });
  });
};