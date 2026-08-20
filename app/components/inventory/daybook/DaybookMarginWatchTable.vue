<template>
  <div class="space-y-6">
    <!-- Loss / Negative Margin Warning Alert -->
    <div v-if="watchlist.negative.length > 0" class="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
      <div class="flex items-start gap-3">
        <div class="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400">
          <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
        </div>
        <div class="space-y-1">
          <h4 class="font-bold text-rose-900 dark:text-rose-200 text-sm">
            Margin Alert: {{ watchlist.negative.length }} Item(s) Sold Below Purchase Cost
          </h4>
          <p class="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
            The items below have negative margins (selling price lower than cost). Review billing rates or packaging giveaways to prevent unnecessary profit erosion.
          </p>
        </div>
      </div>
    </div>

    <!-- Section 1: Loss Making Items (Watchlist) -->
    <div v-if="watchlist.negative.length > 0" class="space-y-2">
      <h3 class="text-sm font-black uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
        <span>⚠️ Loss-Making Items (< 0% Margin)</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-700 font-bold">
          {{ watchlist.negative.length }}
        </span>
      </h3>

      <div class="rounded-2xl border border-rose-200 dark:border-rose-800/60 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-rose-50/50 dark:bg-rose-950/20 text-[10px] uppercase font-bold text-rose-700 dark:text-rose-300 border-b border-rose-100 dark:border-rose-900">
            <tr>
              <th class="py-2.5 px-3.5 w-10 text-center">#</th>
              <th class="py-2.5 px-3.5">Item Name</th>
              <th class="py-2.5 px-3.5 w-24 text-right">Units Sold</th>
              <th class="py-2.5 px-3.5 w-28 text-right">Selling Rate</th>
              <th class="py-2.5 px-3.5 w-28 text-right">Cost Rate</th>
              <th class="py-2.5 px-3.5 w-32 text-right">Total Revenue</th>
              <th class="py-2.5 px-3.5 w-32 text-right">Total Loss</th>
              <th class="py-2.5 px-3.5 w-24 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-rose-100/60 dark:divide-rose-950/40 font-medium">
            <tr v-for="(item, idx) in watchlist.negative" :key="idx" class="hover:bg-rose-50/30 dark:hover:bg-rose-950/10">
              <td class="py-2 px-3.5 text-center text-rose-400 font-mono text-[10px]">{{ idx + 1 }}</td>
              <td class="py-2 px-3.5 font-bold text-slate-900 dark:text-white">{{ item.itemName }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-bold">{{ formatNumber(item.totalBilledQty) }} {{ item.unit }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(item.avgSellingRate) }}</td>
              <td class="py-2 px-3.5 text-right font-mono text-rose-600 font-bold">{{ formatCurrency(item.avgPurchaseRate) }}</td>
              <td class="py-2 px-3.5 text-right font-mono text-slate-900 dark:text-white">{{ formatCurrency(item.totalRevenue) }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-black text-rose-600">{{ formatCurrency(item.totalMargin) }}</td>
              <td class="py-2 px-3.5 text-right font-mono">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300">
                  {{ item.marginPct }}%
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section 2: Star High-Margin Items (≥ 30%) -->
    <div class="space-y-2">
      <h3 class="text-sm font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
        <span>🌟 High-Margin Star Products (≥ 30% Margin)</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-bold">
          {{ watchlist.stars.length }}
        </span>
      </h3>

      <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            <tr>
              <th class="py-2.5 px-3.5 w-10 text-center">#</th>
              <th class="py-2.5 px-3.5">Item Name</th>
              <th class="py-2.5 px-3.5 w-24 text-right">Units Sold</th>
              <th class="py-2.5 px-3.5 w-28 text-right">Selling Rate</th>
              <th class="py-2.5 px-3.5 w-28 text-right">Cost Rate</th>
              <th class="py-2.5 px-3.5 w-32 text-right">Revenue (₹)</th>
              <th class="py-2.5 px-3.5 w-32 text-right">Profit Contribution (₹)</th>
              <th class="py-2.5 px-3.5 w-24 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
            <tr v-for="(item, idx) in watchlist.stars" :key="idx" class="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
              <td class="py-2 px-3.5 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
              <td class="py-2 px-3.5 font-bold text-slate-900 dark:text-white">{{ item.itemName }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-bold">{{ formatNumber(item.totalBilledQty) }} {{ item.unit }}</td>
              <td class="py-2 px-3.5 text-right font-mono text-slate-900 dark:text-white">{{ formatCurrency(item.avgSellingRate) }}</td>
              <td class="py-2 px-3.5 text-right font-mono text-slate-500">{{ formatCurrency(item.avgPurchaseRate) }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(item.totalRevenue) }}</td>
              <td class="py-2 px-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">{{ formatCurrency(item.totalMargin) }}</td>
              <td class="py-2 px-3.5 text-right font-mono">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                  {{ item.marginPct }}%
                </span>
              </td>
            </tr>
            <tr v-if="watchlist.stars.length === 0">
              <td colspan="8" class="py-8 text-center text-slate-400 italic">No star items with margin ≥ 30% found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DaybookStockSummary } from '@/utils/daybook-parser';

defineProps<{
  watchlist: {
    stars: DaybookStockSummary[];
    stable: DaybookStockSummary[];
    low: DaybookStockSummary[];
    negative: DaybookStockSummary[];
  };
}>();

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
