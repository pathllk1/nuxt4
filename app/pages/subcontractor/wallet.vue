<template>
  <div class="space-y-6">
    <!-- Error Notice -->
    <div v-if="error" class="p-4 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs sm:text-sm flex items-center justify-between shadow-sm">
      <div class="flex items-center gap-2">
        <span>⚠️</span>
        <span>{{ error }}</span>
      </div>
      <button @click="error = null" class="font-bold text-red-500 hover:text-red-700 ml-2 cursor-pointer">✕</button>
    </div>

    <!-- Responsive Layout: Stacks on mobile, 12-column grid on desktop -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Left Column (Desktop 7 cols, Full on mobile) -->
      <div class="lg:col-span-7 xl:col-span-8 space-y-5">
        
        <!-- Live Float Hero Card -->
        <div class="bg-gradient-to-br from-indigo-700 via-indigo-800 to-purple-900 rounded-3xl p-5 sm:p-7 text-white shadow-xl relative overflow-hidden">
          <!-- Decorative circle -->
          <div class="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-white/5 pointer-events-none"></div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 text-indigo-100 backdrop-blur-sm border border-white/20">
                Site Imprest Float
              </span>
              <span
                v-if="wallet?.isDeficit"
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white"
              >
                Deficit
              </span>
              <span
                v-else
                class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500 text-white"
              >
                Surplus
              </span>
            </div>

            <button
              @click="loadData"
              :disabled="isLoading"
              class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-xs font-bold text-white transition flex items-center gap-1.5 border border-white/15 cursor-pointer shadow-xs"
            >
              <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': isLoading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>

          <div class="mt-4">
            <p class="text-xs uppercase font-bold tracking-wider text-indigo-200">
              Net Available Cash on Hand
            </p>
            <div class="mt-1 flex items-baseline gap-1.5">
              <span class="text-2xl sm:text-3xl font-bold text-indigo-200">₹</span>
              <span
                class="text-4xl sm:text-5xl font-black font-mono tracking-tight"
                :class="wallet?.isDeficit ? 'text-rose-300' : 'text-white'"
              >
                {{ formatCurrency(Math.abs(wallet?.liveFloat || 0)) }}
              </span>
            </div>
            <p class="text-xs text-indigo-200 mt-2 font-mono flex items-center gap-1.5 truncate">
              <span>Account Head:</span>
              <span class="font-bold text-white">{{ walletData?.subcontractor?.linkedLedgerHead || 'Subcontract Direct Expense' }}</span>
            </p>
          </div>

          <!-- Float Summary Metrics Banner -->
          <div class="mt-6 pt-4 border-t border-white/15 grid grid-cols-3 gap-3 text-center sm:text-left">
            <div class="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p class="text-[10px] sm:text-xs text-indigo-200 uppercase font-bold">Total Received</p>
              <p class="font-black font-mono text-emerald-300 mt-1 text-xs sm:text-base truncate">
                +₹{{ formatCurrency(wallet?.totalNetReceived || 0) }}
              </p>
            </div>
            <div class="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p class="text-[10px] sm:text-xs text-indigo-200 uppercase font-bold">Site Slips Burn</p>
              <p class="font-black font-mono text-amber-300 mt-1 text-xs sm:text-base truncate">
                -₹{{ formatCurrency(wallet?.totalSiteExpenses || 0) }}
              </p>
            </div>
            <div class="bg-white/5 rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p class="text-[10px] sm:text-xs text-indigo-200 uppercase font-bold">TDS (u/s 194C)</p>
              <p class="font-black font-mono text-indigo-200 mt-1 text-xs sm:text-base truncate">
                ₹{{ formatCurrency(wallet?.totalTdsWithheld || 0) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Quick Action Bar -->
        <div class="grid grid-cols-2 gap-3 sm:gap-4">
          <NuxtLink
            to="/subcontractor/expense"
            class="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-slate-950 font-black text-xs sm:text-sm shadow-md hover:shadow-lg transition no-underline cursor-pointer"
          >
            <span class="text-lg">➕</span>
            <span>Record Site Slip</span>
          </NuxtLink>
          <NuxtLink
            to="/subcontractor/expenses"
            class="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 active:scale-98 text-slate-800 dark:text-slate-100 font-bold text-xs sm:text-sm shadow-xs transition no-underline cursor-pointer"
          >
            <span class="text-lg">📋</span>
            <span>All Site Slips ({{ wallet?.totalSlipsCount || 0 }})</span>
          </NuxtLink>
        </div>

        <!-- Category Breakdown Card -->
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Site Expense Breakdown
              </h2>
              <p class="text-[11px] text-slate-400">By category of spending at site</p>
            </div>
            <span class="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
              Total: ₹{{ formatCurrency(wallet?.totalSiteExpenses || 0) }}
            </span>
          </div>

          <div v-if="categoryItems.length === 0" class="text-center py-8 text-slate-400 text-xs">
            No expenses recorded yet. Tap "+ Record Site Slip" to start tracking site spending.
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="cat in categoryItems"
              :key="cat.key"
              class="flex flex-col justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs hover:border-indigo-300 transition"
            >
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ cat.icon }}</span>
                <span class="font-bold text-slate-700 dark:text-slate-300 truncate">{{ cat.label }}</span>
              </div>
              <span class="font-black font-mono text-sm text-slate-900 dark:text-slate-100 mt-2">
                ₹{{ formatCurrency(cat.amount) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Recent Activity Feed (Desktop 5 cols, Full on mobile) -->
      <div class="lg:col-span-5 xl:col-span-4">
        <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 p-5 lg:sticky lg:top-24">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>⚡ Live Activity Feed</span>
              </h2>
              <p class="text-[11px] text-slate-400">Company Payouts & Site Slips</p>
            </div>
            <NuxtLink
              to="/subcontractor/expenses"
              class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline no-underline"
            >
              View All →
            </NuxtLink>
          </div>

          <!-- Activity List -->
          <div v-if="recentActivity.length === 0" class="text-center py-12 text-slate-400 text-xs">
            No activity recorded yet.
          </div>

          <div v-else class="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[580px] overflow-y-auto pr-1">
            <div
              v-for="(item, idx) in recentActivity"
              :key="idx"
              class="py-3 flex items-center justify-between gap-3 text-xs"
            >
              <!-- Left Info -->
              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-xs"
                  :class="item.type === 'PAYOUT' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'"
                >
                  {{ item.type === 'PAYOUT' ? '⬇' : item.icon }}
                </div>
                <div class="min-w-0">
                  <p class="font-bold text-slate-800 dark:text-slate-100 truncate text-xs">
                    {{ item.title }}
                  </p>
                  <p class="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {{ item.subtitle }} • {{ item.date }}
                  </p>
                </div>
              </div>

              <!-- Right Amount & Actions -->
              <div class="text-right shrink-0 flex items-center gap-2">
                <div>
                  <p
                    class="font-black font-mono text-xs sm:text-sm"
                    :class="item.type === 'PAYOUT' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'"
                  >
                    {{ item.type === 'PAYOUT' ? '+' : '-' }}₹{{ formatCurrency(item.amount) }}
                  </p>
                  <p v-if="item.meta" class="text-[10px] text-slate-400 font-mono">
                    {{ item.meta }}
                  </p>
                </div>

                <!-- Delete button for site slip -->
                <button
                  v-if="item.type === 'EXPENSE' && item.id"
                  @click="handleDelete(item.id)"
                  class="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  title="Delete slip"
                >
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubcontractorWallet } from '../../composables/useSubcontractorWallet';

definePageMeta({
  layout: 'subcontractor'
});

const { walletData, isLoading, error, fetchWallet, deleteSlip } = useSubcontractorWallet();

const wallet = computed(() => walletData.value?.wallet);

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  LABOR: { label: 'Labor', icon: '👷' },
  MATERIAL: { label: 'Material', icon: '🧱' },
  FUEL_DIESEL: { label: 'Diesel/Fuel', icon: '⛽' },
  MACHINERY_RENTAL: { label: 'Machinery', icon: '🚜' },
  TRANSPORT: { label: 'Transport', icon: '🚚' },
  FOOD_WELFARE: { label: 'Food/Tea', icon: '☕' },
  REPAIRS: { label: 'Repairs', icon: '🔧' },
  OTHER: { label: 'Other', icon: '📦' }
};

const categoryItems = computed(() => {
  const totals = wallet.value?.categoryTotals || {};
  return Object.entries(totals)
    .filter(([_, amt]) => (amt as number) > 0)
    .map(([key, amt]) => ({
      key,
      label: CATEGORY_MAP[key]?.label || key,
      icon: CATEGORY_MAP[key]?.icon || '📦',
      amount: amt as number
    }))
    .sort((a, b) => b.amount - a.amount);
});

const recentActivity = computed(() => {
  const payouts = (walletData.value?.recentPayouts || []).map((p: any) => ({
    type: 'PAYOUT',
    title: `Payout (${p.voucherNo || 'VOUCHER'})`,
    subtitle: p.narration || `${p.paymentMode || 'BANK'} transfer`,
    amount: p.netAmount,
    meta: p.tdsAmount > 0 ? `TDS: ₹${p.tdsAmount}` : null,
    date: p.transactionDate,
    icon: '💵'
  }));

  const expenses = (walletData.value?.recentExpenses || []).map((e: any) => ({
    type: 'EXPENSE',
    id: e._id,
    title: e.vendorOrPayee || CATEGORY_MAP[e.category]?.label || 'Site Slip',
    subtitle: `${CATEGORY_MAP[e.category]?.label || e.category} • ${e.paymentMode || 'CASH'}`,
    amount: e.amount,
    meta: e.billOrSlipRef ? `Slip #${e.billOrSlipRef}` : null,
    date: e.expenseDate,
    icon: CATEGORY_MAP[e.category]?.icon || '📦'
  }));

  return [...payouts, ...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
});

const formatCurrency = (val: number) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const loadData = async () => {
  try {
    await fetchWallet();
  } catch (e) {
    // Error state managed by composable
  }
};

const handleDelete = async (id: string) => {
  if (confirm('Delete this site expense slip from your wallet?')) {
    try {
      await deleteSlip(id);
    } catch (e) {
      alert('Failed to delete slip');
    }
  }
};

onMounted(() => {
  loadData();
});
</script>
