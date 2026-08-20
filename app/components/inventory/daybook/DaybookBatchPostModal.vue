<template>
  <UModal
    :open="modelValue"
    @update:open="(val) => emit('update:modelValue', val)"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #content>
      <div class="p-5 space-y-4">
        <!-- Header -->
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="p-2 rounded-xl bg-primary-100 dark:bg-primary-950/80 text-primary">
              <UIcon name="i-heroicons-rocket-launch" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="text-base font-black text-slate-900 dark:text-white">
                Post Selected Vouchers to ERP
              </h3>
              <p class="text-xs text-slate-500 dark:text-zinc-400">
                Atomic MongoDB posting to Sales Bills, Stock Registry, and Double-Entry Ledger.
              </p>
            </div>
          </div>

          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-x-mark"
            size="xs"
            class="cursor-pointer"
            @click="closeModal"
          />
        </div>

        <!-- Pre-Flight Configuration (if not finished) -->
        <template v-if="!postSummary">
          <!-- Financial Totals Ribbon -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-zinc-850 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 text-xs">
            <div>
              <span class="text-[9px] uppercase font-black text-slate-400">Vouchers Selected</span>
              <p class="text-sm font-black font-mono text-slate-900 dark:text-white">{{ vouchers.length }}</p>
            </div>
            <div>
              <span class="text-[9px] uppercase font-black text-slate-400">Taxable Turnover</span>
              <p class="text-sm font-black font-mono text-slate-900 dark:text-white">{{ formatCurrency(financialTotals.taxable) }}</p>
            </div>
            <div>
              <span class="text-[9px] uppercase font-black text-slate-400">Total GST Tax</span>
              <p class="text-sm font-black font-mono text-indigo-600 dark:text-indigo-400">{{ formatCurrency(financialTotals.tax) }}</p>
            </div>
            <div>
              <span class="text-[9px] uppercase font-black text-slate-400">Net Grand Total</span>
              <p class="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">{{ formatCurrency(financialTotals.grandTotal) }}</p>
            </div>
          </div>

          <!-- Options Grid -->
          <div class="space-y-3 pt-1">
            <!-- Voucher Numbering Mode -->
            <div>
              <label class="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
                Voucher / Bill Numbering Strategy:
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div
                  class="p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2 text-xs"
                  :class="voucherNumbering === 'EXCEL' ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20' : 'border-slate-200 dark:border-zinc-700'"
                  @click="voucherNumbering = 'EXCEL'"
                >
                  <input type="radio" v-model="voucherNumbering" value="EXCEL" class="mt-0.5 text-primary" />
                  <div>
                    <span class="font-bold text-slate-900 dark:text-white block">Keep DayBook Voucher #</span>
                    <span class="text-[10px] text-slate-500">e.g. 236, 240, 242 (1:1 GST return match)</span>
                  </div>
                </div>

                <div
                  class="p-2.5 rounded-xl border cursor-pointer transition-all flex items-start gap-2 text-xs"
                  :class="voucherNumbering === 'AUTO_ERP' ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-950/20' : 'border-slate-200 dark:border-zinc-700'"
                  @click="voucherNumbering = 'AUTO_ERP'"
                >
                  <input type="radio" v-model="voucherNumbering" value="AUTO_ERP" class="mt-0.5 text-primary" />
                  <div>
                    <span class="font-bold text-slate-900 dark:text-white block">Auto-Generate ERP Invoice #</span>
                    <span class="text-[10px] text-slate-500">Sequential ERP number, saves DayBook # in reference</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Duplicate Skip Option -->
            <div class="flex items-center gap-2 pt-1">
              <input
                id="skipDuplicatesCheck"
                type="checkbox"
                v-model="skipDuplicates"
                class="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label for="skipDuplicatesCheck" class="text-xs text-slate-700 dark:text-zinc-300 font-medium cursor-pointer">
                Skip already saved bills (recommended to prevent duplicate postings)
              </label>
            </div>
          </div>

          <!-- Selected Vouchers Preview Table -->
          <div class="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden text-xs">
            <div class="bg-slate-50 dark:bg-zinc-850 px-3 py-1.5 font-bold text-[10px] uppercase text-slate-400 border-b border-slate-100 dark:border-zinc-800">
              Vouchers Included in Batch ({{ vouchers.length }})
            </div>
            <div class="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800">
              <div v-for="v in vouchers" :key="v.voucherNumber" class="p-2.5 flex items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2">
                  <span class="font-mono font-bold text-primary">#{{ v.voucherNumber }}</span>
                  <span class="text-slate-400">•</span>
                  <span class="font-bold text-slate-800 dark:text-zinc-200">{{ v.partyName }}</span>
                  <span v-if="v.gstin" class="font-mono text-[10px] text-slate-500">({{ v.gstin }})</span>
                </div>
                <div class="text-right font-mono">
                  <span class="font-bold text-slate-900 dark:text-white">{{ formatCurrency(v.grandTotal) }}</span>
                  <span class="text-[10px] text-slate-400 block">{{ v.itemsCount }} item(s)</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Post Results Audit Screen (when finished) -->
        <template v-else>
          <div class="p-4 rounded-xl text-center space-y-2" :class="postSummary.failed === 0 ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800'">
            <UIcon
              :name="postSummary.failed === 0 ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'"
              class="w-10 h-10 mx-auto"
              :class="postSummary.failed === 0 ? 'text-emerald-600' : 'text-amber-600'"
            />
            <h4 class="font-black text-sm text-slate-900 dark:text-white">
              Batch Posting Complete
            </h4>
            <div class="flex items-center justify-center gap-3 text-xs font-bold">
              <span class="text-emerald-600">✓ {{ postSummary.posted }} Posted</span>
              <span v-if="postSummary.skipped > 0" class="text-slate-500">⏭️ {{ postSummary.skipped }} Skipped</span>
              <span v-if="postSummary.failed > 0" class="text-rose-600">✕ {{ postSummary.failed }} Failed</span>
            </div>
          </div>

          <!-- Audit List -->
          <div class="rounded-xl border border-slate-100 dark:border-zinc-800 overflow-hidden text-xs max-h-60 overflow-y-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead class="bg-slate-50 dark:bg-zinc-850 text-[10px] uppercase font-bold text-slate-400">
                <tr>
                  <th class="py-2 px-3">Voucher #</th>
                  <th class="py-2 px-3">Party Name</th>
                  <th class="py-2 px-3 text-center">Status</th>
                  <th class="py-2 px-3">Message</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-medium">
                <tr v-for="res in postResults" :key="res.voucherNumber" class="hover:bg-slate-50/50">
                  <td class="py-2 px-3 font-mono font-bold text-primary">#{{ res.voucherNumber }}</td>
                  <td class="py-2 px-3 font-bold text-slate-800 dark:text-zinc-200">{{ res.partyName }}</td>
                  <td class="py-2 px-3 text-center">
                    <span
                      class="px-2 py-0.5 rounded-full text-[9px] font-black"
                      :class="[
                        res.status === 'POSTED' ? 'bg-emerald-100 text-emerald-700' :
                        res.status === 'SKIPPED' ? 'bg-slate-200 text-slate-700' : 'bg-rose-100 text-rose-700'
                      ]"
                    >
                      {{ res.status }}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-[11px] text-slate-500">{{ res.message }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800">
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            label="Cancel"
            class="font-bold cursor-pointer"
            @click="closeModal"
          />

          <div class="flex items-center gap-2">
            <UButton
              v-if="!postSummary"
              color="primary"
              size="sm"
              icon="i-heroicons-check"
              :label="`Confirm & Post ${vouchers.length} Vouchers`"
              :loading="isPosting"
              class="font-black cursor-pointer shadow-md"
              @click="submitBatchPost"
            />
            <UButton
              v-else
              color="primary"
              size="sm"
              label="Done & Return to DayBook"
              class="font-black cursor-pointer"
              @click="finishAndClose"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { DaybookVoucher } from '@/utils/daybook-parser';

const props = defineProps<{
  modelValue: boolean;
  vouchers: DaybookVoucher[];
  defaultFirmGstin?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [val: boolean];
  'posted': [results: any];
}>();

const voucherNumbering = ref<'EXCEL' | 'AUTO_ERP'>('EXCEL');
const skipDuplicates = ref(true);
const isPosting = ref(false);

const postSummary = ref<{ total: number; posted: number; skipped: number; failed: number } | null>(null);
const postResults = ref<any[]>([]);

const financialTotals = computed(() => {
  let taxable = 0;
  let tax = 0;
  let grandTotal = 0;
  props.vouchers.forEach((v) => {
    taxable += v.totalAmount;
    tax += v.totalTax;
    grandTotal += v.grandTotal;
  });
  return { taxable, tax, grandTotal };
});

function closeModal() {
  emit('update:modelValue', false);
}

function finishAndClose() {
  emit('posted', postResults.value);
  closeModal();
}

async function submitBatchPost() {
  if (props.vouchers.length === 0) return;
  isPosting.value = true;
  try {
    const res: any = await $fetch('/api/accounting/daybook/post-vouchers', {
      method: 'POST',
      body: {
        vouchers: props.vouchers,
        firmGstin: props.defaultFirmGstin,
        options: {
          voucherNumbering: voucherNumbering.value,
          skipDuplicates: skipDuplicates.value
        }
      }
    });

    if (res && res.success) {
      postSummary.value = res.summary;
      postResults.value = res.results;
    }
  } catch (err: any) {
    alert('Failed to post vouchers: ' + (err.data?.statusMessage || err.message));
  } finally {
    isPosting.value = false;
  }
}

function formatCurrency(amount: number = 0): string {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
</script>
