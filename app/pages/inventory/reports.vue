<template>
  <div class="p-6 w-full mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white">Inventory Reports</h1>
      <p class="text-gray-600 dark:text-zinc-400 mt-1">Detailed analysis of stock and consumption</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <!-- Stock Valuation Report -->
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer group" @click="generateReport('valuation')">
        <div class="w-12 h-12 bg-blue-50 dark:bg-blue-950 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 class="font-bold text-gray-900 dark:text-white text-lg">Stock Valuation</h3>
        <p class="text-sm text-gray-500 dark:text-zinc-400 mt-2">Comprehensive list of all items with their current quantity and WAC-based value.</p>
        <div class="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-bold">
          View Report
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <!-- Item Movement Analysis -->
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer group" @click="generateReport('movement')">
        <div class="w-12 h-12 bg-emerald-50 dark:bg-emerald-950 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </div>
        <h3 class="font-bold text-gray-900 dark:text-white text-lg">Movement History</h3>
        <p class="text-sm text-gray-500 dark:text-zinc-400 mt-2">Audit trail of every transaction for a specific date range or item category.</p>
        <div class="mt-4 flex items-center text-emerald-600 dark:text-emerald-400 text-sm font-bold">
          View Report
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <!-- Sales Analysis -->
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer group" @click="generateReport('consumption')">
        <div class="w-12 h-12 bg-purple-50 dark:bg-purple-950 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 mb-4 group-hover:bg-purple-600 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        </div>
        <h3 class="font-bold text-gray-900 dark:text-white text-lg">Sales Analysis</h3>
        <p class="text-sm text-gray-500 dark:text-zinc-400 mt-2">Analyze which items are moving fast and their contribution to total revenue.</p>
        <div class="mt-4 flex items-center text-purple-600 dark:text-purple-400 text-sm font-bold">
          View Report
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>

      <!-- Sales & Purchase Bills Report -->
      <div class="bg-white dark:bg-zinc-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-shadow cursor-pointer group" @click="$router.push('/inventory/bills')">
        <div class="w-12 h-12 bg-teal-50 dark:bg-teal-950 rounded-xl flex items-center justify-center text-teal-600 dark:text-teal-400 mb-4 group-hover:bg-teal-600 group-hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 class="font-bold text-gray-900 dark:text-white text-lg">Sales & Purchase Bills</h3>
        <p class="text-sm text-gray-500 dark:text-zinc-400 mt-2">View, search, and export all stock-related sales invoices and purchase bills.</p>
        <div class="mt-4 flex items-center text-teal-600 dark:text-teal-400 text-sm font-bold">
          View Bills Page
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>

    <StockValuationModal v-if="showValuation" v-model="showValuation" />
    <SalesAnalysisModal v-if="showSalesAnalysis" v-model="showSalesAnalysis" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import StockValuationModal from '@/components/inventory/StockValuationModal.vue';
import SalesAnalysisModal from '@/components/inventory/SalesAnalysisModal.vue';

const router = useRouter();
const showValuation = ref(false);
const showSalesAnalysis = ref(false);

function generateReport(type: string) {
  if (type === 'movement') {
    router.push('/inventory/movement');
  } else if (type === 'valuation') {
    showValuation.value = true;
  } else if (type === 'consumption') {
    showSalesAnalysis.value = true;
  }
}
</script>
