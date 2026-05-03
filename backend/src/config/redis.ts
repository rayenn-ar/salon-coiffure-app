import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://:salon_redis_secret@localhost:6379';

const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy(times) {
    if (times > 3) return null; // Stop retrying after 3 attempts
    return Math.min(times * 500, 2000);
  },
  lazyConnect: true,
  enableOfflineQueue: false,
});

let _redisErrorLogged = false;
redis.on('error', () => {
  if (!_redisErrorLogged) {
    _redisErrorLogged = true;
    console.warn('⚠️  Redis unavailable — sessions will use JWT-only mode (safe for dev)');
  }
});

redis.on('connect', () => {
  _redisErrorLogged = false;
  console.log('✅ Redis connected');
});

// Graceful connect — non-blocking (app works without Redis in dev)
redis.connect().catch(() => {
  // Suppressed — already logged via 'error' event
});

export default redis;

// Helper: safe get/set with fallback when Redis is down
export async function redisGet(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  try {
    if (ttlSeconds) {
      await redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await redis.set(key, value);
    }
  } catch {
    // Silent fail — Redis unavailable
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch {
    // Silent fail
  }
}

/** Returns true only when the Redis connection is established and ready */
export function isRedisAvailable(): boolean {
  return redis.status === 'ready';
}
