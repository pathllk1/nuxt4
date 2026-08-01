<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useBillingState } from '../../../composables/useBillingState';
import { useBilling } from '../../../composables/useBilling';
import PartyManager from '../../../components/accounting/PartyManager.vue';
import CartManager from '../../../components/accounting/CartManager.vue';
import InvoiceSummary from '../../../components/accounting/InvoiceSummary.vue';
import StockModal from '../../../components/accounting/StockModal.vue';
import CreateStockModal from '../../../components/accounting/CreateStockModal.vue';
import PartyModal from '../../../components/accounting/PartyModal.vue';
import OtherChargesModal from '../../../components/accounting/OtherChargesModal.vue';

useHead({
  title: 'Purchase Bill Studio - Accounting Suite',
});

const router = useRouter();
const { state, totals, fetchData, fetchNextBillNo, determineGstBillType } = useBillingState();
const { createPurchaseBill, loading } = useBilling();

const showStockModal = ref(false);
const showCreateStockModal = ref(false);
const showPartyModal = ref(false);
const showCreatePartyModal = ref(false);
const showOtherChargesModal = ref(false);
const partySearchQuery = ref('');

const onPartySelect = (party: any) => {
  state.selectedParty = party;
  state.selectedPartyGstin = party.gstin || 'UNREGISTERED';
  state.selectedPartyLocation = party.gstLocations?.[0] || null;
  determineGstBillType();
  showPartyModal.value = false;
};

const onStockSelect = (stock: any) => {
  state.cart.push({
    stockId: stock._id,
    item: stock.item || stock.name,
    hsn: stock.hsn || '',
    qty: 1,
    uom: stock.uom || 'PCS',
    rate: stock.rate || stock.selling_price || 0,
    grate: stock.grate || 18,
    disc: 0,
    itemType: 'GOODS',
  });
};

const removeCartItem = (idx: number) => {
  state.cart.splice(idx, 1);
};

const saveInvoice = async () => {
  if (!state.selectedParty) {
    alert('Please select a supplier/party first.');
    return;
  }
  if (state.cart.length === 0) {
    alert('Cart cannot be empty. Add at least one item.');
    return;
  }

  const payload = {
    meta: state.meta,
    party: {
      id: state.selectedParty._id,
      name: state.selectedParty.name,
      gstin: state.selectedPartyGstin,
    },
    cart: state.cart,
    otherCharges: state.otherCharges,
  };

  try {
    const res = await createPurchaseBill(payload);
    if (res?.success) {
      router.push('/accounting/bills');
    }
  } catch (err: any) {
    alert(err.data?.message || err.message || 'Failed to save purchase bill');
  }
};

onMounted(async () => {
  await Promise.all([
    fetchData(),
    fetchNextBillNo('PURCHASE'),
  ]);
});
</script>

<template>
  <div class="p-6 max-w-full mx-auto space-y-6">
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-sm">
      <div>
        <span class="px-3 py-1 bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-500/30">
          Purchase & Inward Stock Bill
        </span>
        <h1 class="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white mt-1">Record Purchase Bill</h1>
      </div>

      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 text-xs font-bold">
          <span class="text-slate-400">System Bill No:</span>
          <span class="font-mono text-indigo-600 dark:text-indigo-400">#{{ state.meta.billNo || 'AUTO' }}</span>
        </div>
        <button type="button" @click="saveInvoice" :disabled="loading" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-2xl transition-colors shadow-sm disabled:opacity-50">
          {{ loading ? 'Saving...' : 'Receive Stock & Post Bill' }}
        </button>
      </div>
    </header>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="lg:col-span-1 space-y-4">
        <PartyManager
          :state="state"
          title="Supplier (Bill From)"
          empty-subtitle="Select supplier record"
          @open-modal="showPartyModal = true"
          @create-party="showCreatePartyModal = true"
        />

        <div class="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-3 text-xs">
          <div class="flex justify-between items-center">
            <h3 class="font-bold text-slate-900 dark:text-white">Supplier Bill Info</h3>
            <button type="button" @click="showOtherChargesModal = true" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              + Charges
            </button>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase">Supplier Invoice No *</label>
            <input type="text" v-model="state.meta.supplierBillNo" placeholder="INV-2026-001" class="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase">PO Reference No</label>
            <input type="text" v-model="state.meta.referenceNo" placeholder="Optional PO No" class="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold" />
          </div>
        </div>
      </div>

      <div class="lg:col-span-2 space-y-4">
        <CartManager
          :state="state"
          mode="purchase"
          @add-item="showStockModal = true"
          @remove-item="removeCartItem"
        />

        <InvoiceSummary :state="state" :totals="totals" />
      </div>
    </div>

    <!-- Modals -->
    <StockModal v-model="showStockModal" :stocks="state.stocks" @select="onStockSelect" @create-stock="showCreateStockModal = true" />
    <CreateStockModal v-model="showCreateStockModal" @saved="fetchData" />
    <PartyModal v-model="showCreatePartyModal" @saved="(p: any) => { fetchData(); onPartySelect(p); }" />
    <OtherChargesModal v-model="showOtherChargesModal" :other-charges="state.otherCharges" />

    <!-- Party Drawer Modal -->
    <div v-if="showPartyModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-zinc-800 p-6 space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Choose Supplier Party</h3>
          <button @click="showPartyModal = false" class="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <input type="text" v-model="partySearchQuery" placeholder="Search supplier name or GSTIN..." class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border rounded-xl font-bold text-xs" />
        <div class="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
          <div v-for="party in state.parties.filter((p: any) => p.name.toLowerCase().includes(partySearchQuery.toLowerCase()))" :key="party._id" @click="onPartySelect(party)" class="py-3 px-2 hover:bg-slate-50 dark:hover:bg-zinc-800/60 rounded-lg cursor-pointer flex justify-between">
            <span class="font-bold text-slate-900 dark:text-white">{{ party.name }}</span>
            <span class="font-mono text-indigo-600 dark:text-indigo-400">{{ party.gstin || 'UNREGISTERED' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
