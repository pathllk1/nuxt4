<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { SAC_DICTIONARY, type AccountingCartItem, type COAAccount } from '@/composables/useAccountingInvoiceState';

const props = defineProps<{
  cart: AccountingCartItem[];
  billType?: string;
  filterType?: 'INCOME' | 'EXPENSE';
}>();

const emit = defineEmits<{
  'add-item': [account?: COAAccount];
  'remove-item': [index: number];
  'update-item': [index: number, field: keyof AccountingCartItem, value: any];
  'open-ledger-modal': [];
}>();

const tableWrapRef = ref<HTMLElement | null>(null);

function calculateLineTax(item: AccountingCartItem): number {
  const amt = parseFloat(String(item.amount)) || 0;
  const rate = parseFloat(String(item.gstRate)) || 0;
  return (amt * rate) / 100;
}

function calculateLineTotal(item: AccountingCartItem): number {
  const amt = parseFloat(String(item.amount)) || 0;
  return amt + calculateLineTax(item);
}

function onSacInput(idx: number, sacVal: string) {
  emit('update-item', idx, 'sacCode', sacVal);
  const trimmed = sacVal.trim();
  if (trimmed.length >= 4) {
    const entry = Object.values(SAC_DICTIONARY).find(d => d.sac === trimmed);
    if (entry) {
      if (!props.cart[idx]?.description || props.cart[idx]?.description === props.cart[idx]?.ledgerAccountHead) {
        emit('update-item', idx, 'description', entry.description);
      }
      if (props.cart[idx]?.gstRate === 0 || props.cart[idx]?.gstRate === 18) {
        emit('update-item', idx, 'gstRate', entry.gstRate);
      }
    }
  }
}

// ─── Cell Keyboard Navigation ───
const rowFieldOrder = ['sacCode', 'description', 'amount', 'gstRate', 'narration'];

function onCellEnter(e: KeyboardEvent, rowIndex: number, field: string) {
  e.preventDefault();
  e.stopPropagation();
  const currentIdx = rowFieldOrder.indexOf(field);

  if (currentIdx < rowFieldOrder.length - 1) {
    // Advance to next field in the same row
    const nextField = rowFieldOrder[currentIdx + 1];
    focusCell(rowIndex, nextField!);
  } else {
    // Last field of the row (narration)
    if (rowIndex < props.cart.length - 1) {
      // Advance to next row's SAC
      focusCell(rowIndex + 1, 'sacCode');
    } else {
      // Last cell of last row — trigger ledger modal to add next account head
      setTimeout(() => {
        emit('open-ledger-modal');
      }, 50);
    }
  }
}

function onCellBackspace(e: KeyboardEvent, rowIndex: number, field: string) {
  const target = e.target as HTMLInputElement;
  if (!target) return;

  // If input is empty or selection is at start
  if (target.value === '' || (target.selectionStart === 0 && target.selectionEnd === 0)) {
    const currentIdx = rowFieldOrder.indexOf(field);
    if (currentIdx > 0) {
      e.preventDefault();
      e.stopPropagation();
      const prevField = rowFieldOrder[currentIdx - 1];
      focusCell(rowIndex, prevField!);
    } else if (rowIndex > 0) {
      e.preventDefault();
      e.stopPropagation();
      focusCell(rowIndex - 1, rowFieldOrder[rowFieldOrder.length - 1]!);
    }
  }
}

function onCellArrowDown(e: KeyboardEvent, rowIndex: number, field: string) {
  if (rowIndex < props.cart.length - 1) {
    e.preventDefault();
    e.stopPropagation();
    focusCell(rowIndex + 1, field);
  }
}

function onCellArrowUp(e: KeyboardEvent, rowIndex: number, field: string) {
  if (rowIndex > 0) {
    e.preventDefault();
    e.stopPropagation();
    focusCell(rowIndex - 1, field);
  }
}

function onRowDelete(e: KeyboardEvent, rowIndex: number) {
  if (e.key === 'Delete' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
    e.preventDefault();
    e.stopPropagation();
    emit('remove-item', rowIndex);
    nextTick(() => {
      if (props.cart.length > 0) {
        const targetIndex = Math.min(rowIndex, props.cart.length - 1);
        focusCell(targetIndex, 'sacCode');
      } else {
        const emptyBtn = tableWrapRef.value?.querySelector('.acct-cart-empty-btn') as HTMLElement;
        emptyBtn?.focus();
      }
    });
  } else if (e.key === 'F2') {
    e.preventDefault();
    e.stopPropagation();
    emit('open-ledger-modal');
  }
}

function focusCell(rowIndex: number, field: string = 'sacCode') {
  nextTick(() => {
    const rowEl = tableWrapRef.value?.querySelector(`tr[data-row="${rowIndex}"]`);
    if (!rowEl) return;
    const input = rowEl.querySelector(`input[data-field="${field}"]`) as HTMLInputElement;
    if (input) {
      input.focus();
      input.select?.();
    }
  });
}

defineExpose({
  focusRowSac: (rowIndex: number) => focusCell(rowIndex, 'sacCode'),
  focusRowAmount: (rowIndex: number) => focusCell(rowIndex, 'amount'),
  focusCell
});
</script>

<template>
  <div ref="tableWrapRef" class="cart-container space-y-2">
    <!-- Header Action Bar -->
    <div class="flex items-center justify-between px-1">
      <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
        Ledger Particulars
        <span v-if="cart.length > 0" class="ml-1 text-slate-400 dark:text-zinc-500">({{ cart.length }} {{ cart.length === 1 ? 'entry' : 'entries' }})</span>
      </h3>
      <div class="flex items-center gap-3">
        <span class="text-[9px] text-slate-400 hidden sm:inline">
          <kbd class="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[9px] font-bold">Enter</kbd> Next • 
          <kbd class="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[9px] font-bold">Del</kbd> Remove • 
          <kbd class="px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-mono text-[9px] font-bold">F2</kbd> Add Account
        </span>
        <button
          v-if="cart.length > 0"
          type="button"
          @click="emit('open-ledger-modal')"
          class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors cursor-pointer flex items-center gap-1"
        >
          <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
          <span>+ Add Account (F2)</span>
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div 
      v-if="cart.length === 0" 
      class="flex flex-col items-center justify-center py-12 bg-slate-50/60 dark:bg-zinc-800/30 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl space-y-3"
    >
      <div class="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
        <UIcon name="i-heroicons-document-text" class="w-7 h-7 text-emerald-500" />
      </div>
      <div class="text-center space-y-1">
        <p class="text-xs font-bold text-slate-600 dark:text-zinc-300">No ledger entries yet</p>
        <p class="text-[10px] text-slate-400 dark:text-zinc-500">Press <kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">F2</kbd> or <kbd class="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-zinc-700 text-[9px] font-bold">Enter</kbd> to add an account head</p>
      </div>
      <button
        type="button"
        class="acct-cart-empty-btn px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors cursor-pointer shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900 flex items-center gap-1.5"
        @click="emit('open-ledger-modal')"
        @keydown.enter.prevent.stop="emit('open-ledger-modal')"
      >
        <UIcon name="i-heroicons-plus-circle" class="w-4 h-4" />
        <span>+ Add Ledger Entry (F2)</span>
      </button>
    </div>

    <!-- High-Performance Zero-Mouse Data Grid -->
    <div v-else class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr class="bg-slate-50 dark:bg-zinc-800/80 border-b border-slate-200 dark:border-zinc-700 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400 select-none">
              <th class="px-3 py-2.5 w-10 text-center">#</th>
              <th class="px-3 py-2.5 min-w-[200px]">Particulars (Account Head)</th>
              <th class="px-2 py-2.5 w-24">SAC Code</th>
              <th class="px-2 py-2.5 min-w-[160px]">Service Description</th>
              <th class="px-2 py-2.5 w-28 text-right">Amount (₹)</th>
              <th class="px-2 py-2.5 w-20 text-right">GST %</th>
              <th class="px-3 py-2.5 w-24 text-right">Tax (₹)</th>
              <th class="px-3 py-2.5 w-28 text-right">Net Total</th>
              <th class="px-2 py-2.5 min-w-[140px]">Note</th>
              <th class="px-2 py-2.5 w-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
            <tr
              v-for="(item, idx) in cart"
              :key="item.id || idx"
              :data-row="idx"
              class="hover:bg-slate-50/70 dark:hover:bg-zinc-800/40 focus-within:bg-blue-50/40 dark:focus-within:bg-blue-950/20 transition-colors"
            >
              <!-- Row Index -->
              <td class="px-3 py-1.5 text-center text-[10px] font-mono font-bold text-slate-400 dark:text-zinc-500 select-none">
                {{ idx + 1 }}
              </td>

              <!-- Particulars Account Head -->
              <td class="px-3 py-1.5">
                <div class="flex items-center gap-1.5">
                  <span class="font-black text-slate-800 dark:text-white truncate text-xs">{{ item.ledgerAccountHead }}</span>
                  <span v-if="item.ledgerAccountType" class="text-[8px] font-bold px-1.5 py-0.2 rounded uppercase bg-slate-100 dark:bg-zinc-800 text-slate-500 shrink-0">
                    {{ item.ledgerAccountType.replace(/_/g, ' ') }}
                  </span>
                </div>
              </td>

              <!-- SAC Code Input -->
              <td class="px-2 py-1.5">
                <input
                  :value="item.sacCode"
                  data-field="sacCode"
                  type="text"
                  maxlength="6"
                  placeholder="SAC"
                  class="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-md font-mono font-bold text-[11px] outline-none text-slate-800 dark:text-zinc-100 transition-all"
                  @input="onSacInput(idx, ($event.target as HTMLInputElement).value)"
                  @keydown.enter="onCellEnter($event, idx, 'sacCode')"
                  @keydown.backspace="onCellBackspace($event, idx, 'sacCode')"
                  @keydown.down="onCellArrowDown($event, idx, 'sacCode')"
                  @keydown.up="onCellArrowUp($event, idx, 'sacCode')"
                  @keydown="onRowDelete($event, idx)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>

              <!-- Description Input -->
              <td class="px-2 py-1.5">
                <input
                  :value="item.description"
                  data-field="description"
                  type="text"
                  placeholder="Service description"
                  class="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-md text-xs outline-none text-slate-800 dark:text-zinc-100 transition-all font-medium"
                  @input="emit('update-item', idx, 'description', ($event.target as HTMLInputElement).value)"
                  @keydown.enter="onCellEnter($event, idx, 'description')"
                  @keydown.backspace="onCellBackspace($event, idx, 'description')"
                  @keydown.down="onCellArrowDown($event, idx, 'description')"
                  @keydown.up="onCellArrowUp($event, idx, 'description')"
                  @keydown="onRowDelete($event, idx)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>

              <!-- Amount Input -->
              <td class="px-2 py-1.5">
                <input
                  :value="item.amount || ''"
                  data-field="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  class="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-md font-mono font-black text-xs text-right outline-none text-slate-900 dark:text-white transition-all"
                  @input="emit('update-item', idx, 'amount', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                  @keydown.enter="onCellEnter($event, idx, 'amount')"
                  @keydown.backspace="onCellBackspace($event, idx, 'amount')"
                  @keydown.down="onCellArrowDown($event, idx, 'amount')"
                  @keydown.up="onCellArrowUp($event, idx, 'amount')"
                  @keydown="onRowDelete($event, idx)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>

              <!-- GST Rate Input -->
              <td class="px-2 py-1.5">
                <input
                  :value="item.gstRate ?? 18"
                  data-field="gstRate"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="18"
                  class="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-md font-mono font-bold text-xs text-right outline-none text-slate-800 dark:text-zinc-100 transition-all"
                  @input="emit('update-item', idx, 'gstRate', parseFloat(($event.target as HTMLInputElement).value) || 0)"
                  @keydown.enter="onCellEnter($event, idx, 'gstRate')"
                  @keydown.backspace="onCellBackspace($event, idx, 'gstRate')"
                  @keydown.down="onCellArrowDown($event, idx, 'gstRate')"
                  @keydown.up="onCellArrowUp($event, idx, 'gstRate')"
                  @keydown="onRowDelete($event, idx)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>

              <!-- Calculated Tax -->
              <td class="px-3 py-1.5 text-right font-mono font-bold text-[11px] text-slate-500 dark:text-zinc-400 select-none">
                ₹{{ calculateLineTax(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Line Total -->
              <td class="px-3 py-1.5 text-right font-mono font-black text-xs text-slate-900 dark:text-white select-none">
                ₹{{ calculateLineTotal(item).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </td>

              <!-- Narration Note Input -->
              <td class="px-2 py-1.5">
                <input
                  :value="item.narration"
                  data-field="narration"
                  type="text"
                  placeholder="Line note"
                  class="w-full px-2 py-1 bg-transparent border border-transparent hover:border-slate-200 focus:border-blue-500 focus:bg-white dark:focus:bg-zinc-800 rounded-md text-xs outline-none text-slate-600 dark:text-zinc-300 transition-all"
                  @input="emit('update-item', idx, 'narration', ($event.target as HTMLInputElement).value)"
                  @keydown.enter="onCellEnter($event, idx, 'narration')"
                  @keydown.backspace="onCellBackspace($event, idx, 'narration')"
                  @keydown.down="onCellArrowDown($event, idx, 'narration')"
                  @keydown.up="onCellArrowUp($event, idx, 'narration')"
                  @keydown="onRowDelete($event, idx)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>

              <!-- Remove Row Action -->
              <td class="px-2 py-1.5 text-center">
                <button
                  type="button"
                  title="Remove Row (Del)"
                  class="text-slate-400 hover:text-rose-600 text-sm font-bold transition-colors cursor-pointer px-1"
                  @click="emit('remove-item', idx)"
                >
                  ✕
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cart-container {
  width: 100%;
}
</style>
