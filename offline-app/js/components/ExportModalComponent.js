// components/ExportModalComponent.js
(function (global) {
  'use strict';

  const ExportModalComponent = {
    props: {
      show: { type: Boolean, default: false },
      stocks: { type: Array, default: () => [] },
      bills: { type: Array, default: () => [] },
      parties: { type: Array, default: () => [] },
      movements: { type: Array, default: () => [] },
      firm: { type: Object, default: () => ({}) }
    },
    emits: ['close'],
    methods: {
      exportStockExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportStocks(this.stocks);
        }
      },
      exportStockPdf() {
        if (global.PdfExportService) {
          global.PdfExportService.exportStocksPdf(this.stocks, this.firm);
        }
      },
      exportBillsExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportBills(this.bills);
        }
      },
      exportBillsPdf() {
        if (global.PdfExportService) {
          global.PdfExportService.exportBillsPdf(this.bills, this.firm);
        }
      },
      exportMovementsExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportStockMovements(this.movements);
        }
      },
      exportPartiesExcel() {
        if (global.ExcelExportService) {
          global.ExcelExportService.exportParties(this.parties);
        }
      },
      exportSqliteDb() {
        if (global.WebSqlService && typeof global.WebSqlService.downloadDatabase === 'function') {
          global.WebSqlService.downloadDatabase(`AccountingERP_Database_${Date.now()}.sqlite`);
        }
      },
      exportJsonBackup() {
        if (global.Formatters) {
          const payload = {
            firm: (this.firm && this.firm.value) ? this.firm.value : this.firm,
            stocks: this.stocks,
            bills: this.bills,
            parties: this.parties,
            movements: this.movements,
            exportedAt: new Date().toISOString(),
            version: '3.2'
          };
          global.Formatters.exportToJson(payload, `ERP_Full_Backup_${Date.now()}.json`);
        }
      }
    },
    template: `
      <div v-if="show" class="fixed inset-0 z-[60] overflow-y-auto flex items-center justify-center p-3 bg-slate-900/50 backdrop-blur-xs" style="z-index: 60;" @click.self="$emit('close')" @keydown.esc="$emit('close')">
        <div class="relative bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-5 shadow-2xl text-slate-800 flex flex-col max-h-[90vh]">
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-200 mb-4 shrink-0">
            <div>
              <h3 class="text-base font-black text-slate-900 flex items-center space-x-2">
                <span>Export & Reporting Center</span>
                <span class="px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">100% Offline</span>
              </h3>
              <p class="text-[11px] text-slate-500 mt-0.5">Export registers, reports, and full database backups in standard formats.</p>
            </div>
            <button @click="$emit('close')" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-lg font-bold cursor-pointer transition-colors">&times;</button>
          </div>

          <!-- Export Grid / List -->
          <div class="overflow-y-auto space-y-2.5 text-xs pr-1 flex-1">
            <!-- 1. Vouchers Register (Excel & PDF) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-teal-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-teal-600">📋</span>
                  <span>Vouchers & Bills Register</span>
                </h4>
                <p class="text-[11px] text-slate-500">Itemized sales, purchases, notes, and challans with tax splits.</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click="exportBillsExcel"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-2xs cursor-pointer"
                  title="Export Bills to Excel Worksheet"
                >
                  Excel
                </button>
                <button
                  type="button"
                  @click="exportBillsPdf"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs cursor-pointer"
                  title="Export Bills to Landscape PDF Report"
                >
                  PDF
                </button>
              </div>
            </div>

            <!-- 2. Stock Inventory (Excel & PDF) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-blue-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-blue-600">📦</span>
                  <span>Stock Inventory Master</span>
                </h4>
                <p class="text-[11px] text-slate-500">Corporate stock valuation report with HSN, UOM, and selling rates.</p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  @click="exportStockExcel"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-2xs cursor-pointer"
                  title="Export Stock to Excel Worksheet"
                >
                  Excel
                </button>
                <button
                  type="button"
                  @click="exportStockPdf"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-2xs cursor-pointer"
                  title="Export Stock to PDF Valuation Report"
                >
                  PDF
                </button>
              </div>
            </div>

            <!-- 3. Stock Movement Ledger (Excel) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-amber-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-amber-600">📊</span>
                  <span>Stock Movement & Audit Ledger</span>
                </h4>
                <p class="text-[11px] text-slate-500">Complete audit trail of inward/outward batch movements.</p>
              </div>
              <button
                type="button"
                @click="exportMovementsExcel"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-2xs cursor-pointer shrink-0"
                title="Export Stock Ledger Movements to Excel"
              >
                Excel
              </button>
            </div>

            <!-- 4. Parties Directory (Excel) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-emerald-600">👥</span>
                  <span>Party Accounts Directory</span>
                </h4>
                <p class="text-[11px] text-slate-500">Customer & supplier address book with GSTIN, PAN, and phone.</p>
              </div>
              <button
                type="button"
                @click="exportPartiesExcel"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-2xs cursor-pointer shrink-0"
                title="Export Parties to Excel Worksheet"
              >
                Excel
              </button>
            </div>

            <!-- 5. SQLite Binary Database Download (.sqlite) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-indigo-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-indigo-600">💾</span>
                  <span>SQLite Database File (.sqlite)</span>
                </h4>
                <p class="text-[11px] text-slate-500">Raw SQLite binary file for full offline disaster recovery & migration.</p>
              </div>
              <button
                type="button"
                @click="exportSqliteDb"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs cursor-pointer shrink-0"
                title="Download Standalone SQLite Database Binary"
              >
                .sqlite
              </button>
            </div>

            <!-- 6. Raw JSON Full Backup (.json) -->
            <div class="border border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-purple-50/40 transition-colors flex items-center justify-between gap-3">
              <div>
                <h4 class="font-bold text-slate-900 flex items-center gap-1.5">
                  <span class="text-purple-600">🗄️</span>
                  <span>Complete JSON Snapshot (.json)</span>
                </h4>
                <p class="text-[11px] text-slate-500">Full JSON bundle of firm settings, inventory, bills, parties, and ledger.</p>
              </div>
              <button
                type="button"
                @click="exportJsonBackup"
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-2xs cursor-pointer shrink-0"
                title="Download JSON Data Backup"
              >
                JSON
              </button>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="flex items-center justify-end pt-3 border-t border-slate-200 mt-4 shrink-0">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
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
