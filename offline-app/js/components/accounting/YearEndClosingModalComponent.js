// js/components/accounting/YearEndClosingModalComponent.js
(function (global) {
  'use strict';

  const { ref, computed, watch, onMounted, onUnmounted } = Vue;

  const YearEndClosingModalComponent = {
    name: 'YearEndClosingModalComponent',
    props: {
      modelValue: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'closed'],
    setup(props, { emit }) {
      const currentStep = ref('select'); // 'select' | 'preview' | 'confirm' | 'completed'
      const validating = ref(false);
      const executing = ref(false);
      const errorMessage = ref('');

      const currentYear = new Date().getFullYear();
      const fyOptions = computed(() => {
        const years = [];
        for (let i = -2; i <= 1; i++) {
          const y = currentYear + i;
          years.push(`${y}-${String(y + 1).slice(-2)}`);
        }
        return years;
      });

      const selectedFY = ref(fyOptions.value[1] || `${currentYear - 1}-${String(currentYear).slice(-2)}`);
      const previewData = ref(null);
      const executeResult = ref(null);
      const confirmInput = ref('');

      const requiredConfirmText = computed(() => `CLOSE ${selectedFY.value}`);
      const isConfirmMatch = computed(() => confirmInput.value.trim().toUpperCase() === requiredConfirmText.value.toUpperCase());

      watch(() => props.modelValue, (newVal) => {
        if (newVal) {
          currentStep.value = 'select';
          previewData.value = null;
          executeResult.value = null;
          errorMessage.value = '';
          confirmInput.value = '';
        }
      });

      const handleKeydown = (e) => {
        if (e.key === 'Escape' && props.modelValue) {
          emit('update:modelValue', false);
        }
      };

      onMounted(() => window.addEventListener('keydown', handleKeydown));
      onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

      const formatINR = (val) => {
        const n = Number(val) || 0;
        return '₹ ' + new Intl.NumberFormat('en-IN', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(n);
      };

      // Step 1 -> 2: Fetch Preview
      const fetchPreview = async () => {
        validating.value = true;
        errorMessage.value = '';
        try {
          if (!global.ledgerService) throw new Error('ledgerService not initialized');
          const data = await global.ledgerService.previewYearEndClose(selectedFY.value);
          previewData.value = data;
          if (!data.canClose) {
            errorMessage.value = data.blockingReasons.join('; ');
          }
          currentStep.value = 'preview';
        } catch (err) {
          errorMessage.value = err.message || 'Validation failed';
        } finally {
          validating.value = false;
        }
      };

      // Step 2 -> 3: Proceed to Confirm
      const proceedToConfirm = () => {
        confirmInput.value = '';
        errorMessage.value = '';
        currentStep.value = 'confirm';
      };

      // Step 3 -> 4: Execute Close
      const executeClose = async () => {
        if (!isConfirmMatch.value) return;
        executing.value = true;
        errorMessage.value = '';
        try {
          const res = await global.ledgerService.executeYearEndClose(selectedFY.value);
          executeResult.value = res;
          currentStep.value = 'completed';
          emit('closed', res);
        } catch (err) {
          errorMessage.value = err.message || 'Execution failed';
        } finally {
          executing.value = false;
        }
      };

      return {
        currentStep,
        fyOptions,
        selectedFY,
        validating,
        executing,
        errorMessage,
        previewData,
        executeResult,
        confirmInput,
        requiredConfirmText,
        isConfirmMatch,
        formatINR,
        fetchPreview,
        proceedToConfirm,
        executeClose
      };
    },
    template: `
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800 animate-scale-in">
          <!-- Header -->
          <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shadow-md font-bold">
                <span>🔒</span>
              </div>
              <div>
                <h3 class="text-base font-black uppercase tracking-wider">Fiscal Year-End Closing Wizard</h3>
                <p class="text-xs text-slate-300">Atomic P&L sweep, Reserves & Surplus transfer, and Opening Balance roll-forward</p>
              </div>
            </div>
            <button 
              @click="$emit('update:modelValue', false)" 
              class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition font-bold"
            >
              ✕
            </button>
          </div>

          <!-- Wizard Body -->
          <div class="p-6 overflow-y-auto space-y-5 flex-1">
            <!-- Step Indicators -->
            <div class="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-zinc-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <span :class="currentStep === 'select' ? 'text-indigo-600 font-black' : ''">1. Select FY</span>
              <span>➔</span>
              <span :class="currentStep === 'preview' ? 'text-indigo-600 font-black' : ''">2. Validation Preview</span>
              <span>➔</span>
              <span :class="currentStep === 'confirm' ? 'text-indigo-600 font-black' : ''">3. Authorization</span>
              <span>➔</span>
              <span :class="currentStep === 'completed' ? 'text-emerald-600 font-black' : ''">4. Completed</span>
            </div>

            <!-- Error Banner -->
            <div v-if="errorMessage" class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{{ errorMessage }}</span>
            </div>

            <!-- STEP 1: SELECT FY -->
            <div v-if="currentStep === 'select'" class="space-y-4">
              <div>
                <label class="block text-xs font-black uppercase tracking-wider text-slate-600 dark:text-zinc-400 mb-2">
                  Select Financial Year to Close
                </label>
                <select 
                  v-model="selectedFY" 
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold text-sm text-slate-900 dark:text-white"
                >
                  <option v-for="fy in fyOptions" :key="fy" :value="fy">Financial Year {{ fy }} (Apr - Mar)</option>
                </select>
              </div>

              <div class="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                <p class="font-black uppercase tracking-wider">⚠️ Important Accounting Rules:</p>
                <ul class="list-disc list-inside space-y-1 opacity-90">
                  <li>Zeroes all Nominal Accounts (Sales, Purchases, Direct/Indirect Expenses & Incomes).</li>
                  <li>Transfers Net Profit or Loss to <strong>Reserves & Surplus</strong> under Equity.</li>
                  <li>Generates an Opening Balance voucher (<code>OB/</code>) for Balance Sheet accounts in the next year.</li>
                  <li>Freezes the closed period in the Period Lock registry.</li>
                </ul>
              </div>
            </div>

            <!-- STEP 2: PREVIEW & AUDIT -->
            <div v-else-if="currentStep === 'preview' && previewData" class="space-y-4">
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                  <p class="text-[9px] font-black uppercase text-slate-400">Trial Balance Parity</p>
                  <p class="text-sm font-bold font-mono mt-0.5" :class="previewData.trialBalanceParity ? 'text-emerald-600' : 'text-rose-600'">
                    {{ previewData.trialBalanceParity ? '✅ BALANCED (0.00)' : '❌ UNBALANCED' }}
                  </p>
                </div>
                <div class="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                  <p class="text-[9px] font-black uppercase text-slate-400">Computed Net Position</p>
                  <p class="text-sm font-bold font-mono mt-0.5" :class="previewData.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'">
                    {{ formatINR(previewData.netProfit) }} ({{ previewData.profitType }})
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 text-xs">
                <div class="p-3 rounded-xl border border-slate-100 bg-emerald-50/40 text-emerald-900">
                  <p class="text-[9px] font-black uppercase">Total Revenue (Income)</p>
                  <p class="text-sm font-bold font-mono mt-0.5">{{ formatINR(previewData.totalIncome) }}</p>
                </div>
                <div class="p-3 rounded-xl border border-slate-100 bg-rose-50/40 text-rose-900">
                  <p class="text-[9px] font-black uppercase">Total Expenses & COGS</p>
                  <p class="text-sm font-bold font-mono mt-0.5">{{ formatINR(previewData.totalExpense) }}</p>
                </div>
              </div>

              <div class="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 text-xs flex justify-between">
                <span>P&L Accounts to Zero Out: <strong>{{ previewData.pnlAccountCount }}</strong></span>
                <span>Balance Sheet Accounts to Roll Forward: <strong>{{ previewData.balanceSheetAccountCount }}</strong></span>
              </div>
            </div>

            <!-- STEP 3: AUTHORIZATION CONFIRM -->
            <div v-else-if="currentStep === 'confirm'" class="space-y-4 text-xs">
              <div class="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-2">
                <h4 class="font-black uppercase tracking-wider">🚨 Irreversible Financial Operation</h4>
                <p>
                  You are about to officially close books for <strong>FY {{ selectedFY }}</strong>.
                  Please confirm by typing <strong>{{ requiredConfirmText }}</strong> below:
                </p>
              </div>

              <div>
                <input 
                  type="text" 
                  v-model="confirmInput" 
                  :placeholder="requiredConfirmText"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-mono font-bold text-sm tracking-wider"
                />
              </div>
            </div>

            <!-- STEP 4: COMPLETED -->
            <div v-else-if="currentStep === 'completed' && executeResult" class="space-y-4 text-center py-4">
              <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-sm">
                ✓
              </div>
              <h4 class="text-base font-black uppercase text-slate-900 dark:text-white">
                FY {{ executeResult.financialYear }} Closed Successfully!
              </h4>
              <p class="text-xs text-slate-500 max-w-md mx-auto">
                Official closing voucher <strong>{{ executeResult.closingVoucherNo }}</strong> has been posted.
                {{ executeResult.openingBalancesGenerated }} balance sheet accounts were rolled forward to the new fiscal year.
              </p>
            </div>
          </div>

          <!-- Footer Actions -->
          <div class="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-between items-center shrink-0">
            <button 
              v-if="currentStep !== 'completed'"
              @click="$emit('update:modelValue', false)" 
              class="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <div v-else></div>

            <div class="flex gap-2">
              <button 
                v-if="currentStep === 'select'"
                @click="fetchPreview"
                :disabled="validating"
                class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition disabled:opacity-50"
              >
                {{ validating ? 'Validating...' : 'Validate & Preview ➔' }}
              </button>

              <button 
                v-else-if="currentStep === 'preview'"
                @click="proceedToConfirm"
                :disabled="!previewData?.canClose"
                class="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md transition disabled:opacity-50"
              >
                Proceed to Authorization ➔
              </button>

              <button 
                v-else-if="currentStep === 'confirm'"
                @click="executeClose"
                :disabled="!isConfirmMatch || executing"
                class="px-5 py-2 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs font-black uppercase tracking-wider cursor-pointer shadow-md transition disabled:opacity-50"
              >
                {{ executing ? 'Executing Close...' : 'Authorize & Execute Close 🔒' }}
              </button>

              <button 
                v-else-if="currentStep === 'completed'"
                @click="$emit('update:modelValue', false)"
                class="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shadow-md"
              >
                Close Wizard
              </button>
            </div>
          </div>
        </div>
      </div>
    `
  };

  global.YearEndClosingModalComponent = YearEndClosingModalComponent;
})(typeof window !== 'undefined' ? window : this);
