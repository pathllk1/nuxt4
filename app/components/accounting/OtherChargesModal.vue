<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  otherCharges: any[];
}>();

const emit = defineEmits(['update:modelValue']);

const addCharge = () => {
  props.otherCharges.push({
    name: 'Freight Charges',
    hsnSac: '9965',
    amount: 0,
    grate: 18,
  });
};

const removeCharge = (index: number) => {
  props.otherCharges.splice(index, 1);
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[85vh]">
      <header class="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Other Charges</h2>
          <p class="text-xs opacity-80">Freight, packing, and additional invoice fees</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 overflow-y-auto flex-1 space-y-4">
        <div v-if="otherCharges.length === 0" class="py-8 text-center text-slate-400 dark:text-zinc-500 text-xs">
          No additional charges added. Click "+ Add Charge" to add freight or handling fees.
        </div>

        <div v-for="(charge, index) in otherCharges" :key="index" class="p-4 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
          <div>
            <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Charge Name</label>
            <input type="text" v-model="charge.name" placeholder="e.g. Freight" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border rounded-lg text-xs font-bold" />
          </div>
          <div>
            <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">HSN/SAC</label>
            <input type="text" v-model="charge.hsnSac" placeholder="9965" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border rounded-lg font-mono text-xs font-bold uppercase" />
          </div>
          <div>
            <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">Amount (₹)</label>
            <input type="number" step="any" v-model="charge.amount" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border rounded-lg text-xs font-bold text-right font-mono" />
          </div>
          <div class="flex items-center gap-2">
            <div class="flex-1">
              <label class="block text-[9px] font-bold text-slate-400 uppercase mb-1">GST %</label>
              <input type="number" step="any" v-model="charge.grate" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border rounded-lg text-xs font-bold text-right font-mono" />
            </div>
            <button type="button" @click="removeCharge(index)" class="mt-4 text-slate-400 hover:text-red-500 transition-colors p-1">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
        <button type="button" @click="addCharge" class="px-3 py-1.5 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-lg text-xs font-bold transition-colors">
          + Add Charge Line
        </button>
        <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition-colors">
          Apply Charges
        </button>
      </footer>
    </div>
  </div>
</template>
