import { defineNuxtModule } from '@nuxt/kit';

/**
 * Nuxt 4 Redis & Nitro Caching Module
 * Encapsulates Upstash Redis storage mounting and safe routeRules caching
 */
export default defineNuxtModule({
  meta: {
    name: 'redis-cache',
    configKey: 'redisCache'
  },
  setup(_options, nuxt) {
    const isUpstashConfigured = Boolean(
      process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    );

    const cacheStorageConfig = isUpstashConfigured
      ? {
          driver: 'upstash',
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
          base: 'nitro:cache:'
        }
      : {
          driver: 'memory'
        };

    // 1. Mount Nitro Cache Storage (Production & Development)
    nuxt.options.nitro = nuxt.options.nitro || {};
    nuxt.options.nitro.storage = nuxt.options.nitro.storage || {};
    nuxt.options.nitro.storage.cache = cacheStorageConfig;

    nuxt.options.nitro.devStorage = nuxt.options.nitro.devStorage || {};
    nuxt.options.nitro.devStorage.cache = cacheStorageConfig;

    // 2. Register Safe Cached Route Rules
    nuxt.options.routeRules = nuxt.options.routeRules || {};
    
    // Iconify Icon bundle caching (static SVGs, 24 hour TTL)
    nuxt.options.routeRules['/api/_nuxt_icon/**'] = {
      cache: {
        maxAge: 60 * 60 * 24,
        swr: true
      }
    };

    // Public firms list for dropdowns (5 min TTL with SWR)
    nuxt.options.routeRules['/api/firms'] = {
      cache: {
        maxAge: 60 * 5,
        swr: true
      }
    };

    // Static public informational pages (12-24 hr TTL with SWR)
    nuxt.options.routeRules['/about'] = {
      cache: {
        maxAge: 60 * 60 * 12,
        swr: true
      }
    };
    nuxt.options.routeRules['/contact'] = {
      cache: {
        maxAge: 60 * 60 * 12,
        swr: true
      }
    };
    nuxt.options.routeRules['/privacy'] = {
      cache: {
        maxAge: 60 * 60 * 24,
        swr: true
      }
    };
    nuxt.options.routeRules['/terms'] = {
      cache: {
        maxAge: 60 * 60 * 24,
        swr: true
      }
    };
  }
});
