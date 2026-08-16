<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useApi } from '@/utils/api';
import { suggestSAC } from '@/composables/useAccountingInvoiceState';

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
const saving = ref(false);

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

const form = ref({
  _id: '',
  account_name: '',
  account_type: 'GENERAL',
  pan: '',
  aadhaar_number: '',
  gstin: '',
  phone: '',
  hsn_sac: '',
  gst_rate: null as number | null,
  opening_balance: 0,
  balance_type: 'DR'
});

const sacSuggestion = ref<{ sac: string; gstRate: number; description: string } | null>(null);

const isPartyType = computed(() => {
  const t = (form.value.account_type || '').toUpperCase();
  return t.includes('DEBTOR') || t.includes('CREDITOR') || t.includes('CUSTOMER') || t.includes('SUPPLIER');
});

const isLaborType = computed(() => {
  const t = (form.value.account_type || '').toUpperCase();
  return t.includes('LABOR');
});

const isServiceAccountType = computed(() => {
  const t = (form.value.account_type || '').toUpperCase();
  return ['INCOME', 'EXPENSE', 'DIRECT_INCOME', 'INDIRECT_INCOME', 'DIRECT_EXPENSE', 'INDIRECT_EXPENSE'].includes(t);
});

function onAccountNameInput() {
  if (!isServiceAccountType.value) return;
  const suggestion = suggestSAC(form.value.account_name);
  sacSuggestion.value = suggestion;
}

function applySacSuggestion() {
  if (sacSuggestion.value) {
    form.value.hsn_sac = sacSuggestion.value.sac;
    form.value.gst_rate = sacSuggestion.value.gstRate;
    sacSuggestion.value = null;
  }
}

function setGstRate(rate: number) {
  form.value.gst_rate = rate;
}

function onGstinChange() {
  const g = (form.value.gstin || '').trim().toUpperCase();
  if (g.length >= 12 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(g)) {
    if (!form.value.pan) {
      form.value.pan = g.substring(2, 12);
    }
  }
}

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
  sacSuggestion.value = null;
  if (entry) {
    form.value = {
      _id: entry._id,
      account_name: entry.account_name,
      account_type: entry.account_type,
      pan: entry.pan || '',
      aadhaar_number: entry.aadhaar_number || '',
      gstin: entry.gstin || '',
      phone: entry.phone || '',
      hsn_sac: entry.hsn_sac || '',
      gst_rate: entry.gst_rate ?? null,
      opening_balance: entry.opening_balance || 0,
      balance_type: entry.balance_type || 'DR'
    };
  } else {
    form.value = {
      _id: '',
      account_name: '',
      account_type: 'GENERAL',
      pan: '',
      aadhaar_number: '',
      gstin: '',
      phone: '',
      hsn_sac: '',
      gst_rate: null,
      opening_balance: 0,
      balance_type: 'DR'
    };
  }
  isModalOpen.value = true;
};

const saveAccount = async () => {
  saving.value = true;
  try {
    if (form.value._id) {
      await api.put(`/accounting/coa/${form.value._id}`, form.value);
    } else {
      await api.post('/accounting/coa', form.value);
    }
    isModalOpen.value = false;
    fetchCOA();
  } catch (error: any) {
    alert(error.message || 'Failed to save account');
  } finally {
    saving.value = false;
  }
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

    <!-- Modal -->
    <UModal v-model:open="isModalOpen" :title="form._id ? 'Edit Account Head' : 'Create New Account Head'">
      <template #body>
        <form @submit.prevent="saveAccount" class="space-y-4 p-4 text-xs">
          <div>
            <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Account Name *</label>
            <UInput v-model="form.account_name" placeholder="e.g. Acme Supplies / Moti Chouhan / Office Rent" required @input="onAccountNameInput" />
            <!-- SAC Auto-Suggest Badge -->
            <div v-if="sacSuggestion && isServiceAccountType && !form.hsn_sac" class="mt-1.5 flex items-center gap-2">
              <button type="button" @click="applySacSuggestion" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-[10px] font-bold hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors cursor-pointer">
                <span>💡</span>
                <span>Suggested: SAC {{ sacSuggestion.sac }} • {{ sacSuggestion.gstRate }}% GST</span>
                <span class="text-teal-500">— Click to apply</span>
              </button>
            </div>
          </div>
          
          <div>
            <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Account Classification Type *</label>
            <USelect
              v-model="form.account_type"
              :items="accountTypes"
              class="w-full"
            />
          </div>

          <!-- Context-Sensitive Section: Parties (Customers & Suppliers) -->
          <div v-if="isPartyType" class="p-3.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-3">
            <h4 class="text-[10px] font-black uppercase tracking-wider text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
              <span>🏢</span> GST & Party Tax Details
            </h4>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">GSTIN (15 Digits)</label>
              <UInput 
                v-model="form.gstin" 
                placeholder="27AAAAA0000A1Z5" 
                maxlength="15"
                class="font-mono font-bold uppercase"
                @input="onGstinChange"
              />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">PAN Number</label>
                <UInput 
                  v-model="form.pan" 
                  placeholder="AAAAA0000A" 
                  maxlength="10"
                  class="font-mono font-bold uppercase"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Contact Phone</label>
                <UInput v-model="form.phone" placeholder="Mobile / Phone" />
              </div>
            </div>
          </div>

          <!-- Context-Sensitive Section: Labor Leader -->
          <div v-if="isLaborType" class="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
            <h4 class="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>👷</span> Labor Leader Identification Details
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Aadhaar Number</label>
                <UInput 
                  v-model="form.aadhaar_number" 
                  placeholder="12-digit Aadhaar" 
                  maxlength="12"
                  class="font-mono font-bold"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">PAN Number</label>
                <UInput 
                  v-model="form.pan" 
                  placeholder="ABCDE1234F" 
                  maxlength="10"
                  class="font-mono font-bold uppercase"
                />
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Phone Number</label>
              <UInput v-model="form.phone" placeholder="Mobile number" />
            </div>
          </div>

          <!-- General Account Contact Phone (When not Party or Labor) -->
          <div v-if="!isPartyType && !isLaborType" class="space-y-1">
            <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Contact Phone / Mobile (Optional)</label>
            <UInput v-model="form.phone" placeholder="e.g. 9876543210" />
          </div>

          <!-- Context-Sensitive Section: SAC & GST (Income / Expense accounts) -->
          <div v-if="isServiceAccountType" class="p-3.5 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl space-y-3">
            <h4 class="text-[10px] font-black uppercase tracking-wider text-teal-900 dark:text-teal-200 flex items-center gap-1.5">
              <span>📋</span> GST Service Tax Configuration (Optional)
            </h4>
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">SAC Code (6 Digits)</label>
                <UInput 
                  v-model="form.hsn_sac" 
                  placeholder="e.g. 998311" 
                  maxlength="6"
                  class="font-mono font-bold"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Default GST Rate (%)</label>
                <UInput 
                  v-model.number="form.gst_rate" 
                  type="number" 
                  step="0.01"
                  placeholder="e.g. 18"
                  class="font-mono font-bold"
                />
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <span class="text-[9px] font-bold text-slate-500 dark:text-zinc-400 uppercase mr-1">Quick Set:</span>
              <button v-for="rate in [0, 5, 12, 18, 28]" :key="rate" type="button" @click="setGstRate(rate)" :class="[
                'px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer border',
                form.gst_rate === rate
                  ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700 hover:bg-teal-50 dark:hover:bg-teal-950/30 hover:border-teal-300 dark:hover:border-teal-700'
              ]">
                {{ rate }}%
              </button>
            </div>
          </div>

          <!-- Opening Balance -->
          <div>
            <label class="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Opening Balance (₹)</label>
            <div class="flex gap-2">
              <UInput v-model.number="form.opening_balance" type="number" step="0.01" class="flex-1" />
              <USelect
                v-model="form.balance_type"
                :items="[{ label: 'Debit (DR)', value: 'DR' }, { label: 'Credit (CR)', value: 'CR' }]"
                class="w-32"
              />
            </div>
          </div>

          <div class="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <UButton variant="ghost" label="Cancel" class="cursor-pointer" @click="isModalOpen = false" />
            <UButton type="submit" color="primary" :label="form._id ? 'Update Head' : 'Create Head'" class="font-bold cursor-pointer" :loading="saving" />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
