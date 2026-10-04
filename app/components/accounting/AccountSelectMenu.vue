<template>
  <div class="relative w-full" ref="containerRef" @keydown="handleGlobalKeydown">
    <!-- Trigger Input / Button -->
    <div
      @click="toggleDropdown"
      class="flex items-center justify-between w-full px-3 py-2 text-xs bg-white dark:bg-zinc-850 border rounded-xl cursor-pointer transition-all shadow-xs group focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500"
      :class="[
        isOpen ? 'border-blue-500 ring-2 ring-blue-500/25 shadow-md bg-blue-50/20' : 'border-slate-300 dark:border-zinc-700 hover:border-slate-400 dark:hover:border-zinc-600 hover:shadow-xs',
        disabled ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-zinc-900' : ''
      ]"
    >
      <div class="flex items-center gap-2 flex-1 min-w-0 pr-1.5">
        <span v-if="selectedIcon" class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-xs shrink-0 shadow-2xs">
          {{ selectedIcon }}
        </span>
        <span v-else class="w-6 h-6 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-500 text-xs shrink-0">
          <UIcon name="i-heroicons-magnifying-glass" class="w-3.5 h-3.5" />
        </span>

        <div v-if="selectedAccount" class="flex items-center gap-1.5 truncate">
          <span class="font-bold text-slate-900 dark:text-zinc-100 truncate text-xs">
            {{ selectedAccount.account_name }}
          </span>
          <span 
            v-if="selectedAccount.account_type" 
            class="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
            :class="getTypeBadgeClass(selectedAccount.account_type)"
          >
            {{ formatAccountType(selectedAccount.account_type) }}
          </span>
        </div>
        <span v-else class="text-slate-400 dark:text-zinc-500 truncate text-xs">
          {{ placeholder || '-- Select Account Head --' }}
        </span>
      </div>

      <!-- Right Side: Balance Badge & Chevron -->
      <div class="flex items-center gap-2 shrink-0">
        <span
          v-if="showBalance && selectedAccount && selectedAccount.current_balance !== undefined"
          class="text-[10.5px] font-mono font-bold px-2 py-0.5 rounded-md"
          :class="getBalanceBadgeClass(selectedAccount)"
        >
          ₹{{ Number(selectedAccount.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
          <span class="text-[8.5px] opacity-80 uppercase ml-0.5 font-sans">{{ selectedAccount.current_balance_type || 'DR' }}</span>
        </span>
        <div class="w-5 h-5 rounded-md flex items-center justify-center bg-slate-100 dark:bg-zinc-800 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-zinc-300 transition-colors">
          <svg 
            class="w-3.5 h-3.5 transition-transform duration-200" 
            :class="{ 'rotate-180': isOpen }" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>

    <!-- Teleported Floating Popover: Breaks out of all modal clipping & overflow bounds -->
    <Teleport to="body">
      <!-- Click-outside Backdrop -->
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-[9998] bg-black/10 dark:bg-black/30 backdrop-blur-[1px]" 
        @click="closeDropdown" 
      />

      <!-- Popover Body -->
      <div
        v-if="isOpen"
        ref="dropdownRef"
        class="fixed z-[9999] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-zinc-700/90 rounded-2xl shadow-2xl overflow-hidden flex flex-col ring-1 ring-black/10 dark:ring-white/10 animate-scale-in"
        :style="popoverStyle"
      >
        <!-- Search & Filter Header -->
        <div class="p-3 border-b border-slate-200/70 dark:border-zinc-800/80 bg-slate-50/80 dark:bg-zinc-850/80 space-y-2">
          <!-- Search Bar -->
          <div class="relative flex items-center">
            <UIcon name="i-heroicons-magnifying-glass" class="w-4 h-4 text-blue-500 absolute left-3 pointer-events-none" />
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="Search account name, category, phone, GST, PAN, or Alt+C..."
              class="w-full pl-9 pr-9 py-2 text-xs font-medium bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-zinc-100 placeholder-slate-400 shadow-inner"
              @keydown.down.prevent="navigateHighlight(1)"
              @keydown.up.prevent="navigateHighlight(-1)"
              @keydown.enter.prevent="handleEnterKey"
              @keydown.esc="closeDropdown"
              @click.stop
            />
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''" 
              class="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm font-bold w-5 h-5 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700"
            >
              ×
            </button>
          </div>

          <!-- Category Segmented Filters Bar -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[10.5px]">
            <button
              v-for="tab in categoryTabs"
              :key="tab.id"
              type="button"
              @click="activeCategoryTab = tab.id"
              class="px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all whitespace-nowrap cursor-pointer shrink-0 border"
              :class="activeCategoryTab === tab.id 
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-750'"
            >
              <span>{{ tab.icon }}</span>
              <span>{{ tab.label }}</span>
              <span 
                class="ml-0.5 text-[9px] px-1 py-0.2 rounded-full font-mono font-normal"
                :class="activeCategoryTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-400'"
              >
                {{ getTabCount(tab.id) }}
              </span>
            </button>
          </div>
        </div>

        <!-- Main Body: Two-Column Split Inspector Layout -->
        <div class="flex-1 flex overflow-hidden min-h-0">
          <!-- Left Pane: Account List -->
          <div 
            ref="listRef" 
            class="flex-1 overflow-y-auto p-2 divide-y divide-slate-100 dark:divide-zinc-800/60 max-h-[340px] scrollbar-thin"
          >
            <div v-if="filteredGroups.length === 0" class="py-10 text-center text-xs text-slate-400 dark:text-zinc-500 space-y-2">
              <div class="text-3xl">🔍</div>
              <p class="font-medium">No accounts found matching "{{ searchQuery }}"</p>
              <p class="text-[11px] text-blue-600 dark:text-blue-400 font-semibold cursor-pointer" @click="openQuickCreate">
                Press Enter or click here to create "{{ searchQuery }}" (Alt+C)
              </p>
            </div>

            <div v-for="group in filteredGroups" :key="group.title" class="py-1">
              <!-- Compact Group Header -->
              <div class="px-2.5 py-1 text-[9.5px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 bg-slate-100/80 dark:bg-zinc-800/80 backdrop-blur-xs sticky top-0 z-10 flex items-center justify-between rounded-md mb-1 border-b border-slate-200/50 dark:border-zinc-700/50">
                <span class="flex items-center gap-1.5">{{ group.icon }} {{ group.title }}</span>
                <span class="text-[8.5px] font-semibold bg-white dark:bg-zinc-900 px-1.5 py-0.2 rounded-full border border-slate-200 dark:border-zinc-700 font-mono">
                  {{ group.items.length }}
                </span>
              </div>

              <!-- List Items -->
              <div
                v-for="item in group.items"
                :key="item._id || item.account_name"
                :data-highlighted="highlightedKey === (item._id || item.account_name)"
                @click="selectAccount(item)"
                @mouseenter="highlightItem(item)"
                class="group px-3 py-2 rounded-xl flex items-center justify-between cursor-pointer transition-all text-xs border mb-1"
                :class="[
                  isSelected(item) 
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold border-blue-200 dark:border-blue-800 shadow-xs' 
                    : highlightedKey === (item._id || item.account_name) 
                      ? 'bg-blue-50/70 dark:bg-zinc-800 border-blue-400/80 dark:border-zinc-600 shadow-sm translate-x-0.5' 
                      : 'hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-700 dark:text-zinc-200 border-transparent hover:border-slate-200 dark:hover:border-zinc-700'
                ]"
              >
                <!-- Left: Avatar + Details -->
                <div class="flex items-center gap-2.5 min-w-0 pr-2">
                  <div 
                    class="w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 shadow-2xs font-bold"
                    :class="getCategoryAvatarClass(item.account_type)"
                  >
                    {{ getCategoryEmoji(item.account_type) }}
                  </div>

                  <div class="flex flex-col min-w-0 gap-0.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-bold text-slate-900 dark:text-zinc-100 text-xs">
                        <template v-for="(part, pIdx) in getHighlightedParts(item.account_name, searchQuery)" :key="pIdx">
                          <mark v-if="part.match" class="bg-amber-200 dark:bg-amber-900/70 text-slate-950 dark:text-amber-100 rounded-xs px-0.5 font-bold">{{ part.text }}</mark>
                          <span v-else>{{ part.text }}</span>
                        </template>
                      </span>

                      <span 
                        v-if="item.account_type" 
                        class="text-[8.5px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0"
                        :class="getTypeBadgeClass(item.account_type)"
                      >
                        {{ formatAccountType(item.account_type) }}
                      </span>
                    </div>

                    <!-- Monospace Secondary Info -->
                    <div v-if="item.phone || item.pan || item.gstin || item.bank_name" class="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-mono truncate">
                      <span v-if="item.phone">📞 {{ item.phone }}</span>
                      <span v-if="item.gstin">GST: {{ item.gstin }}</span>
                      <span v-if="item.pan && !item.gstin">PAN: {{ item.pan }}</span>
                      <span v-if="item.bank_name">🏦 {{ item.bank_name }}</span>
                    </div>
                  </div>
                </div>

                <!-- Right: Balance Pill -->
                <div v-if="showBalance && item.current_balance !== undefined" class="shrink-0 text-right pl-2">
                  <span 
                    class="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md inline-block shadow-2xs"
                    :class="getBalanceBadgeClass(item)"
                  >
                    ₹{{ Number(item.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) }}
                    <span class="text-[8.5px] opacity-80 uppercase ml-0.5">{{ item.current_balance_type || 'DR' }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Pane: Real-Time Ledger Intelligence Inspector -->
          <div 
            v-if="activeHighlightedItem"
            class="hidden md:flex w-[260px] flex-col justify-between p-3.5 bg-slate-50/70 dark:bg-zinc-850/60 border-l border-slate-200/80 dark:border-zinc-750/80 space-y-3"
          >
            <div class="space-y-3">
              <!-- Header -->
              <div class="flex items-start gap-2.5">
                <div class="w-9 h-9 rounded-xl flex items-center justify-center text-base shadow-xs" :class="getCategoryAvatarClass(activeHighlightedItem.account_type)">
                  {{ getCategoryEmoji(activeHighlightedItem.account_type) }}
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="font-black text-xs text-slate-900 dark:text-white truncate leading-tight">
                    {{ activeHighlightedItem.account_name }}
                  </h4>
                  <div class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium capitalize mt-0.5">
                    {{ formatAccountType(activeHighlightedItem.account_type) }}
                  </div>
                </div>
              </div>

              <!-- Balance Intelligence Card -->
              <div class="p-2.5 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-2xs space-y-1">
                <div class="text-[9.5px] font-bold text-slate-400 dark:text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Current Balance</span>
                  <span class="font-mono text-blue-600 dark:text-blue-400">{{ activeHighlightedItem.current_balance_type || 'DR' }}</span>
                </div>
                <div class="text-base font-black font-mono text-slate-900 dark:text-white">
                  ₹{{ Number(activeHighlightedItem.current_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </div>
                <div class="text-[9px] text-slate-500 dark:text-zinc-400">
                  {{ (activeHighlightedItem.current_balance_type || 'DR') === 'DR' ? 'Debit balance (Asset / Receivable / Expense)' : 'Credit balance (Liability / Payable / Capital)' }}
                </div>
              </div>

              <!-- Secondary Details Grid -->
              <div class="space-y-1.5 text-[10.5px]">
                <div v-if="activeHighlightedItem.parent_group" class="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span class="text-slate-400 dark:text-zinc-500">Group:</span>
                  <span class="font-semibold truncate max-w-[150px]">{{ activeHighlightedItem.parent_group }}</span>
                </div>
                <div v-if="activeHighlightedItem.pan" class="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span class="text-slate-400 dark:text-zinc-500">PAN:</span>
                  <span class="font-mono font-bold">{{ activeHighlightedItem.pan }}</span>
                </div>
                <div v-if="activeHighlightedItem.gstin" class="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span class="text-slate-400 dark:text-zinc-500">GSTIN:</span>
                  <span class="font-mono font-bold text-[9.5px]">{{ activeHighlightedItem.gstin }}</span>
                </div>
                <div v-if="activeHighlightedItem.phone" class="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span class="text-slate-400 dark:text-zinc-500">Phone:</span>
                  <span class="font-mono font-medium">{{ activeHighlightedItem.phone }}</span>
                </div>
                <div v-if="activeHighlightedItem.bank_name" class="flex items-center justify-between text-slate-600 dark:text-zinc-300">
                  <span class="text-slate-400 dark:text-zinc-500">Bank:</span>
                  <span class="font-medium truncate max-w-[150px]">{{ activeHighlightedItem.bank_name }}</span>
                </div>
              </div>
            </div>

            <!-- Action Prompt -->
            <button
              type="button"
              @click="selectAccount(activeHighlightedItem)"
              class="w-full py-1.5 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>Select Account</span>
              <span class="text-[9px] font-mono bg-blue-500 px-1 py-0.2 rounded">↵ Enter</span>
            </button>
          </div>
        </div>

        <!-- Popover Action Footer -->
        <div class="p-2 border-t border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850 flex items-center justify-between gap-3 text-xs">
          <!-- Keyboard Hints -->
          <div class="hidden sm:flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 shadow-2xs font-mono font-bold">↑↓</kbd> Navigate</span>
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 shadow-2xs font-mono font-bold">↵</kbd> Select</span>
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-white dark:bg-zinc-800 rounded border border-slate-200 dark:border-zinc-700 shadow-2xs font-mono font-bold">Esc</kbd> Close</span>
          </div>

          <!-- Quick Create Action -->
          <button
            type="button"
            @click.stop="openQuickCreate"
            class="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer border border-blue-200 dark:border-blue-800/60 ml-auto"
          >
            <UIcon name="i-heroicons-plus-circle" class="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span>{{ searchQuery ? `Create "${searchQuery.trim()}"` : 'Create New Account Head' }}</span>
            <span class="text-[9px] bg-blue-200 dark:bg-blue-900/80 px-1.5 py-0.5 rounded font-mono">Alt + C</span>
          </button>
        </div>
      </div>
    </Teleport>

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
  placeholder: '-- Select Account Head --',
  showBalance: true,
  disabled: false,
  matchById: false
});

const emit = defineEmits(['update:modelValue', 'change', 'accountCreated']);

const isOpen = ref(false);
const searchQuery = ref('');
const activeCategoryTab = ref('ALL');
const containerRef = ref<HTMLElement | null>(null);
const searchInputRef = ref<HTMLInputElement | null>(null);
const listRef = ref<HTMLElement | null>(null);
const dropdownRef = ref<HTMLElement | null>(null);
const highlightedIndex = ref(-1);

const popoverStyle = ref({
  position: 'fixed' as const,
  top: '0px',
  left: '0px',
  width: '680px',
  zIndex: 9999
});

const categoryTabs = [
  { id: 'ALL', label: 'All', icon: '⚡' },
  { id: 'LABOR', label: 'Labor & Staff', icon: '👷' },
  { id: 'CREDITORS', label: 'Creditors & Suppliers', icon: '🏭' },
  { id: 'EXPENSES', label: 'Expenses', icon: '💼' },
  { id: 'DEBTORS', label: 'Customers', icon: '🛒' },
  { id: 'BANKS', label: 'Bank & Cash', icon: '🏦' },
  { id: 'TAX', label: 'Duties & Taxes', icon: '⚖️' }
];

function calculatePosition() {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  const popoverWidth = Math.min(680, window.innerWidth - 32);
  const popoverHeight = 440; // estimated max height
  
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;
  const openUpward = spaceBelow < 380 && spaceAbove > spaceBelow;
  
  let top = openUpward ? rect.top - popoverHeight - 8 : rect.bottom + 8;
  if (top < 16) top = 16;
  if (top + popoverHeight > window.innerHeight - 16) {
    top = window.innerHeight - popoverHeight - 16;
  }
  
  let left = rect.left;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }
  if (left < 16) left = 16;
  
  popoverStyle.value = {
    position: 'fixed',
    top: `${Math.round(top)}px`,
    left: `${Math.round(left)}px`,
    width: `${Math.round(popoverWidth)}px`,
    zIndex: 9999
  };
}

function getHighlightedParts(text: string, query: string) {
  if (!text) return [{ text: '', match: false }];
  if (!query || !query.trim()) return [{ text, match: false }];
  const trimmed = query.trim();
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.filter(p => p.length > 0).map(part => ({
    text: part,
    match: part.toLowerCase() === trimmed.toLowerCase()
  }));
}

// Master Creation State
const isQuickCreateOpen = ref(false);
const quickInitialData = ref<any>({});

const defaultCreateType = computed(() => {
  if (activeCategoryTab.value === 'LABOR') return 'CASUAL_LABOR';
  if (activeCategoryTab.value === 'CREDITORS') return 'SUNDRY_CREDITORS';
  if (activeCategoryTab.value === 'EXPENSES') return 'INDIRECT_EXPENSES';
  if (activeCategoryTab.value === 'DEBTORS') return 'SUNDRY_DEBTORS';
  if (activeCategoryTab.value === 'BANKS') return 'BANK_ACCOUNT';
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
  return getCategoryEmoji(selectedAccount.value.account_type);
});

function getTabCount(tabId: string): number {
  const base = props.accounts || [];
  if (tabId === 'ALL') return base.length;
  return base.filter(acc => matchesTab(acc, tabId)).length;
}

function matchesTab(acc: any, tabId: string): boolean {
  const type = (acc.account_type || '').toUpperCase();
  const name = (acc.account_name || '').toUpperCase();
  if (tabId === 'ALL') return true;
  if (tabId === 'BANKS') return type.includes('BANK') || type.includes('CASH') || name.includes('BANK') || name === 'CASH';
  if (tabId === 'LABOR') return type.includes('LABOR') || type.includes('STAFF');
  if (tabId === 'CREDITORS') return type.includes('CREDITOR') || type.includes('SUPPLIER') || type.includes('VENDOR') || type.includes('TRANSPORTER');
  if (tabId === 'DEBTORS') return type.includes('DEBTOR') || type.includes('CUSTOMER') || type.includes('CLIENT');
  if (tabId === 'EXPENSES') return type.includes('EXPENSE');
  if (tabId === 'TAX') return type.includes('TAX') || type.includes('DUTIES') || type.includes('TDS') || type.includes('GST');
  return true;
}

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  
  let baseAccounts = props.accounts || [];
  if (props.filterTypes && props.filterTypes.length > 0) {
    baseAccounts = baseAccounts.filter(acc => 
      props.filterTypes?.some(t => (acc.account_type || '').toUpperCase().includes(t.toUpperCase()))
    );
  }

  // Filter by category tab
  if (activeCategoryTab.value !== 'ALL') {
    baseAccounts = baseAccounts.filter(acc => matchesTab(acc, activeCategoryTab.value));
  }

  // Filter by search query
  if (q) {
    baseAccounts = baseAccounts.filter(acc => 
      (acc.account_name || '').toLowerCase().includes(q) ||
      (acc.account_type || '').toLowerCase().includes(q) ||
      (acc.phone || '').toLowerCase().includes(q) ||
      (acc.pan || '').toLowerCase().includes(q) ||
      (acc.gstin || '').toLowerCase().includes(q) ||
      (acc.bank_name || '').toLowerCase().includes(q)
    );
  }

  // Category buckets
  const banksAndCash: any[] = [];
  const laborLeaders: any[] = [];
  const creditors: any[] = [];
  const debtors: any[] = [];
  const expenses: any[] = [];
  const taxes: any[] = [];
  const loansAndCapital: any[] = [];
  const others: any[] = [];

  baseAccounts.forEach(acc => {
    const type = (acc.account_type || '').toUpperCase();
    const name = (acc.account_name || '').toUpperCase();

    if (type.includes('BANK') || type.includes('CASH') || name.includes('BANK') || name === 'CASH') {
      banksAndCash.push(acc);
    } else if (type.includes('LABOR') || type.includes('STAFF') || type === 'CASUAL_LABOR') {
      laborLeaders.push(acc);
    } else if (type.includes('CREDITOR') || type.includes('SUPPLIER') || type.includes('VENDOR') || type.includes('TRANSPORTER')) {
      creditors.push(acc);
    } else if (type.includes('DEBTOR') || type.includes('CUSTOMER') || type.includes('CLIENT')) {
      debtors.push(acc);
    } else if (type.includes('TAX') || type.includes('DUTIES') || type.includes('TDS') || type.includes('GST')) {
      taxes.push(acc);
    } else if (type.includes('EXPENSE')) {
      expenses.push(acc);
    } else if (type.includes('LOAN') || type.includes('CAPITAL') || type.includes('BORROW') || type.includes('EQUITY')) {
      loansAndCapital.push(acc);
    } else {
      others.push(acc);
    }
  });

  const groups = [];
  if (banksAndCash.length) groups.push({ title: 'Bank & Cash Accounts', icon: '🏦', items: banksAndCash });
  if (laborLeaders.length) groups.push({ title: 'Labor & Staff (Wages / People)', icon: '👷', items: laborLeaders });
  if (creditors.length) groups.push({ title: 'Suppliers & Transporters', icon: '🏭', items: creditors });
  if (debtors.length) groups.push({ title: 'Customers / Debtors', icon: '🛒', items: debtors });
  if (expenses.length) groups.push({ title: 'Direct & Indirect Expenses', icon: '💼', items: expenses });
  if (taxes.length) groups.push({ title: 'Duties & Taxes (GST / TDS)', icon: '⚖️', items: taxes });
  if (loansAndCapital.length) groups.push({ title: 'Loans, Borrowings & Capital', icon: '🏛️', items: loansAndCapital });
  if (others.length) groups.push({ title: 'Other Account Heads', icon: '📊', items: others });

  return groups;
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

const activeHighlightedItem = computed(() => {
  if (highlightedIndex.value >= 0 && highlightedIndex.value < flattenedFilteredItems.value.length) {
    return flattenedFilteredItems.value[highlightedIndex.value];
  }
  return flattenedFilteredItems.value[0] || null;
});

function highlightItem(item: any) {
  const idx = flattenedFilteredItems.value.findIndex(i => (i._id || i.account_name) === (item._id || item.account_name));
  if (idx !== -1) {
    highlightedIndex.value = idx;
  }
}

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
    calculatePosition();
    searchQuery.value = '';
    activeCategoryTab.value = 'ALL';
    highlightedIndex.value = flattenedFilteredItems.value.length > 0 ? 0 : -1;
    nextTick(() => {
      calculatePosition();
      searchInputRef.value?.focus();
    });
  }
}

watch(searchQuery, () => {
  highlightedIndex.value = flattenedFilteredItems.value.length > 0 ? 0 : -1;
  nextTick(() => {
    calculatePosition();
  });
});

watch(activeCategoryTab, () => {
  highlightedIndex.value = flattenedFilteredItems.value.length > 0 ? 0 : -1;
});

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
  nextTick(() => {
    const el = listRef.value?.querySelector(`[data-highlighted="true"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
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

function getCategoryEmoji(type: string): string {
  const t = (type || '').toUpperCase();
  if (t.includes('BANK')) return '💳';
  if (t.includes('CASH')) return '💰';
  if (t.includes('LABOR')) return '👷';
  if (t.includes('CREDITOR') || t.includes('SUPPLIER')) return '🏭';
  if (t.includes('DEBTOR') || t.includes('CUSTOMER')) return '🛒';
  if (t.includes('EXPENSE')) return '💼';
  if (t.includes('TAX') || t.includes('DUTIES') || t.includes('TDS')) return '⚖️';
  return '📝';
}

function getCategoryAvatarClass(type: string): string {
  const t = (type || '').toUpperCase();
  if (t.includes('BANK') || t.includes('CASH')) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300';
  if (t.includes('LABOR')) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300';
  if (t.includes('CREDITOR') || t.includes('SUPPLIER')) return 'bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300';
  if (t.includes('DEBTOR') || t.includes('CUSTOMER')) return 'bg-teal-100 text-teal-800 dark:bg-teal-950/80 dark:text-teal-300';
  if (t.includes('EXPENSE')) return 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300';
  if (t.includes('TAX') || t.includes('DUTIES') || t.includes('TDS')) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300';
  return 'bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300';
}

function getTypeBadgeClass(type: string) {
  const t = (type || '').toUpperCase();
  if (t.includes('BANK') || t.includes('CASH')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300';
  if (t.includes('LABOR')) return 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300';
  if (t.includes('CREDITOR') || t.includes('SUPPLIER')) return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300';
  if (t.includes('DEBTOR') || t.includes('CUSTOMER')) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300';
  if (t.includes('EXPENSE')) return 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300';
  if (t.includes('DUTIES') || t.includes('TAX') || t.includes('TDS')) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300';
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

function handleScrollOrResize() {
  if (isOpen.value) {
    calculatePosition();
  }
}

onMounted(() => {
  window.addEventListener('resize', handleScrollOrResize, { passive: true });
  window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
});

onUnmounted(() => {
  window.removeEventListener('resize', handleScrollOrResize);
  window.removeEventListener('scroll', handleScrollOrResize, true);
});
</script>
