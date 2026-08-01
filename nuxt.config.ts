// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: true,
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui'],
  css: ['~/assets/css/main.css'],
  future: {
    compatibilityVersion: 4
  },
  colorMode: {
    preference: 'light',
    fallback: 'light'
  },
  icon: {
    serverBundle: {
      collections: ['heroicons', 'lucide']
    }
  }
})