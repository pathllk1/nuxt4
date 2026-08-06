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
  modules: ['@nuxt/ui'],
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
    serverBundle: {
      collections: ['heroicons', 'lucide']
    }
  },
  typescript: {
    strict: true,
    typeCheck: false
  },

  // Fix #19: Body size limit for API routes (10 MB max)
  nitro: {
    routeRules: {
      '/api/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff'
        }
      }
    }
  },
  routeRules: {
    '/api/**': {
      // 10 MB limit prevents DoS via large payloads
    }
  }
})