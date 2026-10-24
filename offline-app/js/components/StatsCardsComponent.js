// components/StatsCardsComponent.js
(function (global) {
  'use strict';

  const StatsCardsComponent = {
    props: {
      metrics: {
        type: Object,
        default: () => ({ total: 0, active: 0, completed: 0, totalValue: 0 })
      }
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '$' + Number(val).toFixed(2);
      }
    },
    template: `
      <section class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3 w-full">
        <!-- Card 1: Total Records (Blue Theme) -->
        <div class="bg-white border border-slate-200 border-l-4 border-l-blue-500 rounded-lg p-2.5 sm:p-3 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Records</span>
            <div class="flex items-baseline space-x-1.5 mt-0.5">
              <span class="text-xl sm:text-2xl font-extrabold text-slate-900">{{ metrics.total }}</span>
              <span class="text-[10px] text-blue-600 font-medium">In WebSQL</span>
            </div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
        </div>

        <!-- Card 2: Active Records (Amber Theme) -->
        <div class="bg-white border border-slate-200 border-l-4 border-l-amber-500 rounded-lg p-2.5 sm:p-3 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">In Progress</span>
            <div class="flex items-baseline space-x-1.5 mt-0.5">
              <span class="text-xl sm:text-2xl font-extrabold text-amber-600">{{ metrics.active }}</span>
              <span class="text-[10px] text-amber-600 font-medium">Pending</span>
            </div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <!-- Card 3: Completed Records (Emerald Theme) -->
        <div class="bg-white border border-slate-200 border-l-4 border-l-emerald-500 rounded-lg p-2.5 sm:p-3 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Completed</span>
            <div class="flex items-baseline space-x-1.5 mt-0.5">
              <span class="text-xl sm:text-2xl font-extrabold text-emerald-600">{{ metrics.completed }}</span>
              <span class="text-[10px] text-emerald-600 font-medium">Done</span>
            </div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <!-- Card 4: Total Value (Purple/Indigo Theme) -->
        <div class="bg-white border border-slate-200 border-l-4 border-l-purple-500 rounded-lg p-2.5 sm:p-3 shadow-xs flex items-center justify-between">
          <div>
            <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Cumulative Value</span>
            <div class="flex items-baseline space-x-1.5 mt-0.5">
              <span class="text-xl sm:text-2xl font-extrabold text-purple-700">{{ formatCurrency(metrics.totalValue) }}</span>
              <span class="text-[10px] text-purple-600 font-medium">Budget</span>
            </div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </section>
    `
  };

  global.StatsCardsComponent = StatsCardsComponent;
})(window);
