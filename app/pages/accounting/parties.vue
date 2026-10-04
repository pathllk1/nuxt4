<template>
  <div class="p-4 py-3 w-full mx-auto space-y-3 font-sans">
    <!-- Header Section -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-user-group" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-xl font-black tracking-tight uppercase text-gray-900 leading-none">Parties Hub</h1>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
              Directory
            </span>
          </div>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">
            Manage suppliers, customers, and business partners
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 bg-slate-100 py-1 rounded-md">
          Total: {{ parties.length }} Parties
        </span>
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          size="sm"
          label="Create Party"
          class="font-bold text-xs h-8 shadow-xs cursor-pointer"
          @click="openCreateParty"
        />
      </div>
    </div>

    <!-- Quick Filter Category Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
      <button
        @click="typeFilter = 'ALL'"
        class="p-2 rounded-xl border text-left transition cursor-pointer text-xs font-bold flex items-center justify-between"
        :class="typeFilter === 'ALL'
          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'"
      >
        <span>All Parties</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded" :class="typeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'">
          {{ parties.length }}
        </span>
      </button>

      <button
        @click="typeFilter = 'SUPPLIER'"
        class="p-2 rounded-xl border text-left transition cursor-pointer text-xs font-bold flex items-center justify-between"
        :class="typeFilter === 'SUPPLIER'
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
          : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-50/50'"
      >
        <span>Suppliers</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded" :class="typeFilter === 'SUPPLIER' ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-700'">
          {{ countByType('SUPPLIER') }}
        </span>
      </button>

      <button
        @click="typeFilter = 'CUSTOMER'"
        class="p-2 rounded-xl border text-left transition cursor-pointer text-xs font-bold flex items-center justify-between"
        :class="typeFilter === 'CUSTOMER'
          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
          : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-50/50'"
      >
        <span>Customers</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded" :class="typeFilter === 'CUSTOMER' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'">
          {{ countByType('CUSTOMER') }}
        </span>
      </button>

      <button
        @click="typeFilter = 'BOTH'"
        class="p-2 rounded-xl border text-left transition cursor-pointer text-xs font-bold flex items-center justify-between"
        :class="typeFilter === 'BOTH'
          ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
          : 'bg-white text-purple-900 border-purple-200 hover:bg-purple-50/50'"
      >
        <span>Both (Cust & Supp)</span>
        <span class="text-[10px] px-1.5 py-0.2 rounded" :class="typeFilter === 'BOTH' ? 'bg-white/20 text-white' : 'bg-purple-50 text-purple-700'">
          {{ countByType('BOTH') }}
        </span>
      </button>
    </div>

    <!-- Search & Filters Section -->
    <div class="bg-white p-2.5 rounded-xl shadow-xs border border-slate-200 mb-2 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex-1 w-full max-w-xl">
        <UInput 
          v-model="searchQuery" 
          placeholder="Search by name, GSTIN, PAN, or state..." 
          icon="i-heroicons-magnifying-glass"
          size="sm"
          class="w-full" 
        />
      </div>
      <div class="w-full sm:w-48">
        <USelect 
          v-model="typeFilter" 
          :items="typeOptions" 
          placeholder="Filter Type"
          size="sm"
          class="w-full" 
        />
      </div>
    </div>

    <!-- Loader -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-xl border border-slate-200 shadow-xs">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500">Loading parties directory...</p>
    </div>

    <!-- Parties Grid with Dynamic Nuxt UI Colors -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <UCard 
        v-for="party in filteredParties" 
        :key="party._id" 
        class="transition-all flex flex-col border border-slate-200 shadow-xs rounded-xl overflow-hidden hover:shadow-md"
        :class="getPartyTheme(party).hoverBorder"
        :ui="{ 
          body: 'p-3 flex-1 flex flex-col space-y-2',
          header: 'p-3 py-2.5 border-b border-slate-100 ' + getPartyTheme(party).headerBg,
          footer: 'p-2 px-3 bg-slate-50/70 border-t border-slate-100 flex gap-2'
        }"
      >
        <template #header>
          <div class="flex items-start gap-2.5">
            <!-- Dynamic Avatar in Nuxt UI Theme Color -->
            <div 
              :class="[
                'w-10 h-10 rounded-xl text-white flex items-center justify-center font-black text-lg shadow-xs shrink-0',
                getPartyTheme(party).avatarBg
              ]"
            >
              {{ (party.name || 'P')[0]?.toUpperCase() }}
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-xs text-slate-900 truncate leading-snug" :title="party.name">
                {{ party.name }}
              </h3>
              <p class="text-[10px] text-slate-500 truncate leading-snug mt-0.5" :title="party.address">
                {{ party.address || 'No address registered' }}
              </p>
            </div>
          </div>
        </template>

        <div class="flex-1 space-y-2 text-xs">
          <!-- GSTIN / Status Row -->
          <div>
            <p class="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">GSTIN / Status</p>
            <div class="bg-slate-50 border border-slate-200/80 rounded-lg px-2 py-1 flex items-center justify-between">
              <p class="font-mono font-bold text-slate-800 text-[11px] truncate mr-1">
                {{ party.gstin || 'UNREGISTERED' }}
              </p>
              <UBadge 
                size="sm" 
                variant="subtle" 
                :color="getPartyTypeColor(party.partyType)"
                class="text-[9px] px-1.5 py-0 font-bold uppercase tracking-wider rounded shrink-0"
              >
                {{ party.partyType }}
              </UBadge>
            </div>
          </div>

          <!-- State and PAN in 2 columns -->
          <div class="grid grid-cols-2 gap-2">
            <div class="bg-slate-50 rounded-lg p-1.5 border border-slate-200/80">
              <p class="text-[8px] font-bold uppercase text-slate-400 mb-0.5">State</p>
              <p class="font-semibold text-slate-800 text-[10px] truncate">{{ party.state || '—' }}</p>
            </div>
            <div class="bg-slate-50 rounded-lg p-1.5 border border-slate-200/80">
              <p class="text-[8px] font-bold uppercase text-slate-400 mb-0.5">PAN</p>
              <p class="font-mono font-bold text-slate-800 text-[10px] truncate uppercase">{{ party.pan || '—' }}</p>
            </div>
          </div>
        </div>

        <template #footer>
          <!-- Dynamic Edit Button in Nuxt UI Color -->
          <UButton 
            size="xs" 
            :color="getPartyTheme(party).color" 
            variant="solid"
            label="Edit Details" 
            class="flex-1 font-bold text-[10px] h-7 cursor-pointer justify-center shadow-xs"
            @click="openEditParty(party)"
          />
        </template>
      </UCard>
      
      <!-- Empty State -->
      <div v-if="filteredParties.length === 0" class="col-span-full py-16 text-center bg-white rounded-xl border border-slate-200 shadow-xs">
         <div class="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-400">
            <UIcon name="i-heroicons-user-group" class="w-6 h-6" />
         </div>
         <h3 class="text-slate-600 text-xs font-bold uppercase tracking-wider">No Parties Found</h3>
         <p class="text-slate-400 text-[10px] mt-1">Try adjusting your search query or type filters</p>
      </div>
    </div>

    <!-- Modals -->
    <PartyModal 
      v-model="showCreateModal" 
      :initial-data="selectedParty" 
      @saved="fetchParties" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useBilling } from '@/composables/useBilling';
import PartyModal from '@/components/accounting/PartyModal.vue';

const { parties, fetchParties, loading } = useBilling();

const searchQuery = ref('');
const typeFilter = ref('ALL');
const showCreateModal = ref(false);
const selectedParty = ref<any>(null);

function openCreateParty() {
  selectedParty.value = null;
  showCreateModal.value = true;
}

function openEditParty(party: any) {
  selectedParty.value = party;
  showCreateModal.value = true;
}

const typeOptions = [
  { label: 'All Types', value: 'ALL' },
  { label: 'Customers', value: 'CUSTOMER' },
  { label: 'Suppliers', value: 'SUPPLIER' },
  { label: 'Both', value: 'BOTH' }
];

function countByType(type: string) {
  return parties.value.filter(p => p.partyType === type).length;
}

export type NuxtUIColor = 'primary' | 'secondary' | 'info' | 'success' | 'warning' | 'error';

interface PartyTheme {
  name: string;
  color: NuxtUIColor;
  avatarBg: string;
  headerBg: string;
  hoverBorder: string;
}

// 6 Balanced Nuxt UI Themes with dynamic avatars, headers, and buttons
const NUXT_UI_THEMES: PartyTheme[] = [
  {
    name: 'primary',
    color: 'primary',
    avatarBg: 'bg-emerald-600 text-white',
    headerBg: 'bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent',
    hoverBorder: 'hover:border-emerald-400'
  },
  {
    name: 'info',
    color: 'info',
    avatarBg: 'bg-sky-600 text-white',
    headerBg: 'bg-gradient-to-br from-sky-500/15 via-sky-500/5 to-transparent',
    hoverBorder: 'hover:border-sky-400'
  },
  {
    name: 'warning',
    color: 'warning',
    avatarBg: 'bg-amber-600 text-white',
    headerBg: 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent',
    hoverBorder: 'hover:border-amber-400'
  },
  {
    name: 'secondary',
    color: 'secondary',
    avatarBg: 'bg-purple-600 text-white',
    headerBg: 'bg-gradient-to-br from-purple-500/15 via-purple-500/5 to-transparent',
    hoverBorder: 'hover:border-purple-400'
  },
  {
    name: 'success',
    color: 'success',
    avatarBg: 'bg-teal-600 text-white',
    headerBg: 'bg-gradient-to-br from-teal-500/15 via-teal-500/5 to-transparent',
    hoverBorder: 'hover:border-teal-400'
  },
  {
    name: 'error',
    color: 'error',
    avatarBg: 'bg-rose-600 text-white',
    headerBg: 'bg-gradient-to-br from-rose-500/15 via-rose-500/5 to-transparent',
    hoverBorder: 'hover:border-rose-400'
  }
];

// Consistent deterministic hash per party so its assigned Nuxt UI color stays stable across re-renders
function getPartyTheme(party: any): PartyTheme {
  const seed = (party.name || party._id || 'party').toString().toLowerCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % NUXT_UI_THEMES.length;
  return NUXT_UI_THEMES[index];
}

// Distinct semantic badge color by party type
function getPartyTypeColor(type?: string): NuxtUIColor {
  switch (type) {
    case 'CUSTOMER':
      return 'success';
    case 'SUPPLIER':
      return 'info';
    case 'BOTH':
      return 'secondary';
    default:
      return 'primary';
  }
}

onMounted(() => {
  fetchParties();
});

const filteredParties = computed(() => {
  return parties.value.filter(p => {
    const q = searchQuery.value.toLowerCase().trim();
    const matchesSearch = !q || 
      p.name?.toLowerCase().includes(q) ||
      p.gstin?.toLowerCase().includes(q) ||
      p.pan?.toLowerCase().includes(q) ||
      p.state?.toLowerCase().includes(q);
    
    const matchesType = typeFilter.value === 'ALL' || !typeFilter.value || p.partyType === typeFilter.value;
    
    return matchesSearch && matchesType;
  });
});
</script>
