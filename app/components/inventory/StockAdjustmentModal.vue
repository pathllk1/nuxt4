<script setup lang="ts">
import { ref, watch } from 'vue';
import { useInventory } from '@/composables/useInventory';
import StockModal from './StockModal.vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { stocks, createMovement } = useInventory();

const showStockBrowser = ref(false);
const saving = ref(false);

const form = ref({
  stockId: '',
  item: '',
  qty: 0,
  rate: 0,
  batch: '',
  uom: 'pcs',
  referenceNumber: 'Manual Adjustment'
});

const selectedStock = ref<any>(null);

function openStockBrowser() {
  showStockBrowser.value = true;
}

function handleStockSelect(stock: any) {
  selectedStock.value = stock;
  form.value.stockId = stock._id;
  form.value.item = stock.item;
  form.value.rate = stock.rate || 0;
  form.value.uom = stock.uom || 'pcs';
  form.value.batch = stock.selectedBatch?.batch || '';
  showStockBrowser.value = false;
}

async function handleSave() {
  if (!form.value.stockId) {
    alert('Please select a stock item first');
    return;
  }
  if (form.value.qty === 0) {
    alert('Adjustment quantity cannot be zero');
    return;
  }

  saving.value = true;
  try {
    const res = await createMovement({
      type: 'ADJUSTMENT',
      stockId: form.value.stockId,
      item: form.value.item,
      qty: form.value.qty,
      rate: form.value.rate,
      uom: form.value.uom,
      batch: form.value.batch,
      referenceNumber: form.value.referenceNumber
    });

    if (res.success) {
      emit('saved');
      emit('update:modelValue', false);
      resetForm();
    }
  } catch (err: any) {
    alert(err.message || 'Failed to save adjustment');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  form.value = {
    stockId: '',
    item: '',
    qty: 0,
    rate: 0,
    batch: '',
    uom: 'pcs',
    referenceNumber: 'Manual Adjustment'
  };
  selectedStock.value = null;
}

watch(() => props.modelValue, (val) => {
  if (!val) resetForm();
});
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
    <div class="bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col">
       <header class="bg-slate-900 px-8 py-6 text-white flex justify-between items-center shrink-0">
          <div>
             <h2 class="text-xl font-black uppercase tracking-tighter">Stock Adjustment</h2>
             <p class="text-[10px] font-bold opacity-50 uppercase tracking-[0.2em] mt-1 text-amber-400">Inventory Correction Hub</p>
          </div>
          <button @click="$emit('update:modelValue', false)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="p-8 space-y-6">
          <!-- Stock Selection -->
          <div class="space-y-2">
             <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stock Item *</label>
             <div v-if="!selectedStock" @click="openStockBrowser" class="p-4 bg-slate-50 dark:bg-zinc-800 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-750 transition-all flex items-center justify-center gap-2 group">
                <svg class="w-5 h-5 text-slate-400 group-hover:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <span class="text-sm font-bold text-slate-500 dark:text-zinc-400 group-hover:text-slate-700">Click to search and select item...</span>
             </div>
             <div v-else class="p-4 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-100 dark:border-indigo-900/50 rounded-2xl flex items-center justify-between">
                <div>
                   <div class="font-black text-indigo-900 dark:text-indigo-300">{{ selectedStock.item }}</div>
                   <div class="text-[10px] font-bold text-indigo-400 uppercase">HSN: {{ selectedStock.hsn }} • Current Qty: {{ selectedStock.qty }}</div>
                </div>
                <button @click="openStockBrowser" class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:text-indigo-800">Change</button>
             </div>
          </div>

          <!-- Adjustment Details -->
          <div class="grid grid-cols-2 gap-4" v-if="selectedStock">
             <div class="col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Adjustment Quantity (±) *</label>
                <div class="relative">
                   <input type="number" step="any" v-model.number="form.qty" class="w-full pl-6 pr-16 py-4 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-2xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-black text-xl text-gray-900 dark:text-white" />
                   <div class="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ form.uom }}</div>
                </div>
                <p class="text-[10px] font-bold text-slate-400 mt-2 ml-1">Enter positive for addition, negative for deduction</p>
             </div>

             <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Valuation Rate *</label>
                <input type="number" step="any" v-model.number="form.rate" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" />
             </div>

             <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Batch Number</label>
                <input type="text" v-model="form.batch" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" placeholder="Optional" />
             </div>

             <div class="col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Reason / Reference *</label>
                <input type="text" v-model="form.referenceNumber" required class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" placeholder="e.g. Damage correction, Opening balance fix" />
             </div>
          </div>

          <div v-else class="py-12 text-center text-slate-300 dark:text-zinc-600 font-bold uppercase text-xs tracking-widest border-2 border-dashed border-slate-50 dark:border-zinc-800 rounded-[2rem]">
             Select an item to see adjustment options
          </div>
       </div>

       <footer class="p-8 bg-slate-50 dark:bg-zinc-850 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button @click="$emit('update:modelValue', false)" class="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Cancel</button>
          <button @click="handleSave" :disabled="saving || !selectedStock" class="px-10 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-30 transition-all flex items-center gap-2">
             <span v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
             Save Adjustment
          </button>
       </footer>
    </div>

    <StockModal v-model="showStockBrowser" :stocks="stocks" @select="handleStockSelect" />
  </div>
</template>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95) translateY(10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
