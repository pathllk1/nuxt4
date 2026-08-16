<template>
  <div class="invoice-page" ref="pageContainerRef">
    <header class="page-header">
      <div class="title-block">
        <p>{{ currentFirmName }}</p>
        <h1>Service Purchase Bill</h1>
      </div>

      <div class="header-fields">
        <label>
          <span>Bill No</span>
          <input :value="meta.billNo || 'API/AUTO'" type="text" readonly class="readonly-input font-mono" />
        </label>
        <label>
          <span>Bill Date</span>
          <input 
            ref="firstInputRef" 
            v-model="meta.billDate" 
            type="date" 
            class="first-input" 
            @keydown.enter.prevent="onDateEnter" 
          />
        </label>
        <label>
          <span>Supplier Bill No</span>
          <input 
            ref="supplierBillNoInputRef"
            v-model="meta.supplierBillNo" 
            type="text" 
            placeholder="Vendor invoice #" 
            @keydown.enter.prevent="onSupplierBillNoEnter"
          />
        </label>

        <!-- Firm Location / Billing From GSTIN Selector -->
        <label v-if="firmLocations.length >= 1">
          <span>Billing to GSTIN</span>
          <select 
            ref="firmGstinSelectRef"
            :value="activeFirmLocation?.gst_number || ''" 
            @change="onFirmGstinChange"
            @keydown.enter.prevent="onFirmGstinEnter"
          >
            <option v-for="location in firmLocations" :key="location.gst_number || location.state_code" :value="location.gst_number || ''">
              {{ location.gst_number || 'No GSTIN' }} - {{ location.state || location.state_code || '' }}{{ location.is_default ? ' (Default)' : '' }}
            </option>
          </select>
        </label>

        <!-- Transaction Type -->
        <label v-if="gstEnabled">
          <span>Transaction Type</span>
          <select 
            ref="txTypeSelectRef"
            v-model="meta.billType"
            @keydown.enter.prevent="onTxTypeEnter"
          >
            <option value="intra-state">Intra-State (CGST + SGST)</option>
            <option value="inter-state">Inter-State (IGST)</option>
          </select>
        </label>

        <label v-if="gstEnabled" class="inline-toggle">
          <input v-model="meta.reverseCharge" type="checkbox" @keydown.enter.prevent="onReverseChargeEnter" />
          <span>Reverse Charge (RCM)</span>
        </label>
      </div>

      <div class="header-actions">
        <button class="ghost-btn" type="button" @click="resetForm" title="Discard (F9)">Discard (F9)</button>
        <button class="primary-btn purchase" type="button" :disabled="saving || !canSave" @click="handleSave" title="Save Bill (F8)">
          {{ saving ? 'Saving...' : 'Save Bill' }}
          <span>F8</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="side-panel">
        <PartyManager
          :state="partyState"
          title="Vendor / Supplier"
          empty-subtitle="Supplier record (Press F3 to Select)"
          @open-modal="openPartyDrawer"
          @create-party="openCreatePartyModal"
          @location-change="onPartyLocationChange"
        />

        <section class="detail-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Details</p>
              <h2>Reference & Notes</h2>
            </div>
            <button type="button" @click="openOtherChargesModal">Charges F4</button>
          </div>

          <div class="field-grid">
            <label>
              <span>Reference / PO</span>
              <input 
                ref="referenceInputRef"
                v-model="meta.referenceNo" 
                type="text" 
                placeholder="Optional" 
                @keydown.enter.prevent="onReferenceEnter"
                @keydown.backspace="onReferenceBackspace"
              />
            </label>
            <label class="wide">
              <span>Narration</span>
              <textarea 
                ref="narrationInputRef"
                v-model="meta.narration" 
                rows="3" 
                placeholder="Additional notes... (Enter advances to Cart)" 
                @keydown="onNarrationKeydown"
              ></textarea>
            </label>
          </div>
        </section>

        <!-- Invoice Totals -->
        <section class="totals-panel">
          <div class="totals-head">
            <p class="eyebrow">Financials</p>
            <h2>Bill Totals</h2>
          </div>
          <div class="totals-grid">
            <div class="totals-row">
              <span>Taxable Amount</span>
              <span class="amount">₹{{ computedTotals.taxableTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="meta.billType === 'intra-state'" class="totals-row">
              <span>CGST (Input Credit)</span>
              <span class="amount">₹{{ computedTotals.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="meta.billType === 'intra-state'" class="totals-row">
              <span>SGST (Input Credit)</span>
              <span class="amount">₹{{ computedTotals.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="meta.billType !== 'intra-state'" class="totals-row">
              <span>IGST (Input Credit)</span>
              <span class="amount">₹{{ computedTotals.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}</span>
            </div>
            <div v-if="Math.abs(computedTotals.roundOff) > 0" class="totals-row dim">
              <span>Round Off</span>
              <span class="amount">₹{{ computedTotals.roundOff.toFixed(2) }}</span>
            </div>
            <div class="totals-row grand">
              <span>Net Payable</span>
              <span class="amount">₹{{ computedTotals.netTotal.toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </section>
      </aside>

      <section class="main-panel">
        <LedgerCartManager
          ref="cartManagerRef"
          :cart="cart"
          filter-type="EXPENSE"
          @add-item="onAddCartItem"
          @remove-item="(idx) => removeItem(idx)"
          @update-item="(idx, field, val) => updateItem(idx, field, val)"
          @open-ledger-modal="openLedgerModal"
        />
      </section>
    </main>

    <!-- Modals -->
    <LedgerModal v-model="showLedgerModal" @select="onLedgerSelect" />
    <PartyModal v-model="showCreatePartyModal" @saved="onPartySaved" />
    <OtherChargesModal v-model="showOtherChargesModal" :other-charges="otherCharges" />

    <!-- Print & Success Modal with Complete Zero-Mouse Keyboard Support -->
    <UModal v-model:open="showSuccessModal" title="Service Purchase Bill Saved Successfully">
      <template #body>
        <div 
          class="p-6 flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl outline-none" 
          tabindex="0" 
          ref="successModalContainerRef"
          @keydown="handleSuccessModalKeydown"
        >
          <div class="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400">
            <UIcon name="i-heroicons-check-circle" class="w-12 h-12" />
          </div>
          <div>
            <h3 class="text-lg font-black text-gray-900 dark:text-white">Service Purchase Bill #{{ createdBill?.bno }} Saved</h3>
            <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium">
              Press <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">P</kbd> for PDF, <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">E</kbd> for Excel, or <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">Enter / ESC</kbd> for Next Bill
            </p>
          </div>
          <div class="flex flex-wrap gap-2.5 mt-2 w-full justify-center">
            <UButton 
              color="primary" 
              icon="i-heroicons-arrow-down-tray" 
              label="Download PDF (P)" 
              class="font-bold cursor-pointer"
              @click="downloadCreatedPDF" 
            />
            <UButton 
              color="success" 
              icon="i-heroicons-table-cells" 
              label="Export Excel (E)" 
              class="font-bold cursor-pointer"
              @click="downloadCreatedExcel" 
            />
            <UButton 
              color="neutral" 
              variant="outline" 
              label="Next Bill (ESC)" 
              class="font-bold cursor-pointer"
              @click="closeSuccess" 
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Keyboard Cheatsheet (F1) -->
    <UModal v-model:open="showHelpModal" title="Service Purchase Bill Keyboard Cheatsheet">
      <template #body>
        <div class="p-4 space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-primary text-sm">F2</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Chart of Accounts</p>
              <p class="text-[10px] text-slate-400">Search & add expense account heads</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-emerald-600 text-sm">F3</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Supplier Selector</p>
              <p class="text-[10px] text-slate-400">Search & select vendor record</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-indigo-600 text-sm">F4</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Other Charges</p>
              <p class="text-[10px] text-slate-400">Add freight, handling, delivery</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-rose-600 text-sm">F8 / Ctrl+S</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Save Bill</p>
              <p class="text-[10px] text-slate-400">Finalize & post to double-entry ledger</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-amber-600 text-sm">F9</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Discard</p>
              <p class="text-[10px] text-slate-400">Clear and reset form</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-purple-600 text-sm">Insert / Ctrl+N</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">New Supplier</p>
              <p class="text-[10px] text-slate-400">Quick create new vendor record</p>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-200 dark:border-zinc-700 text-slate-500 text-[11px] flex justify-between items-center">
            <span><kbd class="font-bold">Enter</kbd> Next Field • <kbd class="font-bold">Backspace</kbd> Prev Field • <kbd class="font-bold">Del</kbd> Remove Row</span>
            <UButton size="xs" color="neutral" variant="outline" label="Got it (ESC)" class="cursor-pointer" @click="showHelpModal = false" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Party Drawer -->
    <div v-if="showPartyDrawer" class="drawer-backdrop" @click.self="closePartyDrawer">
      <div class="party-drawer" role="dialog" aria-modal="true">
        <header class="drawer-head">
          <div>
            <p class="eyebrow">Suppliers</p>
            <h2>Choose Vendor</h2>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="create-party-btn text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded cursor-pointer" @click="openCreatePartyFromDrawer">+ New (Insert)</button>
            <button type="button" class="drawer-close" @click="closePartyDrawer">Close (Esc)</button>
          </div>
        </header>
        <div class="search-box">
          <input
            ref="partySearchRef"
            v-model="partySearch"
            type="text"
            placeholder="Search supplier... (↑↓ Navigate • Enter Select • Insert New • ESC Close)"
            class="search-input"
            @keydown="onPartySearchKeydown"
          />
        </div>
        <div class="party-list" ref="partyListRef">
          <button
            v-for="(p, idx) in filteredParties"
            :key="p._id"
            class="party-option"
            :class="{ active: partyActiveIdx === idx }"
            type="button"
            @click="selectParty(p)"
          >
            <div class="party-info">
              <span class="name">{{ p.name }}</span>
              <span v-if="p.gstin || p.gstLocations?.[0]?.gstin" class="gstin">{{ p.gstin || p.gstLocations?.[0]?.gstin }}</span>
            </div>
            <div v-if="p.formattedBalance" class="party-bal-badge" :class="[partyActiveIdx === idx ? 'active-badge' : (p.closingBalanceType === 'DR' ? 'bal-dr' : p.closingBalanceType === 'CR' ? 'bal-cr' : 'bal-nil')]">
              ₹{{ p.formattedBalance }} {{ p.closingBalanceType }}
            </div>
          </button>
          <div v-if="filteredParties.length === 0" class="empty-list">
            <p>No suppliers found</p>
            <button type="button" class="mt-2 text-emerald-600 font-bold underline cursor-pointer text-xs" @click="openCreatePartyFromDrawer">
              Press Insert to Register New Supplier
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useApi } from '@/utils/api';
import { useAccountingInvoiceState, type COAAccount } from '@/composables/useAccountingInvoiceState';
import { INDIA_STATE_CODES } from '@/composables/useBillingState';
import PartyManager from '@/components/accounting/PartyManager.vue';
import LedgerCartManager from '@/components/accounting/LedgerCartManager.vue';
import LedgerModal from '@/components/accounting/LedgerModal.vue';
import PartyModal from '@/components/accounting/PartyModal.vue';
import OtherChargesModal from '@/components/accounting/OtherChargesModal.vue';

const api = useApi();
const { cart, addItem, removeItem, updateItem, clearCart, computeTotals, saving, saveInvoice, saveError } = useAccountingInvoiceState('PURCHASE');

// ─── Firm & Statutory State ───
const currentFirmName = ref('Loading...');
const firmLocations = ref<any[]>([]);
const activeFirmLocation = ref<any>(null);
const gstEnabled = ref(true);

// ─── Party State ───
const parties = ref<any[]>([]);
const selectedParty = ref<any>(null);
const selectedPartyLocation = ref<any>(null);
const selectedPartyGstin = ref<string | null>(null);

// ─── Bill Metadata ───
const meta = ref({
  billNo: '',
  billDate: new Date().toISOString().split('T')[0],
  billType: 'intra-state',
  reverseCharge: false,
  supplierBillNo: '',
  referenceNo: '',
  narration: '',
});

const otherCharges = ref<any[]>([]);

// Modals
const showLedgerModal = ref(false);
const showPartyDrawer = ref(false);
const showCreatePartyModal = ref(false);
const showOtherChargesModal = ref(false);
const showSuccessModal = ref(false);
const showHelpModal = ref(false);
const createdBill = ref<any>(null);

// Refs for direct element focus
const pageContainerRef = ref<HTMLElement | null>(null);
const firstInputRef = ref<HTMLInputElement | null>(null);
const supplierBillNoInputRef = ref<HTMLInputElement | null>(null);
const firmGstinSelectRef = ref<HTMLSelectElement | null>(null);
const txTypeSelectRef = ref<HTMLSelectElement | null>(null);
const referenceInputRef = ref<HTMLInputElement | null>(null);
const narrationInputRef = ref<HTMLTextAreaElement | null>(null);
const cartManagerRef = ref<any>(null);

// Party search
const partySearch = ref('');
const partyActiveIdx = ref(0);
const partySearchRef = ref<HTMLInputElement | null>(null);
const partyListRef = ref<HTMLElement | null>(null);
const successModalContainerRef = ref<HTMLElement | null>(null);

// ─── Party State for PartyManager Component ───
const partyState = computed(() => ({
  selectedParty: selectedParty.value,
  selectedPartyGstin: selectedPartyGstin.value,
  selectedPartyLocation: selectedPartyLocation.value,
  parties: parties.value,
  gstEnabled: gstEnabled.value,
  isReturnMode: false,
  consigneeSameAsBillTo: true,
  selectedConsignee: null,
}));

// ─── Modal Open/Close Helpers ───
function openLedgerModal() {
  showLedgerModal.value = true;
}

function openPartyDrawer() {
  partyActiveIdx.value = 0;
  partySearch.value = '';
  showPartyDrawer.value = true;
  nextTick(() => {
    partySearchRef.value?.focus();
  });
}

function closePartyDrawer() {
  showPartyDrawer.value = false;
  nextTick(() => {
    if (selectedParty.value) {
      referenceInputRef.value?.focus();
      referenceInputRef.value?.select();
    } else {
      firstInputRef.value?.focus();
    }
  });
}

function openCreatePartyModal() {
  showCreatePartyModal.value = true;
}

function openOtherChargesModal() {
  showOtherChargesModal.value = true;
}

function openCreatePartyFromDrawer() {
  showPartyDrawer.value = false;
  openCreatePartyModal();
}

// ─── Header & Form Enter Progression (Strict ERP Loop) ───
function onDateEnter() {
  if (supplierBillNoInputRef.value) {
    supplierBillNoInputRef.value.focus();
    supplierBillNoInputRef.value.select();
  } else {
    advanceToFirmOrParty();
  }
}

function onSupplierBillNoEnter() {
  advanceToFirmOrParty();
}

function advanceToFirmOrParty() {
  if (firmLocations.value.length > 1 && firmGstinSelectRef.value) {
    firmGstinSelectRef.value.focus();
  } else if (gstEnabled.value && txTypeSelectRef.value) {
    txTypeSelectRef.value.focus();
  } else {
    advanceToPartyOrReference();
  }
}

function onFirmGstinEnter() {
  if (gstEnabled.value && txTypeSelectRef.value) {
    txTypeSelectRef.value.focus();
  } else {
    advanceToPartyOrReference();
  }
}

function onTxTypeEnter() {
  advanceToPartyOrReference();
}

function onReverseChargeEnter() {
  advanceToPartyOrReference();
}

function advanceToPartyOrReference() {
  if (!selectedParty.value) {
    // If supplier not selected yet, automatically pop the party drawer!
    openPartyDrawer();
  } else {
    referenceInputRef.value?.focus();
    referenceInputRef.value?.select();
  }
}

function onReferenceEnter() {
  narrationInputRef.value?.focus();
  narrationInputRef.value?.select();
}

function onReferenceBackspace(e: KeyboardEvent) {
  const target = e.target as HTMLInputElement;
  if (target && (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0))) {
    e.preventDefault();
    if (supplierBillNoInputRef.value) {
      supplierBillNoInputRef.value.focus();
      supplierBillNoInputRef.value.select();
    } else {
      firstInputRef.value?.focus();
    }
  }
}

function onNarrationKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (e.shiftKey) return;
    e.preventDefault();
    if (cart.value.length > 0) {
      cartManagerRef.value?.focusRowSac(0);
    } else {
      openLedgerModal();
    }
  } else if (e.key === 'Backspace') {
    const target = e.target as HTMLTextAreaElement;
    if (target && (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0))) {
      e.preventDefault();
      referenceInputRef.value?.focus();
      referenceInputRef.value?.select();
    }
  }
}

// ─── Automatic GST Bill Type Detection ───
function determineGstBillType() {
  const firmCode = activeFirmLocation.value?.state_code || activeFirmLocation.value?.gst_number?.substring(0, 2);
  const partyCode = selectedPartyLocation.value?.stateCode ||
                    selectedParty.value?.stateCode ||
                    (selectedPartyGstin.value && selectedPartyGstin.value !== 'UNREGISTERED' && selectedPartyGstin.value.length >= 2 ? selectedPartyGstin.value.substring(0, 2) : null) ||
                    (selectedParty.value?.state ? INDIA_STATE_CODES[selectedParty.value.state.toLowerCase()] : null);

  if (firmCode && partyCode) {
    if (firmCode.toString().padStart(2, '0') === partyCode.toString().padStart(2, '0')) {
      meta.value.billType = 'intra-state';
    } else {
      meta.value.billType = 'inter-state';
    }
  }
}

const computedTotals = computed(() => computeTotals(meta.value.billType, meta.value.reverseCharge));

const canSave = computed(() => selectedParty.value && cart.value.length > 0 && cart.value.some(item => (parseFloat(String(item.amount)) || 0) > 0));

const filteredParties = computed(() => {
  const q = partySearch.value.toLowerCase().trim();
  if (!q) return parties.value;
  return parties.value.filter(p => 
    p.name?.toLowerCase().includes(q) || 
    p.gstin?.toLowerCase().includes(q) || 
    p.phone?.includes(q) ||
    p.gstLocations?.some((loc: any) => loc.gstin?.toLowerCase().includes(q))
  );
});

// ─── Next Bill No Fetch ───
async function fetchNextBillNo() {
  try {
    const res = await api.get('/accounting/bills/get-next-number?type=ACCOUNTING_PURCHASE');
    if (res.success && res.data?.bno) {
      meta.value.billNo = res.data.bno;
    }
  } catch (err: any) {
    console.warn('Failed to preview next bill number:', err);
  }
}

async function fetchParties() {
  try {
    const res = await api.get('/accounting/parties');
    parties.value = res.data || [];
  } catch (err: any) { console.error('Failed to fetch parties:', err); }
}

async function fetchFirmData() {
  try {
    const res = await api.get('/firms/current');
    if (res.success && res.data) {
      const firm = res.data;
      currentFirmName.value = firm.name || firm.firm || 'Firm';
      firmLocations.value = firm.locations || [];
      activeFirmLocation.value = firmLocations.value.find((l: any) => l.is_default) || firmLocations.value[0] || null;
      gstEnabled.value = firm.gst_enabled !== false;
      determineGstBillType();
    }
  } catch (err: any) { console.error('Failed to fetch firm:', err); }
}

function onFirmGstinChange(e: Event) {
  const gstin = (e.target as HTMLSelectElement).value;
  activeFirmLocation.value = firmLocations.value.find((l: any) => l.gst_number === gstin) || firmLocations.value[0] || null;
  determineGstBillType();
}

// ─── Party Selection & Location Handling ───
function selectParty(party: any) {
  selectedParty.value = party;
  const primaryLoc = party?.gstLocations?.find((l: any) => l.isPrimary) || party?.gstLocations?.[0] || null;
  selectedPartyLocation.value = primaryLoc;
  selectedPartyGstin.value = primaryLoc?.gstin || party?.gstin || 'UNREGISTERED';
  showPartyDrawer.value = false;
  determineGstBillType();

  // Move focus immediately to Reference / PO input
  nextTick(() => {
    referenceInputRef.value?.focus();
    referenceInputRef.value?.select();
  });
}

function onPartyLocationChange(location: any) {
  selectedPartyLocation.value = location;
  selectedPartyGstin.value = location?.gstin || selectedParty.value?.gstin || 'UNREGISTERED';
  determineGstBillType();
}

function onPartySaved(party: any) {
  fetchParties();
  if (party) selectParty(party);
}

// ─── Account Head Selection & Instant SAC Focus Handover ───
function onLedgerSelect(account: COAAccount) {
  addItem(account);
  showLedgerModal.value = false;
  nextTick(() => {
    const newIdx = cart.value.length - 1;
    const sacInput = document.querySelector(`tr[data-row="${newIdx}"] input[data-field="sacCode"]`) as HTMLInputElement;
    if (sacInput) {
      sacInput.focus();
      sacInput.select?.();
    } else {
      cartManagerRef.value?.focusRowSac(newIdx);
    }
  });
}

function onAddCartItem(account?: COAAccount) {
  if (account) {
    addItem(account);
    nextTick(() => {
      const newIdx = cart.value.length - 1;
      const sacInput = document.querySelector(`tr[data-row="${newIdx}"] input[data-field="sacCode"]`) as HTMLInputElement;
      if (sacInput) {
        sacInput.focus();
        sacInput.select?.();
      } else {
        cartManagerRef.value?.focusRowSac(newIdx);
      }
    });
  } else {
    openLedgerModal();
  }
}

async function handleSave() {
  if (!canSave.value) return;
  try {
    const response = await saveInvoice({
      party: { 
        _id: selectedParty.value._id, 
        id: selectedParty.value._id,
        name: selectedParty.value.name,
        gstin: selectedPartyGstin.value,
        address: selectedPartyLocation.value?.address || selectedParty.value.address,
        state: selectedPartyLocation.value?.state || selectedParty.value.state,
        stateCode: selectedPartyLocation.value?.stateCode || selectedParty.value.stateCode,
        pin: selectedPartyLocation.value?.pincode || selectedParty.value.pin,
      },
      meta: {
        billDate: meta.value.billDate,
        billType: meta.value.billType,
        reverseCharge: meta.value.reverseCharge,
        supplierBillNo: meta.value.supplierBillNo,
        referenceNo: meta.value.referenceNo,
        narration: meta.value.narration,
        partyGstin: selectedPartyGstin.value,
        firmGstin: activeFirmLocation.value?.gst_number,
      },
      otherCharges: otherCharges.value,
    });
    createdBill.value = response.data;
    showSuccessModal.value = true;
  } catch (err: any) {
    alert(saveError.value || 'Failed to save bill');
  }
}

function resetForm() {
  clearCart();
  selectedParty.value = null;
  selectedPartyLocation.value = null;
  selectedPartyGstin.value = null;
  otherCharges.value = [];
  meta.value = { 
    billNo: '',
    billDate: new Date().toISOString().split('T')[0], 
    billType: 'intra-state', 
    reverseCharge: false, 
    supplierBillNo: '', 
    referenceNo: '', 
    narration: '' 
  };
  createdBill.value = null;
  fetchNextBillNo();
  nextTick(() => {
    firstInputRef.value?.focus();
  });
}

function closeSuccess() { showSuccessModal.value = false; resetForm(); }

async function downloadCreatedPDF() {
  if (!createdBill.value?._id) return;
  try {
    await api.download(`/accounting/bills/${createdBill.value._id}/pdf`, `Bill_${createdBill.value.bno || 'API'}.pdf`);
  } catch (err) {
    alert('Failed to download PDF');
  }
}

async function downloadCreatedExcel() {
  if (!createdBill.value?._id) return;
  try {
    await api.download(`/accounting/bills/${createdBill.value._id}/excel`, `Bill_${createdBill.value.bno || 'API'}.xlsx`);
  } catch (err) {
    alert('Failed to export Excel');
  }
}

function handleSuccessModalKeydown(e: KeyboardEvent) {
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    downloadCreatedPDF();
  } else if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    downloadCreatedExcel();
  } else if (e.key === 'Enter' || e.key === 'Escape') {
    e.preventDefault();
    closeSuccess();
  }
}

function onPartySearchKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredParties.value.length > 0) {
      partyActiveIdx.value = (partyActiveIdx.value + 1) % filteredParties.value.length;
      scrollActiveParty();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredParties.value.length > 0) {
      partyActiveIdx.value = (partyActiveIdx.value - 1 + filteredParties.value.length) % filteredParties.value.length;
      scrollActiveParty();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    e.stopPropagation();
    if (filteredParties.value.length > 0) {
      selectParty(filteredParties.value[partyActiveIdx.value]);
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    closePartyDrawer();
  } else if (e.key === 'Insert' || (e.ctrlKey && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    openCreatePartyFromDrawer();
  }
}

function scrollActiveParty() {
  nextTick(() => {
    const el = partyListRef.value?.querySelector('.party-option.active');
    if (el) (el as HTMLElement).scrollIntoView({ block: 'nearest' });
  });
}

watch(partySearch, () => { partyActiveIdx.value = 0; });

// ─── Global Window Keyboard Handler ───
function handleGlobalKeydown(e: KeyboardEvent) {
  if (
    showLedgerModal.value ||
    showPartyDrawer.value ||
    showCreatePartyModal.value ||
    showOtherChargesModal.value ||
    showSuccessModal.value ||
    showHelpModal.value
  ) {
    return;
  }

  if (e.key === 'F1' || (e.shiftKey && e.key === '?')) {
    e.preventDefault();
    showHelpModal.value = true;
  } else if (e.key === 'F2') {
    e.preventDefault();
    openLedgerModal();
  } else if (e.key === 'F3') {
    e.preventDefault();
    openPartyDrawer();
  } else if (e.key === 'F4') {
    e.preventDefault();
    openOtherChargesModal();
  } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
    e.preventDefault();
    if (canSave.value) handleSave();
  } else if (e.key === 'F9') {
    e.preventDefault();
    resetForm();
  } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    openCreatePartyModal();
  }
}

onMounted(() => { 
  window.addEventListener('keydown', handleGlobalKeydown);
  fetchFirmData();
  fetchParties();
  fetchNextBillNo();
  nextTick(() => {
    firstInputRef.value?.focus();
  });
});

onUnmounted(() => { 
  window.removeEventListener('keydown', handleGlobalKeydown); 
});
</script>

<style scoped>
.invoice-page { 
  height: calc(100vh - 84px);
  min-height: calc(100vh - 84px);
  display: flex; 
  flex-direction: column; 
  overflow: hidden;
  margin: 0;
  font-size: 12px; 
  color: var(--text, #1e293b); 
  background: linear-gradient(160deg, #fff5f5 0%, #fef5f5 40%, #fdf2f2 100%); 
}
:root.dark .invoice-page { color: #e4e4e7; background: linear-gradient(160deg, #09090b 0%, #141416 40%, #09090b 100%); }

.page-header { 
  display: flex; 
  flex-wrap: wrap; 
  align-items: center; 
  gap: 12px; 
  padding: 10px 16px; 
  background: rgba(255, 255, 255, 0.95); 
  border-bottom: 1px solid #e2e8f0; 
  backdrop-filter: blur(8px); 
  flex-shrink: 0;
}
:root.dark .page-header { background: rgba(24, 24, 27, 0.95); border-bottom-color: #27272a; }

.title-block p { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #ef4444; }
.title-block h1 { font-size: 18px; font-weight: 900; letter-spacing: -0.02em; margin-top: 2px; }

.header-fields { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; flex: 1; }
.header-fields label { display: flex; flex-direction: column; gap: 2px; }
.header-fields span { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; color: #64748b; }
:root.dark .header-fields span { color: #a1a1aa; }
.header-fields input, .header-fields select { padding: 5px 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; font-weight: 700; background: white; outline: none; transition: border-color .15s; }
:root.dark .header-fields input, :root.dark .header-fields select { background: #18181b; border-color: #3f3f46; color: #e4e4e7; }
.header-fields input:focus, .header-fields select:focus { border-color: #3b82f6; }
.readonly-input { background: #f1f5f9 !important; cursor: default; }
:root.dark .readonly-input { background: #27272a !important; }
.inline-toggle { flex-direction: row !important; align-items: center !important; gap: 6px !important; cursor: pointer; }
.inline-toggle input { width: 14px; height: 14px; }

.header-actions { display: flex; gap: 8px; margin-left: auto; }
.ghost-btn { padding: 6px 14px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; background: transparent; cursor: pointer; }
:root.dark .ghost-btn { border-color: #3f3f46; color: #a1a1aa; }
.ghost-btn:hover { background: #f1f5f9; }
:root.dark .ghost-btn:hover { background: #27272a; }
.primary-btn.purchase { padding: 6px 16px; border-radius: 10px; border: none; font-size: 11px; font-weight: 800; background: #ef4444; color: white; cursor: pointer; display: flex; align-items: center; gap: 8px; }
.primary-btn.purchase:hover { background: #dc2626; }
.primary-btn.purchase:disabled { opacity: 0.5; cursor: not-allowed; }
.primary-btn.purchase span { font-size: 9px; opacity: 0.7; font-family: monospace; }

.workspace { 
  flex: 1; 
  min-height: 0; 
  display: flex; 
  gap: 0; 
  overflow: hidden; 
}
.side-panel { 
  width: 340px; 
  min-width: 300px; 
  flex: 0 0 340px; 
  border-right: 1px solid #e2e8f0; 
  overflow-y: auto; 
  background: rgba(255, 255, 255, 0.6); 
  display: flex; 
  flex-direction: column; 
}
:root.dark .side-panel { border-right-color: #27272a; background: rgba(24, 24, 27, 0.6); }
.main-panel { 
  flex: 1; 
  min-width: 0; 
  display: flex; 
  flex-direction: column; 
  overflow-y: auto; 
  padding: 16px; 
}

.detail-panel { padding: 16px; border-top: 1px solid #f1f5f9; }
:root.dark .detail-panel { border-top-color: #27272a; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.panel-head .eyebrow { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #94a3b8; }
.panel-head h2 { font-size: 13px; font-weight: 900; margin-top: 1px; }
.panel-head button { font-size: 10px; font-weight: 700; color: #6366f1; background: #eef2ff; padding: 4px 10px; border-radius: 8px; border: none; cursor: pointer; }
.field-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
.field-grid label { display: flex; flex-direction: column; gap: 2px; }
.field-grid span { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; }
.field-grid input, .field-grid textarea { padding: 6px 8px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 11px; font-weight: 600; background: white; outline: none; resize: vertical; }
:root.dark .field-grid input, :root.dark .field-grid textarea { background: #18181b; border-color: #3f3f46; color: #e4e4e7; }
.field-grid input:focus, .field-grid textarea:focus { border-color: #3b82f6; }
.field-grid .wide { grid-column: 1 / -1; }

.totals-panel { padding: 16px; border-top: 1px solid #f1f5f9; margin-top: auto; }
:root.dark .totals-panel { border-top-color: #27272a; }
.totals-head { margin-bottom: 10px; }
.totals-head .eyebrow { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #94a3b8; }
.totals-head h2 { font-size: 13px; font-weight: 900; margin-top: 1px; }
.totals-grid { display: flex; flex-direction: column; gap: 6px; }
.totals-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; font-weight: 600; color: var(--text-muted,#475569); }
:root.dark .totals-row { color:#a1a1aa; }
.totals-row .amount { font-family: monospace; font-weight: 800; color: #1e293b; }
:root.dark .totals-row .amount { color: #e4e4e7; }
.totals-row.dim { opacity: 0.6; }
.totals-row.grand { padding-top: 8px; border-top: 2px solid #e2e8f0; font-size: 14px; font-weight: 900; color: #dc2626; }
:root.dark .totals-row.grand { border-top-color: #3f3f46; color: #f87171; }
.totals-row.grand .amount { font-size: 16px; color: #dc2626; }
:root.dark .totals-row.grand .amount { color: #f87171; }

.drawer-backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.4); display: flex; justify-content: flex-end; }
.party-drawer { width: 420px; max-width: 90vw; background: white; display: flex; flex-direction: column; box-shadow: -8px 0 30px rgba(0, 0, 0, 0.15); }
:root.dark .party-drawer { background: #18181b; }
.drawer-head { display: flex; justify-content: space-between; align-items: center; padding: 16px; border-bottom: 1px solid #f1f5f9; }
:root.dark .drawer-head { border-bottom-color: #27272a; }
.drawer-head .eyebrow { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.2em; color: #94a3b8; }
.drawer-head h2 { font-size: 14px; font-weight: 900; margin-top: 1px; }
.drawer-close { font-size: 11px; font-weight: 700; color: #94a3b8; background: none; border: none; cursor: pointer; }
.search-box { padding: 12px 16px; }
.search-input { width: 100%; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 11px; font-weight: 600; background: #f8fafc; outline: none; }
:root.dark .search-input { background: #09090b; border-color: #3f3f46; color: #e4e4e7; }
.search-input:focus { border-color: #3b82f6; background: white; }
:root.dark .search-input:focus { background: #18181b; }
.party-list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.party-option { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 10px 12px; border: none; background: none; border-radius: 10px; cursor: pointer; text-align: left; transition: all .12s; margin-bottom: 2px; }
.party-option:hover { background: #f1f5f9; }
:root.dark .party-option:hover { background: #27272a; }
.party-option.active { background: #3b82f6; color: white; }
.party-info { display: flex; flex-direction: column; gap: 2px; }
.party-info .name { font-size: 12px; font-weight: 700; }
.party-info .gstin { font-size: 10px; font-family: monospace; opacity: 0.7; }
.party-bal-badge { font-size: 10px; font-weight: 800; font-family: monospace; padding: 2px 8px; border-radius: 8px; }
.bal-dr { background: #eff6ff; color: #2563eb; }
.bal-cr { background: #fef2f2; color: #dc2626; }
.bal-nil { background: #f1f5f9; color: #94a3b8; }
.active-badge { background: rgba(255, 255, 255, 0.22); color: white; }
:root.dark .bal-dr { background: #1e3a5f; color: #60a5fa; }
:root.dark .bal-cr { background: #3f1111; color: #f87171; }
:root.dark .bal-nil { background: #27272a; color: #71717a; }
.empty-list { padding: 20px; text-align: center; color: #94a3b8; font-size: 11px; font-weight: 600; }
</style>
