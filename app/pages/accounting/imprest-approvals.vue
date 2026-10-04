<template>
  <div class="min-h-screen bg-slate-50/80 pb-20 font-sans text-slate-800">
    <!-- Top Full-Width Header Banner -->
    <div class="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white shadow-md">
      <div class="w-full px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 text-xs font-semibold text-emerald-100 mb-0.5">
              <NuxtLink to="/accounting/ledger" class="hover:underline text-white no-underline">
                Accounting
              </NuxtLink>
              <span>/</span>
              <span class="text-amber-300 font-bold">Imprest Approvals</span>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-base sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span>⚖️</span>
                <span>Site Imprest Maker-Checker</span>
              </h1>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                Maker-Checker Audit
              </span>
            </div>
            <p class="text-xs text-emerald-100 mt-0.5">
              Review supervisor site expenses. Approving auto-posts balanced double-entry vouchers to General Ledger.
            </p>
          </div>

          <div class="flex items-center gap-2 flex-wrap shrink-0">
            <NuxtLink
              to="/accounting/subcontractor-monitoring"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20 shadow-xs"
              title="Subcontractors & Direct Expenses"
            >
              <span>🏗️</span>
              <span>Subcontractors Float</span>
            </NuxtLink>

            <NuxtLink
              to="/chat"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-bold transition text-white no-underline border border-white/20"
              title="Direct Chat with Field Supervisors"
            >
              <span>💬</span>
              <span>1-on-1 Chat</span>
            </NuxtLink>

            <button
              @click="loadData"
              :disabled="loading"
              class="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold transition cursor-pointer border border-white/20 text-white"
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

    <!-- Main Full-Width Content Container -->
    <div class="w-full px-4 sm:px-6 lg:px-8 mt-4 space-y-4">
      <!-- Alerts -->
      <div v-if="actionSuccess" class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <span>✅</span>
          <span>{{ actionSuccess }}</span>
        </div>
        <button @click="actionSuccess = null" class="font-bold text-emerald-600 hover:text-emerald-800">✕</button>
      </div>

      <div v-if="actionError" class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2">
          <span>⚠️</span>
          <span>{{ actionError }}</span>
        </div>
        <button @click="actionError = null" class="font-bold text-red-500 hover:text-red-700">✕</button>
      </div>

      <!-- Compact 3-Column Metric KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div
          @click="filters.status = 'PENDING'; loadData()"
          class="p-4 rounded-xl bg-white border transition cursor-pointer hover:shadow-md bg-gradient-to-br from-white to-amber-50/60 shadow-xs"
          :class="filters.status === 'PENDING' ? 'border-amber-400 ring-2 ring-amber-400/20' : 'border-slate-200'"
        >
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-amber-700">
            <span>Pending Verification</span>
            <span class="text-lg">⏳</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-amber-900 mt-1">
            {{ formatRupees(stats.pending.totalAmount) }}
          </div>
          <p class="text-[11px] text-amber-700 mt-0.5 font-semibold">
            {{ stats.pending.count }} claim(s) awaiting approval
          </p>
        </div>

        <div
          @click="filters.status = 'APPROVED'; loadData()"
          class="p-4 rounded-xl bg-white border transition cursor-pointer hover:shadow-md bg-gradient-to-br from-white to-emerald-50/50 shadow-xs"
          :class="filters.status === 'APPROVED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'"
        >
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-emerald-700">
            <span>Approved & Posted</span>
            <span class="text-lg">✅</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-emerald-800 mt-1">
            {{ formatRupees(stats.approved.totalAmount) }}
          </div>
          <p class="text-[11px] text-emerald-700 mt-0.5 font-semibold">
            {{ stats.approved.count }} claim(s) settled in GL
          </p>
        </div>

        <div
          @click="filters.status = 'REJECTED'; loadData()"
          class="p-4 rounded-xl bg-white border transition cursor-pointer hover:shadow-md bg-gradient-to-br from-white to-rose-50/50 shadow-xs"
          :class="filters.status === 'REJECTED' ? 'border-red-400 ring-2 ring-red-400/20' : 'border-slate-200'"
        >
          <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-rose-700">
            <span>Rejected</span>
            <span class="text-lg">❌</span>
          </div>
          <div class="text-2xl sm:text-3xl font-black text-rose-900 mt-1">
            {{ formatRupees(stats.rejected.totalAmount) }}
          </div>
          <p class="text-[11px] text-rose-700 mt-0.5 font-semibold">
            {{ stats.rejected.count }} claim(s) returned with query
          </p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div class="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
          <!-- Search input -->
          <div class="relative flex-1">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              v-model="filters.search"
              @input="debounceSearch"
              type="text"
              placeholder="Search narration, supervisor, payee, or account head..."
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-slate-50/50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white transition"
            />
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Supervisor Filter -->
            <select
              v-model="filters.supervisorId"
              @change="loadData"
              class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              class="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
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
          class="sticky top-14 z-30 p-3.5 rounded-xl bg-slate-900 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 border border-slate-700"
        >
          <div class="flex items-center gap-3">
            <span class="w-7 h-7 rounded-full bg-emerald-400 text-slate-950 font-black flex items-center justify-center text-xs">
              {{ selectedPendingIds.length }}
            </span>
            <div>
              <p class="text-xs font-bold text-white">
                {{ selectedPendingIds.length }} claim(s) selected for audit
              </p>
              <p class="text-[11px] text-slate-300">
                Total Amount: <strong class="text-emerald-300">{{ formatRupees(selectedTotalAmount) }}</strong>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button
              @click="handleBatchApprove"
              :disabled="actionInProgress"
              class="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-sm"
            >
              <span>✅ Approve & Post GL</span>
            </button>
            <button
              @click="openRejectModal(selectedPendingIds)"
              :disabled="actionInProgress"
              class="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border-0 shadow-sm"
            >
              <span>❌ Reject Selected</span>
            </button>
            <button
              @click="selectedIds = []"
              class="p-1.5 text-slate-400 hover:text-white transition text-xs font-semibold cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>
      </transition>

      <!-- Table Section -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div v-if="loading && claims.length === 0" class="py-16 text-center text-slate-400">
          <svg class="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p class="text-xs font-semibold">Loading site expense claims...</p>
        </div>

        <div v-else-if="claims.length === 0" class="py-16 text-center text-slate-400">
          <span class="text-4xl block mb-2">🎉</span>
          <h3 class="text-sm font-bold text-slate-800">All Caught Up!</h3>
          <p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No claims found for the selected filter criteria.
          </p>
        </div>

        <!-- DESKTOP VIEW: High-Density Compact Table (Hidden on mobile, Visible on sm:) -->
        <div v-else class="hidden sm:block overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <th class="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    :checked="allPendingSelected"
                    :disabled="pendingClaims.length === 0"
                    @change="toggleSelectAll"
                    class="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </th>
                <th class="py-2.5 px-3">Date / Supervisor</th>
                <th class="py-2.5 px-3">Category / Narration</th>
                <th class="py-2.5 px-3">Payee / Project</th>
                <th class="py-2.5 px-3">Target Account Head</th>
                <th class="py-2.5 px-3 text-right">Amount (₹)</th>
                <th class="py-2.5 px-3 text-center">Status</th>
                <th class="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr
                v-for="claim in claims"
                :key="claim._id"
                class="hover:bg-slate-50/80 transition-colors"
                :class="{ 'bg-emerald-50/40': selectedIds.includes(claim._id) }"
              >
                <!-- Checkbox -->
                <td class="py-2.5 px-3">
                  <input
                    v-if="claim.status === 'PENDING'"
                    type="checkbox"
                    :value="claim._id"
                    v-model="selectedIds"
                    class="rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                </td>

                <!-- Date / Supervisor -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div class="font-bold text-slate-900">
                    {{ claim.supervisorName }}
                  </div>
                  <div class="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>📅 {{ claim.expenseDate }}</span>
                    <span>•</span>
                    <span class="font-mono text-slate-600 truncate max-w-[120px]" :title="claim.imprestAccountHead">
                      {{ claim.imprestAccountHead }}
                    </span>
                  </div>
                </td>

                <!-- Category / Narration -->
                <td class="py-2.5 px-3 max-w-xs">
                  <div class="flex items-center gap-1.5">
                    <span class="text-base">{{ getCategoryIcon(claim.category) }}</span>
                    <span class="font-bold text-slate-800">
                      {{ claim.category }}
                    </span>
                  </div>
                  <p class="text-slate-600 mt-0.5 font-medium truncate" :title="claim.narration">
                    {{ claim.narration }}
                  </p>
                </td>

                <!-- Payee / Project -->
                <td class="py-2.5 px-3 whitespace-nowrap">
                  <div v-if="claim.partyOrPayeeName" class="text-slate-800 font-semibold">
                    👤 {{ claim.partyOrPayeeName }}
                  </div>
                  <div v-else class="text-slate-400 italic">Direct</div>

                  <div v-if="claim.projectId" class="mt-0.5">
                    <span class="px-1.5 py-0.2 rounded-full text-[9px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200">
                      📍 {{ claim.projectId }}
                    </span>
                  </div>
                </td>

                <!-- Target Account Head (Editable override if PENDING) -->
                <td class="py-2.5 px-3 min-w-[180px]">
                  <div v-if="claim.status === 'PENDING'">
                    <input
                      v-model="accountHeadOverrides[claim._id]"
                      type="text"
                      :placeholder="claim.targetAccountHead"
                      class="w-full px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <span class="text-[9px] text-slate-400 block mt-0.5">
                      Default: {{ claim.targetAccountHead }}
                    </span>
                  </div>
                  <div v-else class="font-mono text-[11px] text-slate-700">
                    {{ claim.targetAccountHead }}
                  </div>
                </td>

                <!-- Amount -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                  <div class="font-black text-sm text-slate-900">
                    {{ formatRupees(claim.amount) }}
                  </div>
                  <span class="text-[9px] font-bold px-1.5 py-0.2 rounded" :class="claim.paymentMode === 'CASH' && claim.amount > 10000 ? 'bg-amber-100 text-amber-800 font-bold' : 'text-slate-400'">
                    {{ claim.paymentMode }}
                  </span>
                </td>

                <!-- Status -->
                <td class="py-2.5 px-3 text-center whitespace-nowrap">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
                    :class="getStatusBadgeClass(claim.status)"
                  >
                    {{ claim.status }}
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                  <div v-if="claim.status === 'PENDING'" class="flex items-center justify-end gap-1.5">
                    <button
                      @click="handleSingleApprove(claim._id)"
                      :disabled="actionInProgress"
                      class="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer border-0 shadow-2xs"
                      title="Approve and post double-entry voucher"
                    >
                      Approve
                    </button>
                    <button
                      @click="openRejectModal([claim._id])"
                      :disabled="actionInProgress"
                      class="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 font-bold text-xs transition cursor-pointer border border-slate-200"
                      title="Reject claim"
                    >
                      Reject
                    </button>
                  </div>

                  <div v-else-if="claim.status === 'APPROVED'" class="text-right text-[11px] text-slate-400">
                    <span v-if="claim.generatedVoucherGroupId" class="font-mono bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold">
                      GL Posted
                    </span>
                    <span v-else>Approved</span>
                  </div>

                  <div v-else-if="claim.status === 'REJECTED'" class="text-right text-[11px] text-rose-600 font-medium" :title="claim.rejectionReason">
                    {{ claim.rejectionReason || 'Rejected' }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- MOBILE VIEW: Compact Cards (Visible on Mobile, Hidden on sm:) -->
        <div v-if="claims.length > 0" class="sm:hidden divide-y divide-slate-100">
          <div
            v-for="claim in claims"
            :key="claim._id"
            class="p-3.5 space-y-2"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="text-2xl">{{ getCategoryIcon(claim.category) }}</span>
                <div>
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-xs font-bold text-slate-900">{{ claim.supervisorName }}</span>
                    <span
                      class="px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase tracking-wider"
                      :class="getStatusBadgeClass(claim.status)"
                    >
                      {{ claim.status }}
                    </span>
                  </div>
                  <p class="text-[10px] text-slate-500 mt-0.5">
                    {{ claim.expenseDate }} • {{ claim.category }} • {{ claim.paymentMode }}
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

            <div v-if="claim.status === 'PENDING'" class="flex items-center justify-end gap-2 pt-1">
              <button
                @click="openRejectModal([claim._id])"
                :disabled="actionInProgress"
                class="px-3 py-1.5 rounded-lg bg-slate-100 text-rose-700 text-xs font-bold border border-slate-200"
              >
                Reject
              </button>
              <button
                @click="handleSingleApprove(claim._id)"
                :disabled="actionInProgress"
                class="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold border-0 shadow-xs"
              >
                Approve & Post GL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Rejection Modal -->
    <div
      v-if="showRejectModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
    >
      <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
        <h3 class="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>❌</span>
          <span>Reject Expense Claim(s)</span>
        </h3>
        <p class="text-xs text-slate-500 mt-1">
          Rejecting {{ rejectingIds.length }} claim(s). Please provide a reason for the site supervisor.
        </p>

        <div class="mt-4">
          <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
            Reason for Rejection
          </label>
          <textarea
            v-model="rejectReason"
            rows="3"
            placeholder="e.g. Missing bill/slip photo, rate appears too high, duplicate claim..."
            class="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
          ></textarea>
        </div>

        <div class="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            @click="showRejectModal = false"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            @click="confirmReject"
            :disabled="actionInProgress"
            class="px-4 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer border-0"
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
