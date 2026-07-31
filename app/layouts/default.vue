<template>
  <div 
    class="min-h-screen flex flex-col font-sans antialiased text-gray-900 relative"
    :class="{ 'bg-slate-50': !hasCustomBackground }"
  >
    
    <!-- Top Navigation Header Component -->
    <AppHeader />

    <!-- Layout Container: Sidebar + Main Content -->
    <div class="flex flex-1 relative w-full">
      
      <!-- Left Collapsible Sidebar Component -->
      <AppSidebar class="hidden md:block" />

      <!-- Main Content Area -->
      <main 
        class="relative flex-1 transition-all duration-300 pt-16 pb-16 overflow-x-hidden"
        :class="isSidebarCollapsed ? 'md:ml-16' : 'md:ml-60'"
      >
        <slot />
      </main>
    </div>

    <!-- Bottom Fixed Footer Component (Zero height host container flow) -->
    <footer class="block h-0 relative z-50">
      <AppFooter />
    </footer>

  </div>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from '../composables/useAuth';
import { useAppLayout } from '../composables/useAppLayout';

const route = useRoute();
const { initAuth } = useAuth();
const { isSidebarCollapsed } = useAppLayout();

// Check if the current route should have layout background removed (Home, Login, Signup)
const hasCustomBackground = computed(() => {
  return ['/', '/login', '/signup'].includes(route.path);
});

onMounted(() => {
  initAuth();
});
</script>

<style scoped>
/* Scoped layout transitions */
</style>
