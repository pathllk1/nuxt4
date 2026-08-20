<template>
  <div class="space-y-4">
    <!-- Controls Strip -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs">
      <div class="flex flex-wrap items-center gap-3 flex-1">
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search party name, GSTIN..."
          class="w-full sm:w-72"
          size="sm"
        />

        <USelect
          v-model="sortBy"
          :items="[
            { label: 'Sort: Highest Spend (₹)', value: 'AMOUNT' },
            { label: 'Sort: Highest Margin (₹)', value: 'MARGIN' },
            { label: 'Sort: Invoices Count', value: 'INVOICES' },
            { label: 'Sort: Party Name', value: 'NAME' }
          ]"
          class="w-52"
          size="sm"
        />
      </div>

      <div class="text-xs text-slate-500 font-medium">
        Showing <span class="font-bold text-slate-900 dark:text-white">{{ filteredList.length }}</span> of {{ parties.length }} parties
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            <tr>
              <th class="py-3 px-3 w-10 text-center"></th>
              <th class="py-3 px-3 w-10 text-center">#</th>
              <th class="py-3 px-3.5 min-w-56">Customer / Party Name</th>
              <th class="py-3 px-3.5 w-36">GSTIN</th>
              <th class="py-3 px-3.5 w-20 text-center">Invoices</th>
              <th class="py-3 px-3.5 w-24 text-right">Total Units</th>
              <th class="py-3 px-3.5 w-32 text-right">Total Spend (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Total Cost (₹)</th>
              <th class="py-3 px-3.5 w-32 text-right">Gross Margin (₹)</th>
              <th class="py-3 px-3.5 w-28 text-right">Margin %</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
            <template v-for="(party, idx) in filteredList" :key="idx">
              <tr
                class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 transition-colors cursor-pointer"
                :class="[
                  expandedParties.has(party.partyName) ? 'bg-primary-50/30 dark:bg-primary-950/20' : (idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-850/20' : '')
                ]"
                @click="toggleParty(party.partyName)"
              >
                <td class="py-2.5 px-3 text-center text-slate-400">
                  <UIcon
                    :name="expandedParties.has(party.partyName) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                    class="w-4 h-4 text-slate-400 transition-transform"
                  />
                </td>
                <td class="py-2.5 px-3 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
                <td class="py-2.5 px-3.5 font-bold text-slate-900 dark:text-white">{{ party.partyName }}</td>
                <td class="py-2.5 px-3.5 font-mono text-[11px]">
                  <span v-if="party.gstin" class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 font-bold">
                    {{ party.gstin }}
                  </span>
                  <span v-else class="text-slate-400 italic">Unregistered / Cash</span>
                </td>
                <td class="py-2.5 px-3.5 text-center">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                    {{ party.voucherCount }}
                  </span>
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                  {{ formatNumber(party.totalQty) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                  {{ formatCurrency(party.totalAmount) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono text-slate-500 dark:text-zinc-400">
                  {{ formatCurrency(party.totalCost) }}
                </td>
                <td
                  class="py-2.5 px-3.5 text-right font-mono font-black"
                  :class="party.totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                >
                  {{ formatCurrency(party.totalMargin) }}
                </td>
                <td class="py-2.5 px-3.5 text-right font-mono">
                  <span
                    class="px-2 py-0.5 rounded-full text-[10px] font-black"
                    :class="[
                      party.marginPct >= 30 ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                      party.marginPct >= 10 ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300' :
                      party.marginPct >= 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                      'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                    ]"
                  >
                    {{ party.marginPct }}%
                  </span>
                </td>
              </tr>

              <!-- Items Breakdown -->
              <tr v-if="expandedParties.has(party.partyName)" class="bg-slate-100/50 dark:bg-zinc-950/40">
                <td colspan="10" class="p-3 pl-12">
                  <div class="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
                    <table class="w-full text-left text-[11px]">
                      <thead class="bg-slate-50 dark:bg-zinc-850 text-[9px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-zinc-800">
                        <tr>
                          <th class="py-2 px-3">Item Purchased</th>
                          <th class="py-2 px-3 w-28 text-right">Quantity</th>
                          <th class="py-2 px-3 w-32 text-right">Amount (₹)</th>
                          <th class="py-2 px-3 w-32 text-right">Margin Contribution (₹)</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                        <tr v-for="(itm, itmIdx) in party.itemsList" :key="itmIdx" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                          <td class="py-1.5 px-3 font-bold text-slate-800 dark:text-zinc-200">{{ itm.itemName }}</td>
                          <td class="py-1.5 px-3 text-right font-mono">{{ itm.qty }} {{ itm.unit }}</td>
                          <td class="py-1.5 px-3 text-right font-mono font-bold">{{ formatCurrency(itm.amount) }}</td>
                          <td
                            class="py-1.5 px-3 text-right font-mono font-bold"
                            :class="itm.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'"
                          >
                            {{ formatCurrency(itm.margin) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>

            <tr v-if="filteredList.length === 0">
              <td colspan="10" class="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                No parties found matching search criteria.
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
import type { DaybookPartySummary } from '@/utils/daybook-parser';

const props = defineProps<{
  parties: DaybookPartySummary[];
}>();

const searchQuery = ref('');
const sortBy = ref('AMOUNT');
const expandedParties = ref<Set<string>>(new Set());

const filteredList = computed(() => {
  let list = [...props.parties];
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter((p) => p.partyName.toLowerCase().includes(q) || p.gstin.toLowerCase().includes(q));
  }

  if (sortBy.value === 'AMOUNT') {
    list.sort((a, b) => b.totalAmount - a.totalAmount);
  } else if (sortBy.value === 'MARGIN') {
    list.sort((a, b) => b.totalMargin - a.totalMargin);
  } else if (sortBy.value === 'INVOICES') {
    list.sort((a, b) => b.voucherCount - a.voucherCount);
  } else if (sortBy.value === 'NAME') {
    list.sort((a, b) => a.partyName.localeCompare(b.partyName));
  }

  return list;
});

function toggleParty(name: string) {
  if (expandedParties.value.has(name)) {
    expandedParties.value.delete(name);
  } else {
    expandedParties.value.add(name);
  }
}

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
