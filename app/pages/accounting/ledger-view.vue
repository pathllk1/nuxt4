<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAccounting } from '../../composables/useAccounting';

useHead({
  title: 'Account Ledger Statements - Suite',
});

const { ledgerEntries, fetchLedger, loading } = useAccounting();

const accountHeadInput = ref('');
const dateFrom = ref('');
const dateTo = ref('');

const loadEntries = async () => {
  const params: any = {};
  if (accountHeadInput.value) params.accountHead = accountHeadInput.value;
  if (dateFrom.value) params.fromDate = dateFrom.value;
  if (dateTo.value) params.toDate = dateTo.value;
  await fetchLedger(params);
};

const runningTotals = computed(() => {
  let balance = 0;
  return ledgerEntries.value.map((entry) => {
    balance += (entry.debitAmount || 0) - (entry.creditAmount || 0);
    return {
      ...entry,
      runningBalance: Math.abs(balance),
      balanceType: balance >= 0 ? 'DR' : 'CR',
    };
  });
});

onMounted(() => {
  loadEntries();
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Account Ledger Statement</h1>
        <p class="text-xs text-slate-400 mt-1">Detailed running balance transactions for any account head</p>
      </div>

      <div class="flex gap-2 text-xs">
        <input type="text" v-model="accountHeadInput" @input="loadEntries" placeholder="Filter by Account Head..." class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
        <input type="date" v-model="dateFrom" @change="loadEntries" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
        <input type="date" v-model="dateTo" @change="loadEntries" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
      </div>
    </header>

    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3.5 px-4">Date</th>
              <th class="py-3.5 px-4">Account Head</th>
              <th class="py-3.5 px-4">Voucher No</th>
              <th class="py-3.5 px-4 text-right">Debit (DR)</th>
              <th class="py-3.5 px-4 text-right">Credit (CR)</th>
              <th class="py-3.5 px-4 text-right">Running Balance</th>
              <th class="py-3.5 px-4">Narration</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-if="runningTotals.length === 0">
              <td colspan="7" class="py-12 text-center text-slate-400 dark:text-zinc-500">
                No statement records found for the selected account head.
              </td>
            </tr>
            <tr v-for="(entry, idx) in runningTotals" :key="idx" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{{ entry.transactionDate }}</td>
              <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{{ entry.accountHead }}</td>
              <td class="py-3.5 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">#{{ entry.voucherNo || '-' }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ entry.debitAmount > 0 ? '₹' + entry.debitAmount.toFixed(2) : '-' }}
              </td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                {{ entry.creditAmount > 0 ? '₹' + entry.creditAmount.toFixed(2) : '-' }}
              </td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ₹{{ entry.runningBalance.toFixed(2) }} {{ entry.balanceType }}
              </td>
              <td class="py-3.5 px-4 text-slate-500 truncate max-w-xs">{{ entry.narration || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
