<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useBilling } from '../../composables/useBilling';
import BillDetailsModal from '../../components/accounting/BillDetailsModal.vue';

useHead({
  title: 'Invoices & Bills Directory - Suite',
});

const { bills, loading, fetchBills, cancelBill } = useBilling();

const activeTab = ref('ALL');
const searchQuery = ref('');
const dateFrom = ref('');
const dateTo = ref('');

const selectedBill = ref<any>(null);
const showDetailsModal = ref(false);

const loadBills = async () => {
  const params: any = {};
  if (activeTab.value !== 'ALL') params.btype = activeTab.value;
  if (searchQuery.value) params.search = searchQuery.value;
  if (dateFrom.value) params.dateFrom = dateFrom.value;
  if (dateTo.value) params.dateTo = dateTo.value;
  await fetchBills(params);
};

const openBill = (bill: any) => {
  selectedBill.value = bill;
  showDetailsModal.value = true;
};

const handleCancel = async (bill: any) => {
  if (confirm(`Are you sure you want to cancel ${bill.bno}?`)) {
    await cancelBill(bill._id, 'Cancelled from bills list');
    await loadBills();
  }
};

watch([activeTab, searchQuery, dateFrom, dateTo], () => {
  loadBills();
});

onMounted(() => {
  loadBills();
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Invoices & Bills Directory</h1>
        <p class="text-xs text-slate-400 mt-1">Manage Sales Invoices, Purchase Bills, Credit Notes, and Delivery Notes</p>
      </div>

      <div class="flex gap-2">
        <NuxtLink to="/accounting/sales/new" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm">
          + New Sale
        </NuxtLink>
        <NuxtLink to="/accounting/purchases/new" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1 shadow-sm">
          + New Purchase
        </NuxtLink>
      </div>
    </header>

    <!-- Filters & Tabs Bar -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold">
          <button v-for="tab in ['ALL', 'SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE']" :key="tab" @click="activeTab = tab" class="px-3 py-1.5 rounded-lg transition-colors" :class="activeTab === tab ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-900'">
            {{ tab === 'ALL' ? 'All Invoices' : tab.replace('_', ' ') }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <input type="text" v-model="searchQuery" placeholder="Search bill no, party..." class="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          <input type="date" v-model="dateFrom" class="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          <input type="date" v-model="dateTo" class="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
        </div>
      </div>
    </div>

    <!-- Bills Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3.5 px-4">Bill No</th>
              <th class="py-3.5 px-4">Date</th>
              <th class="py-3.5 px-4">Party Name</th>
              <th class="py-3.5 px-4">GSTIN</th>
              <th class="py-3.5 px-4">Type</th>
              <th class="py-3.5 px-4 text-right">Taxable Amount</th>
              <th class="py-3.5 px-4 text-right">Net Amount</th>
              <th class="py-3.5 px-4 text-center">Status</th>
              <th class="py-3.5 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-if="bills.length === 0">
              <td colspan="9" class="py-12 text-center text-slate-400 dark:text-zinc-500">
                No invoices found matching the current filters.
              </td>
            </tr>
            <tr v-for="bill in bills" :key="bill._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">#{{ bill.bno }}</td>
              <td class="py-3.5 px-4 font-mono text-slate-500 text-[11px]">{{ bill.bdate }}</td>
              <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{{ bill.partyName }}</td>
              <td class="py-3.5 px-4 font-mono text-[11px] text-slate-500">{{ bill.partyGstin || 'UNREGISTERED' }}</td>
              <td class="py-3.5 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {{ bill.btype }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-right font-mono font-bold">₹{{ (bill.grossTotal || 0).toFixed(2) }}</td>
              <td class="py-3.5 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400 text-sm">
                ₹{{ (bill.netTotal || 0).toLocaleString('en-IN') }}
              </td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase" :class="bill.status === 'CANCELLED' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'">
                  {{ bill.status || 'ACTIVE' }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-center">
                <div class="flex items-center justify-center gap-2">
                  <button @click="openBill(bill)" class="px-2.5 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-300 font-bold rounded-lg text-xs">
                    View
                  </button>
                  <button v-if="bill.status !== 'CANCELLED'" @click="handleCancel(bill)" class="px-2 py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg text-xs font-bold">
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bill Details Modal -->
    <BillDetailsModal v-model="showDetailsModal" :bill="selectedBill" />
  </div>
</template>
