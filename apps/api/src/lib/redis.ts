import { Redis } from "ioredis";

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env["REDIS_URL"];
  if (!url) return null;
  redis = new Redis(url, { maxRetriesPerRequest: 3, lazyConnect: true });
  redis.connect().catch(() => {});
  return redis;
}
