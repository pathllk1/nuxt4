<template>
  <div v-if="modelValue && stock" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-zinc-800">
       <header class="bg-slate-900 px-8 py-8 text-white flex justify-between items-center relative overflow-hidden">
          <div class="absolute -right-10 -top-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl animate-pulse"></div>
          
          <div class="flex items-center gap-6 relative z-10">
             <div class="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-xl border border-white/20 shadow-2xl">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <div>
                <h2 class="text-3xl font-black uppercase tracking-tighter leading-none">{{ stock.item }}</h2>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">Transaction Lifecycle & Audit Intelligence</p>
             </div>
          </div>
          <button @click="$emit('update:modelValue', false)" class="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/10 hover:bg-red-500 text-white transition-all backdrop-blur-md border border-white/10 group relative z-10">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
          <div v-if="loading" class="flex flex-col items-center justify-center py-32">
             <div class="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-6 shadow-xl"></div>
             <p class="text-slate-400 font-black uppercase text-[10px] tracking-[0.3em] animate-pulse">Syncing Audit Trail...</p>
          </div>
          
          <div v-else-if="history.length > 0" class="space-y-4">
             <div v-for="m in history" :key="m._id" class="bg-white dark:bg-zinc-850 rounded-3xl p-5 shadow-sm border border-slate-100 dark:border-zinc-800 hover:shadow-xl transition-all group flex items-center gap-6 relative overflow-hidden">
                <div :class="getTypeColor(m.type)" class="absolute left-0 top-0 bottom-0 w-1.5 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                
                <div class="w-24 shrink-0">
                   <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Entry Date</p>
                   <p class="text-xs font-bold text-slate-700 dark:text-zinc-300">{{ formatDate(m.createdAt) }}</p>
                </div>

                <div class="w-32 shrink-0">
                   <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Movement</p>
                   <span :class="getTypeClass(m.type)" class="px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide border shadow-sm inline-block">
                      {{ m.type }}
                   </span>
                </div>

                <div class="flex-1 min-w-0">
                   <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Reference Context</p>
                   <div class="flex items-center gap-2">
                      <p class="text-sm font-black text-slate-900 dark:text-white truncate">{{ m.bno || 'MANUAL ADJ' }}</p>
                      <span class="text-[10px] font-bold text-slate-300">|</span>
                      <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase truncate">{{ m.supply || 'INTERNAL SYSTEM' }}</p>
                      <span v-if="m.batch" class="text-[10px] font-bold text-slate-300">|</span>
                      <span v-if="m.batch" class="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded text-[9px] font-black uppercase tracking-wide border border-blue-100 dark:border-blue-900">Batch {{ m.batch }}</span>
                   </div>
                </div>

                <div class="w-28 text-right shrink-0">
                   <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delta</p>
                   <p :class="m.qty > 0 ? 'text-emerald-600' : 'text-rose-600'" class="text-base font-black tabular-nums">
                      {{ m.qty > 0 ? '+' : '' }}{{ (m.qty || 0).toLocaleString() }}
                   </p>
                </div>

                <div class="w-32 text-right shrink-0 bg-slate-50 dark:bg-zinc-800 rounded-2xl p-3 border border-slate-100 dark:border-zinc-700 group-hover:bg-blue-50 dark:group-hover:bg-zinc-750 transition-colors">
                   <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Inventory Bal</p>
                   <p class="text-sm font-black text-slate-900 dark:text-white tabular-nums">{{ (m.qtyh || 0).toLocaleString() }} <span class="text-[10px] text-slate-400">{{ stock.uom }}</span></p>
                </div>

                <div class="w-28 text-right shrink-0">
                   <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Unit Value</p>
                   <p class="font-mono text-xs font-black text-blue-600 dark:text-blue-400">₹{{ (m.rate || 0).toFixed(2) }}</p>
                </div>
             </div>
          </div>

          <div v-else class="text-center py-32 flex flex-col items-center">
             <div class="w-24 h-24 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-200 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
             </div>
             <h3 class="text-2xl font-black text-slate-300 dark:text-zinc-600 uppercase tracking-tighter italic leading-none">Clean History</h3>
             <p class="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-4">No verified movements found for this SKU</p>
          </div>
       </div>

       <footer class="p-8 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center shadow-lg">
          <div class="flex gap-12">
             <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center text-slate-400 border border-slate-100 dark:border-zinc-700 shadow-inner">
                   <span class="text-xl">📦</span>
                </div>
                <div>
                   <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Current Stock on Hand</p>
                   <p class="text-2xl font-black text-slate-900 dark:text-white leading-none tracking-tighter">{{ (stock.qty || 0).toLocaleString() }} <span class="text-sm text-slate-400">{{ stock.uom }}</span></p>
                </div>
             </div>
             <div class="h-12 w-px bg-slate-100 dark:bg-zinc-800"></div>
             <div>
                <p class="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Asset Valuation (WAC)</p>
                <p class="text-2xl font-black text-blue-700 dark:text-blue-400 leading-none tracking-tighter">₹{{ (stock.total || 0).toLocaleString() }}</p>
             </div>
          </div>
          <button @click="$emit('update:modelValue', false)" class="px-12 py-4 bg-slate-900 text-white rounded-[1.25rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-2xl hover:bg-black transition-all transform active:scale-95">Close Audit Hub</button>
       </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  stock: any;
}>();

const emit = defineEmits(['update:modelValue']);
const api = useApi();

const history = ref<any[]>([]);
const loading = ref(false);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen && (props.stock?.id || props.stock?._id)) {
    loadHistory();
  }
});

async function loadHistory() {
  loading.value = true;
  try {
    const stockId = props.stock.id || props.stock._id;
    const res = await api.get(`/inventory/stock/${stockId}/history`);
    if (res.success) {
      history.value = res.data;
    }
  } catch (err) {
    console.error('Failed to load stock history', err);
  } finally {
    loading.value = false;
  }
}

function formatDate(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeColor(type: string) {
  const map: any = {
    'SALE': 'bg-rose-500',
    'PURCHASE': 'bg-emerald-500',
    'CREDIT_NOTE': 'bg-blue-500',
    'DEBIT_NOTE': 'bg-amber-500',
    'ADJUSTMENT': 'bg-slate-500'
  };
  return map[type] || 'bg-slate-300';
}

function getTypeClass(type: string) {
  const map: any = {
    'SALE': 'bg-rose-50 text-rose-700 border-rose-100',
    'PURCHASE': 'bg-emerald-50 text-emerald-700 border-emerald-100',
    'CREDIT_NOTE': 'bg-blue-50 text-blue-700 border-blue-100',
    'DEBIT_NOTE': 'bg-amber-50 text-amber-700 border-amber-100',
    'ADJUSTMENT': 'bg-slate-50 text-slate-700 border-slate-100'
  };
  return map[type] || 'bg-slate-50 text-slate-600';
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
