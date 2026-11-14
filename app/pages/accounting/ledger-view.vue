<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-end mb-2">
      <div>
        <UButton 
          color="neutral" 
          variant="link" 
          icon="i-heroicons-arrow-left" 
          size="xs" 
          label="Back to Dashboard" 
          class="p-0 mb-1 font-bold text-xs" 
          @click="$router.back()" 
        />
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Account Ledger</h1>
          <div class="flex items-center gap-2 mt-0.5">
             <div class="w-80">
               <AccountSelectMenu 
                  v-model="accountHead" 
                  :accounts="chartOfAccounts" 
                  placeholder="Search or select Account Head..."
                  :show-balance="false"
                  @change="updateHead"
                  @account-created="onAccountCreated" 
               />
             </div>
             <UBadge 
                v-if="accountHead"
                size="sm" 
                variant="subtle" 
                :color="currentBalance.balanceType === 'DR' ? 'success' : 'error'"
                class="font-black text-[9px] rounded-md h-8 flex items-center px-2 py-0 shrink-0"
              >
                {{ currentBalance.balanceType }} BAL: {{ formatCurrency(currentBalance.balance) }}
              </UBadge>
          </div>
        </div>
      </div>
      
      <div class="flex items-end gap-2">
         <div class="w-32 flex flex-col gap-0.5">
            <span class="text-[8px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">From</span>
            <UInput type="date" v-model="filters.fromDate" size="sm" class="w-full" @change="loadLedger" />
         </div>
         <div class="w-32 flex flex-col gap-0.5">
            <span class="text-[8px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">To</span>
            <UInput type="date" v-model="filters.toDate" size="sm" class="w-full" @change="loadLedger" />
         </div>
         <div class="flex gap-1.5 h-8">
            <UButton 
              color="success"
              variant="outline"
              icon="i-heroicons-arrow-down-tray"
              label="PDF"
              size="sm"
              class="font-bold text-xs h-8"
              :loading="exportLoading"
              :disabled="!accountHead"
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
              :disabled="!accountHead"
              @click="onExportExcel"
            />
         </div>
      </div>
    </div>

    <!-- Main Ledger Card -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <div v-if="loading" class="p-12 text-center text-gray-400">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary" />
        <p class="text-xs uppercase tracking-widest font-black mt-2">Loading ledger journal...</p>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
          <thead>
            <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-850/80">
              <th class="py-2.5 px-4">Date</th>
              <th class="py-2.5 px-4">Voucher</th>
              <th class="py-2.5 px-4">Narration</th>
              <th class="py-2.5 px-4 text-right">Debit</th>
              <th class="py-2.5 px-4 text-right">Credit</th>
              <th class="py-2.5 px-4 text-right">Balance</th>
              <th class="py-2.5 px-3 text-center w-24">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
            <tr v-for="(entry, idx) in runningLedger" :key="idx" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
              <td class="py-2 px-4 text-gray-600 dark:text-zinc-400 whitespace-nowrap">{{ entry.transactionDate }}</td>
              <td class="py-2 px-4">
                <button
                  v-if="entry.voucherGroupId || entry.voucherNo"
                  type="button"
                  class="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer flex items-center gap-1 text-left"
                  title="Click to view full voucher details"
                  @click="openVoucherView(entry)"
                >
                  <span>{{ entry.voucherNo || entry.voucherGroupId || entry.refType }}</span>
                  <UIcon name="i-heroicons-arrow-top-right-on-square" class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                </button>
                <div v-else class="font-bold text-gray-900 dark:text-white">{{ entry.voucherNo || entry.refType }}</div>
                <div class="text-[9px] text-gray-400 dark:text-zinc-500 uppercase font-bold tracking-wider mt-0.5">{{ entry.voucherType }}</div>
              </td>
              <td class="py-2 px-4">
                <div class="max-w-xs text-gray-700 dark:text-zinc-300 leading-normal">{{ entry.narration }}</div>
              </td>
              <td class="py-2 px-4 text-right font-medium text-rose-600 dark:text-rose-400 font-mono">
                {{ entry.debitAmount > 0 ? formatCurrency(entry.debitAmount) : '' }}
              </td>
              <td class="py-2 px-4 text-right font-medium text-emerald-600 dark:text-emerald-400 font-mono">
                {{ entry.creditAmount > 0 ? formatCurrency(entry.creditAmount) : '' }}
              </td>
              <td class="py-2 px-4 text-right font-bold bg-gray-50/30 dark:bg-zinc-850/20 font-mono">
                {{ formatCurrency(Math.abs(entry.runningBalance)) }} {{ entry.runningBalance >= 0 ? 'Dr' : 'Cr' }}
              </td>
              <td class="py-2 px-3 text-center">
                <div class="flex items-center justify-center gap-1">
                  <UButton
                    v-if="entry.voucherGroupId || entry.voucherNo"
                    size="2xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-heroicons-eye"
                    title="View Voucher Particulars"
                    class="cursor-pointer"
                    @click="openVoucherView(entry)"
                  />
                  <UButton
                    v-if="isEditableVoucher(entry)"
                    size="2xs"
                    color="primary"
                    variant="ghost"
                    icon="i-heroicons-pencil-square"
                    title="Edit Voucher"
                    class="cursor-pointer"
                    @click="openVoucherEdit(entry)"
                  />
                </div>
              </td>
            </tr>
            <tr v-if="!runningLedger || runningLedger.length === 0">
              <td colspan="7" class="py-16 text-center text-gray-400 dark:text-zinc-500 italic">
                {{ accountHead ? 'No transactions found for this account in the selected range.' : 'Please select an account head above to view the ledger statement.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <!-- Voucher Detail Viewer Modal -->
    <VoucherDetailModal
      v-model="showDetailModal"
      :voucher-id="selectedVoucherId"
      @edit="handleEditFromDetail"
      @deleted="loadLedger"
      @refresh="loadLedger"
    />

    <!-- Voucher Edit Modal -->
    <VoucherModal
      v-model="showEditModal"
      :is-edit="true"
      :voucher-group-id="selectedVoucherId"
      :initial-data="editingVoucherData"
      @saved="loadLedger"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAccounting } from '@/composables/useAccounting';
import { formatCurrency } from '@/utils/formatters';
import AccountSelectMenu from '~/components/accounting/AccountSelectMenu.vue';
import VoucherDetailModal from '~/components/accounting/VoucherDetailModal.vue';
import VoucherModal from '~/components/accounting/VoucherModal.vue';

const route = useRoute();
const { ledgerEntries, accountBalance, fetchLedger, fetchAccountBalance, fetchCOA, chartOfAccounts, exportLedgerPdf, exportLedgerExcel, getVoucher, loading } = useAccounting();

const exportLoading = ref(false);

const onExportPDF = async () => {
  if (!accountHead.value) return;
  exportLoading.value = true;
  try {
    await exportLedgerPdf({
      accountHead: accountHead.value,
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });
  } catch (err: any) {
    console.error('Failed to export PDF:', err);
  } finally {
    exportLoading.value = false;
  }
};

const onExportExcel = async () => {
  if (!accountHead.value) return;
  exportLoading.value = true;
  try {
    await exportLedgerExcel({
      accountHead: accountHead.value,
      fromDate: filters.fromDate,
      toDate: filters.toDate
    });
  } catch (err: any) {
    console.error('Failed to export Excel:', err);
  } finally {
    exportLoading.value = false;
  }
};

const accountHead = ref<string>('');
const filters = reactive({
  fromDate: '',
  toDate: new Date().toISOString().split('T')[0]
});

onMounted(() => {
  fetchCOA();
  if (route.query.head) {
    accountHead.value = route.query.head as string;
    loadLedger();
  }
});

async function updateHead() {
   loadLedger();
}

const onAccountCreated = (newAcc: any) => {
  if (newAcc) {
    chartOfAccounts.value.push(newAcc);
    accountHead.value = newAcc.account_name;
    loadLedger();
  }
};

watch(() => route.query.head, (newHead) => {
  if (newHead) {
    accountHead.value = newHead as string;
    loadLedger();
  }
});

async function loadLedger() {
  if (!accountHead.value) return;
  await Promise.all([
    fetchLedger({ accountHead: accountHead.value, ...filters }),
    fetchAccountBalance(accountHead.value, filters.toDate)
  ]);
}

const currentBalance = computed(() => accountBalance.value);

const runningLedger = computed(() => {
  if (!Array.isArray(ledgerEntries.value)) return [];
  let bal = 0;
  return ledgerEntries.value.map(entry => {
    bal += (entry.debitAmount || 0) - (entry.creditAmount || 0);
    return { ...entry, runningBalance: bal };
  });
});

// Voucher View & Edit mechanism
const showDetailModal = ref(false);
const showEditModal = ref(false);
const selectedVoucherId = ref('');
const editingVoucherData = ref<any>(null);

function isEditableVoucher(entry: any) {
  if (!entry) return false;
  const refType = String(entry.refType || '').toUpperCase();
  if (['BILL', 'SALE', 'PURCHASE', 'WAGE', 'WAGE_PAYOUT'].includes(refType)) return false;
  if (entry.isWageEntry || entry.isReversed) return false;
  const vtype = String(entry.voucherType || '').toUpperCase();
  return ['PAYMENT', 'RECEIPT', 'JOURNAL', 'CONTRA'].includes(vtype);
}

function openVoucherView(entry: any) {
  const id = entry.voucherGroupId || entry.voucherNo;
  if (!id) return;
  selectedVoucherId.value = id;
  showDetailModal.value = true;
}

async function openVoucherEdit(entry: any) {
  const id = entry.voucherGroupId || entry.voucherNo;
  if (!id) return;
  selectedVoucherId.value = id;
  try {
    const res = await getVoucher(id);
    if (res.success && res.data) {
      if (!res.data.isEditable) {
        // If not editable (e.g. locked/settled), open in viewer mode so user sees explanation
        selectedVoucherId.value = id;
        showDetailModal.value = true;
        return;
      }
      editingVoucherData.value = res.data;
      showEditModal.value = true;
    }
  } catch (err: any) {
    console.error('Failed to load voucher for edit:', err);
    selectedVoucherId.value = id;
    showDetailModal.value = true;
  }
}

function handleEditFromDetail(voucherData: any) {
  editingVoucherData.value = voucherData;
  selectedVoucherId.value = voucherData.voucherGroupId || voucherData.voucherNo;
  showEditModal.value = true;
}
</script>
