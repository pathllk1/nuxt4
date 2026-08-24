<script setup lang="ts">
import { computed } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';

const state = useWorkTracker();

const filteredExpenses = computed(() => {
  return state.expenses.value.filter(e => {
    if (state.expenseFilters.walletId && e.walletId !== Number(state.expenseFilters.walletId)) return false;
    if (state.expenseFilters.categoryId && e.categoryId !== state.expenseFilters.categoryId) return false;
    if (state.expenseFilters.dateFrom && e.date < state.expenseFilters.dateFrom) return false;
    if (state.expenseFilters.dateTo && e.date > state.expenseFilters.dateTo) return false;
    if (state.expenseFilters.search) {
      const q = state.expenseFilters.search.toLowerCase();
      const matchDesc = (e.description || '').toLowerCase().includes(q);
      const matchPayee = (e.paidTo || '').toLowerCase().includes(q);
      const matchNotes = (e.notes || '').toLowerCase().includes(q);
      if (!matchDesc && !matchPayee && !matchNotes) return false;
    }
    return true;
  });
});
</script>

<template>
  <div class="space-y-2.5 font-sans text-xs">
    <!-- Toolbar -->
    <div class="bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
        <input
          v-model="state.expenseFilters.search"
          type="text"
          placeholder="Search description/payee..."
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none w-44"
        />

        <select v-model="state.expenseFilters.walletId" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Vaults</option>
          <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
        </select>

        <select v-model="state.expenseFilters.categoryId" class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none">
          <option value="">All Categories</option>
          <option v-for="c in state.customExpenseCategories.value" :key="c.id" :value="c.id">{{ c.icon }} {{ c.name }}</option>
        </select>
      </div>

      <button
        @click="state.openAddExpenseModal()"
        class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
      >
        ➕ Record Expense
      </button>
    </div>

    <!-- Expenses Table -->
    <div class="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
      <div class="overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-gray-50 border-b border-gray-200 text-[9px] font-black uppercase tracking-wider text-gray-500">
            <tr>
              <th class="p-2.5 w-24">Date</th>
              <th class="p-2.5 w-40">Category</th>
              <th class="p-2.5 w-36">Payee / Vendor</th>
              <th class="p-2.5">Description</th>
              <th class="p-2.5 w-32">Paid From Vault</th>
              <th class="p-2.5 text-right w-28">Amount ₹</th>
              <th class="p-2.5 text-right w-20">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 font-bold">
            <tr v-for="e in filteredExpenses" :key="e.id" class="hover:bg-gray-50/80 transition">
              <td class="p-2.5 font-mono text-gray-500">{{ e.date }}</td>
              <td class="p-2.5">
                <span class="flex items-center gap-1.5 text-gray-800 font-bold">
                  <span>{{ e.categoryIcon }}</span>
                  <span>{{ e.categoryName }}</span>
                </span>
              </td>
              <td class="p-2.5 text-gray-900">{{ e.paidTo || '—' }}</td>
              <td class="p-2.5 text-gray-500 font-normal">
                {{ e.description || e.notes || '—' }}
                <span v-if="e.isRecurring" class="text-[8px] ml-1 px-1 py-0.2 bg-purple-50 text-purple-700 border border-purple-200 rounded font-black uppercase">
                  Recurring ({{ e.recurringInterval || 'monthly' }})
                </span>
              </td>
              <td class="p-2.5 font-mono text-gray-600">{{ e.walletName }}</td>
              <td class="p-2.5 text-right font-mono text-rose-600 font-black">
                ₹{{ (e.amount || 0).toLocaleString('en-IN') }}
              </td>
              <td class="p-2.5 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button @click="state.openEditExpenseModal(e)" class="p-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border-0 cursor-pointer">
                    ✏️
                  </button>
                  <button @click="state.deleteExpense(e.id)" class="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded border border-rose-200 cursor-pointer">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredExpenses.length === 0">
              <td colspan="7" class="text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
                No Expenses Recorded
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
