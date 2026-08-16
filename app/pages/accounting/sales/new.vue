<template>
  <div class="invoice-page">
    <div v-if="state.isReturnMode && state.currentBill" class="return-banner">
      <span>Sales return for bill #{{ state.currentBill.bno }}</span>
      <button type="button" @click="router.push('/accounting/sales/new')">Cancel return</button>
    </div>

    <header class="page-header">
      <div class="title-block">
        <p>{{ state.currentFirmName }}</p>
        <h1>{{ state.isReturnMode ? 'Sales Return' : (isEditMode ? (state.meta.btype === 'PROFORMA' ? 'Edit Proforma Invoice' : (state.meta.btype === 'DELIVERY_NOTE' ? 'Edit Delivery Note' : 'Edit Sales Invoice')) : (state.meta.btype === 'PROFORMA' ? 'Proforma Invoice' : (state.meta.btype === 'DELIVERY_NOTE' ? 'Delivery Note' : 'Sales Invoice'))) }}</h1>
      </div>

      <div class="header-fields">
        <label v-if="!state.isReturnMode && !isEditMode">
          <span>Document Type</span>
          <select ref="firstInputRef" v-model="state.meta.btype" @change="onDocTypeChange">
            <option value="SALES">Sales Invoice</option>
            <option value="PROFORMA">Proforma Invoice</option>
            <option value="DELIVERY_NOTE">Delivery Note</option>
          </select>
        </label>
        <label v-else-if="isEditMode">
          <span>Document Type</span>
          <input :value="state.meta.btype === 'PROFORMA' ? 'Proforma Invoice' : (state.meta.btype === 'DELIVERY_NOTE' ? 'Delivery Note' : 'Sales Invoice')" type="text" readonly class="readonly-input" style="width: 140px" />
        </label>
        <label>
          <span>Bill No</span>
          <input :value="state.isReturnMode ? 'CN-AUTO' : (state.meta.billNo || 'AUTO')" type="text" readonly class="readonly-input" />
        </label>
        <label>
          <span>Invoice date</span>
          <input v-model="state.meta.billDate" type="date" />
        </label>
        <label v-if="state.firmLocations.length >= 1">
          <span>Billing from GSTIN</span>
          <select :value="state.activeFirmLocation?.gst_number || ''" @change="onFirmGstinChange">
            <option v-for="location in state.firmLocations" :key="location.gst_number || location.state_code" :value="location.gst_number || ''">
              {{ location.gst_number || 'No GSTIN' }} - {{ location.state || location.state_code || '' }}{{ location.is_default ? ' (Default)' : '' }}
            </option>
          </select>
        </label>
        <label v-if="state.gstEnabled">
          <span>Transaction type</span>
          <select v-model="state.meta.billType">
            <option value="intra-state">Intra-State (CGST + SGST)</option>
            <option value="inter-state">Inter-State (IGST)</option>
          </select>
        </label>
        <label v-if="state.gstEnabled" class="inline-toggle">
          <input v-model="state.meta.reverseCharge" type="checkbox" @keydown.enter.prevent="onReverseChargeEnter" />
          <span>Reverse Charge</span>
        </label>
        <div class="gst-status" :class="{ off: !state.gstEnabled }">
          GST: {{ state.gstEnabled ? 'ON' : 'OFF' }}
        </div>
      </div>

      <div class="header-actions">
        <button class="ghost-btn" type="button" @click="resetForm" title="Clear Bill (F9)">Discard (F9)</button>
        <button class="primary-btn" type="button" :disabled="loading || !canSave" @click="saveInvoice" title="Save Invoice (F8)">
          {{ state.currentBill?.status === 'CONVERTED' ? 'Converted (Read-Only)' : (loading ? 'Saving...' : state.isReturnMode ? 'Create Credit Note' : (isEditMode ? (state.meta.btype === 'PROFORMA' ? 'Update Proforma' : (state.meta.btype === 'DELIVERY_NOTE' ? 'Update Delivery Note' : 'Update Invoice')) : (state.meta.btype === 'PROFORMA' ? 'Save Proforma' : (state.meta.btype === 'DELIVERY_NOTE' ? 'Save Delivery Note' : 'Save Invoice')))) }}
          <span>F8</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="side-panel">
        <PartyManager
          :state="state"
          title="Bill To"
          empty-subtitle="Customer record (Press F3 to Select)"
          @open-modal="showPartyModal = true"
          @create-party="showCreatePartyModal = true"
          @location-change="onPartyLocationChange"
        />

        <section class="detail-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Details</p>
              <h2>Dispatch and reference</h2>
            </div>
            <button type="button" @click="showOtherChargesModal = true">Charges F4</button>
          </div>

          <div class="field-grid">
            <label>
              <span>Reference / PO</span>
              <input ref="referenceInputRef" v-model="state.meta.referenceNo" type="text" placeholder="Optional" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
            </label>
            <label>
              <span>Vehicle no</span>
              <input v-model="state.meta.vehicleNo" type="text" placeholder="KA-01-XX-1234" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
            </label>
            <label class="wide">
              <span>Dispatch through</span>
              <input v-model="state.meta.dispatchThrough" type="text" placeholder="Transport, courier, self" @keydown.enter.prevent="onDetailEnter($event)" @keydown.backspace="onDetailBackspace($event)" />
            </label>
            <label class="wide">
              <span>Narration (Shift+Enter for new line)</span>
              <textarea v-model="state.meta.narration" rows="4" placeholder="Additional notes... (Enter jumps to Cart / Stock F2)" @keydown.enter="onNarrationEnter" @keydown.backspace="onDetailBackspace($event)"></textarea>
            </label>
          </div>
        </section>
      </aside>

      <section class="main-panel">
        <CartManager
          :state="state"
          mode="sales"
          @add-item="showStockModal = true"
          @add-service="addServiceLine"
          @remove-item="removeCartItem"
          @service-input="handleServiceInput"
        />
        <InvoiceSummary :state="state" :totals="totals" />
      </section>
    </main>

    <!-- Modals -->
    <StockModal v-model="showStockModal" :stocks="state.stocks" @select="onStockSelect" @create-stock="showCreateStockModal = true" @edit-stock="onEditStock" />
    <CreateStockModal v-model="showCreateStockModal" @saved="fetchData" />
    <EditStockModal v-model="showEditStockModal" :stock="selectedStockToEdit" @saved="fetchData" />
    <PartyModal v-model="showCreatePartyModal" @saved="(p: any) => { fetchData(); onPartySelect(p); }" />
    <OtherChargesModal v-model="showOtherChargesModal" :other-charges="state.otherCharges" />

    <!-- Print & Success Modal with Complete Zero-Mouse Keyboard Support -->
    <UModal v-model:open="showPrintModal" :title="createdBill?.btype === 'PROFORMA' ? 'Proforma Invoice Saved Successfully' : (createdBill?.btype === 'DELIVERY_NOTE' ? 'Delivery Challan Saved Successfully' : 'Invoice Created Successfully')">
      <template #body>
        <div 
          class="p-6 flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl outline-none" 
          tabindex="0" 
          ref="printModalContainerRef"
          @keydown="handlePrintModalKeydown"
        >
          <div class="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400">
            <UIcon name="i-heroicons-check-circle" class="w-12 h-12" />
          </div>
          <div>
            <h3 class="text-lg font-black text-gray-900 dark:text-white">{{ createdBill?.btype === 'PROFORMA' ? 'Proforma' : (createdBill?.btype === 'DELIVERY_NOTE' ? 'Delivery Challan' : 'Invoice') }} #{{ createdBill?.bno }} Saved</h3>
            <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1 font-medium">
              Press <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">P</kbd> for PDF, <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">E</kbd> for Excel, or <kbd class="px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded font-bold font-mono">Enter / ESC</kbd> for Next Bill
            </p>
          </div>
          <div class="flex flex-wrap gap-2.5 mt-2 w-full justify-center">
            <UButton 
              color="primary" 
              icon="i-heroicons-arrow-down-tray" 
              label="Download PDF (P)" 
              class="font-bold print-btn"
              @click="downloadCreatedPDF" 
            />
            <UButton 
              color="success" 
              icon="i-heroicons-table-cells" 
              label="Export Excel (E)" 
              class="font-bold print-btn"
              @click="downloadCreatedExcel" 
            />
            <UButton 
              color="neutral" 
              variant="outline" 
              label="Next Bill (ESC)" 
              class="font-bold print-btn"
              @click="closePrintModal" 
            />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Keyboard Shortcuts Cheatsheet Modal (F1 / ?) -->
    <UModal v-model:open="showHelpModal" title="Sales Invoice Keyboard Cheatsheet">
      <template #body>
        <div class="p-4 space-y-4 text-xs">
          <div class="grid grid-cols-2 gap-3">
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-primary text-sm">F2</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Stock Browser</p>
              <p class="text-[10px] text-slate-400">Search & add products/batches</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-emerald-600 text-sm">F3</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Party Selector</p>
              <p class="text-[10px] text-slate-400">Search & select customer record</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-indigo-600 text-sm">F4</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Other Charges</p>
              <p class="text-[10px] text-slate-400">Add freight, packing, delivery</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-amber-600 text-sm">F5</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Add Service</p>
              <p class="text-[10px] text-slate-400">Add custom non-inventory line</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-rose-600 text-sm">F8 / Ctrl+S</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Save Invoice</p>
              <p class="text-[10px] text-slate-400">Finalize & create document</p>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-zinc-800/60 rounded-xl border border-slate-200 dark:border-zinc-700">
              <span class="font-mono font-black text-purple-600 text-sm">Insert / Ctrl+N</span>
              <p class="font-bold text-slate-800 dark:text-white mt-1">Register New</p>
              <p class="text-[10px] text-slate-400">Quick create Party or Stock</p>
            </div>
          </div>
          <div class="pt-2 border-t border-slate-200 text-slate-500 text-[11px] flex justify-between items-center">
            <span><kbd>Enter</kbd> Next Field • <kbd>Backspace</kbd> Prev Field • <kbd>Del</kbd> Remove Line</span>
            <UButton size="xs" color="neutral" variant="outline" label="Got it (ESC)" @click="showHelpModal = false" />
          </div>
        </div>
      </template>
    </UModal>

    <!-- Party Selection Drawer -->
    <div v-if="showPartyModal" class="drawer-backdrop" @click.self="showPartyModal = false">
      <div class="party-drawer" role="dialog" aria-modal="true" aria-label="Choose party">
        <header class="drawer-head">
          <div>
            <p class="eyebrow">Records</p>
            <h2>Choose party</h2>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" class="create-party-btn text-xs font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded" @click="openCreatePartyFromDrawer">
              + New Party (Insert)
            </button>
            <button type="button" class="drawer-close" @click="showPartyModal = false">Close</button>
          </div>
        </header>
        <div class="search-box">
          <input 
            ref="partySearchInputRef"
            v-model="partySearchQuery" 
            type="text" 
            placeholder="Search party... (↑↓ Navigate • Enter Select • Insert New • ESC Close)" 
            class="search-input" 
            @keydown="handlePartyDrawerKeydown"
          />
        </div>
        <div class="party-list">
          <button 
            v-for="(party, idx) in filteredParties" 
            :key="party._id" 
            class="party-option" 
            :class="{ active: partySelectedIndex === idx }" 
            type="button" 
            @click="onPartySelect(party)"
          >
            <div class="flex items-center justify-between w-full gap-2">
              <strong class="truncate">{{ party.name || party.firm }}</strong>
              <span 
                v-if="party.formattedBalance || party.openingBalance !== undefined" 
                class="party-bal-badge"
                :class="party.closingBalanceType === 'DR' ? 'bal-dr' : (party.closingBalanceType === 'CR' ? 'bal-cr' : 'bal-nil')"
              >
                {{ party.formattedBalance || ('₹' + (Number(party.openingBalance) || 0).toFixed(2) + ' ' + (party.balanceType || 'DR')) }}
              </span>
            </div>
            <span>{{ party.gstin || 'UNREGISTERED' }} | {{ party.state || '-' }}</span>
          </button>
          <div v-if="filteredParties.length === 0" class="p-8 text-center text-slate-400 text-xs">
            <p>No matching party found.</p>
            <button type="button" class="mt-2 text-emerald-600 font-bold underline" @click="openCreatePartyFromDrawer">
              Press Insert to Register New Party
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Custom Print Configuration Modal (Alt+P) -->
    <PrintConfigModal 
      v-model="showPrintConfigModal" 
      :bill="createdBill || (isEditMode ? { _id: route.params.id, bno: state.meta.billNo } : null)" 
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useBillingState } from '@/composables/useBillingState';
import PartyManager from '@/components/accounting/PartyManager.vue';
import CartManager from '@/components/inventory/CartManager.vue';
import InvoiceSummary from '@/components/accounting/InvoiceSummary.vue';
import StockModal from '@/components/inventory/StockModal.vue';
import CreateStockModal from '@/components/inventory/CreateStockModal.vue';
import EditStockModal from '@/components/inventory/EditStockModal.vue';
import PartyModal from '@/components/accounting/PartyModal.vue';
import OtherChargesModal from '@/components/accounting/OtherChargesModal.vue';
import PrintConfigModal from '@/components/accounting/PrintConfigModal.vue';
import { api } from '@/utils/api';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const router = useRouter();
const route = useRoute();
const { state, totals, fetchData, fetchNextBillNo, determineGstBillType, populateConsigneeFromBillTo } = useBillingState();
const { saveFocus, restoreFocus, trackPageFocus, handleEnterKey, handleBackspaceKey } = useKeyboardNavigation();

const firstInputRef = ref<HTMLElement | null>(null);
const referenceInputRef = ref<HTMLElement | null>(null);
const partySearchInputRef = ref<HTMLInputElement | null>(null);
const printModalContainerRef = ref<HTMLElement | null>(null);
const partySelectedIndex = ref(0);

const showStockModal = ref(false);
const showPartyModal = ref(false);
const partySearchQuery = ref('');
const showPrintModal = ref(false);
const showPrintConfigModal = ref(false);
const showHelpModal = ref(false);
const createdBill = ref<any>(null);
const isEditMode = ref(false);

watch(showPartyModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
    partySelectedIndex.value = 0;
    nextTick(() => partySearchInputRef.value?.focus());
  } else {
    partySearchQuery.value = '';
  }
});

watch(showPrintModal, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      printModalContainerRef.value?.focus();
    });
  }
});

watch(partySearchQuery, () => {
  partySelectedIndex.value = 0;
});

watch(partySelectedIndex, () => {
  nextTick(() => {
    const activeEl = document.querySelector('.party-option.active');
    activeEl?.scrollIntoView({ block: 'nearest' });
  });
});

function onReverseChargeEnter(e: KeyboardEvent) {
  if (!state.selectedParty) {
    saveFocus();
    showPartyModal.value = true;
  } else {
    const container = document.querySelector('.invoice-page') as HTMLElement;
    if (container) handleEnterKey(e, container);
  }
}

function onDetailEnter(e: KeyboardEvent) {
  const container = ((e.target as HTMLElement)?.closest('.side-panel') || (e.target as HTMLElement)?.closest('.detail-panel')) as HTMLElement;
  if (container) {
    handleEnterKey(e, container);
  }
}

function onDetailBackspace(e: KeyboardEvent) {
  const container = ((e.target as HTMLElement)?.closest('.side-panel') || (e.target as HTMLElement)?.closest('.detail-panel')) as HTMLElement;
  if (container) {
    handleBackspaceKey(e, container);
  }
}

function onNarrationEnter(e: KeyboardEvent) {
  if (e.shiftKey) return;
  e.preventDefault();
  if (state.cart.length > 0) {
    const firstQtyInput = document.querySelector('tr[data-row="0"] input.qty-input, tr[data-row="0"] input.item-name-input') as HTMLElement;
    if (firstQtyInput) {
      firstQtyInput.focus();
      if (firstQtyInput instanceof HTMLInputElement) firstQtyInput.select();
      return;
    }
  }
  saveFocus();
  showStockModal.value = true;
}

function openCreatePartyFromDrawer() {
  showPartyModal.value = false;
  showCreatePartyModal.value = true;
}

function handlePartyDrawerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (filteredParties.value.length > 0) {
      partySelectedIndex.value = (partySelectedIndex.value + 1) % filteredParties.value.length;
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (filteredParties.value.length > 0) {
      partySelectedIndex.value = (partySelectedIndex.value - 1 + filteredParties.value.length) % filteredParties.value.length;
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (filteredParties.value.length > 0 && partySelectedIndex.value < filteredParties.value.length) {
      const selected = filteredParties.value[partySelectedIndex.value];
      onPartySelect(selected);
    } else if (filteredParties.value.length === 0) {
      openCreatePartyFromDrawer();
    }
  } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') || (e.altKey && e.key.toLowerCase() === 'c')) {
    e.preventDefault();
    openCreatePartyFromDrawer();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    showPartyModal.value = false;
    restoreFocus();
  }
}

function handlePrintModalKeydown(e: KeyboardEvent) {
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    downloadCreatedPDF();
  } else if (e.key === 'e' || e.key === 'E') {
    e.preventDefault();
    downloadCreatedExcel();
  } else if (e.key === 'Escape' || e.key === 'Enter' || e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    closePrintModal();
  }
}

function closePrintModal() {
  showPrintModal.value = false;
  if (isEditMode.value) {
    router.push('/accounting/bills');
  } else {
    resetFormState();
    nextTick(() => firstInputRef.value?.focus());
  }
}

function resetFormState() {
  state.cart = [];
  state.selectedParty = null;
  state.selectedPartyGstin = null;
  state.selectedPartyLocation = null;
  state.selectedConsignee = null;
  state.consigneeSameAsBillTo = true;
  state.meta.referenceNo = '';
  state.meta.vehicleNo = '';
  state.meta.dispatchThrough = '';
  state.meta.narration = '';
  state.meta.reverseCharge = false;
  state.otherCharges = [];
  fetchNextBillNo(state.meta.btype);
}

async function downloadCreatedPDF() {
  if (!createdBill.value) return;
  try {
    const blob = await api.get(`/accounting/bills/${createdBill.value._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${createdBill.value.bno}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download failed:', err);
  }
}

async function downloadCreatedExcel() {
  if (!createdBill.value) return;
  try {
    const blob = await api.get(`/accounting/bills/export`, { params: { id: createdBill.value._id }, responseType: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${createdBill.value.bno}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Excel export failed:', err);
  }
}

const filteredParties = computed(() => {
  const query = partySearchQuery.value.trim().toLowerCase();
  if (!query) return state.parties;
  return state.parties.filter(party => {
    const name = (party.name || party.firm || '').toLowerCase();
    const gstin = (party.gstin || '').toLowerCase();
    const stateName = (party.state || '').toLowerCase();
    return name.includes(query) || gstin.includes(query) || stateName.includes(query);
  });
});

const showCreatePartyModal = ref(false);
const showCreateStockModal = ref(false);
const showEditStockModal = ref(false);
const showOtherChargesModal = ref(false);
const selectedStockToEdit = ref<any>(null);
const loading = ref(false);

watch(showOtherChargesModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

watch(showStockModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

watch(showCreatePartyModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

watch(showCreateStockModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

watch(showEditStockModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

watch(showHelpModal, (isOpen) => {
  if (isOpen) {
    saveFocus();
  } else {
    restoreFocus();
  }
});

function onEditStock(stock: any) {
  selectedStockToEdit.value = stock;
  showEditStockModal.value = true;
}

const handleKeydown = (e: KeyboardEvent) => {
  // If ANY modal, drawer or dialog is open, do not intercept modal keys
  if (
    showStockModal.value ||
    showPartyModal.value ||
    showCreatePartyModal.value ||
    showCreateStockModal.value ||
    showEditStockModal.value ||
    showOtherChargesModal.value ||
    showPrintModal.value ||
    showPrintConfigModal.value ||
    showHelpModal.value
  ) {
    return;
  }

  if (e.key === 'F1' || (e.shiftKey && e.key === '?')) {
    e.preventDefault();
    showHelpModal.value = !showHelpModal.value;
  } else if ((e.altKey || (e.ctrlKey && e.shiftKey)) && (e.key === 'p' || e.key === 'P')) {
    e.preventDefault();
    if (isEditMode.value && route.params.id) {
      showPrintConfigModal.value = true;
    } else if (createdBill.value) {
      showPrintConfigModal.value = true;
    }
  } else if (e.key === 'F2') {
    e.preventDefault();
    saveFocus();
    showStockModal.value = true;
  } else if (e.key === 'F3') {
    e.preventDefault();
    saveFocus();
    showPartyModal.value = true;
  } else if (e.key === 'F4') {
    e.preventDefault();
    saveFocus();
    showOtherChargesModal.value = true;
  } else if (e.key === 'F5') {
    e.preventDefault();
    addServiceLine();
  } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
    e.preventDefault();
    if (canSave.value) saveInvoice();
  } else if (e.key === 'F9') {
    e.preventDefault();
    resetForm();
  } else if (e.key === 'Enter') {
    if (e.defaultPrevented) return;
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && !activeEl.closest('.table-wrap') && !activeEl.closest('.drawer-backdrop') && !activeEl.closest('.fixed') && !activeEl.closest('[role="dialog"]')) {
      const container = document.querySelector('.invoice-page') as HTMLElement;
      handleEnterKey(e, container);
    }
  } else if (e.key === 'Backspace') {
    if (e.defaultPrevented) return;
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && !activeEl.closest('.table-wrap') && !activeEl.closest('.drawer-backdrop') && !activeEl.closest('.fixed') && !activeEl.closest('[role="dialog"]')) {
      const container = document.querySelector('.invoice-page') as HTMLElement;
      handleBackspaceKey(e, container);
    }
  }
};

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  state.meta.btype = 'SALES';
  await fetchData();

  if (route.params.id) {
    isEditMode.value = true;
    await loadBillForEditing(route.params.id as string);
  } else if (route.query.returnFrom) {
    state.isReturnMode = true;
    state.returnFromBillId = route.query.returnFrom as string;
    await loadExistingBill(state.returnFromBillId);
  } else {
    await fetchNextBillNo('SALES');
  }

  trackPageFocus();

  nextTick(() => {
    firstInputRef.value?.focus();
  });
});

async function onDocTypeChange() {
  await fetchNextBillNo(state.meta.btype);
}

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});

const canSave = computed(() => {
  if (state.currentBill?.status === 'CONVERTED') return false;
  return state.selectedParty && state.cart.length > 0 && state.cart.every(item => {
    const qty = state.isReturnMode ? item.returnQty : item.qty;
    return item.item && (parseFloat(qty) || 0) > 0 && (parseFloat(item.rate) || 0) >= 0;
  });
});

async function loadExistingBill(id: string) {
  try {
    const res = await api.get(`/accounting/bills/${id}`);
    if (res.success) {
      const bill = res.data;
      state.currentBill = bill;
      const party = state.parties.find(p => p._id === bill.partyId);
      if (party) {
        state.selectedParty = party;
        const loc = party.gstLocations?.find((l: any) => l.gstin === bill.partyGstin);
        state.selectedPartyLocation = loc || null;
      } else {
        state.selectedParty = { _id: bill.partyId, name: bill.partyName, address: bill.partyAddress, gstin: bill.partyGstin };
        state.selectedPartyLocation = null;
      }
      state.selectedPartyGstin = bill.partyGstin;
      state.meta.billType = bill.billSubtype?.toLowerCase() === 'inter-state' ? 'inter-state' : 'intra-state';
      state.meta.reverseCharge = bill.reverseCharge;
      state.cart = bill.items.map((item: any) => ({ ...item, returnQty: 0, originalItem: true }));
    }
  } catch (err) {
    console.error('Failed to load original bill', err);
  }
}

async function loadBillForEditing(id: string) {
  try {
    const res = await api.get(`/accounting/bills/${id}`);
    if (res.success) {
      const bill = res.data;
      state.currentBill = bill;
      
      const party = state.parties.find(p => p._id === bill.partyId);
      if (party) {
        state.selectedParty = party;
        const loc = party.gstLocations?.find((l: any) => l.gstin === bill.partyGstin);
        state.selectedPartyLocation = loc || null;
      } else {
        state.selectedParty = { _id: bill.partyId, name: bill.partyName, address: bill.partyAddress, gstin: bill.partyGstin };
        state.selectedPartyLocation = null;
      }
      state.selectedPartyGstin = bill.partyGstin;
      
      if (bill.firmGstin) {
        const firmLoc = state.firmLocations.find(l => l.gst_number === bill.firmGstin);
        if (firmLoc) state.activeFirmLocation = firmLoc;
      }
      
      state.meta.btype = bill.btype || 'SALES';
      state.meta.billNo = bill.bno;
      state.meta.billDate = bill.bdate;
      state.meta.billType = bill.billSubtype?.toLowerCase() === 'inter-state' ? 'inter-state' : 'intra-state';
      state.meta.reverseCharge = bill.reverseCharge;
      state.meta.referenceNo = bill.orderNo || '';
      state.meta.vehicleNo = bill.vehicleNo || '';
      state.meta.dispatchThrough = bill.dispatchThrough || '';
      state.meta.narration = bill.narration || '';
      
      state.cart = bill.items.map((item: any) => ({
        stockId: item.stockId,
        item: item.item,
        hsn: item.hsn,
        qty: item.qty,
        uom: item.uom,
        rate: item.rate,
        grate: item.grate,
        disc: item.disc || 0,
        itemType: item.itemType || 'GOODS',
        batch: item.batch || '',
        mrp: item.mrp || 0,
        narration: item.narration || '',
        pno: item.pno,
        oem: item.oem
      }));
      
      state.otherCharges = bill.otherCharges || [];
      
      state.selectedConsignee = {
        name: bill.consigneeName,
        address: bill.consigneeAddress,
        gstin: bill.consigneeGstin,
        state: bill.consigneeState,
        pin: bill.consigneePin
      };
      state.consigneeSameAsBillTo = false;
    }
  } catch (err) {
    console.error('Failed to load bill for editing', err);
  }
}

function onPartySelect(party: any) {
  state.selectedParty = party;
  const primaryLoc = party.gstLocations?.find((l: any) => l.isPrimary) || party.gstLocations?.[0] || null;
  state.selectedPartyLocation = primaryLoc;
  state.selectedPartyGstin = primaryLoc?.gstin || party.gstin || 'UNREGISTERED';
  determineGstBillType();
  populateConsigneeFromBillTo();
  showPartyModal.value = false;
  nextTick(() => {
    referenceInputRef.value?.focus();
    if (referenceInputRef.value instanceof HTMLInputElement) referenceInputRef.value.select();
  });
}

function onPartyLocationChange() {
  determineGstBillType();
  populateConsigneeFromBillTo();
}

function onFirmGstinChange(event: Event) {
  const gstin = (event.target as HTMLSelectElement).value;
  state.activeFirmLocation = state.firmLocations.find(location => (location.gst_number || '') === gstin) || null;
  determineGstBillType();
}

function onStockSelect(stock: any) {
  const selectedBatch = stock.selectedBatch;
  const batchNo = selectedBatch?.batch || '';
  const existing = state.cart.find(item => item.stockId === stock._id && (item.batch || '') === batchNo);
  if (existing) {
    existing.qty++;
  } else {
    state.cart.push({
      stockId: stock._id,
      item: stock.item,
      hsn: stock.hsn,
      qty: 1,
      uom: selectedBatch?.uom || stock.uom,
      rate: selectedBatch?.rate || stock.rate,
      grate: selectedBatch?.grate || stock.grate,
      disc: 0,
      itemType: 'GOODS',
      batch: batchNo,
      mrp: selectedBatch?.mrp || stock.mrp
    });
  }
  showStockModal.value = false;
  nextTick(() => {
    const lastIndex = state.cart.length - 1;
    const qtyInput = document.querySelector(`tr[data-row="${lastIndex}"] input.qty-input`) as HTMLElement;
    if (qtyInput) {
      qtyInput.focus();
      if (qtyInput instanceof HTMLInputElement) qtyInput.select();
    }
  });
}

function addServiceLine() {
  state.cart.push({
    item: '',
    hsn: '',
    qty: 1,
    uom: 'SRV',
    rate: 0,
    grate: 18,
    disc: 0,
    itemType: 'SERVICE'
  });
  nextTick(() => {
    const lastIndex = state.cart.length - 1;
    const itemInput = document.querySelector(`tr[data-row="${lastIndex}"] input.item-name-input`) as HTMLElement;
    if (itemInput) {
      itemInput.focus();
      if (itemInput instanceof HTMLInputElement) itemInput.select();
    }
  });
}

function removeCartItem(index: number) {
  state.cart.splice(index, 1);
  nextTick(() => {
    if (state.cart.length > 0) {
      const targetIndex = Math.min(index, state.cart.length - 1);
      const targetRow = document.querySelector(`tr[data-row="${targetIndex}"]`);
      if (targetRow) {
        const input = (targetRow.querySelector('input.item-name-input') || targetRow.querySelector('input.qty-input')) as HTMLElement;
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement) input.select();
          return;
        }
      }
    } else {
      const emptyBtn = document.querySelector('.empty-state button') as HTMLElement;
      if (emptyBtn) {
        emptyBtn.focus();
        return;
      }
      const narration = document.querySelector('.detail-panel textarea') as HTMLElement;
      narration?.focus();
    }
  });
}

function handleServiceInput() {}

function resetForm() {
  if (confirm('Clear current invoice details?')) {
    resetFormState();
    nextTick(() => firstInputRef.value?.focus());
  }
}

async function saveInvoice() {
  if (!canSave.value || loading.value) return;

  loading.value = true;
  try {
    const payload = state.isReturnMode
      ? {
          originalBillId: state.returnFromBillId,
          returnCart: state.cart.map(item => ({
            ...item,
            qty: parseFloat(item.returnQty) || 0
          })).filter(item => item.qty > 0),
          narration: state.meta.narration
        }
      : {
          meta: {
            ...state.meta,
            btype: state.meta.btype || 'SALES',
            firmGstin: state.activeFirmLocation?.gst_number || null,
            partyGstin: state.selectedPartyGstin || null
          },
          party: state.selectedParty,
          cart: state.cart,
          otherCharges: state.otherCharges,
          consignee: state.selectedConsignee
        };

    let res;
    if (state.isReturnMode) {
      res = await api.post('/accounting/credit-notes', payload);
    } else if (isEditMode.value) {
      const endpoint = state.meta.btype === 'PROFORMA' 
        ? `/accounting/proforma/${route.params.id}` 
        : (state.meta.btype === 'DELIVERY_NOTE' ? `/accounting/delivery-note/${route.params.id}` : `/accounting/sales/${route.params.id}`);
      res = await api.put(endpoint, payload);
    } else {
      const endpoint = state.meta.btype === 'PROFORMA' 
        ? '/accounting/proforma' 
        : (state.meta.btype === 'DELIVERY_NOTE' ? '/accounting/delivery-note' : '/accounting/sales');
      res = await api.post(endpoint, payload);
    }

    if (res.success) {
      createdBill.value = res.data || { _id: route.params.id, bno: state.meta.billNo };
      showPrintModal.value = true;
    }
  } catch (err: any) {
    alert(err.message || 'Failed to save invoice');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.invoice-page {
  height: calc(100vh - 84px);
  min-height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 0;
  overflow: hidden;
  margin: 0;
}
.return-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  background: #92400e;
  color: white;
  font-size: 13px;
  font-weight: 800;
}
.return-banner button {
  border: 1px solid rgba(255,255,255,0.45);
  background: transparent;
  color: white;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
.page-header {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 8px 12px 8px 0;
  background: white;
  border-bottom: 1px solid #dbe3ee;
  flex-wrap: wrap;
}
.title-block {
  width: 340px;
  flex: 0 0 340px;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 12px;
  border-right: 1px solid #dbe3ee;
}
.title-block p,
.eyebrow {
  margin: 0 0 4px;
  color: #64748b;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1;
  font-weight: 800;
}
.header-fields {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-left: 12px;
}
.header-fields label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.header-fields label span {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.header-fields input,
.header-fields select {
  height: 28px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 700;
  outline: none;
}
.header-fields input:focus,
.header-fields select:focus {
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.header-fields .readonly-input {
  background: #f1f5f9;
  color: #475569;
  cursor: not-allowed;
}
.inline-toggle {
  flex-direction: row !important;
  align-items: center;
  gap: 4px !important;
  margin-top: 14px;
  cursor: pointer;
}
.inline-toggle input {
  height: auto;
}
.gst-status {
  margin-top: 14px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #dcfce7;
  color: #166534;
  font-size: 10px;
  font-weight: 800;
}
.gst-status.off {
  background: #fee2e2;
  color: #991b1b;
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.ghost-btn,
.primary-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ghost-btn {
  border: 1px solid #cbd5e1;
  background: white;
  color: #475569;
}
.ghost-btn:hover {
  background: #f1f5f9;
}
.primary-btn {
  border: none;
  background: #2563eb;
  color: white;
}
.primary-btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary-btn span {
  padding: 1px 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 3px;
  font-size: 9px;
}
.workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.side-panel {
  width: 340px;
  flex: 0 0 340px;
  background: white;
  border-right: 1px solid #dbe3ee;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}
.main-panel {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.detail-panel {
  padding: 12px;
  border-top: 1px solid #e2e8f0;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.panel-head h2 {
  margin: 0;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  color: #0f172a;
}
.panel-head button {
  font-size: 10px;
  font-weight: 800;
  color: #2563eb;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 3px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field-grid label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.field-grid label.wide {
  grid-column: span 2;
}
.field-grid span {
  font-size: 9px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}
.field-grid input,
.field-grid textarea {
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  border-radius: 4px;
  padding: 5px 6px;
  font-size: 11px;
  font-weight: 700;
  outline: none;
}
.field-grid input:focus,
.field-grid textarea:focus {
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  z-index: 50;
  display: flex;
  justify-content: flex-end;
}
.party-drawer {
  width: 420px;
  max-width: 90vw;
  height: 100%;
  background: white;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}
.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}
.drawer-head h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
}
.drawer-close {
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}
.search-box {
  padding: 12px 20px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.search-input {
  width: 100%;
  border: 2px solid #2563eb;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 700;
  outline: none;
  background: white;
}
.party-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.party-option {
  width: 100%;
  text-align: left;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 6px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
  transition: all 0.15s;
}
.party-option:hover {
  background: #eff6ff;
  border-color: #93c5fd;
}
.party-option.active {
  background: #2563eb;
  border-color: #1d4ed8;
  color: white;
}
.party-option.active strong,
.party-option.active span {
  color: white;
}
.party-option strong {
  font-size: 13px;
  font-weight: 800;
  color: #0f172a;
}
.party-option span {
  font-size: 10px;
  color: #64748b;
  font-weight: 700;
}
.party-bal-badge {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
.bal-dr {
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
}
.bal-cr {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}
.bal-nil {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
.party-option.active .party-bal-badge {
  background: rgba(255, 255, 255, 0.22) !important;
  border-color: rgba(255, 255, 255, 0.45) !important;
  color: #ffffff !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
kbd {
  padding: 1px 4px;
  background: #e2e8f0;
  color: #1e293b;
  border-radius: 3px;
  font-family: monospace;
  font-size: 10px;
  font-weight: 800;
}
</style>
