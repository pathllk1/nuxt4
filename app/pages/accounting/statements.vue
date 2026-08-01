<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useAccounting } from '../../composables/useAccounting';

useHead({
  title: 'Financial Statements & Profit Loss - Suite',
});

const { accountTypeSummaries, fetchAccountTypeSummaries, loading } = useAccounting();

const incomeTotal = computed(() => {
  const incomeTypes = ['INCOME', 'INDIRECT_INCOME', 'SALES'];
  return accountTypeSummaries.value
    .filter(a => incomeTypes.includes(a.account_type))
    .reduce((sum, a) => sum + Math.abs(a.total_balance || 0), 0);
});

const expenseTotal = computed(() => {
  const expenseTypes = ['EXPENSE', 'INDIRECT_EXPENSE', 'COGS', 'PURCHASE'];
  return accountTypeSummaries.value
    .filter(a => expenseTypes.includes(a.account_type))
    .reduce((sum, a) => sum + Math.abs(a.total_balance || 0), 0);
});

const netProfit = computed(() => {
  return incomeTotal.value - expenseTotal.value;
});

onMounted(() => {
  fetchAccountTypeSummaries();
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Profit & Loss Financial Statement</h1>
        <p class="text-xs text-slate-400 mt-1">Trading account, income vs expense analysis, and net profit</p>
      </div>

      <button @click="fetchAccountTypeSummaries()" class="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors">
        Refresh Statement
      </button>
    </header>

    <!-- Top P&L Cards -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Income & Revenue</p>
        <h3 class="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">₹{{ incomeTotal.toLocaleString('en-IN') }}</h3>
      </div>
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Expenses & COGS</p>
        <h3 class="text-2xl font-black font-mono text-red-600 dark:text-red-400 mt-1">₹{{ expenseTotal.toLocaleString('en-IN') }}</h3>
      </div>
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit / Loss</p>
        <h3 class="text-2xl font-black font-mono mt-1" :class="netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'">
          {{ netProfit >= 0 ? 'Net Profit: ₹' : 'Net Loss: -₹' }}{{ Math.abs(netProfit).toLocaleString('en-IN') }}
        </h3>
      </div>
    </div>

    <!-- Account Types Breakdown Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div class="p-4 border-b border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/50 font-bold text-xs">
        Categorized Account Heads Summary
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3.5 px-4">Account Type Category</th>
              <th class="py-3.5 px-4 text-center">Heads Count</th>
              <th class="py-3.5 px-4 text-right">Total Debit</th>
              <th class="py-3.5 px-4 text-right">Total Credit</th>
              <th class="py-3.5 px-4 text-right">Net Balance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-for="cat in accountTypeSummaries" :key="cat.account_type" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white font-mono">{{ cat.account_type }}</td>
              <td class="py-3.5 px-4 text-center font-mono font-bold">{{ cat.account_count }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-emerald-600">₹{{ (cat.total_debit || 0).toFixed(2) }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-red-600">₹{{ (cat.total_credit || 0).toFixed(2) }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                ₹{{ Math.abs(cat.total_balance || 0).toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
