<template>
  <div class="min-h-screen bg-slate-50/80 pb-12 font-sans text-slate-800">
    <!-- Top Full-Width Header Banner -->
    <div class="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white shadow-md">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <!-- Supervisor Identity & Account -->
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-xs">
              👷
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h1 class="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                  {{ wallet?.supervisorName || 'Site Supervisor' }}
                </h1>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                  Site Imprest Portal
                </span>
                <span v-if="wallet?.assignedProjectIds?.length" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 text-white">
                  📍 {{ wallet.assignedProjectIds.join(', ') }}
                </span>
              </div>
              <p class="text-emerald-100 text-xs mt-0.5 flex items-center gap-2 truncate">
                <span>Imprest Head:</span>
                <span class="font-mono bg-black/25 px-2 py-0.5 rounded text-white font-medium text-[11px]">
                  {{ wallet?.imprestAccountHead || 'Advance Account' }}
                </span>
                <span class="text-white/40">•</span>
                <span class="text-emerald-200">Reconciled with General Ledger</span>
              </p>
            </div>
          </div>

          <!-- Quick Action Buttons -->
          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <NuxtLink
              to="/chat"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 active:bg-white/30 text-xs font-bold transition text-white no-underline border border-white/20 shadow-xs"
              title="1-on-1 Direct Chat with Office & Subcontractors"
            >
              <span>💬</span>
              <span>1-on-1 Chat</span>
            </NuxtLink>

            <NuxtLink
              to="/field/expense"
              class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition active:scale-95 no-underline"
            >
              <span>➕</span>
              <span>Log Expense</span>
            </NuxtLink>

            <NuxtLink
              to="/field/claims"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20"
            >
              <span>📋</span>
              <span class="hidden sm:inline">My</span> Claims
            </NuxtLink>

            <button
              @click="loadData"
              :disabled="loading"
              class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-sm transition cursor-pointer border border-white/20 text-white flex items-center gap-1"
              title="Refresh wallet balance"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Full-Width Content Container -->
    <div class="w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-4">
      <!-- Error Alert -->
      <div v-if="error" class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <span>⚠️</span>
          <span>{{ error }}</span>
        </div>
        <button @click="error = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <!-- KPI Stat Cards Grid (4 Columns on Desktop, 2 on Tablet, 1 on Mobile) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <!-- 1. Live Imprest Cash In-Hand -->
        <div class="bg-white rounded-xl p-4 border border-emerald-200 shadow-xs relative overflow-hidden bg-gradient-to-br from-white via-white to-emerald-50/60">
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>Petty Cash In-Hand</span>
            <span class="text-base">👛</span>
          </div>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl sm:text-3xl font-black tracking-tight" :class="balanceColorClass">
              {{ formatRupees(wallet?.balance || 0) }}
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0"
              :class="wallet?.balanceType === 'DEBIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
            >
              {{ wallet?.balanceLabel || 'Dr (Cash in Hand)' }}
            </span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live balance for daily site payments</span>
          </p>
        </div>

        <!-- 2. Total Advances Received -->
        <div class="bg-white rounded-xl p-4 border border-teal-200 shadow-xs bg-gradient-to-br from-white via-white to-teal-50/50">
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>Total Advances</span>
            <span class="text-base">📥</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-teal-800 mt-0.5">
            {{ formatRupees(wallet?.totalAdvancesReceived || 0) }}
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Imprest cash disbursed by office</p>
        </div>

        <!-- 3. Approved Expenses Settled -->
        <div class="bg-white rounded-xl p-4 border border-sky-200 shadow-xs bg-gradient-to-br from-white via-white to-sky-50/50">
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
            <span>Settled Expenses</span>
            <span class="text-base">✅</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-sky-800 mt-0.5">
            {{ formatRupees(wallet?.totalExpensesApproved || 0) }}
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Approved & posted to General Ledger</p>
        </div>

        <!-- 4. Pending Claims Under Review -->
        <div class="bg-white rounded-xl p-4 border border-amber-200 shadow-xs bg-gradient-to-br from-white via-white to-amber-50/60">
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
            <span>Pending Review</span>
            <span class="text-base">⏳</span>
          </div>
          <div class="flex items-baseline gap-2 mt-0.5">
            <span class="text-2xl sm:text-3xl font-black text-amber-900">
              {{ formatRupees(claimStats?.pending?.totalAmount || 0) }}
            </span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0">
              {{ claimStats?.pending?.count || 0 }} slip(s)
            </span>
          </div>
          <p class="text-[11px] text-amber-700 mt-1">Awaiting checker approval in office</p>
        </div>
      </div>

      <!-- Main Desktop Multi-Column Layout (8 : 4 split on lg, single column on mobile) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Left Section (lg:col-span-8): Recent Ledger Feed -->
        <div class="lg:col-span-8 space-y-4">
          <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-4 sm:p-5">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
              <div>
                <h2 class="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>📊</span>
                  <span>Recent Imprest Ledger Transactions</span>
                </h2>
                <p class="text-[11px] text-slate-500">
                  Live entries under {{ wallet?.imprestAccountHead || 'your site imprest account' }}
                </p>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                  Showing {{ recentTransactions.length }} latest
                </span>
                <NuxtLink
                  to="/field/expense"
                  class="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 no-underline"
                >
                  <span>➕ Add Slip</span>
                </NuxtLink>
              </div>
            </div>

            <!-- Loading State -->
            <div v-if="loading && recentTransactions.length === 0" class="py-12 text-center text-slate-400">
              <svg class="w-7 h-7 animate-spin mx-auto text-emerald-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p class="text-xs font-medium">Fetching ledger activity...</p>
            </div>

            <!-- Empty State -->
            <div v-else-if="recentTransactions.length === 0" class="py-10 text-center text-slate-400">
              <span class="text-3xl block mb-2">📄</span>
              <p class="text-xs font-bold text-slate-700">No transactions recorded yet</p>
              <p class="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                Advances received from office and approved expense vouchers will appear here automatically.
              </p>
            </div>

            <!-- DESKTOP VIEW: Compact High-Density Table (hidden on mobile, visible on sm:) -->
            <div v-else class="hidden sm:block overflow-x-auto">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                    <th class="py-2.5 px-3">Date</th>
                    <th class="py-2.5 px-3">Voucher #</th>
                    <th class="py-2.5 px-3">Particulars / Narration</th>
                    <th class="py-2.5 px-3">Account Head</th>
                    <th class="py-2.5 px-3 text-center">Type</th>
                    <th class="py-2.5 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr
                    v-for="tx in recentTransactions"
                    :key="tx.id"
                    class="hover:bg-slate-50/80 transition-colors"
                  >
                    <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap font-medium">
                      {{ tx.date }}
                    </td>
                    <td class="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-indigo-700 font-semibold">
                      #{{ tx.voucherNo || '—' }}
                    </td>
                    <td class="py-2.5 px-3 text-slate-800 font-semibold max-w-xs truncate" :title="tx.narration">
                      {{ tx.narration || (tx.type === 'DEBIT' ? 'Advance Received' : 'Expense Settled') }}
                    </td>
                    <td class="py-2.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {{ tx.accountHead || 'Imprest Cash' }}
                    </td>
                    <td class="py-2.5 px-3 text-center whitespace-nowrap">
                      <span
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold"
                        :class="tx.type === 'DEBIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'"
                      >
                        {{ tx.type === 'DEBIT' ? '📥 Advance' : '📤 Settled' }}
                      </span>
                    </td>
                    <td class="py-2.5 px-3 text-right whitespace-nowrap font-bold" :class="tx.type === 'DEBIT' ? 'text-emerald-700' : 'text-slate-800'">
                      {{ tx.type === 'DEBIT' ? '+' : '-' }}{{ formatRupees(tx.amount) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- MOBILE VIEW: Compact Touch-Friendly Card List (visible on mobile, hidden on sm:) -->
            <div v-if="recentTransactions.length > 0" class="sm:hidden divide-y divide-slate-100">
              <div
                v-for="tx in recentTransactions"
                :key="tx.id"
                class="py-3 flex items-center justify-between gap-3"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div
                    class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm"
                    :class="tx.type === 'DEBIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'"
                  >
                    {{ tx.type === 'DEBIT' ? '📥' : '📤' }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-slate-900 truncate">
                      {{ tx.narration || (tx.type === 'DEBIT' ? 'Advance Received' : 'Expense Settled') }}
                    </p>
                    <div class="flex items-center gap-1.5 text-[10px] text-slate-500 mt-0.5">
                      <span>{{ tx.date }}</span>
                      <span v-if="tx.voucherNo" class="font-mono bg-slate-100 px-1 rounded text-slate-600">
                        #{{ tx.voucherNo }}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <div
                    class="text-xs font-black"
                    :class="tx.type === 'DEBIT' ? 'text-emerald-700' : 'text-slate-900'"
                  >
                    {{ tx.type === 'DEBIT' ? '+' : '-' }}{{ formatRupees(tx.amount) }}
                  </div>
                  <span class="text-[9px] font-bold uppercase text-slate-400">
                    {{ tx.type === 'DEBIT' ? 'Dr (Advance)' : 'Cr (Expense)' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Section (lg:col-span-4): Quick Tools, Claims Health & Guidelines -->
        <div class="lg:col-span-4 space-y-4">
          <!-- Quick Action Shortcuts Card -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center justify-between">
              <span>Site Navigation & Tools</span>
              <span>⚡</span>
            </h3>
            <div class="grid grid-cols-2 gap-2">
              <NuxtLink
                to="/field/expense"
                class="flex flex-col items-center justify-center p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 font-bold text-xs transition no-underline text-center"
              >
                <span class="text-xl mb-1">📝</span>
                <span>Log Expense</span>
              </NuxtLink>

              <NuxtLink
                to="/field/claims"
                class="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs transition no-underline text-center"
              >
                <span class="text-xl mb-1">📋</span>
                <span>Claims History</span>
              </NuxtLink>

              <NuxtLink
                to="/chat"
                class="flex flex-col items-center justify-center p-3 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-900 font-bold text-xs transition no-underline text-center"
              >
                <span class="text-xl mb-1">💬</span>
                <span>1-on-1 Chat</span>
              </NuxtLink>

              <NuxtLink
                to="/ai-chat"
                class="flex flex-col items-center justify-center p-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 font-bold text-xs transition no-underline text-center"
              >
                <span class="text-xl mb-1">✨</span>
                <span>AI Assistant</span>
              </NuxtLink>
            </div>
          </div>

          <!-- Claims Review Status Card -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">
                Claims Pipeline
              </h3>
              <NuxtLink to="/field/claims" class="text-[11px] font-bold text-emerald-700 hover:underline no-underline">
                View All →
              </NuxtLink>
            </div>

            <div class="space-y-2.5">
              <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-amber-50 border border-amber-200">
                <div class="flex items-center gap-2">
                  <span>⏳</span>
                  <span class="font-bold text-amber-900">Pending Review</span>
                </div>
                <div class="text-right">
                  <span class="font-black text-amber-900">{{ claimStats?.pending?.count || 0 }} slips</span>
                  <span class="block text-[10px] text-amber-700">{{ formatRupees(claimStats?.pending?.totalAmount || 0) }}</span>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                <div class="flex items-center gap-2">
                  <span>✅</span>
                  <span class="font-bold text-emerald-900">Approved & Posted</span>
                </div>
                <div class="text-right">
                  <span class="font-black text-emerald-900">{{ claimStats?.approved?.count || 0 }} slips</span>
                  <span class="block text-[10px] text-emerald-700">{{ formatRupees(claimStats?.approved?.totalAmount || 0) }}</span>
                </div>
              </div>

              <div v-if="claimStats?.rejected?.count" class="flex items-center justify-between text-xs p-2 rounded-lg bg-rose-50 border border-rose-200">
                <div class="flex items-center gap-2">
                  <span>❌</span>
                  <span class="font-bold text-rose-900">Rejected / Queries</span>
                </div>
                <div class="text-right">
                  <span class="font-black text-rose-900">{{ claimStats.rejected.count }} slips</span>
                  <span class="block text-[10px] text-rose-700">{{ formatRupees(claimStats.rejected.totalAmount || 0) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Section 40A(3) Compliance Card -->
          <div class="bg-gradient-to-br from-amber-50 to-orange-50/60 rounded-xl border border-amber-200 p-4 shadow-xs">
            <div class="flex items-start gap-2.5">
              <span class="text-lg shrink-0">⚖️</span>
              <div>
                <h4 class="text-xs font-bold text-amber-950 uppercase tracking-wide">
                  Sec 40A(3) Cash Guidance
                </h4>
                <p class="text-[11px] text-amber-900 mt-1 leading-relaxed">
                  Single cash payments above <strong>₹10,000</strong> per vendor/day are disallowed by Income Tax. Always prefer UPI or split vouchers as approved by project management.
                </p>
              </div>
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
  if (bal > 0) return 'text-emerald-700';
  if (bal === 0) return 'text-slate-800';
  return 'text-amber-700';
});

onMounted(() => {
  loadData();
});
</script>
