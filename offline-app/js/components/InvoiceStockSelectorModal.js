// components/InvoiceStockSelectorModal.js
(function (global) {
  'use strict';

  const InvoiceStockSelectorModal = {
    props: {
      show: { type: Boolean, default: false },
      stocks: { type: Array, default: () => [] },
      mode: { type: String, default: 'sales' }
    },
    emits: ['close', 'select-stock', 'register-new', 'edit-stock', 'add-blank'],
    data() {
      return {
        searchQuery: '',
        selectedIndex: 0,
        expandedStockId: null
      };
    },
    computed: {
      filteredStocks() {
        if (!this.searchQuery || !this.searchQuery.trim()) return this.stocks;
        const q = this.searchQuery.toLowerCase().trim();
        return this.stocks.filter((s) => {
          return (
            (s.item && s.item.toLowerCase().includes(q)) ||
            (s.hsn && s.hsn.toLowerCase().includes(q)) ||
            (s.pno && s.pno.toLowerCase().includes(q)) ||
            (s.oem && s.oem.toLowerCase().includes(q)) ||
            (s.category && s.category.toLowerCase().includes(q))
          );
        });
      },
      flatNavigableList() {
        const list = [];
        for (const stock of this.filteredStocks) {
          list.push({ type: 'stock', stock });
          if (this.stockIdMatches(stock, this.expandedStockId)) {
            const batches = this.getStockBatches(stock);
            if (batches.length > 1) {
              for (const batch of batches) {
                list.push({ type: 'batch', stock, batch });
              }
            }
          }
        }
        return list;
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          this.searchQuery = '';
          this.selectedIndex = 0;
          this.expandedStockId = null;
          this.focusInput();
        }
      },
      searchQuery() {
        this.selectedIndex = 0;
      },
      selectedIndex() {
        this.$nextTick(() => {
          const activeRow = this.$el.querySelector('.active-stock-row');
          if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
        });
      }
    },
    methods: {
      formatCurrency(val) {
        return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      formatDate(dateString) {
        if (!dateString) return '-';
        try {
          return new Date(dateString).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
        } catch (_) {
          return dateString;
        }
      },
      getStockBatches(stock) {
        if (!stock) return [];
        if (Array.isArray(stock.batches) && stock.batches.length > 0) return stock.batches;
        if (typeof stock.batches === 'string') {
          try {
            const parsed = JSON.parse(stock.batches);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          } catch (_) {}
        }
        return [
          {
            batch: stock.batch || 'DEFAULT / B01',
            qty: Number(stock.qty) || 0,
            uom: stock.uom || 'PCS',
            rate: Number(stock.cost_rate || stock.rate) || 0,
            sale_rate: Number(stock.sale_rate || stock.rate) || 0,
            grate: Number(stock.grate !== undefined ? stock.grate : 18),
            mrp: Number(stock.mrp || 0),
            expiry: ''
          }
        ];
      },
      focusInput() {
        const tryFocus = () => {
          const input = this.$refs.searchInput || (this.$el && this.$el.querySelector('input'));
          if (input && typeof input.focus === 'function' && input.offsetHeight > 0) {
            input.focus();
            if (typeof input.select === 'function') input.select();
            return true;
          }
          return false;
        };
        this.$nextTick(tryFocus);
        setTimeout(tryFocus, 25);
        setTimeout(tryFocus, 80);
        setTimeout(tryFocus, 180);
      },
      getStockId(stock) {
        if (!stock) return null;
        return stock.id != null ? stock.id : (stock._id != null ? stock._id : null);
      },
      stockIdMatches(stock, id) {
        if (!stock || id == null) return false;
        const sId = this.getStockId(stock);
        return sId != null && String(sId) === String(id);
      },
      isStockSelected(stock) {
        const current = this.flatNavigableList[this.selectedIndex];
        if (!current || current.type !== 'stock' || !current.stock || !stock) return false;
        return this.stockIdMatches(stock, this.getStockId(current.stock));
      },
      isBatchSelected(stock, batch) {
        const current = this.flatNavigableList[this.selectedIndex];
        if (!current || current.type !== 'batch' || !current.stock || !current.batch || !stock || !batch) return false;
        return (
          this.stockIdMatches(stock, this.getStockId(current.stock)) &&
          String(current.batch.batch || '') === String(batch.batch || '')
        );
      },
      toggleStock(stock) {
        const batches = this.getStockBatches(stock);
        const stockId = this.getStockId(stock);
        if (batches.length > 1) {
          this.expandedStockId = this.stockIdMatches(stock, this.expandedStockId) ? null : stockId;
        } else {
          this.selectStockRow(stock, batches[0] || null);
        }
      },
      selectStockRow(stock, batch) {
        this.$emit('select-stock', { stock, batch });
      },
      handleKeydown(e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (this.flatNavigableList.length > 0) {
            this.selectedIndex = (this.selectedIndex + 1) % this.flatNavigableList.length;
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (this.flatNavigableList.length > 0) {
            this.selectedIndex = (this.selectedIndex - 1 + this.flatNavigableList.length) % this.flatNavigableList.length;
          }
        } else if (e.key === 'ArrowRight') {
          if (this.flatNavigableList.length > 0 && this.selectedIndex < this.flatNavigableList.length) {
            const current = this.flatNavigableList[this.selectedIndex];
            if (current.type === 'stock') {
              const stockId = this.getStockId(current.stock);
              const batches = this.getStockBatches(current.stock);
              if (batches.length > 1) {
                e.preventDefault();
                e.stopPropagation();
                this.expandedStockId = stockId;
              }
            }
          }
        } else if (e.key === 'ArrowLeft') {
          if (this.expandedStockId != null) {
            e.preventDefault();
            e.stopPropagation();
            this.expandedStockId = null;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (this.flatNavigableList.length > 0 && this.selectedIndex < this.flatNavigableList.length) {
            const current = this.flatNavigableList[this.selectedIndex];
            if (current.type === 'stock') {
              const batches = this.getStockBatches(current.stock);
              if (batches.length > 1 && !this.stockIdMatches(current.stock, this.expandedStockId)) {
                this.expandedStockId = this.getStockId(current.stock);
              } else {
                this.selectStockRow(current.stock, batches[0] || null);
              }
            } else if (current.type === 'batch') {
              this.selectStockRow(current.stock, current.batch);
            }
          } else {
            this.$emit('register-new', this.searchQuery);
          }
        } else if (e.key === 'Insert' || e.key === 'F5' || (e.altKey && e.key.toLowerCase() === 'c') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('register-new', this.searchQuery);
        } else if (e.key === 'F3' || ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'e')) {
          e.preventDefault();
          e.stopPropagation();
          if (this.flatNavigableList.length > 0 && this.selectedIndex < this.flatNavigableList.length) {
            const item = this.flatNavigableList[this.selectedIndex];
            this.$emit('edit-stock', item.stock);
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          if (this.expandedStockId != null) {
            this.expandedStockId = null;
          } else {
            this.$emit('close');
          }
        }
      }
    },
    mounted() {
      this._windowKeyHandler = (e) => {
        if (!this.show) return;
        this.handleKeydown(e);
      };
      window.addEventListener('keydown', this._windowKeyHandler, true);
    },
    beforeUnmount() {
      if (this._windowKeyHandler) {
        window.removeEventListener('keydown', this._windowKeyHandler, true);
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-2xs" style="z-index: 60;" @click.self="$emit('close')">
        <div 
          class="stock-selector-modal bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh] animate-scale-in"
        >
          <!-- Modal Header -->
          <div class="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-between items-center shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 class="text-sm font-black text-slate-800 dark:text-zinc-100 uppercase tracking-wider">
                  {{ mode === 'purchase' ? 'Select Purchase Item / Stock Catalog (F2)' : 'Select Sales Item / Stock Catalog (F2)' }}
                </h3>
              </div>
              <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                Navigate: ↑↓ • Expand Batches: → • Select: Enter • New Item: Insert / F5 • Edit: F3 / Alt+E • Close: ESC
              </p>
            </div>
            <button 
              type="button" 
              @click="$emit('close')" 
              class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 text-lg font-bold cursor-pointer"
              title="Close (ESC)"
            >
              &times;
            </button>
          </div>

          <!-- Search Filter Bar -->
          <div class="p-4 border-b border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3 shrink-0">
            <div class="relative flex-1">
              <input 
                ref="searchInput"
                v-model="searchQuery" 
                type="text" 
                placeholder="Search by Item name, Part No, OEM, HSN or Category... (Type to filter)" 
                class="w-full bg-slate-50 dark:bg-zinc-800 border-2 border-blue-500 rounded-2xl pl-10 pr-4 py-2 text-xs font-bold text-slate-800 dark:text-zinc-200 outline-none shadow-2xs"
              />
              <span class="absolute left-3.5 top-2.5 text-blue-500">
                🔍
              </span>
            </div>
            <span class="text-xs font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
              Showing {{ filteredStocks.length }} SKUs
            </span>
          </div>

          <!-- Table Body -->
          <div class="flex-1 overflow-y-auto p-0 custom-scrollbar">
            <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800 border-collapse">
              <thead class="sticky top-0 bg-slate-50/95 dark:bg-zinc-800/95 backdrop-blur-xs z-10">
                <tr class="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-wider">
                  <th class="py-2.5 px-4 w-12 text-center">Type</th>
                  <th class="py-2.5 px-4">Item Identity / Specifications</th>
                  <th class="py-2.5 px-3">Category</th>
                  <th class="py-2.5 px-3">HSN</th>
                  <th class="py-2.5 px-3 text-right">Available Qty</th>
                  <th class="py-2.5 px-3 text-right">Base Cost</th>
                  <th class="py-2.5 px-3 text-right">Sale Rate</th>
                  <th class="py-2.5 px-3 text-center">GST %</th>
                  <th class="py-2.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                <template v-for="stock in filteredStocks" :key="getStockId(stock) || stock.item">
                  <tr 
                    @click="toggleStock(stock)"
                    :class="{
                      'active-stock-row bg-blue-600 text-white font-bold shadow-md': isStockSelected(stock),
                      'hover:bg-slate-50/80 dark:hover:bg-zinc-800/60': !isStockSelected(stock)
                    }"
                    class="transition-colors cursor-pointer group"
                  >
                    <td class="py-2.5 px-4 text-center">
                      <span v-if="getStockBatches(stock).length > 1" class="text-xs font-bold" :class="isStockSelected(stock) ? 'text-white' : (stockIdMatches(stock, expandedStockId) ? 'text-amber-400' : 'text-blue-500')">
                        {{ stockIdMatches(stock, expandedStockId) ? '▼' : '▶' }}
                      </span>
                      <span v-else class="text-[10px] font-black" :class="isStockSelected(stock) ? 'text-blue-100' : 'opacity-60'">
                        {{ stock.itemType === 'SERVICE' ? 'SRV' : 'GDS' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-4">
                      <div class="font-bold flex items-center gap-2">
                        <span>{{ stock.item }}</span>
                        <span v-if="getStockBatches(stock).length > 1" class="text-[9px] px-1.5 py-0.2 rounded-full border" :class="isStockSelected(stock) ? 'bg-blue-800 text-white border-blue-400' : 'bg-indigo-100 text-indigo-700 border-indigo-200'">
                          {{ getStockBatches(stock).length }} Batches
                        </span>
                      </div>
                      <div class="text-[10px] flex items-center gap-2 mt-0.5" :class="isStockSelected(stock) ? 'text-blue-100' : 'opacity-75'">
                        <span v-if="stock.pno">P/N: {{ stock.pno }}</span>
                        <span v-if="stock.oem">OEM: {{ stock.oem }}</span>
                      </div>
                    </td>
                    <td class="py-2.5 px-3" :class="isStockSelected(stock) ? 'text-blue-100' : 'opacity-80'">{{ stock.category || 'General' }}</td>
                    <td class="py-2.5 px-3 font-mono" :class="isStockSelected(stock) ? 'text-blue-100' : 'opacity-80'">{{ stock.hsn || '-' }}</td>
                    <td class="py-2.5 px-3 text-right font-black">
                      <span :class="Number(stock.qty) <= 0 ? (isStockSelected(stock) ? 'text-amber-200' : 'text-rose-500') : ''">
                        {{ stock.qty || 0 }} {{ stock.uom || 'PCS' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right font-mono" :class="isStockSelected(stock) ? 'text-blue-100' : ''">{{ formatCurrency(stock.cost_rate || stock.rate) }}</td>
                    <td class="py-2.5 px-3 text-right font-mono font-bold" :class="isStockSelected(stock) ? 'text-white' : ''">{{ formatCurrency(stock.sale_rate || stock.rate) }}</td>
                    <td class="py-2.5 px-3 text-center">
                      <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold" :class="isStockSelected(stock) ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'">
                        {{ stock.grate !== undefined ? stock.grate : 18 }}%
                      </span>
                    </td>
                    <td class="py-2.5 px-4 text-center">
                      <button 
                        type="button" 
                        @click.stop="toggleStock(stock)"
                        class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                        :class="isStockSelected(stock) ? 'bg-white text-blue-700 hover:bg-blue-50' : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white'"
                      >
                        {{ getStockBatches(stock).length > 1 ? (stockIdMatches(stock, expandedStockId) ? 'Collapse' : 'Batches') : 'Select' }}
                      </button>
                    </td>
                  </tr>

                  <!-- Expanded Batches Sub-table -->
                  <tr v-if="stockIdMatches(stock, expandedStockId) && getStockBatches(stock).length > 1" class="bg-indigo-50/40 dark:bg-zinc-950/40">
                    <td colspan="9" class="p-3 pl-12 pr-6">
                      <div class="border border-indigo-200 dark:border-indigo-900 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                        <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800">
                          <thead class="bg-indigo-100/50 dark:bg-indigo-950/50 text-[9px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-widest">
                            <tr>
                              <th class="py-1.5 px-3">Batch Identifier</th>
                              <th class="py-1.5 px-3 text-right">Available Qty</th>
                              <th class="py-1.5 px-3 text-right">Cost Rate</th>
                              <th class="py-1.5 px-3 text-right">Sale Rate</th>
                              <th class="py-1.5 px-3">Expiry Date</th>
                              <th class="py-1.5 px-3 text-center">Select Batch</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                            <tr 
                              v-for="b in getStockBatches(stock)" 
                              :key="b.batch"
                              @click.stop="selectStockRow(stock, b)"
                              :class="{
                                'active-stock-row bg-indigo-600 text-white font-bold': isBatchSelected(stock, b),
                                'hover:bg-indigo-50/60 dark:hover:bg-zinc-800/50 text-slate-700 dark:text-zinc-300': !isBatchSelected(stock, b)
                              }"
                              class="transition-colors cursor-pointer"
                            >
                              <td class="py-1.5 px-3 font-mono font-bold">{{ b.batch }}</td>
                              <td class="py-1.5 px-3 text-right font-black">{{ b.qty }} {{ b.uom || stock.uom || 'PCS' }}</td>
                              <td class="py-1.5 px-3 text-right font-mono">{{ formatCurrency(b.rate) }}</td>
                              <td class="py-1.5 px-3 text-right font-mono font-bold">{{ formatCurrency(b.sale_rate || b.rate) }}</td>
                              <td class="py-1.5 px-3 text-[10px]">{{ formatDate(b.expiry) }}</td>
                              <td class="py-1.5 px-3 text-center">
                                <button 
                                  type="button" 
                                  class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors"
                                  :class="isBatchSelected(stock, b) ? 'bg-white text-indigo-700 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'"
                                >
                                  Pick
                                </button>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                </template>
                <tr v-if="filteredStocks.length === 0">
                  <td colspan="9" class="px-5 py-8 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                    No stock items match "{{ searchQuery }}". Press Enter / Insert to register.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- High-Fidelity Footer -->
          <div class="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-between items-center shrink-0">
            <button 
              type="button" 
              @click="$emit('register-new', searchQuery)" 
              class="group flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white px-4 py-1.5 rounded-xl transition-all duration-300 cursor-pointer"
              title="Register New Item Master (Insert / Ctrl+N)"
            >
              <div class="w-6 h-6 bg-white/50 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors shadow-sm font-black text-xs">
                +
              </div>
              <span class="text-[10px] font-black uppercase tracking-widest">+ Register New Stock Item (F5 / Ctrl+N / Insert)</span>
            </button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="$emit('add-blank')"
                class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                + Add Blank Row (F5)
              </button>
              <button 
                type="button" 
                @click="$emit('close')" 
                class="px-4 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 text-slate-500 dark:text-zinc-400 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer"
              >
                Close (ESC)
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };

  global.InvoiceStockSelectorModal = InvoiceStockSelectorModal;
})(window);
