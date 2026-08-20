<template>
  <div class="space-y-4">
    <!-- Controls Strip -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs">
      <div class="flex flex-wrap items-center gap-3 flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search HSN code..."
          class="w-full sm:w-72"
          size="sm"
        />
      </div>

      <div class="text-xs text-slate-500 font-medium">
        Showing <span class="font-bold text-slate-900 dark:text-white">{{ filteredList.length }}</span> HSN codes
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            <tr>
              <th class="py-3 px-3.5 w-10 text-center">#</th>
              <th class="py-3 px-3.5 w-32">HSN Code</th>
              <th class="py-3 px-3.5 w-24 text-center">GST Rate</th>
              <th class="py-3 px-3.5 w-20 text-center">Line Items</th>
              <th class="py-3 px-3.5 w-24 text-right">Total Units</th>
              <th class="py-3 px-3.5 w-32 text-right">Taxable Turnover (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Estimated Tax (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Total Cost (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Gross Margin (₹)</th>
              <th class="py-3 px-3.5 w-28 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
            <tr
              v-for="(h, idx) in filteredList"
              :key="idx"
              class="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
              :class="idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-850/20' : ''"
            >
              <td class="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
              <td class="py-2.5 px-3.5 font-mono font-bold text-primary">{{ h.hsn }}</td>
              <td class="py-2.5 px-3.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  {{ h.gstRate }}%
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-center">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[10px] font-bold">
                  {{ h.itemsCount }}
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatNumber(h.totalQty) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatCurrency(h.totalTaxable) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-indigo-600 dark:text-indigo-400">
                {{ formatCurrency(h.estimatedTax) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-slate-500 dark:text-zinc-400">
                {{ formatCurrency(h.totalCost) }}
              </td>
              <td
                class="py-2.5 px-3.5 text-right font-mono font-black"
                :class="h.totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
              >
                {{ formatCurrency(h.totalMargin) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-black"
                  :class="[
                    h.marginPct >= 30 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                    h.marginPct >= 10 ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' :
                    h.marginPct >= 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                    'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  ]"
                >
                  {{ h.marginPct }}%
                </span>
              </td>
            </tr>

            <tr v-if="filteredList.length === 0">
              <td colspan="10" class="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                No HSN summary records found matching filter.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DaybookHsnSummary } from '@/utils/daybook-parser';

const props = defineProps<{
  hsnList: DaybookHsnSummary[];
}>();

const searchQuery = ref('');

const filteredList = computed(() => {
  if (!searchQuery.value.trim()) return props.hsnList;
  const q = searchQuery.value.toLowerCase().trim();
  return props.hsnList.filter((h) => h.hsn.toLowerCase().includes(q));
});

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatNumber(qty: number = 0): string {
  return Number(qty || 0).toLocaleString('en-IN');
}
</script>
