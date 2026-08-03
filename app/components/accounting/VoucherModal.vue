<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-zinc-800">
      <!-- Header -->
      <div class="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-4 flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold">{{ form.vtype === 'PAYMENT' ? 'Payment Voucher' : form.vtype === 'RECEIPT' ? 'Receipt Voucher' : 'Journal Entry' }}</h2>
          <p class="text-xs text-blue-100 mt-0.5">Create financial transaction</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors">
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
            <input v-model="form.vdate" type="date" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <!-- Voucher Type -->
          <div>
            <label class="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">Type</label>
            <select v-model="form.vtype" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="PAYMENT">Payment Out</option>
              <option value="RECEIPT">Receipt In</option>
              <option value="JOURNAL">Journal Entry</option>
            </select>
          </div>
          <div></div>
        </div>

        <!-- Primary Account Selection -->
        <div v-if="form.vtype !== 'JOURNAL'" class="p-3 bg-blue-50/60 dark:bg-blue-950/20 border-2 border-blue-400/50 dark:border-blue-800/50 rounded-xl">
          <label class="block text-xs font-bold text-blue-900 dark:text-blue-300 mb-2">
            {{ form.vtype === 'PAYMENT' ? '💳 PAID FROM' : form.vtype === 'RECEIPT' ? '💰 RECEIPT TO' : '📝 ACCOUNT' }}
          </label>
          <select v-model="form.mainAccount" class="w-full px-3 py-2 text-sm font-semibold border-2 border-blue-300 dark:border-blue-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white dark:bg-zinc-800 dark:text-white">
            <option value="">-- Select Account --</option>
            <optgroup label="💳 Bank Accounts" v-if="bankAccounts.length">
              <option v-for="account in bankAccounts" :key="account._id" :value="account._id">
                {{ account.account_name }} ({{ account.bank_name }})
              </option>
            </optgroup>
            <optgroup label="💰 Cash Accounts" v-if="cashAccounts.length">
              <option v-for="acc in cashAccounts" :key="acc._id" :value="acc.account_name">
                {{ acc.account_name }}
              </option>
            </optgroup>
            <optgroup label="📊 Other Liquid Accounts" v-if="otherLiquidAccounts.length">
              <option v-for="acc in otherLiquidAccounts" :key="acc._id" :value="acc.account_name">
                {{ acc.account_name }}
              </option>
            </optgroup>
          </select>
        </div>

        <!-- Transaction Lines -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-xs font-bold text-slate-700 dark:text-zinc-300">TRANSACTION DETAILS</h3>
            <button @click="addLine" class="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors font-medium">
              + Add Line
            </button>
          </div>

          <div class="space-y-2">
            <!-- Column Headers for Journal -->
            <div v-if="form.vtype === 'JOURNAL'" class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
              <div class="col-span-5">Account Head</div>
              <div class="col-span-3 text-right">Debit (Dr)</div>
              <div class="col-span-3 text-right">Credit (Cr)</div>
              <div class="col-span-1"></div>
            </div>
            <!-- Column Headers for Payment/Receipt -->
            <div v-else class="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-600 dark:text-zinc-400 mb-1 px-1">
              <div class="col-span-5">Account / Payee</div>
              <div class="col-span-4 text-right">Amount</div>
              <div class="col-span-2 text-center">Type</div>
              <div class="col-span-1"></div>
            </div>

            <!-- Transaction Lines -->
            <div v-for="(entry, index) in form.entries" :key="index" class="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 dark:bg-zinc-850 rounded-xl border border-slate-200 dark:border-zinc-800 hover:border-blue-300 transition-colors">
              <!-- Account Selection -->
              <select v-model="entry.accountHead" class="col-span-5 px-2 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white">
                <option value="">-- Select Account --</option>
                <option v-for="account in chartOfAccounts" :key="account._id" :value="account.account_name">
                  {{ account.account_name }}
                </option>
              </select>

              <!-- Journal Inputs -->
              <template v-if="form.vtype === 'JOURNAL'">
                <input 
                  v-model.number="entry.debitAmount" 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01" 
                  @input="onDebitInput(entry)"
                  class="col-span-3 px-2 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white" 
                />
                <input 
                  v-model.number="entry.creditAmount" 
                  type="number" 
                  placeholder="0.00" 
                  step="0.01" 
                  @input="onCreditInput(entry)"
                  class="col-span-3 px-2 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white" 
                />
              </template>

              <!-- Payment/Receipt Inputs -->
              <template v-else>
                <input v-model.number="entry.amount" type="number" placeholder="0.00" step="0.01" class="col-span-4 px-2 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white" />
                <select v-model="entry.type" class="col-span-2 px-2 py-1.5 text-xs border border-slate-300 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white">
                  <option value="MAIN">Main</option>
                  <option value="DEDUCTION">Ded</option>
                  <option value="TAX">Tax</option>
                  <option value="OTHER">Other</option>
                </select>
              </template>

              <!-- Delete Button -->
              <button v-if="form.entries.length > (form.vtype === 'JOURNAL' ? 2 : 1)" @click="removeLine(index)" class="col-span-1 text-red-500 hover:text-red-700 font-bold transition-colors text-center text-sm" title="Remove">
                ×
              </button>
              <div v-else class="col-span-1"></div>
            </div>
          </div>
        </div>

        <!-- Narration -->
        <div>
          <label class="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1">Notes / Narration</label>
          <textarea v-model="form.narration" placeholder="Enter transaction details..." class="w-full px-3 py-2 text-xs border border-slate-300 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-800 dark:text-white resize-none" rows="2"></textarea>
        </div>

        <!-- Summary Section -->
        <div v-if="form.vtype === 'JOURNAL'" class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-850 p-4 rounded-xl border border-blue-200 dark:border-zinc-700">
          <div class="flex justify-between items-center">
            <div class="flex gap-8">
              <div>
                <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Total Debit (Dr)</p>
                <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">₹ {{ totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              </div>
              <div>
                <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold uppercase tracking-wider">Total Credit (Cr)</p>
                <p class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">₹ {{ totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</p>
              </div>
            </div>
            <div class="text-right">
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase" :class="isJournalBalanced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'">
                {{ isJournalBalanced ? '✓ Balanced' : `Unbalanced: ₹${Math.abs(totalDebit - totalCredit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }}
              </span>
            </div>
          </div>
        </div>
        <div v-else class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-zinc-800 dark:to-zinc-850 p-4 rounded-xl border border-blue-200 dark:border-zinc-700">
          <div class="grid grid-cols-4 gap-3">
            <div>
              <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold">Main</p>
              <p class="text-lg font-bold text-blue-600 dark:text-blue-400 font-mono">₹ {{ mainAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold">Deductions</p>
              <p class="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono">₹ {{ deductionsTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}</p>
            </div>
            <div>
              <p class="text-[10px] text-slate-600 dark:text-zinc-400 font-semibold">Tax</p>
              <p class="text-lg font-bold text-orange-600 dark:text-orange-400 font-mono">₹ {{ taxTotal.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}</p>
            </div>
            <div class="border-l-2 border-blue-300 dark:border-zinc-700 pl-3">
              <p class="text-[10px] text-slate-700 dark:text-zinc-300 font-bold">NET AMOUNT</p>
              <p class="text-2xl font-black text-green-600 dark:text-green-400 font-mono">₹ {{ netAmount.toLocaleString(undefined, { maximumFractionDigits: 0 }) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="bg-slate-100 dark:bg-zinc-850 border-t border-slate-200 dark:border-zinc-800 p-4 flex justify-end gap-2">
        <button @click="$emit('update:modelValue', false)" class="px-4 py-2 text-xs font-bold text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-colors">
          Cancel
        </button>
        <button @click="submitVoucher" :disabled="isSaveDisabled" class="px-6 py-2 text-xs font-bold bg-green-600 hover:bg-green-700 disabled:bg-slate-400 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2">
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

interface LocalVoucherEntry {
  accountHead: string;
  amount: number;
  type: 'MAIN' | 'DEDUCTION' | 'TAX' | 'OTHER';
  debitAmount?: number;
  creditAmount?: number;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { createVoucher, loading, fetchCOA, chartOfAccounts } = useAccounting();
const { fetchBankAccounts, bankAccounts } = useBanking();

const form = reactive({
  mainAccount: '',
  vtype: 'PAYMENT',
  vdate: new Date().toISOString().split('T')[0],
  narration: '',
  entries: [
    { accountHead: '', amount: 0, type: 'MAIN' }
  ] as LocalVoucherEntry[]
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

watch(() => form.vtype, (newType) => {
  if (newType === 'JOURNAL') {
    form.mainAccount = '';
    form.entries = [
      { accountHead: '', debitAmount: 0, creditAmount: 0, type: 'OTHER', amount: 0 },
      { accountHead: '', debitAmount: 0, creditAmount: 0, type: 'OTHER', amount: 0 }
    ] as any[];
  } else {
    const defaultBank = bankAccounts.value.find(acc => acc.is_default);
    form.mainAccount = defaultBank ? defaultBank._id : '';
    form.entries = [
      { accountHead: '', amount: 0, type: 'MAIN' }
    ] as any[];
  }
});

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

onMounted(async () => {
  await Promise.all([
    fetchCOA(),
    fetchBankAccounts()
  ]);
  
  const defaultBank = bankAccounts.value.find(acc => acc.is_default);
  if (defaultBank) {
    form.mainAccount = defaultBank._id;
  }
});

const mainAccountHeads = computed(() => {
  const cashLikeTypes = ['BANK', 'CASH', 'ASSET', 'CASH_IN_HAND', 'BANK_ACCOUNT', 'CURRENT_ASSET'];
  return chartOfAccounts.value.filter(acc => {
    const type = acc.account_type?.toUpperCase() || '';
    const name = acc.account_name?.toUpperCase() || '';
    return cashLikeTypes.some(t => type.includes(t)) || 
           name.includes('CASH') || 
           name.includes('BANK') ||
           name.includes('HAND');
  });
});

const cashAccounts = computed(() => {
  return mainAccountHeads.value.filter(acc => {
    const type = acc.account_type?.toUpperCase() || '';
    const name = acc.account_name?.toUpperCase() || '';
    return type.includes('CASH') || 
           type.includes('CASH_IN_HAND') ||
           name.includes('CASH') || 
           name.includes('HAND') ||
           name === 'CASH';
  });
});

const otherLiquidAccounts = computed(() => {
  return mainAccountHeads.value.filter(acc => {
    const type = acc.account_type?.toUpperCase() || '';
    const isCash = cashAccounts.value.includes(acc);
    return !isCash && type !== 'BANK' && type !== 'BANK_ACCOUNT';
  });
});

const mainAmount = computed(() => {
  return form.entries
    .filter(e => e.type === 'MAIN')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
});

const deductionsTotal = computed(() => {
  return form.entries
    .filter(e => e.type === 'DEDUCTION')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
});

const taxTotal = computed(() => {
  return form.entries
    .filter(e => e.type === 'TAX')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
});

const otherTotal = computed(() => {
  return form.entries
    .filter(e => e.type === 'OTHER')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
});

const netAmount = computed(() => {
  return mainAmount.value - deductionsTotal.value + taxTotal.value + otherTotal.value;
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
    return !form.mainAccount || form.entries.length === 0 || mainAmount.value === 0 || form.entries.some(e => !e.accountHead);
  }
});

const getAccountType = (name: string) => {
  const match = chartOfAccounts.value.find(acc => acc.account_name === name);
  return match ? match.account_type : 'ASSET';
};

function addLine() {
  if (form.vtype === 'JOURNAL') {
    form.entries.push({ accountHead: '', debitAmount: 0, creditAmount: 0, type: 'OTHER', amount: 0 } as any);
  } else {
    form.entries.push({ accountHead: '', amount: 0, type: 'MAIN' });
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
    if (mainAmount.value === 0) {
      alert('Please enter a main transaction amount');
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
        entries: form.entries.filter(e => e.amount > 0 && e.accountHead),
        summary: {
          mainAmount: mainAmount.value,
          deductions: deductionsTotal.value,
          tax: taxTotal.value,
          other: otherTotal.value,
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
  form.mainAccount = bankAccounts.value.find(acc => acc.is_default)?._id || '';
  form.entries = [
    { accountHead: '', amount: 0, type: 'MAIN' }
  ] as any[];
}
</script>
