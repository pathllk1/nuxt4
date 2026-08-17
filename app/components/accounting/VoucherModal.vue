<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-zinc-800 animate-scale-in">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold">{{ form.vtype === 'PAYMENT' ? 'Payment Voucher' : form.vtype === 'RECEIPT' ? 'Receipt Voucher' : 'Journal Entry' }}</h2>
          <p class="text-xs text-blue-100 mt-0.5">Tally Single-Entry & Double-Entry Financial Accounting</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors cursor-pointer">
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Content -->
      <div class="overflow-y-auto flex-1 p-4 space-y-4">
        <!-- Top Controls Row -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- Date -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Transaction Date</label>
            <input v-model="form.vdate" type="date" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer" />
          </div>
          <!-- Voucher Type -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Voucher Type</label>
            <select v-model="form.vtype" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer">
              <option value="PAYMENT">💳 Payment Out</option>
              <option value="RECEIPT">💰 Receipt In</option>
              <option value="JOURNAL">📝 Journal Entry</option>
            </select>
          </div>
          <div></div>
        </div>

        <!-- Primary Account Selection (Paid From / Receipt To) -->
        <div v-if="form.vtype !== 'JOURNAL'" class="p-3.5 bg-blue-50/70 dark:bg-blue-950/20 border-2 border-blue-400/50 dark:border-blue-800/50 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wide">
              {{ form.vtype === 'PAYMENT' ? '💳 PAID FROM (Bank / Cash Account)' : '💰 RECEIPT TO (Deposit Account)' }}
            </label>
            <!-- Real-time Balance & Projected Balance Summary -->
            <div v-if="selectedMainAccountObj" class="flex items-center gap-3 text-xs">
              <div class="flex items-center gap-1">
                <span class="text-slate-500 dark:text-zinc-400 text-[11px]">Current:</span>
                <span class="font-mono font-bold" :class="mainAccountCurrentBal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'">
                  ₹{{ Math.abs(mainAccountCurrentBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  {{ mainAccountCurrentBal >= 0 ? 'DR' : 'CR' }}
                </span>
              </div>
              <span class="text-slate-300 dark:text-zinc-700">➔</span>
              <div class="flex items-center gap-1">
                <span class="text-slate-500 dark:text-zinc-400 text-[11px]">Projected:</span>
                <span class="font-mono font-black" :class="projectedMainAccountBal >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-rose-600 dark:text-rose-400'">
                  ₹{{ Math.abs(projectedMainAccountBal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  {{ projectedMainAccountBal >= 0 ? 'DR' : 'CR' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Searchable Combobox for Paid From / Receipt To -->
          <AccountSelectMenu
            v-model="form.mainAccount"
            :accounts="liquidAccountsList"
            :placeholder="form.vtype === 'PAYMENT' ? 'Search Bank / Cash account to pay from...' : 'Search Bank / Cash account to deposit to...'"
            :match-by-id="true"
            :show-balance="true"
          />
        </div>

        <!-- Transaction Lines -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wide">
              {{ form.vtype === 'JOURNAL' ? 'Journal Line Entries' : 'Particulars (Account Heads & Deductions)' }}
            </h3>
            <button @click="addLine" class="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors font-medium cursor-pointer">
              + Add Line
            </button>
          </div>

          <div class="space-y-2.5">
            <!-- Column Headers for Journal -->
            <div v-if="form.vtype === 'JOURNAL'" class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
              <div class="col-span-5">Particulars / Account Head</div>
              <div class="col-span-3 text-right">Debit (Dr)</div>
              <div class="col-span-3 text-right">Credit (Cr)</div>
              <div class="col-span-1"></div>
            </div>
            <!-- Column Headers for Payment/Receipt -->
            <div v-else class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
              <div class="col-span-6">Particulars (Account Head / Vendor / Expense / Tax)</div>
              <div class="col-span-2 text-center">Effect</div>
              <div class="col-span-3 text-right">Amount (₹)</div>
              <div class="col-span-1"></div>
            </div>

            <!-- Transaction Lines -->
            <div 
              v-for="(entry, index) in form.entries" 
              :key="index" 
              class="p-2.5 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-blue-300 transition-colors space-y-2"
            >
              <div class="grid grid-cols-12 gap-2 items-center">
                <!-- Searchable Account Selection -->
                <div :class="form.vtype === 'JOURNAL' ? 'col-span-5' : 'col-span-6'">
                  <AccountSelectMenu
                    v-model="entry.accountHead"
                    :accounts="chartOfAccounts"
                    :placeholder="form.vtype === 'PAYMENT' ? 'Search Party / Expense / TDS account...' : 'Search Customer / Income account...'"
                    :show-balance="true"
                    @change="(acc) => onAccountSelected(entry, acc)"
                    @accountCreated="onAccountCreated"
                  />
                </div>

                <!-- Journal Inputs -->
                <template v-if="form.vtype === 'JOURNAL'">
                  <input 
                    v-model.number="entry.debitAmount" 
                    type="number" 
                    placeholder="0.00" 
                    step="0.01" 
                    @input="onDebitInput(entry)"
                    class="col-span-3 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white font-mono" 
                  />
                  <input 
                    v-model.number="entry.creditAmount" 
                    type="number" 
                    placeholder="0.00" 
                    step="0.01" 
                    @input="onCreditInput(entry)"
                    class="col-span-3 px-2.5 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white font-mono" 
                  />
                </template>

                <!-- Payment/Receipt Inputs (Tally Single Entry with +/- Toggle) -->
                <template v-else>
                  <!-- Addition / Deduction Toggle Badge -->
                  <div class="col-span-2 flex justify-center">
                    <button
                      type="button"
                      @click="toggleDeduction(entry)"
                      class="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer"
                      :class="(Number(entry.amount) < 0 || entry.isDeduction) 
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800' 
                        : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'"
                    >
                      <span>{{ (Number(entry.amount) < 0 || entry.isDeduction) ? '➖ Deduction' : '➕ Normal' }}</span>
                    </button>
                  </div>

                  <!-- Amount Input -->
                  <div class="col-span-3 relative">
                    <input 
                      :value="Math.abs(Number(entry.amount) || 0)" 
                      @input="onAmountInput(entry, ($event.target as HTMLInputElement).value)"
                      type="number" 
                      placeholder="0.00" 
                      min="0"
                      step="0.01" 
                      class="w-full px-2.5 py-1.5 text-xs border rounded-lg text-right focus:outline-none focus:ring-2 font-mono font-bold"
                      :class="(Number(entry.amount) < 0 || entry.isDeduction)
                        ? 'border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50/40 dark:bg-rose-950/20 focus:ring-rose-500'
                        : 'border-slate-300 dark:border-zinc-700 text-slate-900 dark:text-white bg-white dark:bg-zinc-800 focus:ring-blue-500'"
                    />
                  </div>
                </template>

                <!-- Delete Button -->
                <button v-if="form.entries.length > (form.vtype === 'JOURNAL' ? 2 : 1)" @click="removeLine(index)" class="col-span-1 text-red-500 hover:text-red-700 font-bold transition-colors text-center text-base cursor-pointer" title="Remove Line">
                  ×
                </button>
                <div v-else class="col-span-1"></div>
              </div>

              <!-- Smart Cross-Module Linking for Labor Leaders in Payment Vouchers -->
              <div 
                v-if="form.vtype === 'PAYMENT' && isLaborLeader(entry.accountHead)" 
                class="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div class="flex items-center gap-1.5 text-amber-900 dark:text-amber-300">
                  <span class="text-sm">👷</span>
                  <span class="font-bold">Labor Leader Detected:</span>
                  <span class="text-[11px] text-amber-800 dark:text-amber-400">Payment will be recorded as an Advance against labor payroll.</span>
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-[11px] font-semibold text-amber-900 dark:text-amber-300">Link to Work Period:</label>
                  <select 
                    v-model="entry.laborPeriodId" 
                    class="px-2 py-1 text-xs border border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 rounded-md font-medium text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">General Advance (Unallocated)</option>
                    <option 
                      v-for="period in getOpenPeriodsForLeader(entry.accountHead)" 
                      :key="period.id" 
                      :value="period.id"
                    >
                      📅 Open: {{ formatDateRange(period.start_date, period.end_date) }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Narration -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Notes / Narration</label>
          <textarea v-model="form.narration" placeholder="Enter transaction description or reference numbers..." class="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white resize-none" rows="2"></textarea>
        </div>

        <!-- Summary Section -->
        <div v-if="form.vtype === 'JOURNAL'" class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-850 p-4 rounded-xl border border-blue-200 dark:border-zinc-700">
          <div class="flex justify-between items-center">
            <div class="flex gap-8">
              <div>
                <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Total Debit (Dr)</p>
                <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">₹ {{ totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Total Credit (Cr)</p>
                <p class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">₹ {{ totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase" :class="isJournalBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'">
                {{ isJournalBalanced ? '✓ Balanced' : `Unbalanced: ₹${Math.abs(totalDebit - totalCredit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-850 p-4 rounded-xl border border-blue-200 dark:border-zinc-700">
          <div class="grid grid-cols-3 gap-3">
            <div>
              <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Gross Amount</p>
              <p class="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">₹ {{ grossAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Deductions (TDS / Disc)</p>
              <p class="text-lg font-bold text-rose-600 dark:text-rose-400 font-mono">- ₹ {{ deductionsTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
            </div>
            <div class="border-l-2 border-blue-300 dark:border-zinc-700 pl-3">
              <p class="text-[10px] text-slate-700 dark:text-zinc-300 font-bold uppercase tracking-wider">
                {{ form.vtype === 'PAYMENT' ? 'NET BANK / CASH OUTFLOW' : 'NET BANK / CASH INFLOW' }}
              </p>
              <p class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">₹ {{ netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-slate-100 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 p-4 flex justify-end gap-2">
        <button @click="$emit('update:modelValue', false)" class="px-4 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer">
          Cancel
        </button>
        <button @click="submitVoucher" :disabled="isSaveDisabled" class="px-6 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2 cursor-pointer">
          <UIcon v-if="loading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
          {{ loading ? 'Processing...' : 'Save Voucher' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useAccounting } from '../../composables/useAccounting';
import { useBanking } from '../../composables/useBanking';
import { useLabor } from '../../composables/useLabor';
import AccountSelectMenu from './AccountSelectMenu.vue';

interface LocalVoucherEntry {
  accountHead: string;
  amount: number;
  isDeduction?: boolean;
  debitAmount?: number;
  creditAmount?: number;
  laborPeriodId?: string;
}

const props = defineProps<{
  modelValue: boolean;
  initialData?: any;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { createVoucher, loading, fetchCOA, chartOfAccounts } = useAccounting();
const { fetchBankAccounts, bankAccounts } = useBanking();
const { fetchPeriods, periods } = useLabor();

const form = reactive({
  mainAccount: '',
  vtype: 'PAYMENT',
  vdate: new Date().toISOString().split('T')[0],
  narration: '',
  entries: [
    { accountHead: '', amount: 0, isDeduction: false, laborPeriodId: '' }
  ] as LocalVoucherEntry[]
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    if (props.initialData) {
      Object.assign(form, props.initialData);
    } else {
      resetForm();
    }
    loadDependencies();
  }
});

watch(() => form.vtype, (newType) => {
  if (newType === 'JOURNAL') {
    form.mainAccount = '';
    form.entries = [
      { accountHead: '', debitAmount: 0, creditAmount: 0, amount: 0, isDeduction: false, laborPeriodId: '' },
      { accountHead: '', debitAmount: 0, creditAmount: 0, amount: 0, isDeduction: false, laborPeriodId: '' }
    ] as any[];
  } else {
    const defaultBank = bankAccounts.value.find(acc => acc.is_default);
    form.mainAccount = defaultBank ? defaultBank._id : (bankAccounts.value[0]?._id || '');
    form.entries = [
      { accountHead: '', amount: 0, isDeduction: false, laborPeriodId: '' }
    ] as any[];
  }
});

async function loadDependencies() {
  await Promise.all([
    fetchCOA(),
    fetchBankAccounts(),
    fetchPeriods()
  ]);

  if (!form.mainAccount && bankAccounts.value.length > 0) {
    const defaultBank = bankAccounts.value.find(acc => acc.is_default);
    form.mainAccount = defaultBank ? defaultBank._id : (bankAccounts.value[0]?._id || '');
  }
}

onMounted(async () => {
  await loadDependencies();
});

// Liquid Accounts for Paid From / Receipt To (Mapped with balances)
const liquidAccountsList = computed(() => {
  const list: any[] = [];
  
  // Bank accounts
  bankAccounts.value.forEach(b => {
    const matchCOA = chartOfAccounts.value.find(c => c.account_name === b.account_name);
    list.push({
      _id: b._id,
      account_name: `${b.account_name} (${b.bank_name})`,
      account_type: 'BANK',
      bank_name: b.bank_name,
      current_balance: matchCOA ? matchCOA.current_balance : ((b as any).balance || 0),
      current_balance_type: matchCOA ? matchCOA.current_balance_type : 'DR'
    });
  });

  // Cash / Liquid COA Accounts
  chartOfAccounts.value.forEach(acc => {
    const type = (acc.account_type || '').toUpperCase();
    const name = (acc.account_name || '').toUpperCase();
    const isCash = type.includes('CASH') || name.includes('CASH') || name.includes('HAND');
    const isAlreadyAdded = list.some(item => item.account_name.startsWith(acc.account_name));
    
    if (isCash && !isAlreadyAdded) {
      list.push({
        _id: acc.account_name,
        account_name: acc.account_name,
        account_type: 'CASH',
        current_balance: acc.current_balance || 0,
        current_balance_type: acc.current_balance_type || 'DR'
      });
    }
  });

  return list;
});

const selectedMainAccountObj = computed(() => {
  if (!form.mainAccount) return null;
  return liquidAccountsList.value.find(acc => acc._id === form.mainAccount);
});

const mainAccountCurrentBal = computed(() => {
  if (!selectedMainAccountObj.value) return 0;
  const bal = Number(selectedMainAccountObj.value.current_balance || 0);
  const isDr = (selectedMainAccountObj.value.current_balance_type || 'DR') === 'DR';
  return isDr ? bal : -bal;
});

const projectedMainAccountBal = computed(() => {
  const current = mainAccountCurrentBal.value;
  const net = netAmount.value;
  if (form.vtype === 'PAYMENT') {
    return current - net;
  } else if (form.vtype === 'RECEIPT') {
    return current + net;
  }
  return current;
});

function isLaborLeader(accountHead: string) {
  if (!accountHead) return false;
  const acc = chartOfAccounts.value.find(c => c.account_name === accountHead);
  return acc && ((acc.account_type || '').toUpperCase().includes('LABOR'));
}

function getOpenPeriodsForLeader(leaderName: string) {
  if (!leaderName || !periods.value) return [];
  return periods.value.filter(p => 
    p.leader_name?.trim().toLowerCase() === leaderName.trim().toLowerCase() && 
    p.status === 'Open'
  );
}

function onAccountSelected(entry: LocalVoucherEntry, acc: any) {
  if (acc && ((acc.account_type || '').toUpperCase().includes('LABOR'))) {
    const openPeriods = getOpenPeriodsForLeader(acc.account_name);
    if (openPeriods.length > 0) {
      entry.laborPeriodId = openPeriods[0].id;
    }
  } else {
    entry.laborPeriodId = '';
  }
}

function onAccountCreated(newAcc: any) {
  if (newAcc && newAcc.account_name) {
    const exists = chartOfAccounts.value.some(c => c.account_name === newAcc.account_name);
    if (!exists) {
      chartOfAccounts.value.push(newAcc);
    }
  }
}

function formatDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return '';
  const s = new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  const e = new Date(endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${s} - ${e}`;
}

function onDebitInput(entry: any) {
  if (entry.debitAmount > 0) {
    entry.creditAmount = 0;
  }
}

function onCreditInput(entry: any) {
  if (entry.creditAmount > 0) {
    entry.debitAmount = 0;
  }
}

function toggleDeduction(entry: LocalVoucherEntry) {
  entry.isDeduction = !entry.isDeduction;
  const currentVal = Math.abs(Number(entry.amount) || 0);
  entry.amount = entry.isDeduction ? -currentVal : currentVal;
}

function onAmountInput(entry: LocalVoucherEntry, rawValue: string) {
  const val = Math.abs(parseFloat(rawValue) || 0);
  entry.amount = entry.isDeduction ? -val : val;
}

const grossAmount = computed(() => {
  return form.entries.reduce((sum, e) => {
    const a = Number(e.amount) || 0;
    return a > 0 ? sum + a : sum;
  }, 0);
});

const deductionsTotal = computed(() => {
  return form.entries.reduce((sum, e) => {
    const a = Number(e.amount) || 0;
    return a < 0 ? sum + Math.abs(a) : sum;
  }, 0);
});

const netAmount = computed(() => {
  return grossAmount.value - deductionsTotal.value;
});

const totalDebit = computed(() => {
  return form.entries.reduce((sum, e) => sum + (Number(e.debitAmount) || 0), 0);
});

const totalCredit = computed(() => {
  return form.entries.reduce((sum, e) => sum + (Number(e.creditAmount) || 0), 0);
});

const isJournalBalanced = computed(() => {
  const db = totalDebit.value;
  const cr = totalCredit.value;
  return db > 0 && Math.abs(db - cr) < 0.01;
});

const isSaveDisabled = computed(() => {
  if (loading.value) return true;
  
  if (form.vtype === 'JOURNAL') {
    if (form.entries.length < 2) return true;
    if (!isJournalBalanced.value) return true;
    return form.entries.some(e => !e.accountHead || ((e.debitAmount || 0) === 0 && (e.creditAmount || 0) === 0));
  } else {
    return !form.mainAccount || form.entries.length === 0 || grossAmount.value === 0 || netAmount.value < 0 || form.entries.some(e => !e.accountHead);
  }
});

const getAccountType = (name: string) => {
  const match = chartOfAccounts.value.find(acc => acc.account_name === name);
  return match ? match.account_type : 'ASSET';
};

function addLine() {
  if (form.vtype === 'JOURNAL') {
    form.entries.push({ accountHead: '', debitAmount: 0, creditAmount: 0, amount: 0, isDeduction: false, laborPeriodId: '' } as any);
  } else {
    form.entries.push({ accountHead: '', amount: 0, isDeduction: false, laborPeriodId: '' });
  }
}

function removeLine(index: number) {
  form.entries.splice(index, 1);
}

async function submitVoucher() {
  if (form.vtype === 'JOURNAL') {
    if (form.entries.length < 2) {
      alert('Journal voucher must contain at least 2 entries');
      return;
    }
    if (form.entries.some(e => !e.accountHead)) {
      alert('All lines must have an account selected');
      return;
    }
    if (!isJournalBalanced.value) {
      alert('Total Debits must equal Total Credits');
      return;
    }
  } else {
    if (!form.mainAccount) {
      alert('Please select a bank/cash account');
      return;
    }
    if (grossAmount.value === 0) {
      alert('Please enter a valid transaction amount');
      return;
    }
    if (netAmount.value < 0) {
      alert('Deductions cannot exceed the gross transaction amount');
      return;
    }
    if (form.entries.some(e => !e.accountHead)) {
      alert('All lines must have an account selected');
      return;
    }
  }

  try {
    let payload: any;
    if (form.vtype === 'JOURNAL') {
      payload = {
        vtype: form.vtype,
        vdate: form.vdate,
        narration: form.narration,
        entries: form.entries
          .filter(e => ((e.debitAmount || 0) > 0 || (e.creditAmount || 0) > 0) && e.accountHead)
          .map(e => ({
            accountHead: e.accountHead,
            accountType: getAccountType(e.accountHead),
            debitAmount: Number(e.debitAmount) || 0,
            creditAmount: Number(e.creditAmount) || 0
          }))
      };
    } else {
      payload = {
        vtype: form.vtype,
        vdate: form.vdate,
        narration: form.narration,
        mainAccount: form.mainAccount,
        entries: form.entries
          .filter(e => Number(e.amount) !== 0 && e.accountHead)
          .map(e => ({
            accountHead: e.accountHead,
            accountType: getAccountType(e.accountHead),
            amount: Number(e.amount) || 0,
            laborPeriodId: e.laborPeriodId || null
          })),
        summary: {
          grossAmount: grossAmount.value,
          deductions: deductionsTotal.value,
          netAmount: netAmount.value
        }
      };
    }

    const result = await createVoucher(payload as any);
    if (result.success) {
      emit('saved');
      emit('update:modelValue', false);
      resetForm();
    }
  } catch (err: any) {
    alert(err.message || 'Failed to create voucher');
  }
}

function resetForm() {
  form.vtype = 'PAYMENT';
  form.narration = '';
  form.mainAccount = bankAccounts.value.find(acc => acc.is_default)?._id || (bankAccounts.value[0]?._id || '');
  form.entries = [
    { accountHead: '', amount: 0, isDeduction: false, laborPeriodId: '' }
  ] as any[];
}
</script>
