import { createClient } from 'redis';

const client = createClient({
  url: process.env.REDIS_URL,
  socket: {
    // Derive TLS from the URL scheme instead of forcing it on: a hardcoded
    // `tls: true` cannot talk to a plain redis:// instance (local, or Redis on
    // the same EC2 box), and the handshake fails with an opaque socket error.
    tls: (process.env.REDIS_URL || '').startsWith('rediss://'),
    keepAlive: 30000,
    // Give up on the *initial* connect, but keep retrying forever afterwards.
    // Bailing out permanently after 5 attempts meant one Redis blip left the
    // process running with rate limiting, caching and presence dead until a
    // manual restart.
    reconnectStrategy: (retries) => Math.min(1000 + retries * 500, 10000),
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