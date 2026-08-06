<template>
  <div class="p-4 py-3 w-full mx-auto">
    <!-- Header Section -->
    <div class="flex justify-between items-center mb-3">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Invoices & Notes</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Manage sales, purchases, and returns</p>
        </div>
      </div>
      <div class="flex gap-2">
        <UButton
          color="success"
          variant="outline"
          icon="i-heroicons-plus"
          size="sm"
          label="Purchase"
          class="font-semibold text-xs h-8"
          @click="$router.push('/accounting/purchases/new')"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="Sales Invoice"
          class="font-semibold text-xs h-8"
          @click="$router.push('/accounting/sales/new')"
        />
      </div>
    </div>

    <!-- Filters Section -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 mb-3 flex flex-wrap gap-3 items-end">
       <div class="flex-1 min-w-[200px] flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">Type</label>
          <USelect 
             v-model="filters.btype" 
             :items="typeOptions" 
             class="w-full" 
             placeholder="Select Type"
             size="sm"
             @update:model-value="handleFilterChange" 
          />
       </div>
       <div class="w-64 flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest px-1">Search Party</label>
          <UInput 
             ref="searchInput"
             v-model="partySearch" 
             placeholder="Search by name..." 
             icon="i-heroicons-magnifying-glass"
             size="sm"
             class="w-full" 
             @keydown.down.prevent="moveActiveRow(1)"
             @keydown.up.prevent="moveActiveRow(-1)"
             @keydown.enter.prevent="selectActiveRow"
          />
       </div>
       <div class="flex gap-2">
         <UButton
           color="neutral"
           variant="outline"
           icon="i-heroicons-table-cells"
           label="Export Excel"
           size="sm"
           class="h-8 text-xs font-bold"
           @click="exportExcel"
           title="Export Filtered Bills to Excel"
         />
         <UButton
           color="neutral"
           variant="outline"
           icon="i-heroicons-document-arrow-down"
           label="Export PDF"
           size="sm"
           class="h-8 text-xs font-bold"
           @click="exportPDF"
           title="Export Filtered Bills to PDF Report"
         />
       </div>
    </div>

    <!-- Bills Table Card -->
    <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-gray-800" :ui="{ body: 'p-0 overflow-hidden' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-blue-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Loading invoices...</p>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto">
        <UTable 
          :data="filteredBills" 
          :columns="columns" 
          :loading="loading" 
          class="w-full text-xs"
          :ui="{ 
            td: 'py-2 px-4 text-gray-700 dark:text-zinc-300',
            th: 'py-2.5 px-4 text-gray-500 font-bold uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800',
            tr: 'hover:bg-green-100/80 dark:hover:bg-green-900/30 transition-colors cursor-pointer'
          }"
        >
          <!-- Bill Info Column -->
          <template #bno-cell="{ row }">
            <div>
              <div class="font-bold text-gray-900 dark:text-white leading-tight">{{ row.original.bno }}</div>
              <div class="text-[10px] uppercase font-black tracking-widest mt-0.5" :class="getTypeColor(row.original.btype)">
                {{ row.original.btype.replace('_', ' ') }}
              </div>
              <div class="text-[9px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                {{ formatDate(row.original.bdate) }}
              </div>
            </div>
          </template>

          <!-- Party Name Column -->
          <template #partyName-cell="{ row }">
            <div>
              <div class="font-bold text-gray-800 dark:text-zinc-200 leading-tight">{{ row.original.partyName }}</div>
              <div class="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5 font-mono">{{ row.original.partyGstin || 'UNREGISTERED' }}</div>
            </div>
          </template>

          <!-- Status Column -->
          <template #status-cell="{ row }">
            <UBadge 
              :color="row.original.status === 'ACTIVE' ? 'success' : (row.original.status === 'CONVERTED' ? 'neutral' : 'error')" 
              size="sm" 
              variant="subtle" 
              class="px-2 py-0.5 font-black uppercase tracking-widest text-[9px] rounded-md"
            >
              {{ row.original.status }}
            </UBadge>
          </template>

          <!-- Taxable Amount Column -->
          <template #grossTotal-header>
            <div class="text-right w-full">Taxable</div>
          </template>
          <template #grossTotal-cell="{ row }">
            <div class="text-right w-full text-gray-600 dark:text-zinc-400 font-medium">
              ₹{{ (row.original.grossTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- Total Tax Column -->
          <template #totalTax-header>
            <div class="text-right w-full">Total Tax</div>
          </template>
          <template #totalTax-cell="{ row }">
            <div class="text-right w-full text-gray-600 dark:text-zinc-400 font-medium">
              ₹{{ ((row.original.cgst || 0) + (row.original.sgst || 0) + (row.original.igst || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- Net Amount Column -->
          <template #netTotal-header>
            <div class="text-right w-full">Net Amount</div>
          </template>
          <template #netTotal-cell="{ row }">
            <div class="text-right w-full font-black text-gray-900 dark:text-white">
              ₹{{ (row.original.netTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </div>
          </template>

          <!-- Actions Column -->
          <template #actions-header>
            <div class="text-center w-full">Actions</div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-center items-center gap-1">
              <UTooltip text="View Details">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="neutral" 
                  icon="i-heroicons-eye" 
                  @click="viewBillDetails(row.original._id)" 
                />
              </UTooltip>
              <UTooltip text="View PDF">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="neutral" 
                  icon="i-heroicons-arrow-down-tray" 
                  @click="downloadPDF(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE' && (row.original.btype === 'SALES' || row.original.btype === 'PURCHASE' || row.original.btype === 'PROFORMA' || row.original.btype === 'DELIVERY_NOTE')" text="Edit Bill">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="primary" 
                  icon="i-heroicons-pencil-square" 
                  @click="handleEdit(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE' && (row.original.btype === 'SALES' || row.original.btype === 'PURCHASE')" text="Return / Credit Note">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="warning" 
                  icon="i-heroicons-arrow-uturn-left" 
                  @click="handleReturn(row.original)" 
                />
              </UTooltip>
              <UTooltip v-if="row.original.status === 'ACTIVE'" text="Cancel Bill">
                <UButton 
                  size="xs" 
                  variant="ghost" 
                  color="error" 
                  icon="i-heroicons-x-circle" 
                  @click="handleCancel(row.original._id)" 
                />
              </UTooltip>
            </div>
          </template>
        </UTable>
      </div>
    </UCard>

    <BillDetailsModal
      v-model="showDetailsModal"
      :billId="selectedBillId"
      @cancelled="handleFilterChange"
      @view-bill="viewBillDetails"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useBilling } from '@/composables/useBilling';
import { api } from '@/utils/api';
import BillDetailsModal from '@/components/accounting/BillDetailsModal.vue';

const router = useRouter();
const { bills, fetchBills, loading } = useBilling();

const selectedBillId = ref<string | null>(null);
const showDetailsModal = ref(false);

const searchInput = ref<any>(null);
const activeRowIndex = ref(0);

const columns = [
  { accessorKey: 'bno', header: 'Bill Info' },
  { accessorKey: 'partyName', header: 'Party Name' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'grossTotal', header: 'Taxable' },
  { accessorKey: 'totalTax', header: 'Total Tax' },
  { accessorKey: 'netTotal', header: 'Net Amount' },
  { id: 'actions', header: 'Actions' }
];

const typeOptions = [
  { label: 'All Transactions', value: 'ALL' },
  { label: 'Sales Invoices', value: 'SALES' },
  { label: 'Proforma Invoices', value: 'PROFORMA' },
  { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
  { label: 'Purchase Bills', value: 'PURCHASE' },
  { label: 'Credit Notes (Returns)', value: 'CREDIT_NOTE' },
  { label: 'Debit Notes (Returns)', value: 'DEBIT_NOTE' }
];

function viewBillDetails(id: string) {
  selectedBillId.value = id;
  showDetailsModal.value = true;
}

const filters = reactive({
  btype: 'ALL'
});
const partySearch = ref('');

const filteredBills = computed(() => {
  if (!partySearch.value) return bills.value;
  const q = partySearch.value.toLowerCase();
  return bills.value.filter(b => b.partyName.toLowerCase().includes(q));
});

function handleFilterChange() {
  const params: any = {};
  if (filters.btype && filters.btype !== 'ALL') {
    params.btype = filters.btype;
  }
  fetchBills(params);
}

function getTableRows(): NodeListOf<HTMLElement> | null {
  const table = document.querySelector('table');
  if (!table) return null;
  return table.querySelectorAll('tbody tr');
}

function highlightActiveRow() {
  const rows = getTableRows();
  if (!rows) return;
  rows.forEach((row) => {
    row.classList.remove('kb-active-row');
  });
  const activeRow = rows[activeRowIndex.value] as HTMLElement;
  if (activeRow) {
    activeRow.classList.add('kb-active-row');
  }
}

function moveActiveRow(direction: number) {
  const len = filteredBills.value.length;
  if (len === 0) return;
  activeRowIndex.value = (activeRowIndex.value + direction + len) % len;
  nextTick(() => {
    highlightActiveRow();
    scrollToActiveRow();
  });
}

function scrollToActiveRow() {
  const rows = getTableRows();
  if (!rows) return;
  const activeRow = rows[activeRowIndex.value] as HTMLElement;
  if (!activeRow) return;
  activeRow.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function selectActiveRow() {
  const activeBill = filteredBills.value[activeRowIndex.value];
  if (activeBill) {
    viewBillDetails(activeBill._id);
  }
}

watch(filteredBills, () => {
  activeRowIndex.value = 0;
  nextTick(() => {
    highlightActiveRow();
  });
});

onMounted(() => {
  handleFilterChange();
  setTimeout(() => {
    const inputEl = searchInput.value?.$el?.querySelector('input') || searchInput.value;
    inputEl?.focus();
    nextTick(() => highlightActiveRow());
  }, 100);
});

watch(bills, () => {
  nextTick(() => highlightActiveRow());
});

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeColor(type: string) {
  const map: any = {
    'SALES': 'text-blue-600 dark:text-blue-400',
    'PROFORMA': 'text-teal-600 dark:text-teal-400',
    'DELIVERY_NOTE': 'text-amber-600 dark:text-amber-400',
    'PURCHASE': 'text-green-600 dark:text-green-400',
    'CREDIT_NOTE': 'text-purple-600 dark:text-purple-400',
    'DEBIT_NOTE': 'text-orange-600 dark:text-orange-400'
  };
  return map[type] || 'text-gray-600 dark:text-gray-400';
}

function handleEdit(bill: any) {
  const btypeUpper = String(bill.btype).toUpperCase();
  const path = ['SALES', 'PROFORMA', 'DELIVERY_NOTE'].includes(btypeUpper) 
    ? `/accounting/sales/${bill._id}/edit` 
    : `/accounting/purchases/${bill._id}/edit`;
  router.push(path);
}

function handleReturn(bill: any) {
  const path = bill.btype === 'SALES' ? '/accounting/sales/new' : '/accounting/purchases/new';
  router.push({ path, query: { returnFrom: bill._id } });
}

async function handleCancel(id: string) {
  if (!confirm('Are you sure you want to cancel this bill? This will reverse all stock and ledger effects.')) return;
  try {
    await api.post(`/accounting/bills/${id}/cancel`, { reason: 'User requested cancellation' });
    handleFilterChange();
  } catch (err) {
    alert('Cancellation failed');
  }
}

async function downloadPDF(bill: any) {
  try {
    await (api as any).download(`/accounting/bills/${bill._id}/pdf`, `Invoice_${bill.bno}.pdf`);
  } catch (err) {
    alert('PDF download failed.');
  }
}

async function exportPDF() {
  try {
    const params: any = {};
    if (filters.btype && filters.btype !== 'ALL') params.btype = filters.btype;
    if (partySearch.value) params.searchTerm = partySearch.value;

    await (api as any).download('/accounting/bills/export/pdf', `Bills_Report.pdf`);
  } catch (err) {
    alert('PDF export failed.');
  }
}

async function exportExcel() {
  try {
    const params: any = {};
    if (filters.btype && filters.btype !== 'ALL') params.btype = filters.btype;

    await (api as any).download('/accounting/bills/export', `Bills_Export.xlsx`);
  } catch (err) {
    alert('Excel export failed.');
  }
}
</script>

<style scoped>
:deep(tbody tr.kb-active-row) {
  background-color: rgba(220, 252, 231, 0.8) !important;
}
.dark :deep(tbody tr.kb-active-row) {
  background-color: rgba(20, 83, 45, 0.4) !important;
}
:deep(tbody tr.kb-active-row td:first-child) {
  border-left: 4px solid #22c55e !important;
}
</style>
