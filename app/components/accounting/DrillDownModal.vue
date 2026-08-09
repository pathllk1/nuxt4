<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useAccounting } from '@/composables/useAccounting';
import StatementModal from '@/components/accounting/StatementModal.vue';

const props = defineProps<{
  modelValue: boolean;
  drillType: string;
  initialFromDate?: string;
  initialToDate?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
}>();

const { trialBalance, fetchTrialBalance, exportDrillDownPdf, exportDrillDownExcel } = useAccounting();

const fromDate = ref(props.initialFromDate || '');
const toDate = ref(props.initialToDate || new Date().toISOString().split('T')[0]);
const searchQuery = ref('');
const loading = ref(false);
const exportLoading = ref(false);

// Nested Statement Modal state
const showStatementModal = ref(false);
const selectedAccountHead = ref('');
const selectedAccountType = ref('');

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const loadData = async () => {
  loading.value = true;
  try {
    const params: { fromDate?: string; toDate?: string } = {};
    if (fromDate.value) params.fromDate = fromDate.value;
    if (toDate.value) params.toDate = toDate.value;
    await fetchTrialBalance(params);
  } catch (err) {
    console.error('Failed to load drilldown trial balance:', err);
  } finally {
    loading.value = false;
  }
};

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    fromDate.value = props.initialFromDate || '';
    toDate.value = props.initialToDate || new Date().toISOString().split('T')[0];
    loadData();
  }
});

const drillAccounts = computed(() => {
  const typeUpper = (props.drillType || '').toUpperCase();
  const list = trialBalance.value.filter(a => {
    const aType = (a.accountType || '').toUpperCase();
    if (typeUpper === 'SUNDRY_CREDITORS' || typeUpper === 'CREDITOR') {
      return ['CREDITOR', 'SUNDRY_CREDITORS', 'PAYABLE'].includes(aType);
    }
    if (typeUpper === 'SUNDRY_DEBTORS' || typeUpper === 'DEBTOR') {
      return ['DEBTOR', 'SUNDRY_DEBTORS', 'RECEIVABLE'].includes(aType);
    }
    return aType === typeUpper;
  });

  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return list;
  return list.filter(a => a.accountHead.toLowerCase().includes(query));
});

const grandTotalDebits = computed(() => drillAccounts.value.reduce((s, a) => s + (a.totalDebit || 0), 0));
const grandTotalCredits = computed(() => drillAccounts.value.reduce((s, a) => s + (a.totalCredit || 0), 0));

const formatINR = (n: number) => {
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);
};

const openStatementRecord = (head: string, type?: string) => {
  selectedAccountHead.value = head;
  selectedAccountType.value = type || props.drillType;
  showStatementModal.value = true;
};

const onExportPDF = async () => {
  exportLoading.value = true;
  try {
    await exportDrillDownPdf(props.drillType, { fromDate: fromDate.value, toDate: toDate.value });
  } catch (err) {
    console.error('Failed to export drilldown PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  exportLoading.value = true;
  try {
    await exportDrillDownExcel(props.drillType, { fromDate: fromDate.value, toDate: toDate.value });
  } catch (err) {
    console.error('Failed to export drilldown Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md" @click.self="isOpen = false">
    <UCard 
      class="w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-150 dark:border-zinc-800 shadow-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-2xl" 
      :ui="{ body: 'p-4 overflow-y-auto flex-1', header: 'p-4 py-3 bg-gray-50 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center' }"
    >
      <template #header>
        <div>
          <span class="text-[9px] font-black text-violet-600 dark:text-violet-400 uppercase tracking-widest leading-none">{{ drillType }}</span>
          <h2 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight leading-none mt-1">Drill-Down: {{ drillType?.replace(/_/g, ' ') }}</h2>
        </div>

        <div class="flex items-center gap-2">
          <UButton 
            color="primary" 
            variant="outline" 
            icon="i-heroicons-arrow-down-tray"
            label="PDF"
            size="xs"
            class="font-bold text-xs h-7"
            :loading="exportLoading"
            @click="onExportPDF"
          />
          <UButton 
            color="success" 
            variant="outline" 
            icon="i-heroicons-arrow-down-tray"
            label="Excel"
            size="xs"
            class="font-bold text-xs h-7"
            :loading="exportLoading"
            @click="onExportExcel"
          />
          <UButton 
            size="xs" 
            variant="ghost" 
            color="neutral" 
            icon="i-heroicons-x-mark" 
            class="h-7 w-7 flex items-center justify-center p-0"
            @click="isOpen = false" 
          />
        </div>
      </template>

      <!-- Date Filters & Search -->
      <div class="flex flex-wrap items-center justify-between gap-2.5 mb-3 bg-slate-50 dark:bg-zinc-800/40 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800">
        <div class="flex-1 min-w-[200px]">
          <UInput 
            v-model="searchQuery" 
            icon="i-heroicons-magnifying-glass"
            placeholder="Search account head..."
            size="xs"
            class="w-full"
          />
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500">From</span>
          <UInput type="date" v-model="fromDate" size="xs" class="w-32" @change="loadData" />
          <span class="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-500">To</span>
          <UInput type="date" v-model="toDate" size="xs" class="w-32" @change="loadData" />
          <UButton color="primary" label="Apply" size="xs" class="font-bold h-7" @click="loadData" />
        </div>
      </div>

      <!-- Table Content -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Updating drill-down balances...</p>
      </div>

      <div v-else-if="drillAccounts.length === 0" class="py-12 text-center italic text-slate-400 dark:text-zinc-500 text-xs font-bold">
        No account heads found for {{ drillType?.replace(/_/g, ' ') }}.
      </div>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-100 dark:border-zinc-800">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
              <th class="py-2.5 px-4">Account Head</th>
              <th class="py-2.5 px-4 text-right">Debits</th>
              <th class="py-2.5 px-4 text-right">Credits</th>
              <th class="py-2.5 px-4 text-right">Balance</th>
              <th class="py-2.5 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
            <tr 
              v-for="h in drillAccounts" 
              :key="h.accountHead" 
              class="group hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-all cursor-pointer"
              @click="openStatementRecord(h.accountHead, h.accountType)"
            >
              <td class="py-2.5 px-4">
                <div class="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors uppercase tracking-tight">
                  {{ h.accountHead }}
                </div>
              </td>
              <td class="py-2.5 px-4 text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                {{ formatINR(h.totalDebit) }}
              </td>
              <td class="py-2.5 px-4 text-right font-mono text-xs text-rose-600 dark:text-rose-400 font-bold">
                {{ formatINR(h.totalCredit) }}
              </td>
              <td class="py-2.5 px-4 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <span class="font-black font-mono text-xs" :class="h.balanceType === 'DR' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'">
                    {{ formatINR(h.balance) }}
                  </span>
                  <UBadge size="sm" variant="subtle" :color="h.balanceType === 'DR' ? 'success' : 'error'" class="text-[8px] px-1.5 py-0 font-bold rounded-md">
                    {{ h.balanceType }}
                  </UBadge>
                </div>
              </td>
              <td class="py-2.5 px-4 text-center">
                <UButton 
                  size="xs" 
                  color="primary" 
                  variant="subtle" 
                  label="Statement" 
                  icon="i-heroicons-document-magnifying-glass"
                  class="font-bold text-[9px] uppercase px-2 py-0.5"
                  @click.stop="openStatementRecord(h.accountHead, h.accountType)"
                />
              </td>
            </tr>
          </tbody>
          <!-- Summary Footer -->
          <tfoot>
            <tr class="bg-slate-900 text-white font-bold text-xs">
              <td class="py-2.5 px-4 uppercase font-black text-[10px] tracking-wider text-slate-300">Grand Total</td>
              <td class="py-2.5 px-4 text-right font-mono text-emerald-400 font-black">{{ formatINR(grandTotalDebits) }}</td>
              <td class="py-2.5 px-4 text-right font-mono text-rose-400 font-black">{{ formatINR(grandTotalCredits) }}</td>
              <td class="py-2.5 px-4 text-right font-mono font-black" colSpan="2">
                <span :class="grandTotalDebits >= grandTotalCredits ? 'text-emerald-400' : 'text-rose-400'">
                  {{ formatINR(Math.abs(grandTotalDebits - grandTotalCredits)) }} {{ grandTotalDebits >= grandTotalCredits ? 'DR' : 'CR' }}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </UCard>

    <!-- Nested Statement Record Modal -->
    <StatementModal
      v-model="showStatementModal"
      :account-head="selectedAccountHead"
      :account-type="selectedAccountType"
      :initial-from-date="fromDate"
      :initial-to-date="toDate"
    />
  </div>
</template>
