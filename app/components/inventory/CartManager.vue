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
            <tr>
              <td class="index-col">{{ index + 1 }}</td>
              <td class="description-cell">
                <input
                  v-if="isEditableDescription(item)"
                  v-model="item.item"
                  class="line-input strong"
                  type="text"
                  :placeholder="mode === 'purchase' ? 'Item name' : 'Service name'"
                  @input="$emit('service-input', { index, value: item.item })"
                />
                <div v-else class="item-name">{{ item.item }}</div>
                <div class="sub-fields">
                  <input v-if="mode === 'purchase'" v-model="item.batch" class="pill-input" type="text" placeholder="Batch" />
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
                />
                <span v-else class="mono muted-text">{{ item.hsn || '-' }}</span>
              </td>
              <td v-if="state.isReturnMode" class="num muted-text">{{ item.qty }}</td>
              <td class="num">
                <input
                  v-model="item[state.isReturnMode ? 'returnQty' : 'qty']"
                  class="line-input num-input"
                  type="number"
                  min="0"
                  step="0.01"
                  :max="state.isReturnMode ? item.qty : undefined"
                />
              </td>
              <td>
                <select
                  v-if="isEditableDescription(item)"
                  v-model="item.uom"
                  class="line-input unit-input bg-transparent"
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
                <input v-model="item.rate" class="line-input num-input" type="number" min="0" step="0.01" :readonly="state.isReturnMode" />
              </td>
              <td class="num">
                <input v-model="item.disc" class="line-input num-input" type="number" min="0" max="100" step="0.01" :readonly="state.isReturnMode" />
              </td>
              <td v-if="state.gstEnabled" class="num">
                <input
                  v-if="isEditableDescription(item)"
                  v-model="item.grate"
                  class="line-input num-input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  :readonly="state.isReturnMode"
                />
                <span v-else class="mono muted-text">{{ item.grate || 0 }}%</span>
              </td>
              <td class="num amount-cell">INR {{ formatMoney(calculateRowTotal(item)) }}</td>
              <td class="action-col">
                <button v-if="!state.isReturnMode" class="remove-btn" type="button" title="Remove line" @click="$emit('remove-item', index)">
                  <span aria-hidden="true">&times;</span>
                </button>
              </td>
            </tr>
            <tr class="note-row">
              <td></td>
              <td :colspan="noteRowColspan">
                <input v-model="item.narration" class="note-input" type="text" placeholder="Line note" />
              </td>
            </tr>
          </template>
        </tbody>
        <tbody v-else>
          <tr>
            <td :colspan="totalColspan">
              <div class="empty-state">
                <p>No line items yet.</p>
                <button type="button" @click="$emit('add-item')">{{ mode === 'purchase' ? 'Add first row' : 'Add stock item' }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer class="grid-footer">
      <button type="button" @click="$emit('add-item')">
        + Add Items (F2) &nbsp;|&nbsp; Select Party (F3) &nbsp;|&nbsp; Charges (F4) &nbsp;|&nbsp; Save (F8) &nbsp;|&nbsp; Reset (F9)
      </button>
      <button v-if="mode === 'sales' && !state.isReturnMode" type="button" @click="$emit('add-service')">
        Add Service (F5)
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BillingState } from '@/composables/useBillingState';

const props = withDefaults(defineProps<{
  state: BillingState;
  mode?: 'sales' | 'purchase';
}>(), {
  mode: 'sales'
});

defineEmits(['remove-item', 'add-item', 'add-service', 'service-input']);

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
  line-height: 1.2;
}
.sub-fields {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.data-pill,
.pill-input {
  height: 22px;
  border: 1px solid #dbe3ee;
  border-radius: 999px;
  background: #f8fafc;
  padding: 3px 8px;
  font-size: 10px;
  font-weight: 800;
  color: #64748b;
  text-transform: uppercase;
}
.pill-input {
  width: 110px;
  outline: none;
}
.data-pill.service {
  color: #047857;
  border-color: #a7f3d0;
  background: #ecfdf5;
}
.line-input,
.note-input {
  width: 100%;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  padding: 4px 6px;
  outline: none;
  color: #0f172a;
}
.line-input:focus,
.note-input:focus,
.pill-input:focus {
  background: white;
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}
.strong {
  font-weight: 800;
}
.mono,
.num-input,
.amount-cell {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
.num,
.num-input {
  text-align: right;
}
.num-input {
  max-width: 94px;
  margin-left: auto;
}
.unit-input {
  max-width: 62px;
  text-transform: uppercase;
}
.unit-text {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  color: #64748b;
}
.muted-text {
  color: #64748b;
}
.total-col {
  width: 132px;
}
.amount-cell {
  font-weight: 900;
  color: #0f172a;
  white-space: nowrap;
}
.action-col {
  width: 42px;
  text-align: center;
}
.remove-btn {
  width: 28px;
  height: 28px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
}
.remove-btn:hover {
  color: #dc2626;
  border-color: #fecaca;
  background: #fff1f2;
}
.note-row td {
  padding-top: 0;
  background: #fbfdff;
}
.note-input {
  color: #475569;
  font-size: 12px;
}
.empty-state {
  min-height: 260px;
  display: grid;
  place-content: center;
  gap: 12px;
  text-align: center;
  color: #64748b;
}
.empty-state p {
  margin: 0;
  font-weight: 700;
}
.empty-state button {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: white;
  border-radius: 6px;
  padding: 9px 12px;
  font-weight: 800;
  cursor: pointer;
}
.grid-footer {
  display: flex;
  gap: 8px;
  padding: 8px;
  border-top: 1px dashed #cbd5e1;
  background: #f8fafc;
  flex-wrap: wrap;
}
.grid-footer button {
  flex: 1;
  min-width: 240px;
  border: 1px dashed #93c5fd;
  border-radius: 4px;
  background: white;
  color: #2563eb;
  padding: 8px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  cursor: pointer;
}
@media (max-width: 760px) {
  .grid-footer button {
    min-width: 100%;
  }
}
</style>
