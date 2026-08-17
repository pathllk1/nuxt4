<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md" @keydown="handleModalKeydown">
    <div 
      ref="modalContainerRef" 
      class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col"
    >
      <!-- Modal Header -->
      <header class="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-6 sm:px-8 py-4 text-white flex justify-between items-center shrink-0">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-md bg-white/20 text-[9px] font-black uppercase tracking-wider">
              {{ isEditing ? 'Edit Stock Master' : 'Stock Master Registration' }}
            </span>
            <span v-if="form.hsn" class="px-2 py-0.5 rounded-md bg-indigo-950/40 text-[9px] font-mono font-bold tracking-wider">
              HSN: {{ form.hsn }}
            </span>
          </div>
          <h2 class="text-lg sm:text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <span>{{ isEditing ? `Edit: ${form.item || 'Stock Item'}` : 'Register New Stock Item' }}</span>
          </h2>
          <p class="text-[9px] sm:text-[10px] font-bold text-indigo-100 uppercase tracking-widest">
            Enter: Next Field • Insert / Ctrl+N: Add Batch • F8: Save Master • ESC: Close
          </p>
        </div>

        <button 
          @click="closeModal" 
          type="button" 
          class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Close (ESC)"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </header>

      <!-- Modal Body -->
      <div class="overflow-y-auto p-5 sm:p-6 flex-1 custom-scrollbar space-y-6">
        <form @submit.prevent="saveStockItem" id="stock-item-form" class="space-y-5">
          
          <!-- Section 1: Item Basic Identity & Categorization -->
          <div class="p-4 bg-slate-50/80 dark:bg-zinc-800/40 rounded-2xl border border-slate-200/80 dark:border-zinc-800 space-y-3">
            <h3 class="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <UIcon name="i-heroicons-cube" class="w-4 h-4 text-indigo-600" />
              <span>1. Item Specifications & Classification</span>
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
              <!-- Item Name -->
              <div class="sm:col-span-6 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Item Description / Name *
                </label>
                <input 
                  type="text" 
                  v-model="form.item" 
                  required 
                  class="first-input w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/40" 
                  placeholder="e.g. Castrol MAGNATEC 5W-30 (1L)" 
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- SKU / Part No -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU / Part Number
                </label>
                <input 
                  type="text" 
                  v-model="form.pno" 
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
                  placeholder="PNO-1002" 
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- OEM / Brand -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  OEM / Manufacturer Brand
                </label>
                <input 
                  type="text" 
                  v-model="form.oem" 
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" 
                  placeholder="e.g. Castrol / Bosch" 
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- HSN Code -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  HSN / SAC Code *
                </label>
                <input 
                  type="text" 
                  v-model="form.hsn" 
                  required
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500" 
                  placeholder="27101981" 
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>

              <!-- Primary UOM -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Default Unit of Measure (UOM)
                </label>
                <select 
                  v-model="form.uom" 
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  @change="syncUomToBatches"
                >
                  <option value="PCS">PCS (Pieces)</option>
                  <option value="NOS">NOS (Numbers)</option>
                  <option value="KGS">KGS (Kilograms)</option>
                  <option value="LTR">LTR (Litres)</option>
                  <option value="BOX">BOX (Boxes)</option>
                  <option value="MTR">MTR (Metres)</option>
                  <option value="SET">SET (Sets)</option>
                  <option value="PAC">PAC (Packs)</option>
                  <option value="UNT">UNT (Units)</option>
                </select>
              </div>

              <!-- Default GST % -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Default GST Rate (%)
                </label>
                <select 
                  v-model.number="form.grate" 
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500"
                  @change="syncGrateToBatches"
                >
                  <option :value="0">0% (Nil / Exempt)</option>
                  <option :value="5">5% GST</option>
                  <option :value="12">12% GST</option>
                  <option :value="18">18% GST</option>
                  <option :value="28">28% GST</option>
                </select>
              </div>

              <!-- Reorder / Min Level -->
              <div class="sm:col-span-3 space-y-1">
                <label class="text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Min Reorder Level
                </label>
                <input 
                  type="number" 
                  v-model.number="form.minLevel" 
                  min="0"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl font-mono font-bold text-xs text-slate-900 dark:text-white outline-none focus:border-indigo-500" 
                  placeholder="0" 
                  @keydown.enter.prevent="onInputEnter($event)"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Multi-Batch Inventory & Pricing Matrix -->
          <div class="p-4 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/60 space-y-3">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xs font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                  <UIcon name="i-heroicons-table-cells" class="w-4 h-4 text-indigo-600" />
                  <span>2. Batches, Stock Quantities & Rates</span>
                </h3>
                <p class="text-[9px] font-bold text-indigo-600/80 dark:text-indigo-400 uppercase tracking-widest mt-0.5">
                  Total Opening Stock: {{ totalOpeningQty }} {{ form.uom }} • Stock Value: ₹{{ totalStockValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 }) }}
                </p>
              </div>

              <button 
                type="button" 
                @click="addBatch" 
                class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-all cursor-pointer"
              >
                <UIcon name="i-heroicons-plus" class="w-3.5 h-3.5" />
                <span>Add Batch (Insert)</span>
              </button>
            </div>

            <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
              <table class="w-full text-left text-xs border-collapse">
                <thead>
                  <tr class="bg-slate-100 dark:bg-zinc-800 text-[9px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-wider border-b border-slate-200 dark:border-zinc-700">
                    <th class="px-3 py-2">Batch No</th>
                    <th class="px-3 py-2 text-right">Opening Qty</th>
                    <th class="px-3 py-2">UOM</th>
                    <th class="px-3 py-2 text-right">Purchase Rate (₹)</th>
                    <th class="px-3 py-2 text-right">Sale Rate / Unit (₹)</th>
                    <th class="px-3 py-2 text-right">MRP (₹)</th>
                    <th class="px-3 py-2 text-right">GST %</th>
                    <th class="px-3 py-2">Expiry Date</th>
                    <th class="px-2 py-2 text-center w-10">Act</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                  <tr 
                    v-for="(batch, idx) in form.batches" 
                    :key="idx" 
                    :data-batch-row="idx"
                    class="hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors"
                  >
                    <!-- Batch No -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="text" 
                        v-model="batch.batch" 
                        placeholder="DEFAULT / B01" 
                        class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs outline-none"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- Qty -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        v-model.number="batch.qty" 
                        class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- UOM -->
                    <td class="px-2.5 py-1.5">
                      <select 
                        v-model="batch.uom"
                        class="px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-bold text-[11px] outline-none"
                      >
                        <option value="PCS">PCS</option>
                        <option value="NOS">NOS</option>
                        <option value="KGS">KGS</option>
                        <option value="LTR">LTR</option>
                        <option value="BOX">BOX</option>
                        <option value="MTR">MTR</option>
                        <option value="SET">SET</option>
                        <option value="PAC">PAC</option>
                        <option value="UNT">UNT</option>
                      </select>
                    </td>

                    <!-- Purchase Rate -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        v-model.number="batch.rate" 
                        class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                        placeholder="0.00"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- Sale Rate -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        v-model.number="batch.sale_rate" 
                        class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none text-emerald-600 dark:text-emerald-400"
                        placeholder="0.00"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- MRP -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="number" 
                        step="any"
                        min="0"
                        v-model.number="batch.mrp" 
                        class="w-full px-2 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                        placeholder="0.00"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- GST % -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="number" 
                        v-model.number="batch.grate" 
                        class="w-14 px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono font-bold text-xs text-right outline-none"
                        @keydown.enter.prevent="onInputEnter($event)"
                      />
                    </td>

                    <!-- Expiry -->
                    <td class="px-2.5 py-1.5">
                      <input 
                        type="date" 
                        v-model="batch.expiry" 
                        class="px-1.5 py-1 bg-transparent border-b border-transparent focus:border-indigo-500 font-mono text-[10px] outline-none"
                        @keydown.enter.prevent="onExpiryEnter($event, idx)"
                      />
                    </td>

                    <!-- Action -->
                    <td class="px-2 py-1.5 text-center">
                      <button 
                        type="button" 
                        @click="removeBatch(idx)" 
                        :disabled="form.batches.length <= 1"
                        class="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
                        title="Remove batch row"
                      >
                        <UIcon name="i-heroicons-trash" class="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </div>

      <!-- Modal Footer -->
      <footer class="p-4 sm:p-5 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-zinc-900">
        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest hidden sm:block">
          Shortcut: Press <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded font-mono font-bold">F8</kbd> to {{ isEditing ? 'Update' : 'Save' }} Master
        </div>
        <div class="flex items-center gap-2 ml-auto">
          <button 
            type="button" 
            @click="closeModal" 
            class="px-4 py-2 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors cursor-pointer"
          >
            Discard (ESC)
          </button>
          <button 
            type="submit" 
            form="stock-item-form" 
            :disabled="isSaving" 
            class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <UIcon v-if="isSaving" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin" />
            <UIcon v-else name="i-heroicons-check" class="w-4 h-4" />
            <span>{{ isEditing ? 'Update Stock Item (F8)' : 'Save Stock Item (F8)' }}</span>
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { useApi } from '@/utils/api';
import { useToast } from '#imports';
import { useInventory } from '@/composables/useInventory';

const props = defineProps<{
  modelValue: boolean;
  stock?: any;
  stockId?: string | null;
  initialData?: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', data?: any): void;
}>();

const api = useApi();
const toast = useToast();
const { createMovement, updateStock } = useInventory();

const modalContainerRef = ref<HTMLElement | null>(null);
const isSaving = ref(false);

interface BatchRow {
  batch: string;
  qty: number;
  uom: string;
  rate: number;
  sale_rate?: number;
  grate: number;
  mrp: number;
  expiry: string;
}

const form = ref({
  _id: '',
  item: '',
  pno: '',
  oem: '',
  hsn: '',
  uom: 'PCS',
  grate: 18,
  minLevel: 0,
  batches: [
    { batch: '', qty: 0, uom: 'PCS', rate: 0, sale_rate: 0, grate: 18, mrp: 0, expiry: '' }
  ] as BatchRow[]
});

const isEditing = computed(() => !!form.value._id);

const totalOpeningQty = computed(() => {
  return form.value.batches.reduce((sum, b) => sum + (Number(b.qty) || 0), 0);
});

const totalStockValuation = computed(() => {
  return form.value.batches.reduce((sum, b) => sum + ((Number(b.qty) || 0) * (Number(b.rate) || 0)), 0);
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    const rawData = props.initialData || props.stock;
    if (rawData) {
      hydrateFormData(rawData);
    } else {
      resetForm();
    }
    nextTick(() => {
      focusFirstInput();
    });
  }
});

function hydrateFormData(data: any) {
  resetForm();
  form.value._id = String(data.id || data._id || '');
  form.value.item = data.item || data.name || '';
  form.value.pno = data.pno || data.sku || '';
  form.value.oem = data.oem || data.brand || '';
  form.value.hsn = data.hsn || data.hsnSac || '';
  form.value.uom = data.uom || 'PCS';
  form.value.grate = data.grate !== undefined ? Number(data.grate) : 18;
  form.value.minLevel = data.minLevel || 0;

  if (Array.isArray(data.batches) && data.batches.length > 0) {
    form.value.batches = data.batches.map((b: any) => {
      let formattedExp = '';
      if (b.expiry) {
        try {
          const d = new Date(b.expiry);
          if (!isNaN(d.getTime())) formattedExp = d.toISOString().split('T')[0] || '';
        } catch {
          formattedExp = '';
        }
      }
      return {
        batch: b.batch || '',
        qty: Number(b.qty) || 0,
        uom: b.uom || form.value.uom,
        rate: Number(b.rate) || 0,
        sale_rate: Number(b.sale_rate || b.saleRate || b.rate) || 0,
        grate: b.grate !== undefined ? Number(b.grate) : form.value.grate,
        mrp: Number(b.mrp) || 0,
        expiry: formattedExp
      };
    });
  } else {
    form.value.batches = [
      {
        batch: data.batch || '',
        qty: Number(data.qty) || 0,
        uom: data.uom || 'PCS',
        rate: Number(data.rate) || 0,
        sale_rate: Number(data.sale_rate || data.rate) || 0,
        grate: data.grate !== undefined ? Number(data.grate) : 18,
        mrp: Number(data.mrp) || 0,
        expiry: ''
      }
    ];
  }
}

function resetForm() {
  form.value = {
    _id: '',
    item: '',
    pno: '',
    oem: '',
    hsn: '',
    uom: 'PCS',
    grate: 18,
    minLevel: 0,
    batches: [
      { batch: '', qty: 0, uom: 'PCS', rate: 0, sale_rate: 0, grate: 18, mrp: 0, expiry: '' }
    ]
  };
}

function syncUomToBatches() {
  form.value.batches.forEach(b => {
    b.uom = form.value.uom;
  });
}

function syncGrateToBatches() {
  form.value.batches.forEach(b => {
    b.grate = form.value.grate;
  });
}

function addBatch() {
  form.value.batches.push({
    batch: '',
    qty: 0,
    uom: form.value.uom,
    rate: 0,
    sale_rate: 0,
    grate: form.value.grate,
    mrp: 0,
    expiry: ''
  });
  nextTick(() => {
    const lastRowIndex = form.value.batches.length - 1;
    const batchInput = modalContainerRef.value?.querySelector(`[data-batch-row="${lastRowIndex}"] input`) as HTMLElement;
    if (batchInput) {
      batchInput.focus();
      (batchInput as HTMLInputElement).select();
    }
  });
}

function removeBatch(index: number) {
  if (form.value.batches.length <= 1) return;
  form.value.batches.splice(index, 1);
}

function focusFirstInput() {
  const el = modalContainerRef.value?.querySelector('.first-input') as HTMLInputElement;
  if (el) {
    el.focus();
    el.select();
  }
}

function closeModal() {
  emit('update:modelValue', false);
}

function onInputEnter(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  const formEl = modalContainerRef.value;
  if (!formEl) return;

  const focusable = Array.from(
    formEl.querySelectorAll('input:not([type="hidden"]):not([disabled]), select:not([disabled])')
  ) as HTMLElement[];
  const idx = focusable.indexOf(target);
  const nextEl = idx > -1 ? focusable[idx + 1] : undefined;
  if (nextEl) {
    nextEl.focus();
  } else {
    saveStockItem();
  }
}

function onExpiryEnter(e: KeyboardEvent, index: number) {
  if (index === form.value.batches.length - 1) {
    saveStockItem();
  } else {
    onInputEnter(e);
  }
}

function handleModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeModal();
  } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
    e.preventDefault();
    saveStockItem();
  } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    addBatch();
  }
}

async function saveStockItem() {
  if (!form.value.item.trim()) {
    toast.add({ title: 'Item Name is required', color: 'error' });
    return;
  }
  if (!form.value.hsn.trim()) {
    toast.add({ title: 'HSN Code is required', color: 'error' });
    return;
  }
  if (form.value.batches.length === 0) {
    toast.add({ title: 'At least one batch is required', color: 'error' });
    return;
  }

  isSaving.value = true;
  try {
    const payload = {
      type: 'OPENING',
      item: form.value.item.trim(),
      pno: form.value.pno.trim() || null,
      oem: form.value.oem.trim() || null,
      hsn: form.value.hsn.trim(),
      uom: form.value.uom,
      grate: form.value.grate,
      minLevel: form.value.minLevel,
      batches: form.value.batches
    };

    let res: any;
    if (isEditing.value) {
      res = await updateStock(form.value._id, payload);
    } else {
      res = await createMovement(payload);
    }

    if (res && (res.success || res.data)) {
      toast.add({
        title: isEditing.value ? 'Stock Item Updated' : 'Stock Item Created',
        description: `${payload.item} saved successfully`,
        color: 'success'
      });
      emit('saved', res.data || res);
      closeModal();
    }
  } catch (err: any) {
    toast.add({
      title: 'Failed to save stock item',
      description: err.data?.statusMessage || err.message,
      color: 'error'
    });
  } finally {
    isSaving.value = false;
  }
}
</script>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
</style>
