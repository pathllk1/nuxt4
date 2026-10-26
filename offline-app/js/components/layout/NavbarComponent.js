// components/NavbarComponent.js
// 100% Dynamic Offline ERP Header (Zero Fake / Dummy / Static Data)
(function (global) {
  'use strict';

  const NavbarComponent = {
    props: {
      currentTab: { type: String, default: 'dashboard' },
      firm: { type: Object, default: () => ({}) },
      activeLocation: { type: Object, default: null },
      engineType: { type: String, default: '' }
    },
    emits: ['change-tab', 'open-export', 'open-voucher'],
    template: `
      <header class="w-full fixed top-0 inset-x-0 bg-gradient-to-r from-teal-500 via-indigo-600 to-teal-500 shadow-md py-2 px-3 sm:px-6 z-40 text-white h-12 flex items-center select-none" style="z-index: 40;">
        <nav class="w-full flex justify-between items-center">
          <!-- Brand / Firm Name (100% Dynamic from active firm settings) -->
          <div class="font-bold text-base sm:text-lg text-white drop-shadow flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition shrink-0" @click="$emit('change-tab', 'dashboard')" title="Go to Dashboard">
            <div class="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0 border border-white/20 shadow-xs">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div class="flex flex-col">
              <span class="text-white hover:text-teal-100 transition font-extrabold tracking-tight text-xs sm:text-sm leading-tight truncate max-w-[150px] sm:max-w-[280px]">
                {{ firm.name || firm.legal_name || 'Offline ERP' }}
              </span>
              <span v-if="firm.gstin" class="text-[9px] sm:text-[10px] text-teal-100 font-mono font-medium leading-none mt-0.5">
                GSTIN: {{ firm.gstin }}
              </span>
            </div>
          </div>

          <!-- Real Database & Branch Status Pill (Desktop) -->
          <div class="hidden lg:flex items-center space-x-2.5 text-xs text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            <span class="inline-flex items-center gap-1.5 text-emerald-200 text-[11px] font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Offline Storage
            </span>
            <span v-if="engineType" class="text-white/40">|</span>
            <span v-if="engineType" class="text-[10px] font-mono text-teal-100 font-bold uppercase tracking-wider">
              {{ engineType }}
            </span>
            <template v-if="activeLocation && (activeLocation.name || activeLocation.gstin)">
              <span class="text-white/40">|</span>
              <span class="text-[11px] font-semibold text-amber-200">
                📍 {{ activeLocation.name || 'Branch' }}
              </span>
            </template>
          </div>

          <!-- Real Navigation Actions -->
          <div class="flex items-center space-x-1 sm:space-x-2">
            <button
              @click="$emit('open-voucher')"
              class="bg-emerald-500 hover:bg-emerald-400 text-white px-2.5 py-1 rounded-lg text-xs transition border-0 cursor-pointer flex items-center gap-1 font-bold shadow-xs active:scale-95"
              title="Create Payment / Receipt / Journal Voucher"
            >
              <span>➕ Voucher</span>
            </button>

            <button
              @click="$emit('change-tab', 'accounting_dashboard')"
              :class="currentTab === 'accounting_dashboard' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white'"
              class="px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium hidden md:flex"
              title="Open Accounting & Financial Dashboard"
            >
              <span>📈 Financials</span>
            </button>

            <button
              @click="$emit('change-tab', 'banking')"
              :class="currentTab === 'banking' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white'"
              class="px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium hidden md:flex"
              title="Open Banking Hub"
            >
              <span>🏦 Banking</span>
            </button>

            <button
              @click="$emit('change-tab', 'statements')"
              :class="currentTab === 'statements' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white'"
              class="px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium hidden md:flex"
              title="Open Daybook & Reports"
            >
              <span>📖 Reports</span>
            </button>

            <button
              @click="$emit('change-tab', 'sales_workspace')"
              :class="currentTab === 'sales_workspace' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white'"
              class="px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium"
              title="Open Sales Workspace"
            >
              <span>⚡ Sales</span>
            </button>

            <button
              @click="$emit('change-tab', 'purchase_workspace')"
              :class="currentTab === 'purchase_workspace' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/10 hover:bg-white/20 text-white'"
              class="px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium hidden sm:flex"
              title="Open Purchase Workspace"
            >
              <span>🛒 Purchase</span>
            </button>

            <button
              @click="$emit('open-export')"
              class="bg-white/10 hover:bg-white/20 text-white px-2.5 py-1 rounded text-xs transition border-0 cursor-pointer flex items-center gap-1 font-medium"
              title="Export Register / Excel"
            >
              <span>💾 Export</span>
            </button>

            <button
              @click="$emit('change-tab', 'sql')"
              :class="currentTab === 'sql' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-transparent hover:bg-white/15 text-white'"
              class="px-2 py-1 rounded transition border-0 cursor-pointer text-xs font-medium flex items-center gap-1"
              title="SQL Terminal"
            >
              <span>🛠️ Tools</span>
            </button>

            <button
              @click="$emit('change-tab', 'firm_settings')"
              :class="currentTab === 'firm_settings' ? 'bg-white/30 text-white font-bold ring-1 ring-white/50' : 'bg-white/15 hover:bg-white/25 text-white'"
              class="px-2.5 py-1 rounded transition border-0 text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
              title="Firm Settings"
            >
              <span>🏢 Settings</span>
            </button>
          </div>
        </nav>
      </header>
    `
  };

  global.NavbarComponent = NavbarComponent;
})(window);
