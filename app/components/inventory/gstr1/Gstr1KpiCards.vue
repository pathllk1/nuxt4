<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
    <!-- Gross Turnover -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-blue-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Gross Turnover</p>
      <p class="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white mt-1 leading-tight">
        {{ formatCurrency(data.summary.grandTotalValue) }}
      </p>
      <p class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5 leading-none">
        B2B + B2C Total
      </p>
    </div>

    <!-- Taxable Outward Supplies -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-indigo-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Taxable Value</p>
      <p class="text-base sm:text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1 leading-tight">
        {{ formatCurrency(data.summary.grandTotalTaxable) }}
      </p>
      <p class="text-[9px] font-bold text-indigo-500 uppercase mt-0.5 leading-none">
        Base Amount
      </p>
    </div>

    <!-- Total GST Tax -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-purple-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Total GST Tax</p>
      <p class="text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400 mt-1 leading-tight">
        {{ formatCurrency(data.summary.grandTotalTax) }}
      </p>
      <p class="text-[9px] font-bold text-purple-500 uppercase mt-0.5 leading-none">
        CGST + SGST + IGST
      </p>
    </div>

    <!-- Total Units/Stock Dispatched -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-emerald-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Total Units Dispatched</p>
      <p class="text-base sm:text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 leading-tight">
        {{ formatQuantity(data.summary.totalStockUnitsDispatched) }}
      </p>
      <p class="text-[9px] font-bold text-emerald-500 uppercase mt-0.5 leading-none">
        Across {{ Object.keys(data.uqcDistribution).length }} UQCs
      </p>
    </div>

    <!-- B2B Invoices Count -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-amber-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">B2B Invoices</p>
      <p class="text-base sm:text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-1 leading-tight">
        {{ data.summary.totalB2bInvoices }}
      </p>
      <p class="text-[9px] font-bold text-amber-500 uppercase mt-0.5 leading-none">
        {{ data.summary.uniqueB2bBuyers }} Registered Buyers
      </p>
    </div>

    <!-- HSN Product Lines -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-teal-500">
      <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest leading-none">Unique HSN Codes</p>
      <p class="text-base sm:text-lg font-black font-mono text-teal-600 dark:text-teal-400 mt-1 leading-tight">
        {{ data.summary.uniqueHsnCount }}
      </p>
      <p class="text-[9px] font-bold text-teal-500 uppercase mt-0.5 leading-none">
        {{ data.summary.totalHsnLines }} Line Items
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Gstr1ParsedData } from '~/utils/gstr1-parser';

defineProps<{
  data: Gstr1ParsedData;
}>();

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatQuantity(qty: number = 0): string {
  return Number(qty || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2
  });
}
</script>
