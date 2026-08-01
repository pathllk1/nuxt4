<script setup lang="ts">
import { watch, reactive } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  stock?: any;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const form = reactive({
  _id: '',
  item: '',
  hsn: '',
  uom: 'PCS',
  rate: 0,
  selling_price: 0,
  grate: 18,
  qty: 0,
});

watch(() => props.stock, (newStock) => {
  if (newStock) {
    form._id = newStock._id;
    form.item = newStock.item || newStock.name || '';
    form.hsn = newStock.hsn || '';
    form.uom = newStock.uom || 'PCS';
    form.rate = newStock.rate || 0;
    form.selling_price = newStock.selling_price || 0;
    form.grate = newStock.grate || 18;
    form.qty = newStock.qty || 0;
  }
}, { immediate: true });
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col">
      <header class="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Edit Stock Item</h2>
          <p class="text-xs opacity-80">Update inventory catalog details</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 space-y-4 text-xs">
        <div class="space-y-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Name</label>
            <input type="text" v-model="form.item" readonly class="w-full px-3 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold text-slate-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">HSN Code</label>
              <input type="text" v-model="form.hsn" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none uppercase" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selling Price (₹)</label>
              <input type="number" step="any" v-model="form.selling_price" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-right outline-none" />
            </div>
          </div>
        </div>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
        <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition-colors">
          Close
        </button>
      </footer>
    </div>
  </div>
</template>
