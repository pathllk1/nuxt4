// components/SidebarComponent.js
// 100% Faithful Replica of Nuxt 4 app/components/AppSidebar.vue
(function (global) {
  'use strict';

  const SidebarComponent = {
    props: {
      currentTab: { type: String, default: 'sales_workspace' },
      isCollapsed: { type: Boolean, default: true },
      firm: { type: Object, default: () => ({}) }
    },
    emits: ['change-tab', 'toggle-collapse'],
    data() {
      return {
        navItems: [
          { id: 'dashboard', label: 'Inventory Dashboard', icon: '📊', tab: 'dashboard' },
          { id: 'accounting_dashboard', label: 'Ledger & Financials', icon: '📈', tab: 'accounting_dashboard' },
          { id: 'stocks', label: 'Stock & Items', icon: '📦', tab: 'stocks' },
          { id: 'sales_workspace', label: 'Sales Invoice', icon: '✈️', tab: 'sales_workspace' },
          { id: 'purchase_workspace', label: 'Purchase Bills', icon: '📍', tab: 'purchase_workspace' },
          { id: 'bills', label: 'Invoices & Notes', icon: '💵', tab: 'bills' },
          { id: 'banking', label: 'Banking Hub', icon: '🏦', tab: 'banking' },
          { id: 'accounting', label: 'Daybook & Statements', icon: '📖', tab: 'statements' },
          { id: 'ledger', label: 'Stock Movement', icon: '📋', tab: 'ledger' },
          { id: 'parties', label: 'Parties Directory', icon: '🏷️', tab: 'parties' },
          { id: 'firm_settings', label: 'Firm Settings', icon: '🏢', tab: 'firm_settings' },
          { id: 'sql', label: 'SQL Terminal', icon: '✨', tab: 'sql' }
        ]
      };
    },
    methods: {
      toggle() {
        this.$emit('toggle-collapse');
      }
    },
    template: `
      <aside
        class="fixed top-12 bottom-7 left-0 z-30 flex flex-col bg-gradient-to-b from-green-400 via-blue-500 to-purple-500 text-white shadow-2xl transition-all duration-300 select-none border-r border-white/20"
        style="z-index: 30;"
        :class="isCollapsed ? 'w-16' : 'w-64'"
        aria-label="Sidebar"
      >
        <!-- Top Brand / Firm Info Bar (Docked cleanly below top navbar) -->
        <div class="h-12 flex items-center px-3 border-b border-white/20 shrink-0">
          <div v-if="!isCollapsed" class="flex items-center justify-between w-full px-1">
            <div class="flex items-center gap-2 truncate">
              <span class="text-lg shrink-0">🏢</span>
              <div class="truncate">
                <p class="text-xs font-black uppercase tracking-wider text-white truncate drop-shadow-sm">{{ firm.name || firm.legal_name || 'Offline ERP' }}</p>
                <p class="text-[10px] text-white/80 truncate">{{ firm.city || firm.state || 'Local Workstation' }}</p>
              </div>
            </div>
          </div>
          <div v-else class="w-full flex justify-center text-lg" :title="firm.name || 'Offline ERP'">
            <span>🏢</span>
          </div>
        </div>

        <!-- Vertical Navigation Icon Rail (Nuxt 4 AppSidebar.vue lines 28-97) -->
        <div class="flex flex-col space-y-1.5 py-3 overflow-y-auto overflow-x-hidden flex-1 min-h-0 px-2">
          <button
            v-for="item in navItems"
            :key="item.id"
            type="button"
            @click="$emit('change-tab', item.tab)"
            :class="currentTab === item.tab ? 'bg-white/25 text-white font-bold shadow-md shadow-black/10' : 'text-white/90 hover:text-white hover:bg-white/15'"
            class="flex items-center rounded-xl transition duration-200 cursor-pointer p-2 border-0 text-left w-full gap-3"
            :title="item.label"
          >
            <div class="w-7 h-7 flex items-center justify-center text-lg shrink-0">
              <span class="text-white font-bold">{{ item.icon }}</span>
            </div>
            <span v-if="!isCollapsed" class="text-xs font-semibold truncate">
              {{ item.label }}
            </span>
          </button>
        </div>

        <!-- Bottom Footer Dock (Collapse Toggle) (Nuxt 4 AppSidebar.vue lines 150-174) -->
        <div class="h-10 border-t border-white/20 flex items-center justify-between px-2 shrink-0 bg-black/15">
          <button
            type="button"
            @click="toggle"
            class="p-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition cursor-pointer flex items-center justify-center shrink-0 border border-white/20 w-full py-1.5"
            :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
          >
            <svg
              class="w-3.5 h-3.5 transition-transform duration-300"
              :class="{ 'rotate-180': isCollapsed }"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <span v-if="!isCollapsed" class="ml-2 text-xs font-bold text-white">
              Collapse
            </span>
          </button>
        </div>

        <!-- Floating Outer Toggle Tab (Centered Vertically) (Nuxt 4 AppSidebar.vue lines 177-184) -->
        <button
          type="button"
          @click="toggle"
          class="absolute top-1/2 -right-3 transform -translate-y-1/2 w-6 h-6 bg-white hover:scale-110 text-gray-700 rounded-full flex items-center justify-center shadow-lg border border-gray-200 cursor-pointer z-30 transition"
          style="z-index: 30;"
          :title="isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        >
          <svg
            class="w-3.5 h-3.5 transition-transform duration-300"
            :class="{ 'rotate-180': !isCollapsed }"
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    `
  };

  global.SidebarComponent = SidebarComponent;
})(window);
