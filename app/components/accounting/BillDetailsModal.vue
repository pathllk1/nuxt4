<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: boolean;
  bill: any;
}>();

const emit = defineEmits(['update:modelValue', 'cancel-bill']);

const printInvoice = () => {
  window.print();
};
</script>

<template>
  <div v-if="modelValue && bill" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in print:p-0 print:bg-white print:static">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:w-full print:rounded-none">
      <header class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-8 py-5 text-white flex justify-between items-center shrink-0 print:hidden">
        <div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest" :class="bill.status === 'CANCELLED' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'">
            {{ bill.status || 'ACTIVE' }}
          </span>
          <h2 class="text-xl font-black uppercase tracking-tight mt-1">{{ bill.btype }} #{{ bill.bno }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <button @click="printInvoice" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print Invoice
          </button>
          <button @click="$emit('update:modelValue', false)" class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-colors">
            ✕
          </button>
        </div>
      </header>

      <div class="p-8 overflow-y-auto flex-1 space-y-6 text-xs text-slate-800 dark:text-zinc-200 print:p-0">
        <!-- Banner if cancelled -->
        <div v-if="bill.status === 'CANCELLED'" class="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-3 text-red-700 dark:text-red-300 print:hidden">
          <svg class="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          <div>
            <h4 class="font-bold text-sm">Invoice Cancelled</h4>
            <p class="text-xs opacity-90">{{ bill.cancellationReason || 'This bill has been cancelled and reversed from ledger accounts.' }}</p>
          </div>
        </div>

        <!-- Header Info Grid -->
        <div class="grid grid-cols-2 gap-6 pb-6 border-b border-slate-200 dark:border-zinc-800">
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Billed To (Customer)</p>
            <h3 class="text-base font-black text-slate-900 dark:text-white">{{ bill.partyName }}</h3>
            <p class="font-mono text-indigo-600 dark:text-indigo-400 font-bold mt-1">GSTIN: {{ bill.partyGstin || 'UNREGISTERED' }}</p>
            <p class="text-slate-500 mt-1">{{ bill.partyAddress || 'No address provided' }}</p>
            <p class="text-slate-500">State: {{ bill.partyState || '-' }} (Code: {{ bill.partyStateCode || '-' }})</p>
          </div>
          <div class="text-right space-y-1">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Document Details</p>
            <p class="font-bold text-slate-900 dark:text-white">Date: <span class="font-mono">{{ bill.bdate }}</span></p>
            <p class="font-bold text-slate-900 dark:text-white">Voucher Ref: <span class="font-mono">#{{ bill.voucherId }}</span></p>
            <p v-if="bill.supplierBillNo" class="font-bold text-slate-900 dark:text-white">Supplier Bill No: <span class="font-mono">{{ bill.supplierBillNo }}</span></p>
            <p class="font-bold text-slate-900 dark:text-white">Type: <span class="uppercase">{{ bill.billSubtype || bill.btype }}</span></p>
          </div>
        </div>

        <!-- Line Items Table -->
        <div class="overflow-hidden rounded-2xl border border-slate-200 dark:border-zinc-800">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold text-[10px] uppercase">
                <th class="py-3 px-4">#</th>
                <th class="py-3 px-4">Item</th>
                <th class="py-3 px-4">HSN</th>
                <th class="py-3 px-4 text-right">Qty</th>
                <th class="py-3 px-4 text-right">Rate</th>
                <th class="py-3 px-4 text-right">Disc %</th>
                <th class="py-3 px-4 text-right">Taxable</th>
                <th class="py-3 px-4 text-right">GST</th>
                <th class="py-3 px-4 text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-zinc-800 font-semibold">
              <tr v-for="(item, idx) in bill.items" :key="idx">
                <td class="py-3 px-4 text-slate-400 font-mono text-[10px]">{{ idx + 1 }}</td>
                <td class="py-3 px-4 font-bold">{{ item.item }}</td>
                <td class="py-3 px-4 font-mono text-[11px]">{{ item.hsn || '-' }}</td>
                <td class="py-3 px-4 text-right font-mono">{{ item.qty }} {{ item.uom || 'PCS' }}</td>
                <td class="py-3 px-4 text-right font-mono">₹{{ item.rate }}</td>
                <td class="py-3 px-4 text-right font-mono">{{ item.disc || 0 }}%</td>
                <td class="py-3 px-4 text-right font-mono">₹{{ (item.total || 0).toFixed(2) }}</td>
                <td class="py-3 px-4 text-right font-mono">₹{{ ((item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)).toFixed(2) }}</td>
                <td class="py-3 px-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  ₹{{ ((item.total || 0) + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0)).toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Totals Summary Grid -->
        <div class="flex justify-end">
          <div class="w-full max-w-sm space-y-2 pt-2 text-xs">
            <div class="flex justify-between text-slate-600 dark:text-zinc-400 font-semibold">
              <span>Gross Taxable Total</span>
              <span class="font-mono text-slate-900 dark:text-white">₹{{ (bill.grossTotal || 0).toFixed(2) }}</span>
            </div>
            <div v-if="bill.cgst > 0" class="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>CGST</span>
              <span class="font-mono">₹{{ bill.cgst.toFixed(2) }}</span>
            </div>
            <div v-if="bill.sgst > 0" class="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>SGST</span>
              <span class="font-mono">₹{{ bill.sgst.toFixed(2) }}</span>
            </div>
            <div v-if="bill.igst > 0" class="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>IGST</span>
              <span class="font-mono">₹{{ bill.igst.toFixed(2) }}</span>
            </div>
            <div v-if="bill.roundOff" class="flex justify-between text-slate-500 font-semibold">
              <span>Round Off</span>
              <span class="font-mono">{{ bill.roundOff >= 0 ? '+' : '' }}{{ bill.roundOff.toFixed(2) }}</span>
            </div>
            <div class="flex justify-between items-center text-base font-black pt-3 border-t-2 border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-white">
              <span>Net Total Amount</span>
              <span class="font-mono text-xl text-indigo-600 dark:text-indigo-400">₹{{ (bill.netTotal || 0).toLocaleString('en-IN') }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
