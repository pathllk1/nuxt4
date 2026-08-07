<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header Section -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
          <UIcon name="i-heroicons-document-text" class="w-7 h-7" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">Inventory Sales & Purchase Bills</h1>
          <p class="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-1">Dedicated view for stock-impacting sales invoices, purchase bills, and debit/credit notes</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <UButton
          color="success"
          variant="soft"
          icon="i-heroicons-plus"
          size="md"
          label="New Purchase Bill"
          class="font-black text-xs h-10 px-4 rounded-xl"
          @click="$router.push('/accounting/purchases/new')"
        />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="md"
          label="New Sales Invoice"
          class="font-black text-xs h-10 px-4 rounded-xl shadow-md"
          @click="$router.push('/accounting/sales/new')"
        />
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
        <!-- Bill Type Select -->
        <div class="w-48">
          <USelect 
            v-model="filters.btype" 
            :items="typeOptions" 
            class="w-full" 
            placeholder="Select Bill Type"
            size="md"
            @update:model-value="handleFilterChange" 
          />
        </div>
        
        <!-- Search Input -->
        <div class="w-64">
          <UInput 
            v-model="partySearch" 
            placeholder="Search party or bill no..." 
            icon="i-heroicons-magnifying-glass"
            size="md"
            class="w-full" 
          />
        </div>
      </div>

      <!-- Action Exports -->
      <div class="flex items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-table-cells"
          label="Export Excel"
          size="sm"
          class="h-9 text-xs font-bold rounded-xl"
          @click="exportExcel"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-document-arrow-down"
          label="Export PDF"
          size="sm"
          class="h-9 text-xs font-bold rounded-xl"
          @click="exportPDF"
        />
      </div>
    </div>

    <!-- Bills Table Card -->
    <UCard class="w-full shadow-sm rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden" :ui="{ body: 'p-0' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-emerald-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Fetching inventory bills...</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="filteredBills.length === 0" class="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-900 text-center p-6">
        <div class="w-16 h-16 bg-slate-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-400 mb-4">
          <UIcon name="i-heroicons-document-text" class="w-8 h-8" />
        </div>
        <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">No Bills Found</h3>
        <p class="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-sm">No sales or purchase bills matched your current filter criteria.</p>
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 dark:bg-zinc-800/80 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800">
              <th class="px-6 py-4">Bill Info</th>
              <th class="px-6 py-4">Party Name</th>
              <th class="px-6 py-4">Type</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4 text-right">Taxable</th>
              <th class="px-6 py-4 text-right">Total Tax</th>
              <th class="px-6 py-4 text-right">Net Amount</th>
              <th class="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium text-xs">
            <tr v-for="bill in filteredBills" :key="bill._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
              <td class="px-6 py-4">
                <div class="font-black text-slate-900 dark:text-white uppercase">{{ bill.bno || 'N/A' }}</div>
                <div class="text-[10px] text-slate-400 font-bold mt-0.5">{{ formatDate(bill.bdate || bill.createdAt) }}</div>
              </td>
              <td class="px-6 py-4">
                <div class="font-black text-slate-800 dark:text-zinc-200 uppercase">{{ bill.partyName || 'Cash / General' }}</div>
                <div class="text-[10px] text-slate-400 uppercase" v-if="bill.partyGstin">GSTIN: {{ bill.partyGstin }}</div>
              </td>
              <td class="px-6 py-4">
                <UBadge :color="getTypeColor(bill.btype)" variant="soft" size="xs" class="font-black uppercase tracking-wider">
                  {{ bill.btype }}
                </UBadge>
              </td>
              <td class="px-6 py-4">
                <UBadge :color="getStatusColor(bill.status)" variant="subtle" size="xs" class="font-bold uppercase">
                  {{ bill.status || 'ACTIVE' }}
                </UBadge>
              </td>
              <td class="px-6 py-4 text-right font-semibold text-slate-700 dark:text-zinc-300">
                ₹{{ (bill.grossTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-6 py-4 text-right font-semibold text-slate-500 dark:text-zinc-400">
                ₹{{ (bill.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400">
                ₹{{ (bill.netTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
              </td>
              <td class="px-6 py-4">
                <div class="flex items-center justify-center gap-1">
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="neutral" 
                    icon="i-heroicons-eye" 
                    title="View Details"
                    @click="viewBillDetails(bill._id)" 
                  />
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="primary" 
                    icon="i-heroicons-document" 
                    title="Download PDF"
                    @click="downloadBillPdf(bill)" 
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useBilling } from '@/composables/useBilling';
import { api } from '@/utils/api';
import BillDetailsModal from '@/components/accounting/BillDetailsModal.vue';

const { bills, fetchBills, loading } = useBilling();

const selectedBillId = ref<string | null>(null);
const showDetailsModal = ref(false);
const partySearch = ref('');

const filters = reactive({
  btype: 'ALL'
});

const typeOptions = [
  { label: 'All Bills', value: 'ALL' },
  { label: 'Sales Invoices', value: 'SALES' },
  { label: 'Purchase Bills', value: 'PURCHASE' },
  { label: 'Proforma Invoices', value: 'PROFORMA' },
  { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
  { label: 'Credit Notes', value: 'CREDIT_NOTE' },
  { label: 'Debit Notes', value: 'DEBIT_NOTE' }
];

const filteredBills = computed(() => {
  if (!partySearch.value) return bills.value;
  const q = partySearch.value.toLowerCase();
  return bills.value.filter(b => 
    (b.partyName && b.partyName.toLowerCase().includes(q)) || 
    (b.bno && b.bno.toLowerCase().includes(q))
  );
});

function handleFilterChange() {
  const params: any = {};
  if (filters.btype && filters.btype !== 'ALL') {
    params.btype = filters.btype;
  }
  fetchBills(params);
}

function viewBillDetails(id: string) {
  selectedBillId.value = id;
  showDetailsModal.value = true;
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeColor(type: string) {
  switch (type) {
    case 'SALES': return 'primary';
    case 'PURCHASE': return 'success';
    case 'PROFORMA': return 'info';
    case 'CREDIT_NOTE': return 'warning';
    case 'DEBIT_NOTE': return 'error';
    default: return 'neutral';
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case 'ACTIVE': return 'success';
    case 'CANCELLED': return 'error';
    case 'DRAFT': return 'warning';
    default: return 'neutral';
  }
}

async function downloadBillPdf(bill: any) {
  try {
    const res = await api.get(`/accounting/bills/${bill._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bill_${bill.bno || bill._id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download error:', err);
  }
}

async function exportExcel() {
  try {
    const params: any = {};
    if (filters.btype !== 'ALL') params.btype = filters.btype;
    const res = await api.get('/accounting/bills/export', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inventory_Bills_${new Date().toISOString().split('T')[0]}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Excel export error:', err);
  }
}

async function exportPDF() {
  try {
    const params: any = {};
    if (filters.btype !== 'ALL') params.btype = filters.btype;
    const res = await api.get('/accounting/bills/export/pdf', { params, responseType: 'blob' });
    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Inventory_Bills_Report.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF export error:', err);
  }
}

onMounted(() => {
  fetchBills();
});
</script>
