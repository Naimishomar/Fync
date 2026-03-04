import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    tls: true,
    reconnectStrategy: (retries) => {
      const delay = Math.min(retries * 100, 3000);
      console.log(`Retrying Redis connection in ${delay}ms...`);
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