<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useBanking, type BankAccount } from '../../composables/useBanking';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { saveBankAccount, loading } = useBanking();

const form = reactive<BankAccount>({
  account_name: '',
  account_number: '',
  ifsc_code: '',
  bank_name: '',
  branch: '',
  account_type: 'CURRENT',
  opening_balance: 0,
});

const submitBank = async () => {
  if (!form.account_name || !form.account_number) return;
  try {
    const res = await saveBankAccount(form);
    if (res?.success) {
      emit('saved', res.data);
      emit('update:modelValue', false);
    }
  } catch (err: any) {
    console.error('Failed to save bank account', err);
  }
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col">
      <header class="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Add Bank Account</h2>
          <p class="text-xs opacity-80">Link firm bank account or cash ledger</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 space-y-4 text-xs">
        <form @submit.prevent="submitBank" id="bank-modal-form" class="space-y-3">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Display Name *</label>
            <input type="text" v-model="form.account_name" placeholder="e.g. HDFC Main Operating A/C" required class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Bank Name</label>
            <input type="text" v-model="form.bank_name" placeholder="e.g. HDFC Bank Ltd" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Number *</label>
              <input type="text" v-model="form.account_number" required placeholder="50100234567890" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">IFSC Code</label>
              <input type="text" v-model="form.ifsc_code" placeholder="HDFC0001234" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold uppercase outline-none" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Account Type</label>
              <select v-model="form.account_type" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none">
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="OVERDRAFT">Overdraft Account</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Opening Balance (₹)</label>
              <input type="number" step="any" v-model="form.opening_balance" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold text-right outline-none" />
            </div>
          </div>
        </form>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
        <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition-colors">
          Cancel
        </button>
        <button type="submit" form="bank-modal-form" :disabled="loading" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm">
          {{ loading ? 'Saving...' : 'Add Account' }}
        </button>
      </footer>
    </div>
  </div>
</template>
