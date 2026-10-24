// components/DashboardStatsComponent.js
// 100% Faithful Replica of Nuxt 4 app/pages/inventory/index.vue (Zero Demo/Mock Data)
(function (global) {
  'use strict';

  const DashboardStatsComponent = {
    props: {
      stocks: { type: Array, default: () => [] },
      bills: { type: Array, default: () => [] },
      movements: { type: Array, default: () => [] },
      stockMetrics: {
        type: Object,
        default: () => ({ totalItems: 0, totalUnits: 0, totalValuation: 0, lowStockCount: 0, outOfStockCount: 0 })
      },
      billMetrics: {
        type: Object,
        default: () => ({ salesTotal: 0, purchaseTotal: 0, creditNoteCount: 0, debitNoteCount: 0, challanCount: 0, totalVouchers: 0 })
      },
      firm: { type: Object, default: () => ({}) },
      loading: { type: Boolean, default: false }
    },
    emits: [
      'navigate-tab',
      'open-stock-modal',
      'open-sales',
      'open-purchase',
      'open-service-sale',
      'open-service-purchase',
      'open-firm-settings',
      'refresh'
    ],
    data() {
      return {
        stockSearch: '',
        dateStr: new Date().toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        lastRefreshedAt: 'Just now'
      };
    },
    computed: {
      // 6 KPI Ticker Strip (100% matching Nuxt 4 index.vue lines 106-122)
      compactStats() {
        const sm = this.stockMetrics;
        const bm = this.billMetrics;

        return [
          {
            label: 'Total Stock Value',
            value: this.formatCurrency(sm.totalValuation),
            meta: `${sm.totalUnits || 0} Total Units`,
            tone: 'from-emerald-500 to-teal-600',
            textColor: 'text-emerald-700',
            tab: 'stocks'
          },
          {
            label: 'Monthly Sales',
            value: this.formatCurrency(bm.salesTotal),
            meta: `${this.bills.filter(b => b.btype === 'SALES' || b.btype === 'SERVICE').length} Invoices Issued`,
            tone: 'from-rose-500 to-pink-600',
            textColor: 'text-rose-700',
            tab: 'bills'
          },
          {
            label: 'Monthly Purchases',
            value: this.formatCurrency(bm.purchaseTotal),
            meta: `${this.bills.filter(b => b.btype === 'PURCHASE').length} Bills Received`,
            tone: 'from-cyan-500 to-sky-600',
            textColor: 'text-cyan-700',
            tab: 'bills'
          },
          {
            label: 'Pending Challans',
            value: `${bm.challanCount || 0} Challans`,
            meta: 'Delivery Notes Active',
            tone: 'from-amber-500 to-orange-600',
            textColor: 'text-amber-700',
            tab: 'bills'
          },
          {
            label: 'Stock Health Alerts',
            value: `${(sm.lowStockCount || 0) + (sm.outOfStockCount || 0)} Alerts`,
            meta: `${sm.outOfStockCount || 0} Out & ${sm.lowStockCount || 0} Low`,
            tone: (sm.lowStockCount || 0) + (sm.outOfStockCount || 0) > 0 ? 'from-rose-500 to-red-600' : 'from-slate-400 to-slate-500',
            textColor: (sm.lowStockCount || 0) + (sm.outOfStockCount || 0) > 0 ? 'text-rose-700' : 'text-slate-700',
            tab: 'stocks'
          },
          {
            label: 'Active Inventory SKUs',
            value: `${sm.totalItems || 0} SKUs`,
            meta: 'Categorized Items',
            tone: 'from-violet-500 to-purple-600',
            textColor: 'text-violet-700',
            tab: 'stocks'
          }
        ];
      },

      // Top Value Leaders (matching Nuxt 4 index.vue lines 147-156)
      topValueLeaders() {
        const sorted = [...this.stocks].sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
        const maxVal = sorted.length > 0 ? (Number(sorted[0].total) || 1) : 1;
        return sorted.slice(0, 5).map((item) => ({
          ...item,
          percent: Math.min(100, Math.round(((Number(item.total) || 0) / maxVal) * 100))
        }));
      },

      // Filtered Live Inventory Register
      filteredStocks() {
        const q = this.stockSearch.trim().toLowerCase();
        if (!q) return this.stocks;
        return this.stocks.filter((s) =>
          (s.item || '').toLowerCase().includes(q) ||
          (s.hsn || '').toLowerCase().includes(q) ||
          (s.pno || '').toLowerCase().includes(q)
        );
      },

      // Real 6-Month Trend Data (Aggregated from real bills, zero synthetic/mock numbers!)
      monthlyTrendData() {
        const months = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            monthName: d.toLocaleString('en-IN', { month: 'short' }),
            month: d.getMonth(),
            year: d.getFullYear()
          });
        }

        return months.map((m) => {
          const salesSum = this.bills.reduce((sum, b) => {
            const dt = b.bdate ? new Date(b.bdate) : null;
            if (!dt || isNaN(dt.getTime())) return sum;
            if (dt.getMonth() === m.month && dt.getFullYear() === m.year && (b.btype === 'SALES' || b.btype === 'SERVICE')) {
              return sum + (Number(b.netTotal) || 0);
            }
            return sum;
          }, 0);

          const purchaseSum = this.bills.reduce((sum, b) => {
            const dt = b.bdate ? new Date(b.bdate) : null;
            if (!dt || isNaN(dt.getTime())) return sum;
            if (dt.getMonth() === m.month && dt.getFullYear() === m.year && b.btype === 'PURCHASE') {
              return sum + (Number(b.netTotal) || 0);
            }
            return sum;
          }, 0);

          return {
            month: m.monthName,
            sales: salesSum,
            purchases: purchaseSum
          };
        });
      },

      maxTrendVal() {
        let max = 0;
        this.monthlyTrendData.forEach((d) => {
          if (d.sales > max) max = d.sales;
          if (d.purchases > max) max = d.purchases;
        });
        return max > 0 ? max : 1;
      },

      hasAnyTrendData() {
        return this.monthlyTrendData.some((d) => d.sales > 0 || d.purchases > 0);
      },

      // Recent Invoices (matching Nuxt 4 index.vue lines 299-335)
      recentBills() {
        return this.bills.slice(0, 5);
      },

      // Recent Movements (matching Nuxt 4 index.vue lines 338-360)
      recentMovements() {
        return this.movements.slice(0, 5);
      }
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      },
      formatDate(dateStr) {
        return global.Formatters ? global.Formatters.formatDate(dateStr) : (dateStr ? new Date(dateStr).toLocaleDateString('en-IN') : '—');
      },
      getStockHealthColor(qty) {
        const q = Number(qty) || 0;
        if (q <= 0) return 'bg-rose-100 text-rose-800 border-rose-300';
        if (q <= 5) return 'bg-amber-100 text-amber-800 border-amber-300';
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      },
      getStockHealthLabel(qty) {
        const q = Number(qty) || 0;
        if (q <= 0) return 'Out of Stock';
        if (q <= 5) return 'Low Stock';
        return 'In Stock';
      }
    },
    template: `
      <div class="relative space-y-4 w-full text-slate-800">
        <!-- Header Section (100% Matching Nuxt 4 app/pages/inventory/index.vue lines 11-96) -->
        <header class="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-xs w-full">
          <!-- Top Multi-Tone Gradient Bar -->
          <div class="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500 w-full"></div>

          <div class="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between w-full">
            <!-- Left Info Block -->
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-sky-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-sky-500 shadow-[0_0_6px_2px_rgba(14,165,233,0.5)] animate-pulse"></span>
                  Live
                </span>
                <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  {{ dateStr }}
                </span>
                <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  Updated {{ lastRefreshedAt }}
                </span>
                <span v-if="firm && firm.name" class="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-bold text-indigo-700">
                  {{ firm.name }}
                </span>
              </div>
              <div>
                <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                  Inventory Intelligence
                </h1>
                <p class="mt-0.5 text-xs text-slate-500">
                  Stock health, bill flow, movement activity, and financial exposure at a glance.
                </p>
              </div>
            </div>

            <!-- Right Quick Action Navigation Buttons (100% Matching Nuxt 4 lines 29-94) -->
            <div class="flex flex-wrap items-center gap-1.5 lg:shrink-0">
              <div class="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/90 p-1">
                <!-- + New Purchase -->
                <button
                  type="button"
                  @click="$emit('open-purchase')"
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all cursor-pointer h-8 shadow-2xs"
                >
                  <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Purchase</span>
                </button>

                <!-- + New Sale -->
                <button
                  type="button"
                  @click="$emit('open-sales')"
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-all cursor-pointer h-8 shadow-2xs"
                >
                  <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Sale</span>
                </button>

                <!-- Service Sale -->
                <button
                  type="button"
                  @click="$emit('open-service-sale')"
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer h-8 shadow-2xs hidden sm:inline-flex"
                >
                  <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Service Sale</span>
                </button>

                <!-- Service Purchase -->
                <button
                  type="button"
                  @click="$emit('open-service-purchase')"
                  class="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all cursor-pointer h-8 shadow-2xs hidden sm:inline-flex"
                >
                  <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                  </svg>
                  <span>Service Purchase</span>
                </button>
              </div>

              <!-- Bills View -->
              <button
                type="button"
                @click="$emit('navigate-tab', 'bills')"
                class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-300 transition-all cursor-pointer h-8 shadow-2xs"
              >
                <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Bills View</span>
              </button>

              <!-- + New Stock -->
              <button
                type="button"
                @click="$emit('open-stock-modal')"
                class="inline-flex items-center px-3 py-1 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-xs shadow-blue-500/20 transition-all cursor-pointer h-8"
              >
                <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ New Stock</span>
              </button>

              <!-- Firm Settings Button -->
              <button
                type="button"
                @click="$emit('open-firm-settings')"
                title="Configure Company Profile & GSTIN"
                class="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer h-8 shadow-2xs"
              >
                <svg class="w-3.5 h-3.5 mr-1 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Firm</span>
              </button>

              <!-- Refresh Button -->
              <button
                type="button"
                @click="$emit('refresh')"
                title="Refresh Live Metrics"
                class="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-500 bg-white hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer shadow-2xs"
              >
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <!-- 6-KPI Ticker Strip (100% Matching Nuxt 4 lines 106-122) -->
        <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 relative z-10 w-full">
          <article
            v-for="stat in compactStats"
            :key="stat.label"
            @click="$emit('navigate-tab', stat.tab)"
            class="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs hover:shadow-xs transition hover:-translate-y-0.5 cursor-pointer"
          >
            <!-- Top Gradient Bar -->
            <div class="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r" :class="stat.tone"></div>
            <div class="p-3.5 pt-4">
              <p class="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-400 leading-none">
                {{ stat.label }}
              </p>
              <div class="mt-2 text-base sm:text-lg font-black tracking-tight leading-none font-mono" :class="stat.textColor">
                {{ stat.value }}
              </div>
              <div class="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                <span class="h-1.5 w-1.5 rounded-full bg-gradient-to-br" :class="stat.tone"></span>
                <span class="text-[10px] font-semibold text-slate-500 leading-none">{{ stat.meta }}</span>
              </div>
            </div>
          </article>
        </section>

        <!-- Main Content 2-Column Grid (100% Matching Nuxt 4 lines 125-360) -->
        <section class="grid gap-4 xl:grid-cols-[1.4fr_1fr] relative z-10 w-full">
          <!-- Left Column: Trend Chart & Top Leaders & Live Register -->
          <div class="space-y-4">
            <!-- 6-Month Trend Chart Card (Nuxt 4 lines 129-143) -->
            <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                <div>
                  <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">6-Month Trend</p>
                  <h2 class="mt-0.5 text-xs font-black text-slate-900 uppercase">Sales vs Purchase Value</h2>
                </div>
                <div class="flex items-center gap-3">
                  <span class="flex items-center gap-1.5 text-[10px] font-bold text-rose-500">
                    <span class="h-2 w-2 rounded-full bg-rose-500"></span> Sales
                  </span>
                  <span class="flex items-center gap-1.5 text-[10px] font-bold text-cyan-500">
                    <span class="h-2 w-2 rounded-full bg-cyan-500"></span> Purchase
                  </span>
                </div>
              </div>

              <!-- Interactive Visual SVG Trend Chart (Real Aggregated Data) -->
              <div v-if="hasAnyTrendData" class="h-[180px] w-full flex items-end justify-between gap-3 pt-4 px-2">
                <div v-for="d in monthlyTrendData" :key="d.month" class="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div class="w-full flex items-end justify-center gap-1.5 h-32">
                    <!-- Sales Bar -->
                    <div
                      :style="{ height: d.sales > 0 ? Math.max(8, (d.sales / maxTrendVal) * 100) + '%' : '0%' }"
                      class="w-3.5 bg-gradient-to-t from-rose-500 to-pink-400 rounded-t-sm transition-all hover:opacity-80"
                      :title="'Sales: ' + formatCurrency(d.sales)"
                    ></div>
                    <!-- Purchase Bar -->
                    <div
                      :style="{ height: d.purchases > 0 ? Math.max(8, (d.purchases / maxTrendVal) * 100) + '%' : '0%' }"
                      class="w-3.5 bg-gradient-to-t from-cyan-500 to-sky-400 rounded-t-sm transition-all hover:opacity-80"
                      :title="'Purchases: ' + formatCurrency(d.purchases)"
                    ></div>
                  </div>
                  <span class="text-[10px] font-bold text-slate-400 uppercase mt-1">{{ d.month }}</span>
                </div>
              </div>
              <div v-else class="h-[160px] flex flex-col items-center justify-center text-center text-xs text-slate-400 italic">
                <p>No billing data recorded yet for the past 6 months.</p>
                <p class="text-[10px] text-slate-400 mt-1">Create sales or purchase vouchers to visualize revenue trends.</p>
              </div>
            </div>

            <!-- Two Sub-Cards Grid: Top Value Leaders & Stock Health Distribution (Nuxt 4 lines 145-168) -->
            <div class="grid gap-4 md:grid-cols-2">
              <!-- Value Leaders Card -->
              <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div class="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Value Leaders</p>
                    <h2 class="mt-0.5 text-xs font-black text-slate-900 uppercase">Top Stock by Value</h2>
                  </div>
                  <span class="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">Ranked</span>
                </div>

                <div v-if="topValueLeaders.length" class="space-y-2.5">
                  <div v-for="(item, idx) in topValueLeaders" :key="item.id" class="space-y-1">
                    <div class="flex items-center justify-between text-xs">
                      <span class="font-bold text-slate-800 truncate max-w-[140px]">{{ idx + 1 }}. {{ item.item }}</span>
                      <span class="font-mono font-bold text-slate-900">{{ formatCurrency(item.total) }}</span>
                    </div>
                    <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div class="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full" :style="{ width: item.percent + '%' }"></div>
                    </div>
                  </div>
                </div>
                <div v-else class="py-8 text-center text-xs text-slate-400 italic">
                  No stock items yet. Click "+ New Stock" to create items.
                </div>
              </div>

              <!-- Movement Mix Card -->
              <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
                <div class="border-b border-slate-100 pb-2.5 mb-3 flex items-center justify-between">
                  <div>
                    <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Movement Mix</p>
                    <h2 class="mt-0.5 text-xs font-black text-slate-900 uppercase">Transaction Composition</h2>
                  </div>
                  <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">Live Ledger</span>
                </div>

                <div class="space-y-2 text-xs">
                  <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                      <span class="font-bold text-slate-700">Sales Invoices</span>
                    </div>
                    <span class="font-mono font-bold text-slate-900">{{ bills.filter(b => b.btype === 'SALES' || b.btype === 'SERVICE').length }}</span>
                  </div>

                  <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                      <span class="font-bold text-slate-700">Purchase Bills</span>
                    </div>
                    <span class="font-mono font-bold text-slate-900">{{ bills.filter(b => b.btype === 'PURCHASE').length }}</span>
                  </div>

                  <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      <span class="font-bold text-slate-700">Returns (CN / DN)</span>
                    </div>
                    <span class="font-mono font-bold text-slate-900">{{ bills.filter(b => b.btype === 'CREDIT_NOTE' || b.btype === 'DEBIT_NOTE').length }}</span>
                  </div>

                  <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <div class="flex items-center space-x-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                      <span class="font-bold text-slate-700">Delivery Challans</span>
                    </div>
                    <span class="font-mono font-bold text-slate-900">{{ billMetrics.challanCount || 0 }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Real-time Inventory Register Table (Nuxt 4 lines 170-242) -->
            <div class="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
              <div class="p-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h2 class="text-xs font-black text-slate-900 uppercase tracking-tight leading-none">
                    Inventory Register
                  </h2>
                  <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Real-time stock availability
                  </p>
                </div>
                <div class="w-56">
                  <input
                    type="text"
                    v-model="stockSearch"
                    placeholder="Filter items..."
                    class="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div class="overflow-x-auto w-full">
                <table class="w-full text-left text-xs divide-y divide-slate-100">
                  <thead>
                    <tr class="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th class="py-2.5 px-3">Item Details</th>
                      <th class="py-2.5 px-3">Part No</th>
                      <th class="py-2.5 px-3 text-right">Quantity</th>
                      <th class="py-2.5 px-3 text-right">Avg Rate</th>
                      <th class="py-2.5 px-3 text-right">Total Value</th>
                      <th class="py-2.5 px-3 text-center">Health</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr
                      v-for="s in filteredStocks.slice(0, 8)"
                      :key="s.id"
                      @click="$emit('navigate-tab', 'stocks')"
                      class="hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td class="py-2 px-3">
                        <div class="font-bold text-slate-900">{{ s.item }}</div>
                        <div class="text-[9px] text-slate-400 font-bold tracking-widest mt-0.5">HSN: {{ s.hsn }}</div>
                      </td>
                      <td class="py-2 px-3">
                        <div class="font-semibold text-slate-700">{{ s.pno || '—' }}</div>
                        <div v-if="s.oem" class="text-[9px] text-slate-400 font-bold uppercase">{{ s.oem }}</div>
                      </td>
                      <td class="py-2 px-3 text-right">
                        <div class="font-bold text-slate-900">{{ Number(s.qty || 0).toLocaleString() }} <span class="text-[9px] text-slate-400 ml-0.5">{{ s.uom }}</span></div>
                      </td>
                      <td class="py-2 px-3 text-right font-mono text-slate-600">
                        {{ formatCurrency(s.rate) }}
                      </td>
                      <td class="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {{ formatCurrency(s.total) }}
                      </td>
                      <td class="py-2 px-3 text-center">
                        <span
                          :class="getStockHealthColor(s.qty)"
                          class="px-2 py-0.5 font-bold uppercase tracking-wider text-[9px] rounded border"
                        >
                          {{ getStockHealthLabel(s.qty) }}
                        </span>
                      </td>
                    </tr>
                    <tr v-if="filteredStocks.length === 0">
                      <td colspan="6" class="py-8 text-center text-xs text-slate-400 italic">
                        No stock records found.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div v-if="filteredStocks.length > 8" class="p-2 bg-slate-50 text-center border-t border-slate-100">
                <button
                  type="button"
                  @click="$emit('navigate-tab', 'stocks')"
                  class="font-black text-[10px] uppercase tracking-widest text-blue-600 hover:underline cursor-pointer"
                >
                  View All {{ filteredStocks.length }} Items &rarr;
                </button>
              </div>
            </div>
          </div>

          <!-- Right Column: Signals & Feeds (100% Matching Nuxt 4 lines 245-360) -->
          <div class="space-y-4">
            <!-- 1. Stock Signals Alerts Card (100% matching Nuxt 4 lines 248-297) -->
            <div class="overflow-hidden rounded-[22px] bg-slate-900 border border-slate-800 shadow-md text-white">
              <div class="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <p class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Stock Signals</p>
                  <h2 class="mt-0.5 text-base font-bold text-white">Priority Inventory Alerts</h2>
                </div>
                <div class="rounded-[14px] border border-white/10 bg-white/5 px-3 py-2 text-right">
                  <p class="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total Valuation</p>
                  <p class="mt-0.5 text-sm font-black text-white font-mono">{{ formatCurrency(stockMetrics.totalValuation) }}</p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 p-4">
                <!-- Low stock signal -->
                <div class="rounded-[18px] border border-amber-400/20 bg-amber-500/10 p-4">
                  <div class="flex items-center gap-1.5 mb-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_2px_rgba(245,158,11,0.5)]"></span>
                    <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Low Stock</span>
                  </div>
                  <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ stockMetrics.lowStockCount || 0 }}</div>
                  <div class="mt-2 text-[10px] font-semibold text-amber-300">1–5 units remaining</div>
                </div>

                <!-- Out of stock signal -->
                <div class="rounded-[18px] border border-rose-400/20 bg-rose-500/10 p-4">
                  <div class="flex items-center gap-1.5 mb-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_2px_rgba(244,63,94,0.5)]"></span>
                    <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Out of Stock</span>
                  </div>
                  <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ stockMetrics.outOfStockCount || 0 }}</div>
                  <div class="mt-2 text-[10px] font-semibold text-rose-300">Zero quantity</div>
                </div>

                <!-- Active bills signal -->
                <div class="rounded-[18px] border border-sky-400/20 bg-sky-500/10 p-4">
                  <div class="flex items-center gap-1.5 mb-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_2px_rgba(14,165,233,0.5)]"></span>
                    <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Active Bills</span>
                  </div>
                  <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ bills.length }}</div>
                  <div class="mt-2 text-[10px] font-semibold text-sky-300">In register</div>
                </div>

                <!-- Movements signal -->
                <div class="rounded-[18px] border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <div class="flex items-center gap-1.5 mb-2">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(16,185,129,0.5)]"></span>
                    <span class="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Movements</span>
                  </div>
                  <div class="text-[1.8rem] font-black tracking-tight text-white leading-none font-mono">{{ movements.length }}</div>
                  <div class="mt-2 text-[10px] font-semibold text-emerald-300">Recent rows loaded</div>
                </div>
              </div>
            </div>

            <!-- 2. Recent Invoices (100% matching Nuxt 4 lines 299-336) -->
            <div class="w-full shadow-2xs rounded-2xl border border-slate-200 bg-white p-4 py-3">
              <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <div>
                  <h2 class="text-xs font-black text-slate-900 uppercase tracking-tight leading-none">Recent Invoices</h2>
                  <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Latest billing activity</p>
                </div>
                <button
                  type="button"
                  @click="$emit('navigate-tab', 'bills')"
                  class="font-black text-[10px] uppercase tracking-widest text-blue-600 hover:underline cursor-pointer"
                >
                  View All
                </button>
              </div>

              <div class="space-y-1.5">
                <div
                  v-for="b in recentBills"
                  :key="b.id"
                  @click="$emit('navigate-tab', 'bills')"
                  class="flex items-center gap-3 p-2 px-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all cursor-pointer"
                >
                  <div
                    :class="b.btype === 'SALES' || b.btype === 'SERVICE' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'"
                    class="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[9px] shrink-0 leading-none"
                  >
                    {{ b.btype === 'SALES' || b.btype === 'SERVICE' ? 'SLS' : 'PUR' }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <h4 class="text-xs font-bold text-slate-900 truncate leading-none">{{ b.partyName }}</h4>
                    <p class="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none font-mono">{{ b.bno }}</p>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-bold text-slate-900 font-mono leading-none">{{ formatCurrency(b.netTotal) }}</div>
                    <div class="text-[9px] text-slate-400 font-bold uppercase mt-1 leading-none">{{ formatDate(b.bdate) }}</div>
                  </div>
                </div>

                <div v-if="recentBills.length === 0" class="py-6 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">
                  No recent bills found
                </div>
              </div>
            </div>

            <!-- 3. Stock Movement Feed (100% matching Nuxt 4 lines 338-360) -->
            <div class="w-full shadow-2xs rounded-2xl border border-slate-200 bg-white p-4 py-3">
              <div class="flex items-center justify-between mb-3 border-b border-slate-100 pb-2.5">
                <div>
                  <h2 class="text-xs font-black text-slate-900 uppercase tracking-tight leading-none">Stock Movement Feed</h2>
                  <p class="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Trace inward and outward transactions</p>
                </div>
                <button
                  type="button"
                  @click="$emit('navigate-tab', 'ledger')"
                  class="font-black text-[10px] uppercase tracking-widest text-blue-600 hover:underline cursor-pointer"
                >
                  Full Ledger
                </button>
              </div>

              <div class="space-y-1.5">
                <div
                  v-for="m in recentMovements"
                  :key="m.id"
                  @click="$emit('navigate-tab', 'ledger')"
                  class="flex items-center justify-between p-2 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer text-xs"
                >
                  <div class="min-w-0">
                    <div class="font-bold text-slate-900 truncate">{{ m.item }}</div>
                    <div class="text-[9px] text-slate-400 font-mono">{{ m.bno || 'MANUAL' }} &bull; {{ m.type }}</div>
                  </div>
                  <div class="text-right font-mono">
                    <span
                      :class="Number(m.qty) > 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'"
                    >
                      {{ Number(m.qty) > 0 ? '+' : '' }}{{ m.qty }}
                    </span>
                    <div class="text-[9px] text-slate-400">{{ formatDate(m.timestamp) }}</div>
                  </div>
                </div>

                <div v-if="recentMovements.length === 0" class="py-6 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest italic">
                  No recent movements recorded
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    `
  };

  global.DashboardStatsComponent = DashboardStatsComponent;
})(window);
