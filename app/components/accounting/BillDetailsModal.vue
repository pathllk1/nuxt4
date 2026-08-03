<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col">
      <!-- Header -->
      <header class="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 px-8 py-5 text-white flex justify-between items-center shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <UIcon name="i-heroicons-document-text" class="w-6 h-6 text-indigo-200" />
          </div>
          <div>
            <h2 class="text-lg font-black uppercase tracking-tight">Transaction Details</h2>
            <p class="text-[10px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Read-Only Registry Ledger View</p>
          </div>
        </div>
        <button @click="close" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
          <UIcon name="i-heroicons-x-mark" class="h-6 w-6 text-white" />
        </button>
      </header>

      <!-- Body -->
      <div class="overflow-y-auto p-8 flex-1 space-y-6">
        <div v-if="loading" class="flex flex-col items-center justify-center py-12 space-y-3">
          <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 text-indigo-500 animate-spin" />
          <span class="text-xs font-black uppercase tracking-widest text-slate-400">Loading details...</span>
        </div>

        <template v-else-if="bill">
          <!-- Meta Grid -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
              <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Bill Number</span>
              <p class="text-sm font-black text-slate-900 dark:text-white font-mono mt-1">{{ bill.bno }}</p>
            </div>
            <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
              <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Date</span>
              <p class="text-sm font-bold text-slate-700 dark:text-zinc-300 mt-1">{{ formatDate(bill.bdate) }}</p>
            </div>
            <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
              <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Type</span>
              <div class="mt-1 flex flex-col items-start gap-1">
                <span :class="getTypeBadgeClass(bill.btype)" class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                  {{ bill.btype }}
                </span>
                <button v-if="bill.refBillId" @click="$emit('view-bill', bill.refBillId)" class="text-[9px] font-black text-blue-600 hover:underline tracking-tight">
                  Ref Original Bill
                </button>
              </div>
            </div>
            <div class="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
              <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Status</span>
              <div class="mt-1">
                <span :class="bill.status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : (bill.status === 'CONVERTED' ? 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400')" class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest">
                  {{ bill.status }}
                </span>
              </div>
            </div>
          </div>

          <!-- Party Details -->
          <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div class="bg-slate-50/50 dark:bg-zinc-800/50 px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between">
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Party Information</h3>
              <span class="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{{ bill.btype === 'PURCHASE' ? 'Supplier' : 'Customer' }}</span>
            </div>
            <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Name</span>
                <p class="text-sm font-bold text-slate-800 dark:text-zinc-200 mt-0.5">{{ bill.partyName }}</p>
              </div>
              <div>
                <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">GSTIN</span>
                <p class="text-sm font-mono text-slate-800 dark:text-zinc-200 mt-0.5">{{ bill.partyGstin || 'UNREGISTERED' }}</p>
              </div>
              <div class="sm:col-span-2">
                <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Billing Address</span>
                <p class="text-xs text-slate-600 dark:text-zinc-400 mt-0.5">
                  {{ bill.partyAddress }}<template v-if="bill.partyState">, {{ bill.partyState }}</template><template v-if="bill.partyPin"> - {{ bill.partyPin }}</template>
                </p>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div class="bg-slate-50/50 dark:bg-zinc-800/50 px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Line Items</h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/50 dark:bg-zinc-800/50 text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em] border-b border-slate-100 dark:border-zinc-800">
                    <th class="px-6 py-3">Description</th>
                    <th class="px-4 py-3">Batch</th>
                    <th class="px-4 py-3 text-right">Qty</th>
                    <th class="px-4 py-3 text-right">Rate</th>
                    <th class="px-4 py-3 text-right">Disc %</th>
                    <th class="px-4 py-3 text-right">GST %</th>
                    <th class="px-6 py-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 text-xs">
                  <tr v-for="(item, idx) in bill.items" :key="idx" class="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {{ item.item }}
                      <span v-if="item.itemType === 'SERVICE'" class="ml-1 text-[8px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-1 py-0.2 rounded font-black uppercase">Service</span>
                    </td>
                    <td class="px-4 py-4 text-slate-600 dark:text-zinc-400 font-mono">{{ item.batch || '—' }}</td>
                    <td class="px-4 py-4 text-right font-bold text-slate-700 dark:text-zinc-300">
                      {{ item.qty.toLocaleString() }} <span class="text-[9px] text-slate-400 ml-0.5 uppercase">{{ item.uom }}</span>
                    </td>
                    <td class="px-4 py-4 text-right text-slate-600 dark:text-zinc-400">₹{{ item.rate.toLocaleString() }}</td>
                    <td class="px-4 py-4 text-right text-slate-600 dark:text-zinc-400">{{ item.disc ? `${item.disc}%` : '—' }}</td>
                    <td class="px-4 py-4 text-right text-slate-600 dark:text-zinc-400">{{ item.grate || item.gstRate || 0 }}%</td>
                    <td class="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">₹{{ item.total.toLocaleString() }}</td>
                  </tr>
                  <tr v-if="!bill.items || bill.items.length === 0">
                    <td colspan="7" class="px-6 py-8 text-center text-slate-400 font-medium">No items attached to this transaction</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Other Charges -->
          <div v-if="bill.otherCharges && bill.otherCharges.length > 0" class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div class="bg-slate-50/50 dark:bg-zinc-800/50 px-6 py-4 border-b border-slate-100 dark:border-zinc-800">
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Other Charges</h3>
            </div>
            <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div v-for="(charge, index) in bill.otherCharges" :key="index" class="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl">
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-zinc-300">{{ charge.name || charge.type }}</p>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">GST: {{ charge.grate || charge.gstRate || 0 }}%</span>
                    <span v-if="charge.hsnSac" class="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest border-l border-slate-200 dark:border-zinc-700 pl-2">HSN/SAC: {{ charge.hsnSac }}</span>
                  </div>
                </div>
                <span class="text-sm font-black text-slate-900 dark:text-white font-mono">₹{{ charge.amount.toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- Financial Summary -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Tax Breakdown -->
            <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm p-6 space-y-4">
              <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2">Tax Breakdown</h3>
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl p-3 text-center">
                  <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">CGST</span>
                  <p class="text-sm font-black text-slate-800 dark:text-zinc-200 mt-1">₹{{ (bill.cgst || 0).toLocaleString() }}</p>
                </div>
                <div class="bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl p-3 text-center">
                  <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">SGST</span>
                  <p class="text-sm font-black text-slate-800 dark:text-zinc-200 mt-1">₹{{ (bill.sgst || 0).toLocaleString() }}</p>
                </div>
                <div class="bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl p-3 text-center">
                  <span class="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">IGST</span>
                  <p class="text-sm font-black text-slate-800 dark:text-zinc-200 mt-1">₹{{ (bill.igst || 0).toLocaleString() }}</p>
                </div>
              </div>
            </div>

            <!-- Financial Totals -->
            <div class="bg-white dark:bg-zinc-900 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm p-6 space-y-3">
              <div class="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span class="text-xs font-bold uppercase tracking-wider">Taxable Amount</span>
                <span class="text-sm font-mono font-bold">₹{{ (bill.grossTotal || 0).toLocaleString() }}</span>
              </div>
              <div class="flex justify-between items-center text-slate-600 dark:text-zinc-400">
                <span class="text-xs font-bold uppercase tracking-wider">Tax Amount</span>
                <span class="text-sm font-mono font-bold">₹{{ ((bill.cgst || 0) + (bill.sgst || 0) + (bill.igst || 0)).toLocaleString() }}</span>
              </div>
              <div v-if="bill.roundOff" class="flex justify-between items-center text-slate-400 dark:text-zinc-500">
                <span class="text-[10px] font-bold uppercase tracking-wider">Round Off</span>
                <span class="text-xs font-mono font-medium">{{ bill.roundOff > 0 ? '+' : '' }}{{ Number(bill.roundOff).toFixed(2) }}</span>
              </div>
              <div class="border-t border-slate-100 dark:border-zinc-800 pt-3 flex justify-between items-center">
                <span class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Grand Total</span>
                <span class="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">₹{{ (bill.netTotal || 0).toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <!-- Cancellation Section Form -->
          <div v-if="showCancelSection" class="bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-100 dark:border-rose-900/40 rounded-3xl p-6 space-y-4 animate-scale-in">
            <div class="flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5" />
              <h4 class="text-sm font-black uppercase tracking-wider">Cancel Transaction</h4>
            </div>
            <p class="text-xs text-rose-600 dark:text-rose-300 font-medium">
              Cancelling this transaction will reverse all associated stock adjustments and delete all ledger postings. This action is permanent and cannot be undone.
            </p>
            <div class="space-y-4">
              <div>
                <label class="block text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1.5 ml-1">Cancellation Reason *</label>
                <select v-model="cancelReason" class="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/40 rounded-xl outline-none font-bold text-xs">
                  <option value="">Select a reason...</option>
                  <option value="CUSTOMER_REQUEST">Customer Request</option>
                  <option value="DATA_ENTRY_ERROR">Data Entry Error</option>
                  <option value="DUPLICATE_BILL">Duplicate Bill</option>
                  <option value="BILLING_ERROR">Billing Error</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
              <div>
                <label class="block text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest mb-1.5 ml-1">Remarks</label>
                <textarea v-model="cancelRemarks" rows="2" class="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-rose-200 dark:border-rose-900/40 rounded-xl outline-none font-medium text-xs resize-none" placeholder="Enter cancellation details..."></textarea>
              </div>
              <div class="flex items-center gap-2 pt-2">
                <button @click="confirmCancellation" :disabled="cancelling || !cancelReason" class="px-5 py-2.5 bg-rose-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all flex items-center gap-1.5">
                  <UIcon v-if="cancelling" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
                  Confirm Cancellation
                </button>
                <button @click="showCancelSection = false" :disabled="cancelling" class="px-5 py-2.5 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-all">
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </template>
        
        <div v-else class="text-center py-12 text-slate-400 font-bold uppercase text-xs tracking-widest">
          Failed to load transaction details
        </div>
      </div>

      <!-- Footer Buttons -->
      <footer class="bg-slate-50 dark:bg-zinc-850 px-8 py-5 border-t border-slate-100 dark:border-zinc-800 shrink-0 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="bill && bill.status === 'ACTIVE' && ['SALES', 'PURCHASE', 'PROFORMA', 'DELIVERY_NOTE'].includes(String(bill.btype).toUpperCase()) && !showCancelSection" @click="editBill" class="px-5 py-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0">
            Edit Bill
          </button>
          <button v-if="bill && bill.status === 'ACTIVE' && ['PROFORMA', 'DELIVERY_NOTE'].includes(String(bill.btype).toUpperCase()) && !showCancelSection" @click="convertToSales" :disabled="converting" class="px-5 py-3 bg-teal-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-teal-700 disabled:opacity-50 transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <UIcon v-if="converting" name="i-heroicons-arrow-path" class="w-3.5 h-3.5 animate-spin" />
            Convert to Sales Invoice
          </button>
          <button v-if="bill && bill.status === 'ACTIVE' && !showCancelSection" @click="showCancelSection = true" class="px-5 py-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0">
            Cancel Bill
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-2 md:justify-end">
          <button @click="printBill" :disabled="loading" class="px-5 py-3 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-200 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
            <UIcon name="i-heroicons-printer" class="w-4 h-4" />
            Print
          </button>
          <button @click="downloadPDF" :disabled="loading" class="px-5 py-3 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0">
            <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
            Download PDF
          </button>
          <button @click="close" class="px-5 py-3 bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-300 transition-colors whitespace-nowrap shrink-0">
            Close
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  billId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'cancelled'): void;
  (e: 'view-bill', id: string): void;
}>();

const router = useRouter();
const loading = ref(false);
const bill = ref<any>(null);

function editBill() {
  if (!bill.value) return;
  const btypeUpper = String(bill.value.btype).toUpperCase();
  const path = ['SALES', 'PROFORMA', 'DELIVERY_NOTE'].includes(btypeUpper)
    ? `/accounting/sales/${bill.value._id}/edit`
    : `/accounting/purchases/${bill.value._id}/edit`;
  router.push(path);
  close();
}

const showCancelSection = ref(false);
const cancelReason = ref('');
const cancelRemarks = ref('');
const cancelling = ref(false);

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    resetCancelForm();
    fetchDetails();
  }
});

watch(() => props.billId, () => {
  if (props.modelValue) {
    resetCancelForm();
    fetchDetails();
  }
});

async function fetchDetails() {
  if (!props.billId) return;
  loading.value = true;
  bill.value = null;
  try {
    const res = await api.get(`/accounting/bills/${props.billId}`);
    if (res.success) {
      bill.value = res.data;
    }
  } catch (err: any) {
    console.error('Error loading bill details:', err);
  } finally {
    loading.value = false;
  }
}

function close() {
  emit('update:modelValue', false);
}

function resetCancelForm() {
  showCancelSection.value = false;
  cancelReason.value = '';
  cancelRemarks.value = '';
  cancelling.value = false;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTypeBadgeClass(type: string) {
  const map: any = {
    'SALES': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'PROFORMA': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'DELIVERY_NOTE': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    'PURCHASE': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'CREDIT_NOTE': 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'DEBIT_NOTE': 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
  };
  return map[String(type).toUpperCase()] || 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300';
}

async function confirmCancellation() {
  if (!props.billId || !cancelReason.value) return;
  cancelling.value = true;
  try {
    const response = await api.post(`/accounting/bills/${props.billId}/cancel`, {
      reason: `${cancelReason.value}${cancelRemarks.value ? ': ' + cancelRemarks.value : ''}`
    });
    if (response.success) {
      emit('cancelled');
      close();
    }
  } catch (err: any) {
    console.error('Cancellation failed:', err);
  } finally {
    cancelling.value = false;
  }
}

const converting = ref(false);

async function convertToSales() {
  if (!bill.value || converting.value) return;
  const isChallan = bill.value.btype === 'DELIVERY_NOTE';
  const confirmMsg = isChallan
    ? 'Are you sure you want to convert this Delivery Challan to a standard Sales Invoice?'
    : 'Are you sure you want to convert this Proforma Invoice to a standard Sales Invoice?';

  if (!confirm(confirmMsg)) return;

  converting.value = true;
  try {
    const endpoint = isChallan
      ? `/accounting/delivery-note/${bill.value._id}/convert`
      : `/accounting/proforma/${bill.value._id}/convert`;
    const res = await api.post(endpoint, {});
    if (res.success) {
      emit('cancelled');
      if (res.data?._id) {
        emit('view-bill', res.data._id);
      } else {
        close();
      }
    }
  } catch (err: any) {
    console.error('Conversion failed:', err);
  } finally {
    converting.value = false;
  }
}

async function downloadPDF() {
  if (!bill.value) return;
  try {
    const blob = await api.get(`/accounting/bills/${bill.value._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Invoice_${bill.value.bno}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('PDF download failed:', err);
  }
}

function printBill() {
  window.print();
}
</script>
