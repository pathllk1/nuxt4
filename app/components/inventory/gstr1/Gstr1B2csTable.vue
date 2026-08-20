<template>
  <div class="space-y-4">
    <!-- Header Banner -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
          B2CS - Small Consumer Supplies
        </h3>
        <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
          Intra-State and Inter-State retail / consumer supplies aggregated by tax rate and state POS.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <p class="text-[10px] font-black uppercase text-slate-400">Total B2CS Value</p>
          <p class="text-base font-black font-mono text-purple-600 dark:text-purple-400">
            {{ formatCurrency(data.summary.totalB2csValue) }}
          </p>
        </div>
      </div>
    </div>

    <!-- B2CS Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse divide-y divide-slate-100 dark:divide-zinc-800">
          <thead class="bg-slate-50/90 dark:bg-zinc-850/90 sticky top-0 z-10">
            <tr class="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-3 px-3.5 w-12 text-center">#</th>
              <th class="py-3 px-3.5 w-24 text-center">Type</th>
              <th class="py-3 px-3.5 w-28 text-center">Supply Type</th>
              <th class="py-3 px-3.5 w-20 text-center">POS</th>
              <th class="py-3 px-3.5 w-20 text-center">Rate</th>
              <th class="py-3 px-3.5 w-32 text-right">Taxable Value</th>
              <th class="py-3 px-3.5 w-28 text-right">CGST</th>
              <th class="py-3 px-3.5 w-28 text-right">SGST</th>
              <th class="py-3 px-3.5 w-28 text-right">IGST</th>
              <th class="py-3 px-3.5 w-32 text-right">Total Tax</th>
              <th class="py-3 px-3.5 w-36 text-right">Total Outward Value</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
            <tr
              v-for="(item, idx) in data.b2csItems"
              :key="idx"
              class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
              :class="{ 'bg-slate-50/30 dark:bg-zinc-850/20': idx % 2 === 1 }"
            >
              <td class="py-3 px-3.5 text-center text-slate-400 font-mono text-[10px]">
                {{ idx + 1 }}
              </td>
              <td class="py-3 px-3.5 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {{ item.typ }}
                </span>
              </td>
              <td class="py-3 px-3.5 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                  {{ item.sply_ty }}
                </span>
              </td>
              <td class="py-3 px-3.5 text-center font-mono font-bold">
                {{ item.pos }}
              </td>
              <td class="py-3 px-3.5 text-center">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono">
                  {{ item.rt }}%
                </span>
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatCurrency(item.txval) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                {{ formatCurrency(item.camt) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                {{ formatCurrency(item.samt) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                {{ formatCurrency(item.iamt || 0) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                {{ formatCurrency(item.totalTax) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                {{ formatCurrency(item.totalValue) }}
              </td>
            </tr>

            <tr v-if="data.b2csItems.length === 0">
              <td colspan="11" class="py-16 text-center text-slate-400 dark:text-zinc-500 italic">
                No B2CS consumer records found.
              </td>
            </tr>
          </tbody>

          <!-- Totals Footer -->
          <tfoot v-if="data.b2csItems.length > 0" class="bg-slate-50/90 dark:bg-zinc-850/90 font-black border-t-2 border-slate-200 dark:border-zinc-700">
            <tr>
              <td colspan="5" class="py-3 px-3.5 text-right uppercase text-slate-600 dark:text-zinc-400 text-[10px]">
                Total B2CS:
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(data.summary.totalB2csTaxable) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalCgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalSgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(0) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-purple-600 dark:text-purple-400">
                {{ formatCurrency(data.summary.totalB2csTax) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(data.summary.totalB2csValue) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Gstr1ParsedData } from '~/utils/gstr1-parser';

const props = defineProps<{
  data: Gstr1ParsedData;
}>();

const totalCgst = computed(() => props.data.b2csItems.reduce((s, i) => s + i.camt, 0));
const totalSgst = computed(() => props.data.b2csItems.reduce((s, i) => s + i.samt, 0));

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
