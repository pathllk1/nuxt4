// components/StockLedgerComponent.js
(function (global) {
  'use strict';

  const StockLedgerComponent = {
    props: {
      movements: { type: Array, default: () => [] },
      searchQuery: { type: String, default: '' },
      typeFilter: { type: String, default: 'ALL' },
      loading: { type: Boolean, default: false }
    },
    emits: ['update:searchQuery', 'update:typeFilter'],
    methods: {
      formatDate(dateStr) {
        return global.Formatters ? global.Formatters.formatDate(dateStr) : dateStr;
      },
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val).toFixed(2);
      },
      getTypeBadge(type) {
        if (type === 'SALES' || type === 'DELIVERY_NOTE' || type === 'DEBIT_NOTE') {
          return 'bg-rose-100 text-rose-800 border-rose-200';
        }
        if (type === 'PURCHASE' || type === 'CREDIT_NOTE' || type === 'OPENING') {
          return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        }
        return 'bg-amber-100 text-amber-800 border-amber-200';
      }
    },
    template: `
      <div class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
        <!-- Filter Header -->
        <div class="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
          <div class="flex items-center space-x-2 flex-1">
            <div class="relative flex-1 max-w-sm">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                placeholder="Search item, voucher, party..."
                class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
              />
            </div>

            <select
              :value="typeFilter"
              @change="$emit('update:typeFilter', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs cursor-pointer font-medium"
            >
              <option value="ALL">All Movements</option>
              <option value="SALES">Outward: Sales</option>
              <option value="PURCHASE">Inward: Purchases</option>
              <option value="CREDIT_NOTE">Inward: Credit Notes (Return)</option>
              <option value="DEBIT_NOTE">Outward: Debit Notes</option>
              <option value="DELIVERY_NOTE">Outward: Delivery Challans</option>
              <option value="ADJUSTMENT">Audit Adjustments</option>
            </select>
          </div>
          <span class="text-[11px] text-slate-500 font-medium">
            Showing {{ movements.length }} movement entries
          </span>
        </div>

        <!-- Ledger Table (Full Width, Compact Light Theme) -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th class="py-2 px-3 whitespace-nowrap">Timestamp</th>
                <th class="py-2 px-3 whitespace-nowrap">Type</th>
                <th class="py-2 px-3 whitespace-nowrap">Voucher Ref</th>
                <th class="py-2 px-3 min-w-[200px]">Item Description</th>
                <th class="py-2 px-3 text-right whitespace-nowrap">In / Out Qty</th>
                <th class="py-2 px-3 text-right whitespace-nowrap">Balance QOH</th>
                <th class="py-2 px-3 text-right whitespace-nowrap">Rate (₹)</th>
                <th class="py-2 px-3 whitespace-nowrap">Party / Destination</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="m in movements"
                :key="m.id"
                class="hover:bg-amber-50/30 transition-colors"
              >
                <!-- Timestamp -->
                <td class="py-2 px-3 whitespace-nowrap text-slate-500 text-[11px]">
                  {{ formatDate(m.timestamp) }}
                </td>

                <!-- Type Badge -->
                <td class="py-2 px-3 whitespace-nowrap">
                  <span
                    :class="getTypeBadge(m.type)"
                    class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border"
                  >
                    {{ m.type }}
                  </span>
                </td>

                <!-- Voucher Ref -->
                <td class="py-2 px-3 font-mono font-bold text-slate-800 whitespace-nowrap">
                  {{ m.bno || '-' }}
                </td>

                <!-- Item Description -->
                <td class="py-2 px-3 font-semibold text-slate-900">
                  {{ m.item }}
                </td>

                <!-- In / Out Qty -->
                <td class="py-2 px-3 text-right font-extrabold whitespace-nowrap" :class="Number(m.qty) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                  {{ Number(m.qty) > 0 ? '+' : '' }}{{ m.qty }}
                </td>

                <!-- Balance QOH -->
                <td class="py-2 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                  {{ m.qtyh }}
                </td>

                <!-- Rate -->
                <td class="py-2 px-3 text-right text-slate-600 whitespace-nowrap">
                  {{ formatCurrency(m.rate) }}
                </td>

                <!-- Party Name -->
                <td class="py-2 px-3 text-slate-700 whitespace-nowrap">
                  {{ m.partyName || '-' }}
                </td>
              </tr>

              <!-- Empty State -->
              <tr v-if="!loading && (!movements || movements.length === 0)">
                <td colspan="8" class="py-8 text-center text-slate-400 bg-white">
                  No stock movements recorded yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  };

  global.StockLedgerComponent = StockLedgerComponent;
})(window);
