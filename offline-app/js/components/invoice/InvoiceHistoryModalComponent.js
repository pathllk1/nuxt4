// components/InvoiceHistoryModalComponent.js
(function (global) {
  'use strict';

  const InvoiceHistoryModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      activeItem: { type: Object, default: null },
      selectedParty: { type: Object, default: null },
      historyRecords: { type: Array, default: () => [] },
      loading: { type: Boolean, default: false }
    },
    emits: ['close', 'apply-rate'],
    data() {
      return {
        historyFilter: 'ALL', // 'ALL' | 'PARTY'
        selectedIndex: 0
      };
    },
    computed: {
      filteredRecords() {
        if (!this.historyRecords || !this.historyRecords.length) return [];
        if (this.historyFilter === 'PARTY' && this.selectedParty) {
          const pName = (this.selectedParty.name || '').toLowerCase().trim();
          const pId = this.selectedParty.id;
          return this.historyRecords.filter((r) => {
            if (pId && r.partyId && Number(r.partyId) === Number(pId)) return true;
            return (r.party_name || '').toLowerCase().trim() === pName;
          });
        }
        return this.historyRecords;
      },
      partyHistoryCount() {
        if (!this.selectedParty || !this.historyRecords) return 0;
        const pName = (this.selectedParty.name || '').toLowerCase().trim();
        const pId = this.selectedParty.id;
        return this.historyRecords.filter((r) => {
          if (pId && r.partyId && Number(r.partyId) === Number(pId)) return true;
          return (r.party_name || '').toLowerCase().trim() === pName;
        }).length;
      }
    },
    mounted() {
      this._globalKeyHandler = (e) => {
        if (!this.show) return;
        if (e.key === 'Escape' || (e.altKey && (e.key.toLowerCase() === 'h' || e.code === 'KeyH')) || e.key === 'F7') {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal();
          return;
        }
        this.handleKeydown(e);
      };
      window.addEventListener('keydown', this._globalKeyHandler, true);
    },
    beforeUnmount() {
      if (this._globalKeyHandler) {
        window.removeEventListener('keydown', this._globalKeyHandler, true);
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          if (this.selectedParty && this.partyHistoryCount > 0) {
            this.historyFilter = 'PARTY';
          } else {
            this.historyFilter = 'ALL';
          }
          this.selectedIndex = 0;
          this.focusContainer();
        }
      },
      historyFilter() {
        this.selectedIndex = 0;
      },
      selectedIndex() {
        this.$nextTick(() => {
          const doc = (this.$el && this.$el.querySelector) ? this.$el : document;
          const activeRow = doc.querySelector('.active-history-row');
          if (activeRow && typeof activeRow.scrollIntoView === 'function') {
            activeRow.scrollIntoView({ block: 'nearest' });
          }
        });
      }
    },
    methods: {
      closeModal() {
        this.$emit('close');
      },
      formatCurrency(val) {
        return '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      focusContainer() {
        const tryFocus = () => {
          const doc = (this.$el && this.$el.querySelector) ? this.$el : document;
          const el = doc.querySelector('.history-modal-container');
          if (el && typeof el.focus === 'function') {
            el.focus();
            return true;
          }
          return false;
        };
        this.$nextTick(tryFocus);
        setTimeout(tryFocus, 25);
        setTimeout(tryFocus, 80);
        setTimeout(tryFocus, 180);
      },
      apply(rec) {
        if (!rec) return;
        this.$emit('apply-rate', rec);
      },
      handleKeydown(e) {
        const list = this.filteredRecords;

        // Quick row pick 1-9
        if (/^[1-9]$/.test(e.key)) {
          const idx = parseInt(e.key, 10) - 1;
          if (idx >= 0 && idx < list.length) {
            e.preventDefault();
            e.stopPropagation();
            this.selectedIndex = idx;
            this.apply(list[idx]);
            return;
          }
        }

        // Filter toggles
        if (e.key === 'p' || e.key === 'P') {
          if (this.selectedParty && this.partyHistoryCount > 0) {
            e.preventDefault();
            e.stopPropagation();
            this.historyFilter = 'PARTY';
          }
          return;
        }
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          e.stopPropagation();
          this.historyFilter = 'ALL';
          return;
        }
        if (e.key === 'Tab' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          if (this.selectedParty && this.partyHistoryCount > 0) {
            e.preventDefault();
            e.stopPropagation();
            this.historyFilter = this.historyFilter === 'ALL' ? 'PARTY' : 'ALL';
          }
          return;
        }

        // Navigation
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (list.length > 0) {
            this.selectedIndex = (this.selectedIndex + 1) % list.length;
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (list.length > 0) {
            this.selectedIndex = (this.selectedIndex - 1 + list.length) % list.length;
          }
          return;
        }

        // Selection
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (list.length > 0 && this.selectedIndex < list.length) {
            this.apply(list[this.selectedIndex]);
          }
          return;
        }

        // Dismiss
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.closeModal();
          return;
        }
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="closeModal">
        <div 
          class="history-modal-container bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden outline-none flex flex-col max-h-[85vh]" 
          tabindex="0"
        >
          <!-- Modal Header -->
          <div class="p-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between shrink-0">
            <div>
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                <h3 class="text-sm font-black text-slate-900 uppercase tracking-wide">Rate & Transaction History</h3>
                <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-black text-[10px]">Alt+H / F7</span>
              </div>
              <div class="mt-1 flex items-center gap-3 text-xs">
                <span class="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs">
                  📦 {{ activeItem ? activeItem.item : 'Selected Item' }}
                </span>
                <span v-if="selectedParty" class="text-slate-500 font-medium">
                  Party: <strong class="text-slate-700">{{ selectedParty.name }}</strong>
                </span>
              </div>
            </div>
            <button type="button" @click.stop.prevent="closeModal" class="text-slate-400 hover:text-slate-600 text-xl font-bold cursor-pointer leading-none p-1" title="Close (ESC)">&times;</button>
          </div>

          <!-- Filter Switch Bar -->
          <div class="px-4 py-2 border-b border-slate-100 bg-slate-100/60 flex items-center justify-between text-xs shrink-0">
            <div class="flex items-center gap-1.5">
              <button 
                type="button"
                @click="historyFilter = 'PARTY'"
                :disabled="!selectedParty || partyHistoryCount === 0"
                :class="historyFilter === 'PARTY' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 font-bold disabled:opacity-40 disabled:hover:bg-white cursor-pointer'"
                class="px-2.5 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>This Party Only</span>
                <span :class="historyFilter === 'PARTY' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'" class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold">{{ partyHistoryCount }}</span>
                <kbd :class="historyFilter === 'PARTY' ? 'text-indigo-200' : 'text-slate-400'" class="font-mono text-[9px] font-bold">[P]</kbd>
              </button>

              <button 
                type="button"
                @click="historyFilter = 'ALL'"
                :class="historyFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-xs font-black' : 'bg-white hover:bg-slate-200 text-slate-600 border border-slate-200 font-bold cursor-pointer'"
                class="px-2.5 py-1 rounded-lg text-[11px] transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>All Parties</span>
                <span :class="historyFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'" class="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold">{{ historyRecords.length }}</span>
                <kbd :class="historyFilter === 'ALL' ? 'text-indigo-200' : 'text-slate-400'" class="font-mono text-[9px] font-bold">[A]</kbd>
              </button>
            </div>

            <div class="text-[10px] text-slate-400 font-semibold hidden sm:block">
              Press <kbd class="px-1 py-0.2 bg-white border border-slate-300 rounded font-mono text-[9px] font-bold">Tab</kbd> to toggle filter
            </div>
          </div>

          <!-- Table Body -->
          <div class="p-0 overflow-y-auto flex-1 min-h-[180px] max-h-[380px] custom-scrollbar">
            <div v-if="loading" class="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
              <span class="animate-spin text-lg">⏳</span>
              <span>Fetching transaction history from local database...</span>
            </div>
            <div v-else-if="filteredRecords.length === 0" class="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
              <span class="text-slate-300 text-2xl font-bold">∅</span>
              <span class="font-bold text-slate-600">No past transactions found</span>
              <span v-if="historyFilter === 'PARTY'" class="text-[11px] text-slate-400">
                No previous records with {{ selectedParty ? selectedParty.name : 'this party' }}. Press <kbd class="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-600">A</kbd> to view all parties.
              </span>
              <span v-else class="text-[11px] text-slate-400">
                No prior sales or purchases recorded for this item.
              </span>
            </div>
            <table v-else class="w-full text-left text-xs divide-y divide-slate-100 border-collapse">
              <thead class="sticky top-0 bg-slate-50 shadow-2xs z-10">
                <tr class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <th class="py-2 px-3 text-center w-10">#</th>
                  <th class="py-2 px-2 w-16">Type</th>
                  <th class="py-2 px-2">Date</th>
                  <th class="py-2 px-2">Bill #</th>
                  <th class="py-2 px-3">Party</th>
                  <th class="py-2 px-2 text-right">Qty</th>
                  <th class="py-2 px-2 text-right">Disc %</th>
                  <th class="py-2 px-3 text-right">Rate</th>
                  <th class="py-2 px-3 text-center w-20">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr 
                  v-for="(rec, rIdx) in filteredRecords" 
                  :key="rIdx" 
                  :class="selectedIndex === rIdx ? 'active-history-row bg-indigo-600 text-white font-semibold' : 'hover:bg-slate-50/80 text-slate-700'"
                  class="transition-colors cursor-pointer group"
                  @click="apply(rec)"
                >
                  <td class="py-2 px-3 text-center">
                    <span v-if="rIdx < 9" :class="selectedIndex === rIdx ? 'bg-white/20 text-white border-white/40' : 'bg-slate-100 text-slate-600 border-slate-200'" class="px-1.5 py-0.5 rounded font-mono font-black text-[10px] border shadow-2xs">
                      {{ rIdx + 1 }}
                    </span>
                    <span v-else class="text-[10px] text-slate-400 font-mono">{{ rIdx + 1 }}</span>
                  </td>
                  <td class="py-2 px-2">
                    <span 
                      v-if="rec.btype === 'PURCHASE'"
                      :class="selectedIndex === rIdx ? 'bg-purple-200 text-purple-900' : 'bg-purple-100 text-purple-700 border border-purple-200'" 
                      class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    >
                      PUR
                    </span>
                    <span 
                      v-else
                      :class="selectedIndex === rIdx ? 'bg-sky-200 text-sky-900' : 'bg-sky-100 text-sky-700 border border-sky-200'" 
                      class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    >
                      SALE
                    </span>
                  </td>
                  <td class="py-2 px-2 whitespace-nowrap text-[11px]" :class="selectedIndex === rIdx ? 'text-indigo-100' : 'text-slate-500'">{{ rec.bdate }}</td>
                  <td class="py-2 px-2 font-mono font-bold text-[11px] whitespace-nowrap">{{ rec.bno }}</td>
                  <td class="py-2 px-3 truncate max-w-[150px]">
                    <div class="flex items-center gap-1">
                      <span class="truncate font-semibold">{{ rec.party_name }}</span>
                      <span 
                        v-if="selectedParty && ((rec.partyId && Number(rec.partyId) === Number(selectedParty.id)) || (rec.party_name && rec.party_name.toLowerCase().trim() === (selectedParty.name || '').toLowerCase().trim()))" 
                        :class="selectedIndex === rIdx ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-700 border border-amber-200'" 
                        class="px-1 py-0.2 rounded text-[8px] font-black uppercase tracking-widest shrink-0"
                        title="Matches current party"
                      >
                        ★ MATCH
                      </span>
                    </div>
                  </td>
                  <td class="py-2 px-2 text-right whitespace-nowrap text-[11px]">{{ rec.qty }} <span class="text-[9px] opacity-75">{{ rec.uom }}</span></td>
                  <td class="py-2 px-2 text-right text-[11px]" :class="selectedIndex === rIdx ? 'text-indigo-100' : 'text-slate-400'">
                    {{ Number(rec.disc) > 0 ? (rec.disc + '%') : '-' }}
                  </td>
                  <td class="py-2 px-3 text-right font-black text-xs whitespace-nowrap" :class="selectedIndex === rIdx ? 'text-white' : 'text-indigo-700'">
                    {{ formatCurrency(rec.rate) }}
                  </td>
                  <td class="py-2 px-3 text-center">
                    <button
                      type="button"
                      @click.stop="apply(rec)"
                      :class="selectedIndex === rIdx ? 'bg-white text-indigo-700 font-black shadow-sm' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-bold'"
                      class="px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider cursor-pointer transition-all"
                    >
                      Apply
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Modal Footer with Keyboard Shortcuts -->
          <div class="p-3 px-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div class="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
              <span class="flex items-center gap-1 font-bold">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 shadow-2xs">1-9</kbd>
                <span>Quick Pick</span>
              </span>
              <span class="text-slate-300">&bull;</span>
              <span class="flex items-center gap-1 font-bold">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 shadow-2xs">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span class="text-slate-300">&bull;</span>
              <span class="flex items-center gap-1 font-bold">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 shadow-2xs">Enter</kbd>
                <span>Apply Rate</span>
              </span>
              <span class="text-slate-300">&bull;</span>
              <span class="flex items-center gap-1 font-bold">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 shadow-2xs">P/A/Tab</kbd>
                <span>Filter</span>
              </span>
              <span class="text-slate-300">&bull;</span>
              <span class="flex items-center gap-1 font-bold">
                <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono font-bold text-slate-700 shadow-2xs">ESC</kbd>
                <span>Close</span>
              </span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click.stop.prevent="closeModal"
                class="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                Close (ESC)
              </button>
              <button 
                v-if="filteredRecords.length > 0"
                type="button" 
                @click="apply(filteredRecords[selectedIndex])"
                class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black transition-all cursor-pointer shadow-sm"
              >
                Apply Rate (Enter)
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };

  global.InvoiceHistoryModalComponent = InvoiceHistoryModalComponent;
})(window);
