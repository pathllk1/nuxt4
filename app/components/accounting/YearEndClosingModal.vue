<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  initialFinancialYear?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'closed', result: any): void;
}>();

const api = useApi();

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

// Wizard Steps: 'select' -> 'preview' -> 'confirm' -> 'completed'
const currentStep = ref<'select' | 'preview' | 'confirm' | 'completed'>('select');

// Financial Year options
const currentYear = new Date().getFullYear();
const fyOptions = computed(() => {
  const years = [];
  for (let i = -2; i <= 1; i++) {
    const y = currentYear + i;
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
});

const selectedFY = ref(props.initialFinancialYear || fyOptions.value[1] || `${currentYear - 1}-${String(currentYear).slice(-2)}`);

const validating = ref(false);
const executing = ref(false);
const previewData = ref<any>(null);
const executeResult = ref<any>(null);
const errorMessage = ref<string | null>(null);

const confirmInput = ref('');
const requiredConfirmText = computed(() => `CLOSE ${selectedFY.value}`);
const isConfirmMatch = computed(() => confirmInput.value.trim().toUpperCase() === requiredConfirmText.value.toUpperCase());

const formatINR = (n: number) => {
  return '₹ ' + new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n || 0);
};

// Reset wizard state when opened
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    currentStep.value = 'select';
    previewData.value = null;
    executeResult.value = null;
    errorMessage.value = null;
    confirmInput.value = '';
    if (props.initialFinancialYear) {
      selectedFY.value = props.initialFinancialYear;
    }
  }
});

// Step 1 -> 2: Fetch Preview Validation
const fetchPreview = async () => {
  validating.value = true;
  errorMessage.value = null;
  try {
    const res = await api.get(`/accounting/year-end-close/validate?financialYear=${selectedFY.value}`);
    if (res.success && res.data) {
      previewData.value = res.data;
      currentStep.value = 'preview';
    } else {
      errorMessage.value = res.message || 'Validation failed';
    }
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || err.message || 'Failed to validate year-end close';
  } finally {
    validating.value = false;
  }
};

// Step 2 -> 3: Proceed to confirm
const proceedToConfirm = () => {
  confirmInput.value = '';
  errorMessage.value = null;
  currentStep.value = 'confirm';
};

// Step 3 -> 4: Execute Close
const executeClose = async () => {
  if (!isConfirmMatch.value) return;
  executing.value = true;
  errorMessage.value = null;
  try {
    const res = await api.post('/accounting/year-end-close/execute', {
      financialYear: selectedFY.value
    });
    if (res.success && res.data) {
      executeResult.value = res.data;
      currentStep.value = 'completed';
      emit('closed', res.data);
    } else {
      errorMessage.value = res.message || 'Year-end close failed';
    }
  } catch (err: any) {
    errorMessage.value = err.data?.statusMessage || err.message || 'Failed to execute year-end close';
  } finally {
    executing.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md" @click.self="isOpen = false">
    <UCard 
      class="w-full max-w-2xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 shadow-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-2xl" 
      :ui="{ body: 'p-5 overflow-y-auto flex-1', header: 'p-4 py-3.5 bg-slate-950 text-white border-b border-slate-800 flex justify-between items-center' }"
    >
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-500/20 rounded-xl text-amber-400">
            <UIcon name="i-heroicons-lock-closed" class="w-5 h-5" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[9px] font-black uppercase tracking-widest text-amber-400">Compliance &amp; Fiscal Audit</span>
              <UBadge size="sm" variant="subtle" color="warning" class="text-[8px] px-1.5 py-0 font-bold uppercase rounded">
                Year-End Wizard
              </UBadge>
            </div>
            <h2 class="text-sm font-black uppercase tracking-tight text-white leading-tight mt-0.5">
              Fiscal Year-End Closing
            </h2>
          </div>
        </div>

        <UButton 
          color="neutral" 
          variant="ghost" 
          icon="i-heroicons-x-mark" 
          size="xs" 
          class="rounded-lg text-slate-400 hover:text-white"
          @click="isOpen = false"
        />
      </template>

      <!-- Stepper Indicator -->
      <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider">
        <div class="flex items-center gap-1.5" :class="currentStep === 'select' ? 'text-primary' : 'text-slate-400'">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px]" :class="currentStep === 'select' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-800'">1</span>
          Select FY
        </div>
        <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
        <div class="flex items-center gap-1.5" :class="currentStep === 'preview' ? 'text-primary' : 'text-slate-400'">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px]" :class="currentStep === 'preview' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-800'">2</span>
          Audit Preview
        </div>
        <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
        <div class="flex items-center gap-1.5" :class="currentStep === 'confirm' ? 'text-primary' : 'text-slate-400'">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px]" :class="currentStep === 'confirm' ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-800'">3</span>
          Authorize
        </div>
        <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5 text-slate-300 dark:text-zinc-600" />
        <div class="flex items-center gap-1.5" :class="currentStep === 'completed' ? 'text-emerald-500' : 'text-slate-400'">
          <span class="w-4 h-4 rounded-full flex items-center justify-center text-[9px]" :class="currentStep === 'completed' ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-zinc-800'">4</span>
          Finalized
        </div>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage" class="mb-4 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
        <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p class="font-bold">Execution Notice</p>
          <p class="text-[11px] mt-0.5">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- STEP 1: Select Financial Year -->
      <div v-if="currentStep === 'select'" class="space-y-4">
        <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 rounded-xl border border-slate-100 dark:border-zinc-800">
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
            Select Fiscal Year to Close
          </label>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              v-for="fy in fyOptions"
              :key="fy"
              type="button"
              class="p-2.5 rounded-xl border text-xs font-black transition-all flex flex-col items-center justify-center"
              :class="selectedFY === fy 
                ? 'bg-primary/10 border-primary text-primary dark:bg-primary/20' 
                : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 text-slate-700 dark:text-zinc-300'"
              @click="selectedFY = fy"
            >
              <span class="font-mono text-sm">{{ fy }}</span>
              <span class="text-[9px] font-medium text-slate-400 mt-0.5">Apr-Mar</span>
            </button>
          </div>
        </div>

        <div class="p-3.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 space-y-1.5">
          <div class="flex items-center gap-1.5 font-bold">
            <UIcon name="i-heroicons-information-circle" class="w-4 h-4 text-blue-500" />
            What does Year-End Close do?
          </div>
          <ul class="list-disc list-inside text-[11px] text-blue-700 dark:text-blue-300/80 space-y-0.5 pl-1">
            <li>Zeroes all P&amp;L income and expense accounts (sweep closing voucher).</li>
            <li>Calculates Net Profit or Loss and credits/debits <strong>Reserves &amp; Surplus</strong>.</li>
            <li>Rolls all permanent Balance Sheet account balances forward into Next FY Opening Balances.</li>
            <li>Permanently freezes the closed period with an immutable Period Lock.</li>
          </ul>
        </div>

        <div class="flex justify-end pt-2">
          <UButton
            color="primary"
            icon="i-heroicons-magnifying-glass"
            label="Run Pre-Close Audit"
            class="font-bold text-xs"
            :loading="validating"
            @click="fetchPreview"
          />
        </div>
      </div>

      <!-- STEP 2: Preview & Validation -->
      <div v-else-if="currentStep === 'preview' && previewData" class="space-y-4">
        <!-- Parity Check & Status -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div class="p-3 rounded-xl border" :class="previewData.trialBalanceParity ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300'">
            <p class="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Trial Balance Parity</p>
            <div class="text-sm font-black flex items-center gap-1.5 mt-0.5">
              <UIcon :name="previewData.trialBalanceParity ? 'i-heroicons-check-badge' : 'i-heroicons-x-circle'" class="w-4 h-4" />
              {{ previewData.trialBalanceParity ? 'Balanced (ΣDR = ΣCR)' : 'Out of Balance' }}
            </div>
          </div>

          <div class="p-3 rounded-xl border bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200">
            <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Closing Status</p>
            <div class="text-sm font-black font-mono mt-0.5">
              {{ previewData.currentClosingStatus }}
            </div>
          </div>

          <div class="p-3 rounded-xl border" :class="previewData.canClose ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50/50 border-amber-200 text-amber-800'">
            <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Eligibility</p>
            <div class="text-sm font-black mt-0.5">
              {{ previewData.canClose ? 'Ready to Close' : 'Blocked' }}
            </div>
          </div>
        </div>

        <!-- Blocking Reasons (if any) -->
        <div v-if="previewData.blockingReasons && previewData.blockingReasons.length > 0" class="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-xs text-rose-800 dark:text-rose-300">
          <p class="font-bold flex items-center gap-1.5 mb-1">
            <UIcon name="i-heroicons-x-circle" class="w-4 h-4 text-rose-500" />
            Blocking Issues Must Be Resolved:
          </p>
          <ul class="list-disc list-inside text-[11px] space-y-0.5 pl-1">
            <li v-for="(reason, idx) in previewData.blockingReasons" :key="idx">{{ reason }}</li>
          </ul>
        </div>

        <!-- P&L Closing Summary -->
        <div class="p-3.5 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">
            P&amp;L Closing Summary (FY {{ selectedFY }})
          </p>
          <div class="grid grid-cols-3 gap-2 text-xs font-mono">
            <div>
              <span class="text-[9px] text-slate-400 uppercase block">Total Income (DR Sweep)</span>
              <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ formatINR(previewData.pnlSummary?.totalIncome || 0) }}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 uppercase block">Total Expense (CR Sweep)</span>
              <span class="font-bold text-rose-600 dark:text-rose-400">{{ formatINR(previewData.pnlSummary?.totalExpense || 0) }}</span>
            </div>
            <div>
              <span class="text-[9px] text-slate-400 uppercase block">Net to Reserves &amp; Surplus</span>
              <span class="font-black" :class="(previewData.pnlSummary?.netProfit || 0) >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600'">
                {{ formatINR(Math.abs(previewData.pnlSummary?.netProfit || 0)) }}
                {{ (previewData.pnlSummary?.netProfit || 0) >= 0 ? '(Profit)' : '(Loss)' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Balance Sheet Roll Forward Preview -->
        <div class="p-3.5 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs flex items-center justify-between">
          <div>
            <p class="font-bold text-slate-800 dark:text-zinc-200">Balance Sheet Accounts to Roll Forward</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Asset, Liability, and Capital accounts migrating into Opening Balances</p>
          </div>
          <span class="text-sm font-black font-mono bg-slate-200 dark:bg-zinc-700 px-2.5 py-1 rounded-lg">
            {{ previewData.bsCarryForwardCount || 0 }} A/Cs
          </span>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-between pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Back to Select FY"
            size="sm"
            @click="currentStep = 'select'"
          />
          <UButton
            color="warning"
            icon="i-heroicons-arrow-right"
            label="Proceed to Authorization"
            size="sm"
            class="font-bold"
            :disabled="!previewData.canClose"
            @click="proceedToConfirm"
          />
        </div>
      </div>

      <!-- STEP 3: Confirmation Safeguard -->
      <div v-else-if="currentStep === 'confirm'" class="space-y-4">
        <div class="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-900 dark:text-amber-300 space-y-2">
          <p class="font-black text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <UIcon name="i-heroicons-shield-exclamation" class="w-5 h-5 shrink-0" />
            Irreversible Fiscal Action
          </p>
          <p class="leading-relaxed text-[11px]">
            You are about to finalize fiscal year <strong>{{ selectedFY }}</strong>. This will execute double-entry closing vouchers, transfer ₹{{ Math.abs(previewData?.pnlSummary?.netProfit || 0).toFixed(2) }} into Reserves &amp; Surplus, roll forward {{ previewData?.bsCarryForwardCount || 0 }} accounts into the next fiscal year, and permanently lock the ledger against future edits.
          </p>
        </div>

        <div class="space-y-2">
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300">
            To authorize, please type <code class="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-rose-600 dark:text-rose-400 font-mono font-black select-all">{{ requiredConfirmText }}</code> below:
          </label>
          <UInput
            v-model="confirmInput"
            :placeholder="requiredConfirmText"
            class="font-mono text-sm"
            autocomplete="off"
          />
        </div>

        <div class="flex items-center justify-between pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            label="Cancel"
            size="sm"
            @click="currentStep = 'preview'"
          />
          <UButton
            color="error"
            icon="i-heroicons-lock-closed"
            label="Execute Year-End Close"
            size="sm"
            class="font-bold"
            :loading="executing"
            :disabled="!isConfirmMatch || executing"
            @click="executeClose"
          />
        </div>
      </div>

      <!-- STEP 4: Completed Result -->
      <div v-else-if="currentStep === 'completed' && executeResult" class="space-y-4 text-center py-4">
        <div class="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <UIcon name="i-heroicons-check" class="w-8 h-8" />
        </div>

        <div>
          <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Fiscal Year {{ selectedFY }} Closed Successfully
          </h3>
          <p class="text-xs text-slate-500 mt-1">
            General Ledger has been audited, swept, rolled forward, and locked.
          </p>
        </div>

        <div class="bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-200 dark:border-zinc-800 text-left text-xs font-mono space-y-1.5 max-w-md mx-auto">
          <div class="flex justify-between">
            <span class="text-slate-400">Closing Voucher No:</span>
            <span class="font-bold text-primary">{{ executeResult.closingVoucherNo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">P&amp;L Legs Swept:</span>
            <span class="font-bold">{{ executeResult.pnlLegsCount }} accounts</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Next FY Opening Balances:</span>
            <span class="font-bold text-emerald-600">{{ executeResult.nextFyOpeningBalancesCreated }} vouchers</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Lock Date Enforced:</span>
            <span class="font-bold">{{ executeResult.lockDate }}</span>
          </div>
        </div>

        <div class="pt-2">
          <UButton
            color="primary"
            label="Close & Refresh Statements"
            class="font-bold text-xs"
            @click="isOpen = false"
          />
        </div>
      </div>
    </UCard>
  </div>
</template>
