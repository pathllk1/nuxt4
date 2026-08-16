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
      class="absolute left-0 right-0 z-50 mt-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-fadeIn"
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

    <!-- Quick Inline Account Creation Modal -->
    <UModal v-model:open="isQuickCreateOpen" title="Quick Create Account Head (Alt+C)">
      <template #body>
        <form @submit.prevent="submitQuickAccount" class="p-4 space-y-3 text-xs">
          <div>
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Account Name *</label>
            <UInput v-model="quickForm.account_name" placeholder="e.g. Delhi Transporters / Stationary" required />
          </div>

          <div>
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Account Classification Type *</label>
            <USelect v-model="quickForm.account_type" :items="quickAccountTypes" class="w-full" />
          </div>

          <!-- Context-Sensitive Section: Party -->
          <div v-if="isQuickPartyType" class="p-3 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl space-y-2">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">GSTIN (Optional)</label>
              <UInput v-model="quickForm.gstin" placeholder="15-digit GSTIN" maxlength="15" class="font-mono uppercase font-bold" @input="onQuickGstinChange" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">PAN</label>
                <UInput v-model="quickForm.pan" placeholder="10-char PAN" maxlength="10" class="font-mono uppercase font-bold" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Phone</label>
                <UInput v-model="quickForm.phone" placeholder="Mobile number" />
              </div>
            </div>
          </div>

          <!-- Context-Sensitive Section: Labor -->
          <div v-else-if="isQuickLaborType" class="p-3 bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
            <div class="grid grid-cols-2 gap-2">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Aadhaar</label>
                <UInput v-model="quickForm.aadhaar_number" placeholder="12-digit Aadhaar" maxlength="12" class="font-mono font-bold" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">PAN</label>
                <UInput v-model="quickForm.pan" placeholder="10-char PAN" maxlength="10" class="font-mono uppercase font-bold" />
              </div>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-slate-700 dark:text-zinc-300 uppercase">Phone</label>
              <UInput v-model="quickForm.phone" placeholder="Mobile number" />
            </div>
          </div>

          <!-- Non-party general contact -->
          <div v-else class="space-y-1">
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Contact Phone (Optional)</label>
            <UInput v-model="quickForm.phone" placeholder="Contact number" />
          </div>

          <div>
            <label class="block font-bold text-slate-700 dark:text-zinc-300 mb-1">Opening Balance (₹)</label>
            <div class="flex gap-2">
              <UInput v-model.number="quickForm.opening_balance" type="number" step="0.01" class="flex-1" />
              <USelect
                v-model="quickForm.balance_type"
                :items="[{ label: 'Debit (DR)', value: 'DR' }, { label: 'Credit (CR)', value: 'CR' }]"
                class="w-28"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-zinc-800">
            <UButton label="Cancel" variant="ghost" size="xs" class="cursor-pointer" @click="isQuickCreateOpen = false" />
            <UButton type="submit" label="Save & Select" color="primary" size="xs" :loading="savingQuickAccount" class="font-bold cursor-pointer" />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, reactive } from 'vue';
import { useApi } from '@/utils/api';

const api = useApi();

const props = withDefaults(defineProps<{
  modelValue: string;
  accounts: any[];
  placeholder?: string;
  showBalance?: boolean;
  disabled?: boolean;
  filterTypes?: string[];
  matchById?: boolean;
}>(), {
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

// Quick Inline Account Creation Modal State
const isQuickCreateOpen = ref(false);
const savingQuickAccount = ref(false);

const quickAccountTypes = [
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Sundry Creditors (Supplier)', value: 'SUNDRY_CREDITORS' },
  { label: 'Sundry Debtors (Customer)', value: 'SUNDRY_DEBTORS' },
  { label: 'Income', value: 'INCOME' },
  { label: 'Labor Leader', value: 'LABOR_LEADER' },
  { label: 'Asset', value: 'ASSET' },
  { label: 'Liability', value: 'LIABILITY' },
  { label: 'Bank', value: 'BANK' },
  { label: 'Cash', value: 'CASH' },
  { label: 'General', value: 'GENERAL' }
];

const quickForm = reactive({
  account_name: '',
  account_type: 'EXPENSE',
  pan: '',
  aadhaar_number: '',
  gstin: '',
  phone: '',
  opening_balance: 0,
  balance_type: 'DR'
});

const isQuickPartyType = computed(() => {
  const t = (quickForm.account_type || '').toUpperCase();
  return t.includes('DEBTOR') || t.includes('CREDITOR') || t.includes('CUSTOMER') || t.includes('SUPPLIER');
});

const isQuickLaborType = computed(() => {
  const t = (quickForm.account_type || '').toUpperCase();
  return t.includes('LABOR');
});

function onQuickGstinChange() {
  const g = (quickForm.gstin || '').trim().toUpperCase();
  if (g.length >= 12 && /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(g)) {
    if (!quickForm.pan) {
      quickForm.pan = g.substring(2, 12);
    }
  }
}

function openQuickCreate() {
  quickForm.account_name = searchQuery.value.trim();
  quickForm.account_type = 'EXPENSE';
  quickForm.pan = '';
  quickForm.aadhaar_number = '';
  quickForm.gstin = '';
  quickForm.phone = '';
  quickForm.opening_balance = 0;
  quickForm.balance_type = 'DR';
  
  closeDropdown();
  isQuickCreateOpen.value = true;
}

async function submitQuickAccount() {
  if (!quickForm.account_name.trim()) return;
  savingQuickAccount.value = true;
  try {
    const res = await api.post('/accounting/coa', quickForm);
    if (res.success && res.data) {
      const createdAcc = {
        _id: res.data._id,
        account_name: res.data.account_name,
        account_type: res.data.account_type,
        current_balance: quickForm.opening_balance || 0,
        current_balance_type: quickForm.balance_type,
        pan: res.data.pan,
        gstin: res.data.gstin,
        aadhaar_number: res.data.aadhaar_number,
        phone: res.data.phone
      };

      // Add to local list and select immediately
      emit('accountCreated', createdAcc);
      selectAccount(createdAcc);
      isQuickCreateOpen.value = false;
    }
  } catch (err: any) {
    alert(err.message || 'Failed to create account');
  } finally {
    savingQuickAccount.value = false;
  }
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
