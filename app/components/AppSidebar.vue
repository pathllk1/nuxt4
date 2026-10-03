<template>
  <aside
    class="fixed top-0 bottom-8 left-0 z-40 flex flex-col bg-gradient-to-b from-green-400 via-blue-500 to-purple-500 text-white shadow-2xl transition-all duration-300 select-none border-r border-white/20"
    :class="isSidebarCollapsed ? 'w-16' : 'w-64'"
    aria-label="Sidebar"
  >
    <!-- Top Brand / Role Bar (below top navbar) -->
    <div class="h-16 flex items-center px-3 border-b border-white/20 shrink-0">
      <div v-if="!isSidebarCollapsed" class="flex items-center justify-between w-full px-1">
        <div class="flex items-center gap-2 truncate">
          <span class="text-xl shrink-0">{{ roleIcon }}</span>
          <div class="truncate">
            <p class="text-xs font-black uppercase tracking-wider text-white truncate drop-shadow-sm">
              {{ roleTitle }}
            </p>
            <p class="text-[10px] text-white/80 truncate">
              {{ currentFirmAssignment?.linkedLedgerHead ? 'Field Scoped' : 'Enterprise ERP' }}
            </p>
          </div>
        </div>
      </div>
      <div v-else class="w-full flex justify-center text-xl" :title="roleTitle">
        <span>{{ roleIcon }}</span>
      </div>
    </div>

    <!-- Main Navigation Scroll Container (Zero Horizontal Scrollbar) -->
    <div
      class="flex flex-col space-y-4 py-3 overflow-y-auto overflow-x-hidden flex-1 min-h-0"
      :class="isSidebarCollapsed ? 'px-2 sidebar-collapsed-scroll' : 'px-3 sidebar-scroll'"
    >
      <template v-for="(group, gIdx) in navigationGroups" :key="group.title">
        <!-- Section Divider / Header -->
        <div v-if="!isSidebarCollapsed" class="px-2 pt-2">
          <p class="text-[10px] uppercase font-black tracking-widest text-white/80 drop-shadow-xs">
            {{ group.title }}
          </p>
        </div>
        <div v-else-if="gIdx > 0" class="w-8 mx-auto border-t border-white/20 my-1"></div>

        <!-- Group Items -->
        <div class="space-y-1">
          <template v-for="nav in group.items" :key="nav.label">
            <!-- Action Button (Global Tools Launcher) -->
            <div
              v-if="nav.action === 'openTools'"
              class="relative"
              @mouseenter="handleItemMouseEnter(nav, $event)"
              @mouseleave="handleItemMouseLeave"
            >
              <button
                @click="openGlobalTools"
                class="flex items-center text-white/90 hover:text-blue-100 hover:bg-white/15 transition duration-200 w-full rounded-xl cursor-pointer bg-transparent border-0 text-left"
                :class="isSidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'"
              >
                <div class="w-7 h-7 flex items-center justify-center text-lg shrink-0">
                  <span class="text-white font-bold">{{ nav.icon }}</span>
                </div>
                <span v-if="!isSidebarCollapsed" class="text-xs font-semibold truncate">
                  {{ nav.label }}
                </span>
              </button>
            </div>

            <!-- Single Route Link (No Children) -->
            <div
              v-else-if="!nav.children"
              class="relative"
              @mouseenter="handleItemMouseEnter(nav, $event)"
              @mouseleave="handleItemMouseLeave"
            >
              <NuxtLink
                :to="nav.to"
                :exact="nav.exact"
                :exact-active-class="'bg-white/25 text-white font-bold shadow-md shadow-black/10'"
                class="flex items-center text-white/90 hover:text-white hover:bg-white/15 transition duration-200 rounded-xl cursor-pointer no-underline"
                :class="isSidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'"
                @click="closeAllNestedMenus"
              >
                <!-- Icon -->
                <div class="w-7 h-7 flex items-center justify-center text-lg shrink-0">
                  <span class="text-white font-bold">{{ nav.icon }}</span>
                </div>

                <!-- Label & Optional Badge -->
                <div v-if="!isSidebarCollapsed" class="flex items-center justify-between flex-1 truncate">
                  <span class="text-xs font-semibold truncate">{{ nav.label }}</span>
                  <span
                    v-if="nav.badge"
                    class="ml-2 px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider"
                    :class="nav.badgeClass || 'bg-amber-400 text-slate-950'"
                  >
                    {{ nav.badge }}
                  </span>
                </div>
              </NuxtLink>
            </div>

            <!-- Nested Accordion Menu (Expanded) / Flyout Trigger (Collapsed) -->
            <div
              v-else
              class="relative"
              @mouseenter="handleItemMouseEnter(nav, $event)"
              @mouseleave="handleItemMouseLeave"
            >
              <div
                @click="toggleNestedMenu(nav.label)"
                class="flex items-center text-white/90 hover:text-white hover:bg-white/15 transition duration-200 rounded-xl cursor-pointer"
                :class="isSidebarCollapsed ? 'justify-center p-2.5' : 'px-3 py-2 gap-3'"
              >
                <div class="w-7 h-7 flex items-center justify-center text-lg shrink-0">
                  <span class="text-white font-bold">{{ nav.icon }}</span>
                </div>
                <div v-if="!isSidebarCollapsed" class="flex items-center justify-between flex-1 truncate">
                  <span class="text-xs font-semibold truncate">{{ nav.label }}</span>
                  <svg
                    class="h-3.5 w-3.5 transition-transform duration-200 text-white/70"
                    :class="{ 'rotate-180': openNestedMenus.includes(nav.label) }"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <!-- Nested Submenu in Expanded State -->
              <div
                v-if="!isSidebarCollapsed && openNestedMenus.includes(nav.label)"
                class="ml-5 pl-3 border-l-2 border-white/20 space-y-1 mt-1"
              >
                <NuxtLink
                  v-for="child in nav.children"
                  :key="child.label"
                  :to="child.to"
                  exact-active-class="bg-white/25 text-white font-bold"
                  class="flex items-center text-white/90 hover:text-white hover:bg-white/15 transition duration-200 px-2.5 py-1.5 rounded-lg no-underline text-xs"
                  @click="closeNestedMenu(nav.label)"
                >
                  <span class="mr-2 text-sm">{{ child.icon }}</span>
                  <span class="truncate font-medium">{{ child.label }}</span>
                </NuxtLink>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>

    <!-- Bottom Footer Dock (Collapse Toggle + User Status) -->
    <div class="h-10 border-t border-white/20 flex items-center justify-between px-2 shrink-0 bg-black/15">
      <div v-if="!isSidebarCollapsed" class="flex items-center gap-2 truncate text-xs text-white/90">
        <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
        <span class="truncate font-medium">{{ user?.name || 'Online' }}</span>
      </div>

      <!-- Collapse Toggle Button -->
      <button
        @click="toggleSidebar"
        class="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer flex items-center justify-center shrink-0 border border-white/20"
        :class="isSidebarCollapsed ? 'w-full py-1.5' : ''"
        :title="isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
      >
        <svg
          class="w-3.5 h-3.5 transition-transform duration-300"
          :class="{ 'rotate-180': isSidebarCollapsed }"
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
        <span v-if="!isSidebarCollapsed" class="ml-2 text-xs font-bold text-white">
          Collapse
        </span>
      </button>
    </div>

    <!-- Floating Outer Toggle Tab (Centered Vertically) -->
    <button
      @click="toggleSidebar"
      class="absolute top-1/2 -right-3 transform -translate-y-1/2 w-6 h-6 bg-white hover:scale-110 text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200 cursor-pointer z-50 transition"
      :title="isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
      aria-label="Toggle Sidebar"
    >
      <svg
        class="w-3.5 h-3.5 transition-transform duration-300"
        :class="{ 'rotate-180': !isSidebarCollapsed }"
        fill="none" viewBox="0 0 24 24" stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </aside>

  <!-- Teleported Floating Flyout & Tooltip for Collapsed Sidebar (Never Clipped) -->
  <Teleport to="body">
    <div
      v-if="isSidebarCollapsed && hoveredItem"
      class="fixed z-[9999] pointer-events-auto transition-opacity duration-150"
      :style="{ top: `${flyoutPosition.top}px`, left: `${flyoutPosition.left}px` }"
      @mouseenter="onFlyoutEnter"
      @mouseleave="onFlyoutLeave"
    >
      <!-- Case A: Nested Menu Flyout (e.g. Employee Wages with Wages Center & Master Roll) -->
      <div
        v-if="hoveredItem.children && hoveredItem.children.length > 0"
        class="bg-slate-900/95 text-white rounded-2xl shadow-2xl border border-white/20 p-2.5 min-w-[210px] backdrop-blur-md"
      >
        <div class="px-2.5 py-1.5 border-b border-white/10 flex items-center gap-2 mb-1.5">
          <span class="text-base">{{ hoveredItem.icon }}</span>
          <span class="text-xs font-black text-blue-300 uppercase tracking-wider">
            {{ hoveredItem.label }}
          </span>
        </div>
        <div class="space-y-1">
          <NuxtLink
            v-for="child in hoveredItem.children"
            :key="child.label"
            :to="child.to"
            exact-active-class="bg-blue-600 font-bold text-white shadow-md shadow-blue-600/30"
            class="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition no-underline"
            @click="closeFlyout"
          >
            <span class="text-base">{{ child.icon }}</span>
            <span>{{ child.label }}</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Case B: Standard Single Item Tooltip -->
      <div
        v-else
        class="bg-slate-900/95 text-white px-3.5 py-2 rounded-xl shadow-2xl border border-slate-700/80 text-xs font-bold whitespace-nowrap flex items-center gap-2 pointer-events-none backdrop-blur-md"
      >
        <span class="text-base">{{ hoveredItem.icon }}</span>
        <span>{{ hoveredItem.label }}</span>
        <span
          v-if="hoveredItem.badge"
          class="ml-1.5 px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider"
          :class="hoveredItem.badgeClass || 'bg-amber-400 text-slate-900'"
        >
          {{ hoveredItem.badge }}
        </span>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useAppLayout } from '~/composables/useAppLayout';
import { useGlobalTools } from '~/composables/useGlobalTools';

const { user, isAuthenticated, isSupervisor, isSubcontractor, isChecker, currentGrade, currentFirmAssignment } = useAuth();
const { isSidebarCollapsed, toggleSidebar } = useAppLayout();
const { openLauncher } = useGlobalTools();

interface NavItem {
  label: string;
  to?: string;
  icon: string;
  exact?: boolean;
  restricted?: boolean;
  checkerOnly?: boolean;
  badge?: string;
  badgeClass?: string;
  action?: string;
  children?: Array<{ label: string; to: string; icon: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const openNestedMenus = ref<string[]>([]);

// Flyout & Tooltip State (Teleported to Body to avoid container clipping)
const hoveredItem = ref<NavItem | null>(null);
const flyoutPosition = ref({ top: 0, left: 72 });
let leaveTimeout: any = null;

const handleItemMouseEnter = (nav: NavItem, event: MouseEvent) => {
  if (!isSidebarCollapsed.value) return;
  if (leaveTimeout) clearTimeout(leaveTimeout);

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  // Position outside the 64px collapsed sidebar with comfortable 8px gap
  flyoutPosition.value = {
    top: Math.max(12, Math.min(window.innerHeight - 180, rect.top)),
    left: rect.right + 8
  };
  hoveredItem.value = nav;
};

const handleItemMouseLeave = () => {
  if (leaveTimeout) clearTimeout(leaveTimeout);
  // Short 160ms grace period allowing user to transition into child links
  leaveTimeout = setTimeout(() => {
    hoveredItem.value = null;
  }, 160);
};

const onFlyoutEnter = () => {
  if (leaveTimeout) clearTimeout(leaveTimeout);
};

const onFlyoutLeave = () => {
  hoveredItem.value = null;
};

const closeFlyout = () => {
  hoveredItem.value = null;
};

// Dynamic Role Title and Icon
const roleTitle = computed(() => {
  if (isSubcontractor.value) return 'Subcontractor';
  if (isSupervisor.value) return 'Site Supervisor';
  if (user.value?.role === 'superadmin') return 'Super Admin';
  return `${currentGrade.value} Portal`;
});

const roleIcon = computed(() => {
  if (isSubcontractor.value) return '🏗️';
  if (isSupervisor.value) return '👷';
  if (user.value?.role === 'superadmin') return '👑';
  return '🏢';
});

// ── 1. Subcontractor Dynamic Navigation (Removed weather) ──
const subcontractorGroups: NavGroup[] = [
  {
    title: 'Site Wallet',
    items: [
      { label: 'My Site Wallet', to: '/subcontractor/wallet', icon: '💳', restricted: true, exact: true },
      { label: 'Log Site Slip', to: '/subcontractor/expense', icon: '📝', restricted: true },
      { label: 'My Expense Book', to: '/subcontractor/expenses', icon: '📋', restricted: true }
    ]
  }
];

// ── 2. Site Supervisor Dynamic Navigation (Removed weather) ──
const supervisorGroups: NavGroup[] = [
  {
    title: 'Imprest Wallet',
    items: [
      { label: 'Site Wallet', to: '/field/wallet', icon: '👛', restricted: true, exact: true },
      { label: 'Log Daily Expense', to: '/field/expense', icon: '📝', restricted: true },
      { label: 'Claims History', to: '/field/claims', icon: '📋', restricted: true }
    ]
  },
  {
    title: 'Site Tools',
    items: [
      { label: 'AI Site Assistant', to: '/ai-chat', icon: '✨', restricted: true }
    ]
  }
];

// ── 3. Enterprise Back-Office Dynamic Navigation (Removed weather, chat, settings) ──
const enterpriseGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: '👤', restricted: true },
      { label: 'Home', to: '/', icon: '🏠', exact: true, restricted: false }
    ]
  },
  {
    title: 'Works Contract & Site Ops',
    items: [
      {
        label: 'Subcontractors',
        to: '/accounting/subcontractor-monitoring',
        icon: '🏗️',
        restricted: true,
        checkerOnly: true,
        badge: 'TDS',
        badgeClass: 'bg-indigo-400 text-slate-950 font-bold'
      },
      {
        label: 'Imprest Approvals',
        to: '/accounting/imprest-approvals',
        icon: '⚖️',
        restricted: true,
        checkerOnly: true
      },
      {
        label: 'Labor System',
        to: '/labor',
        icon: '👷',
        restricted: true
      },
      {
        label: 'Employee Wages',
        icon: '💰',
        restricted: true,
        children: [
          { label: 'Wages Center', to: '/wages', icon: '💵' },
          { label: 'Master Roll', to: '/master-roll', icon: '📋' }
        ]
      }
    ]
  },
  {
    title: 'Finance & Accounts',
    items: [
      { label: 'Financial Ledger', to: '/accounting/ledger', icon: '💵', restricted: true },
      { label: 'Inventory Management', to: '/inventory', icon: '📦', restricted: true },
      { label: 'Documents & Vault', to: '/documents', icon: '📄', restricted: true }
    ]
  },
  {
    title: 'Tools & Utilities',
    items: [
      { label: 'AI Assistant', to: '/ai-chat', icon: '✨', restricted: true },
      { label: 'Global Tools', action: 'openTools', icon: '🛠️', restricted: false }
    ]
  }
];

// Dynamically compute active navigation groups based on user grade & auth
const navigationGroups = computed(() => {
  const isAuth = isAuthenticated.value;

  if (isAuth && isSubcontractor.value) {
    return subcontractorGroups;
  }
  if (isAuth && isSupervisor.value) {
    return supervisorGroups;
  }

  // Filter enterprise items by permission
  return enterpriseGroups.map(group => ({
    title: group.title,
    items: group.items.filter(item => {
      if (item.restricted && !isAuth) return false;
      if (item.checkerOnly && !isChecker.value) return false;
      return true;
    })
  })).filter(group => group.items.length > 0);
});

const openGlobalTools = () => {
  openLauncher();
};

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

<style scoped>
/* Sleek custom scrollbar for expanded state */
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}
.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
  height: 0px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.4);
}

/* Zero scrollbars in collapsed state to prevent any Windows scrollbar clipping */
.sidebar-collapsed-scroll {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidebar-collapsed-scroll::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
</style>
