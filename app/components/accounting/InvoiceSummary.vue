<script setup lang="ts">
const props = defineProps<{
  state: any;
  totals: any;
}>();
</script>

<template>
  <div class="bg-white dark:bg-zinc-900/80 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
    <h3 class="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">Bill Calculation Breakdown</h3>

    <div class="space-y-2 text-xs font-semibold">
      <div class="flex justify-between text-slate-600 dark:text-zinc-400">
        <span>Items Taxable Subtotal</span>
        <span class="font-mono text-slate-900 dark:text-white">₹{{ (totals.grossTotal - (totals.otherChargesTotal || 0)).toFixed(2) }}</span>
      </div>

      <div v-if="totals.otherChargesTotal > 0" class="flex justify-between text-slate-600 dark:text-zinc-400">
        <span>Additional Charges</span>
        <span class="font-mono text-slate-900 dark:text-white">₹{{ totals.otherChargesTotal.toFixed(2) }}</span>
      </div>

      <template v-if="state.gstEnabled">
        <div v-if="state.meta.billType === 'intra-state'" class="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <div class="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>CGST</span>
            <span class="font-mono">₹{{ totals.cgst.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-emerald-600 dark:text-emerald-400">
            <span>SGST</span>
            <span class="font-mono">₹{{ totals.sgst.toFixed(2) }}</span>
          </div>
        </div>
        <div v-else class="flex justify-between text-emerald-600 dark:text-emerald-400 pt-2 border-t border-slate-100 dark:border-zinc-800">
          <span>IGST</span>
          <span class="font-mono">₹{{ totals.igst.toFixed(2) }}</span>
        </div>
      </template>

      <div v-if="Math.abs(totals.roundOff) > 0" class="flex justify-between text-slate-500 text-[11px]">
        <span>Round Off</span>
        <span class="font-mono">{{ totals.roundOff >= 0 ? '+' : '' }}{{ totals.roundOff.toFixed(2) }}</span>
      </div>

      <div class="flex justify-between items-center text-sm font-black pt-3 border-t-2 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white">
        <span>Total Amount Payable</span>
        <span class="text-lg font-mono text-indigo-600 dark:text-indigo-400">₹{{ totals.netTotal.toLocaleString('en-IN') }}</span>
      </div>
    </div>
  </div>
</template>
