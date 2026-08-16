<template>
  <div class="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
    <!-- Header Section (Full-Width View with All Creation Navigation Links) -->
    <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none shrink-0">
          <UIcon name="i-heroicons-document-text" class="w-7 h-7" />
        </div>
        <div>
          <h1 class="text-2xl font-black tracking-tight uppercase text-slate-900 dark:text-white leading-none">Sales & Purchase Bills</h1>
          <p class="text-xs font-semibold text-slate-500 dark:text-zinc-400 mt-1">Unified register for inventory goods & accounting service invoices, purchase bills, and notes</p>
        </div>
      </div>

      <!-- Quick Action Navigation Links -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Goods Sales -->
        <UButton
          color="primary"
          icon="i-heroicons-shopping-cart"
          size="sm"
          label="+ Goods Sale"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/sales/new')"
        />
        <!-- Service Sales -->
        <UButton
          color="info"
          icon="i-heroicons-briefcase"
          size="sm"
          label="+ Service Sale"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/sales/service')"
        />
        <!-- Goods Purchase -->
        <UButton
          color="success"
          variant="soft"
          icon="i-heroicons-cube"
          size="sm"
          label="+ Goods Purchase"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/purchases/new')"
        />
        <!-- Service Purchase -->
        <UButton
          color="error"
          variant="soft"
          icon="i-heroicons-receipt-percent"
          size="sm"
          label="+ Service Purchase"
          class="font-black text-xs h-10 px-3.5 rounded-xl shadow-sm cursor-pointer"
          @click="$router.push('/accounting/purchases/service')"
        />
      </div>
    </div>

    <!-- Filter & Search Bar -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1">
        <!-- Bill Type Select -->
        <div class="w-60">
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
        <div class="flex-1 min-w-[240px] max-w-md">
          <UInput 
            v-model="partySearch" 
            placeholder="Search party, GSTIN or bill no..." 
            icon="i-heroicons-magnifying-glass"
            size="md"
            class="w-full" 
          />
        </div>
      </div>

      <!-- Action Exports -->
      <div class="flex items-center gap-2 shrink-0">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-table-cells"
          label="Export Excel"
          size="sm"
          class="h-9 text-xs font-bold rounded-xl cursor-pointer"
          @click="exportExcel"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-document-arrow-down"
          label="Export PDF"
          size="sm"
          class="h-9 text-xs font-bold rounded-xl cursor-pointer"
          @click="exportPDF"
        />
      </div>
    </div>

    <!-- Full Width Bills Table Card -->
    <UCard class="w-full shadow-sm rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden" :ui="{ body: 'p-0' }">
      <!-- Loader -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4 bg-white dark:bg-zinc-900">
        <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-emerald-600" />
        <p class="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">Fetching bills register...</p>
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
      <div v-else class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-50 dark:bg-zinc-800/80 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-800">
              <th class="px-6 py-4">Bill Info</th>
              <th class="px-6 py-4">Party Name</th>
              <th class="px-6 py-4">Type / Mode</th>
              <th class="px-6 py-4">Status</th>
              <th class="px-6 py-4 text-right">Taxable</th>
              <th class="px-6 py-4 text-right">Total Tax</th>
              <th class="px-6 py-4 text-right">Net Amount</th>
              <th class="px-6 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800/60 font-medium">
            <tr v-for="bill in filteredBills" :key="bill._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
              <!-- Bill Info -->
              <td class="px-6 py-4">
                <div class="font-black text-slate-900 dark:text-white uppercase tracking-tight">{{ bill.bno || 'N/A' }}</div>
                <div class="text-[10px] text-slate-400 font-bold mt-0.5">{{ formatDate(bill.bdate || bill.createdAt) }}</div>
                <div v-if="bill.supplierBillNo" class="text-[9px] font-mono font-semibold text-slate-500 mt-0.5">
                  Ref: {{ bill.supplierBillNo }}
                </div>
              </td>

              <!-- Party Name & GSTIN -->
              <td class="px-6 py-4">
                <div class="font-black text-slate-800 dark:text-zinc-200 uppercase">{{ bill.partyName || 'Cash / General' }}</div>
                <div class="text-[10px] text-slate-400 font-mono" v-if="bill.partyGstin">GSTIN: {{ bill.partyGstin }}</div>
              </td>

              <!-- Type & Invoice Mode -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <UBadge :color="getTypeColor(bill.btype)" variant="soft" size="xs" class="font-black uppercase tracking-wider">
                    {{ bill.btype }}
                  </UBadge>
                  <UBadge 
                    v-if="bill.invoiceMode === 'ACCOUNTING' || bill.billSubtype === 'SERVICE'" 
                    color="info" 
                    variant="subtle" 
                    size="xs" 
                    class="text-[9px] font-bold uppercase"
                  >
                    Service
                  </UBadge>
                  <UBadge 
                    v-else 
                    color="neutral" 
                    variant="subtle" 
                    size="xs" 
                    class="text-[9px] font-bold uppercase"
                  >
                    Goods
                  </UBadge>
                </div>
              </td>

              <!-- Status -->
              <td class="px-6 py-4">
                <UBadge :color="getStatusColor(bill.status)" variant="subtle" size="xs" class="font-bold uppercase">
                  {{ bill.status || 'ACTIVE' }}
                </UBadge>
              </td>

              <!-- Taxable Amount -->
              <td class="px-6 py-4 text-right font-bold text-slate-700 dark:text-zinc-300 font-mono">
                ₹{{ (bill.grossTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Total Tax Amount (Accurately Computed) -->
              <td class="px-6 py-4 text-right font-mono font-bold" :class="getBillTax(bill) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'">
                ₹{{ getBillTax(bill).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Net Amount -->
              <td class="px-6 py-4 text-right font-black text-indigo-600 dark:text-indigo-400 font-mono text-sm">
                ₹{{ (bill.netTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Actions -->
              <td class="px-6 py-4">
                <div class="flex items-center justify-center gap-1">
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="neutral" 
                    icon="i-heroicons-eye" 
                    title="View Details"
                    class="cursor-pointer"
                    @click="viewBillDetails(bill._id)" 
                  />
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="indigo" 
                    icon="i-heroicons-printer" 
                    title="Print with Custom Config (Alt+P)"
                    class="cursor-pointer"
                    @click="openPrintConfig(bill)" 
                  />
                  <UButton 
                    size="xs" 
                    variant="ghost" 
                    color="primary" 
                    icon="i-heroicons-document" 
                    title="Quick Download PDF"
                    class="cursor-pointer"
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

    <PrintConfigModal
      v-model="showPrintModal"
      :bill="selectedBillForPrint"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue';
import { useBilling } from '@/composables/useBilling';
import { api } from '@/utils/api';
import BillDetailsModal from '@/components/accounting/BillDetailsModal.vue';
import PrintConfigModal from '@/components/accounting/PrintConfigModal.vue';

const { bills, fetchBills, loading } = useBilling();

const selectedBillId = ref<string | null>(null);
const showDetailsModal = ref(false);
const selectedBillForPrint = ref<any>(null);
const showPrintModal = ref(false);
const partySearch = ref('');

const filters = reactive({
  btype: 'ALL'
});

const typeOptions = [
  { label: 'All Bills & Invoices', value: 'ALL' },
  { label: 'Goods Sales Invoices', value: 'SALES_GOODS' },
  { label: 'Service Sales Invoices', value: 'SALES_SERVICE' },
  { label: 'Goods Purchase Bills', value: 'PURCHASE_GOODS' },
  { label: 'Service Purchase Bills', value: 'PURCHASE_SERVICE' },
  { label: 'Proforma Invoices', value: 'PROFORMA' },
  { label: 'Delivery Challans', value: 'DELIVERY_NOTE' },
  { label: 'Credit Notes', value: 'CREDIT_NOTE' },
  { label: 'Debit Notes', value: 'DEBIT_NOTE' }
];

const filteredBills = computed(() => {
  if (!partySearch.value) return bills.value;
  const q = partySearch.value.toLowerCase().trim();
  return bills.value.filter(b => 
    (b.partyName && b.partyName.toLowerCase().includes(q)) || 
    (b.partyGstin && b.partyGstin.toLowerCase().includes(q)) || 
    (b.bno && b.bno.toLowerCase().includes(q)) ||
    (b.supplierBillNo && b.supplierBillNo.toLowerCase().includes(q))
  );
});

function getBillTax(bill: any): number {
  if (bill.totalTax !== undefined && bill.totalTax !== null && !isNaN(Number(bill.totalTax))) {
    return Number(bill.totalTax);
  }
  const cgst = parseFloat(bill.cgst) || 0;
  const sgst = parseFloat(bill.sgst) || 0;
  const igst = parseFloat(bill.igst) || 0;
  return parseFloat((cgst + sgst + igst).toFixed(2));
}

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

function openPrintConfig(bill: any) {
  selectedBillForPrint.value = bill;
  showPrintModal.value = true;
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.altKey && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    if (filteredBills.value.length > 0) {
      openPrintConfig(filteredBills.value[0]);
    }
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
    link.download = `Bills_Register_${new Date().toISOString().split('T')[0]}.xlsx`;
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
    link.download = `Bills_Register_Report.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF export error:', err);
  }
}

onMounted(() => {
  fetchBills();
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
