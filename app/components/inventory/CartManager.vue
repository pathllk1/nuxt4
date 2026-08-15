<template>
  <section class="invoice-grid" :class="[mode, { returning: state.isReturnMode }]">
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="index-col">#</th>
            <th>{{ mode === 'purchase' ? 'Item / Batch' : 'Description' }}</th>
            <th v-if="state.gstEnabled">HSN/SAC</th>
            <th v-if="state.isReturnMode" class="num">Orig</th>
            <th class="num">{{ state.isReturnMode ? 'Return' : 'Qty' }}</th>
            <th>Unit</th>
            <th class="num">{{ mode === 'purchase' ? 'Cost' : 'Rate' }}</th>
            <th class="num">Disc %</th>
            <th v-if="state.gstEnabled" class="num">GST %</th>
            <th class="num total-col">Amount</th>
            <th class="action-col"></th>
          </tr>
        </thead>
        <tbody v-if="state.cart.length">
          <template v-for="(item, index) in state.cart" :key="index">
            <tr :data-row="index" @keydown="onRowKeydown($event, index)">
              <td class="index-col">{{ index + 1 }}</td>
              <td class="description-cell">
                <input
                  v-if="isEditableDescription(item)"
                  v-model="item.item"
                  class="line-input strong item-name-input"
                  type="text"
                  :placeholder="mode === 'purchase' ? 'Item name' : 'Service name'"
                  @input="$emit('service-input', { index, value: item.item })"
                  @keydown.enter.prevent="onCellEnter($event, index, 'item')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <div v-else class="item-name">{{ item.item }}</div>
                <div class="sub-fields">
                  <input v-if="mode === 'purchase'" v-model="item.batch" class="pill-input" type="text" placeholder="Batch" @keydown.enter.prevent="onCellEnter($event, index, 'batch')" @keydown.backspace="onCellBackspace($event)" @focus="($event.target as HTMLInputElement).select()" />
                  <span v-else-if="item.batch" class="data-pill">Batch {{ item.batch }}</span>
                  <span v-if="item.itemType === 'SERVICE'" class="data-pill service">Service</span>
                  <span v-if="item.mrp" class="data-pill">MRP {{ item.mrp }}</span>
                </div>
              </td>
              <td v-if="state.gstEnabled">
                <input
                  v-if="isEditableDescription(item)"
                  v-model="item.hsn"
                  class="line-input mono"
                  type="text"
                  placeholder="HSN"
                  @keydown.enter.prevent="onCellEnter($event, index, 'hsn')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <span v-else class="mono muted-text">{{ item.hsn || '-' }}</span>
              </td>
              <td v-if="state.isReturnMode" class="num muted-text">{{ item.qty }}</td>
              <td class="num">
                <input
                  v-model="item[state.isReturnMode ? 'returnQty' : 'qty']"
                  class="line-input num-input qty-input"
                  type="number"
                  min="0"
                  step="0.01"
                  :max="state.isReturnMode ? item.qty : undefined"
                  @keydown.enter.prevent="onCellEnter($event, index, 'qty')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>
              <td>
                <select
                  v-if="isEditableDescription(item)"
                  v-model="item.uom"
                  class="line-input unit-input bg-transparent"
                  @keydown.enter.prevent="onCellEnter($event, index, 'uom')"
                  @keydown.backspace="onCellBackspace($event)"
                >
                  <option value="PCS">PCS</option>
                  <option value="NOS">NOS</option>
                  <option value="SET">SET</option>
                  <option value="BOX">BOX</option>
                  <option value="MTR">MTR</option>
                  <option value="KGS">KGS</option>
                  <option value="SRV">SRV</option>
                </select>
                <span v-else class="unit-text">{{ item.uom }}</span>
              </td>
              <td class="num">
                <input 
                  v-model="item.rate" 
                  class="line-input num-input rate-input" 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  :readonly="state.isReturnMode" 
                  @keydown.enter.prevent="onCellEnter($event, index, 'rate')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>
              <td class="num">
                <input 
                  v-model="item.disc" 
                  class="line-input num-input disc-input" 
                  type="number" 
                  min="0" 
                  max="100" 
                  step="0.01" 
                  :readonly="state.isReturnMode" 
                  @keydown.enter.prevent="onCellEnter($event, index, state.gstEnabled && isEditableDescription(item) ? 'disc' : 'last')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>
              <td v-if="state.gstEnabled" class="num">
                <input
                  v-if="isEditableDescription(item)"
                  v-model="item.grate"
                  class="line-input num-input grate-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  :readonly="state.isReturnMode" 
                  @keydown.enter.prevent="onCellEnter($event, index, 'last')"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
                <span v-else class="mono muted-text">{{ item.grate || 0 }}%</span>
              </td>
              <td class="num amount-cell">INR {{ formatMoney(calculateRowTotal(item)) }}</td>
              <td class="action-col">
                <button v-if="!state.isReturnMode" class="remove-btn" type="button" title="Remove line (Delete / Ctrl+D)" @click="$emit('remove-item', index)">
                  <span aria-hidden="true">&times;</span>
                </button>
              </td>
            </tr>
            <tr class="note-row" :data-note-row="index" @keydown="onRowKeydown($event, index)">
              <td></td>
              <td :colspan="noteRowColspan">
                <input 
                  v-model="item.narration" 
                  class="note-input" 
                  type="text" 
                  placeholder="Line note (Optional)" 
                  @keydown.enter.prevent="onNoteEnter($event, index)"
                  @keydown.backspace="onCellBackspace($event)"
                  @focus="($event.target as HTMLInputElement).select()"
                />
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td :colspan="totalColspan">
              <div class="empty-state">
                <p>No line items yet.</p>
                <button type="button" @click="$emit('add-item')">{{ mode === 'purchase' ? '+ Add first row (F2)' : '+ Add stock item (F2)' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="grid-footer">
      <div class="shortcut-strip">
        <button type="button" class="footer-btn" @click="$emit('add-item')">
          <kbd>F2</kbd> Add Items
        </button>
        <button v-if="mode === 'sales' && !state.isReturnMode" type="button" class="footer-btn" @click="$emit('add-service')">
          <kbd>F5</kbd> Add Service
        </button>
        <span class="divider"></span>
        <span class="info-text"><kbd>Del</kbd> Remove Row</span>
        <span class="info-text"><kbd>Enter</kbd> Next Cell</span>
        <span class="info-text"><kbd>F4</kbd> Charges</span>
        <span class="info-text"><kbd>F8</kbd> Save Bill</span>
      </div>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BillingState } from '@/composables/useBillingState';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const props = withDefaults(defineProps<{
  state: BillingState;
  mode?: 'sales' | 'purchase';
}>(), {
  mode: 'sales'
});

const emit = defineEmits(['remove-item', 'add-item', 'add-service', 'service-input']);
const { handleEnterKey, handleBackspaceKey } = useKeyboardNavigation();

function onRowKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Delete' || (e.ctrlKey && e.key.toLowerCase() === 'd')) {
    const target = e.target as HTMLElement;
    // Only delete row if input is empty or if explicitly Ctrl+D
    if (target instanceof HTMLInputElement && target.value !== '' && e.key === 'Delete' && !e.ctrlKey) {
      return; // Allow standard character deletion inside text
    }
    e.preventDefault();
    emit('remove-item', index);
  }
}

function onCellEnter(e: KeyboardEvent, rowIndex: number, cellType: string) {
  const container = (e.target as HTMLElement).closest('.table-wrap') as HTMLElement;
  if (!container) return;

  if (cellType === 'last') {
    // Jump to item narration (line note) for this row
    const noteInput = container.querySelector(`tr[data-note-row="${rowIndex}"] input.note-input`) as HTMLElement;
    if (noteInput) {
      noteInput.focus();
      if (noteInput instanceof HTMLInputElement) noteInput.select();
      return;
    }
    focusNextRowOrAddItem(container, rowIndex);
  } else {
    handleEnterKey(e, container);
  }
}

function onNoteEnter(e: KeyboardEvent, rowIndex: number) {
  const container = (e.target as HTMLElement).closest('.table-wrap') as HTMLElement;
  if (!container) return;
  focusNextRowOrAddItem(container, rowIndex);
}

function focusNextRowOrAddItem(container: HTMLElement, rowIndex: number) {
  const nextRow = container.querySelector(`tr[data-row="${rowIndex + 1}"]`) as HTMLElement;
  if (nextRow) {
    const targetInput = (nextRow.querySelector('input.item-name-input') || nextRow.querySelector('input.qty-input')) as HTMLElement;
    if (targetInput) {
      targetInput.focus();
      if (targetInput instanceof HTMLInputElement) targetInput.select();
      return;
    }
  }
  emit('add-item');
}

function onCellBackspace(e: KeyboardEvent) {
  const container = (e.target as HTMLElement).closest('.table-wrap') as HTMLElement;
  if (container) {
    handleBackspaceKey(e, container);
  }
}

const totalQuantity = computed(() => {
  return props.state.cart.reduce((sum, item) => {
    const qty = parseFloat(props.state.isReturnMode ? item.returnQty : item.qty) || 0;
    return sum + qty;
  }, 0);
});

const noteRowColspan = computed(() => {
  let base = 7;
  if (props.state.gstEnabled) base += 2;
  if (props.state.isReturnMode) base += 1;
  return base;
});

const totalColspan = computed(() => {
  return 1 + noteRowColspan.value;
});

function isEditableDescription(item: any) {
  return props.mode === 'purchase' || item.itemType === 'SERVICE';
}

function calculateRowTotal(item: any) {
  const qty = parseFloat(props.state.isReturnMode ? item.returnQty : item.qty) || 0;
  const rate = parseFloat(item.rate) || 0;
  const discount = parseFloat(item.disc) || 0;
  return qty * rate * (1 - discount / 100);
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
</script>

<style scoped>
.invoice-grid {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #dbe3ee;
  border-radius: 0;
  overflow: hidden;
}
.table-wrap {
  min-height: 0;
  flex: 1;
  overflow: auto;
}
table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
}
th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #2563eb;
  color: white;
  padding: 8px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.purchase th {
  background: #0d9488;
}
.returning th {
  background: #f59e0b;
}
td {
  padding: 6px 8px;
  border-bottom: 1px solid #eef2f7;
  vertical-align: middle;
  color: #1e293b;
  font-size: 12px;
}
tbody tr:hover td {
  background: #f8fafc;
}
tbody tr:focus-within td {
  background: #f0f7ff;
}
.index-col {
  width: 42px;
  text-align: center;
  color: #94a3b8;
  font-weight: 800;
}
.description-cell {
  min-width: 260px;
}
.item-name {
  font-weight: 800;
  color: #0f172a;
}
.sub-fields {
  display: flex;
  gap: 6px;
  margin-top: 3px;
  align-items: center;
}
.data-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  background: #f1f5f9;
  color: #475569;
  border-radius: 4px;
}
.data-pill.service {
  background: #e0e7ff;
  color: #4338ca;
}
.line-input {
  width: 100%;
  border: 1px solid transparent;
  background: transparent;
  padding: 4px 6px;
  font-size: 12px;
  border-radius: 4px;
  outline: none;
  transition: all 0.15s;
}
.line-input:hover {
  border-color: #cbd5e1;
  background: white;
}
.line-input:focus {
  border-color: #2563eb;
  background: white;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.line-input.strong {
  font-weight: 700;
  color: #0f172a;
}
.line-input.mono {
  font-family: monospace;
  font-size: 11px;
}
.num {
  text-align: right;
}
.num-input {
  text-align: right;
  font-family: monospace;
  font-weight: 700;
}
.amount-cell {
  font-family: monospace;
  font-weight: 800;
  color: #0f172a;
}
.remove-btn {
  background: transparent;
  border: none;
  color: #cbd5e1;
  font-size: 16px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}
.remove-btn:hover {
  color: #ef4444;
  background: #fee2e2;
}
.note-row td {
  padding: 2px 8px 6px;
  border-bottom: 1px dashed #e2e8f0;
}
.note-input {
  width: 100%;
  border: none;
  background: transparent;
  font-size: 11px;
  color: #64748b;
  padding: 2px 4px;
  outline: none;
}
.note-input:focus {
  color: #0f172a;
  background: #f8fafc;
  border-radius: 4px;
}
.empty-state {
  padding: 32px;
  text-align: center;
  color: #64748b;
}
.empty-state button {
  margin-top: 8px;
  padding: 6px 14px;
  background: #2563eb;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
}
.grid-footer {
  padding: 6px 12px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
}
.shortcut-strip {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.footer-btn {
  background: white;
  border: 1px solid #cbd5e1;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.footer-btn:hover {
  border-color: #2563eb;
  color: #2563eb;
}
.divider {
  width: 1px;
  height: 14px;
  background: #cbd5e1;
}
.info-text {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
kbd {
  padding: 1px 4px;
  background: #e2e8f0;
  color: #1e293b;
  border-radius: 3px;
  font-family: monospace;
  font-size: 9px;
  font-weight: 800;
}
</style>
