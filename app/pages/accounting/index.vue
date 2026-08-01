<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAccounting } from '../../composables/useAccounting';
import VoucherModal from '../../components/accounting/VoucherModal.vue';

useHead({
  title: 'Accounting & Double-Entry Ledger - Suite',
});

const { 
  vouchersSummary, 
  journalSummary, 
  ledgerEntries, 
  loading, 
  fetchVouchersSummary, 
  fetchJournalSummary, 
  fetchLedger 
} = useAccounting();

const showVoucherModal = ref(false);

onMounted(async () => {
  await Promise.all([
    fetchVouchersSummary(),
    fetchJournalSummary(),
    fetchLedger(),
  ]);
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header Title Banner -->
    <header class="flex justify-between items-center bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
      <div>
        <span class="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-500/30">
          Centralized Double-Entry Engine
        </span>
        <h1 class="text-2xl font-black uppercase tracking-tight mt-2">Accounting & Ledger Hub</h1>
        <p class="text-xs text-slate-400 mt-1">Real-time ledger postings, voucher records, and financial status</p>
      </div>
      <div class="flex gap-3">
        <button @click="showVoucherModal = true" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-2xl transition-all shadow-lg flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
          Record Voucher (JV/PV/RV)
        </button>
      </div>
    </header>

    <!-- Top Summary Metrics Grid -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Receipts (30d)</p>
        <h3 class="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">₹{{ (vouchersSummary.total_receipts || 0).toLocaleString('en-IN') }}</h3>
      </div>
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Payments (30d)</p>
        <h3 class="text-xl font-black font-mono text-red-600 dark:text-red-400 mt-1">₹{{ (vouchersSummary.total_payments || 0).toLocaleString('en-IN') }}</h3>
      </div>
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Position</p>
        <h3 class="text-xl font-black font-mono mt-1" :class="(vouchersSummary.net_position || 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-500'">
          ₹{{ (vouchersSummary.net_position || 0).toLocaleString('en-IN') }}
        </h3>
      </div>
      <div class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Journal Entries</p>
        <h3 class="text-xl font-black font-mono text-slate-900 dark:text-white mt-1">{{ journalSummary.total_journal_entries || 0 }}</h3>
      </div>
    </div>

    <!-- Sub-Module Shortcuts Grid -->
    <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
      <NuxtLink to="/accounting/bills" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">📄</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">Invoices</span>
      </NuxtLink>
      <NuxtLink to="/accounting/sales/new" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">💰</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">New Sale</span>
      </NuxtLink>
      <NuxtLink to="/accounting/purchases/new" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">📦</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">New Purchase</span>
      </NuxtLink>
      <NuxtLink to="/accounting/parties" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">👥</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">Parties</span>
      </NuxtLink>
      <NuxtLink to="/accounting/gst-returns" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">📊</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">GST Returns</span>
      </NuxtLink>
      <NuxtLink to="/accounting/trial-balance" class="p-4 bg-white dark:bg-zinc-900 hover:border-indigo-500 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center transition-all group">
        <div class="w-10 h-10 mx-auto rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-600 flex items-center justify-center font-bold mb-2 group-hover:scale-110 transition-transform">⚖️</div>
        <span class="font-bold text-xs text-slate-800 dark:text-zinc-200">Trial Balance</span>
      </NuxtLink>
    </div>

    <!-- Recent Double-Entry Ledger Postings -->
    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 p-6 shadow-sm space-y-4">
      <div class="flex justify-between items-center">
        <div>
          <h2 class="text-lg font-bold text-slate-900 dark:text-white">Recent Ledger Transactions</h2>
          <p class="text-xs text-slate-400">Live feed of posted debit/credit double-entry entries</p>
        </div>
        <NuxtLink to="/accounting/ledger-view" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
          View All Statements →
        </NuxtLink>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3 px-4">Date</th>
              <th class="py-3 px-4">Account Head</th>
              <th class="py-3 px-4">Voucher No</th>
              <th class="py-3 px-4">Type</th>
              <th class="py-3 px-4 text-right">Debit (DR)</th>
              <th class="py-3 px-4 text-right">Credit (CR)</th>
              <th class="py-3 px-4">Narration</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-if="ledgerEntries.length === 0">
              <td colspan="7" class="py-8 text-center text-slate-400 dark:text-zinc-500">
                No ledger transactions found. Create a sale, purchase, or voucher entry to begin.
              </td>
            </tr>
            <tr v-for="entry in ledgerEntries.slice(0, 15)" :key="entry.id || entry.voucherNo + entry.accountHead" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3 px-4 font-mono text-[11px] text-slate-500">{{ entry.transactionDate }}</td>
              <td class="py-3 px-4 font-bold text-slate-900 dark:text-white">{{ entry.accountHead }}</td>
              <td class="py-3 px-4 font-mono text-indigo-600 dark:text-indigo-400 font-bold">#{{ entry.voucherNo || '-' }}</td>
              <td class="py-3 px-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                  {{ entry.voucherType }}
                </span>
              </td>
              <td class="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {{ entry.debitAmount > 0 ? '₹' + entry.debitAmount.toFixed(2) : '-' }}
              </td>
              <td class="py-3 px-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                {{ entry.creditAmount > 0 ? '₹' + entry.creditAmount.toFixed(2) : '-' }}
              </td>
              <td class="py-3 px-4 text-slate-500 truncate max-w-xs">{{ entry.narration || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Voucher Creation Modal -->
    <VoucherModal v-model="showVoucherModal" @saved="fetchLedger" />
  </div>
</template>
