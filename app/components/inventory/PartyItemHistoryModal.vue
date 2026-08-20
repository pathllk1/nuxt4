<template>
  <UModal
    :open="modelValue"
    @update:open="$emit('update:modelValue', $event)"
    :title="`Transaction History: ${itemTitle}`"
    :ui="{ content: 'w-full sm:max-w-4xl' }"
  >
    <template #body>
      <div
        class="space-y-4 text-xs outline-none"
        tabindex="0"
        @keydown.esc="$emit('update:modelValue', false)"
        @keydown.up.prevent="navigateRow(-1)"
        @keydown.down.prevent="navigateRow(1)"
        @keydown.enter.prevent="applySelectedRowRate"
      >
        <!-- Top Context Header -->
        <div class="bg-slate-50 dark:bg-zinc-800/80 p-3.5 rounded-2xl border border-slate-200/80 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500">
                {{ mode === 'purchase' ? 'Supplier' : 'Customer' }}:
              </span>
              <span class="font-bold text-slate-900 dark:text-white text-sm">
                {{ partyName || 'No Party Selected (Showing General Market History)' }}
              </span>
              <span v-if="partyGstin" class="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 font-bold">
                {{ partyGstin }}
              </span>
            </div>
            <div class="flex items-center gap-2 text-slate-500 dark:text-zinc-400 text-xs">
              <span class="font-bold text-primary">{{ itemTitle }}</span>
              <span v-if="historyData?.item?.hsn">| HSN: <span class="font-mono">{{ historyData.item.hsn }}</span></span>
              <span>| Current Stock: <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ historyData?.item?.currentStock ?? 0 }} {{ historyData?.item?.uom || 'PCS' }}</span></span>
              <span v-if="historyData?.item?.purchaseCost">| Cost: <span class="font-mono text-rose-600 dark:text-rose-400">{{ formatCurrency(historyData.item.purchaseCost) }}</span></span>
            </div>
          </div>

          <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded font-bold font-mono text-slate-700 dark:text-zinc-300">↑ / ↓</kbd> Navigate
            <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded font-bold font-mono text-slate-700 dark:text-zinc-300">Enter</kbd> Apply Rate
            <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded font-bold font-mono text-slate-700 dark:text-zinc-300">Esc</kbd> Close
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="py-12 text-center text-slate-400">
          <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin mx-auto text-primary" />
          <p class="text-xs uppercase tracking-widest font-black mt-2">Loading transaction history...</p>
        </div>

        <!-- Loaded Content -->
        <template v-else-if="historyData">
          <!-- KPI Summary Strip -->
          <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
            <!-- Last Billed Rate -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-blue-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">Last Billed Rate</p>
              <p class="text-sm font-black font-mono text-blue-600 dark:text-blue-400 mt-1 leading-none">
                {{ historyData.stats.lastBilledRate !== null ? formatCurrency(historyData.stats.lastBilledRate) : 'N/A' }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">
                {{ historyData.stats.lastSoldDate || 'No past sales' }}
              </p>
            </div>

            <!-- Min Rate -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-emerald-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">Lowest Rate</p>
              <p class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1 leading-none">
                {{ formatCurrency(historyData.stats.minRate) }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">Best price offered</p>
            </div>

            <!-- Max Rate -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-purple-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">Highest Rate</p>
              <p class="text-sm font-black font-mono text-purple-600 dark:text-purple-400 mt-1 leading-none">
                {{ formatCurrency(historyData.stats.maxRate) }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">Max billed</p>
            </div>

            <!-- Average Rate -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-amber-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">Average Rate</p>
              <p class="text-sm font-black font-mono text-amber-600 dark:text-amber-400 mt-1 leading-none">
                {{ formatCurrency(historyData.stats.avgRate) }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">Historical average</p>
            </div>

            <!-- Total Qty -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-teal-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">Lifetime Quantity</p>
              <p class="text-sm font-black font-mono text-teal-600 dark:text-teal-400 mt-1 leading-none">
                {{ historyData.stats.totalLifetimeQty }} {{ historyData.item.uom }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">
                {{ historyData.stats.totalInvoicesWithParty }} Bills
              </p>
            </div>

            <!-- Purchase Cost / Baseline -->
            <div class="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 shadow-xs border-l-3 border-l-rose-500">
              <p class="text-[9px] font-black uppercase text-slate-400 tracking-wider leading-none">
                {{ mode === 'purchase' ? 'Last Selling Rate' : 'Purchase Cost' }}
              </p>
              <p class="text-sm font-black font-mono text-rose-600 dark:text-rose-400 mt-1 leading-none">
                {{ formatCurrency(historyData.stats.lastReferenceCost) }}
              </p>
              <p class="text-[9px] text-slate-400 mt-0.5 leading-none">Margin baseline</p>
            </div>
          </div>

          <!-- Tab Selector -->
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 pb-2">
            <button
              type="button"
              class="px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              :class="activeTab === 'party' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
              @click="activeTab = 'party'; selectedRowIndex = 0"
            >
              <span>👤 Transactions with this Party</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white/20">
                {{ historyData.partyHistory.length }}
              </span>
            </button>

            <button
              type="button"
              class="px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              :class="activeTab === 'general' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
              @click="activeTab = 'general'; selectedRowIndex = 0"
            >
              <span>🌐 Recent Invoices (All Parties)</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white/20">
                {{ historyData.generalHistory.length }}
              </span>
            </button>

            <button
              type="button"
              class="px-3 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
              :class="activeTab === 'reference' ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 hover:bg-slate-200'"
              @click="activeTab = 'reference'; selectedRowIndex = 0"
            >
              <span>📦 {{ mode === 'purchase' ? 'Sales History' : 'Purchase Inward Cost' }}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-white/20">
                {{ historyData.referenceHistory.length }}
              </span>
            </button>
          </div>

          <!-- Transactions Table -->
          <div class="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden max-h-72 overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-slate-50 dark:bg-zinc-850 sticky top-0 z-10 text-[9px] uppercase font-bold text-slate-400">
                <tr>
                  <th class="py-2 px-3 w-8 text-center">#</th>
                  <th class="py-2 px-3 w-24">Date</th>
                  <th class="py-2 px-3 w-28">Bill No</th>
                  <th v-if="activeTab !== 'party'" class="py-2 px-3">Party Name</th>
                  <th class="py-2 px-3 w-16 text-center">Type</th>
                  <th class="py-2 px-3 w-20 text-right">Qty</th>
                  <th class="py-2 px-3 w-24 text-right">Unit Rate (₹)</th>
                  <th class="py-2 px-3 w-16 text-center">Disc %</th>
                  <th class="py-2 px-3 w-24 text-right">Net Rate (₹)</th>
                  <th class="py-2 px-3 w-28 text-right">Total (₹)</th>
                  <th class="py-2 px-3 w-24 text-center">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                <tr
                  v-for="(row, idx) in currentList"
                  :key="`${row.billId || ''}_${idx}`"
                  class="transition-colors cursor-pointer"
                  :class="getRowClass(Number(idx))"
                  @click="selectRow(Number(idx))"
                  @dblclick="applyRate(Number(row.rate || 0), Number(row.disc || 0))"
                >
                  <td class="py-2 px-3 text-center text-slate-400 font-mono text-[10px]">{{ Number(idx) + 1 }}</td>
                  <td class="py-2 px-3 font-mono text-slate-600 dark:text-zinc-400 text-[11px] whitespace-nowrap">{{ row.bdate }}</td>
                  <td class="py-2 px-3 font-mono font-bold text-primary">{{ row.bno }}</td>
                  <td v-if="activeTab !== 'party'" class="py-2 px-3 font-bold text-slate-800 dark:text-zinc-200 truncate max-w-xs" :title="row.partyName">
                    {{ row.partyName }}
                  </td>
                  <td class="py-2 px-3 text-center">
                    <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      {{ row.btype }}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-right font-mono font-bold">{{ row.qty }} {{ row.uom }}</td>
                  <td class="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(row.rate) }}</td>
                  <td class="py-2 px-3 text-center font-mono">
                    <span v-if="row.disc > 0" class="text-emerald-600 font-bold">{{ row.disc }}%</span>
                    <span v-else class="text-slate-400">-</span>
                  </td>
                  <td class="py-2 px-3 text-right font-mono font-black text-emerald-600 dark:text-emerald-400">
                    {{ formatCurrency(row.netRate || row.rate) }}
                  </td>
                  <td class="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(row.total) }}</td>
                  <td class="py-2 px-3 text-center">
                    <UButton
                      color="primary"
                      size="xs"
                      label="Apply"
                      class="font-bold text-[10px] h-6 px-2"
                      @click.stop="applyRate(Number(row.rate || 0), Number(row.disc || 0))"
                    />
                  </td>
                </tr>

                <tr v-if="currentList.length === 0">
                  <td :colspan="activeTab !== 'party' ? 11 : 10" class="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                    No past transaction records found for this criteria.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <span class="text-[11px] text-slate-500">
          Double-click any row or press <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 rounded font-bold font-mono text-slate-800 dark:text-white">Enter</kbd> to apply price & discount to current cart row.
        </span>
        <UButton
          color="neutral"
          variant="outline"
          label="Close (Esc)"
          size="sm"
          class="font-bold text-xs"
          @click="$emit('update:modelValue', false)"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

export interface HistoryRow {
  billId?: string;
  bno: string;
  bdate: string;
  btype: string;
  partyName?: string;
  item?: string;
  hsn?: string;
  qty: number;
  uom: string;
  rate: number;
  disc: number;
  netRate: number;
  gstRate?: number;
  total: number;
  batch?: string;
}

const props = defineProps<{
  modelValue: boolean;
  partyId?: string;
  partyName?: string;
  partyGstin?: string;
  stockId?: string;
  itemName?: string;
  mode?: 'sales' | 'purchase';
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  'apply-rate': [{ rate: number; disc: number }];
}>();

const loading = ref(false);
const historyData = ref<any>(null);
const activeTab = ref<'party' | 'general' | 'reference'>('party');
const selectedRowIndex = ref(0);

const itemTitle = computed<string>(() => {
  return props.itemName || historyData.value?.item?.name || 'Selected Item';
});

const currentList = computed<HistoryRow[]>(() => {
  if (!historyData.value) return [];
  if (activeTab.value === 'party') return historyData.value.partyHistory || [];
  if (activeTab.value === 'general') return historyData.value.generalHistory || [];
  return historyData.value.referenceHistory || [];
});

watch(
  () => props.modelValue,
  async (isOpen) => {
    if (isOpen) {
      await fetchHistory();
    }
  }
);

async function fetchHistory() {
  if (!props.stockId && !props.itemName) return;
  loading.value = true;
  selectedRowIndex.value = 0;
  try {
    const query = new URLSearchParams();
    if (props.partyId) query.append('partyId', props.partyId);
    if (props.stockId) query.append('stockId', props.stockId);
    if (props.itemName) query.append('itemName', props.itemName);
    if (props.mode) query.append('mode', props.mode);

    const res = await $fetch<any>(`/api/inventory/party-item-history?${query.toString()}`);
    if (res.success && res.data) {
      historyData.value = res.data;
      if (!props.partyId || res.data.partyHistory.length === 0) {
        if (res.data.generalHistory.length > 0) {
          activeTab.value = 'general';
        }
      } else {
        activeTab.value = 'party';
      }
    }
  } catch (err: any) {
    console.error('Failed to load party item history:', err);
  } finally {
    loading.value = false;
  }
}

function selectRow(idx: number | string) {
  selectedRowIndex.value = Number(idx);
}

function getRowClass(idx: number | string): string {
  const numIdx = Number(idx);
  if (selectedRowIndex.value === numIdx) {
    return 'bg-primary-50 dark:bg-primary-950/40 ring-1 ring-primary-500';
  }
  return numIdx % 2 === 1
    ? 'bg-slate-50/30 dark:bg-zinc-850/20 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40'
    : 'hover:bg-slate-50/60 dark:hover:bg-zinc-800/40';
}

function navigateRow(direction: number) {
  const list = currentList.value;
  if (!list.length) return;
  const nextIdx = selectedRowIndex.value + direction;
  if (nextIdx >= 0 && nextIdx < list.length) {
    selectedRowIndex.value = nextIdx;
  }
}

function applySelectedRowRate() {
  const list = currentList.value;
  const selected = list[selectedRowIndex.value];
  if (selected) {
    applyRate(Number(selected.rate || 0), Number(selected.disc || 0));
  }
}

function applyRate(rate: number, disc: number = 0) {
  emit('apply-rate', { rate, disc });
  emit('update:modelValue', false);
}

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
