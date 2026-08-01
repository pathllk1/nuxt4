<script setup lang="ts">
const props = defineProps<{
  state: any;
  mode: 'sales' | 'purchase';
}>();

const emit = defineEmits(['add-item', 'add-service', 'remove-item', 'service-input']);
</script>

<template>
  <div class="bg-white dark:bg-zinc-900/80 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col">
    <div class="p-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-slate-50/50 dark:bg-zinc-800/50">
      <h3 class="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Item Details & Tax Lines</h3>
      <div class="flex gap-2">
        <button type="button" @click="$emit('add-item')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Add Stock Item
        </button>
        <button v-if="mode === 'sales'" type="button" @click="$emit('add-service')" class="px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-200 rounded-lg text-xs font-bold transition-colors">
          + Add Service
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
            <th class="py-3 px-4">#</th>
            <th class="py-3 px-4">Item / Service</th>
            <th class="py-3 px-4">HSN/SAC</th>
            <th class="py-3 px-4 text-right">Qty</th>
            <th class="py-3 px-4">UOM</th>
            <th class="py-3 px-4 text-right">Rate (₹)</th>
            <th class="py-3 px-4 text-right">Disc %</th>
            <th v-if="state.gstEnabled" class="py-3 px-4 text-right">GST %</th>
            <th class="py-3 px-4 text-right">Line Total (₹)</th>
            <th class="py-3 px-4 text-center">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
          <tr v-if="state.cart.length === 0">
            <td :colspan="state.gstEnabled ? 10 : 9" class="py-12 text-center text-slate-400 dark:text-zinc-500">
              No items added to bill yet. Click "+ Add Stock Item" to begin.
            </td>
          </tr>
          <tr v-for="(item, idx) in state.cart" :key="idx" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
            <td class="py-3 px-4 text-slate-400 text-[10px] font-mono">{{ idx + 1 }}</td>
            <td class="py-3 px-4">
              <input v-if="item.itemType === 'SERVICE'" type="text" v-model="item.item" placeholder="Service description" class="w-full px-2 py-1 bg-slate-50 dark:bg-zinc-800 border rounded font-bold text-xs" />
              <span v-else class="font-bold">{{ item.item }}</span>
            </td>
            <td class="py-3 px-4 font-mono text-[11px]">{{ item.hsn || '-' }}</td>
            <td class="py-3 px-4 text-right">
              <input type="number" step="any" min="0" v-model="item.qty" class="w-20 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-bold" />
            </td>
            <td class="py-3 px-4 text-[10px] uppercase font-bold text-slate-500">{{ item.uom || 'PCS' }}</td>
            <td class="py-3 px-4 text-right">
              <input type="number" step="any" min="0" v-model="item.rate" class="w-24 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-bold" />
            </td>
            <td class="py-3 px-4 text-right">
              <input type="number" step="any" min="0" max="100" v-model="item.disc" class="w-16 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-bold" />
            </td>
            <td v-if="state.gstEnabled" class="py-3 px-4 text-right">
              <input type="number" step="any" min="0" v-model="item.grate" class="w-16 px-2 py-1 text-right bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded font-bold" />
            </td>
            <td class="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              ₹{{ ((parseFloat(item.qty) || 0) * (parseFloat(item.rate) || 0) * (1 - ((parseFloat(item.disc) || 0) / 100))).toFixed(2) }}
            </td>
            <td class="py-3 px-4 text-center">
              <button type="button" @click="$emit('remove-item', idx)" class="text-slate-400 hover:text-red-500 transition-colors p-1">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
