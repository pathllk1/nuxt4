<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useApi } from '@/utils/api';
import PartyAccountMasterModal from '@/components/accounting/PartyAccountMasterModal.vue';

const api = useApi();

interface COAEntry {
  _id: string;
  account_name: string;
  account_type: string;
  account_code?: string;
  pan?: string;
  aadhaar_number?: string;
  gstin?: string;
  phone?: string;
  hsn_sac?: string;
  gst_rate?: number;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  branch_name?: string;
  account_type_code?: string;
  is_system: boolean;
  is_active: boolean;
  opening_balance?: number;
  balance_type?: 'DR' | 'CR';
  current_balance?: number;
  current_balance_type?: 'DR' | 'CR';
}

const coaData = ref<COAEntry[]>([]);
const loading = ref(true);
const search = ref('');
const typeFilter = ref('all');

const isModalOpen = ref(false);
const selectedEditId = ref<string | null>(null);
const selectedDefaultType = ref('SUNDRY_DEBTORS');

const accountTypes = [
  { label: 'Income', value: 'INCOME' },
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Asset', value: 'ASSET' },
  { label: 'Liability', value: 'LIABILITY' },
  { label: 'Cash', value: 'CASH' },
  { label: 'Bank', value: 'BANK' },
  { label: 'Sundry Debtors (Customer)', value: 'SUNDRY_DEBTORS' },
  { label: 'Sundry Creditors (Supplier)', value: 'SUNDRY_CREDITORS' },
  { label: 'Debtor', value: 'DEBTOR' },
  { label: 'Creditor', value: 'CREDITOR' },
  { label: 'Labor Leader', value: 'LABOR_LEADER' },
  { label: 'Capital', value: 'CAPITAL' },
  { label: 'General', value: 'GENERAL' },
  { label: 'Payable', value: 'PAYABLE' }
];

const filterOptions = computed(() => [
  { label: 'All Types', value: 'all' },
  ...accountTypes
]);

const fetchCOA = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (search.value) params.append('search', search.value);
    if (typeFilter.value && typeFilter.value !== 'all') params.append('type', typeFilter.value);
    
    const response = await api.get(`/accounting/coa?${params.toString()}`);
    coaData.value = response.data;
  } catch (error: any) {
    console.error('Fetch COA error:', error);
  } finally {
    loading.value = false;
  }
};

const openModal = (entry?: any) => {
  if (entry && entry._id) {
    selectedEditId.value = entry._id;
    selectedDefaultType.value = entry.account_type || 'SUNDRY_DEBTORS';
  } else {
    selectedEditId.value = null;
    selectedDefaultType.value = 'EXPENSE';
  }
  isModalOpen.value = true;
};

const deleteAccount = async (id: string) => {
  if (!confirm('Are you sure you want to delete this account head?')) return;
  try {
    await api.delete(`/accounting/coa/${id}`);
    fetchCOA();
  } catch (error: any) {
    alert(error.message || 'Failed to delete account');
  }
};

const sortKey = ref('account_name');
const sortDesc = ref(false);

const toggleSort = (key: string) => {
  if (sortKey.value === key) {
    sortDesc.value = !sortDesc.value;
  } else {
    sortKey.value = key;
    sortDesc.value = false;
  }
};

const sortedCOAData = computed(() => {
  const data = [...coaData.value];
  if (!sortKey.value) return data;

  return data.sort((a, b) => {
    let valA: any = a[sortKey.value as keyof COAEntry];
    let valB: any = b[sortKey.value as keyof COAEntry];

    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDesc.value ? valB - valA : valA - valB;
    }

    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();

    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';

    if (valA < valB) return sortDesc.value ? 1 : -1;
    if (valA > valB) return sortDesc.value ? -1 : 1;
    return 0;
  });
});

onMounted(fetchCOA);
</script>

<template>
  <div class="p-4 space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-xs font-black uppercase tracking-[0.25em] text-emerald-600">Accounting Master</p>
        <h1 class="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Chart of Accounts</h1>
        <p class="text-xs text-slate-500 dark:text-zinc-400 font-bold mt-0.5">Manage and configure your firm's financial heads, parties, and compliance data</p>
      </div>
      <div class="flex gap-2">
        <UButton
          color="primary"
          icon="i-heroicons-plus-16-solid"
          label="New Account"
          class="font-bold cursor-pointer"
          @click="openModal()"
        />
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div class="flex-1 min-w-[280px]">
        <UInput
          v-model="search"
          icon="i-heroicons-magnifying-glass"
          placeholder="Search account name, PAN, GSTIN, type..."
          @input="fetchCOA"
        />
      </div>
      <USelect
        v-model="typeFilter"
        :items="filterOptions"
        class="min-w-[170px]"
        @change="fetchCOA"
      />
    </div>

    <!-- Table -->
    <div class="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[400px]">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600"></div>
      </div>
      <div v-else-if="coaData.length === 0" class="p-20 text-center space-y-4">
        <UIcon name="i-heroicons-document-text" class="w-12 h-12 text-slate-200 dark:text-zinc-700 mx-auto" />
        <p class="text-sm font-bold text-slate-500 dark:text-zinc-400">No account heads found.</p>
      </div>
      <div v-else class="overflow-auto max-h-[600px] relative custom-scrollbar">
        <table class="w-full text-left border-collapse sticky-table text-xs">
          <thead class="sticky top-0 z-10 shadow-sm">
            <tr class="bg-slate-50 dark:bg-zinc-800 border-b border-slate-200 dark:border-zinc-700">
              <th 
                class="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none group"
                @click="toggleSort('account_name')"
              >
                <div class="flex items-center gap-1.5">
                  <span>Account Master</span>
                  <UIcon 
                    v-if="sortKey === 'account_name'" 
                    :name="sortDesc ? 'i-heroicons-bars-arrow-down' : 'i-heroicons-bars-arrow-up'" 
                    class="w-3.5 h-3.5" 
                  />
                  <UIcon 
                    v-else 
                    name="i-heroicons-arrows-up-down" 
                    class="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" 
                  />
                </div>
              </th>
              <th 
                class="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none group"
                @click="toggleSort('account_type')"
              >
                <div class="flex items-center gap-1.5">
                  <span>Type</span>
                  <UIcon 
                    v-if="sortKey === 'account_type'" 
                    :name="sortDesc ? 'i-heroicons-bars-arrow-down' : 'i-heroicons-bars-arrow-up'" 
                    class="w-3.5 h-3.5" 
                  />
                  <UIcon 
                    v-else 
                    name="i-heroicons-arrows-up-down" 
                    class="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" 
                  />
                </div>
              </th>
              <th 
                class="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none group text-right"
                @click="toggleSort('opening_balance')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>Opening Balance</span>
                  <UIcon 
                    v-if="sortKey === 'opening_balance'" 
                    :name="sortDesc ? 'i-heroicons-bars-arrow-down' : 'i-heroicons-bars-arrow-up'" 
                    class="w-3.5 h-3.5" 
                  />
                  <UIcon 
                    v-else 
                    name="i-heroicons-arrows-up-down" 
                    class="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" 
                  />
                </div>
              </th>
              <th 
                class="px-6 py-4 text-[10px] font-black uppercase tracking-widest cursor-pointer select-none group text-right"
                @click="toggleSort('current_balance')"
              >
                <div class="flex items-center justify-end gap-1.5">
                  <span>Current Balance</span>
                  <UIcon 
                    v-if="sortKey === 'current_balance'" 
                    :name="sortDesc ? 'i-heroicons-bars-arrow-down' : 'i-heroicons-bars-arrow-up'" 
                    class="w-3.5 h-3.5" 
                  />
                  <UIcon 
                    v-else 
                    name="i-heroicons-arrows-up-down" 
                    class="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" 
                  />
                </div>
              </th>
              <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
            <tr v-for="acc in sortedCOAData" :key="acc._id" class="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors group">
              <td class="px-6 py-4">
                <div class="flex items-start gap-3">
                  <div :class="['w-2 h-10 rounded-full shrink-0', acc.is_system ? 'bg-indigo-500' : 'bg-emerald-500']"></div>
                  <div class="space-y-1">
                    <div class="flex items-center gap-2">
                      <p class="text-sm font-black text-slate-900 dark:text-white leading-tight">{{ acc.account_name }}</p>
                      <span v-if="acc.is_system" class="text-[8px] font-black uppercase text-indigo-500 bg-indigo-50 dark:bg-indigo-950 px-1 rounded">System</span>
                    </div>
                    <!-- Statutory Badges (PAN, GSTIN, Aadhaar) -->
                    <div class="flex flex-wrap items-center gap-1.5 text-[9px]">
                      <span v-if="acc.hsn_sac" class="bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-mono font-bold px-1.5 py-0.2 rounded border border-teal-200 dark:border-teal-800">
                        SAC: {{ acc.hsn_sac }}
                      </span>
                      <span v-if="acc.gst_rate != null" class="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 font-mono font-bold px-1.5 py-0.2 rounded border border-orange-200 dark:border-orange-800">
                        GST: {{ acc.gst_rate }}%
                      </span>
                      <span v-if="acc.gstin" class="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-mono font-bold px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800">
                        GSTIN: {{ acc.gstin }}
                      </span>
                      <span v-if="acc.pan" class="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-mono font-bold px-1.5 py-0.2 rounded border border-purple-200 dark:border-purple-800">
                        PAN: {{ acc.pan }}
                      </span>
                      <span v-if="acc.aadhaar_number" class="bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                        Aadhaar: {{ acc.aadhaar_number }}
                      </span>
                      <span v-if="acc.phone" class="text-slate-500 dark:text-zinc-400 font-medium">
                        📞 {{ acc.phone }}
                      </span>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-6 py-4">
                <span class="text-[10px] font-black uppercase text-slate-500 dark:text-zinc-400 tracking-tight">{{ acc.account_type }}</span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex flex-col items-end">
                  <span class="text-xs font-bold text-slate-700 dark:text-zinc-300 font-mono">₹ {{ acc.opening_balance?.toLocaleString() || '0' }}</span>
                  <span class="text-[8px] font-black" :class="[acc.balance_type === 'DR' ? 'text-blue-600' : 'text-red-600']">{{ acc.balance_type }}</span>
                </div>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex flex-col items-end">
                  <span class="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">₹ {{ acc.current_balance?.toLocaleString() || '0' }}</span>
                  <span class="text-[8px] font-black" :class="[acc.current_balance_type === 'DR' ? 'text-blue-600' : 'text-red-600']">{{ acc.current_balance_type }}</span>
                </div>
              </td>
              <td class="px-6 py-4">
                <div class="flex justify-center gap-2">
                  <UButton
                    variant="ghost"
                    color="neutral"
                    icon="i-heroicons-pencil-square"
                    size="xs"
                    class="cursor-pointer"
                    @click="openModal(acc)"
                  />
                  <UButton
                    v-if="!acc.is_system"
                    variant="ghost"
                    color="error"
                    icon="i-heroicons-trash"
                    size="xs"
                    class="cursor-pointer"
                    @click="deleteAccount(acc._id)"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Universal Canonical Master Registration & Edit Modal -->
    <PartyAccountMasterModal
      v-model="isModalOpen"
      :account-id="selectedEditId"
      :default-type="selectedDefaultType"
      @saved="fetchCOA"
    />
  </div>
</template>
