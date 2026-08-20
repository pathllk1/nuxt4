<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
    <!-- 1. Taxable Turnover -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-blue-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">Taxable Turnover</span>
        <UIcon name="i-heroicons-banknotes" class="w-3.5 h-3.5 text-blue-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-slate-900 dark:text-white leading-tight">
          {{ formatCurrency(data.summary.totalRevenue) }}
        </p>
        <p class="text-[9px] text-slate-400 leading-none mt-0.5">Excl. taxes</p>
      </div>
    </div>

    <!-- 2. GST Tax (CGST + SGST + IGST) -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-indigo-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">GST Tax Output</span>
        <UIcon name="i-heroicons-document-currency-rupee" class="w-3.5 h-3.5 text-indigo-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400 leading-tight">
          {{ formatCurrency(data.summary.totalGstTax) }}
        </p>
        <div class="flex items-center gap-1 text-[8px] text-slate-400 font-mono mt-0.5 leading-none">
          <span v-if="data.summary.totalCgst > 0">C+S: {{ formatCurrency(data.summary.totalCgst * 2) }}</span>
          <span v-if="data.summary.totalIgst > 0">• I: {{ formatCurrency(data.summary.totalIgst) }}</span>
        </div>
      </div>
    </div>

    <!-- 3. Total Bill Value (Grand Total with Tax) -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-teal-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">Bill Grand Total</span>
        <UIcon name="i-heroicons-receipt-percent" class="w-3.5 h-3.5 text-teal-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-teal-600 dark:text-teal-400 leading-tight">
          {{ formatCurrency(data.summary.totalBillValue) }}
        </p>
        <p class="text-[9px] text-slate-400 leading-none mt-0.5">Tax-inclusive value</p>
      </div>
    </div>

    <!-- 4. COGS Cost -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-rose-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">COGS Cost</span>
        <UIcon name="i-heroicons-shopping-cart" class="w-3.5 h-3.5 text-rose-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-slate-900 dark:text-white leading-tight">
          {{ formatCurrency(data.summary.totalCost) }}
        </p>
        <p class="text-[9px] text-slate-400 leading-none mt-0.5">Inventory cost</p>
      </div>
    </div>

    <!-- 5. Gross Profit & Margin % -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-emerald-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">Gross Margin</span>
        <UIcon name="i-heroicons-arrow-trending-up" class="w-3.5 h-3.5 text-emerald-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight">
          {{ formatCurrency(data.summary.totalGrossMargin) }}
        </p>
        <p class="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 leading-none mt-0.5">
          {{ data.summary.overallMarginPct }}% margin
        </p>
      </div>
    </div>

    <!-- 6. Vouchers & GSTR-1 Status -->
    <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-2xs border-l-3 border-l-purple-500 flex flex-col justify-between">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">Invoices & Filing</span>
        <UIcon name="i-heroicons-document-duplicate" class="w-3.5 h-3.5 text-purple-500" />
      </div>
      <div class="mt-1">
        <p class="text-sm font-black font-mono text-slate-900 dark:text-white leading-tight">
          {{ data.summary.totalVouchers }} Bills
        </p>
        <p v-if="data.reconciliation.hasGstr1" class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 leading-none mt-0.5">
          ✓ GSTR-1 Verified
        </p>
        <p v-else class="text-[9px] text-slate-400 leading-none mt-0.5">
          {{ data.summary.uniqueParties }} customers
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DaybookParsedData } from '@/utils/daybook-parser';

defineProps<{
  data: DaybookParsedData;
}>();

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
