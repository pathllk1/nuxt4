// components/InvoicePrintModal.js
// 100% Faithful Replica of Nuxt 4 PrintConfigModal.vue & BillDetailsModal.vue
(function (global) {
  'use strict';

  const InvoicePrintModal = {
    props: {
      show: { type: Boolean, default: false },
      bill: { type: Object, default: null },
      items: { type: Array, default: () => [] },
      firm: { type: Object, default: () => ({}) }
    },
    emits: ['close', 'download-pdf', 'download-excel', 'download-word', 'print'],
    data() {
      return {
        activeTab: 'preview', // 'preview' | 'settings'
        isPrinting: false,
        isDownloadingPdf: false,
        config: {
          copyType: 'ORIGINAL FOR RECIPIENT',
          showHsn: true,
          showQty: true,
          showUom: true,
          showRate: true,
          showDisc: true,
          showGst: true,
          showBatch: true,
          showNarration: true,
          showBank: true,
          jurisdiction: '',
          signatoryTitle: 'Authorised Signatory',
          declaration: 'Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged.'
        }
      };
    },
    computed: {
      activeFirm() {
        if (this.firm) {
          const raw = this.firm.value ? this.firm.value : this.firm;
          if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) return raw;
        }
        if (global.useFirm) {
          try {
            const inst = global.useFirm();
            if (inst && inst.firm && inst.firm.value) return inst.firm.value;
          } catch (_) {}
        }
        return {};
      },
      previewHtml() {
        if (!this.bill || !global.PdfExportService) return '';
        try {
          return global.PdfExportService.generateInvoiceHtml(
            this.bill,
            this.items,
            this.activeFirm,
            this.config
          );
        } catch (err) {
          console.error('[InvoicePrintModal] Failed to generate invoice preview HTML:', err);
          return `<div style="padding: 24px; color: #b91c1c; font-family: sans-serif; font-weight: bold;">Failed to generate invoice preview: ${err.message}</div>`;
        }
      }
    },
    mounted() {
      this._globalKeyHandler = (e) => {
        if (!this.show) return;
        this.handleKeydown(e);
      };
      window.addEventListener('keydown', this._globalKeyHandler);
    },
    beforeUnmount() {
      if (this._globalKeyHandler) {
        window.removeEventListener('keydown', this._globalKeyHandler);
      }
    },
    watch: {
      show(isOpen) {
        if (isOpen) {
          const btype = (this.bill && this.bill.btype) ? String(this.bill.btype).toUpperCase() : 'SALES';
          const isPurchase = btype === 'PURCHASE';
          this.config.copyType = isPurchase ? 'ORIGINAL FOR SUPPLIER' : 'ORIGINAL FOR RECIPIENT';
          const city = (this.activeFirm && this.activeFirm.city) || '';
          this.config.jurisdiction = city ? `Subject to ${city} Jurisdiction only.` : 'Subject to local jurisdiction only.';
          this.activeTab = 'preview';

          this.$nextTick(() => {
            const el = (this.$el && this.$el.nodeType === 1) ? this.$el : document.querySelector('.print-modal-container');
            if (el) {
              const container = el.classList?.contains('print-modal-container') ? el : el.querySelector?.('.print-modal-container');
              if (container && typeof container.focus === 'function') {
                container.focus();
              }
            }
          });
        }
      }
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      setCopy(type) {
        this.config.copyType = type;
      },
      handlePrintNow() {
        if (!this.bill || !global.PdfExportService) return;
        this.isPrinting = true;
        try {
          global.PdfExportService.printInvoice(this.bill, this.items, this.activeFirm, this.config);
          this.$emit('print', this.config);
        } catch (err) {
          console.error('Print error:', err);
        } finally {
          setTimeout(() => { this.isPrinting = false; }, 600);
        }
      },
      handleDownloadPdf() {
        if (!this.bill || !global.PdfExportService) return;
        this.isDownloadingPdf = true;
        try {
          global.PdfExportService.generateInvoicePdf(this.bill, this.items, this.activeFirm, this.config);
          this.$emit('download-pdf', this.config);
        } catch (err) {
          console.error('PDF error:', err);
        } finally {
          setTimeout(() => { this.isDownloadingPdf = false; }, 400);
        }
      },
      handleDownloadExcel() {
        if (global.ExcelExportService && this.bill) {
          global.ExcelExportService.exportSingleBill(this.bill, this.items, this.activeFirm);
        }
        this.$emit('download-excel');
      },
      handleDownloadWord() {
        if (global.WordExportService && this.bill) {
          global.WordExportService.generateBillWordDoc(this.bill, this.items, null, this.activeFirm);
        }
        this.$emit('download-word');
      },
      handleKeydown(e) {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.$emit('close');
          return;
        }

        // Print: Ctrl+P or Enter (when in preview tab and not in an input)
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
          e.preventDefault();
          e.stopPropagation();
          this.handlePrintNow();
          return;
        }

        // PDF: Alt+P or P (when not typing in inputs)
        const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT');
        if (!inInput) {
          if (e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            e.stopPropagation();
            this.handleDownloadPdf();
          } else if (e.key === 'e' || e.key === 'E') {
            e.preventDefault();
            e.stopPropagation();
            this.handleDownloadExcel();
          } else if (e.key === 'w' || e.key === 'W') {
            e.preventDefault();
            e.stopPropagation();
            this.handleDownloadWord();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            this.handlePrintNow();
          } else if (e.key === '1') {
            e.preventDefault();
            e.stopPropagation();
            this.activeTab = 'preview';
          } else if (e.key === '2') {
            e.preventDefault();
            e.stopPropagation();
            this.activeTab = 'settings';
          }
        }
      }
    },
    template: `
      <div 
        v-if="show" 
        class="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" 
        style="z-index: 80;" 
        @click.self="$emit('close')"
      >
        <div 
          class="print-modal-container bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-hidden flex flex-col outline-none animate-in zoom-in-95 duration-150"
          tabindex="0"
        >
          <!-- Header -->
          <header class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-6 py-4 text-white flex justify-between items-center shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-xs">
                🖨️
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <h3 class="text-sm sm:text-base font-black uppercase tracking-tight">Print & Export Suite</h3>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    A4 Nuxt 4 Architecture
                  </span>
                </div>
                <p class="text-xs text-slate-300 font-medium mt-0.5">
                  Voucher: <strong class="text-white font-mono">{{ bill ? bill.bno : '' }}</strong> &bull; 
                  Party: <strong class="text-white">{{ bill ? bill.partyName : '' }}</strong> &bull; 
                  Total: <strong class="text-emerald-300 font-mono">{{ formatCurrency(bill ? bill.netTotal : 0) }}</strong>
                </p>
              </div>
            </div>

            <!-- Tabs Switcher & Close -->
            <div class="flex items-center gap-2">
              <div class="bg-white/10 p-1 rounded-xl flex items-center gap-1 text-xs">
                <button
                  type="button"
                  @click="activeTab = 'preview'"
                  :class="activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'"
                  class="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>👁️</span>
                  <span>A4 Preview [1]</span>
                </button>
                <button
                  type="button"
                  @click="activeTab = 'settings'"
                  :class="activeTab === 'settings' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-300 hover:text-white'"
                  class="px-3 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span>⚙️</span>
                  <span>Layout Settings [2]</span>
                </button>
              </div>

              <button 
                type="button"
                @click="$emit('close')" 
                class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg font-bold transition-colors cursor-pointer ml-1"
                title="Close (ESC)"
              >
                &times;
              </button>
            </div>
          </header>

          <!-- Body Content Area -->
          <div class="flex-1 overflow-hidden flex flex-col bg-slate-100/70 p-4">
            <!-- TAB 1: Live A4 WYSIWYG Preview -->
            <div v-show="activeTab === 'preview'" class="flex-1 flex flex-col overflow-hidden">
              <!-- Copy Quick Filter Bar -->
              <div class="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-xs mb-3 flex flex-wrap items-center justify-between gap-2 shrink-0 text-xs">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-[11px] font-black uppercase text-slate-400 mr-1">Copy Title:</span>
                  <button
                    type="button"
                    v-for="c in ['ORIGINAL FOR RECIPIENT', 'DUPLICATE FOR TRANSPORTER', 'TRIPLICATE FOR SUPPLIER', 'OFFICE COPY', '']"
                    :key="c"
                    @click="setCopy(c)"
                    :class="config.copyType === c ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
                    class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                  >
                    {{ c || 'NO COPY LABEL' }}
                  </button>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-400 font-bold hidden sm:inline">Zoom: 100% A4 Vector</span>
                </div>
              </div>

              <!-- Iframe Live Preview Container -->
              <div class="flex-1 overflow-auto bg-slate-200/90 rounded-2xl p-4 flex justify-center shadow-inner">
                <div class="bg-white shadow-2xl rounded-sm max-w-[800px] w-full min-h-[600px] overflow-hidden border border-slate-300/80">
                  <iframe 
                    :srcdoc="previewHtml" 
                    class="w-full h-full min-h-[750px] border-0" 
                    title="Live Invoice Preview"
                  ></iframe>
                </div>
              </div>
            </div>

            <!-- TAB 2: Print & Layout Settings -->
            <div v-show="activeTab === 'settings'" class="flex-1 overflow-y-auto bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-xs text-slate-800">
              <!-- 1. Copy Title & Bank Account -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block font-bold text-slate-700 mb-1.5">Invoice Copy Title Banner</label>
                  <select 
                    v-model="config.copyType" 
                    class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-bold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200"
                  >
                    <option value="ORIGINAL FOR RECIPIENT">ORIGINAL FOR RECIPIENT</option>
                    <option value="DUPLICATE FOR TRANSPORTER">DUPLICATE FOR TRANSPORTER</option>
                    <option value="TRIPLICATE FOR SUPPLIER">TRIPLICATE FOR SUPPLIER</option>
                    <option value="OFFICE COPY">OFFICE COPY</option>
                    <option value="">NO COPY LABEL (BLANK)</option>
                  </select>
                </div>

                <div>
                  <label class="block font-bold text-slate-700 mb-1.5">Beneficiary Bank Account</label>
                  <div class="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium flex items-center justify-between">
                    <div>
                      <span class="font-bold text-slate-900">{{ activeFirm.bank_name || 'Primary Bank Account' }}</span>
                      <span class="text-slate-500 font-mono text-[11px] ml-1">({{ activeFirm.bank_account_number || '-' }})</span>
                    </div>
                    <label class="flex items-center gap-1.5 cursor-pointer font-bold text-indigo-700">
                      <input type="checkbox" v-model="config.showBank" class="rounded text-indigo-600 cursor-pointer" />
                      <span>Print on Bill</span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- 2. Table Column Toggles -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <h4 class="font-black uppercase tracking-wider text-[11px] text-slate-400">Items Table Column Visibility</h4>
                  <span class="text-[10px] text-slate-400 font-bold">Toggle columns on or off</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showHsn" class="rounded text-indigo-600 cursor-pointer" />
                    <span>HSN / SAC</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showQty" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Quantity</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showUom" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Unit (UOM)</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showRate" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Unit Rate (₹)</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showDisc" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Discount %</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showGst" class="rounded text-indigo-600 cursor-pointer" />
                    <span>GST % Rate</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showBatch" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Batch Number</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                    <input type="checkbox" v-model="config.showNarration" class="rounded text-indigo-600 cursor-pointer" />
                    <span>Item Note / Narration</span>
                  </label>
                </div>
              </div>

              <!-- 3. Legal, Terms & Jurisdiction -->
              <div class="space-y-3">
                <h4 class="font-black uppercase tracking-wider text-[11px] text-slate-400">Statutory Statements & Footers</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Court Jurisdiction Statement</label>
                    <input 
                      type="text" 
                      v-model="config.jurisdiction" 
                      placeholder="e.g. Subject to Mumbai Jurisdiction only."
                      class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium outline-none focus:border-indigo-500" 
                    />
                  </div>
                  <div>
                    <label class="block font-bold text-slate-700 mb-1">Authorised Signatory Designation</label>
                    <input 
                      type="text" 
                      v-model="config.signatoryTitle" 
                      placeholder="e.g. Authorised Signatory"
                      class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium outline-none focus:border-indigo-500" 
                    />
                  </div>
                  <div class="md:col-span-2">
                    <label class="block font-bold text-slate-700 mb-1">Statutory Declaration Text</label>
                    <input 
                      type="text" 
                      v-model="config.declaration" 
                      placeholder="Declaration text..."
                      class="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-medium outline-none focus:border-indigo-500" 
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons Footer -->
          <footer class="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div class="flex items-center space-x-2 text-[11px] text-slate-500 font-bold hidden sm:flex">
              <span>Shortcuts:</span>
              <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-700">Ctrl+P / Enter</kbd> Print &bull;
              <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-700">P</kbd> PDF &bull;
              <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-700">E</kbd> Excel &bull;
              <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-700">W</kbd> Word &bull;
              <kbd class="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-slate-700">ESC</kbd> Close
            </div>

            <!-- Action Buttons Group -->
            <div class="flex items-center gap-2 ml-auto">
              <!-- Excel Button -->
              <button 
                type="button" 
                @click="handleDownloadExcel"
                class="inline-flex items-center px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Export Excel Worksheet (E)"
              >
                <span class="mr-1">📊</span>
                <span>Excel [E]</span>
              </button>

              <!-- Word Button -->
              <button 
                type="button" 
                @click="handleDownloadWord"
                class="inline-flex items-center px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Export Word Document (W)"
              >
                <span class="mr-1">📝</span>
                <span>Word [W]</span>
              </button>

              <!-- Vector PDF Download -->
              <button 
                type="button" 
                @click="handleDownloadPdf"
                :disabled="isDownloadingPdf"
                class="inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 transition-all cursor-pointer shadow-sm shadow-rose-600/20"
                title="Download Vector PDF Invoice (P)"
              >
                <span class="mr-1.5">📄</span>
                <span>Download PDF [P]</span>
              </button>

              <!-- Direct Browser Print (Paper / Save As PDF) -->
              <button 
                type="button" 
                @click="handlePrintNow"
                :disabled="isPrinting"
                class="inline-flex items-center px-4 py-1.5 rounded-xl text-xs font-black text-white bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 transition-all cursor-pointer shadow-sm shadow-indigo-600/20"
                title="Print Document or Save as PDF (Ctrl+P / Enter)"
              >
                <span class="mr-1.5">🖨️</span>
                <span>Print Document [Enter]</span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    `
  };

  global.InvoicePrintModal = InvoicePrintModal;
})(window);
