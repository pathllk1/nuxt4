<script setup lang="ts">
import { reactive, ref } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const form = reactive({
  item: '',
  hsn: '',
  uom: 'PCS',
  rate: 0,
  selling_price: 0,
  grate: 18,
  qty: 0,
});

const saving = ref(false);
const saveStock = async () => {
  if (!form.item.trim()) return;
  saving.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: any }>('/api/inventory/stock', {
      method: 'POST',
      body: form,
    });
    if (res.success) {
      emit('saved', res.data);
      emit('update:modelValue', false);
    }
  } catch (err: any) {
    alert(err.data?.message || err.message || 'Failed to create stock item');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col">
      <header class="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Add New Stock Item</h2>
          <p class="text-xs opacity-80">Register item into inventory catalog</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 space-y-4 text-xs">
        <form @submit.prevent="saveStock" id="stock-modal-form" class="space-y-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Item Name *</label>
            <input type="text" v-model="form.item" required class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">HSN Code</label>
              <input type="text" v-model="form.hsn" placeholder="e.g. 8471" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none uppercase" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">UOM</label>
              <select v-model="form.uom" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none">
                <option value="PCS">PCS</option>
                <option value="KG">KG</option>
                <option value="MTR">MTR</option>
                <option value="BOX">BOX</option>
                <option value="NOS">NOS</option>
                <option value="SET">SET</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Purchase Rate (₹)</label>
              <input type="number" step="any" v-model="form.rate" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-right outline-none" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Selling Price (₹)</label>
              <input type="number" step="any" v-model="form.selling_price" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-right outline-none" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">GST Rate %</label>
              <input type="number" step="any" v-model="form.grate" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-right outline-none" />
            </div>
          </div>
        </form>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
        <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition-colors">
          Cancel
        </button>
        <button type="submit" form="stock-modal-form" :disabled="saving" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm">
          {{ saving ? 'Saving...' : 'Add Stock Item' }}
        </button>
      </footer>
    </div>
  </div>
</template>
