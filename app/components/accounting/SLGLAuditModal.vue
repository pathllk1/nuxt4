<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  report: any;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'refresh'): void;
}>();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
});

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && isOpen.value) {
    isOpen.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const formatINR = (n: number) => {
  const val = Number(n) || 0;
  const frac = Math.abs(val) >= 100000 ? 0 : 2;
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: frac,
    maximumFractionDigits: frac,
  }).format(val);
};
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm"
        @click.self="isOpen = false"
      >
        <div 
          class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col transform transition-all duration-200"
          role="dialog"
          aria-modal="true"
        >
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900 shrink-0">
            <div class="flex items-center gap-3">
              <div 
                class="p-2.5 rounded-2xl border shadow-sm"
                :class="report?.overallStatus === 'HEALTHY' 
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600' 
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600'"
              >
                <UIcon 
                  :name="report?.overallStatus === 'HEALTHY' ? 'i-heroicons-shield-check' : 'i-heroicons-shield-exclamation'" 
                  class="w-6 h-6" 
                />
              </div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  SL-GL Reconciliation Diagnostic
                </h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400">
                  Sub-Ledger vs General Ledger single source of truth verification
                </p>
              </div>
            </div>
            <button 
              type="button"
              class="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors text-slate-500 hover:text-slate-700 dark:text-zinc-400 cursor-pointer"
              @click="isOpen = false"
              aria-label="Close"
            >
              <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="overflow-y-auto p-6 flex-1 space-y-5">
            <!-- Overall Status Banner -->
            <div 
              class="p-4 rounded-2xl border flex items-center justify-between gap-4"
              :class="report?.overallStatus === 'HEALTHY'
                ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                : 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'"
            >
              <div class="flex items-center gap-3">
                <UIcon 
                  :name="report?.overallStatus === 'HEALTHY' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'" 
                  class="w-5 h-5 shrink-0" 
                />
                <div>
                  <span class="text-xs font-black uppercase tracking-wider">
                    {{ report?.overallStatus === 'HEALTHY' ? 'Zero Drift: System in Parity' : 'Mathematical Drift Detected' }}
                  </span>
                  <p class="text-[11px] opacity-85 mt-0.5">
                    {{ report?.overallStatus === 'HEALTHY'
                      ? 'All sub-ledgers (Debtors, Creditors, Bank registers, and Labor) match General Ledger control accounts perfectly.'
                      : 'One or more sub-ledgers have variances compared to the GL control accounts or contain orphan entries.' }}
                  </p>
                </div>
              </div>
              <div class="text-right shrink-0">
                <span 
                  class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border"
                  :class="report?.overallStatus === 'HEALTHY' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-200' : 'bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/50 dark:border-amber-700 dark:text-amber-200'"
                >
                  {{ report?.overallStatus || 'HEALTHY' }}
                </span>
              </div>
            </div>

            <!-- 4 Pillars Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" v-if="report">
              <!-- AR Summary -->
              <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1.5">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>Trade Debtors (AR)</span>
                  <UIcon 
                    :name="report.arSummary?.status === 'HEALTHY' ? 'i-heroicons-check' : 'i-heroicons-exclamation-circle'" 
                    :class="report.arSummary?.status === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'" 
                  />
                </div>
                <div class="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {{ formatINR(report.arSummary?.glTotal) }}
                </div>
                <div class="text-[10px] text-slate-500 flex justify-between pt-1 border-t dark:border-zinc-800">
                  <span>SL Total:</span>
                  <span class="font-mono">{{ formatINR(report.arSummary?.slTotal) }}</span>
                </div>
                <div class="text-[10px] flex justify-between font-bold" :class="report.arSummary?.variance > 0.01 ? 'text-amber-600' : 'text-emerald-600'">
                  <span>Variance:</span>
                  <span class="font-mono">{{ formatINR(report.arSummary?.variance) }}</span>
                </div>
              </div>

              <!-- AP Summary -->
              <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1.5">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>Trade Creditors (AP)</span>
                  <UIcon 
                    :name="report.apSummary?.status === 'HEALTHY' ? 'i-heroicons-check' : 'i-heroicons-exclamation-circle'" 
                    :class="report.apSummary?.status === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'" 
                  />
                </div>
                <div class="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {{ formatINR(report.apSummary?.glTotal) }}
                </div>
                <div class="text-[10px] text-slate-500 flex justify-between pt-1 border-t dark:border-zinc-800">
                  <span>SL Total:</span>
                  <span class="font-mono">{{ formatINR(report.apSummary?.slTotal) }}</span>
                </div>
                <div class="text-[10px] flex justify-between font-bold" :class="report.apSummary?.variance > 0.01 ? 'text-amber-600' : 'text-emerald-600'">
                  <span>Variance:</span>
                  <span class="font-mono">{{ formatINR(report.apSummary?.variance) }}</span>
                </div>
              </div>

              <!-- Bank Summary -->
              <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1.5">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>Bank & Cash</span>
                  <UIcon 
                    :name="report.bankSummary?.status === 'HEALTHY' ? 'i-heroicons-check' : 'i-heroicons-exclamation-circle'" 
                    :class="report.bankSummary?.status === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'" 
                  />
                </div>
                <div class="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {{ formatINR(report.bankSummary?.glTotal) }}
                </div>
                <div class="text-[10px] text-slate-500 flex justify-between pt-1 border-t dark:border-zinc-800">
                  <span>SL Total:</span>
                  <span class="font-mono">{{ formatINR(report.bankSummary?.slTotal) }}</span>
                </div>
                <div class="text-[10px] flex justify-between font-bold" :class="report.bankSummary?.variance > 0.01 ? 'text-amber-600' : 'text-emerald-600'">
                  <span>Variance:</span>
                  <span class="font-mono">{{ formatINR(report.bankSummary?.variance) }}</span>
                </div>
              </div>

              <!-- Labor Summary -->
              <div class="p-3.5 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-1.5">
                <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                  <span>Labor Leaders</span>
                  <UIcon 
                    :name="report.laborSummary?.status === 'HEALTHY' ? 'i-heroicons-check' : 'i-heroicons-exclamation-circle'" 
                    :class="report.laborSummary?.status === 'HEALTHY' ? 'text-emerald-500' : 'text-amber-500'" 
                  />
                </div>
                <div class="text-sm font-black font-mono text-slate-900 dark:text-white">
                  {{ formatINR(report.laborSummary?.glTotal) }}
                </div>
                <div class="text-[10px] text-slate-500 flex justify-between pt-1 border-t dark:border-zinc-800">
                  <span>SL Total:</span>
                  <span class="font-mono">{{ formatINR(report.laborSummary?.slTotal) }}</span>
                </div>
                <div class="text-[10px] flex justify-between font-bold" :class="report.laborSummary?.variance > 0.01 ? 'text-amber-600' : 'text-emerald-600'">
                  <span>Variance:</span>
                  <span class="font-mono">{{ formatINR(report.laborSummary?.variance) }}</span>
                </div>
              </div>
            </div>

            <!-- Detailed Variances Table (if any) -->
            <div v-if="report?.variances && report.variances.length > 0" class="space-y-3">
              <h4 class="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Specific Discrepancies ({{ report.variances.length }})
              </h4>
              <div class="border rounded-2xl overflow-hidden dark:border-zinc-800">
                <table class="w-full text-left text-xs">
                  <thead class="bg-slate-50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-wider text-slate-500 border-b dark:border-zinc-800">
                    <tr>
                      <th class="p-2.5">Category</th>
                      <th class="p-2.5">Account / Entity</th>
                      <th class="p-2.5 text-right">GL Balance</th>
                      <th class="p-2.5 text-right">SL Balance</th>
                      <th class="p-2.5 text-right">Variance</th>
                      <th class="p-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y dark:divide-zinc-800">
                    <tr v-for="v in report.variances" :key="v.entityId" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/20">
                      <td class="p-2.5 font-bold text-slate-600 dark:text-zinc-400">{{ v.category }}</td>
                      <td class="p-2.5">
                        <div class="font-bold text-slate-900 dark:text-white">{{ v.entityName }}</div>
                        <div class="text-[10px] font-mono text-slate-400">{{ v.entityId }}</div>
                      </td>
                      <td class="p-2.5 text-right font-mono font-bold">{{ formatINR(v.glBalance) }} ({{ v.glBalanceType }})</td>
                      <td class="p-2.5 text-right font-mono font-bold">{{ formatINR(v.slBalance) }} ({{ v.slBalanceType }})</td>
                      <td class="p-2.5 text-right font-mono font-black text-rose-600 dark:text-rose-400">{{ formatINR(v.variance) }}</td>
                      <td class="p-2.5 text-center">
                        <span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                          {{ v.status }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- Untagged Vouchers Notice -->
            <div v-if="report?.untaggedVoucherCount > 0" class="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-300">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-information-circle" class="w-4 h-4 shrink-0 text-amber-600" />
                <span><strong>{{ report.untaggedVoucherCount }}</strong> voucher entries in General Ledger have no party or bank ID tag attached.</span>
              </div>
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="flex items-center justify-between border-t px-6 py-4 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900 shrink-0">
            <div class="text-[10px] text-slate-400 font-mono">
              Audited at: {{ report?.timestamp ? new Date(report.timestamp).toLocaleTimeString() : '-' }}
            </div>
            <div class="flex items-center gap-2">
              <UButton 
                icon="i-heroicons-arrow-path" 
                variant="outline" 
                color="neutral" 
                size="sm" 
                :loading="loading" 
                label="Re-run Diagnostic" 
                @click="emit('refresh')" 
              />
              <UButton 
                variant="solid" 
                color="neutral" 
                size="sm" 
                label="Close" 
                @click="isOpen = false" 
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
