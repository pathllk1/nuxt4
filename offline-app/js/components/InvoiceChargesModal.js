// components/InvoiceChargesModal.js
(function (global) {
  'use strict';

  const InvoiceChargesModal = {
    props: {
      show: { type: Boolean, default: false },
      charges: { type: Array, default: () => [] }
    },
    emits: ['close', 'update:charges', 'add-row', 'remove-row'],
    watch: {
      show(isOpen) {
        if (isOpen) {
          this.focusFirstInput();
        }
      }
    },
    methods: {
      focusFirstInput() {
        const tryFocus = () => {
          const input = this.$el.querySelector('input');
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
      },
      addRow() {
        this.$emit('add-row');
      },
      removeRow(idx) {
        this.$emit('remove-row', idx);
      },
      onEnter(e) {
        const nav = global.useKeyboardNavigation ? global.useKeyboardNavigation() : null;
        const container = (e.target && e.target.closest('.charges-container')) || this.$el.querySelector('.charges-container');
        if (container && nav) {
          nav.handleEnterKey(e, container, () => {
            this.addRow();
            this.$nextTick(() => {
              const inputs = nav.getFocusableInputs(container);
              if (inputs.length > 0) {
                const target = inputs[inputs.length - 3] || inputs[inputs.length - 1];
                if (target) {
                  target.focus();
                  if (target.select) target.select();
                }
              }
            });
          });
        }
      },
      onBackspace(e) {
        const nav = global.useKeyboardNavigation ? global.useKeyboardNavigation() : null;
        const container = (e.target && e.target.closest('.charges-container')) || this.$el.querySelector('.charges-container');
        if (container && nav) nav.handleBackspaceKey(e, container);
      },
      handleKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('close');
        } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
          e.preventDefault();
          e.stopPropagation();
          this.addRow();
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
      <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="$emit('close')">
        <div class="other-charges-modal bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div>
              <h3 class="text-sm font-black text-slate-900 uppercase">Other Charges (F4)</h3>
              <p class="text-[10px] text-slate-500">Freight, Packing, Insurance & Delivery charges with GST</p>
            </div>
            <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer" title="Close (ESC)">&times;</button>
          </div>
          <div class="charges-container p-4 space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
            <div v-for="(ch, cIdx) in charges" :key="cIdx" class="flex items-center gap-2">
              <input 
                type="text" 
                v-model="ch.label" 
                placeholder="Charge description" 
                class="flex-1 bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold outline-none focus:border-blue-500" 
                @keydown.enter.prevent="onEnter($event)" 
                @keydown.backspace="onBackspace($event)" 
              />
              <input 
                type="number" 
                step="any" 
                v-model="ch.amount" 
                placeholder="Amount (₹)" 
                class="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs font-bold text-right outline-none focus:border-blue-500" 
                @keydown.enter.prevent="onEnter($event)" 
                @keydown.backspace="onBackspace($event)" 
              />
              <select 
                v-model="ch.grate" 
                class="w-20 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold outline-none focus:border-blue-500 cursor-pointer" 
                @keydown.enter.prevent="onEnter($event)" 
                @keydown.backspace="onBackspace($event)"
              >
                <option :value="0">0%</option>
                <option :value="5">5%</option>
                <option :value="12">12%</option>
                <option :value="18">18%</option>
                <option :value="28">28%</option>
              </select>
              <button 
                type="button" 
                @click="removeRow(cIdx)" 
                class="text-rose-500 font-bold px-1.5 cursor-pointer hover:bg-rose-50 rounded" 
                title="Remove"
              >
                &times;
              </button>
            </div>

            <button
              type="button"
              @click="addRow"
              class="px-3 py-1 rounded text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 cursor-pointer transition-colors"
            >
              + Add Charge Row (Insert)
            </button>
          </div>
          <div class="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <span class="text-[10px] text-slate-400 font-bold hidden sm:inline">ENTER: Next • INSERT: Add Row • ESC: Close</span>
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              Done (ESC)
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.InvoiceChargesModal = InvoiceChargesModal;
})(window);
