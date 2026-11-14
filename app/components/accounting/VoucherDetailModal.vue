<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="modelValue" 
        class="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
        @click.self="closeModal"
      >
        <div 
          class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col transform transition-all duration-200"
          role="dialog"
          aria-modal="true"
        >
          <!-- Header -->
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-6 py-4 flex justify-between items-center border-b border-indigo-500/20 shadow-md shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-lg shadow-md ring-1 ring-white/20">
                <span>{{ voucherTypeIcon }}</span>
              </div>
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h2 class="text-base font-black tracking-tight text-white uppercase">
                    {{ voucherTitle }}
                  </h2>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-200 border border-white/20">
                    #{{ voucherData?.voucherNo || voucherId }}
                  </span>
                  <span 
                    class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border"
                    :class="voucherData?.isReversed 
                      ? 'bg-rose-500/20 text-rose-300 border-rose-400/30' 
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'"
                  >
                    {{ voucherData?.isReversed ? 'Reversed' : 'Active Voucher' }}
                  </span>
                </div>
                <p class="text-[11px] text-slate-300/80 mt-0.5 font-medium">
                  Detailed double-entry particulars, audit trail, and accounting distribution
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                v-if="voucherData"
                type="button"
                @click="printVoucher"
                class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center gap-1.5 transition-colors cursor-pointer ring-1 ring-white/10 text-xs font-bold"
                title="Print Voucher PDF"
              >
                <UIcon name="i-heroicons-printer" class="w-4 h-4 text-blue-300" />
                <span class="hidden sm:inline">Print</span>
              </button>

              <button 
                type="button"
                @click="closeModal" 
                class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/10"
                aria-label="Close"
              >
                <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Body Content -->
          <div class="overflow-y-auto p-6 flex-1 space-y-4">
            <!-- Loading State -->
            <div v-if="loading" class="py-20 flex flex-col items-center justify-center gap-3">
              <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
              <p class="text-xs uppercase tracking-widest font-black text-slate-400">Loading voucher details...</p>
            </div>

            <!-- Error State -->
            <div v-else-if="error" class="p-6 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-2xl text-center space-y-3">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-8 h-8 text-rose-500 mx-auto" />
              <p class="text-xs font-bold text-rose-700 dark:text-rose-300">{{ error }}</p>
              <UButton size="xs" color="rose" variant="soft" label="Retry" @click="fetchDetails" />
            </div>

            <!-- Loaded Content -->
            <template v-else-if="voucherData">
              <!-- Reversal Alert -->
              <div v-if="voucherData.isReversed" class="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center gap-3 text-xs text-rose-800 dark:text-rose-300">
                <UIcon name="i-heroicons-archive-box-x-mark" class="w-5 h-5 shrink-0 text-rose-600" />
                <div>
                  <strong>Void / Reversed Voucher:</strong> This voucher was neutralized in compliance with immutable accounting standards.
                  <span v-if="voucherData.reversalVoucherGroupId" class="font-mono ml-1 font-bold">
                    (Reversal Ref: {{ voucherData.reversalVoucherGroupId }})
                  </span>
                </div>
              </div>

              <!-- Non-Editable Reason Banner -->
              <div v-if="!voucherData.isEditable && !voucherData.isReversed" class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3 text-xs text-amber-800 dark:text-amber-300">
                <UIcon name="i-heroicons-lock-closed" class="w-5 h-5 shrink-0 text-amber-600" />
                <div>
                  <span class="font-black uppercase tracking-wider mr-1.5">View-Only:</span>
                  <span>{{ voucherData.notEditableReason || 'This voucher is locked and cannot be edited directly.' }}</span>
                </div>
              </div>

              <!-- Key Voucher KPI Strip -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div class="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/50">
                  <div class="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="w-3 h-3 text-blue-500" />
                    <span>Transaction Date</span>
                  </div>
                  <div class="text-xs font-black font-mono text-slate-900 dark:text-white">
                    {{ voucherData.vdate }}
                  </div>
                </div>

                <div class="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/50">
                  <div class="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <UIcon name="i-heroicons-document-text" class="w-3 h-3 text-indigo-500" />
                    <span>Voucher Group ID</span>
                  </div>
                  <div class="text-[11px] font-bold font-mono text-slate-700 dark:text-zinc-300 truncate" :title="voucherData.voucherGroupId">
                    {{ voucherData.voucherGroupId }}
                  </div>
                </div>

                <div class="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/50">
                  <div class="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <UIcon name="i-heroicons-banknotes" class="w-3 h-3 text-emerald-500" />
                    <span>Total Voucher Value</span>
                  </div>
                  <div class="text-xs font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {{ formatINR(voucherData.totalDebit || voucherData.totalCredit) }}
                  </div>
                </div>

                <div class="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/50">
                  <div class="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                    <UIcon name="i-heroicons-user" class="w-3 h-3 text-amber-500" />
                    <span>Created By</span>
                  </div>
                  <div class="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {{ voucherData.createdBy || 'System' }}
                  </div>
                </div>
              </div>

              <!-- Particulars / Ledger Legs Table -->
              <div class="border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                <div class="px-4 py-2.5 bg-slate-50 dark:bg-zinc-850/80 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
                  <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Double-Entry Voucher Particulars
                  </span>
                  <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider" :class="isBalanced ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-rose-100 text-rose-800'">
                    {{ isBalanced ? '✓ Double-Entry In Parity' : '⚠ Out of Parity' }}
                  </span>
                </div>

                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-slate-100 dark:divide-zinc-800">
                    <thead class="bg-slate-50/50 dark:bg-zinc-900/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <tr>
                        <th class="py-2 px-3 w-10 text-center">#</th>
                        <th class="py-2 px-3">Particulars / Account Head</th>
                        <th class="py-2 px-3">Category</th>
                        <th class="py-2 px-3 text-right">Debit (Dr)</th>
                        <th class="py-2 px-3 text-right">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                      <tr v-for="(leg, index) in displayLegs" :key="index" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                        <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[11px]">{{ index + 1 }}</td>
                        <td class="py-2.5 px-3">
                          <div class="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <span>{{ leg.accountHead }}</span>
                            <span v-if="leg.isDeduction" class="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 uppercase">
                              Deduction
                            </span>
                          </div>
                          <div v-if="leg.narration" class="text-[10px] text-slate-400 mt-0.5 max-w-md truncate">
                            {{ leg.narration }}
                          </div>
                        </td>
                        <td class="py-2.5 px-3">
                          <span class="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider" :class="getAccountTypeBadgeClass(leg.accountType)">
                            {{ leg.accountType || 'LEDGER' }}
                          </span>
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                          {{ leg.debitAmount > 0 ? formatINR(leg.debitAmount) : '—' }}
                        </td>
                        <td class="py-2.5 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {{ leg.creditAmount > 0 ? formatINR(leg.creditAmount) : '—' }}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot class="bg-slate-50 dark:bg-zinc-850/80 font-black font-mono text-xs border-t border-slate-200 dark:border-zinc-800">
                      <tr>
                        <td colspan="3" class="py-2 px-4 text-slate-700 dark:text-zinc-300 uppercase text-[10px] tracking-wider">
                          Total Double-Entry Effect
                        </td>
                        <td class="py-2 px-3 text-right text-rose-600 dark:text-rose-400">
                          {{ formatINR(totalDr) }}
                        </td>
                        <td class="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">
                          {{ formatINR(totalCr) }}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <!-- Narration & Notes -->
              <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-850/50 space-y-1">
                <span class="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Voucher Narration
                </span>
                <p class="text-xs text-slate-800 dark:text-zinc-200 leading-relaxed font-medium">
                  {{ voucherData.narration || 'No general narration provided.' }}
                </p>
              </div>

              <!-- Statutory TDS Assistant Details (If Applicable) -->
              <div v-if="voucherData.statutory" class="p-3.5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                    <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-indigo-600" />
                    <span>Statutory TDS Compliance Metadata</span>
                  </div>
                  <span class="px-2 py-0.5 rounded text-[9px] font-black font-mono bg-indigo-100 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 uppercase">
                    Sec {{ voucherData.statutory.section || '194C' }}
                  </span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                  <div>
                    <span class="text-[9px] text-slate-400 uppercase font-bold block">PAN</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-zinc-200">{{ voucherData.statutory.pan || 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[9px] text-slate-400 uppercase font-bold block">Rate</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-zinc-200">{{ voucherData.statutory.rate ? `${voucherData.statutory.rate}%` : 'N/A' }}</span>
                  </div>
                  <div>
                    <span class="text-[9px] text-slate-400 uppercase font-bold block">Gross Base</span>
                    <span class="font-mono font-bold text-slate-800 dark:text-zinc-200">{{ formatINR(voucherData.statutory.grossAmount || voucherData.statutory.taxableAmount) }}</span>
                  </div>
                  <div>
                    <span class="text-[9px] text-slate-400 uppercase font-bold block">Gross-Up (195A)</span>
                    <span class="font-bold text-indigo-600 dark:text-indigo-400">{{ voucherData.statutory.isGrossUp ? 'Yes (Firm Borne)' : 'Standard Deduction' }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Footer Actions -->
          <div class="flex items-center justify-between border-t px-6 py-4 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900 shrink-0">
            <div class="flex items-center gap-2">
              <UButton 
                v-if="voucherData?.canDelete"
                color="error" 
                variant="outline" 
                size="sm" 
                icon="i-heroicons-trash"
                label="Delete Voucher"
                class="font-bold text-xs"
                @click="onDeleteVoucher"
              />
            </div>

            <div class="flex items-center gap-2">
              <UButton 
                color="neutral" 
                variant="outline" 
                size="sm" 
                label="Close" 
                class="font-bold text-xs"
                @click="closeModal" 
              />
              <UButton 
                v-if="voucherData?.isEditable"
                color="primary" 
                variant="solid" 
                size="sm" 
                icon="i-heroicons-pencil-square"
                label="Edit Voucher"
                class="font-black text-xs cursor-pointer shadow-sm"
                @click="onEditVoucher" 
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAccounting } from '@/composables/useAccounting';

const props = withDefaults(defineProps<{
  modelValue: boolean;
  voucherId?: string;
}>(), {
  voucherId: ''
});

const emit = defineEmits(['update:modelValue', 'edit', 'deleted', 'refresh']);

const { getVoucher, deleteVoucher } = useAccounting();

const loading = ref(false);
const error = ref<string | null>(null);
const voucherData = ref<any>(null);

const voucherTypeIcon = computed(() => {
  const t = (voucherData.value?.vtype || '').toUpperCase();
  if (t === 'PAYMENT') return '💳';
  if (t === 'RECEIPT') return '💰';
  if (t === 'CONTRA') return '🔄';
  return '📝';
});

const voucherTitle = computed(() => {
  const t = (voucherData.value?.vtype || '').toUpperCase();
  if (t === 'PAYMENT') return 'Payment Voucher';
  if (t === 'RECEIPT') return 'Receipt Voucher';
  if (t === 'CONTRA') return 'Contra Voucher';
  return 'Journal Entry';
});

const displayLegs = computed(() => {
  if (!voucherData.value) return [];
  // If rawEntries from Ledger exist, display all legs directly
  if (Array.isArray(voucherData.value.rawEntries) && voucherData.value.rawEntries.length > 0) {
    return voucherData.value.rawEntries.map((leg: any) => ({
      accountHead: leg.accountHead,
      accountType: leg.accountType,
      debitAmount: Number(leg.debitAmount || 0),
      creditAmount: Number(leg.creditAmount || 0),
      narration: leg.narration || '',
      isDeduction: false
    }));
  }

  // Fallback to reconstructed entries
  const legs: any[] = [];
  const vtype = voucherData.value.vtype || 'PAYMENT';

  if (vtype === 'PAYMENT' && voucherData.value.mainAccount) {
    let totalOut = 0;
    (voucherData.value.entries || []).forEach((e: any) => {
      const amt = Number(e.amount || 0);
      legs.push({
        accountHead: e.accountHead,
        accountType: e.accountType || 'EXPENSE',
        debitAmount: amt > 0 ? amt : 0,
        creditAmount: amt < 0 ? Math.abs(amt) : 0,
        narration: '',
        isDeduction: e.isDeduction || amt < 0
      });
      totalOut += amt;
    });
    // Main paid from leg (Credit)
    legs.push({
      accountHead: voucherData.value.mainAccount,
      accountType: 'BANK/CASH',
      debitAmount: 0,
      creditAmount: Math.max(0, totalOut),
      narration: voucherData.value.narration || 'Payment Outflow',
      isDeduction: false
    });
  } else if (vtype === 'RECEIPT' && voucherData.value.mainAccount) {
    let totalIn = 0;
    (voucherData.value.entries || []).forEach((e: any) => {
      const amt = Number(e.amount || 0);
      legs.push({
        accountHead: e.accountHead,
        accountType: e.accountType || 'INCOME',
        debitAmount: amt < 0 ? Math.abs(amt) : 0,
        creditAmount: amt > 0 ? amt : 0,
        narration: '',
        isDeduction: e.isDeduction || amt < 0
      });
      totalIn += amt;
    });
    // Main deposit leg (Debit)
    legs.push({
      accountHead: voucherData.value.mainAccount,
      accountType: 'BANK/CASH',
      debitAmount: Math.max(0, totalIn),
      creditAmount: 0,
      narration: voucherData.value.narration || 'Receipt Inflow',
      isDeduction: false
    });
  } else {
    // Journal or Contra
    (voucherData.value.entries || []).forEach((e: any) => {
      legs.push({
        accountHead: e.accountHead,
        accountType: e.accountType || 'LEDGER',
        debitAmount: Number(e.debitAmount || 0),
        creditAmount: Number(e.creditAmount || 0),
        narration: '',
        isDeduction: false
      });
    });
  }

  return legs;
});

const totalDr = computed(() => {
  return displayLegs.value.reduce((s, leg) => s + (leg.debitAmount || 0), 0);
});

const totalCr = computed(() => {
  return displayLegs.value.reduce((s, leg) => s + (leg.creditAmount || 0), 0);
});

const isBalanced = computed(() => {
  return Math.abs(totalDr.value - totalCr.value) < 0.01;
});

function getAccountTypeBadgeClass(type?: string) {
  const t = (type || '').toUpperCase();
  if (t === 'BANK' || t.includes('BANK')) return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
  if (t === 'CASH' || t.includes('CASH')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
  if (t === 'SUNDRY_DEBTORS') return 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300';
  if (t === 'SUNDRY_CREDITORS') return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
  if (t === 'LABOR_LEADER') return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300';
  if (t === 'DUTIES_AND_TAXES') return 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
  return 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300';
}

function formatINR(val?: number) {
  if (val === undefined || val === null || !Number.isFinite(Number(val))) return '₹ 0.00';
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(val));
}

async function fetchDetails() {
  if (!props.voucherId) return;
  loading.value = true;
  error.value = null;
  voucherData.value = null;

  try {
    const res = await getVoucher(props.voucherId);
    if (res.success && res.data) {
      voucherData.value = res.data;
    } else {
      error.value = res.statusMessage || 'Voucher not found';
    }
  } catch (err: any) {
    error.value = err.statusMessage || err.message || 'Failed to load voucher details';
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && props.voucherId) {
    fetchDetails();
  }
});

watch(() => props.voucherId, (newId) => {
  if (props.modelValue && newId) {
    fetchDetails();
  }
});

function closeModal() {
  emit('update:modelValue', false);
}

function onEditVoucher() {
  if (!voucherData.value?.isEditable) return;
  emit('edit', voucherData.value);
  closeModal();
}

async function onDeleteVoucher() {
  if (!voucherData.value?.voucherGroupId) return;
  if (!confirm(`Are you sure you want to delete and reverse voucher "${voucherData.value.voucherNo || voucherData.value.voucherGroupId}"? This action cannot be undone.`)) {
    return;
  }
  loading.value = true;
  try {
    const res = await deleteVoucher(voucherData.value.voucherGroupId);
    if (res.success) {
      emit('deleted', voucherData.value.voucherGroupId);
      emit('refresh');
      closeModal();
    }
  } catch (err: any) {
    alert(err.statusMessage || err.message || 'Failed to delete voucher');
  } finally {
    loading.value = false;
  }
}

function printVoucher() {
  if (!voucherData.value) return;
  const targetId = voucherData.value.voucherGroupId || voucherData.value.voucherNo;
  window.open(`/api/accounting/vouchers/${encodeURIComponent(targetId)}/print`, '_blank');
}
</script>
