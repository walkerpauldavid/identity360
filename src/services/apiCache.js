/**
 * API Cache Service — IndexedDB-based caching for Omada API calls
 *
 * Uses Dexie.js to provide a transparent caching layer with:
 * - 5-minute TTL for all cached responses
 * - Per-user cache isolation (impersonation user in cache key)
 * - Namespace-based invalidation after mutations
 * - Graceful degradation if IndexedDB is unavailable
 *
 * Debug: window.__omadaApiCache.help() in browser console
 */

import Dexie from 'dexie';

// ============================================================================
// DATABASE SETUP
// ============================================================================

const db = new Dexie('OmadaApiCache');

db.version(1).stores({
  // key: primary key (compound cache key string)
  // namespace: indexed for targeted invalidation (e.g., 'identity', 'assignment')
  // timestamp: indexed for bulk TTL cleanup
  apiResponses: 'key, namespace, timestamp'
});

// ============================================================================
// CONFIGURATION
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Read debug logging preference from localStorage */
const getDebugLoggingSetting = () => {
  try {
    const stored = localStorage.getItem('app_user_preferences');
    if (stored) {
      const prefs = JSON.parse(stored);
      return prefs.debugEnableApiCacheLogging ?? false;
    }
  } catch (e) { /* ignore */ }
  return false;
};

let DEBUG_CACHE_LOGGING = getDebugLoggingSetting();

// ============================================================================
// CORE CACHE FUNCTIONS
// ============================================================================

/**
 * Higher-order function that wraps an async API function with IndexedDB caching.
 *
 * @param {string} namespace - Cache namespace for invalidation grouping (e.g., 'identity')
 * @param {string} fnName - Function name for cache key and logging
 * @param {Function} fn - The original async API function
 * @param {Function} cacheKeyFn - Extracts cache-key-relevant args from the function's arguments.
 *   Must NOT include bearerToken. Returns a JSON-serializable value.
 * @returns {Function} A wrapped async function with the same signature
 */
export function withApiCache(namespace, fnName, fn, cacheKeyFn) {
  return async function (...args) {
    // 1. Build the cache key
    let cacheKey;
    try {
      const keyData = cacheKeyFn(...args);
      cacheKey = `${namespace}.${fnName}|${JSON.stringify(keyData)}`;
    } catch (e) {
      // If key generation fails, skip caching entirely
      return fn(...args);
    }

    // 2. Look up in IndexedDB
    try {
      const cached = await db.apiResponses.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        if (DEBUG_CACHE_LOGGING) {
          console.log(
            `%c[API CACHE HIT] ${namespace}.${fnName}`,
            'background: #ff9800; color: white; padding: 2px 6px; border-radius: 3px;',
            `(age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`
          );
        }
        return cached.data;
      }
    } catch (e) {
      // IndexedDB error — fall through to real API call
      if (DEBUG_CACHE_LOGGING) {
        console.warn('[ApiCache] Read error, falling through to API:', e.message);
      }
    }

    // 3. Cache MISS — call the real function
    const result = await fn(...args);

    // 4. Store successful results
    if (result && result.status === 'success') {
      try {
        await db.apiResponses.put({
          key: cacheKey,
          namespace,
          timestamp: Date.now(),
          data: result
        });
        if (DEBUG_CACHE_LOGGING) {
          console.log(
            `%c[API CACHE STORE] ${namespace}.${fnName}`,
            'background: #4caf50; color: white; padding: 2px 6px; border-radius: 3px;'
          );
        }
      } catch (e) {
        // Non-fatal — result is still returned
        if (DEBUG_CACHE_LOGGING) {
          console.warn('[ApiCache] Write error (non-fatal):', e.message);
        }
      }
    }

    return result;
  };
}

/**
 * Wraps a mutation function to invalidate related caches on success.
 *
 * @param {Function} fn - The mutation function (NOT cached)
 * @param {string[]} namespacesToInvalidate - Namespaces to clear on success
 * @returns {Function} Wrapped function
 */
export function withCacheInvalidation(fn, namespacesToInvalidate) {
  return async function (...args) {
    const result = await fn(...args);

    if (result && result.status === 'success') {
      await invalidateCache(...namespacesToInvalidate);
    }

    return result;
  };
}

// ============================================================================
// INVALIDATION & CLEANUP
// ============================================================================

/**
 * Invalidate all cached entries for the given namespace(s).
 * @param {...string} namespaces - One or more namespace strings
 */
export async function invalidateCache(...namespaces) {
  for (const ns of namespaces) {
    try {
      const count = await db.apiResponses.where('namespace').equals(ns).delete();
      if (DEBUG_CACHE_LOGGING) {
        console.log(
          `%c[API CACHE INVALIDATE] ${ns} (${count} entries cleared)`,
          'background: #f44336; color: white; padding: 2px 6px; border-radius: 3px;'
        );
      }
    } catch (e) {
      console.warn(`[ApiCache] Failed to invalidate namespace ${ns}:`, e.message);
    }
  }
}

/**
 * Clear the entire cache (all namespaces).
 * @returns {Promise<number>} Number of entries cleared
 */
export async function clearAllCache() {
  try {
    const count = await db.apiResponses.count();
    await db.apiResponses.clear();
    console.log(`[ApiCache] Cleared entire cache (${count} entries)`);
    return count;
  } catch (e) {
    console.warn('[ApiCache] Failed to clear cache:', e.message);
    return 0;
  }
}

/**
 * Remove all entries older than the TTL.
 * @returns {Promise<number>} Number of entries purged
 */
export async function purgeExpiredEntries() {
  const cutoff = Date.now() - CACHE_TTL_MS;
  try {
    const count = await db.apiResponses.where('timestamp').below(cutoff).delete();
    if (DEBUG_CACHE_LOGGING) {
      console.log(`[ApiCache] Purged ${count} expired entries`);
    }
    return count;
  } catch (e) {
    console.warn('[ApiCache] Failed to purge expired entries:', e.message);
    return 0;
  }
}

// Periodic cleanup — purge expired entries every 10 minutes
setInterval(() => {
  purgeExpiredEntries().catch(() => {});
}, 10 * 60 * 1000);

// ============================================================================
// DEBUG HELPERS — window.__omadaApiCache
// ============================================================================

if (typeof window !== 'undefined') {
  window.__omadaApiCache = {
    /** Clear all cached entries */
    clear: clearAllCache,

    /** Clear cache for specific namespace(s) */
    invalidate: invalidateCache,

    /** Remove expired entries */
    purge: purgeExpiredEntries,

    /** Get cache statistics */
    stats: async () => {
      try {
        const allEntries = await db.apiResponses.toArray();
        const total = allEntries.length;
        const byNamespace = {};
        let fresh = 0;
        let expired = 0;

        allEntries.forEach(entry => {
          const ns = entry.namespace;
          if (!byNamespace[ns]) byNamespace[ns] = { total: 0, fresh: 0, expired: 0 };
          byNamespace[ns].total++;
          if ((Date.now() - entry.timestamp) < CACHE_TTL_MS) {
            byNamespace[ns].fresh++;
            fresh++;
          } else {
            byNamespace[ns].expired++;
            expired++;
          }
        });

        const stats = { total, fresh, expired, ttlMinutes: CACHE_TTL_MS / 60000, byNamespace };
        console.table(byNamespace);
        return stats;
      } catch (e) {
        console.warn('[ApiCache] Failed to get stats:', e.message);
        return { total: 0, fresh: 0, expired: 0, error: e.message };
      }
    },

    /** List all cache keys with age */
    keys: async () => {
      try {
        const entries = await db.apiResponses.toArray();
        return entries.map(e => ({
          key: e.key,
          namespace: e.namespace,
          age: `${Math.round((Date.now() - e.timestamp) / 1000)}s`,
          fresh: (Date.now() - e.timestamp) < CACHE_TTL_MS
        }));
      } catch (e) {
        console.warn('[ApiCache] Failed to list keys:', e.message);
        return [];
      }
    },

    /** Direct Dexie DB access (advanced) */
    db,

    /** Toggle debug logging on/off */
    setLogging: (enabled) => {
      DEBUG_CACHE_LOGGING = !!enabled;
      console.log(`[ApiCache] Debug logging ${DEBUG_CACHE_LOGGING ? 'ENABLED' : 'DISABLED'}`);
    },

    /** Print usage help */
    help: () => {
      console.log(`
=== Omada API Cache Debug ===

window.__omadaApiCache.clear()                - Clear ALL cached data
window.__omadaApiCache.invalidate('identity') - Clear one namespace
window.__omadaApiCache.purge()                - Remove expired entries
window.__omadaApiCache.stats()                - Cache statistics
window.__omadaApiCache.keys()                 - List all cache keys
window.__omadaApiCache.setLogging(true)       - Enable/disable console logging
window.__omadaApiCache.db                     - Direct Dexie DB access

Namespaces: identity, accessRequest, approval, assignment, assignmentPolicy, odata
TTL: ${CACHE_TTL_MS / 60000} minutes
      `);
    }
  };
}
