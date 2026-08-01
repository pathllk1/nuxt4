<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useBanking } from '../../composables/useBanking';
import BankingModal from '../../components/accounting/BankingModal.vue';

useHead({
  title: 'Banking & Liquid Funds Hub - Suite',
});

const { bankAccounts, liquidBalance, fetchBankAccounts } = useBanking();
const showBankModal = ref(false);

onMounted(() => {
  fetchBankAccounts();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <header class="flex justify-between items-center bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
      <div>
        <span class="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-500/30">
          Liquid Asset Management
        </span>
        <h1 class="text-2xl font-black uppercase tracking-tight mt-2">Banking & Cash Hub</h1>
        <p class="text-xs text-slate-400 mt-1">Manage firm bank accounts, liquid balance, and IFSC codes</p>
      </div>

      <button @click="showBankModal = true" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2">
        + Add Bank Account
      </button>
    </header>

    <!-- Liquid Balance Card -->
    <div class="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm flex justify-between items-center">
      <div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Liquid Funds Across Accounts</p>
        <h2 class="text-3xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">₹{{ liquidBalance.toLocaleString('en-IN') }}</h2>
      </div>
      <div class="text-right text-xs text-slate-500 font-bold">
        <p>Active Accounts: {{ bankAccounts.length }}</p>
      </div>
    </div>

    <!-- Bank Accounts Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-if="bankAccounts.length === 0" class="col-span-3 py-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
        No bank accounts registered. Click "+ Add Bank Account" to link your primary firm bank account.
      </div>
      <div v-for="acc in bankAccounts" :key="acc._id" class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-white">{{ acc.account_name }}</h3>
            <p class="text-xs text-slate-400 font-mono">{{ acc.bank_name || 'Bank Account' }}</p>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400">
            {{ acc.account_type }}
          </span>
        </div>

        <div class="space-y-1 text-xs text-slate-500 font-semibold pt-2 border-t border-slate-100 dark:border-zinc-800">
          <p>Account No: <span class="font-mono text-slate-900 dark:text-white font-bold">{{ acc.account_number }}</span></p>
          <p>IFSC: <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold uppercase">{{ acc.ifsc_code || '-' }}</span></p>
          <p>Opening Balance: <span class="font-mono text-slate-900 dark:text-white font-bold">₹{{ acc.opening_balance }}</span></p>
        </div>
      </div>
    </div>

    <BankingModal v-model="showBankModal" @saved="fetchBankAccounts" />
  </div>
</template>
