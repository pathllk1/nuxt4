<template>
  <div class="space-y-4">
    <!-- Header Banner -->
    <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
          Documents Issued Summary
        </h3>
        <p class="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
          Sequence of tax invoices, credit notes, and debit notes issued during the tax period.
        </p>
      </div>
      <div class="flex items-center gap-4">
        <div class="text-right">
          <p class="text-[10px] font-black uppercase text-slate-400">Total Issued</p>
          <p class="text-base font-black font-mono text-primary">{{ data.summary.totalDocsIssued }}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] font-black uppercase text-slate-400">Cancelled</p>
          <p class="text-base font-black font-mono text-rose-500">{{ data.summary.totalDocsCancelled }}</p>
        </div>
        <div class="text-right">
          <p class="text-[10px] font-black uppercase text-slate-400">Net Invoices</p>
          <p class="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{{ data.summary.netDocsIssued }}</p>
        </div>
      </div>
    </div>

    <!-- Docs Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse divide-y divide-slate-100 dark:divide-zinc-800">
          <thead class="bg-slate-50/90 dark:bg-zinc-850/90 sticky top-0 z-10">
            <tr class="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-3 px-3.5 w-12 text-center">#</th>
              <th class="py-3 px-3.5">Nature of Document</th>
              <th class="py-3 px-3.5 w-28 text-center">From Serial No</th>
              <th class="py-3 px-3.5 w-28 text-center">To Serial No</th>
              <th class="py-3 px-3.5 w-28 text-right">Total Number</th>
              <th class="py-3 px-3.5 w-28 text-right">Cancelled</th>
              <th class="py-3 px-3.5 w-32 text-right">Net Issued</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
            <tr
              v-for="(doc, idx) in data.docIssue"
              :key="idx"
              class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors"
              :class="{ 'bg-slate-50/30 dark:bg-zinc-850/20': idx % 2 === 1 }"
            >
              <td class="py-3 px-3.5 text-center text-slate-400 font-mono text-[10px]">
                {{ idx + 1 }}
              </td>
              <td class="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                {{ doc.doc_name || 'Invoices for outward supply' }}
              </td>
              <td class="py-3 px-3.5 text-center font-mono font-bold text-primary">
                {{ doc.from }}
              </td>
              <td class="py-3 px-3.5 text-center font-mono font-bold text-primary">
                {{ doc.to }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                {{ doc.totnum }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-bold text-rose-500">
                {{ doc.cancel }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                {{ doc.net_issue }}
              </td>
            </tr>

            <tr v-if="data.docIssue.length === 0">
              <td colspan="7" class="py-16 text-center text-slate-400 dark:text-zinc-500 italic">
                No document issue records found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Gstr1ParsedData } from '~/utils/gstr1-parser';

defineProps<{
  data: Gstr1ParsedData;
}>();
</script>
