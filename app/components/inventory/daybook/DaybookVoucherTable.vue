<template>
  <div class="space-y-3.5">
    <!-- Action Ribbon & Top Bar -->
    <div class="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 rounded-2xl border border-slate-100 dark:border-zinc-800 shadow-xs">
      <div class="flex flex-wrap items-center gap-2.5 flex-1">
        <!-- Search -->
        <UInput
          v-model="searchQuery"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search voucher #, party, GSTIN, HSN, item..."
          class="w-full sm:w-64"
          size="xs"
        />

        <!-- Filter Dropdown -->
        <USelect
          v-model="filterType"
          :items="[
            { label: 'All Vouchers', value: 'ALL' },
            { label: '✨ New Bills (Not in DB)', value: 'NEW_BILLS' },
            { label: '📋 Existing Bills (Saved in DB)', value: 'EXISTING_BILLS' },
            { label: '➕ New Parties (Not in DB)', value: 'NEW_PARTIES' },
            { label: '👤 Existing Parties in Master', value: 'EXISTING_PARTIES' },
            { label: 'Intra-State (CGST + SGST)', value: 'INTRA' },
            { label: 'Inter-State (IGST)', value: 'INTER' },
            { label: 'B2B Registered Invoices', value: 'B2B' },
            { label: 'B2C Cash / Retail', value: 'B2CS' },
            { label: 'GSTR-1 Mismatches', value: 'MISMATCH' }
          ]"
          class="w-52"
          size="xs"
        />

        <!-- Expand / Collapse All -->
        <UButton
          size="xs"
          variant="soft"
          color="neutral"
          :label="allExpanded ? 'Collapse Lines' : 'Expand Lines'"
          :icon="allExpanded ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
          class="font-bold cursor-pointer text-xs"
          @click="toggleExpandAll"
        />

        <!-- ⚡ Server Verification Button -->
        <UButton
          color="primary"
          size="xs"
          icon="i-heroicons-bolt"
          :label="isSyncing ? 'Verifying with DB & RapidAPI...' : (syncData ? 'Re-Sync with DB & GST Portal' : '⚡ Verify with DB & GST Portal')"
          :loading="isSyncing"
          class="font-black cursor-pointer shadow-xs"
          @click="triggerServerSync"
        />
      </div>

      <div class="text-xs text-slate-500 font-medium">
        Showing <span class="font-bold text-slate-900 dark:text-white font-mono">{{ filteredList.length }}</span> of {{ vouchers.length }} vouchers
      </div>
    </div>

    <!-- Sync Statistics & Quick Selection Bar (if synced) -->
    <div
      v-if="syncData"
      class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-slate-50 dark:bg-zinc-850/80 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 text-xs"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-slate-500 font-bold">Database Analysis:</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          ✨ {{ syncData.stats.newBillsCount }} New Bills
        </span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300">
          📋 {{ syncData.stats.existingBillsCount }} Already Saved
        </span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
          ➕ {{ syncData.stats.newPartiesCount }} New Parties
        </span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300">
          👤 {{ syncData.stats.existingPartiesCount }} Parties in Master
        </span>
      </div>

      <!-- Quick Batch Selectors -->
      <div class="flex items-center gap-1.5">
        <span class="text-[10px] text-slate-400 font-bold uppercase">Quick Select:</span>
        <button
          type="button"
          class="px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 cursor-pointer"
          @click="selectNewBillsOnly"
        >
          All New Bills ({{ syncData.stats.newBillsCount }})
        </button>
        <button
          type="button"
          class="px-2 py-0.5 text-[10px] font-bold rounded bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:bg-slate-300 cursor-pointer"
          @click="clearSelection"
        >
          Clear
        </button>
      </div>
    </div>

    <!-- Selected Vouchers Action Ribbon with 🚀 Post to ERP Button -->
    <div
      v-if="selectedVouchers.size > 0"
      class="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800 rounded-xl text-xs"
    >
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-check-circle" class="w-4 h-4 text-primary" />
        <span class="font-bold text-primary">
          {{ selectedVouchers.size }} voucher(s) selected
        </span>
        <span class="text-slate-400">•</span>
        <span class="text-slate-600 dark:text-zinc-300">
          Taxable: <strong class="font-mono">{{ formatCurrency(selectedTotals.taxable) }}</strong>
        </span>
        <span class="text-slate-400">•</span>
        <span class="text-slate-600 dark:text-zinc-300">
          Bill Total: <strong class="font-mono text-emerald-600 dark:text-emerald-400">{{ formatCurrency(selectedTotals.grandTotal) }}</strong>
        </span>
      </div>

      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          variant="outline"
          color="neutral"
          label="Deselect All"
          class="font-bold cursor-pointer text-[10px]"
          @click="clearSelection"
        />

        <!-- 🚀 Post to ERP Action Button -->
        <UButton
          color="primary"
          size="xs"
          icon="i-heroicons-rocket-launch"
          :label="`🚀 Post Selected to ERP (${selectedVouchers.size})`"
          class="font-black cursor-pointer shadow-xs text-xs"
          @click="showBatchPostModal = true"
        />
      </div>
    </div>

    <!-- Table -->
    <div class="rounded-2xl border border-slate-100 dark:border-zinc-800 overflow-hidden shadow-xs bg-white dark:bg-zinc-900">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse">
          <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-zinc-800">
            <tr>
              <th class="py-3 px-2 w-8 text-center">
                <input
                  type="checkbox"
                  class="rounded cursor-pointer text-primary focus:ring-primary w-3.5 h-3.5"
                  :checked="isAllSelected"
                  :indeterminate="isPartiallySelected"
                  @change="toggleSelectAll"
                />
              </th>
              <th class="py-3 px-1 w-6 text-center"></th>
              <th class="py-3 px-1.5 w-6 text-center">#</th>
              <th class="py-3 px-2.5 w-28">Voucher #</th>
              <th class="py-3 px-2.5 w-24">Date</th>
              <th class="py-3 px-3 min-w-48">Party Name</th>
              <th class="py-3 px-2.5 w-32">GSTIN & Supply</th>
              <th class="py-3 px-2.5 w-28 text-right">Taxable (₹)</th>
              <th class="py-3 px-2 w-16 text-right">CGST</th>
              <th class="py-3 px-2 w-16 text-right">SGST</th>
              <th class="py-3 px-2 w-16 text-right">IGST</th>
              <th class="py-3 px-2.5 w-24 text-right">Total Tax (₹)</th>
              <th class="py-3 px-2.5 w-28 text-right">Bill Total (₹)</th>
              <th class="py-3 px-2.5 w-20 text-right">Margin (₹)</th>
              <th class="py-3 px-2 w-20 text-center">GSTR-1</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
            <template v-for="(v, idx) in filteredList" :key="`${v.voucherNumber}_${idx}`">
              <!-- Voucher Master Row -->
              <tr
                class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/60 transition-colors"
                :class="[
                  selectedVouchers.has(v.voucherNumber) ? 'bg-primary-50/25 dark:bg-primary-950/20' : (idx % 2 === 1 ? 'bg-slate-50/30 dark:bg-zinc-850/20' : '')
                ]"
              >
                <!-- Checkbox -->
                <td class="py-2.5 px-2 text-center" @click.stop>
                  <input
                    type="checkbox"
                    class="rounded cursor-pointer text-primary focus:ring-primary w-3.5 h-3.5"
                    :checked="selectedVouchers.has(v.voucherNumber)"
                    @change="toggleVoucherSelection(v.voucherNumber)"
                  />
                </td>

                <!-- Accordion Chevron -->
                <td class="py-2.5 px-1 text-center text-slate-400 cursor-pointer" @click="toggleVoucher(v.voucherNumber)">
                  <UIcon
                    :name="expandedVouchers.has(v.voucherNumber) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'"
                    class="w-3.5 h-3.5 text-slate-400 transition-transform"
                  />
                </td>

                <!-- Row Number -->
                <td class="py-2.5 px-1.5 text-center text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>

                <!-- Voucher # & DB Bill Status -->
                <td class="py-2.5 px-2.5 cursor-pointer" @click="toggleVoucher(v.voucherNumber)">
                  <div class="font-mono font-bold text-primary">{{ v.voucherNumber }}</div>
                  <div v-if="syncData" class="mt-0.5">
                    <span
                      v-if="syncData.bills[v.voucherNumber]?.billExists"
                      class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300"
                      :title="`Saved in DB on ${syncData.bills[v.voucherNumber].bdate || ''}`"
                    >
                      📋 In DB
                    </span>
                    <span
                      v-else
                      class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                    >
                      ✨ New Bill
                    </span>
                  </div>
                </td>

                <!-- Date -->
                <td class="py-2.5 px-2.5 font-mono text-slate-600 dark:text-zinc-400 text-[11px]">{{ v.date }}</td>

                <!-- Party Name (with Verified GST Trade Name & Party Master Status) -->
                <td class="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                  <div class="flex items-center gap-1.5">
                    <!-- Display Verified Name if available, otherwise original party name -->
                    <span>{{ getVerifiedPartyName(v) }}</span>
                    
                    <!-- GST Active Indicator -->
                    <span
                      v-if="syncData?.parties[v.gstin]?.isGstVerified"
                      class="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      title="Verified with GST Portal"
                    />
                  </div>

                  <!-- Subtitle: Original Excel Name if different -->
                  <div
                    v-if="getVerifiedPartyName(v) !== v.partyName"
                    class="text-[10px] text-slate-400 font-normal italic mt-0.5"
                  >
                    Excel Name: {{ v.partyName }}
                  </div>

                  <!-- Party DB Status Badges -->
                  <div v-if="syncData && v.gstin" class="flex items-center gap-1.5 mt-1">
                    <span
                      v-if="syncData.parties[v.gstin]?.partyExists"
                      class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300"
                    >
                      👤 In Master
                    </span>
                    <span
                      v-else
                      class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                    >
                      ➕ New Party
                    </span>

                    <span v-if="syncData.parties[v.gstin]?.gstStatus === 'ACTIVE'" class="text-[8px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      • ACTIVE
                    </span>
                  </div>
                </td>

                <!-- GSTIN & Supply Type -->
                <td class="py-2.5 px-2.5 font-mono text-[10px]">
                  <div v-if="v.gstin" class="font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1">
                    <span>{{ v.gstin }}</span>
                    <span v-if="v.gstinValid === true" class="text-emerald-600 dark:text-emerald-400 font-black text-xs" title="Mod-36 Checksum Valid">✓</span>
                    <span v-else-if="v.gstinValid === false" class="text-rose-600 dark:text-rose-400 font-bold text-xs" :title="v.gstinMessage || 'Invalid Checksum'">⚠️</span>
                  </div>
                  <div v-else class="text-slate-400 italic">Unregistered</div>
                  <div class="mt-0.5 flex items-center gap-1 flex-wrap">
                    <span
                      class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase"
                      :class="v.supplyType === 'INTRA' ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300'"
                    >
                      {{ v.supplyType === 'INTRA' ? 'Intra (C+S)' : 'Inter (IGST)' }}
                    </span>
                    <span v-if="v.gstinState" class="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 truncate max-w-[120px]" :title="v.gstinState">
                      {{ v.gstinState }}
                    </span>
                  </div>
                </td>

                <!-- Taxable Turnover -->
                <td class="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                  {{ formatCurrency(v.totalAmount) }}
                </td>

                <!-- CGST -->
                <td class="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-zinc-400 text-[10px]">
                  {{ v.totalCgst > 0 ? formatCurrency(v.totalCgst) : '-' }}
                </td>

                <!-- SGST -->
                <td class="py-2.5 px-2 text-right font-mono text-slate-600 dark:text-zinc-400 text-[10px]">
                  {{ v.totalSgst > 0 ? formatCurrency(v.totalSgst) : '-' }}
                </td>

                <!-- IGST -->
                <td class="py-2.5 px-2 text-right font-mono text-purple-600 dark:text-purple-400 text-[10px] font-bold">
                  {{ v.totalIgst > 0 ? formatCurrency(v.totalIgst) : '-' }}
                </td>

                <!-- Total Tax -->
                <td class="py-2.5 px-2.5 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {{ formatCurrency(v.totalTax) }}
                </td>

                <!-- Bill Total (Rounded) -->
                <td class="py-2.5 px-2.5 text-right font-mono text-xs">
                  <div class="font-black text-slate-900 dark:text-white">
                    {{ formatCurrency(v.grandTotal) }}
                  </div>
                  <div v-if="v.roundOff && Math.abs(v.roundOff) > 0" class="text-[9px] font-mono font-medium text-slate-400">
                    R/O: {{ v.roundOff > 0 ? `+₹${v.roundOff.toFixed(2)}` : `-₹${Math.abs(v.roundOff).toFixed(2)}` }}
                  </div>
                </td>

                <!-- Margin -->
                <td
                  class="py-2.5 px-2.5 text-right font-mono font-bold"
                  :class="v.totalMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'"
                >
                  {{ formatCurrency(v.totalMargin) }}
                  <span class="text-[9px] block text-slate-400 font-normal">({{ v.marginPct }}%)</span>
                </td>

                <!-- GSTR-1 Status -->
                <td class="py-2.5 px-2 text-center">
                  <span
                    v-if="v.gstr1Status === 'MATCHED'"
                    class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300"
                    title="Matched with GSTR-1 Portal B2B return"
                  >
                    ✓ Matched
                  </span>
                  <span
                    v-else-if="v.gstr1Status === 'MISMATCH'"
                    class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"
                    :title="`Variance: ₹${v.gstr1MatchDetails?.taxVariance}`"
                  >
                    ⚠️ Variance
                  </span>
                  <span
                    v-else-if="v.gstr1Status === 'B2CS_RETAIL'"
                    class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                  >
                    🛒 B2CS Retail
                  </span>
                  <span
                    v-else-if="v.gstr1Status === 'UNFILED'"
                    class="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300"
                    title="Missing from GSTR-1 return"
                  >
                    ✕ Unfiled
                  </span>
                  <span v-else class="text-slate-400 text-[10px]">-</span>
                </td>
              </tr>

              <!-- Line Items Accordion Sub-Row -->
              <tr v-if="expandedVouchers.has(v.voucherNumber)" class="bg-slate-100/50 dark:bg-zinc-950/40">
                <td colspan="15" class="p-3 pl-8">
                  <div class="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
                    <div class="py-1.5 px-3 bg-slate-50 dark:bg-zinc-850 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between text-[10px] font-bold">
                      <span class="text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Line Items Tax & Margin Breakdown</span>
                      <span class="font-mono text-slate-500">Voucher #{{ v.voucherNumber }} • Supply: {{ v.supplyType === 'INTRA' ? 'Intra-State (CGST 50% + SGST 50%)' : 'Inter-State (IGST 100%)' }}</span>
                    </div>
                    <table class="w-full text-left text-[11px]">
                      <thead class="bg-slate-50/50 dark:bg-zinc-850/50 text-[9px] uppercase font-bold text-slate-400 border-b border-slate-200 dark:border-zinc-800">
                        <tr>
                          <th class="py-2 px-3">Item Description</th>
                          <th class="py-2 px-2.5 w-20">HSN</th>
                          <th class="py-2 px-2.5 w-24">Godown</th>
                          <th class="py-2 px-2.5 w-20 text-right">Qty</th>
                          <th class="py-2 px-2.5 w-20 text-right">Rate (₹)</th>
                          <th class="py-2 px-2.5 w-24 text-right">Taxable (₹)</th>
                          <th class="py-2 px-2 w-16 text-center">GST %</th>
                          <th class="py-2 px-2 w-16 text-right">CGST</th>
                          <th class="py-2 px-2 w-16 text-right">SGST</th>
                          <th class="py-2 px-2 w-16 text-right">IGST</th>
                          <th class="py-2 px-2.5 w-24 text-right">Line Total (₹)</th>
                          <th class="py-2 px-2.5 w-24 text-right">Margin (₹)</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                        <tr v-for="(item, itemIdx) in v.items" :key="itemIdx" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/30">
                          <td class="py-1.5 px-3 font-bold text-slate-800 dark:text-zinc-200">{{ item.itemName }}</td>
                          <td class="py-1.5 px-2.5 font-mono text-slate-500 text-[10px]">{{ item.hsn || '-' }}</td>
                          <td class="py-1.5 px-2.5 text-slate-500 text-[10px]">{{ item.godown }}</td>
                          <td class="py-1.5 px-2.5 text-right font-mono font-bold">{{ item.billedQty }} {{ item.unit }}</td>
                          <td class="py-1.5 px-2.5 text-right font-mono">{{ formatCurrency(item.rate) }}</td>
                          <td class="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">{{ formatCurrency(item.amount) }}</td>
                          <td class="py-1.5 px-2 text-center font-mono font-bold text-blue-600">{{ item.gstRate }}%</td>
                          <td class="py-1.5 px-2 text-right font-mono text-slate-500 text-[10px]">{{ item.cgst > 0 ? formatCurrency(item.cgst) : '-' }}</td>
                          <td class="py-1.5 px-2 text-right font-mono text-slate-500 text-[10px]">{{ item.sgst > 0 ? formatCurrency(item.sgst) : '-' }}</td>
                          <td class="py-1.5 px-2 text-right font-mono text-purple-600 text-[10px] font-bold">{{ item.igst > 0 ? formatCurrency(item.igst) : '-' }}</td>
                          <td class="py-1.5 px-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(item.grandTotal) }}</td>
                          <td
                            class="py-1.5 px-2.5 text-right font-mono font-bold"
                            :class="item.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'"
                          >
                            {{ formatCurrency(item.margin) }}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </td>
              </tr>
            </template>

            <tr v-if="filteredList.length === 0">
              <td colspan="15" class="py-12 text-center text-slate-400 dark:text-zinc-500 italic">
                No vouchers found matching search and filter criteria.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Batch Post Modal -->
    <DaybookBatchPostModal
      v-model="showBatchPostModal"
      :vouchers="selectedVouchersList"
      :default-firm-gstin="defaultFirmGstin"
      @posted="onVouchersPosted"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DaybookVoucher } from '@/utils/daybook-parser';
import DaybookBatchPostModal from '@/components/inventory/daybook/DaybookBatchPostModal.vue';

const props = defineProps<{
  vouchers: DaybookVoucher[];
  defaultFirmGstin?: string;
}>();

const searchQuery = ref('');
const filterType = ref('ALL');
const expandedVouchers = ref<Set<string>>(new Set());
const selectedVouchers = ref<Set<string>>(new Set());
const showBatchPostModal = ref(false);

const isSyncing = ref(false);
const syncData = ref<{
  parties: Record<string, any>;
  bills: Record<string, any>;
  stats: {
    totalVouchers: number;
    existingBillsCount: number;
    newBillsCount: number;
    totalGstins: number;
    existingPartiesCount: number;
    newPartiesCount: number;
  };
} | null>(null);

function getVerifiedPartyName(v: DaybookVoucher): string {
  if (syncData.value && v.gstin) {
    const p = syncData.value.parties[v.gstin];
    if (p && p.verifiedName) {
      return p.verifiedName;
    }
  }
  return v.partyName;
}

const filteredList = computed(() => {
  let list = [...props.vouchers];

  if (filterType.value === 'NEW_BILLS') {
    if (syncData.value) {
      list = list.filter((v) => !syncData.value?.bills[v.voucherNumber]?.billExists);
    }
  } else if (filterType.value === 'EXISTING_BILLS') {
    if (syncData.value) {
      list = list.filter((v) => syncData.value?.bills[v.voucherNumber]?.billExists);
    }
  } else if (filterType.value === 'NEW_PARTIES') {
    if (syncData.value) {
      list = list.filter((v) => v.gstin && !syncData.value?.parties[v.gstin]?.partyExists);
    }
  } else if (filterType.value === 'EXISTING_PARTIES') {
    if (syncData.value) {
      list = list.filter((v) => v.gstin && syncData.value?.parties[v.gstin]?.partyExists);
    }
  } else if (filterType.value === 'INTRA') {
    list = list.filter((v) => v.supplyType === 'INTRA');
  } else if (filterType.value === 'INTER') {
    list = list.filter((v) => v.supplyType === 'INTER');
  } else if (filterType.value === 'B2B') {
    list = list.filter((v) => v.gstin && v.partyName.toLowerCase() !== 'cash');
  } else if (filterType.value === 'B2CS') {
    list = list.filter((v) => !v.gstin || v.partyName.toLowerCase() === 'cash');
  } else if (filterType.value === 'MISMATCH') {
    list = list.filter((v) => v.gstr1Status === 'MISMATCH' || v.gstr1Status === 'UNFILED');
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (v) =>
        v.voucherNumber.toLowerCase().includes(q) ||
        v.partyName.toLowerCase().includes(q) ||
        getVerifiedPartyName(v).toLowerCase().includes(q) ||
        v.gstin.toLowerCase().includes(q) ||
        v.items.some((i) => i.itemName.toLowerCase().includes(q) || i.hsn.toLowerCase().includes(q))
    );
  }

  return list;
});

const isAllSelected = computed(() => {
  return filteredList.value.length > 0 && selectedVouchers.value.size >= filteredList.value.length;
});

const isPartiallySelected = computed(() => {
  return selectedVouchers.value.size > 0 && !isAllSelected.value;
});

const selectedVouchersList = computed(() => {
  return props.vouchers.filter((v) => selectedVouchers.value.has(v.voucherNumber));
});

const selectedTotals = computed(() => {
  let taxable = 0;
  let grandTotal = 0;
  props.vouchers.forEach((v) => {
    if (selectedVouchers.value.has(v.voucherNumber)) {
      taxable += v.totalAmount;
      grandTotal += v.grandTotal;
    }
  });
  return { taxable, grandTotal };
});

function toggleVoucherSelection(voucherNo: string) {
  if (selectedVouchers.value.has(voucherNo)) {
    selectedVouchers.value.delete(voucherNo);
  } else {
    selectedVouchers.value.add(voucherNo);
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedVouchers.value.clear();
  } else {
    selectedVouchers.value = new Set(filteredList.value.map((v) => v.voucherNumber));
  }
}

function selectNewBillsOnly() {
  if (syncData.value) {
    const newOnes = props.vouchers
      .filter((v) => !syncData.value?.bills[v.voucherNumber]?.billExists)
      .map((v) => v.voucherNumber);
    selectedVouchers.value = new Set(newOnes);
  }
}

function clearSelection() {
  selectedVouchers.value.clear();
}

const allExpanded = computed(() => {
  return filteredList.value.length > 0 && expandedVouchers.value.size === filteredList.value.length;
});

function toggleVoucher(voucherNo: string) {
  if (expandedVouchers.value.has(voucherNo)) {
    expandedVouchers.value.delete(voucherNo);
  } else {
    expandedVouchers.value.add(voucherNo);
  }
}

function toggleExpandAll() {
  if (allExpanded.value) {
    expandedVouchers.value.clear();
  } else {
    expandedVouchers.value = new Set(filteredList.value.map((v) => v.voucherNumber));
  }
}

function onVouchersPosted(results: any[]) {
  if (!syncData.value) {
    syncData.value = {
      parties: {},
      bills: {},
      stats: {
        totalVouchers: props.vouchers.length,
        existingBillsCount: 0,
        newBillsCount: 0,
        totalGstins: 0,
        existingPartiesCount: 0,
        newPartiesCount: 0
      }
    };
  }
  if (Array.isArray(results)) {
    results.forEach((r) => {
      if (r.status === 'POSTED' || r.status === 'SKIPPED') {
        syncData.value!.bills[r.voucherNumber] = {
          billExists: true,
          billId: r.billId,
          bno: r.billNo
        };
      }
    });
  }
  selectedVouchers.value.clear();
}

async function triggerServerSync() {
  if (!props.vouchers || props.vouchers.length === 0) return;
  isSyncing.value = true;
  try {
    const payload = props.vouchers.map((v) => ({
      voucherNumber: v.voucherNumber,
      partyName: v.partyName,
      gstin: v.gstin,
      date: v.date,
      amount: v.totalAmount,
      grandTotal: v.grandTotal
    }));

    const res: any = await $fetch('/api/accounting/daybook/sync-vouchers', {
      method: 'POST',
      body: { vouchers: payload }
    });

    if (res && res.success) {
      syncData.value = {
        parties: res.parties,
        bills: res.bills,
        stats: res.stats
      };
    }
  } catch (err: any) {
    console.error('Server sync error:', err);
    alert('Failed to sync with DB & GST Portal: ' + (err.data?.statusMessage || err.message));
  } finally {
    isSyncing.value = false;
  }
}

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
