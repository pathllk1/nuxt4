<template>
  <div class="p-4 sm:p-6 w-full mx-auto space-y-5">
    <!-- Header Section -->
    <div class="flex flex-wrap justify-between items-start gap-4">
      <div>
        <UButton
          color="neutral"
          variant="link"
          icon="i-heroicons-arrow-left"
          size="xs"
          label="Back to Inventory Reports"
          class="p-0 mb-1 font-bold text-xs"
          @click="$router.push('/inventory/reports')"
        />
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-primary-100 dark:bg-primary-900/40 rounded-2xl text-primary-600 dark:text-primary-400">
            <UIcon name="i-heroicons-chart-bar-square" class="w-7 h-7" />
          </div>
          <div>
            <h1 class="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-tight">
              GSTR-1 Outward & Stock Consumption Analysis
            </h1>
            <p class="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-0.5">
              Client-side analytical engine for GSTR-1 outward supplies, HSN stock quantities, and B2B invoices.
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons when data loaded -->
      <div v-if="parsedData" class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-up-tray"
          label="Upload New JSON"
          size="sm"
          class="font-bold text-xs h-8 cursor-pointer"
          @click="resetData"
        />
        <UButton
          color="success"
          variant="solid"
          icon="i-heroicons-table-cells"
          label="Export to Excel"
          size="sm"
          class="font-bold text-xs h-8 cursor-pointer"
          :loading="exportingExcel"
          @click="exportExcelClientSide"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-printer"
          label="Print"
          size="sm"
          class="font-bold text-xs h-8 cursor-pointer"
          @click="windowPrint"
        />
      </div>
    </div>

    <!-- Upload Card (shown when no data is parsed) -->
    <div v-if="!parsedData">
      <Gstr1Upload @file-loaded="onFileLoaded" />
    </div>

    <!-- Main Analytics Content (shown after JSON is parsed) -->
    <div v-else class="space-y-4">
      <!-- File Metadata & Period Ribbon -->
      <div class="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 rounded-3xl shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="px-3 py-1 bg-white/10 backdrop-blur rounded-xl border border-white/10">
            <span class="text-[9px] text-blue-200 uppercase font-black tracking-wider block">GSTIN</span>
            <span class="font-mono text-xs sm:text-sm font-black">{{ parsedData.gstin || 'N/A' }}</span>
          </div>

          <div class="px-3 py-1 bg-white/10 backdrop-blur rounded-xl border border-white/10">
            <span class="text-[9px] text-blue-200 uppercase font-black tracking-wider block">Return Period</span>
            <span class="font-mono text-xs sm:text-sm font-black">{{ parsedData.periodFormatted }} (FP: {{ parsedData.fp }})</span>
          </div>

          <div class="px-3 py-1 bg-white/10 backdrop-blur rounded-xl border border-white/10">
            <span class="text-[9px] text-blue-200 uppercase font-black tracking-wider block">Source File</span>
            <span class="text-xs font-bold truncate max-w-xs block">{{ currentFileName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="text-right">
            <span class="text-[9px] text-blue-200 uppercase font-black tracking-wider block">Total Outward Turnover</span>
            <span class="font-mono text-base sm:text-lg font-black text-emerald-400">
              {{ formatCurrency(parsedData.summary.grandTotalValue) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Top KPI Metric Cards -->
      <Gstr1KpiCards :data="parsedData" />

      <!-- Tab Navigation Ribbon -->
      <div class="bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs flex flex-wrap items-center gap-1.5">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2"
          :class="activeTab === t.id ? 'bg-primary-600 text-white shadow-xs' : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800'"
          @click="activeTab = t.id"
        >
          <UIcon :name="t.icon" class="w-4 h-4" />
          <span>{{ t.label }}</span>
          <span
            v-if="t.count !== undefined"
            class="px-1.5 py-0.2 rounded-full text-[9px] font-black"
            :class="activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'"
          >
            {{ t.count }}
          </span>
        </button>
      </div>

      <!-- Tab 1: HSN Stock & Quantity Analysis -->
      <div v-show="activeTab === 'hsn'">
        <Gstr1HsnTable :data="parsedData" />
      </div>

      <!-- Tab 2: Registered B2B Invoices -->
      <div v-show="activeTab === 'b2b'">
        <Gstr1B2bTable :data="parsedData" />
      </div>

      <!-- Tab 3: B2CS Small Consumer Sales -->
      <div v-show="activeTab === 'b2cs'">
        <Gstr1B2csTable :data="parsedData" />
      </div>

      <!-- Tab 4: Documents Issued Summary -->
      <div v-show="activeTab === 'docs'">
        <Gstr1DocsTable :data="parsedData" />
      </div>

      <!-- Tab 5: Rate & Tax Distribution -->
      <div v-show="activeTab === 'tax'" class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- GST Rate Slabs Breakdown Card -->
          <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs space-y-3">
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Tax Rate Slabs Breakdown
            </h3>
            <table class="w-full text-xs text-left">
              <thead class="bg-slate-50 dark:bg-zinc-850 text-[9px] uppercase font-bold text-slate-400">
                <tr>
                  <th class="py-2 px-3">Tax Slab</th>
                  <th class="py-2 px-3 text-right">Taxable Value</th>
                  <th class="py-2 px-3 text-right">CGST</th>
                  <th class="py-2 px-3 text-right">SGST</th>
                  <th class="py-2 px-3 text-right">Total GST</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                <tr v-for="(rData, rate) in parsedData.rateDistribution" :key="rate">
                  <td class="py-2.5 px-3 font-bold text-amber-600">{{ rate }}% Slab</td>
                  <td class="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white">{{ formatCurrency(rData.taxable) }}</td>
                  <td class="py-2.5 px-3 text-right text-slate-600 dark:text-zinc-400">{{ formatCurrency(rData.cgst) }}</td>
                  <td class="py-2.5 px-3 text-right text-slate-600 dark:text-zinc-400">{{ formatCurrency(rData.sgst) }}</td>
                  <td class="py-2.5 px-3 text-right font-bold text-purple-600 dark:text-purple-400">{{ formatCurrency(rData.totalTax) }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Outward Ratio Breakdown (B2B vs B2C) -->
          <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs space-y-4">
            <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Outward Supply Share (B2B vs B2C)
            </h3>
            <div class="space-y-3">
              <div>
                <div class="flex justify-between text-xs font-bold mb-1">
                  <span class="text-blue-600">B2B Registered Supplies</span>
                  <span class="font-mono">{{ formatCurrency(parsedData.summary.totalB2bValue) }} ({{ b2bSharePercent }}%)</span>
                </div>
                <div class="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: `${b2bSharePercent}%` }"></div>
                </div>
              </div>

              <div>
                <div class="flex justify-between text-xs font-bold mb-1">
                  <span class="text-purple-600">B2C Retail / Consumer Supplies</span>
                  <span class="font-mono">{{ formatCurrency(parsedData.summary.totalB2csValue) }} ({{ b2cSharePercent }}%)</span>
                </div>
                <div class="w-full bg-slate-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                  <div class="bg-purple-600 h-2.5 rounded-full" :style="{ width: `${b2cSharePercent}%` }"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import * as XLSX from 'xlsx';
import { parseGstr1Json, type Gstr1ParsedData } from '~/utils/gstr1-parser';
import Gstr1Upload from '~/components/inventory/gstr1/Gstr1Upload.vue';
import Gstr1KpiCards from '~/components/inventory/gstr1/Gstr1KpiCards.vue';
import Gstr1HsnTable from '~/components/inventory/gstr1/Gstr1HsnTable.vue';
import Gstr1B2bTable from '~/components/inventory/gstr1/Gstr1B2bTable.vue';
import Gstr1B2csTable from '~/components/inventory/gstr1/Gstr1B2csTable.vue';
import Gstr1DocsTable from '~/components/inventory/gstr1/Gstr1DocsTable.vue';

const parsedData = ref<Gstr1ParsedData | null>(null);
const currentFileName = ref('');
const activeTab = ref<'hsn' | 'b2b' | 'b2cs' | 'docs' | 'tax'>('hsn');
const exportingExcel = ref(false);

const tabs = computed(() => {
  if (!parsedData.value) return [];
  return [
    { id: 'hsn' as const, label: 'HSN Stock & Quantity', icon: 'i-heroicons-archive-box', count: parsedData.value.hsnSummaryByCode.length },
    { id: 'b2b' as const, label: 'B2B Invoices', icon: 'i-heroicons-building-office-2', count: parsedData.value.b2bInvoices.length },
    { id: 'b2cs' as const, label: 'B2CS Consumer Sales', icon: 'i-heroicons-shopping-bag', count: parsedData.value.b2csItems.length },
    { id: 'docs' as const, label: 'Documents Issued', icon: 'i-heroicons-document-duplicate', count: parsedData.value.docIssue.length },
    { id: 'tax' as const, label: 'Tax & Rate Distribution', icon: 'i-heroicons-chart-pie' }
  ];
});

const b2bSharePercent = computed(() => {
  if (!parsedData.value || parsedData.value.summary.grandTotalValue === 0) return 0;
  return Number(((parsedData.value.summary.totalB2bValue / parsedData.value.summary.grandTotalValue) * 100).toFixed(1));
});

const b2cSharePercent = computed(() => {
  if (!parsedData.value || parsedData.value.summary.grandTotalValue === 0) return 0;
  return Number(((parsedData.value.summary.totalB2csValue / parsedData.value.summary.grandTotalValue) * 100).toFixed(1));
});

function onFileLoaded(jsonText: string, filename: string) {
  try {
    const result = parseGstr1Json(jsonText);
    parsedData.value = result;
    currentFileName.value = filename;
    activeTab.value = 'hsn';
  } catch (err: any) {
    alert(`Failed to parse GSTR-1 JSON: ${err.message}`);
  }
}

function resetData() {
  parsedData.value = null;
  currentFileName.value = '';
}

function windowPrint() {
  window.print();
}

// Client-side Excel Export using xlsx library
function exportExcelClientSide() {
  if (!parsedData.value) return;
  exportingExcel.value = true;
  try {
    const wb = XLSX.utils.book_new();

    // 1. Overview Sheet
    const overviewData = [
      ['GSTR-1 OUTWARD SUPPLIES & STOCK ANALYSIS'],
      ['GSTIN', parsedData.value.gstin],
      ['Return Period', parsedData.value.periodFormatted, `(FP: ${parsedData.value.fp})`],
      [],
      ['SUMMARY METRICS', 'VALUE'],
      ['Gross Outward Value', parsedData.value.summary.grandTotalValue],
      ['Total Taxable Value', parsedData.value.summary.grandTotalTaxable],
      ['Total CGST', parsedData.value.summary.grandTotalCgst],
      ['Total SGST', parsedData.value.summary.grandTotalSgst],
      ['Total IGST', parsedData.value.summary.grandTotalIgst],
      ['Total GST Tax', parsedData.value.summary.grandTotalTax],
      ['Total Units Dispatched', parsedData.value.summary.totalStockUnitsDispatched],
      ['Total B2B Invoices', parsedData.value.summary.totalB2bInvoices],
      ['Unique B2B Buyers', parsedData.value.summary.uniqueB2bBuyers],
      ['Unique HSN Codes', parsedData.value.summary.uniqueHsnCount]
    ];
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Summary');

    // 2. HSN Stock Analysis Sheet
    const hsnRows = parsedData.value.hsnSummaryByCode.map((h, i) => ({
      '#': i + 1,
      'HSN Code': h.hsn_sc,
      'Description': h.description,
      'Unit (UQC)': h.uqc,
      'Total Quantity': h.totalQty,
      'B2B Qty': h.b2bQty,
      'B2C Qty': h.b2cQty,
      'Tax Rates (%)': h.rates.join(', '),
      'Taxable Value (₹)': h.totalTaxable,
      'CGST (₹)': h.totalCgst,
      'SGST (₹)': h.totalSgst,
      'Total Tax (₹)': h.totalTax,
      'Total Value (₹)': h.totalValue,
      'Share (%)': h.percentageOfTotal
    }));
    const wsHsn = XLSX.utils.json_to_sheet(hsnRows);
    XLSX.utils.book_append_sheet(wb, wsHsn, 'HSN Stock Analysis');

    // 3. B2B Invoices Sheet
    const b2bRows = parsedData.value.b2bInvoices.map((inv, i) => ({
      '#': i + 1,
      'Recipient GSTIN': inv.ctin,
      'Invoice No': inv.inum,
      'Invoice Date': inv.idt,
      'POS': inv.pos,
      'Reverse Charge': inv.rchrg,
      'Taxable Value (₹)': inv.totalTaxable,
      'CGST (₹)': inv.totalCgst,
      'SGST (₹)': inv.totalSgst,
      'Total Tax (₹)': inv.totalTax,
      'Invoice Value (₹)': inv.val,
      'Line Items Count': inv.itms.length
    }));
    const wsB2b = XLSX.utils.json_to_sheet(b2bRows);
    XLSX.utils.book_append_sheet(wb, wsB2b, 'B2B Invoices');

    // 4. B2CS Sheet
    const b2csRows = parsedData.value.b2csItems.map((b, i) => ({
      '#': i + 1,
      'Type': b.typ,
      'Supply Type': b.sply_ty,
      'POS': b.pos,
      'Rate (%)': b.rt,
      'Taxable Value (₹)': b.txval,
      'CGST (₹)': b.camt,
      'SGST (₹)': b.samt,
      'Total Tax (₹)': b.totalTax,
      'Total Value (₹)': b.totalValue
    }));
    const wsB2cs = XLSX.utils.json_to_sheet(b2csRows);
    XLSX.utils.book_append_sheet(wb, wsB2cs, 'B2CS Consumer');

    // 5. Documents Sheet
    const docRows = parsedData.value.docIssue.map((d, i) => ({
      '#': i + 1,
      'Document Type': d.doc_name || 'Invoices for outward supply',
      'From Serial': d.from,
      'To Serial': d.to,
      'Total Number': d.totnum,
      'Cancelled': d.cancel,
      'Net Issued': d.net_issue
    }));
    const wsDocs = XLSX.utils.json_to_sheet(docRows);
    XLSX.utils.book_append_sheet(wb, wsDocs, 'Documents Issued');

    const fileName = `GSTR1_${parsedData.value.gstin}_${parsedData.value.fp || 'Analysis'}.xlsx`;
    XLSX.writeFile(wb, fileName);
  } catch (err: any) {
    alert(`Failed to export Excel: ${err.message}`);
  } finally {
    exportingExcel.value = false;
  }
}

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
