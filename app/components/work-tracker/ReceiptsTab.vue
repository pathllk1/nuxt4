<script setup lang="ts">
import { computed } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import { WorkTrackerExcelExporter } from '~/utils/work-tracker-excel';

const state = useWorkTracker();

const filteredReceipts = computed(() => {
  return state.combinedReceipts.value.filter(r => {
    if (state.receiptFilters.walletId && r.walletId !== Number(state.receiptFilters.walletId)) return false;
    if (state.receiptFilters.category && r.category !== state.receiptFilters.category) return false;
    if (state.receiptFilters.dateFrom && r.date < state.receiptFilters.dateFrom) return false;
    if (state.receiptFilters.dateTo && r.date > state.receiptFilters.dateTo) return false;
    if (state.receiptFilters.search) {
      const q = state.receiptFilters.search.toLowerCase();
      const matchPayer = (r.receivedFrom || '').toLowerCase().includes(q);
      const matchNotes = (r.notes || '').toLowerCase().includes(q);
      const matchRef = (r.reference || '').toLowerCase().includes(q);
      if (!matchPayer && !matchNotes && !matchRef) return false;
    }
    return true;
  });
});

const exportExcel = () => {
  WorkTrackerExcelExporter.exportReceipts(filteredReceipts.value, id => state.getWalletName(id));
};
</script>

<template>
  <div class="space-y-2.5 font-sans text-xs">
    <!-- Toolbar -->
    <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        <input
          v-model="state.receiptFilters.search"
          type="text"
          placeholder="Search payer/reference..."
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none w-44"
        />

        <select v-model="state.receiptFilters.walletId" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Vaults</option>
          <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>
      </div>

      <div class="flex items-center gap-1.5">
        <button @click="exportExcel" class="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold border border-gray-200 transition cursor-pointer">
          📥 Excel
        </button>
        <button
          @click="state.openAddReceiptModal()"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
        >
          ➕ New Receipt
        </button>
      </div>
    </div>

    <!-- Receipts Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-gray-50 border-b border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th class="p-2.5 w-24">Date</th>
              <th class="p-2.5 w-36">Category</th>
              <th class="p-2.5 w-36">Payer</th>
              <th class="p-2.5 w-32">Vault</th>
              <th class="p-2.5">Ref / Memo</th>
              <th class="p-2.5 text-right w-28">Amount In ₹</th>
              <th class="p-2.5 text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-bold">
            <tr v-for="r in filteredReceipts" :key="r.id" class="hover:bg-gray-50/80 transition">
              <td class="p-2.5 font-mono text-gray-500">{{ r.date }}</td>
              <td class="p-2.5">
                <span
                  class="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider"
                  :class="r.isClientPayment ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'"
                >
                  {{ r.category }}
                </span>
              </td>
              <td class="p-2.5 text-gray-900 font-bold">{{ r.receivedFrom || '—' }}</td>
              <td class="p-2.5 font-mono text-gray-600">{{ state.getWalletName(r.walletId) }}</td>
              <td class="p-2.5 text-gray-400 font-normal">{{ r.reference || r.notes || '—' }}</td>
              <td class="p-2.5 text-right font-mono text-emerald-600 font-black">
                ₹{{ (r.amount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="p-2.5 text-right">
                <div v-if="!r.isClientPayment" class="flex items-center justify-end gap-1">
                  <button @click="state.openEditReceiptModal(r)" class="p-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border-0 cursor-pointer">
                    ✏️
                  </button>
                  <button @click="state.deleteReceipt(r.id)" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer">
                    🗑️
                  </button>
                </div>
                <span v-else class="text-[8px] text-gray-400 font-mono italic">Client Tx</span>
              </td>
            </tr>
            <tr v-if="filteredReceipts.length === 0">
              <td colspan="7" class="text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
                No Direct Receipts Logged
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
