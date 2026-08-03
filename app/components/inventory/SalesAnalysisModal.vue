<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-zinc-800">
      <!-- Header -->
      <div class="p-8 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-850/80">
        <div class="flex items-center gap-5">
           <div class="w-14 h-14 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-200 ring-4 ring-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
           </div>
           <div>
              <h2 class="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none">Sales Analysis Hub</h2>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">Item-wise Revenue & Volume Contribution</p>
           </div>
        </div>
        <div class="flex items-center gap-3">
           <div class="flex items-center bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-4 py-2 gap-4">
              <div class="flex flex-col">
                 <span class="text-[8px] font-black text-slate-400 uppercase">From Date</span>
                 <input type="date" v-model="filters.startDate" class="text-xs font-bold outline-none bg-transparent text-gray-900 dark:text-white" />
              </div>
              <div class="w-px h-6 bg-slate-100 dark:bg-zinc-700"></div>
              <div class="flex flex-col">
                 <span class="text-[8px] font-black text-slate-400 uppercase">To Date</span>
                 <input type="date" v-model="filters.endDate" class="text-xs font-bold outline-none bg-transparent text-gray-900 dark:text-white" />
              </div>
              <button @click="loadData" class="ml-2 p-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
              </button>
           </div>
           <button @click="$emit('update:modelValue', false)" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 transition-all shadow-sm group">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>
      </div>

      <!-- Table Section -->
      <div class="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar">
         <div v-if="loading" class="flex flex-col items-center justify-center py-20">
            <div class="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin mb-4"></div>
            <p class="text-xs font-black text-slate-400 uppercase tracking-widest">Aggregating Sales Data...</p>
         </div>
         
         <div v-else-if="salesData.length > 0" class="mt-8 bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
            <table class="w-full text-left">
               <thead>
                  <tr class="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest border-b border-slate-100 dark:border-zinc-700">
                     <th class="px-6 py-4">Product Name</th>
                     <th class="px-6 py-4 text-center">Transactions</th>
                     <th class="px-6 py-4 text-right">Sold Quantity</th>
                     <th class="px-6 py-4 text-right">Avg Selling Rate</th>
                     <th class="px-6 py-4 text-right">Total Revenue</th>
                     <th class="px-6 py-4 text-right">Revenue %</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-50 dark:divide-zinc-800 font-bold text-xs">
                  <tr v-for="item in salesData" :key="item._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                     <td class="px-6 py-4">
                        <div class="text-slate-900 dark:text-white font-black uppercase">{{ item.item }}</div>
                        <div class="text-[9px] text-slate-400 uppercase tracking-wider">HSN: {{ item.hsn }}</div>
                     </td>
                     <td class="px-6 py-4 text-center">
                        <span class="px-2 py-0.5 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded text-[10px]">{{ item.count }}</span>
                     </td>
                     <td class="px-6 py-4 text-right">
                        <span class="text-slate-900 dark:text-white">{{ (item.totalQty || 0).toLocaleString() }}</span>
                        <span class="text-[9px] text-slate-400 ml-1 uppercase">{{ item.uom }}</span>
                     </td>
                     <td class="px-6 py-4 text-right text-slate-600 dark:text-zinc-400">₹{{ (item.avgRate || 0).toFixed(2) }}</td>
                     <td class="px-6 py-4 text-right text-indigo-600 dark:text-indigo-400 font-black">₹{{ (item.totalRevenue || 0).toLocaleString() }}</td>
                     <td class="px-6 py-4 text-right">
                        <div class="flex flex-col items-end">
                           <span class="text-[10px] text-slate-900 dark:text-white mb-1">{{ totalRevenue > 0 ? ((item.totalRevenue / totalRevenue) * 100).toFixed(1) : '0.0' }}%</span>
                           <div class="w-20 h-1 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div class="h-full bg-indigo-500" :style="{ width: (totalRevenue > 0 ? ((item.totalRevenue / totalRevenue) * 100) : 0) + '%' }"></div>
                           </div>
                        </div>
                     </td>
                  </tr>
               </tbody>
               <tfoot>
                  <tr class="bg-slate-50/80 dark:bg-zinc-800/80 font-black text-slate-900 dark:text-white border-t-2 border-slate-100 dark:border-zinc-700">
                     <td colspan="4" class="px-6 py-5 text-right uppercase tracking-widest text-[10px]">Grand Total</td>
                     <td class="px-6 py-5 text-right text-lg text-indigo-700 dark:text-indigo-400">₹{{ totalRevenue.toLocaleString() }}</td>
                     <td></td>
                  </tr>
               </tfoot>
            </table>
         </div>

         <div v-else class="flex flex-col items-center justify-center py-32 bg-slate-50/50 dark:bg-zinc-900/50 rounded-3xl mt-8 border border-dashed border-slate-200 dark:border-zinc-800">
            <div class="w-20 h-20 bg-white dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-slate-200 dark:text-zinc-600 mb-4 shadow-sm">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
               </svg>
            </div>
            <p class="text-sm font-black text-slate-400 uppercase tracking-widest">No Sales Found in Selected Range</p>
         </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { useInventory } from '@/composables/useInventory';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue']);

const { fetchSalesAnalysis } = useInventory();
const salesData = ref<any[]>([]);
const loading = ref(true);

const filters = reactive({
  startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
  endDate: new Date().toISOString().split('T')[0]
});

const totalRevenue = computed(() => {
  return salesData.value.reduce((acc, item) => acc + (item.totalRevenue || 0), 0);
});

async function loadData() {
  loading.value = true;
  try {
    const res = await fetchSalesAnalysis(filters);
    if (res.success) {
      salesData.value = res.data;
    }
  } catch (err) {
    console.error(err);
  } finally {
    loading.value = false;
  }
}

watch(() => props.modelValue, (val) => {
  if (val) loadData();
});
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
  background: #f1f5f9;
  border-radius: 10px;
}
</style>
