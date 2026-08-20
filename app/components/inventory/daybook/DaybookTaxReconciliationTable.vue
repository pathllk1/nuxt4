<template>
  <div class="space-y-6">
    <!-- Notice if GSTR-1 not uploaded -->
    <div v-if="!reconciliation.hasGstr1" class="p-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-center space-y-2">
      <UIcon name="i-heroicons-information-circle" class="w-10 h-10 text-amber-500 mx-auto" />
      <h3 class="font-bold text-amber-900 dark:text-amber-200 text-sm">GSTR-1 JSON Not Uploaded</h3>
      <p class="text-xs text-amber-700 dark:text-amber-300 max-w-md mx-auto leading-relaxed">
        Upload your statutory GSTR-1 JSON alongside the Excel file to automatically cross-verify and reconcile filed B2B invoices, retail B2CS taxes, and statutory variance.
      </p>
    </div>

    <template v-else>
      <!-- Reconciliation Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <!-- Books (DayBook Excel) Output Tax -->
        <div class="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-blue-500">
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Books GST Tax Liability</p>
          <p class="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
            {{ formatCurrency(data.summary.totalGstTax) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">Calculated from DayBook vouchers</p>
        </div>

        <!-- Returns (GSTR-1 JSON) Output Tax -->
        <div class="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-indigo-500">
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">GSTR-1 Filed Return Tax</p>
          <p class="text-base font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
            {{ formatCurrency(reconciliation.totalGstr1Tax) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">B2B ({{ formatCurrency(reconciliation.totalGstr1Tax - reconciliation.b2csRetailTax) }}) + B2CS ({{ formatCurrency(reconciliation.b2csRetailTax) }})</p>
        </div>

        <!-- Net Variance -->
        <div
          class="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4"
          :class="Math.abs(reconciliation.taxVariance) < 5 ? 'border-l-emerald-500' : 'border-l-rose-500'"
        >
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tax Difference / Variance</p>
          <p
            class="text-base font-black font-mono mt-1"
            :class="Math.abs(reconciliation.taxVariance) < 5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
          >
            {{ formatCurrency(reconciliation.taxVariance) }}
          </p>
          <p class="text-[10px] font-bold mt-0.5" :class="Math.abs(reconciliation.taxVariance) < 5 ? 'text-emerald-600' : 'text-rose-600'">
            {{ Math.abs(reconciliation.taxVariance) < 5 ? '✓ Clean Statutory Match' : '⚠️ Variance detected' }}
          </p>
        </div>

        <!-- B2B Match Rate -->
        <div class="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-4 border-l-teal-500">
          <p class="text-[10px] font-black uppercase text-slate-400 tracking-wider">B2B Invoices Matched</p>
          <p class="text-base font-black font-mono text-slate-900 dark:text-white mt-1">
            {{ reconciliation.b2bMatchedCount }} / {{ reconciliation.b2bInvoicesCount }}
          </p>
          <p class="text-[10px] text-slate-400 mt-0.5">
            {{ reconciliation.unfiledInvoicesCount }} unfiled • {{ reconciliation.b2bMismatchCount }} mismatches
          </p>
        </div>
      </div>

      <!-- Discrepancy & Variance Matrix -->
      <div class="space-y-2">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
          <span>📋 Invoice-Level Statutory Reconciliation List</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 dark:bg-zinc-800">
            {{ reconciliation.discrepancies.length }} Discrepancies
          </span>
        </h3>

        <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
          <table class="w-full text-left text-xs border-collapse">
            <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
              <tr>
                <th class="py-3 px-3.5 w-10 text-center">#</th>
                <th class="py-3 px-3.5 w-24">Voucher #</th>
                <th class="py-3 px-3.5 min-w-44">Party Name</th>
                <th class="py-3 px-3.5 min-w-56">Discrepancy Details</th>
                <th class="py-3 px-3.5 w-28 text-right">DayBook Taxable</th>
                <th class="py-3 px-3.5 w-28 text-right">GSTR-1 Taxable</th>
                <th class="py-3 px-3.5 w-28 text-right">DayBook Tax</th>
                <th class="py-3 px-3.5 w-28 text-right">GSTR-1 Tax</th>
                <th class="py-3 px-3.5 w-24 text-right">Variance</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
              <tr v-for="(item, idx) in reconciliation.discrepancies" :key="idx" class="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40">
                <td class="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
                <td class="py-2.5 px-3.5 font-mono font-bold text-primary">{{ item.voucherNumber }}</td>
                <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">{{ item.partyName }}</td>
                <td class="py-2.5 px-3.5 text-[11px] text-slate-600 dark:text-zinc-300">
                  <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    {{ item.issue }}
                  </span>
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono">{{ formatCurrency(item.bookTaxable) }}</td>
                <td class="py-2.5 px-3.5 text-right font-mono text-slate-500">{{ formatCurrency(item.gstr1Taxable) }}</td>
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(item.bookTax) }}</td>
                <td class="py-2.5 px-3.5 text-right font-mono text-indigo-600 font-bold">{{ formatCurrency(item.gstr1Tax) }}</td>
                <td class="py-2.5 px-3.5 text-right font-mono font-black text-rose-600">
                  {{ formatCurrency(item.bookTax - item.gstr1Tax) }}
                </td>
              </tr>

              <tr v-if="reconciliation.discrepancies.length === 0">
                <td colspan="9" class="py-12 text-center text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  🎉 Perfect Reconciliation! All DayBook registered vouchers match 100% with GSTR-1 filed returns.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { DaybookParsedData, Gstr1Reconciliation } from '@/utils/daybook-parser';

defineProps<{
  data: DaybookParsedData;
  reconciliation: Gstr1Reconciliation;
}>();

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
