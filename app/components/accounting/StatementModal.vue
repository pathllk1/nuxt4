<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useApi } from '@/utils/api';
import { useAccounting } from '@/composables/useAccounting';

const props = defineProps<{
  modelValue: boolean;
  accountHead: string;
  accountType?: string;
  initialFromDate?: string;
  initialToDate?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const api = useApi();
const { exportLedgerPdf, exportLedgerExcel } = useAccounting();

const loading = ref(false);
const fromDate = ref(props.initialFromDate || '');
const toDate = ref(props.initialToDate || new Date().toISOString().split('T')[0]);
const searchQuery = ref('');

const startingBal = ref<{ rawBalance: number; balance: number; balanceType: string }>({ rawBalance: 0, balance: 0, balanceType: 'DR' });
const entries = ref<any[]>([]);
const totalDebits = ref(0);
const totalCredits = ref(0);
const finalBalance = ref(0);
const finalBalanceType = ref('DR');
const exportLoading = ref(false);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const loadStatement = async () => {
  if (!props.accountHead) return;
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.append('accountHead', props.accountHead);
    if (fromDate.value) params.append('fromDate', fromDate.value);
    if (toDate.value) params.append('toDate', toDate.value);

    const response = await api.get(`/accounting/ledger?${params.toString()}`);
    if (response.success && response.data) {
      if (Array.isArray(response.data)) {
        entries.value = response.data;
        totalDebits.value = entries.value.reduce((s, e) => s + (e.debitAmount || 0), 0);
        totalCredits.value = entries.value.reduce((s, e) => s + (e.creditAmount || 0), 0);
        const net = totalDebits.value - totalCredits.value;
        finalBalance.value = Math.abs(net);
        finalBalanceType.value = net >= 0 ? 'DR' : 'CR';
      } else {
        startingBal.value = response.data.startingBal || { rawBalance: 0, balance: 0, balanceType: 'DR' };
        entries.value = response.data.entries || [];
        totalDebits.value = response.data.totalDebits || 0;
        totalCredits.value = response.data.totalCredits || 0;
        finalBalance.value = response.data.finalBalance || 0;
        finalBalanceType.value = response.data.finalBalanceType || 'DR';
      }
    }
  } catch (err: any) {
    console.error('Failed to load ledger statement:', err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.modelValue, (newVal) => {
  if (newVal && props.accountHead) {
    fromDate.value = props.initialFromDate || '';
    toDate.value = props.initialToDate || new Date().toISOString().split('T')[0];
    loadStatement();
  }
});

const filteredEntries = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return entries.value;
  return entries.value.filter(e =>
    (e.voucherNo && e.voucherNo.toLowerCase().includes(q)) ||
    (e.narration && e.narration.toLowerCase().includes(q)) ||
    (e.refType && e.refType.toLowerCase().includes(q)) ||
    (e.paymentMode && e.paymentMode.toLowerCase().includes(q))
  );
});

const formatINR = (n: number) => {
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);
};

const onDownloadPDF = async () => {
  exportLoading.value = true;
  try {
    await exportLedgerPdf({ accountHead: props.accountHead, fromDate: fromDate.value, toDate: toDate.value });
  } catch (err) {
    console.error('Failed to export PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onDownloadExcel = async () => {
  exportLoading.value = true;
  try {
    await exportLedgerExcel({ accountHead: props.accountHead, fromDate: fromDate.value, toDate: toDate.value });
  } catch (err) {
    console.error('Failed to export Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};

const triggerPrint = () => {
  window.print();
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md" @click.self="isOpen = false">
    <UCard 
      class="w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-2xl" 
      :ui="{ body: 'p-4 overflow-y-auto flex-1', header: 'p-4 py-3 bg-slate-900 text-white border-b border-slate-800 flex justify-between items-center' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-indigo-500/20 rounded-xl">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-black uppercase tracking-widest text-indigo-400">Statement Record</span>
              <UBadge v-if="accountType" size="sm" variant="subtle" color="neutral" class="text-[8px] px-1.5 py-0 font-bold uppercase rounded">
                {{ accountType.replace(/_/g, ' ') }}
              </UBadge>
            </div>
            <h2 class="text-base font-black uppercase tracking-tight text-white leading-tight mt-0.5">{{ accountHead }}</h2>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <UButton 
            color="success" 
            variant="outline" 
            icon="i-heroicons-arrow-down-tray"
            label="PDF"
            size="xs"
            class="font-bold text-xs h-7"
            :loading="exportLoading"
            @click="onDownloadPDF"
          />
          <UButton 
            color="success" 
            variant="outline" 
            icon="i-heroicons-arrow-down-tray"
            label="Excel"
            size="xs"
            class="font-bold text-xs h-7"
            :loading="exportLoading"
            @click="onDownloadExcel"
          />
          <UButton 
            color="neutral" 
            variant="ghost" 
            icon="i-heroicons-printer" 
            size="xs"
            class="h-7 text-slate-300 hover:text-white"
            @click="triggerPrint"
          />
          <UButton 
            size="xs" 
            variant="ghost" 
            color="neutral" 
            icon="i-heroicons-x-mark" 
            class="h-7 w-7 text-slate-400 hover:text-white"
            @click="isOpen = false" 
          />
        </div>
      </template>

      <!-- Date Filters & Search -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
        <div class="flex items-center gap-2 flex-1 min-w-[240px]">
          <UInput 
            v-model="searchQuery" 
            icon="i-heroicons-magnifying-glass"
            placeholder="Search entries or voucher no..."
            size="xs"
            class="w-full"
          />
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500">From</span>
          <UInput type="date" v-model="fromDate" size="xs" class="w-32" @change="loadStatement" />
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500">To</span>
          <UInput type="date" v-model="toDate" size="xs" class="w-32" @change="loadStatement" />
          <UButton color="primary" label="Filter" size="xs" class="font-bold h-7" @click="loadStatement" />
        </div>
      </div>

      <!-- KPI Summary Banner -->
      <div class="grid grid-cols-4 gap-2 mb-3 bg-slate-900 text-white p-3 rounded-xl border border-slate-800">
        <div class="text-left">
          <p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Starting Balance</p>
          <p class="text-xs font-black font-mono mt-0.5" :class="startingBal.balanceType === 'DR' ? 'text-emerald-400' : 'text-rose-400'">
            {{ formatINR(startingBal.balance) }} <span class="text-[9px] font-bold">{{ startingBal.balanceType }}</span>
          </p>
        </div>
        <div class="text-left border-l border-slate-800 pl-3">
          <p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Debits (DR)</p>
          <p class="text-xs font-black font-mono text-emerald-400 mt-0.5">{{ formatINR(totalDebits) }}</p>
        </div>
        <div class="text-left border-l border-slate-800 pl-3">
          <p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Total Credits (CR)</p>
          <p class="text-xs font-black font-mono text-rose-400 mt-0.5">{{ formatINR(totalCredits) }}</p>
        </div>
        <div class="text-left border-l border-slate-800 pl-3">
          <p class="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Closing Balance</p>
          <p class="text-xs font-black font-mono mt-0.5" :class="finalBalanceType === 'DR' ? 'text-emerald-400' : 'text-rose-400'">
            {{ formatINR(finalBalance) }} <span class="text-[9px] font-bold">{{ finalBalanceType }}</span>
          </p>
        </div>
      </div>

      <!-- Table Content -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Loading ledger statement entries...</p>
      </div>

      <div v-else-if="filteredEntries.length === 0" class="py-16 text-center italic text-slate-400 dark:text-zinc-500 text-xs font-bold">
        No transaction entries found for {{ accountHead }} in this period.
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
        <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800">
          <thead>
            <tr class="bg-slate-50 dark:bg-zinc-800/60 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-2.5 px-3">Date</th>
              <th class="py-2.5 px-3">Voucher Type / No</th>
              <th class="py-2.5 px-3">Narration & Details</th>
              <th class="py-2.5 px-3 text-right">Debit (DR)</th>
              <th class="py-2.5 px-3 text-right">Credit (CR)</th>
              <th class="py-2.5 px-3 text-right">Running Balance</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/50 font-medium text-slate-700 dark:text-zinc-300">
            <tr v-for="(e, idx) in filteredEntries" :key="idx" class="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors">
              <td class="py-2 px-3 whitespace-nowrap text-[11px] font-bold text-slate-900 dark:text-white font-mono">
                {{ e.transactionDate }}
              </td>
              <td class="py-2 px-3">
                <div class="flex items-center gap-1.5">
                  <UBadge size="sm" variant="subtle" color="neutral" class="text-[8px] px-1 py-0 font-bold uppercase rounded">
                    {{ e.voucherType || 'GENERAL' }}
                  </UBadge>
                  <span class="font-bold text-slate-900 dark:text-white font-mono">{{ e.voucherNo || '—' }}</span>
                </div>
              </td>
              <td class="py-2 px-3">
                <p class="text-xs font-semibold text-slate-800 dark:text-zinc-200">{{ e.narration || e.refType || 'Ledger Posting' }}</p>
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ e.debitAmount > 0 ? formatINR(e.debitAmount) : '—' }}
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                {{ e.creditAmount > 0 ? formatINR(e.creditAmount) : '—' }}
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold">
                <span :class="e.runningBalanceType === 'DR' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
                  {{ formatINR(e.runningBalance || 0) }} {{ e.runningBalanceType }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>
  </div>
</template>
