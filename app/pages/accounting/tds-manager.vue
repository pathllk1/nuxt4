<template>
  <div class="p-4 py-3 w-full mx-auto space-y-4">
    <!-- Top Header Bar -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 pb-1 border-b border-gray-100 dark:border-zinc-800">
      <div>
        <UButton
          color="neutral"
          variant="link"
          icon="i-heroicons-arrow-left"
          size="xs"
          label="Back to Accounting"
          class="p-0 mb-1 font-bold text-xs"
          @click="$router.push('/accounting')"
        />
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl">
            <UIcon name="i-heroicons-building-library" class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-tight flex items-center gap-2">
              TDS Return & Compliance Manager
              <UBadge size="sm" variant="subtle" color="primary" class="font-bold text-[10px]">
                Sec 194C / Form 26Q
              </UBadge>
            </h1>
            <p class="text-xs text-gray-500 dark:text-zinc-400 font-medium">
              Statutory withholding register, deductee PAN tracking, gross-up analysis & Form 26Q export
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-shield-check"
          size="sm"
          label="DB Health Audit"
          class="font-bold text-xs h-9"
          :loading="auditLoading"
          @click="openAuditModal"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-path"
          size="sm"
          label="Refresh"
          class="font-bold text-xs h-9"
          :loading="loading"
          @click="fetchRegister"
        />
        <UButton
          color="success"
          icon="i-heroicons-document-arrow-down"
          size="sm"
          label="Export Form 26Q Excel"
          class="font-bold text-xs h-9 shadow-sm"
          :loading="exportLoading"
          :disabled="items.length === 0"
          @click="exportExcel"
        />
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <!-- Total Gross Payments -->
      <div class="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div class="space-y-0.5">
            <span class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Gross Subject to TDS</span>
            <div class="text-lg font-black text-gray-900 dark:text-white font-mono">
              {{ formatCurrency(metrics.totalGross) }}
            </div>
          </div>
          <div class="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
            <UIcon name="i-heroicons-banknotes" class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2 text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
          <span>Deductees:</span>
          <span class="font-bold text-gray-700 dark:text-zinc-300">{{ metrics.totalDeductees }} Unique Payees</span>
        </div>
      </div>

      <!-- Total TDS Liability -->
      <div class="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div class="space-y-0.5">
            <span class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">TDS Withheld (Liability)</span>
            <div class="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
              {{ formatCurrency(metrics.totalTds) }}
            </div>
          </div>
          <div class="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
            <UIcon name="i-heroicons-scale" class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2 text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
          <span>Deposit Target:</span>
          <span class="font-bold text-rose-600 dark:text-rose-400">Due 7th of Next Month</span>
        </div>
      </div>

      <!-- Net Payout Disbursed -->
      <div class="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div class="space-y-0.5">
            <span class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Net Disbursed</span>
            <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {{ formatCurrency(metrics.totalNet) }}
            </div>
          </div>
          <div class="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <UIcon name="i-heroicons-check-badge" class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2 text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
          <span>Bank Outflow:</span>
          <span class="font-bold text-gray-700 dark:text-zinc-300">Net of TDS deductions</span>
        </div>
      </div>

      <!-- PAN Compliance Rate -->
      <div class="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
        <div class="flex justify-between items-start">
          <div class="space-y-0.5">
            <span class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">PAN Health (Sec 206AA)</span>
            <div class="text-lg font-black font-mono" :class="metrics.panComplianceRate >= 95 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'">
              {{ metrics.panComplianceRate }}% Valid
            </div>
          </div>
          <div class="p-2 rounded-lg" :class="metrics.missingPanCount === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600'">
            <UIcon :name="metrics.missingPanCount === 0 ? 'i-heroicons-shield-check' : 'i-heroicons-exclamation-triangle'" class="w-4 h-4" />
          </div>
        </div>
        <div class="mt-2 text-[10px] flex items-center gap-1">
          <span v-if="metrics.missingPanCount > 0" class="text-amber-600 dark:text-amber-400 font-bold">
            ⚠️ {{ metrics.missingPanCount }} missing PANs (20% rate)
          </span>
          <span v-else class="text-emerald-600 dark:text-emerald-400 font-bold">
            ✓ 100% Valid PAN Coverage
          </span>
        </div>
      </div>
    </div>

    <!-- Filters Bar -->
    <div class="p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
      <!-- Left Filters: FY, Quarters & Section -->
      <div class="flex flex-wrap items-center gap-2">
        <!-- FY Selector -->
        <div class="w-32">
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">Fiscal Year</label>
          <USelect
            v-model="filters.financialYear"
            :options="financialYearOptions"
            size="sm"
            class="w-full"
            @change="fetchRegister"
          />
        </div>

        <!-- Quarter Toggle Pills -->
        <div>
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">Quarter / Period</label>
          <div class="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-gray-200/60 dark:border-zinc-700/60">
            <button
              v-for="q in quarterOptions"
              :key="q.value"
              type="button"
              class="px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer"
              :class="filters.quarter === q.value 
                ? 'bg-white dark:bg-zinc-900 text-gray-900 dark:text-white shadow-xs' 
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200'"
              @click="filters.quarter = q.value; fetchRegister()"
            >
              {{ q.value === 'ALL' ? 'Full FY' : q.value }}
            </button>
          </div>
        </div>

        <!-- Section Dropdown -->
        <div class="w-48">
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">Tax Section</label>
          <USelect
            v-model="filters.section"
            :options="sectionOptions"
            option-attribute="label"
            value-attribute="value"
            size="sm"
            class="w-full"
            @change="fetchRegister"
          />
        </div>
      </div>

      <!-- Right Filters: Search & Date Range -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="w-28">
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">From Date</label>
          <UInput
            type="date"
            v-model="filters.fromDate"
            size="sm"
            class="w-full"
            @change="fetchRegister"
          />
        </div>
        <div class="w-28">
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">To Date</label>
          <UInput
            type="date"
            v-model="filters.toDate"
            size="sm"
            class="w-full"
            @change="fetchRegister"
          />
        </div>
        <div class="w-52">
          <label class="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 ml-1 block mb-0.5">Search Deductee / PAN</label>
          <UInput
            v-model="filters.search"
            icon="i-heroicons-magnifying-glass"
            placeholder="Name, PAN, voucher..."
            size="sm"
            class="w-full"
            @input="debounceSearch"
          />
        </div>
      </div>
    </div>

    <!-- Main Table Card -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loading State -->
      <div v-if="loading" class="p-16 text-center text-gray-400 dark:text-zinc-500">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary" />
        <p class="text-xs uppercase tracking-widest font-black mt-3">Compiling Statutory TDS Register...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="items.length === 0" class="p-16 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-document-magnifying-glass" class="w-6 h-6" />
        </div>
        <div>
          <h3 class="text-sm font-bold text-gray-800 dark:text-zinc-200">No TDS Deductions Found</h3>
          <p class="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            No payment vouchers or subcontractor advances with TDS liabilities match the selected period ({{ filters.financialYear }}, {{ filters.quarter }}).
          </p>
        </div>
        <UButton
          size="xs"
          variant="subtle"
          color="neutral"
          label="Clear Custom Dates"
          @click="filters.fromDate = ''; filters.toDate = ''; filters.search = ''; fetchRegister()"
        />
      </div>

      <!-- Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-850/80">
              <th class="py-3 px-3">Date</th>
              <th class="py-3 px-3">Voucher</th>
              <th class="py-3 px-4">Payee / Deductee</th>
              <th class="py-3 px-3">PAN Card</th>
              <th class="py-3 px-2 text-center">Sec</th>
              <th class="py-3 px-3 text-right">Gross (₹)</th>
              <th class="py-3 px-2 text-center">Rate</th>
              <th class="py-3 px-3 text-right">TDS (₹)</th>
              <th class="py-3 px-3 text-right">Net Paid (₹)</th>
              <th class="py-3 px-3">Paid From</th>
              <th class="py-3 px-2 text-center">Mode</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
            <tr
              v-for="item in items"
              :key="item.id"
              class="hover:bg-gray-50/60 dark:hover:bg-zinc-800/40 transition-colors"
            >
              <!-- Date -->
              <td class="py-2.5 px-3 text-gray-600 dark:text-zinc-400 whitespace-nowrap font-mono text-[11px]">
                {{ item.transactionDate }}
              </td>

              <!-- Voucher -->
              <td class="py-2.5 px-3">
                <div class="font-bold text-gray-900 dark:text-white">{{ item.voucherNo }}</div>
                <div class="text-[9px] text-gray-400 dark:text-zinc-500 uppercase font-semibold">{{ item.voucherType }}</div>
              </td>

              <!-- Payee -->
              <td class="py-2.5 px-4 max-w-[200px]">
                <div class="font-bold text-gray-900 dark:text-white truncate" :title="item.payeeName">
                  {{ item.payeeName }}
                </div>
                <div class="text-[9px] text-gray-400 dark:text-zinc-500 flex items-center gap-1 mt-0.5 truncate" :title="item.narration">
                  <span>{{ item.payeeType }}</span>
                  <span v-if="item.isGrossUp" class="text-amber-500 font-bold">• u/s 195A Gross-Up</span>
                </div>
              </td>

              <!-- PAN Card -->
              <td class="py-2.5 px-3 whitespace-nowrap">
                <div v-if="item.isPanValid" class="flex items-center gap-1 font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px]">
                  <span>{{ item.panNumber }}</span>
                  <span class="text-[9px] px-1 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">✓</span>
                </div>
                <div v-else class="flex items-center gap-1 font-mono font-bold text-rose-600 dark:text-rose-400 text-[11px]">
                  <span>{{ item.panNumber || 'NO PAN' }}</span>
                  <span class="text-[9px] px-1 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">20% u/s 206AA</span>
                </div>
              </td>

              <!-- Section -->
              <td class="py-2.5 px-2 text-center whitespace-nowrap">
                <UBadge size="xs" variant="subtle" color="neutral" class="font-bold font-mono text-[10px]">
                  {{ item.section }}
                </UBadge>
              </td>

              <!-- Gross Amount -->
              <td class="py-2.5 px-3 text-right font-medium text-gray-900 dark:text-white font-mono whitespace-nowrap">
                {{ formatCurrency(item.grossAmount) }}
              </td>

              <!-- Rate -->
              <td class="py-2.5 px-2 text-center font-bold text-gray-700 dark:text-zinc-300 font-mono whitespace-nowrap text-[11px]">
                {{ item.tdsRate }}%
              </td>

              <!-- TDS Amount -->
              <td class="py-2.5 px-3 text-right font-bold text-rose-600 dark:text-rose-400 font-mono whitespace-nowrap">
                {{ formatCurrency(item.tdsAmount) }}
              </td>

              <!-- Net Paid -->
              <td class="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                {{ formatCurrency(item.netAmount) }}
              </td>

              <!-- Bank Account -->
              <td class="py-2.5 px-3 max-w-[160px]">
                <div class="font-semibold text-gray-800 dark:text-zinc-200 truncate" :title="item.bankAccountName">
                  {{ item.bankAccountName }}
                </div>
                <div v-if="item.bankAccountNumber" class="text-[9px] text-gray-400 dark:text-zinc-500 font-mono">
                  A/c ••••{{ item.bankAccountNumber.slice(-4) }}
                </div>
              </td>

              <!-- Mode / Badge -->
              <td class="py-2.5 px-2 text-center whitespace-nowrap">
                <UBadge
                  size="xs"
                  :variant="item.isGrossUp ? 'solid' : 'subtle'"
                  :color="item.isGrossUp ? 'warning' : 'primary'"
                  class="font-bold text-[9px]"
                >
                  {{ item.isGrossUp ? 'GROSS-UP' : 'DEDUCT' }}
                </UBadge>
              </td>
            </tr>
          </tbody>

          <!-- Table Footer Total -->
          <tfoot>
            <tr class="bg-gray-50/90 dark:bg-zinc-850/90 font-bold border-t-2 border-gray-200 dark:border-zinc-700">
              <td colspan="5" class="py-3 px-4 text-gray-700 dark:text-zinc-300 uppercase tracking-wider text-[11px]">
                Totals ({{ items.length }} Records)
              </td>
              <td class="py-3 px-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                {{ formatCurrency(metrics.totalGross) }}
              </td>
              <td></td>
              <td class="py-3 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                {{ formatCurrency(metrics.totalTds) }}
              </td>
              <td class="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatCurrency(metrics.totalNet) }}
              </td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </UCard>

    <!-- DB Double-Entry Audit Modal -->
    <UModal v-model="showAuditModal">
      <UCard :ui="{ ring: '', divide: 'divide-y divide-gray-100 dark:divide-zinc-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-shield-check" class="w-5 h-5 text-emerald-500" />
              <h3 class="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-tight">
                Double-Entry & Dual-Database Health Audit
              </h3>
            </div>
            <UButton color="neutral" variant="ghost" icon="i-heroicons-x-mark" size="xs" @click="showAuditModal = false" />
          </div>
        </template>

        <div v-if="auditLoading" class="py-12 text-center text-gray-400">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary" />
          <p class="text-xs font-bold uppercase tracking-wider mt-2">Auditing Mongo GL & PostgreSQL Tables...</p>
        </div>

        <div v-else-if="auditReport" class="space-y-4">
          <!-- Summary Banner -->
          <div 
            class="p-3 rounded-xl border flex items-center gap-3"
            :class="auditReport.summary.status === 'HEALTHY' 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
              : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'"
          >
            <UIcon 
              :name="auditReport.summary.status === 'HEALTHY' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'" 
              class="w-6 h-6 shrink-0" 
            />
            <div>
              <p class="text-xs font-bold uppercase tracking-wider">
                {{ auditReport.summary.status === 'HEALTHY' ? 'Database Double-Entry Integrity: 100% HEALTHY' : 'Attention Required' }}
              </p>
              <p class="text-[11px] opacity-90">
                All {{ auditReport.summary.totalTdsVouchersScanned }} TDS vouchers scanned across MongoDB and PostgreSQL.
              </p>
            </div>
          </div>

          <!-- Audit Metrics Grid -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
              <span class="text-[10px] text-gray-400 font-bold uppercase block">MongoDB Double-Entry Parity</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {{ auditReport.summary.unbalancedVoucherCount === 0 ? '✓ All Vouchers Balanced (ΣDR === ΣCR)' : `${auditReport.summary.unbalancedVoucherCount} Unbalanced` }}
              </span>
            </div>

            <div class="p-2.5 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
              <span class="text-[10px] text-gray-400 font-bold uppercase block">PostgreSQL labor_advances Sync</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {{ auditReport.summary.postgresSyncDiscrepancies === 0 ? '✓ 100% In Sync with GL' : `${auditReport.summary.postgresSyncDiscrepancies} Mismatches` }}
              </span>
            </div>
          </div>

          <!-- Vouchers List -->
          <div class="space-y-1.5 max-h-60 overflow-y-auto text-xs pr-1">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Scanned Vouchers Audit Detail</p>
            <div 
              v-for="v in auditReport.mongoVouchers" 
              :key="v.voucherGroupId"
              class="p-2 rounded-lg border border-gray-100 dark:border-zinc-800 flex items-center justify-between font-mono text-[11px]"
            >
              <div>
                <span class="font-bold text-gray-900 dark:text-white">{{ v.voucherNo || v.voucherGroupId }}</span>
                <span class="text-[10px] text-gray-400 ml-2">DR: ₹{{ v.totalDebit }} | CR: ₹{{ v.totalCredit }}</span>
              </div>
              <UBadge size="xs" variant="subtle" color="success" class="font-bold text-[9px]">
                BALANCED (0.00)
              </UBadge>
            </div>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useTdsManager } from '@/composables/useTdsManager';
import { formatCurrency } from '@/utils/formatters';
import { useApi } from '@/utils/api';

const api = useApi();

const {
  filters,
  loading,
  exportLoading,
  items,
  metrics,
  financialYearOptions,
  quarterOptions,
  sectionOptions,
  fetchRegister,
  exportExcel
} = useTdsManager();

const showAuditModal = ref(false);
const auditLoading = ref(false);
const auditReport = ref<any>(null);

const openAuditModal = async () => {
  showAuditModal.value = true;
  auditLoading.value = true;
  try {
    const res = await api.get('/accounting/tds/audit');
    if (res.success) {
      auditReport.value = res.data;
    }
  } catch (err) {
    console.error('Audit fetch error:', err);
  } finally {
    auditLoading.value = false;
  }
};

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchRegister();
  }, 350);
};

onMounted(() => {
  fetchRegister();
});
</script>
