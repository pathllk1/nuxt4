<script setup lang="ts">
import { ref, onMounted } from 'vue';
import PartyModal from '../../components/accounting/PartyModal.vue';

useHead({
  title: 'Parties & Customers Hub - Accounting Suite',
});

const parties = ref<any[]>([]);
const loading = ref(false);
const searchQuery = ref('');
const activeType = ref('ALL');
const showPartyModal = ref(false);

const fetchParties = async () => {
  loading.value = true;
  try {
    const params: any = {};
    if (activeType.value !== 'ALL') params.type = activeType.value;
    if (searchQuery.value) params.search = searchQuery.value;

    const res = await $fetch<{ success: boolean; data: any[] }>('/api/accounting/parties', { query: params });
    if (res.success) {
      parties.value = res.data || [];
    }
  } catch (err) {
    console.error('Failed to fetch parties', err);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchParties();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <header class="flex justify-between items-center bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Customers & Suppliers Hub</h1>
        <p class="text-xs text-slate-400 mt-1">Manage Debtors, Creditors, PAN, and GST Locations</p>
      </div>

      <button @click="showPartyModal = true" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-colors shadow-sm flex items-center gap-1.5">
        + Create New Party
      </button>
    </header>

    <div class="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm flex flex-wrap justify-between items-center gap-4 text-xs">
      <div class="flex gap-1 bg-slate-100 dark:bg-zinc-800 p-1 rounded-xl font-bold">
        <button v-for="type in ['ALL', 'CUSTOMER', 'SUPPLIER']" :key="type" @click="activeType = type; fetchParties()" class="px-3 py-1.5 rounded-lg transition-colors" :class="activeType === type ? 'bg-white dark:bg-zinc-900 text-emerald-600 shadow-sm' : 'text-slate-500'">
          {{ type === 'ALL' ? 'All Parties' : type + 'S' }}
        </button>
      </div>

      <input type="text" v-model="searchQuery" @input="fetchParties" placeholder="Search name, GSTIN, phone..." class="px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
    </div>

    <!-- Parties Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-if="parties.length === 0" class="col-span-3 py-12 text-center text-slate-400 dark:text-zinc-500 text-xs">
        No parties found matching the search criteria.
      </div>
      <div v-for="party in parties" :key="party._id" class="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm hover:border-emerald-500/50 transition-all space-y-3">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-sm text-slate-900 dark:text-white">{{ party.name }}</h3>
            <p class="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{{ party.gstin || 'UNREGISTERED' }}</p>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
            {{ party.partyType || 'CUSTOMER' }}
          </span>
        </div>

        <div class="space-y-1 text-xs text-slate-500 font-semibold">
          <p>Contact: <span class="text-slate-800 dark:text-zinc-200 font-bold">{{ party.contact || '-' }}</span></p>
          <p>State: <span class="text-slate-800 dark:text-zinc-200 font-bold">{{ party.state || '-' }} (Code: {{ party.stateCode || '-' }})</span></p>
          <p class="truncate">Address: <span class="text-slate-800 dark:text-zinc-200 font-bold">{{ party.address || '-' }}</span></p>
        </div>
      </div>
    </div>

    <PartyModal v-model="showPartyModal" @saved="fetchParties" />
  </div>
</template>
