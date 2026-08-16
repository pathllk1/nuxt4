<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useAccounting } from '@/composables/useAccounting';
import { useApi } from '@/utils/api';
import type { COAAccount } from '@/composables/useAccountingInvoiceState';

const props = defineProps<{
  modelValue: boolean;
  filterType?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select': [account: COAAccount];
}>();

const api = useApi();
const { chartOfAccounts, fetchCOA, loading } = useAccounting();

const searchQuery = ref('');
const activeHighlightIndex = ref(0);
const listRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);

// Quick Create State
const isQuickCreateOpen = ref(false);
const savingQuickAccount = ref(false);
const quickForm = ref({
  account_name: '',
  account_type: 'DIRECT_INCOME',
  hsn_sac: '',
  gst_rate: null as number | null,
  gstin: '',
  pan: '',
  phone: '',
  opening_balance: 0,
  balance_type: 'DR'
});

const quickAccountTypes = [
  { label: 'Direct Income (Revenue)', value: 'DIRECT_INCOME' },
  { label: 'Indirect Income', value: 'INDIRECT_INCOME' },
  { label: 'Direct Expense', value: 'DIRECT_EXPENSE' },
  { label: 'Indirect Expense', value: 'INDIRECT_EXPENSE' },
  { label: 'Sundry Debtors (Customer)', value: 'SUNDRY_DEBTORS' },
  { label: 'Sundry Creditors (Supplier)', value: 'SUNDRY_CREDITORS' },
  { label: 'Bank Account', value: 'BANK_ACCOUNT' },
  { label: 'Cash Account', value: 'CASH' },
  { label: 'Asset', value: 'ASSET' },
  { label: 'Liability', value: 'LIABILITY' },
];

function formatAccountType(type: string = ''): string {
  return type.replace(/_/g, ' ');
}

function getTypeBadgeClass(type: string = ''): string {
  const t = type.toUpperCase();
  if (t.includes('INCOME')) return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800';
  if (t.includes('EXPENSE')) return 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800';
  if (t.includes('BANK') || t.includes('CASH')) return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800';
  if (t.includes('ASSET')) return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800';
  if (t.includes('LIABILITY')) return 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
  return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700';
}

function getBalanceBadgeClass(account: any): string {
  const type = account.current_balance_type || 'DR';
  if (type === 'DR') return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-100 dark:border-blue-900';
  return 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-100 dark:border-rose-900';
}

// Grouped Accounts List matching AccountSelectMenu structure
const filteredGroups = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  const list = chartOfAccounts.value || [];

  const filtered = list.filter(acc => {
    if (acc.is_active === false) return false;
    if (!q) return true;
    return (
      (acc.account_name && acc.account_name.toLowerCase().includes(q)) ||
      (acc.account_type && acc.account_type.toLowerCase().includes(q)) ||
      (acc.hsn_sac && acc.hsn_sac.toLowerCase().includes(q))
    );
  });

  const groups: Record<string, { title: string; icon: string; order: number; items: any[] }> = {};

  filtered.forEach(acc => {
    const t = (acc.account_type || 'OTHER').toUpperCase();
    let groupKey = 'OTHER';
    let groupTitle = 'General Accounts';
    let groupIcon = '📁';
    let order = 99;

    if (t.includes('BANK') || t.includes('CASH')) {
      groupKey = 'BANK_CASH'; groupTitle = 'Bank & Cash Accounts'; groupIcon = '🏦'; order = 1;
    } else if (t.includes('DIRECT_INCOME') || t === 'INCOME') {
      groupKey = 'DIRECT_INCOME'; groupTitle = 'Direct Income (Revenue)'; groupIcon = '💰'; order = 2;
    } else if (t.includes('INDIRECT_INCOME')) {
      groupKey = 'INDIRECT_INCOME'; groupTitle = 'Indirect Income'; groupIcon = '📈'; order = 3;
    } else if (t.includes('DIRECT_EXPENSE') || t === 'EXPENSE') {
      groupKey = 'DIRECT_EXPENSE'; groupTitle = 'Direct Expenses'; groupIcon = '🏷️'; order = 4;
    } else if (t.includes('INDIRECT_EXPENSE')) {
      groupKey = 'INDIRECT_EXPENSE'; groupTitle = 'Indirect Expenses'; groupIcon = '📉'; order = 5;
    } else if (t.includes('DEBTOR')) {
      groupKey = 'DEBTORS'; groupTitle = 'Sundry Debtors (Customers)'; groupIcon = '👥'; order = 6;
    } else if (t.includes('CREDITOR')) {
      groupKey = 'CREDITORS'; groupTitle = 'Sundry Creditors (Suppliers)'; groupIcon = '🏢'; order = 7;
    } else if (t.includes('ASSET')) {
      groupKey = 'ASSETS'; groupTitle = 'Assets'; groupIcon = '📦'; order = 8;
    } else if (t.includes('LIABILITY')) {
      groupKey = 'LIABILITIES'; groupTitle = 'Liabilities & Provisions'; groupIcon = '🛡️'; order = 9;
    }

    if (!groups[groupKey]) {
      groups[groupKey] = { title: groupTitle, icon: groupIcon, order, items: [] };
    }
    groups[groupKey].items.push(acc);
  });

  return Object.values(groups).sort((a, b) => a.order - b.order);
});

// Linear list for keyboard traversal
const flattenedList = computed(() => {
  return filteredGroups.value.flatMap(g => g.items);
});

function selectAccount(account: any) {
  if (!account) return;
  emit('select', account);
  emit('update:modelValue', false);
}

function handleSearchKeydown(e: KeyboardEvent) {
  if (isQuickCreateOpen.value) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (flattenedList.value.length > 0) {
      activeHighlightIndex.value = (activeHighlightIndex.value + 1) % flattenedList.value.length;
      scrollToActive();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (flattenedList.value.length > 0) {
      activeHighlightIndex.value = (activeHighlightIndex.value - 1 + flattenedList.value.length) % flattenedList.value.length;
      scrollToActive();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (flattenedList.value.length > 0 && flattenedList.value[activeHighlightIndex.value]) {
      selectAccount(flattenedList.value[activeHighlightIndex.value]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    emit('update:modelValue', false);
  } else if ((e.altKey && e.key.toLowerCase() === 'c') || (e.ctrlKey && e.key.toLowerCase() === 'n') || e.key === 'Insert') {
    e.preventDefault();
    openQuickCreate();
  }
}

function scrollToActive() {
  nextTick(() => {
    const activeEl = listRef.value?.querySelector('.highlighted-row');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  });
}

function openQuickCreate() {
  quickForm.value = {
    account_name: searchQuery.value.trim(),
    account_type: 'DIRECT_INCOME',
    hsn_sac: '',
    gst_rate: null,
    gstin: '',
    pan: '',
    phone: '',
    opening_balance: 0,
    balance_type: 'DR'
  };
  isQuickCreateOpen.value = true;
  nextTick(() => {
    const input = document.querySelector('.quick-name-input input') as HTMLInputElement;
    if (input) {
      input.focus();
      input.select();
    }
  });
}

async function submitQuickAccount() {
  if (!quickForm.value.account_name.trim()) return;
  savingQuickAccount.value = true;
  try {
    const res = await api.post('/accounting/coa', quickForm.value);
    isQuickCreateOpen.value = false;
    await fetchCOA();
    if (res.data?.data) {
      selectAccount(res.data.data);
    }
  } catch (err: any) {
    alert(err?.response?.data?.statusMessage || err.message || 'Failed to create account');
  } finally {
    savingQuickAccount.value = false;
  }
}

watch(() => props.modelValue, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = '';
    activeHighlightIndex.value = 0;
    isQuickCreateOpen.value = false;
    await fetchCOA();
    nextTick(() => {
      searchInputRef.value?.focus();
      searchInputRef.value?.select();
    });
  }
});

watch(searchQuery, () => {
  activeHighlightIndex.value = 0;
});
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md" @click.self="$emit('update:modelValue', false)">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-zinc-800" role="dialog" aria-modal="true">
      <!-- Header -->
      <div class="p-4 px-6 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-850/80">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <UIcon name="i-heroicons-book-open" class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Chart of Accounts</h2>
            <p class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Select Ledger Particulars Head</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="openQuickCreate"
            class="px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-black uppercase tracking-wider hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
          >
            <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
            <span>New Head (Alt+C)</span>
          </button>
          <button 
            type="button" 
            @click="$emit('update:modelValue', false)" 
            class="w-8 h-8 flex items-center justify-center rounded-xl bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-400 hover:text-red-500 transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Search Input (Auto-focused) -->
      <div class="px-6 pt-3 pb-2 bg-slate-50/40 dark:bg-zinc-850/40">
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search account name, type, SAC code... (↑↓ Navigate • Enter Select • Alt+C Create • ESC Close)"
            class="w-full pl-9 pr-8 py-2 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 placeholder-slate-400 font-bold shadow-inner"
            @keydown="handleSearchKeydown"
          />
          <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''" 
            class="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Account List Area (Scrollable with Fixed Height) -->
      <div 
        ref="listRef" 
        class="flex-1 overflow-y-auto px-6 py-2 bg-slate-50/30 dark:bg-zinc-900/30 divide-y divide-slate-100 dark:divide-zinc-800 min-h-[300px]"
      >
        <div v-if="loading" class="flex flex-col items-center justify-center py-16 gap-2">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Loading account heads...</p>
        </div>

        <div v-else-if="flattenedList.length === 0" class="flex flex-col items-center justify-center py-16 text-center space-y-2">
          <UIcon name="i-heroicons-document-magnifying-glass" class="w-10 h-10 text-slate-300 dark:text-zinc-600" />
          <p class="text-xs font-bold text-slate-600 dark:text-zinc-300">No account heads found matching "{{ searchQuery }}"</p>
          <button
            type="button"
            class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
            @click="openQuickCreate"
          >
            + Create "{{ searchQuery }}" (Alt+C)
          </button>
        </div>

        <template v-else>
          <div v-for="group in filteredGroups" :key="group.title" class="py-1">
            <!-- Group Header -->
            <div class="px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 bg-slate-100/90 dark:bg-zinc-800/90 rounded-lg flex items-center justify-between sticky top-0 z-10 backdrop-blur-sm mb-1">
              <span class="flex items-center gap-1.5">
                <span>{{ group.icon }}</span>
                <span>{{ group.title }}</span>
              </span>
              <span class="text-[8px] font-mono px-1.5 py-0.2 rounded bg-slate-200/70 dark:bg-zinc-700/70">{{ group.items.length }}</span>
            </div>

            <!-- Group Items -->
            <div class="divide-y divide-slate-50 dark:divide-zinc-800/40">
              <div
                v-for="item in group.items"
                :key="item._id || item.account_name"
                @click="selectAccount(item)"
                :class="[
                  'flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs rounded-lg my-0.5',
                  flattenedList[activeHighlightIndex]?._id === item._id || flattenedList[activeHighlightIndex]?.account_name === item.account_name
                    ? 'highlighted-row bg-blue-500 text-white font-bold shadow-sm'
                    : 'hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-200'
                ]"
              >
                <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
                  <span class="truncate">{{ item.account_name }}</span>
                  <span 
                    v-if="item.account_type" 
                    class="text-[8px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider shrink-0"
                    :class="flattenedList[activeHighlightIndex]?._id === item._id ? 'bg-white/20 text-white' : getTypeBadgeClass(item.account_type)"
                  >
                    {{ formatAccountType(item.account_type) }}
                  </span>
                  <span 
                    v-if="item.description" 
                    class="text-[8px] font-medium italic opacity-75 truncate max-w-[140px] shrink-0"
                    :class="flattenedList[activeHighlightIndex]?._id === item._id ? 'text-white' : 'text-slate-500 dark:text-zinc-400'"
                  >
                    ({{ item.description }})
                  </span>
                  <span 
                    v-if="item.hsn_sac" 
                    class="text-[8px] font-mono font-bold px-1 py-0.2 rounded shrink-0"
                    :class="flattenedList[activeHighlightIndex]?._id === item._id ? 'bg-white/20 text-white' : 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40'"
                  >
                    SAC: {{ item.hsn_sac }}
                  </span>
                  <span 
                    v-if="item.gst_rate != null" 
                    class="text-[8px] font-mono font-bold px-1 py-0.2 rounded shrink-0"
                    :class="flattenedList[activeHighlightIndex]?._id === item._id ? 'bg-white/20 text-white' : 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40'"
                  >
                    {{ item.gst_rate }}% GST
                  </span>
                </div>

                <!-- Balance Preview Badge -->
                <div v-if="item.current_balance !== undefined" class="shrink-0 text-right">
                  <span 
                    class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    :class="flattenedList[activeHighlightIndex]?._id === item._id ? 'bg-white/20 text-white' : getBalanceBadgeClass(item)"
                  >
                    ₹{{ Number(item.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
                    <span class="text-[8px] opacity-75">{{ item.current_balance_type || 'DR' }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer Info & Shortcuts -->
      <div class="px-6 py-3 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-850/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">
        <span>{{ flattenedList.length }} accounts available</span>
        <div class="flex items-center gap-3 font-semibold">
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">↑↓</kbd> Browse</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">Enter</kbd> Select & Go to SAC</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">Alt+C</kbd> Create</span>
          <span><kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">Esc</kbd> Close</span>
        </div>
      </div>
    </div>

    <!-- Quick Create Sub-Modal -->
    <div v-if="isQuickCreateOpen" class="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm" @click.self="isQuickCreateOpen = false">
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-5 border border-slate-200 dark:border-zinc-800 space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-2">
          <h3 class="font-black text-sm text-slate-900 dark:text-white">Quick Create Account Head</h3>
          <button type="button" @click="isQuickCreateOpen = false" class="text-slate-400 hover:text-slate-600 font-bold">✕</button>
        </div>
        <form @submit.prevent="submitQuickAccount" class="space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Account Name *</label>
            <UInput v-model="quickForm.account_name" class="quick-name-input" placeholder="e.g. IT Consulting / Delhi Transport" required />
          </div>
          <div>
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Account Classification Type *</label>
            <USelect v-model="quickForm.account_type" :items="quickAccountTypes" class="w-full" />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">SAC Code (Optional)</label>
              <UInput v-model="quickForm.hsn_sac" placeholder="6-digit SAC" maxlength="6" class="font-mono font-bold" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">GST Rate %</label>
              <UInput v-model.number="quickForm.gst_rate" type="number" step="0.01" placeholder="18" class="font-mono font-bold" />
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <UButton label="Cancel" variant="ghost" size="xs" class="cursor-pointer" @click="isQuickCreateOpen = false" />
            <UButton type="submit" label="Save & Select" color="primary" size="xs" :loading="savingQuickAccount" class="font-bold cursor-pointer" />
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
