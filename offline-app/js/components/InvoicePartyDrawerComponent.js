// components/InvoicePartyDrawerComponent.js
(function (global) {
  'use strict';

  const InvoicePartyDrawerComponent = {
    props: {
      show: { type: Boolean, default: false },
      parties: { type: Array, default: () => [] },
      selectedParty: { type: Object, default: null },
      mode: { type: String, default: 'sales' }
    },
    emits: ['close', 'select', 'open-quick-add'],
    data() {
      return {
        searchQuery: '',
        selectedIndex: 0
      };
    },
    computed: {
      filteredParties() {
        const q = (this.searchQuery || '').toLowerCase().trim();
        return this.parties.filter((p) => {
          if (!q) return true;
          return (
            (p.name && p.name.toLowerCase().includes(q)) ||
            (p.gstin && p.gstin.toLowerCase().includes(q)) ||
            (p.phone && p.phone.toLowerCase().includes(q)) ||
            (p.state && p.state.toLowerCase().includes(q))
          );
        });
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          this.searchQuery = '';
          this.selectedIndex = 0;
          this.focusInput();
        }
      },
      searchQuery() {
        this.selectedIndex = 0;
      },
      selectedIndex() {
        this.$nextTick(() => {
          const activeEl = this.$el.querySelector('.party-option.active, button.bg-blue-600');
          if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
        });
      }
    },
    methods: {
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
      handleKeydown(e) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          if (this.filteredParties.length > 0) {
            this.selectedIndex = (this.selectedIndex + 1) % this.filteredParties.length;
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          if (this.filteredParties.length > 0) {
            this.selectedIndex = (this.selectedIndex - 1 + this.filteredParties.length) % this.filteredParties.length;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          if (this.filteredParties.length > 0 && this.selectedIndex < this.filteredParties.length) {
            this.$emit('select', this.filteredParties[this.selectedIndex]);
          } else {
            this.$emit('open-quick-add', this.searchQuery);
          }
        } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') || (e.altKey && (e.key.toLowerCase() === 'c' || e.code === 'KeyC'))) {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('open-quick-add', this.searchQuery);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('close');
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
      <div v-if="show" class="fixed inset-0 z-[60] flex justify-end bg-slate-900/40 backdrop-blur-2xs" style="z-index: 60;" @click.self="$emit('close')">
        <div class="party-drawer w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
          <header class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-400">Records</p>
              <h2 class="text-sm font-black text-slate-900 uppercase">
                Choose {{ mode === 'purchase' ? 'Supplier' : 'Customer' }} (F3)
              </h2>
            </div>
            <div class="flex items-center space-x-2">
              <button
                type="button"
                @click="$emit('open-quick-add', searchQuery)"
                class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded cursor-pointer transition-colors"
                title="Register New Party (Insert)"
              >
                + New Party (Insert)
              </button>
              <button
                type="button"
                @click="$emit('close')"
                class="px-2.5 py-1 border border-slate-300 rounded text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
                title="Close (ESC)"
              >
                Close (ESC)
              </button>
            </div>
          </header>

          <div class="p-3 border-b border-slate-200 bg-slate-50">
            <input
              ref="searchInput"
              v-model="searchQuery"
              type="text"
              placeholder="Search party... (↑↓ Navigate • Enter Select • Insert New • ESC Close)"
              class="w-full border-2 border-blue-500 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 outline-none bg-white shadow-2xs focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div class="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
            <button
              v-for="(party, idx) in filteredParties"
              :key="party.id"
              type="button"
              @click="$emit('select', party)"
              :class="selectedIndex === idx ? 'bg-blue-600 text-white border-blue-700 shadow-sm' : 'bg-white hover:bg-blue-50/70 border-slate-200 text-slate-800'"
              class="party-option w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-1"
            >
              <div class="flex items-center justify-between">
                <strong :class="selectedIndex === idx ? 'text-white' : 'text-slate-900'" class="text-xs font-black truncate">{{ party.name }}</strong>
                <span :class="selectedIndex === idx ? 'bg-white/20 text-white border-white/30' : 'bg-amber-50 text-amber-700 border-amber-200'" class="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border">
                  {{ party.type || (mode === 'purchase' ? 'SUPPLIER' : 'CUSTOMER') }}
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px]" :class="selectedIndex === idx ? 'text-blue-100' : 'text-slate-500'">
                <span>GST: <span class="font-mono font-bold">{{ party.gstin || 'UNREGISTERED' }}</span></span>
                <span>{{ party.state || 'Maharashtra' }} ({{ party.stateCode || '27' }})</span>
              </div>
              <div v-if="party.address" class="text-[10px] truncate" :class="selectedIndex === idx ? 'text-blue-200' : 'text-slate-400'">
                {{ party.address }}
              </div>
            </button>

            <div v-if="filteredParties.length === 0" class="p-8 text-center text-xs text-slate-400">
              <p>No parties matching "<strong class="text-slate-600">{{ searchQuery }}</strong>"</p>
              <button type="button" class="mt-3 text-emerald-600 font-bold underline cursor-pointer" @click="$emit('open-quick-add', searchQuery)">
                + Register "{{ searchQuery }}" as a new party (Press Enter / Insert)
              </button>
            </div>
          </div>

          <footer class="p-2.5 border-t border-slate-200 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
            <span>↑↓ Navigate • Enter Select</span>
            <span>Insert New • ESC Close</span>
          </footer>
        </div>
      </div>
    `
  };

  global.InvoicePartyDrawerComponent = InvoicePartyDrawerComponent;
})(window);
