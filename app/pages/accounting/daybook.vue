<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- 1. Header Section -->
    <div class="flex flex-wrap justify-between items-end gap-3 mb-1">
      <div>
        <UButton
          color="neutral"
          variant="link"
          icon="i-heroicons-arrow-left"
          size="xs"
          label="Back to Dashboard"
          class="p-0 mb-1 font-bold text-xs"
          @click="$router.push('/accounting')"
        />
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl text-primary-600 dark:text-primary-400">
            <UIcon name="i-heroicons-book-open" class="w-6 h-6" />
          </div>
          <div>
            <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">
              Day Book & Daily Journal
            </h1>
            <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
              Complete chronological register of all transactions & vouchers
            </p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-path"
          size="sm"
          class="h-8 w-8 flex items-center justify-center p-0"
          :loading="loading"
          @click="loadDayBook"
          title="Refresh Data"
        />
        <UButton
          color="success"
          variant="outline"
          icon="i-heroicons-arrow-down-tray"
          label="PDF"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportPDF"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-table-cells"
          label="Excel"
          size="sm"
          class="font-bold text-xs h-8"
          :loading="exportLoading"
          @click="onExportExcel"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="New Voucher"
          class="font-bold text-xs h-8 cursor-pointer"
          @click="showVoucherModal = true"
        />
      </div>
    </div>

    <!-- 2. Date Filter Controls & Presets Ribbon -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <!-- Quick Preset Pills -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase mr-1">Period:</span>
          <button
            v-for="p in datePresets"
            :key="p.id"
            type="button"
            class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="activePreset === p.id ? 'bg-primary-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
            @click="applyDatePreset(p.id)"
          >
            {{ p.label }}
          </button>
        </div>

        <!-- Day Stepper & Range Inputs -->
        <div class="flex items-center gap-2">
          <!-- Day Stepper Arrows -->
          <div class="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl p-0.5">
            <button
              type="button"
              class="p-1 px-2 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              title="Previous Day"
              @click="stepDay(-1)"
            >
              ◀ Prev Day
            </button>
            <button
              type="button"
              class="p-1 px-2 text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
              title="Next Day"
              @click="stepDay(1)"
            >
              Next Day ▶
            </button>
          </div>

          <!-- Explicit Date Pickers -->
          <div class="flex items-center gap-1.5">
            <div class="w-32">
              <UInput
                type="date"
                v-model="filters.fromDate"
                size="sm"
                class="w-full"
                @change="onCustomDateChange"
              />
            </div>
            <span class="text-xs text-gray-400 font-bold">to</span>
            <div class="w-32">
              <UInput
                type="date"
                v-model="filters.toDate"
                size="sm"
                class="w-full"
                @change="onCustomDateChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. KPI Summary Strip -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      <!-- Total Vouchers -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-blue-500">
        <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Total Vouchers</p>
        <p class="text-lg font-black font-mono text-gray-900 dark:text-white mt-0.5">{{ dayBookSummary.totalVouchers || 0 }}</p>
        <p class="text-[9px] font-bold text-gray-400 uppercase mt-0.5">Entries Recorded</p>
      </div>

      <!-- Total Inflows (Receipts) -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-emerald-500">
        <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Inflows (Receipts)</p>
        <p class="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
          {{ formatCurrency(dayBookSummary.totalReceipts || 0) }}
        </p>
        <p class="text-[9px] font-bold text-emerald-500 uppercase mt-0.5">Cash / Bank In</p>
      </div>

      <!-- Total Outflows (Payments) -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-rose-500">
        <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Outflows (Payments)</p>
        <p class="text-lg font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">
          {{ formatCurrency(dayBookSummary.totalPayments || 0) }}
        </p>
        <p class="text-[9px] font-bold text-rose-500 uppercase mt-0.5">Cash / Bank Out</p>
      </div>

      <!-- Sales Book -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-indigo-500">
        <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Sales Revenue</p>
        <p class="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
          {{ formatCurrency(dayBookSummary.totalSales || 0) }}
        </p>
        <p class="text-[9px] font-bold text-indigo-400 uppercase mt-0.5">Billings</p>
      </div>

      <!-- Purchase Book -->
      <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4 border-l-purple-500">
        <p class="text-[9px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Purchases & Inward</p>
        <p class="text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-0.5">
          {{ formatCurrency(dayBookSummary.totalPurchases || 0) }}
        </p>
        <p class="text-[9px] font-bold text-purple-400 uppercase mt-0.5">Inward Supplies</p>
      </div>

      <!-- Total Debits vs Credits Equilibrium -->
      <div
        class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm border-l-4"
        :class="dayBookSummary.isBooksBalanced ? 'border-l-teal-500' : 'border-l-amber-500'"
      >
        <p class="text-[9px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500">Total Journal Debits</p>
        <p class="text-lg font-black font-mono text-gray-900 dark:text-white mt-0.5">
          {{ formatCurrency(dayBookSummary.totalDebits || 0) }}
        </p>
        <p class="text-[9px] font-bold uppercase mt-0.5" :class="dayBookSummary.isBooksBalanced ? 'text-teal-600 dark:text-teal-400' : 'text-amber-600'">
          {{ dayBookSummary.isBooksBalanced ? '✓ Balanced (Dr = Cr)' : '⚠️ Check Balance' }}
        </p>
      </div>
    </div>

    <!-- 4. Filter Toolbar -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 flex flex-wrap gap-3 items-center justify-between">
      <!-- Voucher Type Tabs -->
      <div class="flex flex-wrap items-center gap-1">
        <button
          v-for="tab in voucherTypeTabs"
          :key="tab.type"
          type="button"
          class="px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
          :class="activeVoucherType === tab.type ? 'bg-primary-600 text-white shadow-xs' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-200 dark:hover:bg-zinc-700'"
          @click="selectVoucherType(tab.type)"
        >
          <span>{{ tab.label }}</span>
          <span
            v-if="getTypeCount(tab.type) > 0"
            class="px-1.5 py-0.2 rounded-full text-[9px] font-black"
            :class="activeVoucherType === tab.type ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-zinc-300'"
          >
            {{ getTypeCount(tab.type) }}
          </span>
        </button>
      </div>

      <!-- Account Filter & Search -->
      <div class="flex flex-wrap items-center gap-2 flex-1 justify-end min-w-[320px]">
        <!-- Account Head Selector -->
        <div class="w-64">
          <AccountSelectMenu
            v-model="filters.accountHead"
            :accounts="chartOfAccounts"
            placeholder="Filter by Account Head..."
            :show-balance="false"
            @change="loadDayBook"
          />
        </div>

        <!-- Text Search -->
        <div class="w-52">
          <UInput
            v-model="searchQuery"
            placeholder="Search voucher #, text..."
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-full"
          />
        </div>

        <!-- Detailed Multi-leg View Toggle -->
        <UButton
          :color="isDetailedView ? 'primary' : 'neutral'"
          :variant="isDetailedView ? 'solid' : 'outline'"
          size="sm"
          class="h-8 text-xs font-bold"
          :label="isDetailedView ? 'Detailed Splits' : 'Condensed'"
          @click="isDetailedView = !isDetailedView"
          title="Toggle Multi-leg Double Entry Splits"
        />
      </div>
    </div>

    <!-- 5. Main Day Book Table -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loading state -->
      <div v-if="loading" class="p-16 text-center text-gray-400">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary" />
        <p class="text-xs uppercase tracking-widest font-black mt-2">Loading day book records...</p>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse divide-y divide-gray-100 dark:divide-zinc-800">
          <thead class="bg-gray-50/90 dark:bg-zinc-850/90 sticky top-0 z-10 backdrop-blur">
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-3 px-3.5 w-24">Date</th>
              <th class="py-3 px-3.5 w-36">Voucher No</th>
              <th class="py-3 px-3.5 w-24">Type</th>
              <th class="py-3 px-3.5">Particulars (Account Heads)</th>
              <th class="py-3 px-3.5">Narration & Ref</th>
              <th class="py-3 px-3.5 text-right w-32">Debit (₹)</th>
              <th class="py-3 px-3.5 text-right w-32">Credit (₹)</th>
              <th class="py-3 px-3.5 text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800 font-medium text-gray-700 dark:text-zinc-300">
            <template v-for="(v, idx) in filteredVouchers" :key="`${v.voucherGroupId}_${idx}`">
              <!-- Detailed Mode: Show all Dr / Cr line entries for this voucher -->
              <template v-if="isDetailedView && v.entries && v.entries.length > 0">
                <tr
                  v-for="(en, enIdx) in v.entries"
                  :key="`${v.voucherGroupId}_${enIdx}`"
                  class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                  :class="{
                    'border-t-2 border-gray-200 dark:border-zinc-700': enIdx === 0 && idx > 0,
                    'bg-gray-50/20 dark:bg-zinc-850/10': idx % 2 === 1
                  }"
                >
                  <!-- Date (only on first row of voucher) -->
                  <td class="py-2 px-3.5 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                    {{ enIdx === 0 ? v.transactionDate : '' }}
                  </td>

                  <!-- Voucher No (only on first row of voucher) -->
                  <td class="py-2 px-3.5">
                    <div v-if="enIdx === 0" class="font-mono font-bold text-gray-900 dark:text-white leading-tight">
                      {{ v.voucherNo }}
                    </div>
                  </td>

                  <!-- Type Badge (only on first row of voucher) -->
                  <td class="py-2 px-3.5">
                    <span
                      v-if="enIdx === 0"
                      class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                      :class="getVoucherBadgeClass(v.voucherType)"
                    >
                      {{ v.voucherType }}
                    </span>
                  </td>

                  <!-- Particulars Line -->
                  <td class="py-2 px-3.5">
                    <div class="flex items-center gap-1.5">
                      <span class="text-[10px] font-bold" :class="en.debitAmount > 0 ? 'text-emerald-600 font-mono' : 'text-gray-400 pl-3'">
                        {{ en.debitAmount > 0 ? 'Dr.' : 'To' }}
                      </span>
                      <button
                        type="button"
                        class="font-bold text-gray-900 dark:text-white hover:text-primary-600 hover:underline text-left cursor-pointer"
                        @click="$router.push(`/accounting/ledger-view?head=${encodeURIComponent(en.accountHead)}`)"
                        :title="`View Account Ledger: ${en.accountHead}`"
                      >
                        {{ en.accountHead }}
                      </button>
                      <span class="text-[9px] px-1 rounded bg-gray-100 dark:bg-zinc-800 text-gray-400 uppercase">
                        {{ en.accountType }}
                      </span>
                    </div>
                  </td>

                  <!-- Narration (only on first row or entry narration) -->
                  <td class="py-2 px-3.5 text-gray-500 dark:text-zinc-400 text-[11px]">
                    <div class="truncate max-w-xs" :title="en.narration || v.narration">
                      {{ en.narration || (enIdx === 0 ? v.narration : '') }}
                    </div>
                  </td>

                  <!-- Debit Amount -->
                  <td class="py-2 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {{ en.debitAmount > 0 ? formatCurrency(en.debitAmount) : '' }}
                  </td>

                  <!-- Credit Amount -->
                  <td class="py-2 px-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    {{ en.creditAmount > 0 ? formatCurrency(en.creditAmount) : '' }}
                  </td>

                  <!-- Actions -->
                  <td class="py-2 px-3.5 text-center">
                    <UButton
                      v-if="enIdx === 0"
                      color="neutral"
                      variant="ghost"
                      icon="i-heroicons-arrow-top-right-on-square"
                      size="xs"
                      @click="drillIntoVoucher(v)"
                      title="Drill into Voucher"
                    />
                  </td>
                </tr>
              </template>

              <!-- Condensed Mode: 1 row per voucher -->
              <tr
                v-else
                class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                :class="{ 'bg-gray-50/20 dark:bg-zinc-850/10': idx % 2 === 1 }"
              >
                <!-- Date -->
                <td class="py-2.5 px-3.5 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                  {{ v.transactionDate }}
                </td>

                <!-- Voucher No -->
                <td class="py-2.5 px-3.5 font-mono font-bold text-gray-900 dark:text-white">
                  {{ v.voucherNo }}
                </td>

                <!-- Type Badge -->
                <td class="py-2.5 px-3.5">
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    :class="getVoucherBadgeClass(v.voucherType)"
                  >
                    {{ v.voucherType }}
                  </span>
                </td>

                <!-- Particulars -->
                <td class="py-2.5 px-3.5">
                  <div class="font-bold text-gray-900 dark:text-white leading-tight truncate max-w-sm">
                    <span class="text-emerald-600">Dr:</span> {{ v.drParticulars || v.primaryAccount }}
                    <span v-if="v.crParticulars" class="text-gray-400 mx-1">|</span>
                    <span v-if="v.crParticulars" class="text-rose-600">Cr:</span> {{ v.crParticulars }}
                  </div>
                </td>

                <!-- Narration -->
                <td class="py-2.5 px-3.5 text-gray-500 dark:text-zinc-400 text-[11px]">
                  <div class="truncate max-w-xs" :title="v.narration">
                    {{ v.narration || '-' }}
                  </div>
                </td>

                <!-- Debit -->
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {{ formatCurrency(v.totalDebit) }}
                </td>

                <!-- Credit -->
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                  {{ formatCurrency(v.totalCredit) }}
                </td>

                <!-- Actions -->
                <td class="py-2.5 px-3.5 text-center">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-arrow-top-right-on-square"
                    size="xs"
                    @click="drillIntoVoucher(v)"
                    title="Drill into Voucher"
                  />
                </td>
              </tr>
            </template>

            <!-- Empty State -->
            <tr v-if="filteredVouchers.length === 0">
              <td colspan="8" class="py-20 text-center text-gray-400 dark:text-zinc-500 italic space-y-2">
                <UIcon name="i-heroicons-document-magnifying-glass" class="w-10 h-10 mx-auto text-gray-300 dark:text-zinc-600" />
                <p class="font-bold text-sm">No vouchers found for the selected date & filter criteria.</p>
                <p class="text-xs">Adjust your date range or create a new voucher above.</p>
              </td>
            </tr>
          </tbody>

          <!-- Table Footer Total -->
          <tfoot v-if="filteredVouchers.length > 0" class="bg-gray-50/90 dark:bg-zinc-850/90 font-black border-t-2 border-gray-200 dark:border-zinc-700">
            <tr>
              <td colspan="5" class="py-3 px-3.5 text-right uppercase text-gray-600 dark:text-zinc-400 text-[10px]">
                Total for Selected Filter ({{ filteredVouchers.length }} Vouchers):
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                {{ formatCurrency(filteredTotalDebit) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-rose-600 dark:text-rose-400 text-sm">
                {{ formatCurrency(filteredTotalCredit) }}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </UCard>

    <!-- 6. Integrated Voucher Modal for New Vouchers -->
    <VoucherModal
      v-model="showVoucherModal"
      @voucher-created="loadDayBook"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';
import { formatCurrency } from '@/utils/formatters';
import AccountSelectMenu from '~/components/accounting/AccountSelectMenu.vue';
import VoucherModal from '~/components/accounting/VoucherModal.vue';

const router = useRouter();
const {
  dayBookVouchers,
  dayBookSummary,
  chartOfAccounts,
  fetchCOA,
  fetchDayBook,
  exportDayBookPdf,
  exportDayBookExcel,
  loading
} = useAccounting();

const exportLoading = ref(false);
const showVoucherModal = ref(false);
const isDetailedView = ref(true);
const searchQuery = ref('');
const activePreset = ref<'today' | 'yesterday' | 'this_week' | 'this_month' | 'prev_month' | 'this_fy' | 'custom'>('today');
const activeVoucherType = ref('ALL');

const todayStr = new Date().toISOString().split('T')[0];

const filters = reactive({
  fromDate: todayStr,
  toDate: todayStr,
  voucherType: 'ALL',
  accountHead: ''
});

const datePresets = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'prev_month', label: 'Prev Month' },
  { id: 'this_fy', label: 'FY 2026-27' },
  { id: 'custom', label: 'Custom' }
];

const voucherTypeTabs = [
  { type: 'ALL', label: 'All Vouchers' },
  { type: 'RECEIPT', label: 'Receipts (RV)' },
  { type: 'PAYMENT', label: 'Payments (PV)' },
  { type: 'SALES', label: 'Sales (SL)' },
  { type: 'PURCHASE', label: 'Purchases (PUR)' },
  { type: 'JOURNAL', label: 'Journal (JV)' },
  { type: 'CONTRA', label: 'Contra (CT)' },
  { type: 'DEBIT_NOTE', label: 'Debit Notes' },
  { type: 'CREDIT_NOTE', label: 'Credit Notes' }
];

onMounted(async () => {
  await Promise.all([fetchCOA(), loadDayBook()]);
});

async function loadDayBook() {
  await fetchDayBook({
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    voucherType: activeVoucherType.value !== 'ALL' ? activeVoucherType.value : undefined,
    accountHead: filters.accountHead || undefined
  });
}

function applyDatePreset(presetId: string) {
  activePreset.value = presetId as any;
  const now = new Date();

  if (presetId === 'today') {
    const d = now.toISOString().split('T')[0];
    filters.fromDate = d;
    filters.toDate = d;
  } else if (presetId === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const d = y.toISOString().split('T')[0];
    filters.fromDate = d;
    filters.toDate = d;
  } else if (presetId === 'this_week') {
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7;
    startOfWeek.setDate(startOfWeek.getDate() - day + 1);
    filters.fromDate = startOfWeek.toISOString().split('T')[0];
    filters.toDate = now.toISOString().split('T')[0];
  } else if (presetId === 'this_month') {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    filters.fromDate = startOfMonth.toISOString().split('T')[0];
    filters.toDate = now.toISOString().split('T')[0];
  } else if (presetId === 'prev_month') {
    const startOfPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrev = new Date(now.getFullYear(), now.getMonth(), 0);
    filters.fromDate = startOfPrev.toISOString().split('T')[0];
    filters.toDate = endOfPrev.toISOString().split('T')[0];
  } else if (presetId === 'this_fy') {
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    filters.fromDate = `${year}-04-01`;
    filters.toDate = `${year + 1}-03-31`;
  }
  loadDayBook();
}

function formatDateIso(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function onCustomDateChange() {
  activePreset.value = 'custom';
  loadDayBook();
}

function stepDay(offsetDays: number) {
  const baseDateStr = String(filters.toDate || filters.fromDate || todayStr);
  const parts = baseDateStr.split('-').map(Number);
  const current = (parts.length === 3 && !isNaN(parts[0]!) && !isNaN(parts[1]!) && !isNaN(parts[2]!))
    ? new Date(parts[0]!, parts[1]! - 1, parts[2]!)
    : new Date();
  current.setDate(current.getDate() + offsetDays);
  const nextDate = formatDateIso(current);
  filters.fromDate = nextDate;
  filters.toDate = nextDate;
  activePreset.value = 'custom';
  loadDayBook();
}

function selectVoucherType(type: string) {
  activeVoucherType.value = type;
  loadDayBook();
}

function getTypeCount(type: string) {
  if (type === 'ALL') return dayBookSummary.value?.totalVouchers || 0;
  const counts = dayBookSummary.value?.voucherTypeCounts || {};
  return counts[type] || 0;
}

// Filtered Vouchers computed by text search
const filteredVouchers = computed(() => {
  const list = dayBookVouchers.value || [];
  if (!searchQuery.value.trim()) return list;

  const q = searchQuery.value.toLowerCase().trim();
  return list.filter((v: any) => {
    const matchNo = (v.voucherNo || '').toLowerCase().includes(q);
    const matchNarr = (v.narration || '').toLowerCase().includes(q);
    const matchDr = (v.drParticulars || '').toLowerCase().includes(q);
    const matchCr = (v.crParticulars || '').toLowerCase().includes(q);
    const matchType = (v.voucherType || '').toLowerCase().includes(q);
    const matchUser = (v.createdBy || '').toLowerCase().includes(q);
    const matchEntries = Array.isArray(v.entries) && v.entries.some((en: any) => 
      (en.accountHead || '').toLowerCase().includes(q) || (en.narration || '').toLowerCase().includes(q)
    );
    return matchNo || matchNarr || matchDr || matchCr || matchType || matchUser || matchEntries;
  });
});

const filteredTotalDebit = computed(() => {
  return filteredVouchers.value.reduce((s: number, v: any) => s + (v.totalDebit || 0), 0);
});

const filteredTotalCredit = computed(() => {
  return filteredVouchers.value.reduce((s: number, v: any) => s + (v.totalCredit || 0), 0);
});

function getVoucherBadgeClass(type: string = '') {
  const t = type.toUpperCase();
  if (t.includes('RECEIPT')) return 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300';
  if (t.includes('PAYMENT')) return 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300';
  if (t.includes('SALES')) return 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300';
  if (t.includes('PURCHASE')) return 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300';
  if (t.includes('CONTRA')) return 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300';
  if (t.includes('DEBIT_NOTE')) return 'bg-cyan-100 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300';
  if (t.includes('CREDIT_NOTE')) return 'bg-fuchsia-100 dark:bg-fuchsia-950/50 text-fuchsia-700 dark:text-fuchsia-300';
  return 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300';
}

function drillIntoVoucher(v: any) {
  if (v.primaryAccount) {
    router.push(`/accounting/ledger-view?head=${encodeURIComponent(v.primaryAccount)}`);
  }
}

const onExportPDF = async () => {
  exportLoading.value = true;
  try {
    await exportDayBookPdf({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      voucherType: activeVoucherType.value !== 'ALL' ? activeVoucherType.value : undefined,
      accountHead: filters.accountHead || undefined,
      search: searchQuery.value || undefined
    });
  } catch (err: any) {
    alert(`Failed to export Day Book PDF: ${err.message}`);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  exportLoading.value = true;
  try {
    await exportDayBookExcel({
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      voucherType: activeVoucherType.value !== 'ALL' ? activeVoucherType.value : undefined,
      accountHead: filters.accountHead || undefined,
      search: searchQuery.value || undefined
    });
  } catch (err: any) {
    alert(`Failed to export Day Book Excel: ${err.message}`);
  } finally {
    exportLoading.value = false;
  }
};
</script>
