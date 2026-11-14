<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useApi } from '@/utils/api';
import { useAccounting } from '@/composables/useAccounting';
import VoucherDetailModal from './VoucherDetailModal.vue';
import VoucherModal from './VoucherModal.vue';

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

const toast = useToast();
const deletingVoucher = ref<any>(null);
const showDeleteConfirm = ref(false);
const isDeleting = ref(false);

// Voucher Modals State
const showDetailModal = ref(false);
const showEditModal = ref(false);
const selectedVoucherId = ref('');
const editingVoucherGroupId = ref('');
const editingVoucherData = ref<any>(null);
const actionLoadingId = ref<string | null>(null);

const confirmDeleteVoucher = (entry: any) => {
  deletingVoucher.value = entry;
  showDeleteConfirm.value = true;
};

const executeDeleteVoucher = async () => {
  if (!deletingVoucher.value?.voucherGroupId) return;
  isDeleting.value = true;
  try {
    const res: any = await api.delete(`/accounting/vouchers/${encodeURIComponent(deletingVoucher.value.voucherGroupId)}`);
    if (res && res.success) {
      toast.add({
        title: 'Voucher Deleted',
        description: res.message || `Voucher ${deletingVoucher.value.voucherNo} deleted`,
        color: 'success'
      });
      showDeleteConfirm.value = false;
      deletingVoucher.value = null;
      await loadStatement();
    }
  } catch (err: any) {
    toast.add({
      title: 'Failed to Delete Voucher',
      description: err.data?.statusMessage || err.message || 'Error deleting voucher',
      color: 'error'
    });
  } finally {
    isDeleting.value = false;
  }
};

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
    (e.opposingAccountHead && e.opposingAccountHead.toLowerCase().includes(q)) ||
    (e.narration && e.narration.toLowerCase().includes(q)) ||
    (e.refType && e.refType.toLowerCase().includes(q)) ||
    (e.paymentMode && e.paymentMode.toLowerCase().includes(q))
  );
});

// Non-breaking space \u00A0 prevents currency symbol from wrapping onto its own line
const formatINR = (n: number) => {
  return '₹\u00A0' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);
};

const openVoucherView = (entry: any) => {
  const targetId = entry.voucherGroupId || entry.voucherNo;
  if (!targetId) return;
  selectedVoucherId.value = targetId;
  showDetailModal.value = true;
};

const openVoucherEdit = async (entry: any) => {
  const targetId = entry.voucherGroupId || entry.voucherNo;
  if (!targetId) return;

  actionLoadingId.value = targetId;
  try {
    const res: any = await api.get(`/accounting/vouchers/${encodeURIComponent(targetId)}`);
    if (res && res.success && res.data) {
      if (res.data.isEditable === false) {
        toast.add({
          title: 'Voucher Locked',
          description: res.data.notEditableReason || 'This voucher cannot be edited directly.',
          color: 'warning'
        });
        selectedVoucherId.value = targetId;
        showDetailModal.value = true;
        return;
      }
      editingVoucherData.value = res.data;
      editingVoucherGroupId.value = res.data.voucherGroupId || targetId;
      showEditModal.value = true;
    } else {
      toast.add({
        title: 'Error',
        description: 'Unable to load voucher data for editing',
        color: 'error'
      });
    }
  } catch (err: any) {
    toast.add({
      title: 'Failed to Open Voucher',
      description: err.data?.statusMessage || err.message || 'Error fetching voucher details',
      color: 'error'
    });
  } finally {
    actionLoadingId.value = null;
  }
};

const handleEditFromDetail = (voucherData: any) => {
  showDetailModal.value = false;
  editingVoucherData.value = voucherData;
  editingVoucherGroupId.value = voucherData?.voucherGroupId || voucherData?.voucherNo || '';
  showEditModal.value = true;
};

const handleVoucherSaved = async () => {
  showEditModal.value = false;
  editingVoucherData.value = null;
  editingVoucherGroupId.value = '';
  toast.add({
    title: 'Success',
    description: 'Voucher saved successfully',
    color: 'success'
  });
  await loadStatement();
};

const handleVoucherDeleted = async () => {
  showDetailModal.value = false;
  await loadStatement();
};

const printVoucher = (entry: any) => {
  const targetId = entry.voucherGroupId || entry.voucherNo;
  if (!targetId) return;
  window.open(`/api/accounting/vouchers/${encodeURIComponent(targetId)}/pdf`, '_blank');
};

const isEditableVoucher = (entry: any) => {
  if (!entry) return false;
  if (entry.voucherType === 'OPENING_BALANCE') return false;
  if (entry.isReversed) return false;
  const refType = String(entry.refType || '').toUpperCase();
  if (['BILL', 'SALE', 'PURCHASE', 'WAGE', 'WAGE_PAYOUT'].includes(refType)) return false;
  return Boolean(entry.voucherGroupId || entry.voucherNo);
};

const getVoucherBadgeColor = (type?: string): 'warning' | 'success' | 'primary' | 'info' | 'neutral' => {
  const t = (type || '').toUpperCase();
  if (t === 'PAYMENT') return 'warning';
  if (t === 'RECEIPT') return 'success';
  if (t === 'CONTRA') return 'primary';
  if (t === 'JOURNAL') return 'info';
  return 'neutral';
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
      class="w-full max-w-7xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-2xl" 
      :ui="{ body: 'p-4 overflow-y-auto flex-1', header: 'p-4 py-3.5 bg-gradient-to-r from-blue-50/95 via-indigo-50/80 to-sky-50/90 dark:from-zinc-900 dark:via-indigo-950/40 dark:to-zinc-900 border-b border-indigo-100 dark:border-zinc-800 flex justify-between items-center' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2.5 bg-indigo-600 rounded-xl shadow-xs text-white">
            <UIcon name="i-heroicons-document-text" class="w-5 h-5 text-white" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[9.5px] font-black uppercase tracking-widest text-indigo-700 dark:text-indigo-400">Statement Record</span>
              <UBadge v-if="accountType" size="sm" variant="subtle" color="primary" class="text-[8.5px] px-1.5 py-0 font-bold uppercase rounded border border-indigo-200 dark:border-indigo-800">
                {{ accountType.replace(/_/g, ' ') }}
              </UBadge>
            </div>
            <h2 class="text-base font-black uppercase tracking-tight text-slate-900 dark:text-white leading-tight mt-0.5">{{ accountHead }}</h2>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <UButton 
            color="success" 
            variant="subtle" 
            icon="i-heroicons-arrow-down-tray"
            label="PDF"
            size="xs"
            class="font-bold text-xs h-7 shadow-2xs border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 hover:bg-emerald-200"
            :loading="exportLoading"
            @click="onDownloadPDF"
          />
          <UButton 
            color="success" 
            variant="subtle" 
            icon="i-heroicons-arrow-down-tray"
            label="Excel"
            size="xs"
            class="font-bold text-xs h-7 shadow-2xs border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 hover:bg-emerald-200"
            :loading="exportLoading"
            @click="onDownloadExcel"
          />
          <UButton 
            color="neutral" 
            variant="ghost" 
            icon="i-heroicons-printer" 
            size="xs"
            class="h-7 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
            title="Print View"
            @click="triggerPrint"
          />
          <UButton 
            size="xs" 
            variant="ghost" 
            color="neutral" 
            icon="i-heroicons-x-mark" 
            class="h-7 w-7 text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-white"
            @click="isOpen = false" 
          />
        </div>
      </template>

      <!-- Date Filters & Search -->
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3 bg-slate-100/80 dark:bg-zinc-800/50 p-2.5 rounded-xl border border-slate-200 dark:border-zinc-700">
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
          <span class="text-[9px] font-black uppercase text-slate-600 dark:text-zinc-400">From</span>
          <UInput type="date" v-model="fromDate" size="xs" class="w-32" @change="loadStatement" />
          <span class="text-[9px] font-black uppercase text-slate-600 dark:text-zinc-400">To</span>
          <UInput type="date" v-model="toDate" size="xs" class="w-32" @change="loadStatement" />
          <UButton color="primary" label="Filter" size="xs" class="font-bold h-7" @click="loadStatement" />
        </div>
      </div>

      <!-- KPI Summary Banner: Distinct Light Pastel Colored Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-3.5">
        <!-- Starting Balance (Sky / Light Blue) -->
        <div class="p-3 bg-sky-50/90 dark:bg-sky-950/30 rounded-xl border border-sky-200/90 dark:border-sky-800/60 shadow-2xs">
          <p class="text-[9px] font-black text-sky-800 dark:text-sky-300 uppercase tracking-wider">Starting Balance</p>
          <p class="text-sm font-black font-mono mt-1 whitespace-nowrap" :class="startingBal.balanceType === 'DR' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
            {{ formatINR(startingBal.balance) }} <span class="text-[10px] font-bold">{{ startingBal.balanceType }}</span>
          </p>
        </div>

        <!-- Total Debits (DR) (Light Emerald Green) -->
        <div class="p-3 bg-emerald-50/90 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/90 dark:border-emerald-800/60 shadow-2xs">
          <p class="text-[9px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Total Debits (DR)</p>
          <p class="text-sm font-black font-mono text-emerald-700 dark:text-emerald-400 mt-1 whitespace-nowrap">{{ formatINR(totalDebits) }}</p>
        </div>

        <!-- Total Credits (CR) (Light Rose / Coral) -->
        <div class="p-3 bg-rose-50/90 dark:bg-rose-950/30 rounded-xl border border-rose-200/90 dark:border-rose-800/60 shadow-2xs">
          <p class="text-[9px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider">Total Credits (CR)</p>
          <p class="text-sm font-black font-mono text-rose-700 dark:text-rose-400 mt-1 whitespace-nowrap">{{ formatINR(totalCredits) }}</p>
        </div>

        <!-- Closing Balance (Light Indigo / Purple) -->
        <div class="p-3 bg-indigo-50/90 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/90 dark:border-indigo-800/60 shadow-2xs">
          <p class="text-[9px] font-black text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Closing Balance</p>
          <p class="text-sm font-black font-mono mt-1 whitespace-nowrap" :class="finalBalanceType === 'DR' ? 'text-indigo-800 dark:text-indigo-300' : 'text-rose-700 dark:text-rose-400'">
            {{ formatINR(finalBalance) }} <span class="text-[10px] font-bold">{{ finalBalanceType }}</span>
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

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs">
        <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800">
          <thead>
            <tr class="bg-slate-100/90 dark:bg-zinc-800/80 text-[9.5px] font-black text-slate-700 dark:text-zinc-300 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
              <th class="py-2.5 px-3 whitespace-nowrap w-24">Date</th>
              <th class="py-2.5 px-3 whitespace-nowrap w-36">Voucher Type / No</th>
              <th class="py-2.5 px-3 whitespace-nowrap min-w-[140px] max-w-[200px]">Account Head</th>
              <th class="py-2.5 px-3 whitespace-nowrap min-w-[160px] max-w-[240px]">Narration & Details</th>
              <th class="py-2.5 px-3 text-right whitespace-nowrap w-28">Debit (DR)</th>
              <th class="py-2.5 px-3 text-right whitespace-nowrap w-28">Credit (CR)</th>
              <th class="py-2.5 px-3 text-right whitespace-nowrap w-32">Running Balance</th>
              <th class="py-2.5 px-2 text-center whitespace-nowrap w-28 min-w-[116px] sticky right-0 z-20 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] print:hidden">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/50 font-medium text-slate-700 dark:text-zinc-300">
            <tr v-for="(e, idx) in filteredEntries" :key="idx" class="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors group">
              <td class="py-2 px-3 whitespace-nowrap text-[11px] font-bold text-slate-900 dark:text-white font-mono">
                {{ e.transactionDate }}
              </td>
              <td class="py-2 px-3 whitespace-nowrap">
                <button
                  v-if="e.voucherGroupId || e.voucherNo"
                  type="button"
                  class="flex items-center gap-1.5 group/btn text-left cursor-pointer hover:opacity-85 transition-opacity"
                  @click="openVoucherView(e)"
                  title="Click to view voucher breakdown & audit trail"
                >
                  <UBadge 
                    size="sm" 
                    variant="subtle" 
                    :color="getVoucherBadgeColor(e.voucherType)" 
                    class="text-[8px] px-1.5 py-0.5 font-bold uppercase rounded group-hover/btn:ring-1 group-hover/btn:ring-primary-500/40 transition-all shrink-0"
                  >
                    {{ e.voucherType || 'GENERAL' }}
                  </UBadge>
                  <span class="font-bold text-slate-900 dark:text-white font-mono text-xs group-hover/btn:text-primary-600 dark:group-hover/btn:text-primary-400 group-hover/btn:underline flex items-center gap-1 truncate max-w-[120px]">
                    {{ e.voucherNo || e.voucherGroupId || '—' }}
                    <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 text-slate-400 group-hover/btn:text-primary-500 transition-colors shrink-0" />
                  </span>
                </button>
                <div v-else class="flex items-center gap-1.5">
                  <UBadge size="sm" variant="subtle" color="neutral" class="text-[8px] px-1.5 py-0.5 font-bold uppercase rounded">
                    {{ e.voucherType || 'OPENING' }}
                  </UBadge>
                  <span class="font-bold text-slate-400 font-mono text-xs">—</span>
                </div>
              </td>
              <td class="py-2 px-3 max-w-[200px]">
                <span class="text-xs font-bold text-slate-900 dark:text-white line-clamp-2" :title="e.opposingAccountHead">
                  {{ e.opposingAccountHead || '—' }}
                </span>
              </td>
              <td class="py-2 px-3 max-w-[240px]">
                <p class="text-xs font-semibold text-slate-800 dark:text-zinc-200 line-clamp-2" :title="e.narration || e.refType">
                  {{ e.narration || e.refType || 'Ledger Posting' }}
                </p>
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                {{ e.debitAmount > 0 ? formatINR(e.debitAmount) : '—' }}
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                {{ e.creditAmount > 0 ? formatINR(e.creditAmount) : '—' }}
              </td>
              <td class="py-2 px-3 text-right font-mono font-bold whitespace-nowrap">
                <span :class="e.runningBalanceType === 'DR' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
                  {{ formatINR(e.runningBalance || 0) }}&nbsp;<span class="text-[9px] font-bold">{{ e.runningBalanceType }}</span>
                </span>
              </td>
              <td class="py-2 px-2 text-center whitespace-nowrap sticky right-0 z-10 bg-white dark:bg-zinc-900 group-hover:bg-slate-50 dark:group-hover:bg-zinc-800/90 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.12)] print:hidden w-28 min-w-[116px]">
                <div v-if="(e.voucherGroupId || e.voucherNo) && e.voucherType !== 'OPENING_BALANCE'" class="flex items-center justify-center gap-0.5">
                  <!-- View Button -->
                  <button
                    type="button"
                    class="p-1 rounded-md text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                    title="View Voucher Details"
                    @click="openVoucherView(e)"
                  >
                    <UIcon name="i-heroicons-eye" class="w-4 h-4" />
                  </button>

                  <!-- Edit Button -->
                  <button
                    v-if="isEditableVoucher(e)"
                    type="button"
                    class="p-1 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer disabled:opacity-50"
                    :disabled="actionLoadingId === (e.voucherGroupId || e.voucherNo)"
                    title="Edit Voucher"
                    @click="openVoucherEdit(e)"
                  >
                    <UIcon 
                      :name="actionLoadingId === (e.voucherGroupId || e.voucherNo) ? 'i-heroicons-arrow-path' : 'i-heroicons-pencil-square'" 
                      class="w-4 h-4" 
                      :class="{ 'animate-spin': actionLoadingId === (e.voucherGroupId || e.voucherNo) }"
                    />
                  </button>

                  <!-- Print PDF Button -->
                  <button
                    type="button"
                    class="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
                    title="Print Voucher PDF"
                    @click="printVoucher(e)"
                  >
                    <UIcon name="i-heroicons-printer" class="w-4 h-4" />
                  </button>

                  <!-- Delete / Reverse Button -->
                  <button
                    type="button"
                    class="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete / Reverse Voucher"
                    @click="confirmDeleteVoucher(e)"
                  >
                    <UIcon name="i-heroicons-trash" class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Confirm Delete Voucher Modal Overlay -->
    <div 
      v-if="showDeleteConfirm && deletingVoucher" 
      class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      @click.self="showDeleteConfirm = false"
    >
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-5 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div class="flex items-center gap-3 text-rose-600">
          <div class="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-xl">
            <UIcon name="i-heroicons-exclamation-triangle" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Delete Voucher</h3>
            <p class="text-xs text-slate-500 font-mono">{{ deletingVoucher.voucherNo || deletingVoucher.voucherGroupId }}</p>
          </div>
        </div>

        <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs space-y-1.5">
          <div class="flex justify-between text-slate-600 dark:text-zinc-400">
            <span>Date:</span>
            <span class="font-mono font-bold text-slate-900 dark:text-white">{{ deletingVoucher.transactionDate }}</span>
          </div>
          <div class="flex justify-between text-slate-600 dark:text-zinc-400">
            <span>Type:</span>
            <span class="font-bold text-slate-900 dark:text-white">{{ deletingVoucher.voucherType }}</span>
          </div>
          <div class="flex justify-between text-slate-600 dark:text-zinc-400">
            <span>Amount:</span>
            <span class="font-mono font-black text-rose-600">{{ formatINR(deletingVoucher.debitAmount || deletingVoucher.creditAmount) }}</span>
          </div>
          <div class="pt-1 text-[11px] text-slate-500 border-t dark:border-zinc-700">
            <strong>Narration:</strong> {{ deletingVoucher.narration || 'No narration' }}
          </div>
        </div>

        <p class="text-xs text-slate-600 dark:text-zinc-300">
          Are you sure you want to delete this voucher? All associated double-entry legs will be removed from the General Ledger.
        </p>

        <div class="flex justify-end gap-2 pt-2 border-t dark:border-zinc-800">
          <UButton 
            variant="ghost" 
            color="neutral" 
            size="xs" 
            label="Cancel" 
            :disabled="isDeleting"
            @click="showDeleteConfirm = false" 
          />
          <UButton 
            variant="solid" 
            color="error" 
            size="xs" 
            icon="i-heroicons-trash"
            label="Confirm Delete" 
            :loading="isDeleting"
            @click="executeDeleteVoucher" 
          />
        </div>
      </div>
    </div>

    <!-- Voucher Detail Modal (View Mode) -->
    <VoucherDetailModal
      v-model="showDetailModal"
      :voucher-id="selectedVoucherId"
      @edit="handleEditFromDetail"
      @deleted="handleVoucherDeleted"
      @refresh="loadStatement"
    />

    <!-- Voucher Modal (Edit Mode) -->
    <VoucherModal
      v-model="showEditModal"
      :is-edit="true"
      :voucher-group-id="editingVoucherGroupId"
      :initial-data="editingVoucherData"
      @saved="handleVoucherSaved"
    />
  </div>
</template>
