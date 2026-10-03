<template>
  <div class="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
    <!-- Top Header -->
    <div class="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              <NuxtLink to="/accounting/ledger" class="hover:underline text-slate-600 dark:text-slate-300">
                Accounting
              </NuxtLink>
              <span>/</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-bold">Imprest Approvals</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>⚖️</span>
              <span>Site Imprest Maker-Checker</span>
            </h1>
            <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Review and audit supervisor field expenses. Approving automatically writes balanced double-entry Journal Vouchers to the General Ledger.
            </p>
          </div>

          <div class="flex items-center gap-3">
            <button
              @click="loadData"
              :disabled="loading"
              class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer border border-slate-300 dark:border-slate-600"
              title="Refresh claims"
            >
              <svg class="w-4 h-4" :class="{ 'animate-spin': loading }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Container -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
      <!-- Alerts -->
      <div v-if="actionSuccess" class="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span>✅</span>
          <span>{{ actionSuccess }}</span>
        </div>
        <button @click="actionSuccess = null" class="font-bold text-emerald-600 hover:text-emerald-800">✕</button>
      </div>

      <div v-if="actionError" class="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center justify-between">
        <span>{{ actionError }}</span>
        <button @click="actionError = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <!-- Metric KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          @click="filters.status = 'PENDING'; loadData()"
          class="p-5 rounded-2xl bg-white dark:bg-slate-800 border transition cursor-pointer hover:shadow-md"
          :class="filters.status === 'PENDING' ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200 dark:border-slate-700'"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Pending Verification
            </span>
            <span class="text-xl">⏳</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {{ formatRupees(stats.pending.totalAmount) }}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            {{ stats.pending.count }} claim(s) awaiting approval
          </p>
        </div>

        <div
          @click="filters.status = 'APPROVED'; loadData()"
          class="p-5 rounded-2xl bg-white dark:bg-slate-800 border transition cursor-pointer hover:shadow-md"
          :class="filters.status === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700'"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Approved & Posted
            </span>
            <span class="text-xl">✅</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {{ formatRupees(stats.approved.totalAmount) }}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            {{ stats.approved.count }} claim(s) settled in GL
          </p>
        </div>

        <div
          @click="filters.status = 'REJECTED'; loadData()"
          class="p-5 rounded-2xl bg-white dark:bg-slate-800 border transition cursor-pointer hover:shadow-md"
          :class="filters.status === 'REJECTED' ? 'border-red-400 ring-2 ring-red-400/20' : 'border-slate-200 dark:border-slate-700'"
        >
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">
              Rejected
            </span>
            <span class="text-xl">❌</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2">
            {{ formatRupees(stats.rejected.totalAmount) }}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            {{ stats.rejected.count }} claim(s) rejected
          </p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mb-6 space-y-3">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          <!-- Search input -->
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              v-model="filters.search"
              @input="debounceSearch"
              type="text"
              placeholder="Search narration, supervisor, payee, or account head..."
              class="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Supervisor Filter -->
            <select
              v-model="filters.supervisorId"
              @change="loadData"
              class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Supervisors</option>
              <option v-for="sup in supervisors" :key="sup.id" :value="sup.id">
                {{ sup.name }} ({{ sup.pendingCount }} pending)
              </option>
            </select>

            <!-- Status Filter -->
            <select
              v-model="filters.status"
              @change="loadData"
              class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved Only</option>
              <option value="REJECTED">Rejected Only</option>
              <option value="ALL">All Statuses</option>
            </select>

            <!-- Project Filter -->
            <select
              v-if="projects.length > 0"
              v-model="filters.projectId"
              @change="loadData"
              class="px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Projects</option>
              <option v-for="proj in projects" :key="proj" :value="proj">
                {{ proj }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <!-- Batch Actions Sticky Bar -->
      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="transform -translate-y-2 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-2 opacity-0"
      >
        <div
          v-if="selectedPendingIds.length > 0"
          class="sticky top-4 z-30 mb-6 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-700"
        >
          <div class="flex items-center gap-3">
            <span class="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs">
              {{ selectedPendingIds.length }}
            </span>
            <div>
              <p class="text-sm font-bold">
                {{ selectedPendingIds.length }} claim(s) selected
              </p>
              <p class="text-xs text-slate-400">
                Total: <strong class="text-emerald-400">{{ formatRupees(selectedTotalAmount) }}</strong>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button
              @click="handleBatchApprove"
              :disabled="actionInProgress"
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border-0"
            >
              <span>✅ Approve & Post GL</span>
            </button>
            <button
              @click="openRejectModal(selectedPendingIds)"
              :disabled="actionInProgress"
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border-0"
            >
              <span>❌ Reject Selected</span>
            </button>
            <button
              @click="selectedIds = []"
              class="p-2 text-slate-400 hover:text-white transition text-xs font-semibold"
            >
              Clear
            </button>
          </div>
        </div>
      </transition>

      <!-- Table Section -->
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div v-if="loading && claims.length === 0" class="py-20 text-center text-slate-400">
          <svg class="w-8 h-8 animate-spin mx-auto text-emerald-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p class="text-sm font-semibold">Loading site expense claims...</p>
        </div>

        <div v-else-if="claims.length === 0" class="py-20 text-center text-slate-400">
          <span class="text-4xl block mb-2">🎉</span>
          <h3 class="text-base font-bold text-slate-800 dark:text-slate-100">All Caught Up!</h3>
          <p class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            No claims found for the selected filter criteria.
          </p>
        </div>

        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th class="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    :checked="allPendingSelected"
                    :disabled="pendingClaims.length === 0"
                    @change="toggleSelectAll"
                    class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </th>
                <th class="py-3 px-4">Date / Supervisor</th>
                <th class="py-3 px-4">Category / Narration</th>
                <th class="py-3 px-4">Payee / Project</th>
                <th class="py-3 px-4">Target Account Head</th>
                <th class="py-3 px-4 text-right">Amount</th>
                <th class="py-3 px-4 text-center">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-700 text-xs">
              <tr
                v-for="claim in claims"
                :key="claim._id"
                class="hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition"
                :class="{ 'bg-emerald-50/30 dark:bg-emerald-950/20': selectedIds.includes(claim._id) }"
              >
                <!-- Checkbox -->
                <td class="py-3 px-4">
                  <input
                    v-if="claim.status === 'PENDING'"
                    type="checkbox"
                    :value="claim._id"
                    v-model="selectedIds"
                    class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </td>

                <!-- Date / Supervisor -->
                <td class="py-3 px-4">
                  <div class="font-bold text-slate-900 dark:text-white">
                    {{ claim.supervisorName }}
                  </div>
                  <div class="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>📅 {{ claim.expenseDate }}</span>
                    <span>•</span>
                    <span class="font-mono text-[10px] text-slate-500 truncate max-w-[130px]" :title="claim.imprestAccountHead">
                      {{ claim.imprestAccountHead }}
                    </span>
                  </div>
                </td>

                <!-- Category / Narration -->
                <td class="py-3 px-4 max-w-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-base">{{ getCategoryIcon(claim.category) }}</span>
                    <span class="font-bold text-slate-800 dark:text-slate-100">
                      {{ claim.category }}
                    </span>
                  </div>
                  <p class="text-slate-600 dark:text-slate-300 mt-1 line-clamp-2" :title="claim.narration">
                    {{ claim.narration }}
                  </p>
                </td>

                <!-- Payee / Project -->
                <td class="py-3 px-4 whitespace-nowrap">
                  <div v-if="claim.partyOrPayeeName" class="text-slate-800 dark:text-slate-200 font-semibold">
                    👤 {{ claim.partyOrPayeeName }}
                  </div>
                  <div v-else class="text-slate-400 italic">Direct</div>

                  <div v-if="claim.projectId" class="mt-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300">
                      📍 {{ claim.projectId }}
                    </span>
                  </div>
                </td>

                <!-- Target Account Head (Editable override if PENDING) -->
                <td class="py-3 px-4 min-w-[200px]">
                  <div v-if="claim.status === 'PENDING'">
                    <input
                      v-model="accountHeadOverrides[claim._id]"
                      type="text"
                      :placeholder="claim.targetAccountHead"
                      class="w-full px-2.5 py-1 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <span class="text-[10px] text-slate-400 block mt-0.5">
                      Default: {{ claim.targetAccountHead }}
                    </span>
                  </div>
                  <div v-else class="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                    {{ claim.targetAccountHead }}
                  </div>
                </td>

                <!-- Amount -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <div class="font-black text-sm text-slate-900 dark:text-white">
                    {{ formatRupees(claim.amount) }}
                  </div>
                  <span class="text-[10px] font-bold px-1.5 py-0.2 rounded" :class="claim.paymentMode === 'CASH' && claim.amount > 10000 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400'">
                    {{ claim.paymentMode }}
                  </span>
                </td>

                <!-- Status -->
                <td class="py-3 px-4 text-center whitespace-nowrap">
                  <span
                    class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                    :class="getStatusBadgeClass(claim.status)"
                  >
                    {{ claim.status }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <div v-if="claim.status === 'PENDING'" class="flex items-center justify-end gap-1.5">
                    <button
                      @click="handleSingleApprove(claim._id)"
                      :disabled="actionInProgress"
                      class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer border-0"
                      title="Approve and post double-entry voucher"
                    >
                      Approve
                    </button>
                    <button
                      @click="openRejectModal([claim._id])"
                      :disabled="actionInProgress"
                      class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-600 hover:text-red-600 font-bold text-xs transition cursor-pointer border border-slate-200 dark:border-slate-600"
                      title="Reject claim"
                    >
                      Reject
                    </button>
                  </div>

                  <div v-else-if="claim.status === 'APPROVED'" class="text-right text-[11px] text-slate-400">
                    <span v-if="claim.generatedVoucherGroupId" class="font-mono bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded">
                      Voucher Posted
                    </span>
                    <span v-else>Approved</span>
                  </div>

                  <div v-else-if="claim.status === 'REJECTED'" class="text-right text-[11px] text-red-500" :title="claim.rejectionReason">
                    {{ claim.rejectionReason || 'Rejected' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Rejection Modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700">
        <h3 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <span>❌</span>
          <span>Reject Expense Claim(s)</span>
        </h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Rejecting {{ rejectingIds.length }} claim(s). Please provide a reason for the site supervisor.
        </p>

        <div class="mt-4">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
            Reason for Rejection
          </label>
          <textarea
            v-model="rejectReason"
            rows="3"
            placeholder="e.g. Missing bill/slip photo, rate appears too high, duplicate claim..."
            class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            @click="showRejectModal = false"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmReject"
            :disabled="actionInProgress"
            class="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white transition shadow cursor-pointer border-0"
          >
            Confirm Rejection
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useAuth } from '~/composables/useAuth';

definePageMeta({
  layout: 'default'
});

const { apiFetch } = useAuth();

const loading = ref(false);
const actionInProgress = ref(false);
const actionSuccess = ref<string | null>(null);
const actionError = ref<string | null>(null);

const claims = ref<any[]>([]);
const supervisors = ref<any[]>([]);
const projects = ref<string[]>([]);
const selectedIds = ref<string[]>([]);
const accountHeadOverrides = reactive<Record<string, string>>({});

// Rejection modal state
const showRejectModal = ref(false);
const rejectingIds = ref<string[]>([]);
const rejectReason = ref('');

const stats = reactive({
  pending: { count: 0, totalAmount: 0 },
  approved: { count: 0, totalAmount: 0 },
  rejected: { count: 0, totalAmount: 0 }
});

const filters = reactive({
  status: 'PENDING',
  supervisorId: '',
  projectId: '',
  search: ''
});

let searchTimeout: any = null;
const debounceSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    loadData();
  }, 300);
};

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

const pendingClaims = computed(() => {
  return claims.value.filter(c => c.status === 'PENDING');
});

const selectedPendingIds = computed(() => {
  return selectedIds.value.filter(id => {
    const claim = claims.value.find(c => c._id === id);
    return claim && claim.status === 'PENDING';
  });
});

const selectedTotalAmount = computed(() => {
  return selectedPendingIds.value.reduce((sum, id) => {
    const claim = claims.value.find(c => c._id === id);
    return sum + (claim?.amount || 0);
  }, 0);
});

const allPendingSelected = computed(() => {
  return (
    pendingClaims.value.length > 0 &&
    pendingClaims.value.every(c => selectedIds.value.includes(c._id))
  );
});

const toggleSelectAll = () => {
  if (allPendingSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = pendingClaims.value.map(c => c._id);
  }
};

const loadData = async () => {
  loading.value = true;
  actionError.value = null;
  try {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.supervisorId) params.set('supervisorId', filters.supervisorId);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.search) params.set('search', filters.search);

    const res = await apiFetch<any>(`/api/accounting/imprest-approvals?${params.toString()}`);
    if (res?.success && res.data) {
      claims.value = res.data.claims || [];
      supervisors.value = res.data.supervisors || [];
      projects.value = res.data.projects || [];
      if (res.data.stats) {
        stats.pending = res.data.stats.pending || { count: 0, totalAmount: 0 };
        stats.approved = res.data.stats.approved || { count: 0, totalAmount: 0 };
        stats.rejected = res.data.stats.rejected || { count: 0, totalAmount: 0 };
      }

      // Pre-fill accountHeadOverrides with default targetAccountHead
      for (const claim of claims.value) {
        if (!accountHeadOverrides[claim._id]) {
          accountHeadOverrides[claim._id] = claim.targetAccountHead;
        }
      }
    }
  } catch (err: any) {
    actionError.value = err?.data?.statusMessage || err?.statusMessage || 'Failed to fetch claims';
  } finally {
    loading.value = false;
  }
};

const handleSingleApprove = async (claimId: string) => {
  await approveClaims([claimId]);
};

const handleBatchApprove = async () => {
  if (selectedPendingIds.value.length === 0) return;
  await approveClaims(selectedPendingIds.value);
};

const approveClaims = async (ids: string[]) => {
  actionInProgress.value = true;
  actionError.value = null;
  actionSuccess.value = null;

  try {
    const overrides: Record<string, { targetAccountHead?: string }> = {};
    for (const id of ids) {
      if (accountHeadOverrides[id]) {
        overrides[id] = { targetAccountHead: accountHeadOverrides[id] };
      }
    }

    const res = await apiFetch<any>('/api/accounting/imprest-approvals/approve', {
      method: 'POST',
      body: {
        claimIds: ids,
        overrides
      }
    });

    if (res?.success) {
      actionSuccess.value = res.message || `Successfully approved ${ids.length} claim(s)`;
      selectedIds.value = selectedIds.value.filter(id => !ids.includes(id));
      await loadData();
    }
  } catch (err: any) {
    actionError.value = err?.data?.statusMessage || err?.statusMessage || 'Approval failed';
  } finally {
    actionInProgress.value = false;
  }
};

const openRejectModal = (ids: string[]) => {
  rejectingIds.value = ids;
  rejectReason.value = '';
  showRejectModal.value = true;
};

const confirmReject = async () => {
  if (rejectingIds.value.length === 0) return;

  actionInProgress.value = true;
  actionError.value = null;
  try {
    const res = await apiFetch<any>('/api/accounting/imprest-approvals/reject', {
      method: 'POST',
      body: {
        claimIds: rejectingIds.value,
        rejectionReason: rejectReason.value
      }
    });

    if (res?.success) {
      showRejectModal.value = false;
      actionSuccess.value = `Rejected ${res.data?.rejectedCount || rejectingIds.value.length} claim(s)`;
      selectedIds.value = selectedIds.value.filter(id => !rejectingIds.value.includes(id));
      await loadData();
    }
  } catch (err: any) {
    actionError.value = err?.data?.statusMessage || err?.statusMessage || 'Rejection failed';
  } finally {
    actionInProgress.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>
