<script setup lang="ts">
import { useWorkTracker } from '~/composables/useWorkTracker';
import type { Budget } from '~/types/work-tracker';

const state = useWorkTracker();

const getProgress = (budget: Budget) => {
  const spent = state.expenses.value
    .filter(e => e.categoryId === budget.categoryId && (e.date || '').startsWith(budget.month))
    .reduce((s, e) => s + Number(e.amount || 0), 0);
  const limit = Number(budget.limitAmount) || 1;
  const pct = Math.min(100, Math.round((spent / limit) * 100));
  return {
    spent,
    limit,
    pct,
    remaining: Math.max(0, limit - spent),
    isOver: spent > limit
  };
};
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- Toolbar -->
    <div class="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
      <div>
        <h2 class="text-xs font-black uppercase tracking-tight text-gray-800">Expense Budgets</h2>
        <p class="text-[9px] text-gray-400 font-bold">Category spending limits and variance tracking</p>
      </div>
      <button
        @click="state.openBudgetModal()"
        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
      >
        ➕ Set Budget
      </button>
    </div>

    <!-- Budgets Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="b in state.budgets.value"
        :key="b.id"
        class="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
      >
        <div>
          <div class="flex items-center justify-between mb-2 pb-1 border-b border-gray-100">
            <span class="flex items-center gap-1.5 text-xs font-black text-gray-900">
              <span>{{ state.getExpenseCategoryById(b.categoryId).icon }}</span>
              <span>{{ state.getExpenseCategoryById(b.categoryId).name }}</span>
            </span>
            <span class="text-[9px] font-mono text-gray-500 font-bold">{{ b.month }}</span>
          </div>

          <div class="flex items-baseline justify-between mt-2 mb-1 font-mono">
            <span class="text-xs font-black text-gray-900">₹{{ getProgress(b).spent.toLocaleString('en-IN') }}</span>
            <span class="text-xs text-gray-500">Limit: ₹{{ getProgress(b).limit.toLocaleString('en-IN') }}</span>
          </div>

          <div class="w-full bg-gray-100 rounded-full h-2 overflow-hidden border border-gray-200">
            <div
              class="h-2 rounded-full transition-all duration-300"
              :class="getProgress(b).isOver ? 'bg-rose-500' : 'bg-emerald-500'"
              :style="{ width: `${getProgress(b).pct}%` }"
            ></div>
          </div>
        </div>

        <div class="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
          <span :class="getProgress(b).isOver ? 'text-rose-600 font-black' : 'text-gray-500 font-bold'">
            {{ getProgress(b).isOver ? '⚠️ Over Limit!' : 'Remaining: ₹' + getProgress(b).remaining.toLocaleString('en-IN') }}
          </span>
          <button
            @click="state.deleteBudget(b.id)"
            class="text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs"
          >
            🗑️
          </button>
        </div>
      </div>

      <div v-if="state.budgets.value.length === 0" class="col-span-full text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
        No Budgets Configured
      </div>
    </div>
  </div>
</template>
