<template>
  <div class="space-y-4">
    <!-- UQC Units Dispatched Strip -->
    <div class="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
          Stock Movement by Unit of Measurement (UQC)
        </span>
        <span class="text-xs font-bold text-slate-500 dark:text-zinc-400">
          Total Dispatched: <span class="font-mono text-emerald-600 dark:text-emerald-400 font-black">{{ formatNumber(totalDispatchedUnits) }}</span>
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div
          v-for="(uqcData, uqcName) in data.uqcDistribution"
          :key="uqcName"
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-800/80 border border-slate-200/70 dark:border-zinc-700/60"
        >
          <span class="text-xs font-black text-slate-700 dark:text-zinc-300 uppercase">{{ uqcName }}</span>
          <span class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ formatNumber(uqcData.qty) }}</span>
          <span class="text-[10px] text-slate-400 dark:text-zinc-500">({{ formatCurrency(uqcData.taxable) }})</span>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
      <!-- Slicing Buttons -->
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="f in filterOptions"
          :key="f.id"
          type="button"
          class="px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
          :class="activeFilter === f.id ? 'bg-primary-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'"
          @click="activeFilter = f.id"
        >
          <span>{{ f.label }}</span>
          <span class="text-[9px] px-1.5 py-0.2 rounded-full font-black" :class="activeFilter === f.id ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300'">
            {{ f.count }}
          </span>
        </button>
      </div>

      <!-- Search Input -->
      <div class="w-72">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search HSN Code or Description..."
          size="sm"
          class="w-full"
        />
      </div>
    </div>

    <!-- HSN Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse divide-y divide-slate-100 dark:divide-zinc-800">
          <thead class="bg-slate-50/90 dark:bg-zinc-850/90 sticky top-0 z-10">
            <tr class="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-3 px-3.5 w-12 text-center">#</th>
              <th class="py-3 px-3.5 w-28">HSN Code</th>
              <th class="py-3 px-3.5">Commodity / Description</th>
              <th class="py-3 px-3.5 w-20 text-center">Unit</th>
              <th class="py-3 px-3.5 w-24 text-right">Quantity</th>
              <th class="py-3 px-3.5 w-16 text-center">Rate</th>
              <th class="py-3 px-3.5 w-28 text-right">Taxable Value</th>
              <th class="py-3 px-3.5 w-24 text-right">CGST</th>
              <th class="py-3 px-3.5 w-24 text-right">SGST</th>
              <th class="py-3 px-3.5 w-28 text-right">Total Tax</th>
              <th class="py-3 px-3.5 w-28 text-right">Total Invoiced</th>
              <th class="py-3 px-3.5 w-24 text-right">Share %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
            <tr
              v-for="(item, idx) in filteredItems"
              :key="`${item.hsn_sc}_${item.uqc}_${idx}`"
              class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
              :class="{ 'bg-slate-50/30 dark:bg-zinc-850/20': idx % 2 === 1 }"
            >
              <td class="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[10px]">
                {{ idx + 1 }}
              </td>
              <td class="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white">
                {{ item.hsn_sc }}
              </td>
              <td class="py-2.5 px-3.5">
                <div class="font-bold text-slate-800 dark:text-zinc-200 max-w-xs truncate" :title="item.description">
                  {{ item.description || getCommodityName(item.hsn_sc) }}
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span v-if="item.b2bQty > 0" class="text-[9px] px-1 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold">
                    B2B: {{ formatNumber(item.b2bQty) }}
                  </span>
                  <span v-if="item.b2cQty > 0" class="text-[9px] px-1 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-bold">
                    B2C: {{ formatNumber(item.b2cQty) }}
                  </span>
                </div>
              </td>
              <td class="py-2.5 px-3.5 text-center">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {{ item.uqc }}
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ formatNumber(item.totalQty) }}
              </td>
              <td class="py-2.5 px-3.5 text-center font-mono text-xs">
                <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                  {{ item.rates.join(', ') }}%
                </span>
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ formatCurrency(item.totalTaxable) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                {{ formatCurrency(item.totalCgst) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                {{ formatCurrency(item.totalSgst) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                {{ formatCurrency(item.totalTax) }}
              </td>
              <td class="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                {{ formatCurrency(item.totalValue) }}
              </td>
              <td class="py-2.5 px-3.5 text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <div class="w-12 bg-slate-200 dark:bg-zinc-700 rounded-full h-1.5 overflow-hidden">
                    <div class="bg-primary-600 h-1.5 rounded-full" :style="{ width: `${Math.min(100, item.percentageOfTotal * 3)}%` }"></div>
                  </div>
                  <span class="font-mono text-[10px] font-bold text-slate-600 dark:text-zinc-400">{{ item.percentageOfTotal }}%</span>
                </div>
              </td>
            </tr>

            <tr v-if="filteredItems.length === 0">
              <td colspan="12" class="py-16 text-center text-slate-400 dark:text-zinc-500 italic">
                No HSN items match your search criteria.
              </td>
            </tr>
          </tbody>

          <!-- Table Grand Totals -->
          <tfoot v-if="filteredItems.length > 0" class="bg-slate-50/90 dark:bg-zinc-850/90 font-black border-t-2 border-slate-200 dark:border-zinc-700">
            <tr>
              <td colspan="4" class="py-3 px-3.5 text-right uppercase text-slate-600 dark:text-zinc-400 text-[10px]">
                Total ({{ filteredItems.length }} HSN Lines):
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                {{ formatNumber(totalFilteredQty) }}
              </td>
              <td></td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(totalFilteredTaxable) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalFilteredCgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalFilteredSgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-purple-600 dark:text-purple-400">
                {{ formatCurrency(totalFilteredTax) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(totalFilteredValue) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300 text-[10px]">
                100%
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Gstr1ParsedData } from '~/utils/gstr1-parser';

const props = defineProps<{
  data: Gstr1ParsedData;
}>();

const searchQuery = ref('');
const activeFilter = ref<'ALL' | 'B2B' | 'B2C'>('ALL');

const totalDispatchedUnits = computed(() => {
  return props.data.summary.totalStockUnitsDispatched || 0;
});

const filterOptions = computed(() => [
  { id: 'ALL' as const, label: 'All Items', count: props.data.hsnSummaryByCode.length },
  { id: 'B2B' as const, label: 'B2B Supplies', count: props.data.hsnSummaryByCode.filter(i => i.b2bQty > 0).length },
  { id: 'B2C' as const, label: 'B2C Consumer Sales', count: props.data.hsnSummaryByCode.filter(i => i.b2cQty > 0).length }
]);

const filteredItems = computed(() => {
  let list = props.data.hsnSummaryByCode || [];

  if (activeFilter.value === 'B2B') {
    list = list.filter(i => i.b2bQty > 0);
  } else if (activeFilter.value === 'B2C') {
    list = list.filter(i => i.b2cQty > 0);
  }

  if (!searchQuery.value.trim()) return list;

  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(i =>
    i.hsn_sc.toLowerCase().includes(q) ||
    i.description.toLowerCase().includes(q) ||
    i.uqc.toLowerCase().includes(q)
  );
});

const totalFilteredQty = computed(() => filteredItems.value.reduce((s, i) => s + i.totalQty, 0));
const totalFilteredTaxable = computed(() => filteredItems.value.reduce((s, i) => s + i.totalTaxable, 0));
const totalFilteredCgst = computed(() => filteredItems.value.reduce((s, i) => s + i.totalCgst, 0));
const totalFilteredSgst = computed(() => filteredItems.value.reduce((s, i) => s + i.totalSgst, 0));
const totalFilteredTax = computed(() => filteredItems.value.reduce((s, i) => s + i.totalTax, 0));
const totalFilteredValue = computed(() => filteredItems.value.reduce((s, i) => s + i.totalValue, 0));

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatNumber(val: number = 0): string {
  return Number(val || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
}

function getCommodityName(hsn: string): string {
  const hsnPrefix = hsn.substring(0, 4);
  const commodityMap: Record<string, string> = {
    '3307': 'Perfumery / Odoriferous preparations',
    '3406': 'Candles & tapers',
    '3808': 'Disinfectants / Insecticides',
    '3921': 'Plastic Plates & Sheets',
    '3923': 'Plastic Articles for Packaging / Boxes',
    '3924': 'Tableware & Kitchenware of plastics',
    '4015': 'Gloves / Rubber apparel',
    '4411': 'Fibreboard of wood',
    '4421': 'Wooden Articles',
    '4803': 'Toilet or Facial tissue paper',
    '4807': 'Composite paper and paperboard',
    '4817': 'Envelopes & Letter cards',
    '4818': 'Toilet paper & Sanitary paper',
    '4819': 'Cartons, boxes & packing containers of paper',
    '4823': 'Other Paper, Paperboard, Cellulose',
    '5603': 'Nonwovens fabric',
    '5607': 'Twine, Cordage, Rope & Cables',
    '6305': 'Sacks and bags for packing goods',
    '7607': 'Aluminium Foil',
    '7615': 'Aluminium Table, Kitchen & Household articles',
    '9603': 'Brooms, Brushes & Mops',
    '0402': 'Milk and cream, concentrated',
    '1514': 'Rape, colza or mustard oil',
    '1518': 'Animal / vegetable fats & oils',
    '1701': 'Cane or beet sugar',
    '1806': 'Chocolate & food preparations containing cocoa',
    '1901': 'Malt extract / Flour preparations'
  };
  return commodityMap[hsnPrefix] || `Commodity (HSN ${hsn})`;
}
</script>
