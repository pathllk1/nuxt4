<template>
  <div class="invoice-page purchase-page">
    <div v-if="state.isReturnMode && state.currentBill" class="return-banner">
      <span>Purchase return for bill #{{ state.currentBill.bno }}</span>
      <button type="button" @click="router.push('/accounting/purchases/new')">Cancel return</button>
    </div>

    <header class="page-header">
      <div class="title-block">
        <p>{{ state.currentFirmName }}</p>
        <h1>{{ state.isReturnMode ? 'Debit Note' : (isEditMode ? 'Edit Purchase Bill' : 'Purchase Bill') }}</h1>
      </div>

      <div class="header-fields">
        <label>
          <span>Supplier bill no</span>
          <input v-model="state.meta.supplierBillNo" type="text" placeholder="INV-000" />
        </label>
        <label>
          <span>System purchase no</span>
          <input :value="state.meta.billNo || 'AUTO'" type="text" readonly class="readonly-input" />
        </label>
        <label>
          <span>Bill date</span>
          <input v-model="state.meta.billDate" type="date" />
        </label>
        <label v-if="state.firmLocations.length >= 1">
          <span>Receiving GSTIN</span>
          <select :value="state.activeFirmLocation?.gst_number || ''" :disabled="state.isReturnMode" @change="onFirmGstinChange">
            <option v-for="location in state.firmLocations" :key="location.gst_number || location.state_code" :value="location.gst_number || ''">
              {{ location.gst_number || 'No GSTIN' }} - {{ location.state || location.state_code || '' }}{{ location.is_default ? ' (Default)' : '' }}
            </option>
          </select>
        </label>
        <label v-if="state.gstEnabled">
          <span>Transaction type</span>
          <select v-model="state.meta.billType" :disabled="state.isReturnMode">
            <option value="intra-state">Intra-State (CGST + SGST)</option>
            <option value="inter-state">Inter-State (IGST)</option>
          </select>
        </label>
        <label v-if="state.gstEnabled" class="inline-toggle">
          <input v-model="state.meta.reverseCharge" type="checkbox" :disabled="state.isReturnMode" />
          <span>Reverse Charge</span>
        </label>
        <div class="gst-status" :class="{ off: !state.gstEnabled }">
          GST: {{ state.gstEnabled ? 'ON' : 'OFF' }}
        </div>
      </div>

      <div class="header-actions">
        <button class="ghost-btn" type="button" @click="resetForm">Discard</button>
        <button class="primary-btn" type="button" :disabled="loading || !canSave" @click="saveInvoice">
          {{ loading ? 'Saving...' : state.isReturnMode ? 'Create Debit Note' : (isEditMode ? 'Update Bill' : 'Receive Stock') }}
          <span>F8</span>
        </button>
      </div>
    </header>

    <main class="workspace">
      <aside class="side-panel">
        <PartyManager
          :state="state"
          title="Supplier (Bill From)"
          empty-subtitle="Supplier record"
          @open-modal="showPartyModal = true"
          @create-party="showCreatePartyModal = true"
          @location-change="onPartyLocationChange"
        />

        <section class="detail-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">Details</p>
              <h2>Inward configuration</h2>
            </div>
            <button type="button" @click="showOtherChargesModal = true">Charges F4</button>
          </div>

          <div class="field-grid">
            <label class="wide">
              <span>Dispatch mode / reference</span>
              <input v-model="state.meta.dispatchThrough" type="text" placeholder="Transport, hand delivery, self pickup" />
            </label>
            <label class="wide">
              <span>Reference</span>
              <input v-model="state.meta.referenceNo" type="text" placeholder="Optional GRN or PO reference" />
            </label>
            <label class="wide">
              <span>Narration</span>
              <textarea v-model="state.meta.narration" rows="4" placeholder="Additional notes"></textarea>
            </label>
          </div>
        </section>
      </aside>

      <section class="main-panel">
        <CartManager
          :state="state"
          mode="purchase"
          @add-item="showStockModal = true"
          @remove-item="removeCartItem"
        />
        <InvoiceSummary :state="state" :totals="totals" />
      </section>
    </main>

    <StockModal v-model="showStockModal" :stocks="state.stocks" @select="onStockSelect" @create-stock="showCreateStockModal = true" @edit-stock="onEditStock" />
    <CreateStockModal v-model="showCreateStockModal" @saved="fetchData" />
    <EditStockModal v-model="showEditStockModal" :stock="selectedStockToEdit" @saved="fetchData" />
    <PartyModal v-model="showCreatePartyModal" @saved="(p: any) => { fetchData(); onPartySelect(p); }" />
    <OtherChargesModal v-model="showOtherChargesModal" :other-charges="state.otherCharges" />

    <UModal v-model:open="showPrintModal" title="Bill Saved Successfully">
      <template #body>
        <div class="p-4 flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl">
          <div class="p-3 bg-green-500/10 dark:bg-green-500/20 rounded-full">
            <UIcon name="i-heroicons-check-circle" class="w-12 h-12 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">Bill #{{ createdBill?.bno }} Saved</h3>
            <p class="text-sm text-gray-500 dark:text-zinc-400 mt-1">Would you like to print or download the bill now?</p>
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
      <div class="party-drawer" role="dialog" aria-modal="true" aria-label="Select supplier">
        <header class="drawer-head">
          <div>
            <p class="eyebrow">Records</p>
            <h2>Select supplier</h2>
          </div>
          <button type="button" class="drawer-close" @click="showPartyModal = false">Close</button>
        </header>
        <div class="search-box">
          <input 
            v-model="partySearchQuery" 
            type="text" 
            placeholder="Search by name, GSTIN, state..." 
            class="search-input" 
            @keydown.stop
          />
        </div>
        <div class="party-list">
          <button v-for="party in filteredParties" :key="party._id" class="party-option" type="button" @click="onPartySelect(party)">
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

const router = useRouter();
const route = useRoute();
const { state, totals, fetchData, fetchNextBillNo, determineGstBillType, populateConsigneeFromBillTo } = useBillingState();

const showStockModal = ref(false);
const showPartyModal = ref(false);
const partySearchQuery = ref('');
const showPrintModal = ref(false);
const createdBill = ref<any>(null);
const isEditMode = ref(false);

function closePrintModal() {
  showPrintModal.value = false;
  if (isEditMode.value) {
    router.push('/accounting/bills');
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
  state.meta.supplierBillNo = '';
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

watch(showPartyModal, (val) => {
  if (!val) {
    partySearchQuery.value = '';
  }
});
const showCreatePartyModal = ref(false);
const showCreateStockModal = ref(false);
const showEditStockModal = ref(false);
const showOtherChargesModal = ref(false);
const selectedStockToEdit = ref<any>(null);
const loading = ref(false);

function onEditStock(stock: any) {
  selectedStockToEdit.value = stock;
  showEditStockModal.value = true;
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'F2') { e.preventDefault(); showStockModal.value = true; }
  else if (e.key === 'F3') { e.preventDefault(); showPartyModal.value = true; }
  else if (e.key === 'F4') { e.preventDefault(); showOtherChargesModal.value = true; }
  else if (e.key === 'F8') { e.preventDefault(); saveInvoice(); }
  else if (e.key === 'F9') { e.preventDefault(); resetForm(); }
};

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown);
  state.meta.btype = 'PURCHASE';
  await fetchData();

  if (route.params.id) {
    isEditMode.value = true;
    await loadBillForEditing(route.params.id as string);
  } else if (route.query.returnFrom) {
    state.isReturnMode = true;
    state.returnFromBillId = route.query.returnFrom as string;
    await loadExistingBill(state.returnFromBillId);
  } else {
    await fetchNextBillNo('PURCHASE');
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
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
      
      state.meta.billNo = bill.bno;
      state.meta.billDate = bill.bdate;
      state.meta.billType = bill.billSubtype?.toLowerCase() === 'inter-state' ? 'inter-state' : 'intra-state';
      state.meta.reverseCharge = bill.reverseCharge;
      state.meta.referenceNo = bill.orderNo || '';
      state.meta.dispatchThrough = bill.dispatchThrough || '';
      state.meta.narration = bill.narration || '';
      state.meta.supplierBillNo = bill.supplierBillNo || '';
      
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

const canSave = computed(() => {
  const partyOk = state.selectedParty;
  const supplierBillNoOk = state.isReturnMode || state.meta.supplierBillNo;
  const cartOk = state.cart.length > 0 && state.cart.every(item => {
    const qty = state.isReturnMode ? item.returnQty : item.qty;
    return item.item && (parseFloat(qty) || 0) > 0 && (parseFloat(item.rate) || 0) > 0;
  });
  return partyOk && supplierBillNoOk && cartOk;
});

function onPartySelect(party: any) {
  state.selectedParty = party;
  const primaryLoc = party.gstLocations?.find((l: any) => l.isPrimary) || party.gstLocations?.[0] || null;
  state.selectedPartyLocation = primaryLoc;
  state.selectedPartyGstin = primaryLoc?.gstin || party.gstin || 'UNREGISTERED';
  determineGstBillType();
  populateConsigneeFromBillTo();
  showPartyModal.value = false;
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
      batch: batchNo,
      qty: 1,
      uom: selectedBatch?.uom || stock.uom || 'PCS',
      rate: selectedBatch?.rate || stock.rate || 0,
      grate: selectedBatch?.grate || stock.grate || 18,
      disc: 0,
      itemType: 'GOODS',
      mrp: selectedBatch?.mrp || stock.mrp || 0,
      pno: stock.pno,
      oem: stock.oem
    });
  }
  showStockModal.value = false;
}

function removeCartItem(index: number) {
  state.cart.splice(index, 1);
}

function resetForm() {
  if (confirm('Clear current bill details?')) {
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
            btype: 'PURCHASE',
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
      res = await api.post('/accounting/debit-notes', payload);
    } else if (isEditMode.value) {
      res = await api.put(`/accounting/purchases/${route.params.id}`, payload);
    } else {
      res = await api.post('/accounting/purchases', payload);
    }
    
    if (res.success) {
      createdBill.value = res.data || { _id: route.params.id, bno: state.meta.billNo };
      showPrintModal.value = true;
      resetFormState();
    }
  } catch (err: any) {
    alert(err.message || 'Failed to save bill');
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
}
.return-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 24px;
  background: #991b1b;
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
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px;
  background: white;
  border-bottom: 1px solid #dbe3ee;
  flex-wrap: wrap;
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
.header-fields,
.header-actions {
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
  width: 118px;
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
  border-color: #047857;
  box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
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
  border: 1px solid #047857;
  background: #047857;
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
  border: 1px solid #a7f3d0;
  background: #ecfdf5;
  color: #047857;
  border-radius: 6px;
  padding: 7px 9px;
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
}
.field-grid {
  display: grid;
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
  font-weight: 800;
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
  border-color: #047857;
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
