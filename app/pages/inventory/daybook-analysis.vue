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
      <div v-if="parsedData" class="flex flex-wrap items-center gap-2">
        <UButton
          v-if="!parsedData.gstAcceleratorVerification"
          color="warning"
          variant="solid"
          size="xs"
          icon="i-heroicons-shield-check"
          label="⚡ Verify with CBIC Master (GST Accelerator)"
          class="font-black cursor-pointer shadow-xs"
          :loading="isVerifying"
          @click="verifyWithGstAccelerator"
        />

        <div
          v-else-if="parsedData.gstAcceleratorVerification"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border"
          :class="parsedData.gstAcceleratorVerification?.isLiveApiConfigured
            ? ((parsedData.gstAcceleratorVerification?.hsnMismatchCount ?? 0) === 0 && (parsedData.gstAcceleratorVerification?.invalidGstinsCount ?? 0) === 0
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800')
            : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'"
        >
          <UIcon
            :name="parsedData.gstAcceleratorVerification?.isLiveApiConfigured
              ? ((parsedData.gstAcceleratorVerification?.hsnMismatchCount ?? 0) === 0 ? 'i-heroicons-check-badge' : 'i-heroicons-exclamation-triangle')
              : 'i-heroicons-shield-exclamation'"
            class="w-4 h-4"
          />
          <span>
            <template v-if="parsedData.gstAcceleratorVerification?.isLiveApiConfigured">
              Live CBIC Verified
              <span v-if="(parsedData.gstAcceleratorVerification?.hsnMismatchCount ?? 0) > 0" class="text-rose-600 font-mono">
                ({{ parsedData.gstAcceleratorVerification.hsnMismatchCount }} Rate Mismatches)
              </span>
              <span v-else class="text-emerald-600">✓ 100% Match</span>
            </template>
            <template v-else>
              <span class="text-amber-600 dark:text-amber-400 font-bold">⚠️ Live API Key Missing</span>
              <span class="text-slate-500 font-normal text-[10px] ml-1">(Set GST_ACCELERATOR_API_KEY in .env)</span>
            </template>
          </span>
          <button
            type="button"
            class="ml-1 hover:underline text-[10px] text-slate-500 cursor-pointer font-normal"
            title="Re-run verification"
            @click="verifyWithGstAccelerator"
          >
            ↺ Re-check
          </button>
        </div>

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
import { exportDaybookAnalysisToExcel, type DaybookParsedData } from '~/utils/daybook-parser';
import DaybookExcelUpload from '~/components/inventory/daybook/DaybookExcelUpload.vue';
import DaybookKpiCards from '~/components/inventory/daybook/DaybookKpiCards.vue';
import DaybookStockTable from '~/components/inventory/daybook/DaybookStockTable.vue';
import DaybookVoucherTable from '~/components/inventory/daybook/DaybookVoucherTable.vue';
import DaybookPartyTable from '~/components/inventory/daybook/DaybookPartyTable.vue';
import DaybookHsnTable from '~/components/inventory/daybook/DaybookHsnTable.vue';
import DaybookMarginWatchTable from '~/components/inventory/daybook/DaybookMarginWatchTable.vue';
import DaybookTaxReconciliationTable from '~/components/inventory/daybook/DaybookTaxReconciliationTable.vue';

const toast = useToast();
const parsedData = ref<DaybookParsedData | null>(null);
const activeTab = ref<'vouchers' | 'stock' | 'parties' | 'hsn' | 'margin' | 'reconciliation'>('vouchers');
const isVerifying = ref(false);

async function onDataLoaded(data: DaybookParsedData) {
  parsedData.value = data;
  activeTab.value = 'vouchers';
  // Automatically trigger CBIC statutory verification in the background
  await verifyWithGstAccelerator();
}

function resetData() {
  parsedData.value = null;
}

async function verifyWithGstAccelerator() {
  if (!parsedData.value) return;
  isVerifying.value = true;

  try {
    const hsnList = parsedData.value.hsnSummary.map(h => ({
      hsn: h.hsn,
      gstRate: h.gstRate
    }));

    const gstins = Array.from(
      new Set(
        parsedData.value.vouchers
          .map(v => (v.gstin || '').trim())
          .filter(g => g.length > 0)
      )
    );

    const res: any = await ($fetch as any)('/api/gst/accelerator/verify', {
      method: 'POST',
      body: { hsnList, gstins }
    });

    if (res && res.success && res.data) {
      const { hsnMap, gstinMap, summary } = res.data;

      // 1. Enrich HSN Summary table
      parsedData.value.hsnSummary.forEach(h => {
        const v = hsnMap[h.hsn];
        if (v) {
          h.cbicDescription = v.description;
          h.cbicRate = v.cbicRate;
          h.cbicNotificationRef = v.notificationRef;
          h.rateMismatch = v.isVerified ? !v.isMatched : false;
          h.rateVariance = v.variancePct;
          h.conditionApplied = v.conditionApplied;
          h.conditionWarning = v.conditionWarning;
          h.cbicVerified = Boolean(v.isVerified);
        }
      });

      // 2. Enrich Vouchers table with GSTIN validation & State
      parsedData.value.vouchers.forEach(v => {
        const clean = (v.gstin || '').trim();
        if (clean && gstinMap[clean]) {
          const g = gstinMap[clean];
          v.gstinValid = g.isValid;
          v.gstinState = g.stateCode ? `${g.stateCode}-${g.stateName}` : '';
          v.gstinMessage = g.message;
        }
      });

      parsedData.value.gstAcceleratorVerification = {
        verifiedAt: new Date().toLocaleTimeString(),
        ...summary
      };

      if (!summary.isLiveApiConfigured) {
        toast.add({
          title: 'GST Accelerator API Key Not Configured',
          description: 'HSN statutory rates remain unverified. Set GST_ACCELERATOR_API_KEY in your .env file to enable live CBIC verification.',
          color: 'warning'
        });
      } else if (summary.hsnMismatchCount > 0) {
        toast.add({
          title: 'CBIC Audit: Tax Rate Mismatches Detected',
          description: `Found ${summary.hsnMismatchCount} HSN tax rate discrepancies against official CBIC notifications. Check the HSN & GST Slabs tab.`,
          color: 'warning'
        });
      } else {
        toast.add({
          title: '✓ CBIC Statutory Verification Complete',
          description: `All ${summary.totalHsnsChecked} HSNs verified via GST Accelerator API. Verified ${summary.totalGstinsChecked} GSTINs.`,
          color: 'success'
        });
      }
    }
  } catch (err: any) {
    toast.add({
      title: 'Verification Warning',
      description: err.message || 'Could not verify all rates against CBIC Master.',
      color: 'neutral'
    });
  } finally {
    isVerifying.value = false;
  }
}

function exportExcel() {
  if (parsedData.value) {
    exportDaybookAnalysisToExcel(parsedData.value);
  }
}
</script>
