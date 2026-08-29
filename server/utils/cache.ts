/**
 * Cache Invalidation and Management Utilities for Nuxt 4 / Nitro
 * Works with Nitro's storage mount points ('cache')
 */

/**
 * Invalidate a Nitro cached route or key safely
 * @param key The cache key to remove (e.g. 'nitro:handlers:_:api:firms.json' or prefix)
 */
export async function invalidateCacheKey(key: string): Promise<boolean> {
  try {
    // Access Nitro storage instance for 'cache'
    const storage = useStorage('cache');
    if (await storage.hasItem(key)) {
      await storage.removeItem(key);
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate key "${key}":`, error);
    return false;
  }
}

/**
 * Invalidate all cached keys matching a specific prefix pattern
 * @param prefix Cache prefix (e.g. 'nitro:handlers:_:api:firms')
 */
export async function invalidateCachePrefix(prefix: string): Promise<number> {
  try {
    const storage = useStorage('cache');
    const keys = await storage.getKeys(prefix);
    let removedCount = 0;
    for (const key of keys) {
      await storage.removeItem(key);
      removedCount++;
    }
    return removedCount;
  } catch (error) {
    console.warn(`[Cache] Failed to invalidate prefix "${prefix}":`, error);
    return 0;
  }
}
