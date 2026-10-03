<template>
  <div class="space-y-5">
    
    <!-- Top Bar: Title & Primary Actions -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700">
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/subcontractor/wallet"
          class="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center justify-center no-underline"
          title="Back to Wallet"
        >
          ←
        </NuxtLink>
        <div>
          <h1 class="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>📋 My Site Slips</span>
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            Contractor site ledger (Zero impact on Core Books / GL)
          </p>
        </div>
      </div>

      <NuxtLink
        to="/subcontractor/expense"
        class="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-md transition no-underline cursor-pointer"
      >
        <span>➕ Record New Slip</span>
      </NuxtLink>
    </div>

    <!-- Search & Filter Controls -->
    <div class="bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-700 space-y-3">
      <!-- Search Input -->
      <div class="relative">
        <input
          v-model="searchQuery"
          @input="handleSearch"
          type="text"
          placeholder="Search by vendor, notes, slip ref #..."
          class="w-full pl-10 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 transition"
        />
        <span class="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
        <button
          v-if="searchQuery"
          @click="searchQuery = ''; handleSearch()"
          class="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      <!-- Horizontally Scrollable Category Pills -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          v-for="cat in FILTER_CATEGORIES"
          :key="cat.key"
          type="button"
          @click="setCategory(cat.key)"
          class="px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition cursor-pointer shrink-0 text-xs"
          :class="selectedCategory === cat.key ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'"
        >
          {{ cat.icon }} {{ cat.label }}
        </button>
      </div>
    </div>

    <!-- Filtered Total Banner -->
    <div class="flex items-center justify-between p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900 text-xs sm:text-sm">
      <div class="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-semibold">
        <span>Filtered Total:</span>
        <span class="px-2 py-0.5 rounded-full bg-indigo-200/60 dark:bg-indigo-800 text-indigo-950 dark:text-indigo-100 text-xs font-mono font-bold">
          {{ filteredExpenses.length }} slips
        </span>
      </div>
      <span class="font-black font-mono text-base sm:text-lg text-indigo-700 dark:text-indigo-300">
        ₹{{ formatCurrency(filteredTotal) }}
      </span>
    </div>

    <!-- Slips Grid: 1 col on mobile, 2 cols on tablet, 3 cols on large screens -->
    <div v-if="isLoading" class="text-center py-16 text-slate-400 text-xs sm:text-sm">
      Loading site slips...
    </div>

    <div v-else-if="filteredExpenses.length === 0" class="text-center py-16 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700 p-8">
      <span class="text-4xl block mb-2">🧾</span>
      <p class="text-sm font-bold text-slate-700 dark:text-slate-200">No site slips found</p>
      <p class="text-xs text-slate-400 mt-1">Try selecting a different filter or tap "+ Record New Slip" to add one.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="slip in filteredExpenses"
        :key="slip._id"
        class="p-4 sm:p-5 rounded-3xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200/80 dark:border-slate-700 flex flex-col justify-between hover:shadow-md transition"
      >
        <div>
          <!-- Card Header: Category & Date -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span class="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200">
              {{ getCategoryIcon(slip.category) }} {{ getCategoryLabel(slip.category) }}
            </span>
            <span class="text-xs text-slate-400 font-mono">
              {{ slip.expenseDate }}
            </span>
          </div>

          <!-- Vendor / Title -->
          <h3 class="font-bold text-slate-900 dark:text-white text-sm sm:text-base mt-1 line-clamp-1">
            {{ slip.vendorOrPayee || 'Site Slip' }}
          </h3>

          <!-- Notes -->
          <p v-if="slip.notes" class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {{ slip.notes }}
          </p>

          <!-- Slip Ref & Payment Mode Tags -->
          <div class="flex items-center gap-2 mt-3 flex-wrap text-[11px]">
            <span v-if="slip.billOrSlipRef" class="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono font-bold">
              Slip #{{ slip.billOrSlipRef }}
            </span>
            <span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-700/40 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px]">
              {{ slip.paymentMode }}
            </span>
          </div>
        </div>

        <!-- Card Footer: Amount & Actions -->
        <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
          <span class="text-lg sm:text-xl font-black font-mono text-slate-900 dark:text-white">
            ₹{{ formatCurrency(slip.amount) }}
          </span>

          <div class="flex items-center gap-1.5">
            <NuxtLink
              :to="`/subcontractor/expense?id=${slip._id}`"
              class="p-2 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition"
              title="Edit slip"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </NuxtLink>

            <button
              @click="handleDelete(slip._id!)"
              class="p-2 rounded-xl text-slate-600 hover:text-red-600 hover:bg-red-50 dark:text-slate-300 dark:hover:bg-red-950/40 transition cursor-pointer"
              title="Delete slip"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSubcontractorWallet } from '../../composables/useSubcontractorWallet';

definePageMeta({
  layout: 'subcontractor'
});

const { expensesList, isLoading, fetchExpenses, deleteSlip } = useSubcontractorWallet();

const searchQuery = ref('');
const selectedCategory = ref('ALL');

const FILTER_CATEGORIES = [
  { key: 'ALL', label: 'All Slips', icon: '📋' },
  { key: 'LABOR', label: 'Labor', icon: '👷' },
  { key: 'FUEL_DIESEL', label: 'Fuel', icon: '⛽' },
  { key: 'MATERIAL', label: 'Material', icon: '🧱' },
  { key: 'MACHINERY_RENTAL', label: 'Machinery', icon: '🚜' },
  { key: 'TRANSPORT', label: 'Transport', icon: '🚚' },
  { key: 'FOOD_WELFARE', label: 'Food', icon: '☕' },
  { key: 'REPAIRS', label: 'Repairs', icon: '🔧' },
  { key: 'OTHER', label: 'Other', icon: '📦' }
];

const CATEGORY_MAP: Record<string, { label: string; icon: string }> = {
  LABOR: { label: 'Labor', icon: '👷' },
  MATERIAL: { label: 'Material', icon: '🧱' },
  FUEL_DIESEL: { label: 'Fuel/Diesel', icon: '⛽' },
  MACHINERY_RENTAL: { label: 'Machinery', icon: '🚜' },
  TRANSPORT: { label: 'Transport', icon: '🚚' },
  FOOD_WELFARE: { label: 'Food/Tea', icon: '☕' },
  REPAIRS: { label: 'Repairs', icon: '🔧' },
  OTHER: { label: 'Other', icon: '📦' }
};

const getCategoryLabel = (cat: string) => CATEGORY_MAP[cat]?.label || cat;
const getCategoryIcon = (cat: string) => CATEGORY_MAP[cat]?.icon || '📦';

const formatCurrency = (val: number) => {
  return Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const setCategory = (cat: string) => {
  selectedCategory.value = cat;
  loadSlips();
};

const handleSearch = () => {
  loadSlips();
};

const loadSlips = async () => {
  const params: Record<string, any> = {};
  if (selectedCategory.value !== 'ALL') params.category = selectedCategory.value;
  if (searchQuery.value) params.search = searchQuery.value;
  await fetchExpenses(params);
};

const filteredExpenses = computed(() => expensesList.value || []);

const filteredTotal = computed(() => {
  return filteredExpenses.value.reduce((acc, curr: any) => acc + (curr.amount || 0), 0);
});

const handleDelete = async (id: string) => {
  if (confirm('Delete this site slip from your wallet?')) {
    try {
      await deleteSlip(id);
      await loadSlips();
    } catch (e) {
      alert('Failed to delete slip');
    }
  }
};

onMounted(() => {
  loadSlips();
});
</script>
