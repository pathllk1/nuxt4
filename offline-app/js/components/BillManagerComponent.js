// components/BillManagerComponent.js
(function (global) {
  'use strict';

  const BillManagerComponent = {
    props: {
      bills: { type: Array, default: () => [] },
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
    methods: {
      formatCurrency(val) {
        return global.Formatters ? global.Formatters.formatCurrency(val) : '₹' + Number(val).toFixed(2);
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
        if (type === 'SALES') return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (type === 'PURCHASE') return 'bg-blue-100 text-blue-800 border-blue-300';
        if (type === 'CREDIT_NOTE') return 'bg-teal-100 text-teal-800 border-teal-300';
        if (type === 'DEBIT_NOTE') return 'bg-amber-100 text-amber-800 border-amber-300';
        if (type === 'DELIVERY_NOTE') return 'bg-sky-100 text-sky-800 border-sky-300';
        return 'bg-purple-100 text-purple-800 border-purple-300';
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

          <!-- Quick Action Navigation Links (Matching Nuxt 4 bills.vue line 16-55) -->
          <div class="flex flex-wrap items-center gap-1.5 shrink-0">
            <!-- + Goods Sale -->
            <button
              type="button"
              @click="$emit('create-sale', 'GOODS')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-2xs transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>+ Goods Sale</span>
            </button>

            <!-- + Service Sale -->
            <button
              type="button"
              @click="$emit('create-sale', 'SERVICE')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>+ Service Sale</span>
            </button>

            <!-- + Goods Purchase -->
            <button
              type="button"
              @click="$emit('create-purchase', 'GOODS')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>+ Goods Purchase</span>
            </button>

            <!-- + Service Purchase -->
            <button
              type="button"
              @click="$emit('create-purchase', 'SERVICE')"
              class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <span>+ Service Purchase</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Bar (Matching Nuxt 4 bills.vue lines 58-105) -->
        <div class="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 w-full">
          <div class="flex flex-wrap items-center gap-2 flex-1">
            <!-- Bill Type Select -->
            <select
              :value="selectedType"
              @change="$emit('update:selectedType', $event.target.value)"
              class="bg-white border border-slate-300 rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500 shadow-2xs cursor-pointer"
            >
              <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>

            <!-- Search Input -->
            <div class="relative flex-1 min-w-[220px]">
              <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                :value="searchQuery"
                @input="$emit('update:searchQuery', $event.target.value)"
                placeholder="Search party, GSTIN, bill or ref no..."
                class="w-full bg-white border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
              />
            </div>

            <!-- 1-Click Tax Breakup Toggle (Matching Nuxt 4 lines 84-95) -->
            <button
              type="button"
              @click="toggleTaxBreakup"
              :class="isTaxBreakupActive ? 'bg-blue-600 text-white font-bold' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
              class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs border transition-all cursor-pointer shadow-2xs"
            >
              <svg class="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              <span>{{ isTaxBreakupActive ? 'Tax Split Active' : 'Show Tax Split' }}</span>
            </button>

            <!-- Excel Export Register -->
            <button
              type="button"
              @click="$emit('export-excel')"
              class="inline-flex items-center px-2.5 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 shadow-2xs transition-all cursor-pointer"
            >
              <svg class="w-3.5 h-3.5 mr-1 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        <!-- Vouchers Register Table -->
        <div class="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden w-full">
          <div class="overflow-x-auto w-full">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-100/80 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                  <th class="py-2.5 px-3 whitespace-nowrap">Voucher No</th>
                  <th class="py-2.5 px-3 whitespace-nowrap">Date</th>
                  <th class="py-2.5 px-3 whitespace-nowrap">Type / Mode</th>
                  <th class="py-2.5 px-3 min-w-[220px]">Party Details</th>
                  <th v-if="visibleCols.taxable" class="py-2.5 px-3 text-right whitespace-nowrap">Taxable Amount</th>
                  <th v-if="visibleCols.cgst" class="py-2.5 px-3 text-right whitespace-nowrap">CGST</th>
                  <th v-if="visibleCols.sgst" class="py-2.5 px-3 text-right whitespace-nowrap">SGST</th>
                  <th v-if="visibleCols.igst" class="py-2.5 px-3 text-right whitespace-nowrap">IGST</th>
                  <th v-if="visibleCols.totalTax" class="py-2.5 px-3 text-right whitespace-nowrap">Total Tax</th>
                  <th class="py-2.5 px-3 text-right whitespace-nowrap font-bold text-slate-900">Net Total</th>
                  <th class="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                  <th class="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr
                  v-for="b in bills"
                  :key="b.id"
                  class="hover:bg-slate-50 transition-colors group"
                >
                  <!-- Voucher No -->
                  <td class="py-2 px-3 font-mono font-bold text-blue-700 whitespace-nowrap">
                    {{ b.bno }}
                    <span v-if="b.supplierBillNo" class="block text-[10px] text-slate-400 font-normal">
                      Sup: {{ b.supplierBillNo }}
                    </span>
                    <span v-if="b.refBillNo" class="block text-[10px] text-amber-600 font-normal">
                      Ref: {{ b.refBillNo }}
                    </span>
                  </td>

                  <!-- Date -->
                  <td class="py-2 px-3 whitespace-nowrap text-slate-600">
                    {{ b.bdate }}
                  </td>

                  <!-- Type Badge -->
                  <td class="py-2 px-3 whitespace-nowrap">
                    <span
                      :class="getBillTypeBadge(b.btype)"
                      class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider"
                    >
                      {{ b.btype.replace('_', ' ') }}
                    </span>
                  </td>

                  <!-- Party Details -->
                  <td class="py-2 px-3">
                    <div class="font-bold text-slate-900">{{ b.partyName }}</div>
                    <div class="text-[10px] text-slate-500 font-mono">
                      <span>GSTIN: {{ b.partyGstin || 'UNREGISTERED' }}</span>
                      <span v-if="b.vehicleNo" class="ml-1.5 text-slate-400">&bull; {{ b.vehicleNo }}</span>
                    </div>
                  </td>

                  <!-- Tax Breakup Columns -->
                  <td v-if="visibleCols.taxable" class="py-2 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                    {{ formatCurrency(b.taxableTotal) }}
                  </td>
                  <td v-if="visibleCols.cgst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.cgst) }}
                  </td>
                  <td v-if="visibleCols.sgst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.sgst) }}
                  </td>
                  <td v-if="visibleCols.igst" class="py-2 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                    {{ formatCurrency(b.igst) }}
                  </td>
                  <td v-if="visibleCols.totalTax" class="py-2 px-3 text-right font-mono text-slate-800 font-bold whitespace-nowrap">
                    {{ formatCurrency((Number(b.cgst) || 0) + (Number(b.sgst) || 0) + (Number(b.igst) || 0)) }}
                  </td>

                  <!-- Net Total -->
                  <td class="py-2 px-3 text-right font-black text-emerald-700 whitespace-nowrap text-sm">
                    {{ formatCurrency(b.netTotal) }}
                  </td>

                  <!-- Status -->
                  <td class="py-2 px-3 text-center whitespace-nowrap">
                    <span class="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                      {{ b.status || 'ACTIVE' }}
                    </span>
                  </td>

                  <!-- Actions -->
                  <td class="py-2 px-3 text-right whitespace-nowrap">
                    <div class="flex items-center justify-end space-x-1">
                      <!-- Sales/Purchase Return Trigger -->
                      <button
                        v-if="b.btype === 'SALES' || b.btype === 'PURCHASE'"
                        type="button"
                        @click="$emit('create-return', b)"
                        title="Create Return (Credit/Debit Note)"
                        class="px-2 py-0.5 rounded text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                      >
                        Return
                      </button>

                      <!-- PDF -->
                      <button
                        type="button"
                        @click="$emit('download-pdf', b)"
                        title="Download Vector PDF Tax Invoice"
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer"
                      >
                        PDF
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
                <tr v-if="!loading && (!bills || bills.length === 0)">
                  <td colspan="12" class="py-12 text-center text-slate-400 bg-white">
                    <p class="text-xs font-bold text-slate-700">No vouchers registered</p>
                    <p class="text-[11px] mt-0.5">Use "+ Goods Sale" or "+ Goods Purchase" above to generate your first bill.</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `
  };

  global.BillManagerComponent = BillManagerComponent;
})(window);
