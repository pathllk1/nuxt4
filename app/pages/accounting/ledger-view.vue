<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-end mb-2">
      <div>
        <UButton 
          color="neutral" 
          variant="link" 
          icon="i-heroicons-arrow-left" 
          size="xs" 
          label="Back to Dashboard" 
          class="p-0 mb-1 font-bold text-xs" 
          @click="$router.back()" 
        />
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Account Ledger</h1>
          <div class="flex items-center gap-2 mt-0.5">
             <USelect 
                v-model="accountHead" 
                :items="accountHeadOptions" 
                placeholder="Select Account Head"
                size="sm" 
                class="w-64"
                @update:model-value="updateHead" 
             />
             <UBadge 
               v-if="accountHead"
               size="sm" 
               variant="subtle" 
               :color="currentBalance.balanceType === 'DR' ? 'success' : 'error'"
               class="font-black text-[9px] rounded-md h-8 flex items-center px-2 py-0"
             >
               {{ currentBalance.balanceType }} BAL: ₹{{ currentBalance.balance.toLocaleString() }}
             </UBadge>
          </div>
        </div>
      </div>
      
      <div class="flex items-end gap-2">
         <div class="w-32 flex flex-col gap-0.5">
            <span class="text-[8px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">From</span>
            <UInput type="date" v-model="filters.fromDate" size="sm" class="w-full" @change="loadLedger" />
         </div>
         <div class="w-32 flex flex-col gap-0.5">
            <span class="text-[8px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">To</span>
            <UInput type="date" v-model="filters.toDate" size="sm" class="w-full" @change="loadLedger" />
         </div>
         <div class="flex gap-1.5 h-8">
            <UButton 
              color="success"
              variant="outline"
              icon="i-heroicons-arrow-down-tray"
              label="PDF"
              size="sm"
              class="font-bold text-xs h-8"
              :loading="exportLoading"
              :disabled="!accountHead"
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
              :disabled="!accountHead"
              @click="onExportExcel"
            />
         </div>
      </div>
    </div>

    <!-- Ledger Entries Table -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading ledger entries...</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
              <th class="py-2.5 px-4">Date</th>
              <th class="py-2.5 px-4">Voucher / Ref</th>
              <th class="py-2.5 px-4">Narration</th>
              <th class="py-2.5 px-4 text-right">Debit (Dr)</th>
              <th class="py-2.5 px-4 text-right">Credit (Cr)</th>
              <th class="py-2.5 px-4 text-right">Running Bal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
            <tr v-for="(entry, idx) in runningLedger" :key="idx" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors">
              <td class="py-2 px-4 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{{ entry.transactionDate }}</td>
              <td class="py-2 px-4">
                <div class="font-bold text-gray-900 dark:text-white">{{ entry.voucherNo || entry.refType }}</div>
                <div class="text-[9px] text-gray-400 dark:text-zinc-500 uppercase font-bold tracking-wider mt-0.5">{{ entry.voucherType }}</div>
              </td>
              <td class="py-2 px-4">
                <div class="max-w-xs text-gray-700 dark:text-zinc-300 leading-normal">{{ entry.narration }}</div>
              </td>
              <td class="py-2 px-4 text-right font-medium text-rose-600 dark:text-rose-400 font-mono">
                {{ entry.debitAmount > 0 ? '₹' + entry.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '' }}
              </td>
              <td class="py-2 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                {{ entry.creditAmount > 0 ? '₹' + entry.creditAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '' }}
              </td>
              <td class="py-2 px-4 text-right font-bold bg-gray-50/30 dark:bg-zinc-850/20 font-mono">
                ₹{{ Math.abs(entry.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }} {{ entry.runningBalance >= 0 ? 'Dr' : 'Cr' }}
              </td>
            </tr>
            <tr v-if="ledgerEntries.length === 0">
              <td colspan="6" class="py-16 text-center text-gray-400 dark:text-zinc-500 italic">No transactions found for this account in the selected range.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';

const route = useRoute();
const { ledgerEntries, accountBalance, fetchLedger, fetchAccountBalance, fetchCOA, chartOfAccounts, exportLedgerPdf, exportLedgerExcel, loading } = useAccounting();

const exportLoading = ref(false);

const accountHeadOptions = computed(() => {
  return chartOfAccounts.value.map(head => ({
    label: head.account_name,
    value: head.account_name
  }));
});

const onExportPDF = async () => {
  if (!accountHead.value) return;
  exportLoading.value = true;
  try {
    await exportLedgerPdf({
      accountHead: accountHead.value,
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  if (!accountHead.value) return;
  exportLoading.value = true;
  try {
    await exportLedgerExcel({
      accountHead: accountHead.value,
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });
  } catch (err: any) {
    console.error('Failed to export Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};

const accountHead = ref<string>('');
const filters = reactive({
  fromDate: '',
  toDate: new Date().toISOString().split('T')[0]
});

onMounted(() => {
  fetchCOA();
  if (route.query.head) {
    accountHead.value = route.query.head as string;
    loadLedger();
  }
});

async function updateHead() {
   loadLedger();
}

watch(() => route.query.head, (newHead) => {
  if (newHead) {
    accountHead.value = newHead as string;
    loadLedger();
  }
});

async function loadLedger() {
  await Promise.all([
    fetchLedger({ accountHead: accountHead.value, ...filters }),
    fetchAccountBalance(accountHead.value, filters.toDate)
  ]);
}

const currentBalance = computed(() => accountBalance.value);

const runningLedger = computed(() => {
  let bal = 0;
  return ledgerEntries.value.map(entry => {
    bal += (entry.debitAmount || 0) - (entry.creditAmount || 0);
    return { ...entry, runningBalance: bal };
  });
});
</script>
