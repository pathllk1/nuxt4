<template>
  <div class="relative w-full" ref="containerRef" @keydown="handleGlobalKeydown">
    <!-- Trigger Input / Button -->
    <div
      @click="toggleDropdown"
      class="flex items-center justify-between w-full px-2.5 py-1.5 text-xs bg-white dark:bg-zinc-800 border rounded-lg cursor-pointer transition-all focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
      :class="[
        isOpen ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600',
        disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900' : ''
      ]"
    >
      <div class="flex items-center gap-1.5 flex-1 min-w-0 pr-1">
        <span v-if="selectedIcon" class="text-sm shrink-0">{{ selectedIcon }}</span>
        <div v-if="selectedAccount" class="flex items-center gap-1.5 truncate">
          <span class="font-bold text-slate-800 dark:text-zinc-100 truncate">
            {{ selectedAccount.account_name }}
          </span>
          <span 
            v-if="selectedAccount.account_type" 
            class="text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider shrink-0"
            :class="getTypeBadgeClass(selectedAccount.account_type)"
          >
            {{ formatAccountType(selectedAccount.account_type) }}
          </span>
        </div>
        <span v-else class="text-slate-400 dark:text-zinc-500 truncate">
          {{ placeholder || '-- Select Account --' }}
        </span>
      </div>

      <!-- Right Side: Balance Badge & Chevron -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span
          v-if="showBalance && selectedAccount && selectedAccount.current_balance !== undefined"
          class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
          :class="getBalanceBadgeClass(selectedAccount)"
        >
          ₹{{ Number(selectedAccount.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
          <span class="text-[8px] opacity-80">{{ selectedAccount.current_balance_type || 'DR' }}</span>
        </span>
        <svg 
          class="w-3.5 h-3.5 text-slate-400 transition-transform duration-200" 
          :class="{ 'rotate-180': isOpen }" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Dropdown Menu -->
    <div
      v-if="isOpen"
      class="absolute left-0 right-0 z-[100] mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
      style="min-width: 280px; max-height: 380px;"
    >
      <!-- Search Box -->
      <div class="p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850">
        <div class="relative">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            placeholder="Search account name, type, or Alt+C to create..."
            class="w-full pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 placeholder-slate-400"
            @keydown.down.prevent="navigateHighlight(1)"
            @keydown.up.prevent="navigateHighlight(-1)"
            @keydown.enter.prevent="handleEnterKey"
            @keydown.esc="closeDropdown"
            @click.stop
          />
          <svg class="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <button 
            v-if="searchQuery" 
            @click="searchQuery = ''" 
            class="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
          >
            ×
          </button>
        </div>
      </div>

      <!-- Account List Grouped -->
      <div class="overflow-y-auto max-h-[240px] p-1 divide-y divide-slate-100 dark:divide-zinc-800/60" ref="listRef">
        <div v-if="filteredGroups.length === 0" class="py-6 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2">
          <p>No accounts found matching "{{ searchQuery }}"</p>
        </div>

        <div v-for="group in filteredGroups" :key="group.title" class="py-1">
          <!-- Group Title -->
          <div class="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center justify-between">
            <span>{{ group.icon }} {{ group.title }}</span>
            <span class="text-[8px] opacity-70">{{ group.items.length }}</span>
          </div>

          <!-- Items -->
          <div
            v-for="item in group.items"
            :key="item._id || item.account_name"
            @click="selectAccount(item)"
            class="px-2.5 py-1.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors text-xs"
            :class="[
              isSelected(item) ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold' : 'hover:bg-slate-100 dark:hover:bg-zinc-800/80 text-slate-700 dark:text-zinc-200',
              highlightedKey === (item._id || item.account_name) ? 'ring-1 ring-blue-500 bg-blue-50/50 dark:bg-zinc-800' : ''
            ]"
          >
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <span class="truncate font-medium">{{ item.account_name }}</span>
              <span 
                v-if="item.account_type" 
                class="text-[8px] px-1 py-0.2 rounded font-semibold uppercase tracking-wider shrink-0"
                :class="getTypeBadgeClass(item.account_type)"
              >
                {{ formatAccountType(item.account_type) }}
              </span>
              <span 
                v-if="item.hsn_sac" 
                class="text-[8px] font-mono font-bold text-teal-600 dark:text-teal-400 px-1 py-0.2 rounded bg-teal-50 dark:bg-teal-950/40 shrink-0"
              >
                SAC: {{ item.hsn_sac }}
              </span>
              <span 
                v-if="item.gst_rate != null" 
                class="text-[8px] font-mono font-bold text-orange-600 dark:text-orange-400 px-1 py-0.2 rounded bg-orange-50 dark:bg-orange-950/40 shrink-0"
              >
                {{ item.gst_rate }}% GST
              </span>
            </div>

            <!-- Balance Preview -->
            <div v-if="showBalance && item.current_balance !== undefined" class="shrink-0 text-right">
              <span 
                class="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                :class="getBalanceBadgeClass(item)"
              >
                ₹{{ Number(item.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
                <span class="text-[8px] opacity-75">{{ item.current_balance_type || 'DR' }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Create Footer (Tally Alt+C concept) -->
      <div class="p-1.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850">
        <button
          type="button"
          @click.stop="openQuickCreate"
          class="w-full px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
        >
          <span class="flex items-center gap-1.5 truncate">
            <UIcon name="i-heroicons-plus-circle" class="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span class="truncate">{{ searchQuery ? `Create "${searchQuery.trim()}"` : 'Create New Account Head' }}</span>
          </span>
          <span class="text-[9px] bg-blue-200 dark:bg-blue-900/80 px-1.5 py-0.5 rounded font-mono shrink-0">Alt + C</span>
        </button>
      </div>
    </div>

    <!-- Universal Canonical Master Registration Modal -->
    <PartyAccountMasterModal
      v-model="isQuickCreateOpen"
      :initial-data="quickInitialData"
      :default-type="defaultCreateType"
      @saved="onMasterAccountCreated"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useApi } from '@/utils/api';
import PartyAccountMasterModal from './PartyAccountMasterModal.vue';

const api = useApi();

const props = withDefaults(defineProps<{
  modelValue: string;
  accounts?: any[];
  placeholder?: string;
  showBalance?: boolean;
  disabled?: boolean;
  filterTypes?: string[];
  matchById?: boolean;
}>(), {
  accounts: () => [],
  placeholder: '-- Select Account --',
  showBalance: true,
  disabled: false,
  matchById: false
});

const emit = defineEmits(['update:modelValue', 'change', 'accountCreated']);

const isOpen = ref(false);
const searchQuery = ref('');
const containerRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(-1);

// Master Creation State
const isQuickCreateOpen = ref(false);
const quickInitialData = ref<any>({});

const defaultCreateType = computed(() => {
  if (props.filterTypes && props.filterTypes.length === 1) {
    return props.filterTypes[0];
  }
  return 'SUNDRY_DEBTORS';
});

function openQuickCreate() {
  quickInitialData.value = {
    account_name: searchQuery.value.trim(),
    account_type: defaultCreateType.value
  };
  closeDropdown();
  isQuickCreateOpen.value = true;
}

function onMasterAccountCreated(savedDoc: any) {
  const createdAcc = {
    _id: savedDoc._id,
    account_name: savedDoc.account_name || savedDoc.name,
    account_type: savedDoc.account_type,
    current_balance: savedDoc.opening_balance || 0,
    current_balance_type: savedDoc.balance_type || 'DR',
    pan: savedDoc.pan,
    gstin: savedDoc.gstin,
    aadhaar_number: savedDoc.aadhaar_number,
    phone: savedDoc.phone || savedDoc.contact,
    bank_name: savedDoc.bank_name || savedDoc.bankName,
    account_number: savedDoc.account_number || savedDoc.accountNumber,
    ifsc_code: savedDoc.ifsc_code || savedDoc.ifscCode,
    branch_name: savedDoc.branch_name || savedDoc.branchName
  };

  emit('accountCreated', createdAcc);
  selectAccount(createdAcc);
  isQuickCreateOpen.value = false;
}

const selectedAccount = computed(() => {
  if (!props.modelValue) return null;
  return props.accounts.find(acc => 
    props.matchById ? acc._id === props.modelValue : acc.account_name === props.modelValue
  );
});

const selectedIcon = computed(() => {
  if (!selectedAccount.value) return '';
  const type = (selectedAccount.value.account_type || '').toUpperCase();
  if (type.includes('BANK')) return '💳';
  if (type.includes('CASH')) return '💰';
  if (type.includes('LABOR')) return '👷';
  if (type.includes('CREDITOR') || type.includes('SUPPLIER')) return '👥';
  if (type.includes('DEBTOR') || type.includes('CUSTOMER')) return '🛒';
  if (type.includes('EXPENSE')) return '💼';
  return '📝';
});

const flattenedFilteredItems = computed(() => {
  const list: any[] = [];
  filteredGroups.value.forEach(g => {
    g.items.forEach(item => list.push(item));
  });
  return list;
});

const highlightedKey = computed(() => {
  if (highlightedIndex.value >= 0 && highlightedIndex.value < flattenedFilteredItems.value.length) {
    const item = flattenedFilteredItems.value[highlightedIndex.value];
    return item._id || item.account_name;
  }
  return null;
});

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  
  let baseAccounts = props.accounts || [];
  if (props.filterTypes && props.filterTypes.length > 0) {
    baseAccounts = baseAccounts.filter(acc => 
      props.filterTypes?.some(t => (acc.account_type || '').toUpperCase().includes(t.toUpperCase()))
    );
  }

  if (q) {
    baseAccounts = baseAccounts.filter(acc => 
      (acc.account_name || '').toLowerCase().includes(q) ||
      (acc.account_type || '').toLowerCase().includes(q) ||
      (acc.bank_name || '').toLowerCase().includes(q)
    );
  }

  // Define Category buckets
  const banksAndCash: any[] = [];
  const laborLeaders: any[] = [];
  const creditors: any[] = [];
  const debtors: any[] = [];
  const expenses: any[] = [];
  const others: any[] = [];

  baseAccounts.forEach(acc => {
    const type = (acc.account_type || '').toUpperCase();
    const name = (acc.account_name || '').toUpperCase();

    if (type.includes('LABOR_LEADER') || type.includes('LABOR')) {
      laborLeaders.push(acc);
    } else if (type.includes('BANK') || type.includes('CASH') || name.includes('BANK') || name === 'CASH') {
      banksAndCash.push(acc);
    } else if (type.includes('CREDITOR') || type.includes('SUPPLIER') || type.includes('VENDOR')) {
      creditors.push(acc);
    } else if (type.includes('DEBTOR') || type.includes('CUSTOMER') || type.includes('CLIENT')) {
      debtors.push(acc);
    } else if (type.includes('EXPENSE')) {
      expenses.push(acc);
    } else {
      others.push(acc);
    }
  });

  const groups = [];
  if (banksAndCash.length) groups.push({ title: 'Bank & Cash Accounts', icon: '🏦', items: banksAndCash });
  if (laborLeaders.length) groups.push({ title: 'Labor Leaders', icon: '👷', items: laborLeaders });
  if (creditors.length) groups.push({ title: 'Suppliers / Creditors', icon: '👥', items: creditors });
  if (debtors.length) groups.push({ title: 'Customers / Debtors', icon: '🛒', items: debtors });
  if (expenses.length) groups.push({ title: 'Expenses', icon: '💼', items: expenses });
  if (others.length) groups.push({ title: 'Other Account Heads', icon: '📊', items: others });

  return groups;
});

function isSelected(item: any) {
  if (props.matchById) {
    return props.modelValue === item._id;
  }
  return props.modelValue === item.account_name;
}

function toggleDropdown() {
  if (props.disabled) return;
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
    highlightedIndex.value = -1;
    nextTick(() => {
      searchInputRef.value?.focus();
    });
  }
}

function closeDropdown() {
  isOpen.value = false;
}

function selectAccount(account: any) {
  const value = props.matchById ? account._id : account.account_name;
  emit('update:modelValue', value);
  emit('change', account);
  closeDropdown();
}

function navigateHighlight(step: number) {
  const max = flattenedFilteredItems.value.length;
  if (max === 0) return;
  highlightedIndex.value = (highlightedIndex.value + step + max) % max;
}

function handleEnterKey() {
  if (flattenedFilteredItems.value.length === 0 && searchQuery.value.trim()) {
    openQuickCreate();
  } else {
    selectHighlighted();
  }
}

function selectHighlighted() {
  if (highlightedIndex.value >= 0 && highlightedIndex.value < flattenedFilteredItems.value.length) {
    selectAccount(flattenedFilteredItems.value[highlightedIndex.value]);
  }
}

function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.altKey && (e.key === 'c' || e.key === 'C')) {
    e.preventDefault();
    openQuickCreate();
  }
}

function formatAccountType(type: string) {
  if (!type) return '';
  return type.replace(/_/g, ' ');
}

function getTypeBadgeClass(type: string) {
  const t = (type || '').toUpperCase();
  if (t.includes('BANK') || t.includes('CASH')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  if (t.includes('LABOR')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
  if (t.includes('CREDITOR') || t.includes('SUPPLIER')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
  if (t.includes('DEBTOR') || t.includes('CUSTOMER')) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300';
  if (t.includes('EXPENSE')) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300';
  return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function getBalanceBadgeClass(account: any) {
  const isDr = (account.current_balance_type || 'DR') === 'DR';
  const type = (account.account_type || '').toUpperCase();
  
  if (type.includes('BANK') || type.includes('CASH') || type.includes('DEBTOR')) {
    return isDr 
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
      : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';
  } else if (type.includes('CREDITOR') || type.includes('LABOR')) {
    return !isDr 
      ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
      : 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800';
  }
  return 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300';
}

function handleClickOutside(event: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
