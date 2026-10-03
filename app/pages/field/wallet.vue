<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-12">
    <!-- Top Header Banner -->
    <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-lg">
      <div class="max-w-4xl mx-auto px-4 py-6 sm:px-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-2xl">👛</span>
              <span class="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white">
                Site Imprest Wallet
              </span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              {{ wallet?.supervisorName || 'Site Supervisor' }}
            </h1>
            <p class="text-emerald-100 text-xs sm:text-sm mt-0.5 flex items-center gap-1">
              <span>Account:</span>
              <span class="font-mono bg-black/20 px-2 py-0.5 rounded text-white font-medium">
                {{ wallet?.imprestAccountHead || 'Advance Account' }}
              </span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click="loadData"
              :disabled="loading"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-sm transition cursor-pointer border border-white/20"
              title="Refresh wallet balance"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
            <NuxtLink
              to="/field/expense"
              class="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-sm shadow-md transition transform active:scale-95 no-underline"
            >
              <span>➕ Log Expense</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Content Container -->
    <div class="max-w-4xl mx-auto px-4 sm:px-6 -mt-6">
      <!-- Error Alert -->
      <div v-if="error" class="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between shadow-sm">
        <span>{{ error }}</span>
        <button @click="error = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <!-- Main Balance Card -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-700 p-6 sm:p-8 relative overflow-hidden">
        <div class="absolute -right-10 -bottom-10 opacity-5 pointer-events-none">
          <svg class="w-64 h-64 text-slate-900 dark:text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>

        <div class="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div>
            <p class="text-xs uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400">
              Live Petty Cash In-Hand
            </p>
            <div class="flex items-baseline gap-3 mt-1">
              <span class="text-4xl sm:text-5xl font-black tracking-tight" :class="balanceColorClass">
                {{ formatRupees(wallet?.balance || 0) }}
              </span>
              <span
                class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
                :class="wallet?.balanceType === 'DEBIT' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300'"
              >
                {{ wallet?.balanceLabel || 'Dr (Cash in Hand)' }}
              </span>
            </div>
          </div>
          <div class="text-xs text-slate-400 dark:text-slate-500">
            Real-time balance reconciled with General Ledger
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
            <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
              <span>Total Advances</span>
              <span>📥</span>
            </div>
            <div class="text-xl font-bold text-slate-800 dark:text-slate-100">
              {{ formatRupees(wallet?.totalAdvancesReceived || 0) }}
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">Funds received from office</p>
          </div>

          <div class="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-700">
            <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold mb-1">
              <span>Approved Expenses</span>
              <span>✅</span>
            </div>
            <div class="text-xl font-bold text-slate-800 dark:text-slate-100">
              {{ formatRupees(wallet?.totalExpensesApproved || 0) }}
            </div>
            <p class="text-[11px] text-slate-400 mt-0.5">Settled vouchers in GL</p>
          </div>

          <div class="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60">
            <div class="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1">
              <span>Pending Review</span>
              <span>⏳</span>
            </div>
            <div class="text-xl font-bold text-amber-900 dark:text-amber-300">
              {{ formatRupees(claimStats?.pending?.totalAmount || 0) }}
            </div>
            <p class="text-[11px] text-amber-600 dark:text-amber-400/80 mt-0.5">
              {{ claimStats?.pending?.count || 0 }} claim(s) awaiting approval
            </p>
          </div>
        </div>

        <!-- Quick Action Nav Buttons -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700">
          <NuxtLink
            to="/field/expense"
            class="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition no-underline"
          >
            <span>📝</span>
            <span>Log Expense</span>
          </NuxtLink>

          <NuxtLink
            to="/field/claims"
            class="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 font-bold text-sm transition no-underline"
          >
            <span>📋</span>
            <span>View Claims</span>
          </NuxtLink>

          <NuxtLink
            to="/weather"
            class="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 p-3 rounded-xl bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:hover:bg-cyan-900/40 text-cyan-800 dark:text-cyan-300 font-semibold text-sm transition no-underline border border-cyan-200 dark:border-cyan-800"
          >
            <span>☀️</span>
            <span>Site Weather</span>
          </NuxtLink>
        </div>
      </div>

      <!-- Recent Imprest Transactions Ledger Feed -->
      <div class="mt-8 bg-white dark:bg-slate-800 rounded-2xl shadow-md border border-slate-200/80 dark:border-slate-700 p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-slate-100">
              Recent Imprest Ledger Activity
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              Live entries posted under {{ wallet?.imprestAccountHead || 'your imprest account' }}
            </p>
          </div>
        </div>

        <div v-if="loading && recentTransactions.length === 0" class="py-12 text-center text-slate-400">
          <svg class="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p class="text-sm">Loading ledger history...</p>
        </div>

        <div v-else-if="recentTransactions.length === 0" class="py-12 text-center text-slate-400">
          <span class="text-3xl block mb-2">📄</span>
          <p class="text-sm font-semibold">No transactions recorded yet</p>
          <p class="text-xs text-slate-400 mt-1">Advances given to you and approved expenses will appear here.</p>
        </div>

        <div v-else class="divide-y divide-slate-100 dark:divide-slate-700">
          <div
            v-for="tx in recentTransactions"
            :key="tx.id"
            class="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 px-2 rounded-lg transition"
          >
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-base"
                :class="tx.type === 'DEBIT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'"
              >
                {{ tx.type === 'DEBIT' ? '📥' : '📤' }}
              </div>
              <div>
                <p class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {{ tx.narration || (tx.type === 'DEBIT' ? 'Advance Received' : 'Expense Settled') }}
                </p>
                <div class="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span>{{ tx.date }}</span>
                  <span v-if="tx.voucherNo" class="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.2 rounded text-[11px]">
                    #{{ tx.voucherNo }}
                  </span>
                </div>
              </div>
            </div>

            <div class="text-right shrink-0">
              <span
                class="text-base font-bold"
                :class="tx.type === 'DEBIT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'"
              >
                {{ tx.type === 'DEBIT' ? '+' : '-' }}{{ formatRupees(tx.amount) }}
              </span>
              <p class="text-[10px] text-slate-400 font-mono">
                {{ tx.type === 'DEBIT' ? 'Dr (Advance)' : 'Cr (Expense)' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useSiteWallet } from '~/composables/useSiteWallet';

definePageMeta({
  layout: 'default'
});

const {
  wallet,
  claimStats,
  recentTransactions,
  loading,
  error,
  fetchWallet
} = useSiteWallet();

const loadData = async () => {
  await fetchWallet();
};

const formatRupees = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const balanceColorClass = computed(() => {
  const bal = wallet.value?.balance || 0;
  if (bal > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (bal === 0) return 'text-slate-700 dark:text-slate-200';
  return 'text-amber-600 dark:text-amber-400';
});

onMounted(() => {
  loadData();
});
</script>
