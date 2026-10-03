<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-16">
    <!-- Header -->
    <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white shadow-md">
      <div class="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/field/wallet"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer text-white no-underline"
            title="Back to Wallet"
          >
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight">My Expense Claims</h1>
            <p class="text-xs text-emerald-100">Audit status of your submitted site claims</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="loadClaims"
            :disabled="loading"
            class="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/20"
            title="Refresh claims"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <NuxtLink
            to="/field/expense"
            class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-xs shadow transition no-underline"
          >
            <span>➕ New Claim</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Filter Tabs Container -->
    <div class="max-w-4xl mx-auto px-4 mt-6">
      <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          v-for="tab in filterTabs"
          :key="tab.value"
          @click="selectedTab = tab.value; loadClaims()"
          class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer border"
          :class="selectedTab === tab.value
            ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white border-transparent shadow'
            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="loading && claims.length === 0" class="mt-8 py-16 text-center text-slate-400">
        <svg class="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p class="text-sm font-medium">Fetching claims...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="claims.length === 0" class="mt-8 bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-200/80 dark:border-slate-700 shadow-sm">
        <span class="text-4xl block mb-2">📋</span>
        <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">No Claims Found</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          {{ selectedTab === 'ALL' ? 'You haven\'t logged any site expenses yet.' : `No claims currently marked as ${selectedTab}.` }}
        </p>
        <NuxtLink
          to="/field/expense"
          class="inline-flex items-center gap-1.5 mt-5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition no-underline"
        >
          <span>➕ Log First Expense</span>
        </NuxtLink>
      </div>

      <!-- Claims Feed -->
      <div v-else class="mt-4 space-y-3">
        <div
          v-for="claim in claims"
          :key="claim._id"
          class="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-700 shadow-sm hover:shadow transition"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xl shrink-0">
                {{ getCategoryIcon(claim.category) }}
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-bold text-slate-900 dark:text-white">
                    {{ claim.category }}
                  </span>
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                    :class="getStatusBadgeClass(claim.status)"
                  >
                    {{ claim.status }}
                  </span>
                  <span v-if="claim.projectId" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">
                    📍 {{ claim.projectId }}
                  </span>
                </div>
                <p class="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {{ claim.narration }}
                </p>
                <div class="flex items-center gap-3 text-[11px] text-slate-400 mt-2 flex-wrap">
                  <span>📅 {{ claim.expenseDate }}</span>
                  <span>💳 {{ claim.paymentMode }}</span>
                  <span v-if="claim.partyOrPayeeName">👤 {{ claim.partyOrPayeeName }}</span>
                </div>
              </div>
            </div>

            <!-- Amount -->
            <div class="text-right shrink-0">
              <div class="text-lg font-black text-slate-900 dark:text-white">
                {{ formatRupees(claim.amount) }}
              </div>
              <span class="text-[10px] text-slate-400 block font-mono">
                {{ claim.targetAccountHead }}
              </span>
            </div>
          </div>

          <!-- Reviewer Footer / Reason Banner -->
          <div
            v-if="claim.status === 'APPROVED'"
            class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-400"
          >
            <div class="flex items-center gap-1.5">
              <span>✅ Approved by {{ claim.reviewedBy || 'Office' }}</span>
              <span v-if="claim.reviewedAt">• {{ formatDate(claim.reviewedAt) }}</span>
            </div>
            <span v-if="claim.generatedVoucherGroupId" class="font-mono text-[10px] bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
              GL Posted
            </span>
          </div>

          <div
            v-else-if="claim.status === 'REJECTED'"
            class="mt-3 pt-3 border-t border-red-100 dark:border-red-900/40 text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5"
          >
            <span>❌</span>
            <div>
              <span class="font-bold">Rejected by {{ claim.reviewedBy || 'Reviewer' }}:</span>
              <span class="ml-1 italic">"{{ claim.rejectionReason || 'No reason specified' }}"</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSiteWallet } from '~/composables/useSiteWallet';

definePageMeta({
  layout: 'default'
});

const { claims, loading, fetchClaims } = useSiteWallet();

const selectedTab = ref<string>('ALL');

const filterTabs = [
  { value: 'ALL', label: 'All Claims' },
  { value: 'PENDING', label: '⏳ In Review' },
  { value: 'APPROVED', label: '✅ Approved' },
  { value: 'REJECTED', label: '❌ Rejected' }
];

const categoryIcons: Record<string, string> = {
  LABOUR: '👷',
  WELFARE: '☕',
  MATERIAL: '🧱',
  TRANSPORT: '🚚',
  FUEL: '⛽',
  REPAIRS: '🔧',
  OTHER: '📦'
};

const getCategoryIcon = (category: string) => categoryIcons[category] || '📦';

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300';
    default:
      return 'bg-slate-100 text-slate-800';
  }
};

const formatRupees = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(amount || 0);
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

const loadClaims = async () => {
  const statusParam = selectedTab.value === 'ALL' ? undefined : selectedTab.value;
  await fetchClaims(statusParam);
};

onMounted(() => {
  loadClaims();
});
</script>
