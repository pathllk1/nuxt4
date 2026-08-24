<script setup lang="ts">
import { computed } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import { WorkTrackerExcelExporter } from '~/utils/work-tracker-excel';

const state = useWorkTracker();

const filteredPayments = computed(() => {
  return state.payments.value.filter(p => {
    if (state.paymentFilters.clientId && p.clientId !== Number(state.paymentFilters.clientId)) return false;
    if (state.paymentFilters.paymentType && p.paymentType !== state.paymentFilters.paymentType) return false;
    if (state.paymentFilters.method && p.method !== state.paymentFilters.method) return false;
    if (state.paymentFilters.dateFrom && p.date < state.paymentFilters.dateFrom) return false;
    if (state.paymentFilters.dateTo && p.date > state.paymentFilters.dateTo) return false;
    if (state.paymentFilters.search) {
      const q = state.paymentFilters.search.toLowerCase();
      const matchClient = (p.clientName || '').toLowerCase().includes(q);
      const matchRef = (p.reference || '').toLowerCase().includes(q);
      const matchDesc = (p.workDescription || '').toLowerCase().includes(q);
      if (!matchClient && !matchRef && !matchDesc) return false;
    }
    return true;
  });
});

const exportExcel = () => {
  WorkTrackerExcelExporter.exportPayments(filteredPayments.value);
};
</script>

<template>
  <div class="space-y-2.5 font-sans text-xs">
    <!-- Toolbar -->
    <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        <input
          v-model="state.paymentFilters.search"
          type="text"
          placeholder="Search payments, ref..."
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none w-44"
        />

        <select v-model="state.paymentFilters.clientId" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Clients</option>
          <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <select v-model="state.paymentFilters.method" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Methods</option>
          <option v-for="m in state.getPaymentMethodsList()" :key="m" :value="m">{{ m }}</option>
        </select>

        <select v-model="state.paymentFilters.paymentType" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Payment Types</option>
          <option v-for="t in state.getPaymentTypesList()" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5">
        <button
          @click="state.openBulkSettlementModal()"
          class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
        >
          ⚡ Bulk Settle
        </button>
        <button
          @click="exportExcel"
          class="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition cursor-pointer"
        >
          📥 Excel
        </button>
        <button
          @click="state.openAddPaymentModal()"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
        >
          ➕ Record Payment
        </button>
      </div>
    </div>

    <!-- Payments Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-gray-50 border-b border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th class="p-2.5 w-24">Date</th>
              <th class="p-2.5 w-36">Client</th>
              <th class="p-2.5">Linked Contract / Description</th>
              <th class="p-2.5 w-32">Method / Ref</th>
              <th class="p-2.5 w-28">Type</th>
              <th class="p-2.5 text-right w-28">Received ₹</th>
              <th class="p-2.5 text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-bold">
            <tr v-for="p in filteredPayments" :key="p.id" class="hover:bg-gray-50/80 transition">
              <td class="p-2.5 font-mono text-gray-500">{{ p.date }}</td>
              <td class="p-2.5 text-gray-900 font-black">{{ p.clientName }}</td>
              <td class="p-2.5 text-gray-700">
                {{ p.workType }}
                <span v-if="p.workDescription" class="text-[10px] text-gray-400 block font-normal">{{ p.workDescription }}</span>
              </td>
              <td class="p-2.5">
                <span class="text-gray-800 block">{{ p.method }}</span>
                <span v-if="p.reference" class="text-[9px] font-mono text-gray-400 block">Ref: {{ p.reference }}</span>
              </td>
              <td class="p-2.5">
                <span class="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200">
                  {{ p.paymentType }}
                </span>
              </td>
              <td class="p-2.5 text-right font-mono text-emerald-600 font-black">
                ₹{{ (p.amount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="p-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="state.openEditPaymentModal(p)" class="p-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border-0 cursor-pointer">
                    ✏️
                  </button>
                  <button @click="state.deletePayment(p.id)" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredPayments.length === 0">
              <td colspan="7" class="text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
                No Payments Recorded
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
