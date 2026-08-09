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
        <button class="ghost-btn" type="button" @click="resetForm">Discard</button>
        <button class="primary-btn" type="button" :disabled="loading || !canSave" @click="saveInvoice">
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
          empty-subtitle="Customer record"
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
              <input ref="referenceInputRef" v-model="state.meta.referenceNo" type="text" placeholder="Optional" />
            </label>
            <label>
              <span>Vehicle no</span>
              <input v-model="state.meta.vehicleNo" type="text" placeholder="KA-01-XX-1234" />
            </label>
            <label class="wide">
              <span>Dispatch through</span>
              <input v-model="state.meta.dispatchThrough" type="text" placeholder="Transport, courier, self" />
            </label>
            <label class="wide">
              <span>Narration (Shift+Enter for new line)</span>
              <textarea v-model="state.meta.narration" rows="4" placeholder="Additional notes... (Enter jumps to Cart / Stock F2)" @keydown.enter="onNarrationEnter"></textarea>
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

    <StockModal v-model="showStockModal" :stocks="state.stocks" @select="onStockSelect" @create-stock="showCreateStockModal = true" @edit-stock="onEditStock" />
    <CreateStockModal v-model="showCreateStockModal" @saved="fetchData" />
    <EditStockModal v-model="showEditStockModal" :stock="selectedStockToEdit" @saved="fetchData" />
    <PartyModal v-model="showCreatePartyModal" @saved="(p: any) => { fetchData(); onPartySelect(p); }" />
    <OtherChargesModal v-model="showOtherChargesModal" :other-charges="state.otherCharges" />

    <UModal v-model:open="showPrintModal" :title="createdBill?.btype === 'PROFORMA' ? 'Proforma Invoice Saved Successfully' : (createdBill?.btype === 'DELIVERY_NOTE' ? 'Delivery Challan Saved Successfully' : 'Invoice Created Successfully')">
      <template #body>
        <div class="p-4 flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl">
          <div class="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-full">
            <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">{{ createdBill?.btype === 'PROFORMA' ? 'Proforma' : (createdBill?.btype === 'DELIVERY_NOTE' ? 'Delivery Challan' : 'Invoice') }} #{{ createdBill?.bno }} Saved</h3>
            <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">Would you like to print or download the document now?</p>
          </div>
          <div class="flex gap-3 mt-4 w-full justify-center">
            <UButton 
              color="primary" 
              icon="i-heroicons-arrow-down-tray" 
              label="Download PDF" 
              class="flex-1 sm:flex-none font-bold"
              @click="downloadCreatedPDF" 
            />
            <UButton 
              color="success" 
              icon="i-heroicons-table-cells" 
              label="Export Excel" 
              class="flex-1 sm:flex-none font-bold"
              @click="downloadCreatedExcel" 
            />
            <UButton 
              color="neutral" 
              variant="outline" 
              label="Close" 
              class="flex-1 sm:flex-none font-bold"
              @click="closePrintModal" 
            />
          </div>
        </div>
      </template>
    </UModal>

    <div v-if="showPartyModal" class="drawer-backdrop" @click.self="showPartyModal = false">
      <div class="party-drawer" role="dialog" aria-modal="true" aria-label="Choose party">
        <header class="drawer-head">
          <div>
            <p class="eyebrow">Records</p>
            <h2>Choose party</h2>
          </div>
          <button type="button" class="drawer-close" @click="showPartyModal = false">Close</button>
        </header>
        <div class="search-box">
          <input 
            ref="partySearchInputRef"
            v-model="partySearchQuery" 
            type="text" 
            placeholder="Search by name, GSTIN, state... (↑↓ Navigate • Enter Select • ESC Close)" 
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
            <strong>{{ party.name || party.firm }}</strong>
            <span>{{ party.gstin || 'UNREGISTERED' }} | {{ party.state || '-' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useBillingState } from '@/composables/useBillingState';
import PartyManager from '@/components/accounting/PartyManager.vue';
import CartManager from '@/components/accounting/CartManager.vue';
import InvoiceSummary from '@/components/accounting/InvoiceSummary.vue';
import StockModal from '@/components/accounting/StockModal.vue';
import CreateStockModal from '@/components/accounting/CreateStockModal.vue';
import EditStockModal from '@/components/accounting/EditStockModal.vue';
import PartyModal from '@/components/accounting/PartyModal.vue';
import OtherChargesModal from '@/components/accounting/OtherChargesModal.vue';
import { api } from '@/utils/api';

import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const router = useRouter();
const route = useRoute();
const { state, totals, fetchData, fetchNextBillNo, determineGstBillType, populateConsigneeFromBillTo } = useBillingState();
const { saveFocus, restoreFocus, trackPageFocus, handleEnterKey, handleBackspaceKey } = useKeyboardNavigation();

const firstInputRef = ref<HTMLElement | null>(null);
const referenceInputRef = ref<HTMLElement | null>(null);
const partySearchInputRef = ref<HTMLInputElement | null>(null);
const partySelectedIndex = ref(0);

const showStockModal = ref(false);
const showPartyModal = ref(false);
const partySearchQuery = ref('');
const showPrintModal = ref(false);
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

watch(partySearchQuery, () => {
  partySelectedIndex.value = 0;
});

function onReverseChargeEnter() {
  state.meta.reverseCharge = !state.meta.reverseCharge;
  saveFocus();
  showPartyModal.value = true;
}

function onNarrationEnter(e: KeyboardEvent) {
  if (e.shiftKey) return; // Allow Shift+Enter for multiline notes
  e.preventDefault();
  if (state.cart.length > 0) {
    const firstQtyInput = document.querySelector('tr[data-row="0"] input.qty-input') as HTMLElement;
    if (firstQtyInput) {
      firstQtyInput.focus();
      if (firstQtyInput instanceof HTMLInputElement) firstQtyInput.select();
      return;
    }
  }
  saveFocus();
  showStockModal.value = true;
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
    }
  } else if (e.key === 'Escape') {
    e.preventDefault();
    showPartyModal.value = false;
    restoreFocus();
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
  }
});

function onEditStock(stock: any) {
  selectedStockToEdit.value = stock;
  showEditStockModal.value = true;
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'F2') {
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
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && !activeEl.closest('.table-wrap') && !activeEl.closest('.drawer-backdrop') && !activeEl.closest('.fixed')) {
      const container = document.querySelector('.invoice-page') as HTMLElement;
      handleEnterKey(e, container);
    }
  } else if (e.key === 'Backspace') {
    const activeEl = document.activeElement as HTMLElement;
    if (activeEl && !activeEl.closest('.table-wrap') && !activeEl.closest('.drawer-backdrop') && !activeEl.closest('.fixed')) {
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

  // Initial Page Load 1st Input Auto-Focus
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
      state.selectedParty = { _id: bill.partyId, name: bill.partyName, address: bill.partyAddress, gstin: bill.partyGstin };
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
        mrp: item.mrp || 0
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
}

function removeCartItem(index: number) {
  state.cart.splice(index, 1);
}

function handleServiceInput() {}

function resetForm() {
  if (confirm('Clear current invoice details?')) {
    location.reload();
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
      resetFormState();
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
  height: calc(100vh - 140px);
  min-height: 620px;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
  color: #0f172a;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
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
  width: 256px;
  flex: 0 0 256px;
  box-sizing: border-box;
  padding-left: 12px;
  padding-right: 12px;
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
  gap: 10px;
  flex-wrap: wrap;
  align-items: flex-end;
  padding-left: 0;
}
.header-actions {
  margin-left: auto;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.field-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: flex-end;
}
label {
  display: grid;
  gap: 5px;
}
label span {
  color: #64748b;
  font-size: 11px;
  font-weight: 850;
}
input,
select,
textarea {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: white;
  padding: 5px 8px;
  color: #0f172a;
  font-size: 12px;
  outline: none;
}
.readonly-input {
  width: 160px;
  background: #f1f5f9;
  color: #64748b;
  font-weight: 800;
  cursor: not-allowed;
}
.inline-toggle {
  display: flex;
  grid-template-columns: none;
  align-items: center;
  gap: 6px;
  min-height: 29px;
  padding-bottom: 1px;
}
.inline-toggle input {
  width: 15px;
  height: 15px;
  padding: 0;
}
.inline-toggle span {
  white-space: nowrap;
}
.gst-status {
  align-self: end;
  border-radius: 4px;
  background: #dcfce7;
  color: #166534;
  padding: 6px 8px;
  font-size: 10px;
  font-weight: 900;
}
.gst-status.off {
  background: #fee2e2;
  color: #991b1b;
}
textarea {
  resize: vertical;
}
input:focus,
select:focus,
textarea:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.primary-btn,
.ghost-btn {
  border-radius: 4px;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.primary-btn {
  border: 1px solid #1d4ed8;
  background: #1d4ed8;
  color: white;
}
.primary-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary-btn span {
  margin-left: 6px;
  opacity: 0.7;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.ghost-btn {
  border: 1px solid #cbd5e1;
  background: white;
  color: #475569;
}
.workspace {
  min-height: 0;
  flex: 1;
  display: flex;
  gap: 0;
  padding: 0;
  overflow: hidden;
}
.side-panel,
.main-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.main-panel {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.side-panel {
  width: 256px;
  flex: 0 0 256px;
  overflow: auto;
  background: #f8fafc;
  border-right: 1px solid #dbe3ee;
}
.detail-panel {
  background: white;
  border: 0;
  border-top: 1px solid #dbe3ee;
  border-radius: 0;
  padding: 12px;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 14px;
}
.panel-head h2 {
  margin: 0;
  font-size: 13px;
}
.panel-head button {
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}
.field-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}
.wide {
  grid-column: 1 / -1;
}
.party-drawer {
  width: min(420px, 100vw);
  height: 100%;
  overflow: auto;
  padding: 18px;
  background: #f8fafc;
  box-shadow: -16px 0 32px rgba(15, 23, 42, 0.18);
}
.drawer-backdrop {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  justify-content: flex-end;
  background: rgba(15, 23, 42, 0.35);
}
.drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 18px;
}
.party-drawer h2 {
  margin: 0;
  font-size: 22px;
}
.drawer-close {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: white;
  color: #475569;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}
.search-box {
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
}
.party-list {
  display: grid;
  gap: 8px;
}
.party-option {
  width: 100%;
  display: grid;
  gap: 4px;
  text-align: left;
  border: 1px solid #dbe3ee;
  background: white;
  border-radius: 4px;
  padding: 10px;
  cursor: pointer;
}
.party-option:hover {
  border-color: #2563eb;
}
.party-option span {
  color: #64748b;
  font-size: 12px;
}
@media (max-width: 1100px) {
  .invoice-page {
    height: auto;
  }
  .workspace {
    flex-direction: column;
    overflow: visible;
  }
  .side-panel {
    width: 100%;
    flex-basis: auto;
    border-right: 0;
    border-bottom: 1px solid #dbe3ee;
  }
  .header-actions {
    justify-content: flex-start;
  }
}
</style>
