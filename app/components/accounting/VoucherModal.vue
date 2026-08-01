<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useAccounting, type VoucherEntry } from '../../composables/useAccounting';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { submitVoucher, loading, error } = useAccounting();

const form = reactive({
  vtype: 'PAYMENT',
  vdate: new Date().toISOString().split('T')[0],
  narration: '',
  mainAccount: '',
  entries: [
    { accountHead: 'Salaries & Wages', accountType: 'EXPENSE', debitAmount: 0, creditAmount: 0, narration: '' },
    { accountHead: 'Cash in Hand', accountType: 'CASH', debitAmount: 0, creditAmount: 0, narration: '' },
  ] as VoucherEntry[],
});

const totals = computed(() => {
  return form.entries.reduce((acc, entry) => {
    acc.debit += parseFloat(entry.debitAmount as any) || 0;
    acc.credit += parseFloat(entry.creditAmount as any) || 0;
    return acc;
  }, { debit: 0, credit: 0 });
});

const isBalanced = computed(() => {
  return Math.abs(totals.value.debit - totals.value.credit) < 0.01 && totals.value.debit > 0;
});

const addRow = () => {
  form.entries.push({
    accountHead: '',
    accountType: 'GENERAL',
    debitAmount: 0,
    creditAmount: 0,
    narration: '',
  });
};

const removeRow = (index: number) => {
  form.entries.splice(index, 1);
};

const saveVoucher = async () => {
  if (!isBalanced.value) {
    alert('Total Debit must equal Total Credit!');
    return;
  }
  try {
    const res = await submitVoucher(form);
    if (res?.success) {
      emit('saved', res.data);
      emit('update:modelValue', false);
    }
  } catch (err: any) {
    console.error('Voucher save failed', err);
  }
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
      <header class="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 px-8 py-5 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-xl font-black uppercase tracking-tight">Record Voucher Entry</h2>
          <p class="text-xs opacity-80">Double-entry accounting journal transaction</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 overflow-y-auto flex-1 space-y-5 text-xs text-slate-800 dark:text-zinc-200">
        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Voucher Type</label>
            <select v-model="form.vtype" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none">
              <option value="PAYMENT">Payment Voucher</option>
              <option value="RECEIPT">Receipt Voucher</option>
              <option value="JOURNAL">Journal Entry</option>
              <option value="CONTRA">Contra Entry</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Transaction Date</label>
            <input type="date" v-model="form.vdate" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <div class="px-3 py-2 rounded-xl font-bold text-center border" :class="isBalanced ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'">
              {{ isBalanced ? '✓ Balanced (DR = CR)' : '⚠ Unbalanced' }}
            </div>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wider">Debit & Credit Entries</h3>
            <button type="button" @click="addRow" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              + Add Line
            </button>
          </div>

          <div class="space-y-2">
            <div v-for="(entry, index) in form.entries" :key="index" class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700 grid grid-cols-12 gap-2 items-center">
              <div class="col-span-5">
                <input type="text" v-model="entry.accountHead" placeholder="Account Head (e.g. Sales, Cash)" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold text-xs" />
              </div>
              <div class="col-span-3">
                <input type="number" step="any" v-model="entry.debitAmount" placeholder="Debit (₹)" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-right font-mono font-bold text-xs" />
              </div>
              <div class="col-span-3">
                <input type="number" step="any" v-model="entry.creditAmount" placeholder="Credit (₹)" class="w-full px-2.5 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-right font-mono font-bold text-xs" />
              </div>
              <div class="col-span-1 text-center">
                <button type="button" @click="removeRow(index)" class="text-slate-400 hover:text-red-500 transition-colors p-1">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Narration / Notes</label>
          <textarea v-model="form.narration" rows="2" placeholder="Voucher narration details..." class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"></textarea>
        </div>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-between items-center">
        <div class="text-xs font-mono font-bold text-slate-600 dark:text-zinc-400">
          DR: ₹{{ totals.debit.toFixed(2) }} | CR: ₹{{ totals.credit.toFixed(2) }}
        </div>
        <div class="flex gap-2">
          <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition-colors">
            Cancel
          </button>
          <button type="button" :disabled="!isBalanced || loading" @click="saveVoucher" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm disabled:opacity-50">
            {{ loading ? 'Posting...' : 'Post Voucher' }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
