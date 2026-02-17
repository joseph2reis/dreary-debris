// Utility to clear Redis cache keys used by the project
// Usage: REDIS_URL="redis://:pass@host:6379/0" node scripts/clear-redis-cache.js
const url = process.env.REDIS_URL;
if (!url) {
  console.error('REDIS_URL not set. Set REDIS_URL and retry.');
  process.exit(1);
}

async function run() {
  try {
    const Redis = require('ioredis');
    const client = new Redis(url);

    console.log('Connected to Redis, scanning keys...');

    // delete specific keys
    const keysToDelete = ['posts'];
    for (const k of keysToDelete) {
      const exists = await client.exists(k);
      if (exists) {
        await client.del(k);
        console.log(`Deleted key: ${k}`);
      } else {
        console.log(`Key not found: ${k}`);
      }
    }

    // delete post:* keys (use scan to avoid blocking)
    let cursor = '0';
    do {
      const reply = await client.scan(cursor, 'MATCH', 'post:*', 'COUNT', 100);
      cursor = reply[0];
      const keys = reply[1];
      if (keys.length) {
        await client.del(...keys);
        console.log(`Deleted ${keys.length} keys matching post:*`);
      }
    } while (cursor !== '0');

    console.log('Done.');
    client.disconnect();
  } catch (err) {
    console.error('Error clearing Redis cache:', err);
    process.exit(1);
  }
}

run();
