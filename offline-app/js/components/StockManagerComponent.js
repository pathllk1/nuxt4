// components/StockManagerComponent.js
(function (global) {
  'use strict';

  const StockManagerComponent = {
    props: {
      stocks: { type: Array, default: () => [] },
      searchQuery: { type: String, default: '' },
      statusFilter: { type: String, default: 'all' },
      loading: { type: Boolean, default: false }
    },
    emits: [
      'update:searchQuery',
      'update:statusFilter',
      'open-stock-modal',
      'edit-stock',
      'adjust-stock',
      'delete-stock',
      'export-excel'
    ],
    data() {
      return {
        expandedRows: new Set(),
        selectedStockIndex: -1
      };
    },
    mounted() {
      window.addEventListener('keydown', this.handleKeydown);
    },
    beforeUnmount() {
      window.removeEventListener('keydown', this.handleKeydown);
    },
    methods: {
      handleKeydown(e) {
        const modalOpen = document.querySelector('.fixed:not([style*="display: none"]):not([style*="display:none"]), [role="dialog"]');
        if (modalOpen) return;

        if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          this.$emit('open-stock-modal');
          return;
        }

        if (e.key === 'F2' || (e.key === '/' && document.activeElement && document.activeElement.tagName !== 'INPUT')) {
          e.preventDefault();
          const input = this.$el.querySelector('input[placeholder*="Search by name"]');
          if (input) {
            input.focus();
            if (input.select) input.select();
          }
          return;
        }

        const len = (this.stocks || []).length;
        if (len === 0) return;

        if (e.key === 'ArrowDown') {
          if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            e.preventDefault();
            document.activeElement.blur();
            this.selectedStockIndex = 0;
            this.scrollRow(0);
            return;
          }
          if (this.selectedStockIndex < len - 1) {
            e.preventDefault();
            this.selectedStockIndex++;
            this.scrollRow(this.selectedStockIndex);
          }
        } else if (e.key === 'ArrowUp') {
          if (this.selectedStockIndex > 0) {
            e.preventDefault();
            this.selectedStockIndex--;
            this.scrollRow(this.selectedStockIndex);
          } else if (this.selectedStockIndex === 0) {
            e.preventDefault();
            this.selectedStockIndex = -1;
            const input = this.$el.querySelector('input[placeholder*="Search by name"]');
            if (input) input.focus();
          }
        } else if (e.key === 'Enter') {
          if (this.selectedStockIndex >= 0 && this.selectedStockIndex < len && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) {
            e.preventDefault();
            this.$emit('edit-stock', this.stocks[this.selectedStockIndex]);
          }
        } else if (e.key === ' ' || e.key === 'Spacebar') {
          if (this.selectedStockIndex >= 0 && this.selectedStockIndex < len && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) {
            e.preventDefault();
            this.toggleExpand(this.stocks[this.selectedStockIndex].id);
          }
        } else if (e.key === 'Delete') {
          if (this.selectedStockIndex >= 0 && this.selectedStockIndex < len && (!document.activeElement || document.activeElement.tagName !== 'INPUT')) {
            e.preventDefault();
            this.$emit('delete-stock', this.stocks[this.selectedStockIndex]);
          }
        }
      },
      scrollRow(idx) {
        this.$nextTick(() => {
          const row = this.$el.querySelector(`tbody tr[data-index="${idx}"]`);
          if (row) row.scrollIntoView({ block: 'nearest' });
        });
      },
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val).toFixed(2);
      },
      formatDate(dateStr) {
        return global.Formatters ? global.Formatters.formatDate(dateStr) : dateStr;
      },
      toggleExpand(id) {
        if (this.expandedRows.has(id)) {
          this.expandedRows.delete(id);
        } else {
          this.expandedRows.add(id);
        }
      },
      getBatches(item) {
        if (!item.batches) return [];
        if (Array.isArray(item.batches)) return item.batches;
        try {
          return JSON.parse(item.batches);
        } catch {
          return [];
        }
      },
      getStockHealth(qty, minQty = 5) {
        const q = Number(qty) || 0;
        const min = Number(minQty) || 5;
        if (q <= 0) {
          return { label: 'OUT OF STOCK', color: 'bg-rose-100 text-rose-800 border-rose-300' };
        }
        if (q <= min * 0.5) {
          return { label: 'CRITICAL', color: 'bg-rose-50 text-rose-700 border-rose-200' };
        }
        if (q <= min) {
          return { label: 'LOW STOCK', color: 'bg-amber-100 text-amber-800 border-amber-300' };
        }
        return { label: 'IN STOCK', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      }
    },
    template: `
      <div class="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden w-full">
        <!-- Compact Control Bar (Replicating Nuxt 4 stocks.vue) -->
        <div class="p-2 sm:p-2.5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 w-full">
          <!-- Search & SKU Count -->
          <div class="flex items-center space-x-2 flex-1">
            <div class="relative flex-1 max-w-sm">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                @keydown.esc.prevent="$event.target.blur()"
                @keydown.down.prevent="$event.target.blur(); selectedStockIndex = 0; scrollRow(0)"
                @keydown.enter.prevent="$event.target.blur(); if (stocks.length > 0) $emit('edit-stock', stocks[selectedStockIndex >= 0 ? selectedStockIndex : 0])"
                placeholder="Search by name, HSN, or Part No... (/ to focus • ESC to blur)"
                class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <select
              :value="statusFilter"
              @change="$emit('update:statusFilter', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer font-medium"
            >
              <option value="all">All Inventory</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
              <option value="normal">In Stock</option>
            </select>

            <span class="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2 hidden sm:inline">
              Total: {{ stocks.length }} SKUs
            </span>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-1.5 shrink-0">
            <!-- Formatted Excel Export -->
            <button
              type="button"
              @click="$emit('export-excel')"
              class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-2xs transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>

            <!-- Add Stock Item -->
            <button
              type="button"
              @click="$emit('open-stock-modal')"
              class="inline-flex items-center px-3 py-1 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs shadow-blue-500/20 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Add New Stock</span>
            </button>
          </div>
        </div>

        <!-- Stock Register Table with Expandable Batches (100% matching Nuxt 4 stocks.vue) -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                <th class="py-2.5 px-3">Item Details</th>
                <th class="py-2.5 px-3 whitespace-nowrap">Part No / OEM</th>
                <th class="py-2.5 px-3 text-right whitespace-nowrap">Quantity</th>
                <th class="py-2.5 px-3 text-right whitespace-nowrap">Avg Rate</th>
                <th class="py-2.5 px-3 text-right whitespace-nowrap">Total Value</th>
                <th class="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                <th class="py-2.5 px-3 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <template v-for="(stock, idx) in stocks" :key="stock.id">
                <tr
                  :data-index="idx"
                  :class="{
                    'bg-blue-100/70 ring-1 ring-blue-400 font-bold': selectedStockIndex === idx,
                    'hover:bg-blue-50/40': selectedStockIndex !== idx
                  }"
                  class="transition-colors cursor-pointer group"
                  @click="toggleExpand(stock.id)"
                >
                  <!-- Item Details (with chevron expander) -->
                  <td class="py-2 px-3">
                    <div class="flex items-center gap-2">
                      <div class="w-4.5 h-4.5 rounded bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                        <svg
                          :class="expandedRows.has(stock.id) ? 'rotate-180' : ''"
                          class="w-3 h-3 text-slate-500 group-hover:text-blue-600 transition-transform"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div>
                        <div class="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {{ stock.item }}
                        </div>
                        <div class="text-[9px] text-slate-400 font-bold tracking-widest mt-0.5 font-mono">
                          HSN: {{ stock.hsn || '—' }}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Part No / OEM -->
                  <td class="py-2 px-3 whitespace-nowrap">
                    <div class="font-semibold text-slate-700 font-mono text-[11px]">{{ stock.pno || '—' }}</div>
                    <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{{ stock.oem || '—' }}</div>
                  </td>

                  <!-- Quantity on Hand -->
                  <td class="py-2 px-3 whitespace-nowrap text-right">
                    <div class="font-bold text-slate-900">
                      {{ Number(stock.qty || 0).toLocaleString() }}
                      <span class="text-[9px] text-slate-400 font-normal ml-0.5">{{ stock.uom || 'PCS' }}</span>
                    </div>
                    <div v-if="getBatches(stock).length > 1" class="text-[8px] text-blue-600 font-extrabold uppercase tracking-widest">
                      {{ getBatches(stock).length }} Batches
                    </div>
                  </td>

                  <!-- Rate -->
                  <td class="py-2 px-3 whitespace-nowrap text-right font-medium text-slate-600">
                    {{ formatCurrency(stock.rate) }}
                  </td>

                  <!-- Total Value -->
                  <td class="py-2 px-3 whitespace-nowrap text-right font-bold text-slate-900">
                    {{ formatCurrency((Number(stock.qty) || 0) * (Number(stock.rate) || 0)) }}
                  </td>

                  <!-- Status Badge -->
                  <td class="py-2 px-3 whitespace-nowrap text-center">
                    <span
                      :class="getStockHealth(stock.qty, stock.min_qty).color"
                      class="px-2 py-0.5 font-extrabold uppercase tracking-widest text-[9px] rounded-md border inline-block"
                    >
                      {{ getStockHealth(stock.qty, stock.min_qty).label }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="py-2 px-3 whitespace-nowrap text-center" @click.stop>
                    <div class="flex items-center justify-center space-x-1">
                      <!-- Adjust -->
                      <button
                        type="button"
                        @click="$emit('adjust-stock', stock)"
                        title="Adjust Physical Quantity"
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                      >
                        Adj
                      </button>

                      <!-- Edit -->
                      <button
                        type="button"
                        @click="$emit('edit-stock', stock)"
                        title="Edit Item"
                        class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>

                      <!-- Delete -->
                      <button
                        type="button"
                        @click="$emit('delete-stock', stock)"
                        title="Delete Item"
                        class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Expanded Batch Inventory Breakdown (Matching Nuxt 4 stocks.vue line 120-155) -->
                <tr v-if="expandedRows.has(stock.id)" class="bg-slate-50/70 border-b border-slate-200">
                  <td colspan="7" class="px-5 py-2.5">
                    <div class="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
                      <div class="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span class="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                          Batch Inventory Breakdown
                        </span>
                        <span class="text-[9px] text-slate-400 font-mono">Cost Rate: {{ formatCurrency(stock.cost_rate || stock.rate) }}</span>
                      </div>

                      <table class="w-full text-left text-xs divide-y divide-slate-100">
                        <thead>
                          <tr class="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            <th class="px-3 py-1">Batch Number</th>
                            <th class="px-3 py-1 text-right">Quantity</th>
                            <th class="px-3 py-1 text-right">Rate</th>
                            <th class="px-3 py-1 text-right">GST %</th>
                            <th class="px-3 py-1 text-right">MRP</th>
                            <th class="px-3 py-1">Min Alert</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                          <tr v-if="getBatches(stock).length" v-for="(b, bIdx) in getBatches(stock)" :key="bIdx" class="text-slate-600">
                            <td class="px-3 py-1 font-bold">{{ b.batch || 'DEFAULT' }}</td>
                            <td class="px-3 py-1 text-right font-bold text-slate-900">{{ b.qty }} {{ b.uom || stock.uom }}</td>
                            <td class="px-3 py-1 text-right">{{ formatCurrency(b.rate || stock.rate) }}</td>
                            <td class="px-3 py-1 text-right">{{ b.grate || stock.grate }}%</td>
                            <td class="px-3 py-1 text-right font-bold">{{ b.mrp ? formatCurrency(b.mrp) : '—' }}</td>
                            <td class="px-3 py-1">{{ b.expiry ? formatDate(b.expiry) : '—' }}</td>
                          </tr>
                          <tr v-else class="text-slate-600">
                            <td class="px-3 py-1 font-bold text-slate-800">PRIMARY</td>
                            <td class="px-3 py-1 text-right font-bold text-slate-900">{{ stock.qty }} {{ stock.uom }}</td>
                            <td class="px-3 py-1 text-right">{{ formatCurrency(stock.rate) }}</td>
                            <td class="px-3 py-1 text-right">{{ stock.grate }}%</td>
                            <td class="px-3 py-1 text-right font-bold">{{ stock.mrp ? formatCurrency(stock.mrp) : '—' }}</td>
                            <td class="px-3 py-1">{{ stock.min_qty }} {{ stock.uom }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              </template>

              <!-- Empty State -->
              <tr v-if="!loading && (!stocks || stocks.length === 0)">
                <td colspan="7" class="py-12 text-center text-slate-400 bg-white">
                  <p class="text-xs font-bold text-slate-700">No stock items found</p>
                  <p class="text-[11px] mt-0.5">Click "+ Add New Stock" above to register your inventory items.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `
  };

  global.StockManagerComponent = StockManagerComponent;
})(window);
