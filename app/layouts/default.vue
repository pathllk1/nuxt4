<template>
  <div 
    class="min-h-screen flex flex-col font-sans antialiased text-gray-900 relative"
    :class="{ 'bg-slate-50': !isAuthPage }"
  >
    <!-- Top Navigation Header Component -->
    <ClientOnly>
      <AppHeader v-if="!isAuthPage && !isSubcontractorPage" />
    </ClientOnly>

    <!-- Layout Container: Sidebar + Main Content -->
    <div class="flex flex-1 relative w-full">
      <!-- Left Collapsible Sidebar Component -->
      <ClientOnly>
        <AppSidebar v-if="!isAuthPage && !isSubcontractorPage" class="hidden md:block" />
      </ClientOnly>

      <!-- Main Content Area -->
      <main 
        class="relative flex-1 transition-all duration-300 overflow-x-hidden min-h-[calc(100vh-80px)]"
        :class="[
          (!isAuthPage && !isSubcontractorPage) ? 'pt-12 pb-8' : '', 
          (!isAuthPage && !isSubcontractorPage) && isSidebarCollapsed ? 'md:ml-16' : ((!isAuthPage && !isSubcontractorPage) ? 'md:ml-60' : '')
        ]"
      >
        <slot />
      </main>
    </div>

    <!-- Bottom Fixed Footer Component -->
    <ClientOnly>
      <footer v-if="!isAuthPage && !isSubcontractorPage" class="block h-0 relative z-50">
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

// Check if current route is a Subcontractor Portal page
const isSubcontractorPage = computed(() => {
  return route.path.startsWith('/subcontractor');
});
</script>

<style scoped>
/* Scoped layout transitions */
</style>
