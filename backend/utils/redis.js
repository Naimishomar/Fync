import { createClient } from 'redis';
const redisURL = process.env.REDIS_URL || 'redis://localhost:6379';

const client = createClient({
    url: redisURL,
    socket: {
        tls: redisURL.startsWith('rediss://'),
        rejectUnauthorized: false 
    }
});

client.on('connect', () => console.log('Redis Client Connected ✅'));
client.on('error', (err) => console.log('Redis Client Error ❌', err));

const connectRedis = async () => {
    if (!client.isOpen) {
        await client.connect();
    }
};

connectRedis();

export default client;