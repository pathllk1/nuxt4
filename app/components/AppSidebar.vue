<template>
  <aside
    class="fixed top-0 bottom-0 left-0 z-40 bg-gradient-to-b from-green-400 via-blue-500 to-purple-500 shadow-lg transition-all duration-300"
    :class="isSidebarCollapsed ? 'w-16' : 'w-60'"
    aria-label="Sidebar"
  >
    <!-- Sidebar Content: Padding top adjusts links below the top navbar -->
    <div class="pt-16 flex flex-col items-center md:items-start space-y-4 px-3 overflow-y-auto max-h-[calc(100vh-60px)]">
      <template v-for="nav in visibleNavLinks" :key="nav.label">
        <!-- Links without children -->
        <NuxtLink
          v-if="!nav.children"
          :to="nav.to"
          :exact-active-class="'bg-white/20 font-bold'"
          class="flex items-center text-white hover:text-blue-200 transition duration-300 group w-full px-2 py-2 rounded-lg cursor-pointer no-underline"
          :title="isSidebarCollapsed ? nav.label : ''"
          @click="closeAllNestedMenus"
        >
          <!-- Icon Slot -->
          <div class="w-8 h-8 flex items-center justify-center text-xl shrink-0">
            <span class="text-white text-lg font-bold">{{ nav.icon }}</span>
          </div>
          <!-- Label -->
          <span v-if="!isSidebarCollapsed" class="ml-3 text-sm font-medium hover:underline truncate">
            {{ nav.label }}
          </span>
        </NuxtLink>

        <!-- Links with children (nested navigation) -->
        <div v-else class="w-full">
          <div
            @click="toggleNestedMenu(nav.label)"
            class="flex items-center text-white hover:text-blue-200 transition duration-300 group w-full px-2 py-2 rounded-lg cursor-pointer"
            :title="isSidebarCollapsed ? nav.label : ''"
          >
            <div class="w-8 h-8 flex items-center justify-center text-xl shrink-0">
              <span class="text-white text-lg font-bold">{{ nav.icon }}</span>
            </div>
            <span v-if="!isSidebarCollapsed" class="ml-3 text-sm font-medium hover:underline flex-grow truncate">
              {{ nav.label }}
            </span>
            <svg
              v-if="!isSidebarCollapsed"
              class="h-4 w-4 transition-transform duration-200"
              :class="{ 'rotate-180': openNestedMenus.includes(nav.label) }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <!-- Nested Submenu -->
          <div
            v-if="openNestedMenus.includes(nav.label)"
            :class="[
              isSidebarCollapsed ? 'ml-1' : 'ml-6',
              'space-y-1 mt-1',
              !isSidebarCollapsed && 'border-l-2 border-white/20 pl-2'
            ]"
          >
            <NuxtLink
              v-for="child in nav.children"
              :key="child.label"
              :to="child.to"
              exact-active-class="bg-white/20 font-bold"
              class="flex items-center text-white/80 hover:text-blue-200 transition duration-300 group px-2 py-1.5 rounded no-underline"
              :title="isSidebarCollapsed ? child.label : ''"
              @click="closeNestedMenu(nav.label)"
            >
              <div class="w-6 h-6 flex items-center justify-center text-xs shrink-0">
                <span>{{ child.icon }}</span>
              </div>
              <span v-if="!isSidebarCollapsed" class="text-sm font-medium hover:underline ml-2 truncate">
                {{ child.label }}
              </span>
            </NuxtLink>
          </div>
        </div>
      </template>
    </div>

    <!-- Collapse/Expand Button -->
    <div
      @click="toggleSidebar"
      class="absolute top-1/2 right-[-16px] transform -translate-y-1/2 bg-white p-1 rounded-full cursor-pointer shadow-lg transition-transform duration-300 text-gray-700 hover:scale-110 border border-gray-200 z-50"
      :class="{ 'rotate-180': !isSidebarCollapsed }"
    >
      <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '../composables/useAuth';
import { useAppLayout } from '../composables/useAppLayout';

const { isAuthenticated } = useAuth();
const { isSidebarCollapsed, toggleSidebar } = useAppLayout();

const openNestedMenus = ref<string[]>([]);

const navLinks = [
  { label: 'Home', to: '/', icon: '🏠', exact: true, restricted: false },
  { label: 'About', to: '/about', icon: 'ℹ️', restricted: false },
  { label: 'Dashboard', to: '/dashboard', icon: '👤', restricted: true },
  { label: 'Docs', to: '/documents', icon: '📄', restricted: true },
  {
    label: 'Financial Management',
    icon: '💵',
    restricted: true,
    children: [
      { label: 'Cash & Ledger', to: '/accounting/ledger', icon: '📊' }
    ]
  },
  {
    label: 'Employee Wages',
    icon: '💰',
    restricted: true,
    children: [
      { label: 'Wages Center', to: '/wages', icon: '💵' },
      { label: 'Master Roll', to: '/master-roll', icon: '👥' }
    ]
  },
  {
    label: 'Inventory',
    icon: '📦',
    restricted: true,
    children: [
      { label: 'Stock & Items', to: '/inventory', icon: '🏢' }
    ]
  },
  { label: 'Labor System', to: '/labor', icon: '👷', restricted: true },
  { label: 'Weather', to: '/weather', icon: '☀️', restricted: false },
  { label: 'AI Assistant', to: '/ai-chat', icon: '✨', restricted: true }
];

const visibleNavLinks = computed(() => {
  const isAuth = isAuthenticated.value;
  return navLinks.filter(nav => !nav.restricted || isAuth);
});

const toggleNestedMenu = (label: string) => {
  if (openNestedMenus.value.includes(label)) {
    openNestedMenus.value = openNestedMenus.value.filter(m => m !== label);
  } else {
    openNestedMenus.value.push(label);
  }
};

const closeNestedMenu = (label: string) => {
  openNestedMenus.value = openNestedMenus.value.filter(m => m !== label);
};

const closeAllNestedMenus = () => {
  openNestedMenus.value = [];
};
</script>
