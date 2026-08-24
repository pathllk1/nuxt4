<script setup lang="ts">
import { computed } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import { WorkTrackerExcelExporter } from '~/utils/work-tracker-excel';

const state = useWorkTracker();

const filteredWorks = computed(() => {
  return state.works.value.filter(w => {
    if (state.workFilters.clientId && w.clientId !== Number(state.workFilters.clientId)) return false;
    if (state.workFilters.workType && w.workType !== state.workFilters.workType) return false;
    if (state.workFilters.status && w.paymentStatusObj?.status !== state.workFilters.status) return false;
    if (state.workFilters.dateFrom && w.dateAssigned < state.workFilters.dateFrom) return false;
    if (state.workFilters.dateTo && w.dateAssigned > state.workFilters.dateTo) return false;
    if (state.workFilters.search) {
      const q = state.workFilters.search.toLowerCase();
      const matchClient = (w.clientName || '').toLowerCase().includes(q);
      const matchType = (w.workType || '').toLowerCase().includes(q);
      const matchDesc = (w.description || '').toLowerCase().includes(q);
      if (!matchClient && !matchType && !matchDesc) return false;
    }
    return true;
  });
});

const exportExcel = () => {
  WorkTrackerExcelExporter.exportWorkLog(filteredWorks.value);
};
</script>

<template>
  <div class="space-y-2.5 font-sans text-xs">
    <!-- Toolbar -->
    <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        <input
          v-model="state.workFilters.search"
          type="text"
          placeholder="Search works, clients..."
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none w-44"
        />

        <select v-model="state.workFilters.clientId" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Clients</option>
          <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>

        <select v-model="state.workFilters.workType" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Work Types</option>
          <option v-for="t in state.getWorkTypesList()" :key="t" :value="t">{{ t }}</option>
        </select>

        <select v-model="state.workFilters.status" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Statuses</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partially Paid</option>
          <option value="paid">Fully Paid</option>
          <option value="amount_tbd">Amount TBD</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5">
        <button @click="exportExcel" class="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition cursor-pointer">
          📥 Excel
        </button>
        <button @click="state.openAddWorkModal()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs">
          ➕ Add Work
        </button>
      </div>
    </div>

    <!-- Works Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-gray-50 border-b border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th class="p-2.5 w-24">Assigned</th>
              <th class="p-2.5 w-36">Client</th>
              <th class="p-2.5">Work Type / Description</th>
              <th class="p-2.5 text-right w-28">Contract ₹</th>
              <th class="p-2.5 text-right w-24">Paid ₹</th>
              <th class="p-2.5 text-right w-24">Pending ₹</th>
              <th class="p-2.5 text-center w-28">Status</th>
              <th class="p-2.5 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-bold">
            <tr v-for="w in filteredWorks" :key="w.id" class="hover:bg-gray-50/80 transition">
              <td class="p-2.5 font-mono text-gray-500 whitespace-nowrap">{{ w.dateAssigned }}</td>
              <td class="p-2.5 text-gray-900 font-black">{{ w.clientName }}</td>
              <td class="p-2.5">
                <span class="text-gray-900 font-bold block">{{ w.workType }}</span>
                <span v-if="w.description" class="text-[10px] text-gray-400 font-normal block">{{ w.description }}</span>
                <span v-if="w.adjustments && w.adjustments.length > 0" class="text-[9px] text-amber-600 font-medium block mt-0.5">
                  🏷️ {{ w.adjustments.length }} adjustment(s) applied
                </span>
              </td>
              <td class="p-2.5 text-right font-mono text-gray-900">
                <template v-if="w.effectiveAmount !== null && w.effectiveAmount !== undefined">
                  ₹{{ w.effectiveAmount.toLocaleString('en-IN') }}
                </template>
                <button v-else @click="state.openSetAmountModal(w.id, w.totalAmount)" class="text-[10px] text-blue-600 hover:underline bg-transparent border-0 cursor-pointer">
                  Set Amount
                </button>
              </td>
              <td class="p-2.5 text-right font-mono text-emerald-600">
                ₹{{ (w.totalPaid || 0).toLocaleString('en-IN') }}
              </td>
              <td class="p-2.5 text-right font-mono" :class="(w.pendingAmount || 0) > 0 ? 'text-amber-600' : 'text-gray-400'">
                ₹{{ (w.pendingAmount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="p-2.5 text-center">
                <span
                  class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                  :class="{
                    'bg-emerald-50 text-emerald-700 border border-emerald-200': w.paymentStatusObj?.status === 'paid',
                    'bg-amber-50 text-amber-700 border border-amber-200': w.paymentStatusObj?.status === 'partial',
                    'bg-rose-50 text-rose-700 border border-rose-200': w.paymentStatusObj?.status === 'unpaid',
                    'bg-gray-100 text-gray-600 border border-gray-200': w.paymentStatusObj?.status === 'amount_tbd'
                  }"
                >
                  {{ w.paymentStatusObj?.label }}
                </span>
              </td>
              <td class="p-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="state.openWorkDetails(w)" title="View Details" class="p-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border-0 cursor-pointer">
                    👁️
                  </button>
                  <button @click="state.openAddPaymentModal(w.clientId, w.id)" title="Record Payment" class="p-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 cursor-pointer">
                    💰
                  </button>
                  <button @click="state.openAddAdjustmentModal(w.id)" title="Discount / Penalty" class="p-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 cursor-pointer">
                    🏷️
                  </button>
                  <button @click="state.openEditWorkModal(w)" title="Edit Work" class="p-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border-0 cursor-pointer">
                    ✏️
                  </button>
                  <button @click="state.deleteWork(w.id)" title="Delete Work" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredWorks.length === 0">
              <td colspan="8" class="text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
                No Work Orders Found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
