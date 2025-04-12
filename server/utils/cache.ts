import NodeCache from 'node-cache';

// Configure the cache with standard TTL of 5 minutes and checkperiod of 120 seconds
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes in seconds
  checkperiod: 120, // 2 minutes in seconds
  useClones: false // Don't clone objects to improve performance
});

// Define specific TTLs for different types of data
const TTL = {
  SHORT: 60, // 1 minute in seconds
  MEDIUM: 300, // 5 minutes in seconds
  LONG: 1800, // 30 minutes in seconds
  VERY_LONG: 86400 // 24 hours in seconds
};

/**
 * Function to get cached data or fetch and cache new data
 * @param key Cache key
 * @param fetchFn Function to fetch data if cache miss
 * @param ttl TTL in seconds
 */
export async function getOrFetchData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = TTL.MEDIUM
): Promise<T> {
  // Check if data exists in cache
  const cachedData = cache.get<T>(key);
  if (cachedData !== undefined) {
    return cachedData;
  }

  // Fetch fresh data
  const freshData = await fetchFn();
  
  // Store in cache
  cache.set(key, freshData, ttl);
  
  return freshData;
}

/**
 * Manually set data in the cache
 * @param key Cache key
 * @param data Data to cache
 * @param ttl TTL in seconds
 */
export function setCache<T>(key: string, data: T, ttl: number = TTL.MEDIUM): void {
  cache.set(key, data, ttl);
}

/**
 * Remove a specific key from cache
 * @param key Cache key
 */
export function invalidateCache(key: string): void {
  cache.del(key);
}

/**
 * Remove multiple keys matching a pattern
 * @param pattern Pattern to match (e.g., 'events*')
 */
export function invalidateCachePattern(pattern: string): void {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => {
    // Simple pattern matching with wildcard support
    const regex = new RegExp(`^${pattern.replace('*', '.*')}$`);
    return regex.test(key);
  });
  
  cache.del(matchingKeys);
}

/**
 * Flush the entire cache
 */
export function flushCache(): void {
  cache.flushAll();
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    keys: cache.keys().length,
    hits: cache.getStats().hits,
    misses: cache.getStats().misses,
    ksize: cache.getStats().ksize,
    vsize: cache.getStats().vsize
  };
}

export { TTL };