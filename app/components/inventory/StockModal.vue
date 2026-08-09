<template>
  <div v-if="modelValue" class="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-slate-200 dark:border-zinc-800">
      <!-- Header -->
      <div class="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-850/80">
        <div class="flex items-center gap-3">
           <div class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-200 ring-2 ring-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
           </div>
           <div>
              <h2 class="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Stock Browser</h2>
              <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Inventory Management Hub</p>
           </div>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-9 h-9 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 hover:border-red-100 transition-all shadow-sm group">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transform group-hover:rotate-90 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="px-6 pt-4 pb-2">
         <div class="relative group">
            <input 
              type="text" 
              v-model="search" 
              placeholder="Filter by Name, HSN, Part No or OEM..." 
              class="w-full pl-10 pr-6 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-50/50 outline-none transition-all font-bold text-xs text-slate-800 dark:text-zinc-200 placeholder-slate-400 shadow-inner"
              ref="searchInput"
              @keydown="handleSearchKeydown"
            />
            <div class="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
            </div>
            <div class="absolute right-3.5 top-3 flex gap-2">
               <span class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400 rounded font-mono text-[9px] font-bold">Insert: New Item • F3/Ctrl+E: Edit Item • ↑↓: Navigate • Enter: Select • ESC: Close</span>
            </div>
         </div>
      </div>

      <!-- Advanced Stock Table -->
      <div class="flex-1 overflow-y-auto px-6 pb-4 custom-scrollbar bg-slate-50/50 dark:bg-zinc-900/50">
         <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-sm">
            <table class="w-full text-left border-collapse">
               <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
                     <th class="px-4 py-2">Item Description</th>
                     <th class="px-3 py-2">HSN</th>
                     <th class="px-3 py-2">Batch</th>
                     <th class="px-3 py-2">Expiry</th>
                     <th class="px-3 py-2 text-right">Available</th>
                     <th class="px-3 py-2 text-right">Rate</th>
                     <th class="px-3 py-2 text-right">GST %</th>
                     <th class="px-3 py-2 text-right">MRP</th>
                     <th class="px-4 py-2 text-center">Action</th>
                  </tr>
               </thead>
               <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                  <template v-for="(stock, index) in filteredStocks" :key="stock._id">
                     <!-- Main Stock Item Row -->
                      <tr 
                        class="transition-colors cursor-pointer group text-xs font-bold text-slate-700 dark:text-zinc-300"
                        :class="[
                          isStockActive(stock) ? 'bg-blue-100/90 dark:bg-blue-950/90 ring-2 ring-blue-500 ring-inset shadow-md' : 'hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
                        ]"
                        @click="toggleStock(stock)"
                      >
                        <td class="px-4 py-1.5">
                           <div class="font-black text-slate-900 dark:text-white text-xs leading-tight">{{ stock.item }}</div>
                           <div class="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-400 dark:text-zinc-500 font-semibold">
                              <span v-if="stock.pno">P/N: {{ stock.pno }}</span>
                              <span v-if="stock.pno && stock.oem" class="w-0.5 h-0.5 bg-slate-300 rounded-full"></span>
                              <span v-if="stock.oem">OEM: {{ stock.oem }}</span>
                           </div>
                        </td>
                        <td class="px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider text-slate-500 dark:text-zinc-400">{{ stock.hsn }}</td>
                        <td class="px-3 py-1.5">
                           <div v-if="stock.batches && stock.batches.length > 1" class="flex items-center gap-1">
                              <span class="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border-indigo-100 border rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase">
                                 {{ stock.batches.length }} Batches
                              </span>
                              <svg 
                                class="w-3 h-3 text-indigo-500 transition-transform duration-200"
                                :class="expandedStockId === stock._id ? 'rotate-180' : ''"
                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                              >
                                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
                              </svg>
                           </div>
                           <span v-else-if="stock.batches && stock.batches.length === 1" class="bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-100 dark:border-zinc-700 px-1.5 py-0.5 border rounded-md text-[9px] font-black uppercase">
                               {{ stock.batches[0].batch || '-' }}
                           </span>
                           <span v-else class="text-slate-400">-</span>
                        </td>
                        <td class="px-3 py-1.5 text-slate-500 dark:text-zinc-400 font-medium text-[11px]">
                           <span v-if="stock.batches && stock.batches.length > 1" class="text-slate-400 italic">Various</span>
                           <span v-else-if="stock.batches && stock.batches.length === 1">
                              {{ stock.batches[0].expiry ? formatDate(stock.batches[0].expiry) : '-' }}
                           </span>
                           <span v-else>-</span>
                        </td>
                        <td class="px-3 py-1.5 text-right">
                           <span class="text-xs font-black text-slate-900 dark:text-white" :class="stock.qty <= 0 ? 'text-red-500 animate-pulse' : ''">{{ stock.qty?.toLocaleString() || 0 }}</span>
                           <span class="text-[9px] font-black text-slate-400 uppercase ml-0.5">{{ stock.uom }}</span>
                        </td>
                        <td class="px-3 py-1.5 text-right font-mono text-slate-900 dark:text-zinc-200 text-[11px]">₹{{ (stock.rate || 0).toFixed(2) }}</td>
                        <td class="px-3 py-1.5 text-right text-slate-500 dark:text-zinc-400 font-medium text-[11px]">{{ stock.grate || 0 }}%</td>
                        <td class="px-3 py-1.5 text-right font-mono text-slate-900 dark:text-zinc-200 text-[11px]">
                           <span v-if="stock.batches && stock.batches.length > 1" class="text-slate-400 italic">Various</span>
                           <span v-else-if="stock.batches && stock.batches.length === 1">
                              {{ stock.batches[0].mrp ? '₹' + stock.batches[0].mrp.toFixed(2) : '-' }}
                           </span>
                           <span v-else-if="stock.mrp">₹{{ stock.mrp.toFixed(2) }}</span>
                           <span v-else>-</span>
                        </td>
                        <td class="px-4 py-1.5 text-center">
                           <div class="flex items-center justify-center gap-1.5">
                              <button 
                                class="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-colors"
                                :class="stock.batches && stock.batches.length > 1 
                                  ? (expandedStockId === stock._id ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white') 
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-blue-600 hover:text-white'"
                              >
                                 {{ stock.batches && stock.batches.length > 1 ? (expandedStockId === stock._id ? 'Close' : 'Expand') : 'Select' }}
                              </button>
                              <button 
                                type="button"
                                @click.stop="$emit('edit-stock', stock)"
                                class="px-2 py-0.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-200 hover:bg-amber-600 hover:text-white rounded-md text-[9px] font-black uppercase tracking-wider transition-colors"
                              >
                                 Edit
                              </button>
                           </div>
                        </td>
                     </tr>

                     <!-- Nested Batches Sub-Table Row -->
                     <tr v-if="expandedStockId === stock._id && stock.batches && stock.batches.length > 1" class="bg-slate-50/50 dark:bg-zinc-850/50">
                        <td colspan="9" class="px-4 py-2">
                           <div class="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm max-w-4xl animate-scale-in">
                              <div class="bg-slate-50 dark:bg-zinc-800 px-3 py-1.5 border-b border-slate-100 dark:border-zinc-700 flex items-center justify-between">
                                 <span class="text-[9px] font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-widest">Select Batch for {{ stock.item }}</span>
                                 <span class="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase">{{ stock.batches.length }} Batches Available</span>
                              </div>
                              <table class="w-full text-left text-xs border-collapse">
                                 <thead>
                                    <tr class="bg-slate-50/50 dark:bg-zinc-800/50 text-[9px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-zinc-800">
                                       <th class="px-3 py-1.5">Batch No</th>
                                       <th class="px-3 py-1.5">Expiry</th>
                                       <th class="px-3 py-1.5 text-right">Available Qty</th>
                                       <th class="px-3 py-1.5 text-right">Rate</th>
                                       <th class="px-3 py-1.5 text-right">GST %</th>
                                       <th class="px-3 py-1.5 text-right">MRP</th>
                                       <th class="px-3 py-1.5 text-center">Action</th>
                                    </tr>
                                 </thead>
                                 <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-bold text-slate-600 dark:text-zinc-300 text-[11px]">
                                    <tr 
                                      v-for="batch in stock.batches" 
                                      :key="batch._id || batch.batch"
                                      class="transition-colors cursor-pointer"
                                      :class="[
                                         isBatchActive(stock, batch) ? 'bg-indigo-100 dark:bg-indigo-900/90 ring-2 ring-indigo-500 font-extrabold text-indigo-900 dark:text-white' : 'hover:bg-blue-50/20 dark:hover:bg-blue-950/20'
                                      ]"
                                      @click.stop="selectRow(stock, batch)"
                                    >
                                       <td class="px-3 py-1">
                                          <span class="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 rounded text-[9px] font-black uppercase">
                                             {{ batch.batch || '-' }}
                                          </span>
                                       </td>
                                       <td class="px-3 py-1 text-slate-500 dark:text-zinc-400 font-medium">
                                          {{ batch.expiry ? formatDate(batch.expiry) : '-' }}
                                       </td>
                                       <td class="px-3 py-1 text-right text-slate-900 dark:text-white">
                                          {{ batch.qty.toLocaleString() }} <span class="text-[9px] text-slate-400 uppercase ml-0.5">{{ batch.uom }}</span>
                                       </td>
                                       <td class="px-3 py-1 text-right text-slate-900 dark:text-white font-mono">₹{{ batch.rate.toFixed(2) }}</td>
                                       <td class="px-3 py-1 text-right text-slate-500 dark:text-zinc-400 font-medium">{{ batch.grate }}%</td>
                                       <td class="px-3 py-1 text-right text-slate-900 dark:text-white font-mono">{{ batch.mrp ? '₹' + batch.mrp.toFixed(2) : '-' }}</td>
                                       <td class="px-3 py-1 text-center">
                                          <button class="px-2 py-0.5 bg-indigo-600 text-white rounded-md text-[9px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors">
                                             Select
                                          </button>
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                           </div>
                        </td>
                     </tr>
                  </template>
                  <tr v-if="filteredStocks.length === 0">
                     <td colspan="9" class="px-5 py-8 text-center text-slate-400 font-black uppercase text-xs tracking-widest">
                        No stock items match your search
                     </td>
                  </tr>
               </tbody>
            </table>
         </div>
      </div>

      <!-- High-Fidelity Footer -->
      <div class="p-4 px-6 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-850/50 flex justify-between items-center">
         <button @click="$emit('create-stock')" type="button" class="group flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white px-4 py-1.5 rounded-xl transition-all duration-300">
            <div class="w-6 h-6 bg-white/50 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors shadow-sm font-black text-xs">
               +
            </div>
            <span class="text-[10px] font-black uppercase tracking-widest">+ Register New Stock Item (F5 / Ctrl+N)</span>
         </button>
         <button @click="$emit('update:modelValue', false)" class="px-4 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 text-slate-500 dark:text-zinc-400 hover:text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm">
            Close Browser
         </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  stocks: any[];
}>();

const emit = defineEmits(['update:modelValue', 'select', 'create-stock', 'edit-stock']);

const search = ref('');
const searchInput = ref<HTMLInputElement | null>(null);

const expandedStockId = ref<string | null>(null);
const selectedIndex = ref(0);

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    expandedStockId.value = null;
    selectedIndex.value = 0;
    nextTick(() => searchInput.value?.focus());
  }
});

watch(search, () => {
  selectedIndex.value = 0;
});

const filteredStocks = computed(() => {
  if (!search.value) return props.stocks;
  const q = search.value.toLowerCase();
  return props.stocks.filter(s => 
    s.item.toLowerCase().includes(q) || 
    s.hsn?.toLowerCase().includes(q) ||
    s.pno?.toLowerCase().includes(q) ||
    s.oem?.toLowerCase().includes(q)
  );
});

const flatNavigableList = computed(() => {
  const list: Array<{ type: 'stock' | 'batch'; stock: any; batch?: any }> = [];
  for (const stock of filteredStocks.value) {
    list.push({ type: 'stock', stock });
    if (expandedStockId.value === stock._id && stock.batches && stock.batches.length > 1) {
      for (const batch of stock.batches) {
        list.push({ type: 'batch', stock, batch });
      }
    }
  }
  return list;
});

function isStockActive(stock: any) {
  const current = flatNavigableList.value[selectedIndex.value];
  return current?.type === 'stock' && current?.stock?._id === stock._id;
}

function isBatchActive(stock: any, batch: any) {
  const current = flatNavigableList.value[selectedIndex.value];
  if (current?.type !== 'batch') return false;
  if (current.stock?._id !== stock._id) return false;
  if (batch._id && current.batch?._id) return current.batch._id === batch._id;
  return current.batch?.batch === batch.batch && current.batch?.rate === batch.rate;
}

function handleSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (flatNavigableList.value.length > 0) {
      selectedIndex.value = (selectedIndex.value + 1) % flatNavigableList.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (flatNavigableList.value.length > 0) {
      selectedIndex.value = (selectedIndex.value - 1 + flatNavigableList.value.length) % flatNavigableList.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (flatNavigableList.value.length > 0 && selectedIndex.value < flatNavigableList.value.length) {
      const item = flatNavigableList.value[selectedIndex.value];
      if (item.type === 'batch') {
        selectRow(item.stock, item.batch);
      } else {
        const stock = item.stock;
        if (stock.batches && stock.batches.length > 1) {
          if (expandedStockId.value === stock._id) {
            selectRow(stock, stock.batches[0]);
          } else {
            expandedStockId.value = stock._id;
            selectedIndex.value = selectedIndex.value + 1;
          }
        } else {
          selectRow(stock, stock.batches?.[0] || null);
        }
      }
    }
  } else if (e.key === 'F5' || e.key === 'Insert' || (e.altKey && e.key.toLowerCase() === 'c') || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    emit('create-stock');
  } else if (e.key === 'F3' || ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'e')) {
    e.preventDefault();
    if (flatNavigableList.value.length > 0 && selectedIndex.value < flatNavigableList.value.length) {
      const item = flatNavigableList.value[selectedIndex.value];
      emit('edit-stock', item.stock);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    if (expandedStockId.value) {
      expandedStockId.value = null;
    } else {
      emit('update:modelValue', false);
    }
  }
}

function toggleStock(stock: any) {
  if (stock.batches && stock.batches.length > 1) {
    expandedStockId.value = expandedStockId.value === stock._id ? null : stock._id;
  } else {
    selectRow(stock, stock.batches?.[0] || null);
  }
}

function selectRow(stock: any, batch: any) {
  const stockObj = {
    ...stock,
    selectedBatch: batch
  };
  emit('select', stockObj);
}

function formatDate(dateString: any) {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
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
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #cbd5e1;
}
</style>
