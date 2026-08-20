<template>
  <div class="p-3.5 sm:p-5 w-full mx-auto space-y-4">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="space-y-0.5">
        <div class="flex items-center gap-2 text-[11px] text-slate-500">
          <NuxtLink to="/inventory/reports" class="hover:text-primary transition-colors flex items-center gap-1 font-medium">
            <UIcon name="i-heroicons-arrow-left" class="w-3.5 h-3.5" />
            Inventory Reports
          </NuxtLink>
          <span>/</span>
          <span class="text-slate-900 dark:text-white font-bold">DayBook & Tax Analyzer</span>
        </div>
        <h1 class="text-xl font-black text-slate-900 dark:text-white tracking-tight">
          Complete Bill, Stock & GST Tax Matrix (DayBook + GSTR-1)
        </h1>
      </div>

      <!-- Header Actions -->
      <div v-if="parsedData" class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-heroicons-arrow-path"
          label="Change Files"
          class="font-bold cursor-pointer"
          @click="resetData"
        />

        <UButton
          color="success"
          size="xs"
          icon="i-heroicons-table-cells"
          label="Export Complete Bill Excel"
          class="font-bold cursor-pointer"
          @click="exportExcel"
        />
      </div>
    </div>

    <!-- Upload Section (if no file loaded) -->
    <div v-if="!parsedData" class="py-2">
      <DaybookExcelUpload @data-loaded="onDataLoaded" />
    </div>

    <!-- Analytics Dashboard (when file loaded) -->
    <template v-else>
      <!-- File Metadata Strip -->
      <div class="bg-slate-100 dark:bg-zinc-800/70 py-2 px-3 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
            <UIcon name="i-heroicons-table-cells" class="w-4 h-4 text-emerald-600" />
            <span>{{ parsedData.fileName }}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-mono">
              Sheet: {{ parsedData.sheetName }}
            </span>
          </div>

          <div v-if="parsedData.reconciliation.hasGstr1" class="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400">
            <UIcon name="i-heroicons-document-currency-rupee" class="w-4 h-4" />
            <span>GSTR-1 ({{ parsedData.reconciliation.returnPeriod || 'July 2026' }})</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-mono">
              GSTIN: {{ parsedData.supplierGstin }}
            </span>
          </div>

          <div v-if="parsedData.dateRange.startDate" class="flex items-center gap-1.5 text-slate-500 font-medium">
            <UIcon name="i-heroicons-calendar" class="w-4 h-4 text-slate-400" />
            <span>Period: <strong class="font-mono text-slate-800 dark:text-zinc-200">{{ parsedData.dateRange.startDate }}</strong> to <strong class="font-mono text-slate-800 dark:text-zinc-200">{{ parsedData.dateRange.endDate }}</strong></span>
          </div>
        </div>

        <div class="text-slate-500 font-medium flex items-center gap-2">
          <span>Parsed <strong class="text-slate-900 dark:text-white font-mono">{{ parsedData.totalRawRows }}</strong> rows</span>
          <span>•</span>
          <span class="text-blue-600 dark:text-blue-400 font-bold">Intra: {{ parsedData.summary.intraStateCount }}</span>
          <span>•</span>
          <span class="text-purple-600 dark:text-purple-400 font-bold">Inter: {{ parsedData.summary.interStateCount }}</span>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <DaybookKpiCards :data="parsedData" />

      <!-- Tabs Navigation -->
      <div class="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2 overflow-x-auto">
        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'vouchers' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'vouchers'"
        >
          <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4" />
          <span>Complete Voucher Register</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
            {{ parsedData.vouchers.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'stock' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'stock'"
        >
          <UIcon name="i-heroicons-cube" class="w-4 h-4" />
          <span>Stock Consumption & Items</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
            {{ parsedData.stockConsumption.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'parties' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'parties'"
        >
          <UIcon name="i-heroicons-users" class="w-4 h-4" />
          <span>Party-wise Consumption</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
            {{ parsedData.partySummary.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'hsn' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'hsn'"
        >
          <UIcon name="i-heroicons-tag" class="w-4 h-4" />
          <span>HSN & GST Slabs</span>
          <span class="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-white/20">
            {{ parsedData.hsnSummary.length }}
          </span>
        </button>

        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'margin' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'margin'"
        >
          <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
          <span>Margin Watchlist</span>
          <span
            v-if="parsedData.marginWatchlist.negative.length > 0"
            class="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse"
          >
            {{ parsedData.marginWatchlist.negative.length }} Loss
          </span>
        </button>

        <button
          type="button"
          class="px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
          :class="activeTab === 'reconciliation' ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
          @click="activeTab = 'reconciliation'"
        >
          <UIcon name="i-heroicons-scale" class="w-4 h-4" />
          <span>⚖️ GSTR-1 Reconciliation</span>
          <span
            v-if="parsedData.reconciliation.hasGstr1"
            class="px-1.5 py-0.2 rounded-full text-[10px] font-black"
            :class="parsedData.reconciliation.discrepancies.length === 0 ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'"
          >
            {{ parsedData.reconciliation.discrepancies.length === 0 ? '✓ Matched' : `${parsedData.reconciliation.discrepancies.length} Alerts` }}
          </span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div>
        <DaybookVoucherTable
          v-if="activeTab === 'vouchers'"
          :vouchers="parsedData.vouchers"
          :default-firm-gstin="parsedData.supplierGstin"
        />

        <DaybookStockTable
          v-else-if="activeTab === 'stock'"
          :items="parsedData.stockConsumption"
        />

        <DaybookPartyTable
          v-else-if="activeTab === 'parties'"
          :parties="parsedData.partySummary"
        />

        <DaybookHsnTable
          v-else-if="activeTab === 'hsn'"
          :hsn-list="parsedData.hsnSummary"
        />

        <DaybookMarginWatchTable
          v-else-if="activeTab === 'margin'"
          :watchlist="parsedData.marginWatchlist"
        />

        <DaybookTaxReconciliationTable
          v-else-if="activeTab === 'reconciliation'"
          :data="parsedData"
          :reconciliation="parsedData.reconciliation"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { exportDaybookAnalysisToExcel, type DaybookParsedData } from '@/utils/daybook-parser';
import DaybookExcelUpload from '@/components/inventory/daybook/DaybookExcelUpload.vue';
import DaybookKpiCards from '@/components/inventory/daybook/DaybookKpiCards.vue';
import DaybookStockTable from '@/components/inventory/daybook/DaybookStockTable.vue';
import DaybookVoucherTable from '@/components/inventory/daybook/DaybookVoucherTable.vue';
import DaybookPartyTable from '@/components/inventory/daybook/DaybookPartyTable.vue';
import DaybookHsnTable from '@/components/inventory/daybook/DaybookHsnTable.vue';
import DaybookMarginWatchTable from '@/components/inventory/daybook/DaybookMarginWatchTable.vue';
import DaybookTaxReconciliationTable from '@/components/inventory/daybook/DaybookTaxReconciliationTable.vue';

const parsedData = ref<DaybookParsedData | null>(null);
const activeTab = ref<'vouchers' | 'stock' | 'parties' | 'hsn' | 'margin' | 'reconciliation'>('vouchers');

function onDataLoaded(data: DaybookParsedData) {
  parsedData.value = data;
  activeTab.value = 'vouchers';
}

function resetData() {
  parsedData.value = null;
}

function exportExcel() {
  if (parsedData.value) {
    exportDaybookAnalysisToExcel(parsedData.value);
  }
}
</script>
