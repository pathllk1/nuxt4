import redisCache from './modules/redis-cache';

export default defineNuxtConfig({
  ssr: true,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      titleTemplate: '%s | BusinessPro Suite',
      title: 'BusinessPro Suite - Enterprise Management Portal',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Enterprise Management Portal for Wages, Inventory, Accounting, and Business Operations.' }
      ]
    }
  },
  modules: [
    '@nuxt/ui',
    redisCache
  ],
  css: ['~/assets/css/main.css'],
  future: {
    compatibilityVersion: 4
  },
  experimental: {
    appManifest: false
  },
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
  icon: {
    serverBundle: 'local',
    clientBundle: {
      scan: true
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },
  runtimeConfig: {
    public: {
      upstashRedisRestUrl: process.env.NUXT_PUBLIC_UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL || '',
      upstashRedisRestReadToken: process.env.NUXT_PUBLIC_UPSTASH_REDIS_REST_READ_TOKEN || '',
      firebase: {
        apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCKMWfNfD4fuCknFhceuhcYA3fJGgw5suU',
        authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'work-vs-payment.firebaseapp.com',
        projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || 'work-vs-payment',
        storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'work-vs-payment.firebasestorage.app',
        messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '432257160846',
        appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '1:432257160846:web:afa71b4fe4b38381909bdf',
        measurementId: process.env.NUXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-J77N3W1H4C'
      }
    }
  },

  nitro: {
    externals: {
      inline: [],
      external: ['pdfmake', 'couchbase']
    }
  },

  routeRules: {
    '/api/**': {
      headers: {
        'X-Content-Type-Options': 'nosniff'
      }
    }
  }
})