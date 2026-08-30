<template>
  <div 
    class="min-h-screen flex flex-col font-sans antialiased text-gray-900 relative"
    :class="{ 'bg-slate-50': !isAuthPage }"
  >
    <!-- Top Navigation Header Component -->
    <ClientOnly>
      <AppHeader v-if="!isAuthPage" />
    </ClientOnly>

    <!-- Layout Container: Sidebar + Main Content -->
    <div class="flex flex-1 relative w-full">
      <!-- Left Collapsible Sidebar Component -->
      <ClientOnly>
        <AppSidebar v-if="!isAuthPage" class="hidden md:block" />
      </ClientOnly>

      <!-- Main Content Area -->
      <main 
        class="relative flex-1 transition-all duration-300 overflow-x-hidden"
        :class="[
          !isAuthPage ? 'pt-12' : '',
          !isAuthPage && !isChatPage ? 'pb-8 min-h-[calc(100vh-80px)]' : '',
          isChatPage ? 'max-h-screen max-h-[100dvh] overflow-hidden' : '',
          !isAuthPage && isSidebarCollapsed ? 'md:ml-16' : (!isAuthPage ? 'md:ml-60' : '')
        ]"
      >
        <slot />
      </main>
    </div>

    <!-- Bottom Fixed Footer Component -->
    <ClientOnly>
      <footer v-if="!isAuthPage" class="block h-0 relative z-50">
        <AppFooter />
      </footer>
    </ClientOnly>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAppLayout } from '../composables/useAppLayout';

const route = useRoute();
const { isSidebarCollapsed } = useAppLayout();

// Check if current route is an Auth page (Login / Signup)
const isAuthPage = computed(() => {
  return ['/login', '/signup'].includes(route.path);
});

// Check if current route is the Chat page (needs full-height layout without bottom padding)
const isChatPage = computed(() => {
  return route.path.startsWith('/chat');
});
</script>

<style scoped>
/* Scoped layout transitions */
</style>
