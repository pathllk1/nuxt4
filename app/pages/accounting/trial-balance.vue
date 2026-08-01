<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAccounting } from '../../composables/useAccounting';

useHead({
  title: 'Trial Balance Sheet - Accounting Suite',
});

const { trialBalance, fetchTrialBalance, loading } = useAccounting();

const fromDate = ref('');
const toDate = ref('');

const loadTrialBalance = async () => {
  const params: any = {};
  if (fromDate.value) params.fromDate = fromDate.value;
  if (toDate.value) params.toDate = toDate.value;
  await fetchTrialBalance(params);
};

const totals = computed(() => {
  return trialBalance.value.reduce((acc, row) => {
    if (row.balanceType === 'DR') acc.debit += row.balance;
    else acc.credit += row.balance;
    return acc;
  }, { debit: 0, credit: 0 });
});

onMounted(() => {
  loadTrialBalance();
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Trial Balance Sheet</h1>
        <p class="text-xs text-slate-400 mt-1">Live double-entry debit vs credit account balance verification</p>
      </div>

      <div class="flex items-center gap-2 text-xs">
        <input type="date" v-model="fromDate" @change="loadTrialBalance" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
        <span class="text-slate-400 font-bold">to</span>
        <input type="date" v-model="toDate" @change="loadTrialBalance" class="px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold" />
      </div>
    </header>

    <!-- Verification Status Banner -->
    <div class="p-4 rounded-2xl border flex items-center justify-between font-bold text-xs" :class="Math.abs(totals.debit - totals.credit) < 0.01 ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'">
      <div class="flex items-center gap-2">
        <span class="text-base">{{ Math.abs(totals.debit - totals.credit) < 0.01 ? '✓' : '⚠️' }}</span>
        <span>{{ Math.abs(totals.debit - totals.credit) < 0.01 ? 'Trial Balance is perfectly balanced (Total DR = Total CR)' : 'Trial balance difference detected!' }}</span>
      </div>
      <div class="font-mono text-sm">
        Diff: ₹{{ Math.abs(totals.debit - totals.credit).toFixed(2) }}
      </div>
    </div>

    <!-- Trial Balance Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3.5 px-4">Account Head</th>
              <th class="py-3.5 px-4">Account Type</th>
              <th class="py-3.5 px-4 text-right">Debit Balance (DR ₹)</th>
              <th class="py-3.5 px-4 text-right">Credit Balance (CR ₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-if="trialBalance.length === 0">
              <td colspan="4" class="py-12 text-center text-slate-400 dark:text-zinc-500">
                No ledger account balances found.
              </td>
            </tr>
            <tr v-for="row in trialBalance" :key="row.accountHead" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{{ row.accountHead }}</td>
              <td class="py-3.5 px-4 font-mono text-[11px] text-slate-500">{{ row.accountType }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ row.balanceType === 'DR' ? '₹' + row.balance.toFixed(2) : '-' }}
              </td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                {{ row.balanceType === 'CR' ? '₹' + row.balance.toFixed(2) : '-' }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 dark:bg-zinc-800 font-black text-slate-900 dark:text-white border-t-2 border-slate-200 dark:border-zinc-700">
              <td colspan="2" class="py-4 px-4 uppercase tracking-wider text-xs">Grand Total</td>
              <td class="py-4 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">₹{{ totals.debit.toFixed(2) }}</td>
              <td class="py-4 px-4 text-right font-mono text-red-600 dark:text-red-400 text-sm">₹{{ totals.credit.toFixed(2) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>
