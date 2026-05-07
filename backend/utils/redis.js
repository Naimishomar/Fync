import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        console.error('❌ Redis: Max reconnection attempts reached. Continuing without cache.');
        return false;
      }
      const delay = Math.min(retries * 500, 5000);
      console.log(`Retrying Redis connection (${retries}/5) in ${delay}ms...`);
      return delay;
    }
  },
});

client.on('connect', () => {
  console.log('Redis Client Connected ✅');
});

client.on('error', (err) => {
  console.error('Redis Client Error ❌', err);
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error("Initial Redis Connection Failed:", err);
  }
})();

export default client;