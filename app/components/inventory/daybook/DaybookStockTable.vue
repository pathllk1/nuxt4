<template>
  <div class="space-y-4">
    <!-- Controls & Filters Strip -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs">
      <div class="flex flex-wrap items-center gap-3 flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search items, HSN, godown..."
          class="w-full sm:w-72"
          size="sm"
        />

        <USelect
          v-model="marginFilter"
          :items="[
            { label: 'All Items', value: 'ALL' },
            { label: 'High Margin (≥ 30%)', value: 'HIGH' },
            { label: 'Moderate Margin (10% - 30%)', value: 'MODERATE' },
            { label: 'Low Margin (0% - 10%)', value: 'LOW' },
            { label: 'Negative Margin (Loss)', value: 'LOSS' }
          ]"
          class="w-48"
          size="sm"
        />

        <USelect
          v-model="sortBy"
          :items="[
            { label: 'Sort: Highest Revenue', value: 'REVENUE' },
            { label: 'Sort: Highest Margin (₹)', value: 'MARGIN' },
            { label: 'Sort: Highest Margin %', value: 'MARGIN_PCT' },
            { label: 'Sort: Highest Quantity', value: 'QTY' },
            { label: 'Sort: Item Name', value: 'NAME' }
          ]"
          class="w-52"
          size="sm"
        />
      </div>

      <div class="text-xs text-slate-500 font-medium">
        Showing <span class="font-bold text-slate-900 dark:text-white">{{ filteredList.length }}</span> of {{ items.length }} items
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            <tr>
              <th class="py-3 px-3.5 w-10 text-center">#</th>
              <th class="py-3 px-3.5 min-w-56">Item Name</th>
              <th class="py-3 px-3.5 w-24">HSN</th>
              <th class="py-3 px-3.5 w-28">Godown / Batch</th>
              <th class="py-3 px-3.5 w-24 text-right">Billed Qty</th>
              <th class="py-3 px-3.5 w-28 text-right">Avg Rate (₹)</th>
              <th class="py-3 px-3.5 w-28 text-right">Avg Cost (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Revenue (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Cost (COGS ₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Margin (₹)</th>
              <th class="py-3 px-3.5 w-28 text-right">Margin %</th>
              <th class="py-3 px-3.5 w-20 text-center">Buyers</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
            <tr
              v-for="(item, idx) in filteredList"
              :key="idx"
              class="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
              :class="idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-850/20' : ''"
            >
              <td class="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
              <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">
                <div>{{ item.itemName }}</div>
                <div v-if="item.totalActualQty !== item.totalBilledQty" class="text-[10px] text-slate-400 font-normal mt-0.5">
                  Actual: {{ item.totalActualQty }} {{ item.unit }}
                </div>
              </td>
              <td class="py-2.5 px-3.5 font-mono text-slate-500 dark:text-zinc-400 text-[11px]">{{ item.hsn || '-' }}</td>
              <td class="py-2.5 px-3.5 text-[11px] text-slate-600 dark:text-zinc-300">
                <div class="truncate max-w-xs">{{ item.godown }}</div>
                <div class="text-[9px] text-slate-400 font-mono">{{ item.batch }}</div>
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatNumber(item.totalBilledQty) }}
                <span class="text-[10px] text-slate-400 font-normal ml-0.5">{{ item.unit }}</span>
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(item.avgSellingRate) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-rose-600 dark:text-rose-400">
                {{ formatCurrency(item.avgPurchaseRate) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatCurrency(item.totalRevenue) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-slate-500 dark:text-zinc-400">
                {{ formatCurrency(item.totalCost) }}
              </td>
              <td
                class="py-2.5 px-3.5 text-right font-mono font-black"
                :class="item.totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
              >
                {{ formatCurrency(item.totalMargin) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono">
                <span
                  class="px-2 py-0.5 rounded-full text-[10px] font-black"
                  :class="[
                    item.marginPct >= 30 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                    item.marginPct >= 10 ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' :
                    item.marginPct >= 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                    'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                  ]"
                >
                  {{ item.marginPct }}%
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-center">
                <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-mono text-[10px] font-bold" :title="Array.from(item.parties).join(', ')">
                  {{ item.parties.size }}
                </span>
              </td>
            </tr>

            <tr v-if="filteredList.length === 0">
              <td colspan="12" class="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                No items matching the selected filters.
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
import type { DaybookStockSummary } from '@/utils/daybook-parser';

const props = defineProps<{
  items: DaybookStockSummary[];
}>();

const searchQuery = ref('');
const marginFilter = ref('ALL');
const sortBy = ref('REVENUE');

const filteredList = computed(() => {
  let list = [...props.items];

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter((i) =>
      i.itemName.toLowerCase().includes(q) ||
      i.hsn.toLowerCase().includes(q) ||
      i.godown.toLowerCase().includes(q) ||
      i.unit.toLowerCase().includes(q)
    );
  }

  if (marginFilter.value === 'HIGH') {
    list = list.filter((i) => i.marginPct >= 30);
  } else if (marginFilter.value === 'MODERATE') {
    list = list.filter((i) => i.marginPct >= 10 && i.marginPct < 30);
  } else if (marginFilter.value === 'LOW') {
    list = list.filter((i) => i.marginPct >= 0 && i.marginPct < 10);
  } else if (marginFilter.value === 'LOSS') {
    list = list.filter((i) => i.marginPct < 0);
  }

  if (sortBy.value === 'REVENUE') {
    list.sort((a, b) => b.totalRevenue - a.totalRevenue);
  } else if (sortBy.value === 'MARGIN') {
    list.sort((a, b) => b.totalMargin - a.totalMargin);
  } else if (sortBy.value === 'MARGIN_PCT') {
    list.sort((a, b) => b.marginPct - a.marginPct);
  } else if (sortBy.value === 'QTY') {
    list.sort((a, b) => b.totalBilledQty - a.totalBilledQty);
  } else if (sortBy.value === 'NAME') {
    list.sort((a, b) => a.itemName.localeCompare(b.itemName));
  }

  return list;
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
