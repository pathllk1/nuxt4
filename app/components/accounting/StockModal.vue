<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  stocks: any[];
}>();

const emit = defineEmits(['update:modelValue', 'select', 'create-stock', 'edit-stock']);

const searchQuery = ref('');

const filteredStocks = computed(() => {
  if (!searchQuery.value.trim()) return props.stocks || [];
  const q = searchQuery.value.toLowerCase();
  return (props.stocks || []).filter((s: any) =>
    (s.item || s.name || '').toLowerCase().includes(q) ||
    (s.hsn || '').toLowerCase().includes(q)
  );
});

const selectStock = (stock: any) => {
  emit('select', stock);
  emit('update:modelValue', false);
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
      <header class="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Select Stock Item</h2>
          <p class="text-xs opacity-80">Choose an item from inventory catalog</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-4 border-b border-slate-200 dark:border-zinc-800">
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search items by name, HSN code..." 
          class="w-full px-4 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
        />
      </div>

      <div class="p-4 overflow-y-auto flex-1 divide-y divide-slate-100 dark:divide-zinc-800">
        <div v-if="filteredStocks.length === 0" class="py-12 text-center text-slate-400 dark:text-zinc-500">
          No matching stock items found in inventory catalog.
        </div>
        <div 
          v-for="stock in filteredStocks" 
          :key="stock._id" 
          @click="selectStock(stock)"
          class="py-3 px-4 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-xl cursor-pointer transition-colors flex justify-between items-center group"
        >
          <div>
            <h4 class="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{{ stock.item || stock.name }}</h4>
            <p class="text-xs text-slate-400 font-mono">HSN: {{ stock.hsn || '-' }} | UOM: {{ stock.uom || 'PCS' }} | GST: {{ stock.grate || 0 }}%</p>
          </div>
          <div class="text-right">
            <span class="text-sm font-bold text-indigo-600 dark:text-indigo-400 font-mono">₹{{ (stock.selling_price || stock.rate || 0).toLocaleString('en-IN') }}</span>
            <span class="block text-[10px] text-slate-400">Stock: {{ stock.qty ?? 0 }} {{ stock.uom || 'PCS' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
