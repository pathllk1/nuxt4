<script setup lang="ts">
import { onMounted } from 'vue';
import { isGlobalLoading } from './utils/api';
import GlobalToolsHost from './components/tools/GlobalToolsHost.vue';
import GlobalGuidelineDrawer from './components/guidelines/GlobalGuidelineDrawer.vue';

const colorMode = useColorMode();
colorMode.preference = 'light';

useHead({
  titleTemplate: (title) => (title ? `${title} - BusinessPro Suite` : 'BusinessPro Suite - Enterprise Management Portal')
});

onMounted(() => {
  if (import.meta.client) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }
});
</script>

<template>
  <UApp>
    <!-- Global Loading Top Progress Bar -->
    <div
      v-if="isGlobalLoading"
      class="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-teal-400 via-indigo-500 to-teal-400 z-[9999] overflow-hidden"
    >
      <div class="h-full bg-white/40 animate-progress w-full"></div>
    </div>

    <!-- Global Loading Floating Glassmorphic Spinner -->
    <ClientOnly>
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0 translate-y-4 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-4 scale-95"
      >
        <div
          v-if="isGlobalLoading"
          class="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 bg-slate-900/90 text-white backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl shadow-slate-950/40"
        >
          <div class="relative w-5 h-5 flex items-center justify-center">
            <svg class="animate-spin h-5 w-5 text-teal-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span class="text-xs font-black tracking-wider uppercase text-teal-200">Syncing...</span>
        </div>
      </Transition>

      <GlobalToolsHost />
      <GlobalGuidelineDrawer />
    </ClientOnly>

    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<style>
@keyframes progress-loading {
  0% {
    transform: scaleX(0);
    transform-origin: left;
  }
  50% {
    transform: scaleX(0.6);
    transform-origin: left;
  }
  100% {
    transform: scaleX(1);
    transform-origin: right;
  }
}
.animate-progress {
  animation: progress-loading 1.5s infinite ease-in-out;
}
</style>
