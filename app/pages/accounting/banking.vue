<template>
  <div class="p-4 py-3 max-w-[1600px] mx-auto space-y-3">
    <!-- Header Section -->
    <div class="flex justify-between items-end mb-1">
      <div>
        <div class="flex items-center gap-2 mb-0.5">
           <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
           <span class="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest leading-none">Financial Treasury</span>
        </div>
        <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">Banking Hub</h1>
        <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">Manage bank accounts and monitor real-time treasury balances</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton 
          color="success" 
          variant="outline" 
          icon="i-heroicons-plus"
          label="Add Bank Account"
          size="sm"
          class="font-bold text-xs h-8"
          @click="openCreateModal"
        />
        <UButton 
          color="neutral" 
          variant="outline" 
          icon="i-heroicons-arrow-left"
          size="sm"
          class="font-bold text-xs h-8"
          @click="$router.push('/accounting')"
        />
      </div>
    </div>

    <!-- KPI Strip -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <UCard class="border-l-4 border-l-blue-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Total Accounts</p>
        <div class="text-lg font-black text-slate-900 dark:text-white leading-tight">{{ accounts.length }}</div>
      </UCard>
      <UCard class="border-l-4 border-l-emerald-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Active Liquidity</p>
        <div class="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">₹{{ totalLiquidity.toLocaleString() }}</div>
      </UCard>
      <UCard class="border-l-4 border-l-violet-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Default Channel</p>
        <div class="text-xs font-black text-slate-900 dark:text-white truncate leading-tight mt-0.5">{{ defaultAccount?.bank_name || 'Not Set' }}</div>
      </UCard>
      <UCard class="border-l-4 border-l-amber-500 shadow-sm rounded-xl" :ui="{ body: 'p-3 py-2.5' }">
        <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Linked COA Heads</p>
        <div class="text-lg font-black text-slate-900 dark:text-white leading-tight">{{ accounts.length }}</div>
      </UCard>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 gap-3.5" :class="selectedHistoryAcc ? 'lg:grid-cols-3' : ''">
       <!-- Accounts List -->
       <div :class="selectedHistoryAcc ? 'lg:col-span-2' : ''" class="space-y-3">
          <!-- Loader -->
          <UCard v-if="loading" class="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-10' }">
             <div class="flex flex-col items-center justify-center gap-3">
                <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
                <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">Loading bank accounts...</p>
             </div>
          </UCard>

          <template v-else>
             <UCard v-for="acc in accountsWithBalances" :key="acc._id" class="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800 hover:shadow-md transition-all group" :ui="{ body: 'p-4' }">
                <div class="flex flex-col md:flex-row justify-between gap-4">
                   <div class="flex gap-4">
                      <div class="w-12 h-12 rounded-xl bg-slate-50 dark:bg-zinc-800/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-950/20 group-hover:text-blue-500 transition-colors shrink-0">
                         <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                      </div>
                      <div>
                         <div class="flex items-center gap-2 mb-0.5">
                            <h3 class="text-base font-black text-slate-900 dark:text-white leading-snug">{{ acc.account_name }}</h3>
                            <UBadge v-if="acc.is_default" color="success" variant="subtle" size="sm" class="font-black text-[8px] tracking-wider rounded px-1.5 py-0">Primary</UBadge>
                            <UBadge :color="acc.status === 'ACTIVE' ? 'primary' : 'neutral'" variant="subtle" size="sm" class="font-black text-[8px] tracking-wider rounded px-1.5 py-0">{{ acc.status }}</UBadge>
                         </div>
                         <p class="text-xs font-bold text-slate-500 dark:text-zinc-400">{{ acc.bank_name }} <span class="text-slate-300 dark:text-zinc-700 mx-1.5">|</span> {{ acc.branch_name }}</p>
                         <div class="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-2">
                            <div>
                               <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase">Account Number</p>
                               <p class="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono leading-none">{{ acc.account_number }}</p>
                            </div>
                            <div>
                               <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase">IFSC Code</p>
                               <p class="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono leading-none">{{ acc.ifsc_code }}</p>
                            </div>
                         </div>
                      </div>
                   </div>
                   <div class="flex flex-col items-start md:items-end justify-between gap-3 md:min-w-[180px]">
                      <div class="md:text-right">
                         <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-0.5">Current Balance</p>
                         <div class="text-lg font-black font-mono leading-none" :class="acc.balanceType === 'DR' ? 'text-emerald-600' : 'text-rose-600'">
                            ₹{{ acc.balance?.toLocaleString() || '0' }}
                            <span class="text-[9px] ml-0.5 font-bold uppercase">{{ acc.balanceType }}</span>
                         </div>
                      </div>
                      <div class="flex gap-1.5">
                         <UButton 
                           icon="i-heroicons-clock" 
                           color="neutral" 
                           variant="soft" 
                           size="xs" 
                           class="font-bold rounded-lg"
                           title="Transaction History"
                           @click="viewHistory(acc._id)"
                         />
                         <UButton 
                           icon="i-heroicons-pencil-square" 
                           color="neutral" 
                           variant="soft" 
                           size="xs" 
                           class="font-bold rounded-lg"
                           @click="openEditModal(acc)"
                         />
                         <UButton 
                           icon="i-heroicons-trash" 
                           color="error" 
                           variant="soft" 
                           size="xs" 
                           class="font-bold rounded-lg"
                           @click="confirmDelete(acc)"
                         />
                      </div>
                   </div>
                </div>
             </UCard>

             <div v-if="accounts.length === 0" class="bg-slate-50 dark:bg-zinc-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-800 py-12 text-center">
                <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
                   <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                </div>
                <h3 class="text-base font-black text-slate-900 dark:text-white tracking-tight">No Bank Accounts Found</h3>
                <p class="text-xs text-slate-500 dark:text-zinc-400 max-w-xs mx-auto mt-1 font-medium">Create your first bank account to enable bank-based vouchers and professional invoice printing.</p>
                <UButton @click="openCreateModal" color="primary" class="mt-4 px-6 font-bold text-xs" label="Add First Account" />
             </div>
          </template>
       </div>

       <!-- Transaction History Drawer/Sidebar -->
       <div v-if="selectedHistoryAcc" class="space-y-3">
          <UCard class="shadow-sm rounded-xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-4' }">
             <div class="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-zinc-800 pb-2">
                <h3 class="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Recent Activity</h3>
                <UButton 
                  icon="i-heroicons-x-mark" 
                  color="neutral" 
                  variant="ghost" 
                  size="xs" 
                  @click="selectedHistoryAcc = null" 
                />
             </div>
             <div v-if="historyLoading" class="flex justify-center py-6">
                <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-primary" />
             </div>
             <div v-else-if="history.length" class="space-y-2.5">
                <div v-for="h in history" :key="h._id" class="flex items-start justify-between gap-3 pb-2 border-b border-slate-50 dark:border-zinc-800/40 last:border-0">
                   <div>
                      <p class="text-[8px] font-black text-slate-400 dark:text-zinc-500 uppercase font-mono">{{ h.transactionDate }}</p>
                      <p class="text-xs font-bold text-slate-900 dark:text-zinc-300 line-clamp-1 leading-snug">{{ h.narration }}</p>
                   </div>
                   <p class="text-xs font-black font-mono whitespace-nowrap leading-none mt-1" :class="h.debitAmount > 0 ? 'text-emerald-600' : 'text-rose-600'">
                      {{ h.debitAmount > 0 ? '+' : '-' }} ₹{{ (h.debitAmount || h.creditAmount).toLocaleString() }}
                   </p>
                </div>
             </div>
             <p v-else class="text-xs text-slate-400 dark:text-zinc-500 font-medium text-center py-4 italic">No recent transactions</p>
          </UCard>
       </div>
    </div>

    <!-- Banking Modal -->
    <BankingModal v-model="showModal" :edit-data="selectedAcc" @saved="fetchData" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@/utils/api';
import BankingModal from '@/components/accounting/BankingModal.vue';

const api = useApi();
const accounts = ref<any[]>([]);
const balances = ref<Record<string, any>>({});
const history = ref<any[]>([]);
const historyLoading = ref(false);
const selectedHistoryAcc = ref<string | null>(null);

const showModal = ref(false);
const selectedAcc = ref<any>(null);
const loading = ref(false);

const fetchData = async () => {
  loading.value = true;
  try {
    const res = await api.get('/banking');
    if (res.success) {
      accounts.value = res.data;
      await Promise.all(accounts.value.map(async (acc) => {
        const balRes = await api.get(`/banking/${acc._id}`);
        if (balRes.success) {
          balances.value[acc._id] = balRes.data;
        }
      }));
    }
  } catch (err) {
    console.error('Failed to fetch accounts', err);
  } finally {
    loading.value = false;
  }
};

onMounted(fetchData);

const accountsWithBalances = computed(() => {
  return accounts.value.map(acc => ({
    ...acc,
    ...(balances.value[acc._id] || { balance: 0, balanceType: 'DR' })
  }));
});

const totalLiquidity = computed(() => {
  return accountsWithBalances.value.reduce((sum, acc) => {
    return acc.balanceType === 'DR' ? sum + acc.balance : sum - acc.balance;
  }, 0);
});

const defaultAccount = computed(() => accounts.value.find(a => a.is_default));

function openCreateModal() {
  selectedAcc.value = null;
  showModal.value = true;
}

function openEditModal(acc: any) {
  selectedAcc.value = acc;
  showModal.value = true;
}

async function viewHistory(id: string) {
  selectedHistoryAcc.value = id;
  historyLoading.value = true;
  try {
    const res = await api.get(`/banking/${id}/history`);
    if (res.success) {
      history.value = res.data;
    }
  } catch (err) {
    console.error('Failed to fetch history', err);
  } finally {
    historyLoading.value = false;
  }
}

async function confirmDelete(acc: any) {
  if (confirm(`Delete bank account "${acc.account_name}"? This action cannot be undone.`)) {
    try {
      const res = await api.delete(`/banking/${acc._id}`);
      if (res.success) {
        fetchData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete account');
    }
  }
}
</script>
