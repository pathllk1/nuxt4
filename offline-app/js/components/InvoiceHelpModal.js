// components/InvoiceHelpModal.js
(function (global) {
  'use strict';

  const InvoiceHelpModal = {
    props: {
      show: { type: Boolean, default: false }
    },
    emits: ['close'],
    watch: {
      show(isOpen) {
        if (isOpen) {
          this.$nextTick(() => {
            const btn = this.$el.querySelector('.help-modal-close-btn');
            if (btn) btn.focus();
          });
        }
      }
    },
    methods: {
      handleKeydown(e) {
        if (e.key === 'Escape') {
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
      <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-2xs p-4" style="z-index: 60;" @click.self="$emit('close')">
        <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h3 class="text-sm font-black text-slate-900 uppercase">Keyboard Shortcuts & Commands (F1)</h3>
            </div>
            <button @click="$emit('close')" class="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">&times;</button>
          </div>
          <div class="p-4 space-y-2 text-xs divide-y divide-slate-100 max-h-[70vh] overflow-y-auto custom-scrollbar">
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Select Stock Item / Open Catalog</span>
              <kbd class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-black text-[11px]">F2</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Pick Customer / Supplier Party</span>
              <kbd class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-mono font-black text-[11px]">F3</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Add Freight & Other Charges</span>
              <kbd class="px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded font-mono font-black text-[11px]">F4</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Add Blank Goods Line</span>
              <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">Shift+F5</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Add Blank Service Line</span>
              <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">F5</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Save Voucher / Finalize Invoice</span>
              <kbd class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded font-mono font-black text-[11px]">F8 / Ctrl+S</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Discard & Cancel Workspace</span>
              <kbd class="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded font-mono font-black text-[11px]">F9</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Register New Party / New Item</span>
              <kbd class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-mono font-black text-[11px]">Insert</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">View Rate & Transaction History</span>
              <kbd class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-black text-[11px]">Alt+H / F7</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Edit Selected Party</span>
              <kbd class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-mono font-black text-[11px]">Alt+E</kbd>
            </div>
            <div class="flex items-center justify-between py-1.5">
              <span class="font-bold text-slate-700">Close Open Modal / Drawer</span>
              <kbd class="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 rounded font-mono font-black text-[11px]">ESC</kbd>
            </div>
          </div>
          <div class="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              type="button"
              @click="$emit('close')"
              class="help-modal-close-btn px-4 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
            >
              Got It (ESC)
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.InvoiceHelpModal = InvoiceHelpModal;
})(window);
