// components/ExportModalComponent.js
(function (global) {
  'use strict';

  const ExportModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      stocks: { type: Array, default: () => [] },
      bills: { type: Array, default: () => [] }
    },
    emits: ['close'],
    methods: {
      exportStockExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportStocks(this.stocks);
        }
      },
      exportBillsExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportBills(this.bills);
        }
      },
      exportJsonBackup() {
        if (global.Formatters) {
          const payload = {
            stocks: this.stocks,
            bills: this.bills,
            exportedAt: new Date().toISOString()
          };
          global.Formatters.exportToJson(payload, `ERP_Full_Backup_${Date.now()}.json`);
        }
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-3 bg-slate-900/40 backdrop-blur-xs" style="z-index: 60;" @click.self="$emit('close')" @keydown.esc="$emit('close')">
        <div class="relative bg-white border border-slate-200 rounded-xl w-full max-w-md p-4 sm:p-5 shadow-2xl text-slate-800">
          <div class="flex items-center justify-between pb-2.5 border-b border-slate-200 mb-3">
            <h3 class="text-sm sm:text-base font-extrabold text-slate-900 flex items-center space-x-1.5">
              <span>Export & Reporting Center</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">100% Offline</span>
            </h3>
            <button @click="$emit('close')" class="text-slate-400 hover:text-slate-700 cursor-pointer">&times;</button>
          </div>

          <div class="space-y-2.5 text-xs">
            <!-- 1. Formatted Excel Stock Report (ExcelJS) -->
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between hover:bg-blue-50/40 transition-colors">
              <div>
                <h4 class="font-bold text-slate-900">Stock Inventory (.xlsx)</h4>
                <p class="text-[11px] text-slate-500">Formatted with corporate headers, cell borders & formulas via ExcelJS.</p>
              </div>
              <button
                type="button"
                @click="exportStockExcel"
                class="px-2.5 py-1.5 rounded-md text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs cursor-pointer shrink-0"
              >
                Excel
              </button>
            </div>

            <!-- 2. Formatted Bills Register (ExcelJS) -->
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between hover:bg-emerald-50/40 transition-colors">
              <div>
                <h4 class="font-bold text-slate-900">Vouchers Register (.xlsx)</h4>
                <p class="text-[11px] text-slate-500">Itemized sales, purchases, notes, and challans ledger in Excel.</p>
              </div>
              <button
                type="button"
                @click="exportBillsExcel"
                class="px-2.5 py-1.5 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs cursor-pointer shrink-0"
              >
                Excel
              </button>
            </div>

            <!-- 3. Full Database Backup (JSON) -->
            <div class="border border-slate-200 rounded-lg p-3 bg-slate-50 flex items-center justify-between hover:bg-purple-50/40 transition-colors">
              <div>
                <h4 class="font-bold text-slate-900">Raw Database Backup (.json)</h4>
                <p class="text-[11px] text-slate-500">Complete JSON snapshot of all inventory and vouchers.</p>
              </div>
              <button
                type="button"
                @click="exportJsonBackup"
                class="px-2.5 py-1.5 rounded-md text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs cursor-pointer shrink-0"
              >
                JSON
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end pt-3 border-t border-slate-200 mt-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-3 py-1 rounded text-xs font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.ExportModalComponent = ExportModalComponent;
})(window);
