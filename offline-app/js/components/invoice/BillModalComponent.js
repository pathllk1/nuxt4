// components/BillModalComponent.js
(function (global) {
  'use strict';

  const BillModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      parties: { type: Array, default: () => [] },
      stocks: { type: Array, default: () => [] }
    },
    emits: ['close', 'save-bill'],
    data() {
      return {
        form: {
          btype: 'SALES',
          bno: '',
          bdate: new Date().toISOString().split('T')[0],
          partyId: '',
          partyName: '',
          partyGstin: '',
          partyStateCode: '27',
          vehicleNo: '',
          dispatchThrough: '',
          orderNo: '',
          refBillNo: '',
          narration: ''
        },
        items: [
          { stockId: '', item: '', hsn: '', qty: 1, uom: 'PCS', rate: 0, disc: 0, grate: 18, taxable: 0, total: 0 }
        ]
      };
    },
    watch: {
      show(val) {
        if (val) {
          this.resetForm();
        }
      }
    },
    computed: {
      isInterState() {
        return this.form.partyStateCode && this.form.partyStateCode !== '27';
      },
      computedTotals() {
        if (!global.TaxCalculator) return { taxableTotal: 0, cgst: 0, sgst: 0, igst: 0, netTotal: 0 };
        return global.TaxCalculator.calculateBillTotals(this.items, this.isInterState);
      }
    },
    methods: {
      resetForm() {
        this.form = {
          btype: 'SALES',
          bno: '',
          bdate: new Date().toISOString().split('T')[0],
          partyId: '',
          partyName: '',
          partyGstin: '',
          partyStateCode: '27',
          vehicleNo: '',
          dispatchThrough: '',
          orderNo: '',
          refBillNo: '',
          narration: ''
        };
        this.items = [
          { stockId: '', item: '', hsn: '', qty: 1, uom: 'PCS', rate: 0, disc: 0, grate: 18, taxable: 0, total: 0 }
        ];
      },
      onPartyChange() {
        const p = this.parties.find((item) => item.id === Number(this.form.partyId));
        if (p) {
          this.form.partyName = p.name;
          this.form.partyGstin = p.gstin || '';
          this.form.partyStateCode = p.stateCode || '27';
        }
        this.recalculateAllRows();
      },
      onItemSelect(idx) {
        const row = this.items[idx];
        const s = this.stocks.find((stock) => stock.id === Number(row.stockId));
        if (s) {
          row.item = s.item;
          row.hsn = s.hsn || '';
          row.uom = s.uom || 'PCS';
          row.rate = this.form.btype === 'PURCHASE' ? (s.cost_rate || s.rate) : s.rate;
          row.grate = s.grate || 18;
          this.recalculateRow(idx);
        }
      },
      recalculateRow(idx) {
        const row = this.items[idx];
        if (!global.TaxCalculator) return;
        const calc = global.TaxCalculator.calculateItemTax(
          row.qty,
          row.rate,
          row.disc || 0,
          row.grate || 18,
          this.isInterState
        );
        row.taxable = calc.taxable;
        row.cgst = calc.cgst;
        row.sgst = calc.sgst;
        row.igst = calc.igst;
        row.total = calc.lineTotal;
      },
      recalculateAllRows() {
        this.items.forEach((_, idx) => this.recalculateRow(idx));
      },
      addRow() {
        this.items.push({
          stockId: '',
          item: '',
          hsn: '',
          qty: 1,
          uom: 'PCS',
          rate: 0,
          disc: 0,
          grate: 18,
          taxable: 0,
          total: 0
        });
      },
      removeRow(idx) {
        if (this.items.length > 1) {
          this.items.splice(idx, 1);
        }
      },
      submitBill() {
        if (!this.form.partyName && !this.form.partyId) {
          if (this.$notify) this.$notify('Please select or specify a party', 'warning');
          return;
        }

        const validItems = this.items.filter((it) => it.item && Number(it.qty) > 0);
        if (!validItems.length) {
          if (this.$notify) this.$notify('Please add at least one valid item with positive quantity', 'warning');
          return;
        }

        const totals = this.computedTotals;
        const billPayload = {
          ...this.form,
          taxableTotal: totals.taxableTotal,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          roundOff: totals.roundOff,
          netTotal: totals.netTotal
        };

        this.$emit('save-bill', {
          bill: billPayload,
          items: validItems
        });
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-slate-900/40 backdrop-blur-xs" style="z-index: 60;" @click.self="$emit('close')" @keydown.esc="$emit('close')">
        <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-4xl p-4 sm:p-5 shadow-2xl text-slate-800 max-h-[92vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 shrink-0">
            <div class="flex items-center space-x-2">
              <span class="w-3 h-3 rounded-full bg-blue-600"></span>
              <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                Create {{ form.btype.replace('_', ' ') }} Voucher
              </h3>
            </div>
            <button
              type="button"
              @click="$emit('close')"
              class="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Form Body (Scrollable) -->
          <div class="overflow-y-auto flex-1 pr-1 py-3 space-y-3">
            <!-- Row 1: Type, Voucher No, Date -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Voucher Type *</label>
                <select
                  v-model="form.btype"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="SALES">Sales Invoice (Goods)</option>
                  <option value="PURCHASE">Purchase Bill (Goods)</option>
                  <option value="CREDIT_NOTE">Credit Note (Sales Return)</option>
                  <option value="DEBIT_NOTE">Debit Note (Purchase Return)</option>
                  <option value="DELIVERY_NOTE">Delivery Challan (Dispatch)</option>
                  <option value="PROFORMA">Proforma Invoice</option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Voucher / Bill No</label>
                <input
                  type="text"
                  v-model="form.bno"
                  placeholder="Auto-Generated if empty"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Voucher Date *</label>
                <input
                  type="date"
                  v-model="form.bdate"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <!-- Row 2: Party Selection & Transport -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Select Party / Customer *</label>
                <select
                  v-model="form.partyId"
                  @change="onPartyChange"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">-- Choose Party --</option>
                  <option v-for="p in parties" :key="p.id" :value="p.id">
                    {{ p.name }} ({{ p.stateCode === '27' ? 'Intra-State' : 'Inter-State' }})
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Vehicle No</label>
                <input
                  type="text"
                  v-model="form.vehicleNo"
                  placeholder="e.g. MH-04-AB-1234"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs uppercase font-mono text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label class="block text-[11px] font-bold text-slate-700 mb-0.5">Order Ref / Linked Bill</label>
                <input
                  type="text"
                  v-model="form.orderNo"
                  placeholder="e.g. PO-8921"
                  class="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <!-- Line Items Table -->
            <div class="border border-slate-200 rounded-lg overflow-hidden">
              <div class="bg-slate-100 px-3 py-1.5 flex items-center justify-between border-b border-slate-200">
                <span class="text-[11px] font-bold text-slate-700 uppercase">Itemized Products & Quantities</span>
                <button
                  type="button"
                  @click="addRow"
                  class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
                >
                  + Add Row
                </button>
              </div>

              <div class="overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                  <thead class="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                    <tr>
                      <th class="py-1.5 px-2">Stock Item</th>
                      <th class="py-1.5 px-2 w-20">HSN</th>
                      <th class="py-1.5 px-2 w-16">Qty</th>
                      <th class="py-1.5 px-2 w-16">Unit</th>
                      <th class="py-1.5 px-2 w-20">Rate (₹)</th>
                      <th class="py-1.5 px-2 w-16">GST%</th>
                      <th class="py-1.5 px-2 w-24 text-right">Taxable</th>
                      <th class="py-1.5 px-2 w-24 text-right">Total (₹)</th>
                      <th class="py-1.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(row, idx) in items" :key="idx" class="hover:bg-slate-50">
                      <!-- Stock Dropdown / Custom Item -->
                      <td class="py-1 px-2 min-w-[180px]">
                        <select
                          v-model="row.stockId"
                          @change="onItemSelect(idx)"
                          class="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-800"
                        >
                          <option value="">Select or Type Below</option>
                          <option v-for="s in stocks" :key="s.id" :value="s.id">
                            {{ s.item }} (Stock: {{ s.qty }})
                          </option>
                        </select>
                        <input
                          type="text"
                          v-model="row.item"
                          placeholder="Custom item name"
                          class="w-full bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] text-slate-700 mt-1"
                        />
                      </td>

                      <!-- HSN -->
                      <td class="py-1 px-2">
                        <input
                          type="text"
                          v-model="row.hsn"
                          class="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>

                      <!-- Qty -->
                      <td class="py-1 px-2">
                        <input
                          type="number"
                          step="any"
                          v-model="row.qty"
                          @input="recalculateRow(idx)"
                          class="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-slate-900"
                        />
                      </td>

                      <!-- UOM -->
                      <td class="py-1 px-2">
                        <input
                          type="text"
                          v-model="row.uom"
                          class="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-center uppercase"
                        />
                      </td>

                      <!-- Rate -->
                      <td class="py-1 px-2">
                        <input
                          type="number"
                          step="any"
                          v-model="row.rate"
                          @input="recalculateRow(idx)"
                          class="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-medium"
                        />
                      </td>

                      <!-- GST % -->
                      <td class="py-1 px-2">
                        <select
                          v-model="row.grate"
                          @change="recalculateRow(idx)"
                          class="w-full bg-white border border-slate-300 rounded px-1 py-1 text-xs"
                        >
                          <option :value="0">0%</option>
                          <option :value="5">5%</option>
                          <option :value="12">12%</option>
                          <option :value="18">18%</option>
                          <option :value="28">28%</option>
                        </select>
                      </td>

                      <!-- Taxable -->
                      <td class="py-1 px-2 text-right font-medium text-slate-700">
                        ₹{{ Number(row.taxable || 0).toFixed(2) }}
                      </td>

                      <!-- Line Total -->
                      <td class="py-1 px-2 text-right font-extrabold text-emerald-700">
                        ₹{{ Number(row.total || 0).toFixed(2) }}
                      </td>

                      <!-- Delete Row -->
                      <td class="py-1 px-2 text-center">
                        <button
                          type="button"
                          @click="removeRow(idx)"
                          class="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                        >
                          &times;
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Totals & Tax Split Card -->
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div class="text-xs text-slate-600 space-y-1">
                <div>
                  <strong>Tax Regime:</strong>
                  <span class="ml-1 px-2 py-0.5 rounded text-[11px] font-bold" :class="isInterState ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'">
                    {{ isInterState ? 'Inter-State (IGST Applied)' : 'Intra-State (CGST + SGST Applied)' }}
                  </span>
                </div>
                <div class="text-[11px] text-slate-500">
                  Taxable: ₹{{ computedTotals.taxableTotal }} | Total Tax: ₹{{ computedTotals.totalTax }}
                </div>
              </div>

              <!-- Net Total Badge -->
              <div class="bg-white border border-slate-300 rounded-lg p-2.5 shadow-2xs text-right">
                <span class="text-[10px] font-bold text-slate-500 uppercase block">Calculated Net Total</span>
                <span class="text-xl font-extrabold text-emerald-600">₹{{ computedTotals.netTotal.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-200 shrink-0">
            <button
              type="button"
              @click="$emit('close')"
              class="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="submitBill"
              class="px-4 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
            >
              Save & Synchronize Stocks
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.BillModalComponent = BillModalComponent;
})(window);
