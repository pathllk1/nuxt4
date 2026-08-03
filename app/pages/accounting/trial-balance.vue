<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';

const router = useRouter();
const { trialBalance, fetchTrialBalance, exportTrialBalancePdf, exportTrialBalanceExcel, loading, error } = useAccounting();

const exportLoading = ref(false);
const onExportPDF = async () => {
  exportLoading.value = true;
  try {
    const params: { fromDate?: string; toDate?: string } = {};
    if (fromDate.value) params.fromDate = fromDate.value;
    if (toDate.value) params.toDate = toDate.value;
    await exportTrialBalancePdf(params);
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  exportLoading.value = true;
  try {
    const params: { fromDate?: string; toDate?: string } = {};
    if (fromDate.value) params.fromDate = fromDate.value;
    if (toDate.value) params.toDate = toDate.value;
    await exportTrialBalanceExcel(params);
  } catch (err: any) {
    console.error('Failed to export Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};

const fromDate = ref('');
const toDate = ref(new Date().toISOString().split('T')[0]);
const searchQuery = ref('');

const loadData = async () => {
  const params: { fromDate?: string; toDate?: string } = {};
  if (fromDate.value) params.fromDate = fromDate.value;
  if (toDate.value) params.toDate = toDate.value;
  await fetchTrialBalance(params);
};

const clearFilters = async () => {
  fromDate.value = '';
  toDate.value = new Date().toISOString().split('T')[0];
  searchQuery.value = '';
  await loadData();
};

const filteredAccounts = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return trialBalance.value;
  return trialBalance.value.filter(
    (a) =>
      a.accountHead.toLowerCase().includes(query) ||
      (a.accountType && a.accountType.toLowerCase().includes(query))
  );
});

const totalDebits = computed(() =>
  filteredAccounts.value.reduce((sum, a) => sum + (a.totalDebit || 0), 0)
);

const totalCredits = computed(() =>
  filteredAccounts.value.reduce((sum, a) => sum + (a.totalCredit || 0), 0)
);

const diff = computed(() => Math.abs(totalDebits.value - totalCredits.value));
const isBalanced = computed(() => diff.value < 0.01);

const formatINR = (n: number) => {
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
};

const viewLedger = (head: string) => {
  router.push({ path: '/accounting/ledger-view', query: { head } });
};

const triggerPrint = () => {
  window.print();
};

onMounted(loadData);
</script>

<template>
  <div class="p-4 py-3 max-w-[1600px] mx-auto space-y-3 print:p-0 print:space-y-2">
    <!-- Header -->
    <div class="flex justify-between items-end mb-1 print:hidden">
      <div>
        <div class="flex items-center gap-2 mb-0.5">
           <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
           <span class="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Accounting Reports</span>
        </div>
        <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Trial Balance</h1>
        <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">Verify that total debits equal total credits</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton 
          color="neutral" 
          variant="outline" 
          icon="i-heroicons-arrow-left"
          label="Dashboard"
          size="sm"
          class="font-bold text-xs h-8"
          @click="router.push('/accounting')"
        />
        <UButton 
          color="success" 
          variant="outline" 
          icon="i-heroicons-arrow-down-tray"
          label="PDF"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportPDF"
        />
        <UButton 
          color="success" 
          variant="outline" 
          icon="i-heroicons-arrow-down-tray"
          label="Excel"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportExcel"
        />
        <UButton 
          color="primary" 
          variant="solid" 
          icon="i-heroicons-printer"
          label="Print"
          size="sm"
          class="font-bold text-xs h-8"
          @click="triggerPrint"
        />
      </div>
    </div>

    <!-- Print Header Information -->
    <div class="hidden print:block mb-4 space-y-1">
      <h1 class="text-xl font-black uppercase tracking-tight">Trial Balance</h1>
      <p class="text-[10px] text-slate-500 font-medium">Verify that total debits equal total credits</p>
      <p v-if="fromDate || toDate" class="text-[10px] font-bold text-indigo-600">
        Period: {{ fromDate ? fromDate : 'Beginning' }} to {{ toDate }}
      </p>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-2.5 bg-white dark:bg-zinc-900 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-zinc-800 print:hidden">
      <div class="flex-1 min-w-[240px]">
        <UInput 
          v-model="searchQuery" 
          icon="i-heroicons-magnifying-glass"
          placeholder="Search account heads..."
          size="sm"
          class="w-full"
        />
      </div>
      <div class="flex items-center gap-1.5">
        <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 ml-1">From</span>
        <UInput type="date" v-model="fromDate" size="sm" class="w-36" />
        <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500 ml-1">To</span>
        <UInput type="date" v-model="toDate" size="sm" class="w-36" />
      </div>
      <div class="flex gap-1.5">
        <UButton 
          color="primary" 
          label="Apply" 
          size="sm" 
          class="font-bold text-xs h-8"
          @click="loadData"
        />
        <UButton 
          color="neutral" 
          variant="ghost" 
          label="Reset" 
          size="sm" 
          class="font-bold text-xs h-8"
          @click="clearFilters"
        />
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="p-3 bg-rose-50 border border-rose-100 text-rose-800 rounded-xl flex items-center justify-between print:hidden">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-rose-500" />
        <p class="text-xs font-bold">{{ error }}</p>
      </div>
      <UButton color="error" size="xs" label="Retry" @click="loadData" />
    </div>

    <!-- KPI Ticker Strip -->
    <div v-if="!loading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <UCard class="border-l-4 border-l-emerald-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Debits</p>
        <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">{{ formatINR(totalDebits) }}</div>
      </UCard>
      <UCard class="border-l-4 border-l-rose-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Credits</p>
        <div class="text-lg font-black text-rose-600 dark:text-rose-400 font-mono leading-tight">{{ formatINR(totalCredits) }}</div>
      </UCard>
      <UCard class="border-l-4 shadow-sm rounded-xl" :class="isBalanced ? 'border-l-indigo-500' : 'border-l-amber-500'" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Trial Balance Status</p>
        <div class="flex items-center gap-1.5 leading-tight mt-0.5">
          <span class="text-sm font-black" :class="isBalanced ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'">
            {{ isBalanced ? 'Balanced' : 'Imbalanced' }}
          </span>
          <UIcon v-if="isBalanced" name="i-heroicons-check-circle" class="w-4 h-4 text-emerald-500 shrink-0" />
        </div>
        <p v-if="!isBalanced" class="text-[8px] font-black text-rose-500 dark:text-rose-400 mt-0.5 leading-none">Diff: {{ formatINR(diff) }}</p>
      </UCard>
    </div>

    <!-- Table Section -->
    <UCard class="w-full shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 print:shadow-none print:border-none" :ui="{ body: 'p-0 overflow-hidden' }">
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">Loading trial balance...</p>
      </div>
      <div v-else-if="filteredAccounts.length === 0" class="py-16 text-center space-y-2">
        <UIcon name="i-heroicons-document-text" class="w-10 h-10 text-slate-200 dark:text-zinc-800 mx-auto" />
        <p class="text-xs font-bold text-slate-500 dark:text-zinc-400 italic">No ledger heads found matching the criteria.</p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="bg-gray-50/80 dark:bg-zinc-800/80 text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider print:bg-slate-100">
              <th class="py-2.5 px-4">Account Head</th>
              <th class="py-2.5 px-4">Category</th>
              <th class="py-2.5 px-4 text-right">Debits (DR)</th>
              <th class="py-2.5 px-4 text-right">Credits (CR)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
            <tr 
              v-for="row in filteredAccounts" 
              :key="row.accountHead" 
              class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group print:hover:bg-transparent"
              @click="viewLedger(row.accountHead)"
            >
              <td class="py-2 px-4">
                <div class="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{{ row.accountHead }}</div>
              </td>
              <td class="py-2 px-4">
                <UBadge color="neutral" variant="subtle" size="sm" class="font-black text-[8px] tracking-wider rounded px-1.5 py-0 uppercase">
                  {{ row.accountType?.replace(/_/g, ' ') || 'GENERAL' }}
                </UBadge>
              </td>
              <td class="py-2 px-4 text-right font-bold text-slate-600 dark:text-zinc-400 font-mono">
                {{ row.totalDebit > 0 ? formatINR(row.totalDebit) : '—' }}
              </td>
              <td class="py-2 px-4 text-right font-bold text-slate-600 dark:text-zinc-400 font-mono">
                {{ row.totalCredit > 0 ? formatINR(row.totalCredit) : '—' }}
              </td>
            </tr>
            <!-- Totals row -->
            <tr class="bg-gray-50/50 dark:bg-zinc-800/30 font-black border-t border-gray-200 dark:border-zinc-800 print:bg-slate-50">
              <td colspan="2" class="py-2.5 px-4 text-[9px] uppercase tracking-widest text-slate-700 dark:text-zinc-300">Grand Totals</td>
              <td class="py-2.5 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400">
                {{ formatINR(totalDebits) }}
              </td>
              <td class="py-2.5 px-4 text-right font-mono text-rose-600 dark:text-rose-400">
                {{ formatINR(totalCredits) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .print\:hidden {
    display: none !important;
  }
  .print\:block {
    display: block !important;
  }
  .print\:shadow-none {
    box-shadow: none !important;
  }
  .print\:border-none {
    border: none !important;
  }
  .print\:p-0 {
    padding: 0 !important;
  }
  .print\:space-y-2 > :not([class*="hidden"]) ~ :not([class*="hidden"]) {
    margin-top: 0.5rem !important;
  }
}
</style>
