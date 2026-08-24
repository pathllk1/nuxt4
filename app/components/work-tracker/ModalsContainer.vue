<script setup lang="ts">
import { useWorkTracker } from '~/composables/useWorkTracker';
import { WorkTrackerExcelExporter } from '~/utils/work-tracker-excel';
import { ADJUSTMENT_TYPES, WALLET_TYPES, BILLING_TYPES, DEFAULT_EXPENSE_CATEGORIES } from '~/types/work-tracker';

const state = useWorkTracker();

const exportClientLedgerExcel = () => {
  if (!state.selectedClientLedger.value) return;
  const { client, summary, timeline } = state.selectedClientLedger.value;
  WorkTrackerExcelExporter.exportClientLedger(client, summary, timeline);
};
</script>

<template>
  <div class="font-sans text-xs">
    <!-- 1. Record Client Payment Modal -->
    <div v-if="state.paymentModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.paymentForm.id ? 'Edit Payment' : 'Record Client Payment' }}
          </h3>
          <button @click="state.paymentModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CLIENT *</label>
            <select
              v-model="state.paymentForm.clientId"
              @change="state.onPaymentClientChange()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            >
              <option :value="0" disabled>Select Client</option>
              <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">SELECT WORK ENTRY *</label>
            <select
              v-model="state.paymentForm.workId"
              @change="state.onPaymentWorkChange()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            >
              <option :value="0">Account Deposit / No Specific Work</option>
              <option v-for="w in state.filterClientWorks(state.paymentForm.clientId)" :key="w.id" :value="w.id">
                {{ w.workType }}{{ w.description ? ' - ' + w.description : '' }} (Outstanding: ₹{{ w.pendingAmount || 0 }})
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAYMENT DATE *</label>
              <input
                v-model="state.paymentForm.date"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">AMOUNT RECEIVED (₹) *</label>
              <input
                v-model.number="state.paymentForm.amount"
                type="number"
                placeholder="500"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAYMENT TYPE *</label>
              <select
                v-model="state.paymentForm.paymentType"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option value="Full">Full</option>
                <option value="Partial">Partial</option>
                <option value="Advance">Advance</option>
                <option value="Settlement">Settlement</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">METHOD *</label>
              <select
                v-model="state.paymentForm.method"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="m in state.getPaymentMethodsList()" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">REFERENCE / TX ID</label>
              <input
                v-model="state.paymentForm.reference"
                type="text"
                placeholder="UPI transaction ID..."
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DEPOSIT TO VAULT</label>
              <select
                v-model="state.paymentForm.walletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">NOTE</label>
            <input
              v-model="state.paymentForm.note"
              type="text"
              placeholder="Any remarks..."
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.paymentModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.savePayment()"
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Payment
          </button>
        </div>
      </div>
    </div>

    <!-- 2. Bulk Client Settlement Modal -->
    <div v-if="state.bulkSettlementModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">Bulk Client Settlement</h3>
          <button @click="state.bulkSettlementModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CLIENT *</label>
            <select
              v-model="state.bulkSettlementForm.clientId"
              @change="state.onBulkClientChange()"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            >
              <option :value="0" disabled>Select Client</option>
              <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAYMENT DATE *</label>
              <input
                v-model="state.bulkSettlementForm.date"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">TOTAL AMOUNT (₹) *</label>
              <input
                v-model.number="state.bulkSettlementForm.amount"
                type="number"
                placeholder="0"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">METHOD</label>
              <select
                v-model="state.bulkSettlementForm.method"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="m in state.getPaymentMethodsList()" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DEPOSIT VAULT</label>
              <select
                v-model="state.bulkSettlementForm.walletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">SELECT WORKS TO SETTLE</label>
            <div class="space-y-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-2 bg-gray-50">
              <div
                v-for="item in state.bulkSettlementForm.selectedWorks"
                :key="item.id"
                class="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 text-xs font-bold"
              >
                <label class="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                  <input
                    v-model="item.checked"
                    type="checkbox"
                    @change="state.recalculateBulkTotalPending()"
                    class="rounded text-blue-600 cursor-pointer"
                  />
                  <span class="truncate text-gray-800">{{ item.title }}</span>
                </label>
                <span class="text-xs font-mono font-black text-amber-600 shrink-0 ml-2">₹{{ item.pending }}</span>
              </div>
              <div v-if="state.bulkSettlementForm.selectedWorks.length === 0" class="text-center py-4 text-gray-400 text-[10px]">
                No outstanding work orders for this client.
              </div>
            </div>
          </div>

          <!-- Allocation Preview -->
          <div v-if="state.bulkAllocations.value.length > 0" class="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 space-y-1">
            <span class="text-[9px] font-black uppercase tracking-wider text-indigo-700 block mb-1">Auto-Allocation Summary:</span>
            <div
              v-for="alloc in state.bulkAllocations.value"
              :key="alloc.workId"
              class="flex items-center justify-between text-[11px] font-mono"
            >
              <span class="text-gray-700 font-sans truncate mr-2">{{ alloc.title }}</span>
              <span class="font-black text-emerald-600 shrink-0">₹{{ alloc.allocated }}</span>
            </div>
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.bulkSettlementModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.submitBulkSettlement()"
            class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Execute Bulk Settle
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Add/Edit Work Order Modal -->
    <div v-if="state.workModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.workForm.id ? 'Edit Work Order' : 'Create Work Order' }}
          </h3>
          <button @click="state.workModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CLIENT *</label>
            <select
              v-model="state.workForm.clientId"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            >
              <option :value="0" disabled>Select Client</option>
              <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">WORK TYPE *</label>
            <select
              v-model="state.workForm.workType"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            >
              <option v-for="t in state.getWorkTypesList()" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">ASSIGNED DATE *</label>
              <input
                v-model="state.workForm.dateAssigned"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CONTRACT AMOUNT (₹)</label>
              <input
                v-model="state.workForm.totalAmount"
                type="number"
                placeholder="Leave blank if TBD"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DESCRIPTION</label>
            <input
              v-model="state.workForm.description"
              type="text"
              placeholder="e.g. October GST & Bank reconciliation"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">SUBMITTED DATE (COMPLETED)</label>
            <input
              v-model="state.workForm.dateSubmitted"
              type="date"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.workModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveWork()"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Work Order
          </button>
        </div>
      </div>
    </div>

    <!-- 4. Add/Edit Expense Modal -->
    <div v-if="state.expenseModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.expenseForm.id ? 'Edit Expense' : 'Record Operational Expense' }}
          </h3>
          <button @click="state.expenseModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DATE *</label>
              <input
                v-model="state.expenseForm.date"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">AMOUNT (₹) *</label>
              <input
                v-model.number="state.expenseForm.amount"
                type="number"
                placeholder="250"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CATEGORY *</label>
              <select
                v-model="state.expenseForm.categoryId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="c in [...DEFAULT_EXPENSE_CATEGORIES, ...state.customExpenseCategories.value]" :key="c.id" :value="c.id">
                  {{ c.icon }} {{ c.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAID FROM VAULT *</label>
              <select
                v-model="state.expenseForm.walletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PAID TO (VENDOR / PAYEE)</label>
            <input
              v-model="state.expenseForm.paidTo"
              type="text"
              placeholder="e.g. Office Stationery Mart"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DESCRIPTION</label>
            <input
              v-model="state.expenseForm.description"
              type="text"
              placeholder="e.g. Printer ink and A4 paper boxes"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.expenseModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveExpense()"
            class="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Expense
          </button>
        </div>
      </div>
    </div>

    <!-- 5. Add/Edit Direct Receipt Modal -->
    <div v-if="state.receiptModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.receiptForm.id ? 'Edit Receipt' : 'New Direct Income Receipt' }}
          </h3>
          <button @click="state.receiptModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DATE *</label>
              <input
                v-model="state.receiptForm.date"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">AMOUNT (₹) *</label>
              <input
                v-model.number="state.receiptForm.amount"
                type="number"
                placeholder="1000"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CATEGORY</label>
              <input
                v-model="state.receiptForm.category"
                type="text"
                placeholder="Direct Income / Interest"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DEPOSIT TO VAULT *</label>
              <select
                v-model="state.receiptForm.walletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">RECEIVED FROM (PAYER)</label>
            <input
              v-model="state.receiptForm.receivedFrom"
              type="text"
              placeholder="e.g. Bank Interest or Scrap Sale"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">REFERENCE / NOTES</label>
            <input
              v-model="state.receiptForm.notes"
              type="text"
              placeholder="Transaction notes..."
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.receiptModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveReceipt()"
            class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Receipt
          </button>
        </div>
      </div>
    </div>

    <!-- 6. Add/Edit Client Modal -->
    <div v-if="state.clientModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.clientForm.id ? 'Edit Client' : 'Add New Client' }}
          </h3>
          <button @click="state.clientModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CLIENT / FIRM NAME *</label>
            <input
              v-model="state.clientForm.name"
              type="text"
              placeholder="e.g. Apex Corporation"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">PHONE NUMBER</label>
              <input
                v-model="state.clientForm.phone"
                type="text"
                placeholder="9876543210"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">EMAIL ADDRESS</label>
              <input
                v-model="state.clientForm.email"
                type="email"
                placeholder="accounts@apex.com"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">BILLING TYPE</label>
              <select
                v-model="state.clientForm.billingType"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="b in BILLING_TYPES" :key="b.value" :value="b.value">{{ b.icon }} {{ b.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">MONTHLY RATE (₹)</label>
              <input
                v-model="state.clientForm.monthlyRate"
                type="number"
                placeholder="Optional fixed rate"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">NOTES</label>
            <input
              v-model="state.clientForm.notes"
              type="text"
              placeholder="Terms, GSTIN, or billing notes..."
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.clientModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveClient()"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Client
          </button>
        </div>
      </div>
    </div>

    <!-- 7. Inter-Vault Transfer Modal -->
    <div v-if="state.transferModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">Inter-Vault Fund Transfer</h3>
          <button @click="state.transferModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">FROM VAULT *</label>
              <select
                v-model="state.transferForm.fromWalletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">TO VAULT *</label>
              <select
                v-model="state.transferForm.toWalletId"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="w in state.wallets.value" :key="w.id" :value="w.id">{{ w.name }}</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">TRANSFER DATE *</label>
              <input
                v-model="state.transferForm.date"
                type="date"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">AMOUNT (₹) *</label>
              <input
                v-model.number="state.transferForm.amount"
                type="number"
                placeholder="5000"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>

          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">MEMO / PURPOSE</label>
            <input
              v-model="state.transferForm.note"
              type="text"
              placeholder="e.g. Cash withdrawal from bank for petty cash"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.transferModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveTransfer()"
            class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Execute Transfer
          </button>
        </div>
      </div>
    </div>

    <!-- 8. Add/Edit Vault Modal -->
    <div v-if="state.walletModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.walletForm.id ? 'Edit Vault' : 'New Vault / Account' }}
          </h3>
          <button @click="state.walletModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>

        <div class="p-5 space-y-3.5">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">VAULT NAME *</label>
            <input
              v-model="state.walletForm.name"
              type="text"
              placeholder="e.g. ICICI Current A/c"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">ACCOUNT TYPE</label>
              <select
                v-model="state.walletForm.type"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none"
              >
                <option v-for="t in WALLET_TYPES" :key="t.value" :value="t.value">{{ t.icon }} {{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">INITIAL BALANCE (₹)</label>
              <input
                v-model.number="state.walletForm.initialBalance"
                type="number"
                placeholder="0"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
              />
            </div>
          </div>
        </div>

        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2.5">
          <button
            @click="state.walletModalOpen.value = false"
            class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition border-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="state.saveWallet()"
            class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition border-0 cursor-pointer shadow-xs"
          >
            Save Vault
          </button>
        </div>
      </div>
    </div>

    <!-- 9. Set Amount Modal -->
    <div v-if="state.setAmountModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">Set Contract Amount</h3>
          <button @click="state.setAmountModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 space-y-3">
          <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block">FINAL CONTRACT VALUE (₹) *</label>
          <input
            v-model.number="state.setAmountForm.amount"
            type="number"
            placeholder="5000"
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none"
          />
        </div>
        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button @click="state.setAmountModalOpen.value = false" class="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border-0 cursor-pointer">Cancel</button>
          <button @click="state.saveSetAmount()" class="px-5 py-2 bg-blue-600 text-white font-black rounded-xl text-xs border-0 cursor-pointer">Update Amount</button>
        </div>
      </div>
    </div>

    <!-- 10. Adjustment Modal (Discount / Penalty) -->
    <div v-if="state.adjustmentModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">Add Adjustment / Discount</h3>
          <button @click="state.adjustmentModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">TYPE *</label>
              <select v-model="state.adjustmentForm.type" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none">
                <option v-for="a in ADJUSTMENT_TYPES" :key="a.value" :value="a.value">{{ a.icon }} {{ a.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">AMOUNT (₹) *</label>
              <input v-model.number="state.adjustmentForm.amount" type="number" placeholder="200" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none" />
            </div>
          </div>
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DATE *</label>
            <input v-model="state.adjustmentForm.date" type="date" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none" />
          </div>
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">REASON</label>
            <input v-model="state.adjustmentForm.reason" type="text" placeholder="e.g. Goodwill discount or late fee" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none" />
          </div>
        </div>
        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button @click="state.adjustmentModalOpen.value = false" class="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border-0 cursor-pointer">Cancel</button>
          <button @click="state.saveAdjustment()" class="px-5 py-2 bg-amber-600 text-white font-black rounded-xl text-xs border-0 cursor-pointer">Save Adjustment</button>
        </div>
      </div>
    </div>

    <!-- 11. Work Detail Modal -->
    <div v-if="state.workDetailModalOpen.value && state.selectedWorkDetail.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <span class="text-[9px] font-mono text-gray-400 uppercase">Work Order #{{ state.selectedWorkDetail.value.id }}</span>
            <h3 class="text-sm font-black text-gray-900">{{ state.selectedWorkDetail.value.workType }}</h3>
          </div>
          <button @click="state.workDetailModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 space-y-3 overflow-y-auto custom-scrollbar flex-1">
          <div class="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 text-center font-mono">
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Contract Value</span>
              <span class="text-xs font-black text-gray-900">₹{{ (state.selectedWorkDetail.value.effectiveAmount || state.selectedWorkDetail.value.totalAmount || 0).toLocaleString('en-IN') }}</span>
            </div>
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Paid</span>
              <span class="text-xs font-black text-emerald-600">₹{{ (state.selectedWorkDetail.value.totalPaid || 0).toLocaleString('en-IN') }}</span>
            </div>
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Pending Dues</span>
              <span class="text-xs font-black text-amber-600">₹{{ (state.selectedWorkDetail.value.pendingAmount || 0).toLocaleString('en-IN') }}</span>
            </div>
          </div>
          <div class="space-y-1">
            <span class="text-[9px] text-gray-400 uppercase font-black">Client</span>
            <p class="text-xs font-bold text-gray-800">{{ state.selectedWorkDetail.value.clientName }}</p>
          </div>
          <div v-if="state.selectedWorkDetail.value.description" class="space-y-1">
            <span class="text-[9px] text-gray-400 uppercase font-black">Description</span>
            <p class="text-xs text-gray-700">{{ state.selectedWorkDetail.value.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 12. Client Statement / Ledger Drawer -->
    <div v-if="state.clientLedgerModalOpen.value && state.selectedClientLedger.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-black text-gray-900 tracking-tight">{{ state.selectedClientLedger.value.client.name }} — Statement of Account</h3>
            <span class="text-[9px] text-gray-400 font-mono">Billed: ₹{{ state.selectedClientLedger.value.summary.totalBilled }} | Paid: ₹{{ state.selectedClientLedger.value.summary.totalPaid }} | Dues: ₹{{ state.selectedClientLedger.value.summary.outstanding }}</span>
          </div>
          <div class="flex items-center gap-2">
            <button @click="exportClientLedgerExcel" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold cursor-pointer">
              📥 Excel
            </button>
            <button @click="state.clientLedgerModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
          </div>
        </div>
        <div class="p-5 overflow-y-auto custom-scrollbar flex-1">
          <table class="w-full text-left text-xs border-collapse font-bold">
            <thead class="bg-gray-50 border-b border-gray-200 text-[9px] uppercase text-gray-500 font-black">
              <tr>
                <th class="p-2 w-24">Date</th>
                <th class="p-2">Description</th>
                <th class="p-2 text-right w-24">Debit (₹)</th>
                <th class="p-2 text-right w-24">Credit (₹)</th>
                <th class="p-2 text-right w-24">Balance (₹)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono">
              <tr v-for="item in state.selectedClientLedger.value.timeline" :key="item.id" class="hover:bg-gray-50">
                <td class="p-2 text-gray-500 font-sans">{{ item.date }}</td>
                <td class="p-2 text-gray-800 font-sans">{{ item.description }}</td>
                <td class="p-2 text-right text-rose-600">{{ item.debit ? '₹' + item.debit : '—' }}</td>
                <td class="p-2 text-right text-emerald-600">{{ item.credit ? '₹' + item.credit : '—' }}</td>
                <td class="p-2 text-right text-gray-900">₹{{ item.runningBalance }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 13. Vault Details & Transaction Ledger -->
    <div v-if="state.walletDetailModalOpen.value && state.selectedWalletDetail.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 class="text-sm font-black text-gray-900 tracking-tight">{{ state.selectedWalletDetail.value.wallet.name }} — Running Ledger</h3>
            <span class="text-[9px] text-emerald-600 font-black font-mono">Current Balance: ₹{{ state.selectedWalletDetail.value.wallet.currentBalance }}</span>
          </div>
          <button @click="state.walletDetailModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 overflow-y-auto custom-scrollbar flex-1">
          <table class="w-full text-left text-xs border-collapse font-bold">
            <thead class="bg-gray-50 border-b border-gray-200 text-[9px] uppercase text-gray-500 font-black">
              <tr>
                <th class="p-2 w-24">Date</th>
                <th class="p-2 w-28">Type</th>
                <th class="p-2">Party / Memo</th>
                <th class="p-2 text-right w-24">Inflow (₹)</th>
                <th class="p-2 text-right w-24">Outflow (₹)</th>
                <th class="p-2 text-right w-24">Balance (₹)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 font-mono">
              <tr v-for="(t, idx) in state.selectedWalletDetail.value.transactions" :key="idx" class="hover:bg-gray-50">
                <td class="p-2 text-gray-500 font-sans">{{ t.date }}</td>
                <td class="p-2 text-gray-700 font-sans text-[10px]">{{ t.typeLabel }}</td>
                <td class="p-2 text-gray-800 font-sans">
                  <div>{{ t.party }}</div>
                  <div class="text-[9px] text-gray-400 font-normal">{{ t.description }}</div>
                </td>
                <td class="p-2 text-right text-emerald-600">{{ t.inflow ? '₹' + t.inflow : '—' }}</td>
                <td class="p-2 text-right text-rose-600">{{ t.outflow ? '₹' + t.outflow : '—' }}</td>
                <td class="p-2 text-right text-gray-900">₹{{ t.runningBalance }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 14. Add/Edit Template Modal -->
    <div v-if="state.templateModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">
            {{ state.templateForm.id ? 'Edit Template' : 'New Recurring Retainer Template' }}
          </h3>
          <button @click="state.templateModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 space-y-3.5">
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CLIENT *</label>
            <select v-model="state.templateForm.clientId" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none">
              <option v-for="c in state.clients.value" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">WORK TYPE *</label>
            <select v-model="state.templateForm.workType" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none">
              <option v-for="t in state.getWorkTypesList()" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">FIXED AMOUNT (₹) *</label>
              <input v-model.number="state.templateForm.fixedAmount" type="number" placeholder="5000" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none" />
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">FREQUENCY</label>
              <select v-model="state.templateForm.frequency" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none">
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">DESCRIPTION</label>
            <input v-model="state.templateForm.description" type="text" placeholder="Monthly retainer bookkeeping..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none" />
          </div>
        </div>
        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button @click="state.templateModalOpen.value = false" class="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border-0 cursor-pointer">Cancel</button>
          <button @click="state.saveTemplate()" class="px-5 py-2 bg-blue-600 text-white font-black rounded-xl text-xs border-0 cursor-pointer">Save Template</button>
        </div>
      </div>
    </div>

    <!-- 15. Set Budget Modal -->
    <div v-if="state.budgetModalOpen.value" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-xs">
      <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full overflow-hidden flex flex-col">
        <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 class="text-sm font-black text-gray-900 tracking-tight">Set Category Spending Budget</h3>
          <button @click="state.budgetModalOpen.value = false" class="text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-base">✕</button>
        </div>
        <div class="p-5 space-y-3.5">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">CATEGORY *</label>
              <select v-model="state.budgetForm.categoryId" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none">
                <option v-for="c in [...DEFAULT_EXPENSE_CATEGORIES, ...state.customExpenseCategories.value]" :key="c.id" :value="c.id">
                  {{ c.icon }} {{ c.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">MONTH *</label>
              <input v-model="state.budgetForm.month" type="month" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold outline-none" />
            </div>
          </div>
          <div>
            <label class="text-[9px] font-black uppercase text-gray-400 tracking-wider block mb-1">LIMIT AMOUNT (₹) *</label>
            <input v-model.number="state.budgetForm.limitAmount" type="number" placeholder="10000" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono font-black outline-none" />
          </div>
        </div>
        <div class="px-5 py-3.5 bg-gray-50/50 border-t border-gray-100 flex items-center justify-end gap-2">
          <button @click="state.budgetModalOpen.value = false" class="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border-0 cursor-pointer">Cancel</button>
          <button @click="state.saveBudget()" class="px-5 py-2 bg-blue-600 text-white font-black rounded-xl text-xs border-0 cursor-pointer">Set Budget Cap</button>
        </div>
      </div>
    </div>
  </div>
</template>
