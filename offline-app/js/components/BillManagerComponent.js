// components/BillManagerComponent.js
(function (global) {
  'use strict';

  const BillManagerComponent = {
    components: {
      get InvoicePrintModal() { return global.InvoicePrintModal; },
      get 'invoice-print-modal'() { return global.InvoicePrintModal; }
    },
    props: {
      bills: { type: Array, default: () => [] },
      firm: { type: Object, default: () => ({}) },
      selectedType: { type: String, default: 'ALL' },
      searchQuery: { type: String, default: '' },
      loading: { type: Boolean, default: false }
    },
    emits: [
      'update:selectedType',
      'update:searchQuery',
      'create-sale',
      'create-purchase',
      'create-return',
      'download-pdf',
      'download-word',
      'delete-bill',
      'export-excel'
    ],
    data() {
      return {
        showPrintModal: false,
        activeBill: null,
        activeBillItems: [],
        selectedBillIndex: -1,
        isTaxBreakupActive: false,
        showColumnMenu: false,
        visibleCols: {
          type: true,
          status: true,
          taxable: false,
          cgst: false,
          sgst: false,
          igst: false,
          totalTax: false,
          roundOff: false,
          netTotal: true
        },
        typeOptions: [
          { label: 'All Bills & Invoices', value: 'ALL' },
          { label: 'Sales Invoices', value: 'SALES' },
          { label: 'Purchase Bills', value: 'PURCHASE' },
          { label: 'Proforma Invoices', value: 'PROFORMA' },
          { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
          { label: 'Credit Notes (Sales Return)', value: 'CREDIT_NOTE' },
          { label: 'Debit Notes (Purchase Return)', value: 'DEBIT_NOTE' }
        ]
      };
    },
    computed: {
      filteredBills() {
        let list = this.bills || [];
        const type = this.selectedType || 'ALL';
        if (type !== 'ALL') {
          list = list.filter(b => (b.btype || '').toUpperCase() === type.toUpperCase());
        }
        const q = (this.searchQuery || '').trim().toLowerCase();
        if (q) {
          list = list.filter(b => {
            const bno = (b.bno || '').toLowerCase();
            const party = (b.partyName || '').toLowerCase();
            const gstin = (b.partyGstin || '').toLowerCase();
            const date = (b.bdate || '').toLowerCase();
            return bno.includes(q) || party.includes(q) || gstin.includes(q) || date.includes(q);
          });
        }
        return list;
      }
    },
    mounted() {
      window.addEventListener('keydown', this.handleKeydown);
    },
    beforeUnmount() {
      window.removeEventListener('keydown', this.handleKeydown);
    },
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      },
      formatDate(dateStr) {
        return global.Formatters ? global.Formatters.formatDate(dateStr) : dateStr;
      },
      toggleTaxBreakup() {
        this.isTaxBreakupActive = !this.isTaxBreakupActive;
        this.visibleCols.taxable = this.isTaxBreakupActive;
        this.visibleCols.cgst = this.isTaxBreakupActive;
        this.visibleCols.sgst = this.isTaxBreakupActive;
        this.visibleCols.igst = this.isTaxBreakupActive;
        this.visibleCols.totalTax = this.isTaxBreakupActive;
      },
      getBillTypeBadge(type) {
        switch ((type || '').toUpperCase()) {
          case 'SALES': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
          case 'PURCHASE': return 'bg-blue-100 text-blue-800 border-blue-300';
          case 'CREDIT_NOTE': return 'bg-teal-100 text-teal-800 border-teal-300';
          case 'DEBIT_NOTE': return 'bg-amber-100 text-amber-800 border-amber-300';
          case 'DELIVERY_NOTE': return 'bg-sky-100 text-sky-800 border-sky-300';
          case 'PROFORMA': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
          default: return 'bg-purple-100 text-purple-800 border-purple-300';
        }
      },
      async openPrintModal(bill) {
        if (!bill) return;
        this.activeBill = bill;
        this.activeBillItems = Array.isArray(bill.items) ? [...bill.items] : [];
        this.showPrintModal = true;
        try {
          const billId = bill.id !== undefined ? bill.id : bill._id;
          if (global.WebSqlService && billId) {
            const res = await global.WebSqlService.executeSql(
              'SELECT * FROM bill_items WHERE billId = ? ORDER BY id ASC',
              [Number(billId)]
            );
            if (res && Array.isArray(res.rows) && res.rows.length > 0) {
              this.activeBillItems = res.rows;
            }
          }
        } catch (err) {
          console.error('[BillManager] Failed to load bill items for print modal:', err);
        }
      },
      handleKeydown(e) {
        if (this.showPrintModal) return;

        const inInput = e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT');
        if (inInput) return;

        const len = this.filteredBills.length;
        if (len === 0) return;

        if (e.key === 'ArrowDown') {
          if (this.selectedBillIndex < len - 1) {
            e.preventDefault();
            this.selectedBillIndex++;
            this.scrollRow(this.selectedBillIndex);
          }
        } else if (e.key === 'ArrowUp') {
          if (this.selectedBillIndex > 0) {
            e.preventDefault();
            this.selectedBillIndex--;
            this.scrollRow(this.selectedBillIndex);
          }
        } else if (e.key === 'Enter' || e.key === 'p' || e.key === 'P') {
          if (this.selectedBillIndex >= 0 && this.selectedBillIndex < len) {
            e.preventDefault();
            this.openPrintModal(this.filteredBills[this.selectedBillIndex]);
          }
        } else if (e.key === 's' || e.key === 'S' || e.key === 'Insert') {
          e.preventDefault();
          this.$emit('create-sale', 'GOODS');
        } else if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          this.$emit('create-purchase', 'GOODS');
        } else if (e.key === 'r' || e.key === 'R') {
          if (this.selectedBillIndex >= 0 && this.selectedBillIndex < len) {
            const b = this.filteredBills[this.selectedBillIndex];
            if (b && (b.btype === 'SALES' || b.btype === 'PURCHASE')) {
              e.preventDefault();
              this.$emit('create-return', b);
            }
          }
        } else if (e.key === 'Delete') {
          if (this.selectedBillIndex >= 0 && this.selectedBillIndex < len) {
            e.preventDefault();
            this.$emit('delete-bill', this.filteredBills[this.selectedBillIndex]);
          }
        } else if (e.key === 'e' || e.key === 'E') {
          e.preventDefault();
          this.$emit('export-excel');
        } else if (e.key === '/') {
          e.preventDefault();
          const searchInput = this.$el.querySelector('input[type="text"]');
          if (searchInput) {
            searchInput.focus();
            if (searchInput.select) searchInput.select();
          }
        }
      },
      scrollRow(idx) {
        this.$nextTick(() => {
          const row = this.$el.querySelector(`tbody tr[data-index="${idx}"]`);
          if (row) row.scrollIntoView({ block: 'nearest' });
        });
      }
    },
    template: `
      <div class="space-y-3 w-full text-slate-800">
        <!-- Header Section (Matching Nuxt 4 bills.vue lines 3-56) -->
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center text-white shadow-xs shrink-0">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 class="text-base sm:text-lg font-black uppercase text-slate-900 tracking-tight leading-none">
                Sales & Purchase Bills Register
              </h1>
              <p class="text-[11px] font-medium text-slate-500 mt-0.5">
                Unified register for inventory goods invoices, purchase bills, challans, and return notes
              </p>
            </div>
          </div>

          <!-- Quick Action Navigation Links -->
          <div class="flex flex-wrap items-center gap-1.5 shrink-0">
            <!-- + Goods Sale -->
            <button
              type="button"
              @click="$emit('create-sale', 'GOODS')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Goods Sale</span>
            </button>

            <!-- + Services Sale -->
            <button
              type="button"
              @click="$emit('create-sale', 'SERVICE')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>+ Services Sale</span>
            </button>

            <!-- + Goods Purchase -->
            <button
              type="button"
              @click="$emit('create-purchase', 'GOODS')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Purchase Bill</span>
            </button>

            <!-- Excel Export -->
            <button
              type="button"
              @click="$emit('export-excel')"
              title="Export Register to Excel Worksheet"
              class="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export</span>
            </button>
          </div>
        </div>

        <!-- Filters & Table Controls -->
        <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div class="p-3 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
            <div class="flex items-center space-x-2 flex-1">
              <!-- Search Bar -->
              <div class="relative flex-1 max-w-sm">
                <svg class="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  :value="searchQuery"
                  @input="$emit('update:searchQuery', $event.target.value)"
                  @keydown.esc.prevent="$event.target.blur()"
                  @keydown.down.prevent="$event.target.blur(); selectedBillIndex = 0; scrollRow(0)"
                  @keydown.enter.prevent="$event.target.blur(); if (filteredBills.length > 0) openPrintModal(filteredBills[selectedBillIndex >= 0 ? selectedBillIndex : 0])"
                  placeholder="Filter by bill no, customer/supplier name, GSTIN... (/ to focus • ESC to blur)"
                  class="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs font-medium"
                />
              </div>

              <!-- Type Filter Dropdown -->
              <select
                :value="selectedType"
                @change="$emit('update:selectedType', $event.target.value)"
                class="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer font-bold"
              >
                <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <div class="flex items-center space-x-2 shrink-0">
              <!-- Tax Breakup Toggle -->
              <button
                type="button"
                @click="toggleTaxBreakup"
                :class="isTaxBreakupActive ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer flex items-center space-x-1"
                title="Toggle detailed Tax breakdown columns (CGST, SGST, IGST)"
              >
                <span>% Tax Breakup</span>
                <span v-if="isTaxBreakupActive" class="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto w-full">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-100/80 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th class="py-2.5 px-3">Date</th>
                  <th class="py-2.5 px-3 whitespace-nowrap">Bill No</th>
                  <th v-if="visibleCols.type" class="py-2.5 px-3 whitespace-nowrap">Voucher Type</th>
                  <th class="py-2.5 px-3 min-w-[180px]">Party / Customer</th>
                  <th class="py-2.5 px-3 whitespace-nowrap">GSTIN</th>
                  <th v-if="visibleCols.taxable" class="py-2.5 px-3 text-right whitespace-nowrap">Taxable Val</th>
                  <th v-if="visibleCols.cgst" class="py-2.5 px-3 text-right whitespace-nowrap">CGST</th>
                  <th v-if="visibleCols.sgst" class="py-2.5 px-3 text-right whitespace-nowrap">SGST</th>
                  <th v-if="visibleCols.igst" class="py-2.5 px-3 text-right whitespace-nowrap">IGST</th>
                  <th v-if="visibleCols.totalTax" class="py-2.5 px-3 text-right whitespace-nowrap">Total Tax</th>
                  <th class="py-2.5 px-3 text-right whitespace-nowrap">Net Total</th>
                  <th v-if="visibleCols.status" class="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                  <th class="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="(b, idx) in filteredBills"
                  :key="b.id || idx"
                  :data-index="idx"
                  @click="selectedBillIndex = idx"
                  @dblclick="openPrintModal(b)"
                  :class="selectedBillIndex === idx ? 'bg-indigo-50/60 ring-1 ring-inset ring-indigo-500/30' : 'hover:bg-slate-50/70'"
                  class="transition-colors cursor-pointer select-none"
                >
                  <!-- Date -->
                  <td class="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                    {{ formatDate(b.bdate) }}
                  </td>

                  <!-- Bill No -->
                  <td class="py-2 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                    {{ b.bno }}
                  </td>

                  <!-- Type Badge -->
                  <td v-if="visibleCols.type" class="py-2 px-3 whitespace-nowrap">
                    <span :class="getBillTypeBadge(b.btype)" class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold border">
                      {{ b.btype }}
                    </span>
                  </td>

                  <!-- Party Name -->
                  <td class="py-2 px-3 font-semibold text-slate-900">
                    {{ b.partyName }}
                  </td>

                  <!-- GSTIN -->
                  <td class="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                    {{ b.partyGstin || 'UNREGISTERED' }}
                  </td>

                  <!-- Taxable Val -->
                  <td v-if="visibleCols.taxable" class="py-2 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                    {{ formatCurrency(b.taxableTotal || b.grossTotal) }}
                  </td>

                  <!-- CGST -->
                  <td v-if="visibleCols.cgst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.cgst) }}
                  </td>

                  <!-- SGST -->
                  <td v-if="visibleCols.sgst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.sgst) }}
                  </td>

                  <!-- IGST -->
                  <td v-if="visibleCols.igst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.igst) }}
                  </td>

                  <!-- Total Tax -->
                  <td v-if="visibleCols.totalTax" class="py-2 px-3 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                    {{ formatCurrency((Number(b.cgst || 0) + Number(b.sgst || 0) + Number(b.igst || 0))) }}
                  </td>

                  <!-- Net Total -->
                  <td class="py-2 px-3 text-right font-mono font-black text-slate-900 whitespace-nowrap">
                    {{ formatCurrency(b.netTotal) }}
                  </td>

                  <!-- Status -->
                  <td v-if="visibleCols.status" class="py-2 px-3 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {{ b.status || 'ACTIVE' }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="py-2 px-3 text-right whitespace-nowrap" @click.stop>
                    <div class="flex items-center justify-end space-x-1">
                      <!-- Print / Live Preview Modal -->
                      <button
                        type="button"
                        @click.stop.prevent="openPrintModal(b)"
                        title="Print / View Vector PDF (Enter / P)"
                        class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <span>🖨️</span>
                        <span>Print</span>
                      </button>

                      <!-- Return Trigger -->
                      <button
                        v-if="b.btype === 'SALES' || b.btype === 'PURCHASE'"
                        type="button"
                        @click="$emit('create-return', b)"
                        title="Create Return (Credit/Debit Note)"
                        class="px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                      >
                        Return
                      </button>

                      <!-- Word -->
                      <button
                        type="button"
                        @click="$emit('download-word', b)"
                        title="Download Word Document"
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                      >
                        Word
                      </button>

                      <!-- Delete -->
                      <button
                        type="button"
                        @click="$emit('delete-bill', b)"
                        title="Delete Voucher"
                        class="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>

                <!-- Empty State -->
                <tr v-if="!loading && (!filteredBills || filteredBills.length === 0)">
                  <td colspan="12" class="py-12 text-center text-slate-400 bg-white">
                    <p class="text-xs font-bold text-slate-700">No vouchers registered</p>
                    <p class="text-[11px] mt-0.5">Use "+ Goods Sale" or "+ Goods Purchase" above to generate your first bill.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Print & Export Modal Suite (Faithful Nuxt 4 Replica) -->
        <invoice-print-modal
          :show="showPrintModal"
          :bill="activeBill"
          :items="activeBillItems"
          :firm="firm"
          @close="showPrintModal = false"
          @download-excel="$emit('export-excel')"
          @download-word="(b) => $emit('download-word', activeBill)"
        ></invoice-print-modal>
      </div>
    `
  };

  global.BillManagerComponent = BillManagerComponent;
})(window);
