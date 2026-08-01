<script setup lang="ts">
import { ref, onMounted } from 'vue';

useHead({
  title: 'Chart of Accounts Hierarchy - Suite',
});

const accounts = ref<any[]>([]);
const loading = ref(false);

const fetchCOA = async () => {
  loading.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/coa');
    if (res.success) {
      accounts.value = res.data || [];
    }
  } catch (err) {
    console.error('Failed to fetch COA', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchCOA();
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Chart of Accounts Hierarchy</h1>
        <p class="text-xs text-slate-400 mt-1">System & custom ledger account heads classification</p>
      </div>

      <button @click="fetchCOA" class="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors">
        Refresh COA
      </button>
    </header>

    <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-200 dark:border-zinc-800 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="bg-slate-100/70 dark:bg-zinc-800/80 text-slate-500 dark:text-zinc-400 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-zinc-800">
              <th class="py-3.5 px-4">Account Head</th>
              <th class="py-3.5 px-4">Account Category / Type</th>
              <th class="py-3.5 px-4 text-center">System Head</th>
              <th class="py-3.5 px-4 text-center">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">
            <tr v-for="acc in accounts" :key="acc._id" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/40">
              <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{{ acc.account_name }}</td>
              <td class="py-3.5 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">{{ acc.account_type }}</td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase" :class="acc.is_system ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400' : 'bg-slate-100 text-slate-700'">
                  {{ acc.is_system ? 'SYSTEM' : 'CUSTOM' }}
                </span>
              </td>
              <td class="py-3.5 px-4 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  ACTIVE
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
