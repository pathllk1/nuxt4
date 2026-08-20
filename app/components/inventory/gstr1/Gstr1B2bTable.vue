<template>
  <div class="space-y-4">
    <!-- Header Controls -->
    <div class="bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs font-bold text-slate-500 dark:text-zinc-400">
          Total Invoices: <span class="font-mono text-primary font-black">{{ data.b2bInvoices.length }}</span>
        </span>
        <span class="text-slate-300 dark:text-zinc-700">|</span>
        <span class="text-xs font-bold text-slate-500 dark:text-zinc-400">
          Unique Buyers: <span class="font-mono text-slate-900 dark:text-white font-black">{{ data.summary.uniqueB2bBuyers }}</span>
        </span>
      </div>

      <!-- Search Input -->
      <div class="w-72">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search GSTIN, Invoice #, Date..."
          size="sm"
          class="w-full"
        />
      </div>
    </div>

    <!-- B2B Invoices Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse divide-y divide-slate-100 dark:divide-zinc-800">
          <thead class="bg-slate-50/90 dark:bg-zinc-850/90 sticky top-0 z-10">
            <tr class="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
              <th class="py-3 px-3.5 w-10 text-center"></th>
              <th class="py-3 px-3.5 w-12 text-center">#</th>
              <th class="py-3 px-3.5 w-40">Recipient GSTIN</th>
              <th class="py-3 px-3.5 w-28">Invoice No</th>
              <th class="py-3 px-3.5 w-24">Date</th>
              <th class="py-3 px-3.5 w-16 text-center">POS</th>
              <th class="py-3 px-3.5 w-20 text-center">RCHRG</th>
              <th class="py-3 px-3.5 w-28 text-right">Taxable (₹)</th>
              <th class="py-3 px-3.5 w-24 text-right">CGST (₹)</th>
              <th class="py-3 px-3.5 w-24 text-right">SGST (₹)</th>
              <th class="py-3 px-3.5 w-28 text-right">Total Tax (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Invoice Value (₹)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium text-slate-700 dark:text-zinc-300">
            <template v-for="(inv, idx) in filteredInvoices" :key="`${inv.ctin}_${inv.inum}_${idx}`">
              <tr
                class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                :class="{ 'bg-slate-50/30 dark:bg-zinc-850/20': idx % 2 === 1 }"
                @click="toggleExpand(inv.inum)"
              >
                <td class="py-2.5 px-2 text-center text-slate-400">
                  <UIcon
                    :name="expandedInvoices.has(inv.inum) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                    class="w-4 h-4 transition-transform"
                  />
                </td>
                <td class="py-2.5 px-3.5 text-center text-slate-400 font-mono text-[10px]">
                  {{ idx + 1 }}
                </td>
                <td class="py-2.5 px-3.5 font-mono font-bold text-slate-900 dark:text-white">
                  {{ inv.ctin }}
                </td>
                <td class="py-2.5 px-3.5 font-mono font-bold text-primary">
                  {{ inv.inum }}
                </td>
                <td class="py-2.5 px-3.5 font-mono text-slate-500 text-[11px]">
                  {{ inv.idt }}
                </td>
                <td class="py-2.5 px-3.5 text-center font-mono font-bold">
                  {{ inv.pos }}
                </td>
                <td class="py-2.5 px-3.5 text-center">
                  <span
                    class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
                    :class="inv.rchrg === 'Y' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400'"
                  >
                    {{ inv.rchrg }}
                  </span>
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                  {{ formatCurrency(inv.totalTaxable) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                  {{ formatCurrency(inv.totalCgst) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono text-slate-600 dark:text-zinc-400">
                  {{ formatCurrency(inv.totalSgst) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-purple-600 dark:text-purple-400">
                  {{ formatCurrency(inv.totalTax) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono font-black text-slate-900 dark:text-white">
                  {{ formatCurrency(inv.val) }}
                </td>
              </tr>

              <!-- Expandable Line Items Details Sub-table -->
              <tr v-if="expandedInvoices.has(inv.inum)" class="bg-primary-50/20 dark:bg-primary-950/10">
                <td colspan="12" class="p-3 pl-12">
                  <div class="rounded-xl border border-primary-200/60 dark:border-primary-800/40 overflow-hidden bg-white dark:bg-zinc-900">
                    <div class="bg-primary-100/50 dark:bg-primary-950/40 px-3 py-1.5 flex items-center justify-between text-[10px] font-black text-primary-700 dark:text-primary-300 uppercase">
                      <span>Rate-wise Line Items for Invoice #{{ inv.inum }}</span>
                      <span>{{ inv.itms.length }} Line Slab(s)</span>
                    </div>
                    <table class="w-full text-xs text-left">
                      <thead class="bg-slate-50 dark:bg-zinc-800/50 text-[9px] uppercase font-bold text-slate-400">
                        <tr>
                          <th class="py-1.5 px-3">Item #</th>
                          <th class="py-1.5 px-3 text-center">GST Rate</th>
                          <th class="py-1.5 px-3 text-right">Taxable Value</th>
                          <th class="py-1.5 px-3 text-right">CGST</th>
                          <th class="py-1.5 px-3 text-right">SGST</th>
                          <th class="py-1.5 px-3 text-right">Total Line Value</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-mono text-[11px]">
                        <tr v-for="itm in inv.itms" :key="itm.num" class="hover:bg-slate-50/50">
                          <td class="py-1.5 px-3 text-slate-400">Item {{ itm.num }}</td>
                          <td class="py-1.5 px-3 text-center font-bold text-amber-600">{{ itm.itm_det.rt }}%</td>
                          <td class="py-1.5 px-3 text-right font-bold">{{ formatCurrency(itm.itm_det.txval) }}</td>
                          <td class="py-1.5 px-3 text-right text-slate-600 dark:text-zinc-400">{{ formatCurrency(itm.itm_det.camt) }}</td>
                          <td class="py-1.5 px-3 text-right text-slate-600 dark:text-zinc-400">{{ formatCurrency(itm.itm_det.samt) }}</td>
                          <td class="py-1.5 px-3 text-right font-black text-slate-900 dark:text-white">
                            {{ formatCurrency(itm.itm_det.txval + itm.itm_det.camt + itm.itm_det.samt) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>

            <tr v-if="filteredInvoices.length === 0">
              <td colspan="12" class="py-16 text-center text-slate-400 dark:text-zinc-500 italic">
                No B2B invoices match your search.
              </td>
            </tr>
          </tbody>

          <!-- Table Grand Totals -->
          <tfoot v-if="filteredInvoices.length > 0" class="bg-slate-50/90 dark:bg-zinc-850/90 font-black border-t-2 border-slate-200 dark:border-zinc-700">
            <tr>
              <td colspan="7" class="py-3 px-3.5 text-right uppercase text-slate-600 dark:text-zinc-400 text-[10px]">
                Total ({{ filteredInvoices.length }} Invoices):
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(totalTaxable) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalCgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-700 dark:text-zinc-300">
                {{ formatCurrency(totalSgst) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-purple-600 dark:text-purple-400">
                {{ formatCurrency(totalTax) }}
              </td>
              <td class="py-3 px-3.5 text-right font-mono text-slate-900 dark:text-white">
                {{ formatCurrency(totalValue) }}
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
const expandedInvoices = ref<Set<string>>(new Set());

function toggleExpand(inum: string) {
  if (expandedInvoices.value.has(inum)) {
    expandedInvoices.value.delete(inum);
  } else {
    expandedInvoices.value.add(inum);
  }
}

const filteredInvoices = computed(() => {
  const list = props.data.b2bInvoices || [];
  if (!searchQuery.value.trim()) return list;

  const q = searchQuery.value.toLowerCase().trim();
  return list.filter(i =>
    i.ctin.toLowerCase().includes(q) ||
    i.inum.toLowerCase().includes(q) ||
    i.idt.toLowerCase().includes(q) ||
    i.pos.toLowerCase().includes(q)
  );
});

const totalTaxable = computed(() => filteredInvoices.value.reduce((s, i) => s + i.totalTaxable, 0));
const totalCgst = computed(() => filteredInvoices.value.reduce((s, i) => s + i.totalCgst, 0));
const totalSgst = computed(() => filteredInvoices.value.reduce((s, i) => s + i.totalSgst, 0));
const totalTax = computed(() => filteredInvoices.value.reduce((s, i) => s + i.totalTax, 0));
const totalValue = computed(() => filteredInvoices.value.reduce((s, i) => s + i.val, 0));

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
