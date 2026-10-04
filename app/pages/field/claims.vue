<template>
  <div class="min-h-screen bg-slate-50/80 pb-16 font-sans text-slate-800">
    <!-- Top Full-Width Header Banner -->
    <div class="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white shadow-md">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/field/wallet"
            class="p-2 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/30 transition text-white no-underline border border-white/20 shadow-xs flex items-center justify-center"
            title="Back to Field Wallet"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </NuxtLink>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-base sm:text-lg font-black tracking-tight">Site Expense Claims Audit</h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                History & Vouchers
              </span>
            </div>
            <p class="text-xs text-emerald-100 mt-0.5">Real-time status of submitted site expense claims</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <NuxtLink
            to="/chat"
            class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20"
          >
            <span>💬</span>
            <span>1-on-1 Chat</span>
          </NuxtLink>

          <button
            @click="loadClaims"
            :disabled="loading"
            class="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer border border-white/20 flex items-center gap-1 text-xs font-semibold"
            title="Refresh claims"
          >
            <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span class="hidden sm:inline">Refresh</span>
          </button>

          <NuxtLink
            to="/field/expense"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-sm transition active:scale-95 no-underline"
          >
            <span>➕</span>
            <span>Log Expense</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Main Full-Width Content Container -->
    <div class="w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-4">
      <!-- Summary Metric Strip (4 Stat Cards on Desktop) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white rounded-xl p-3 border border-slate-200 shadow-xs">
          <div class="flex items-center justify-between text-[11px] font-bold uppercase text-slate-500">
            <span>Total Claims</span>
            <span>📋</span>
          </div>
          <div class="text-lg sm:text-xl font-black text-slate-900 mt-1">
            {{ formatRupees(totalAmount) }}
          </div>
          <p class="text-[10px] text-slate-400 mt-0.5">{{ claims.length }} total claims submitted</p>
        </div>

        <div class="bg-white rounded-xl p-3 border border-amber-200 shadow-xs bg-gradient-to-br from-white to-amber-50/50">
          <div class="flex items-center justify-between text-[11px] font-bold uppercase text-amber-700">
            <span>In Review</span>
            <span>⏳</span>
          </div>
          <div class="text-lg sm:text-xl font-black text-amber-900 mt-1">
            {{ formatRupees(pendingAmount) }}
          </div>
          <p class="text-[10px] text-amber-700 mt-0.5">{{ pendingCount }} claims pending checker</p>
        </div>

        <div class="bg-white rounded-xl p-3 border border-emerald-200 shadow-xs bg-gradient-to-br from-white to-emerald-50/50">
          <div class="flex items-center justify-between text-[11px] font-bold uppercase text-emerald-700">
            <span>Approved</span>
            <span>✅</span>
          </div>
          <div class="text-lg sm:text-xl font-black text-emerald-800 mt-1">
            {{ formatRupees(approvedAmount) }}
          </div>
          <p class="text-[10px] text-emerald-700 mt-0.5">{{ approvedCount }} claims settled in GL</p>
        </div>

        <div class="bg-white rounded-xl p-3 border border-rose-200 shadow-xs bg-gradient-to-br from-white to-rose-50/50">
          <div class="flex items-center justify-between text-[11px] font-bold uppercase text-rose-700">
            <span>Rejected</span>
            <span>❌</span>
          </div>
          <div class="text-lg sm:text-xl font-black text-rose-900 mt-1">
            {{ formatRupees(rejectedAmount) }}
          </div>
          <p class="text-[10px] text-rose-700 mt-0.5">{{ rejectedCount }} rejected or queried</p>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Filter Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            v-for="tab in filterTabs"
            :key="tab.value"
            @click="selectedTab = tab.value; loadClaims()"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer border"
            :class="selectedTab === tab.value
              ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Search Input -->
        <div class="relative w-full md:w-72">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search narration, vendor, project..."
            class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50/50 focus:bg-white transition"
          />
        </div>
      </div>

      <!-- Main Claims Data Container -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <!-- Loading State -->
        <div v-if="loading && claims.length === 0" class="py-16 text-center text-slate-400">
          <svg class="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p class="text-xs font-semibold">Fetching expense claims...</p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredClaims.length === 0" class="p-12 text-center">
          <span class="text-4xl block mb-2">📋</span>
          <h3 class="text-sm font-bold text-slate-800">No Claims Found</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {{ searchQuery ? 'No claims match your search keywords.' : (selectedTab === 'ALL' ? 'You have not submitted any site claims yet.' : `No claims currently marked as ${selectedTab}.`) }}
          </p>
          <NuxtLink
            to="/field/expense"
            class="inline-flex items-center gap-1.5 mt-4 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition no-underline"
          >
            <span>➕ Record Daily Slip</span>
          </NuxtLink>
        </div>

        <!-- DESKTOP VIEW: High-Density Compact Data Table (Hidden on Mobile, Visible on sm:) -->
        <div v-else class="hidden sm:block overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th class="py-2.5 px-3">Date</th>
                <th class="py-2.5 px-3">Category</th>
                <th class="py-2.5 px-3">Narration / Purpose</th>
                <th class="py-2.5 px-3">Payee / Vendor</th>
                <th class="py-2.5 px-3">Project</th>
                <th class="py-2.5 px-3 text-center">Mode</th>
                <th class="py-2.5 px-3 text-right">Amount (₹)</th>
                <th class="py-2.5 px-3 text-center">Status</th>
                <th class="py-2.5 px-3">Audit Details</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="claim in filteredClaims"
                :key="claim._id"
                class="hover:bg-slate-50/80 transition-colors"
              >
                <!-- Date -->
                <td class="py-2.5 px-3 text-slate-600 font-medium whitespace-nowrap">
                  {{ claim.expenseDate }}
                </td>

                <!-- Category -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span class="text-base">{{ getCategoryIcon(claim.category) }}</span>
                    <span class="font-bold text-slate-800">{{ claim.category }}</span>
                  </div>
                </td>

                <!-- Narration -->
                <td class="py-2.5 px-3 text-slate-800 max-w-xs font-medium truncate" :title="claim.narration">
                  {{ claim.narration }}
                </td>

                <!-- Payee -->
                <td class="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                  {{ claim.partyOrPayeeName || '—' }}
                </td>

                <!-- Project Tag -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <span v-if="claim.projectId" class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                    📍 {{ claim.projectId }}
                  </span>
                  <span v-else class="text-slate-400">—</span>
                </td>

                <!-- Payment Mode -->
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                  <span class="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {{ claim.paymentMode }}
                  </span>
                </td>

                <!-- Amount -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap font-black text-slate-900 text-sm">
                  {{ formatRupees(claim.amount) }}
                </td>

                <!-- Status Badge -->
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                    :class="getStatusBadgeClass(claim.status)"
                  >
                    {{ claim.status }}
                  </span>
                </td>

                <!-- Audit Details -->
                <td class="py-2.5 px-3 text-[11px] text-slate-500 whitespace-nowrap">
                  <div v-if="claim.status === 'APPROVED'" class="flex items-center gap-1.5 text-emerald-700 font-medium">
                    <span>✅ {{ claim.reviewedBy || 'Office' }}</span>
                    <span v-if="claim.reviewedAt">• {{ formatDate(claim.reviewedAt) }}</span>
                  </div>
                  <div v-else-if="claim.status === 'REJECTED'" class="text-rose-700 font-medium truncate max-w-[180px]" :title="claim.rejectionReason">
                    <span>❌ {{ claim.rejectionReason || 'Rejected' }}</span>
                  </div>
                  <span v-else class="text-amber-700 italic">Pending Office Checker</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MOBILE VIEW: Compact Cards (Visible on Mobile, Hidden on sm:) -->
        <div v-if="filteredClaims.length > 0" class="sm:hidden divide-y divide-slate-100">
          <div
            v-for="claim in filteredClaims"
            :key="claim._id"
            class="p-3.5 space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getCategoryIcon(claim.category) }}</span>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-bold text-slate-900">{{ claim.category }}</span>
                    <span
                      class="px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase tracking-wider"
                      :class="getStatusBadgeClass(claim.status)"
                    >
                      {{ claim.status }}
                    </span>
                    <span v-if="claim.projectId" class="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-cyan-50 text-cyan-800">
                      📍 {{ claim.projectId }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-400 mt-0.5">
                    {{ claim.expenseDate }} • {{ claim.paymentMode }}
                    <span v-if="claim.partyOrPayeeName"> • {{ claim.partyOrPayeeName }}</span>
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0">
                <span class="text-sm font-black text-slate-900">
                  {{ formatRupees(claim.amount) }}
                </span>
              </div>
            </div>

            <p class="text-xs text-slate-700 bg-slate-50 p-2 rounded-lg font-medium">
              {{ claim.narration }}
            </p>

            <!-- Reviewer Footer -->
            <div v-if="claim.status === 'APPROVED'" class="text-[10px] text-emerald-700 font-medium flex items-center justify-between">
              <span>✅ Approved by {{ claim.reviewedBy || 'Office' }}</span>
              <span v-if="claim.reviewedAt">{{ formatDate(claim.reviewedAt) }}</span>
            </div>
            <div v-else-if="claim.status === 'REJECTED'" class="text-[10px] text-rose-700 font-medium">
              <span>❌ Reason: {{ claim.rejectionReason || 'Unapproved' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSiteWallet } from '~/composables/useSiteWallet';

definePageMeta({
  layout: 'default'
});

const { claims, loading, fetchClaims } = useSiteWallet();

const selectedTab = ref<string>('ALL');
const searchQuery = ref<string>('');

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
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-800 border border-rose-200';
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

// Summary metrics computed across all claims
const totalAmount = computed(() => {
  return claims.value.reduce((sum, c) => sum + (c.amount || 0), 0);
});

const pendingClaims = computed(() => {
  return claims.value.filter(c => c.status === 'PENDING');
});
const pendingCount = computed(() => pendingClaims.value.length);
const pendingAmount = computed(() => pendingClaims.value.reduce((sum, c) => sum + (c.amount || 0), 0));

const approvedClaims = computed(() => {
  return claims.value.filter(c => c.status === 'APPROVED');
});
const approvedCount = computed(() => approvedClaims.value.length);
const approvedAmount = computed(() => approvedClaims.value.reduce((sum, c) => sum + (c.amount || 0), 0));

const rejectedClaims = computed(() => {
  return claims.value.filter(c => c.status === 'REJECTED');
});
const rejectedCount = computed(() => rejectedClaims.value.length);
const rejectedAmount = computed(() => rejectedClaims.value.reduce((sum, c) => sum + (c.amount || 0), 0));

// Filtered claims based on tab + search query
const filteredClaims = computed(() => {
  let list = claims.value;

  if (selectedTab.value !== 'ALL') {
    list = list.filter(c => c.status === selectedTab.value);
  }

  const q = searchQuery.value.trim().toLowerCase();
  if (q) {
    list = list.filter(c =>
      (c.narration && c.narration.toLowerCase().includes(q)) ||
      (c.partyOrPayeeName && c.partyOrPayeeName.toLowerCase().includes(q)) ||
      (c.projectId && c.projectId.toLowerCase().includes(q)) ||
      (c.category && c.category.toLowerCase().includes(q))
    );
  }

  return list;
});

const loadClaims = async () => {
  const statusParam = selectedTab.value === 'ALL' ? undefined : selectedTab.value;
  await fetchClaims(statusParam);
};

onMounted(() => {
  loadClaims();
});
</script>
