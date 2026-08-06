<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-zinc-800">
      <!-- Header -->
      <div class="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-850/80">
        <div class="flex items-center gap-5">
           <div class="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 ring-4 ring-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
           </div>
           <div>
              <h2 class="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Stock Valuation Report</h2>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Inventory Asset Assessment (WAC Based)</p>
           </div>
        </div>
        <div class="flex items-center gap-3">
           <button @click="exportToExcel" class="px-6 py-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-600 hover:text-white transition-all">
              Export Excel
           </button>
           <button @click="$emit('update:modelValue', false)" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 transition-all shadow-sm group">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>
      </div>

      <!-- Summary Cards -->
      <div v-if="reportData" class="grid grid-cols-1 md:grid-cols-3 gap-6 p-8 bg-slate-50/50 dark:bg-zinc-850/50">
         <div class="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total SKU Items</p>
            <p class="text-3xl font-black text-slate-900 dark:text-white">{{ reportData.summary.totalItems }}</p>
         </div>
         <div class="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Stock Quantity</p>
            <p class="text-3xl font-black text-blue-600 dark:text-blue-400">{{ (reportData.summary.totalQty || 0).toLocaleString() }}</p>
         </div>
         <div class="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm ring-4 ring-indigo-50 dark:ring-indigo-950">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Valuation (WAC)</p>
            <p class="text-3xl font-black text-emerald-600 dark:text-emerald-400">₹{{ (reportData.summary.totalValue || 0).toLocaleString() }}</p>
         </div>
      </div>

      <!-- Table -->
      <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
         <div v-if="loading" class="flex flex-col items-center justify-center py-20">
            <div class="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Compiling Assets...</p>
         </div>
         
         <div v-else-if="reportData && reportData.items.length > 0" class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
            <table class="w-full text-left">
               <thead>
                  <tr class="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-700">
                     <th class="px-6 py-4">Item Details</th>
                     <th class="px-6 py-4">Part No / OEM</th>
                     <th class="px-6 py-4 text-right">Quantity</th>
                     <th class="px-6 py-4 text-right">WAC Rate</th>
                     <th class="px-6 py-4 text-right">Total Value</th>
                     <th class="px-6 py-4 text-center">Batches</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-50 dark:divide-zinc-800 font-bold text-xs">
                  <tr v-for="item in reportData.items" :key="item.item" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                     <td class="px-6 py-4">
                        <div class="text-slate-900 dark:text-white font-black">{{ item.item }}</div>
                        <div class="text-[10px] text-slate-400 uppercase tracking-wider">HSN: {{ item.hsn }}</div>
                     </td>
                     <td class="px-6 py-4">
                        <div class="text-slate-700 dark:text-zinc-300">{{ item.pno || '-' }}</div>
                        <div class="text-[10px] text-slate-400 uppercase">{{ item.oem || '-' }}</div>
                     </td>
                     <td class="px-6 py-4 text-right">
                        <span class="text-slate-900 dark:text-white">{{ (item.qty || 0).toLocaleString() }}</span>
                        <span class="text-[9px] text-slate-400 ml-1 uppercase">{{ item.uom }}</span>
                     </td>
                     <td class="px-6 py-4 text-right text-slate-600 dark:text-zinc-400">₹{{ (item.rate || 0).toFixed(2) }}</td>
                     <td class="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 font-black">₹{{ (item.totalValue || 0).toLocaleString() }}</td>
                     <td class="px-6 py-4 text-center">
                        <span class="px-2 py-0.5 bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 rounded text-[10px]">{{ item.batches }}</span>
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>

         <div v-else class="flex flex-col items-center justify-center py-32 bg-slate-50/50 dark:bg-zinc-900/50 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
            <div class="w-20 h-20 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-200 dark:text-zinc-600 mb-4 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
            </div>
            <p class="text-sm font-black text-slate-400 uppercase tracking-widest">No Inventory Data Available</p>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useInventory } from '@/composables/useInventory';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const { fetchStockValuation } = useInventory();
const reportData = ref<any>(null);
const loading = ref(true);

watch(() => props.modelValue, async (val) => {
  if (val) {
    loading.value = true;
    try {
      const res = await fetchStockValuation();
      if (res.success) {
        reportData.value = res.data;
      }
    } catch (err) {
      console.error(err);
    } finally {
      loading.value = false;
    }
  }
}, { immediate: true });

function exportToExcel() {
  if (!reportData.value) return;
  alert('Report download initiated');
}
</script>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
</style>
