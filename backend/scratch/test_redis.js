import { createClient } from 'redis';

const testConnection = async () => {
  const url = "rediss://:gQAAAAAAAAA3GAAIgcDE3NWVhNzk3ODZiMmM0MWFmYWIwY2IxMmQxODNlN2FmYQ@ultimate-feline-110022.upstash.io:6379";
  const client = createClient({
    url,
    socket: { tls: true }
  });

  client.on('error', (err) => console.log('Redis Client Error', err));

  try {
    await client.connect();
    console.log("Connected successfully!");
    await client.quit();
  } catch (err) {
    console.error("Failed to connect:", err);
  }
};

testConnection();
