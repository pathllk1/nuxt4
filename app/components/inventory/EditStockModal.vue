<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" @keydown="handleModalKeydown">
    <div ref="modalContainerRef" class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col">
       <header class="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-5 text-white flex justify-between items-center shrink-0">
          <div>
             <h2 class="text-xl font-black uppercase tracking-tighter">Edit Stock Item</h2>
             <p class="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">Enter: Next Field • Insert: Add Batch • F8: Update Item • ESC: Close</p>
          </div>
          <button @click="$emit('update:modelValue', false)" type="button" class="w-8 h-8 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="overflow-y-auto p-6 flex-1 custom-scrollbar">
         <form @submit.prevent="saveChanges" id="edit-stock-form" class="space-y-6">
            <div class="space-y-4">
               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Item Name *</label>
                  <input 
                    type="text" 
                    v-model="form.item" 
                    required 
                    @keydown.enter.prevent="onInputEnter($event)"
                    @keydown.backspace="onInputBackspace($event)"
                    class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white" 
                  />
               </div>

               <div class="grid grid-cols-2 gap-4">
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Part Number</label>
                     <input 
                       type="text" 
                       v-model="form.pno" 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white" 
                     />
                  </div>
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">OEM / Brand</label>
                     <input 
                       type="text" 
                       v-model="form.oem" 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white" 
                     />
                  </div>
               </div>

               <div class="grid grid-cols-2 gap-4">
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">HSN Code *</label>
                     <input 
                       type="text" 
                       v-model="form.hsn" 
                       required 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-mono font-bold uppercase text-sm text-gray-900 dark:text-white" 
                     />
                  </div>
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">UOM *</label>
                     <select 
                       v-model="form.uom" 
                       required 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white"
                     >
                        <option value="PCS">PCS</option>
                        <option value="NOS">NOS</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="MTR">MTR</option>
                        <option value="LTR">LTR</option>
                        <option value="KGS">KGS</option>
                     </select>
                  </div>
               </div>

               <div class="grid grid-cols-2 gap-4">
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">GST Rate (%) *</label>
                     <input 
                       type="number" 
                       step="any" 
                       v-model="form.grate" 
                       required 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white" 
                     />
                  </div>
                  <div>
                     <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">MRP</label>
                     <input 
                       type="number" 
                       step="any" 
                       v-model="form.mrp" 
                       @keydown.enter.prevent="onInputEnter($event)"
                       @keydown.backspace="onInputBackspace($event)"
                       class="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-blue-500 outline-none transition-all font-bold text-sm text-gray-900 dark:text-white" 
                     />
                  </div>
               </div>
            </div>

            <!-- Batches Section -->
            <div class="space-y-3 pt-2">
               <div class="flex items-center justify-between">
                  <h3 class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Batches</h3>
                  <button type="button" @click="addBatch" class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:text-blue-700 flex items-center gap-1">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                     + Add Batch (Insert / Ctrl+N)
                  </button>
               </div>

               <div class="bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 overflow-hidden">
                  <table class="w-full text-left text-xs">
                     <thead>
                        <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                           <th class="px-3 py-2.5">Batch No</th>
                           <th class="px-3 py-2.5 w-20">Qty</th>
                           <th class="px-3 py-2.5 w-24">Rate</th>
                           <th class="px-3 py-2.5 w-20">GST%</th>
                           <th class="px-3 py-2.5 w-24">MRP</th>
                           <th class="px-3 py-2.5 w-32">Expiry</th>
                           <th class="px-3 py-2.5 text-center w-12"></th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-100 dark:divide-zinc-700">
                        <tr v-for="(batch, index) in form.batches" :key="index" class="bg-white dark:bg-zinc-900" :data-batch-row="index">
                           <td class="px-2 py-1.5">
                              <input 
                                type="text" 
                                v-model="batch.batch" 
                                @keydown.enter.prevent="onInputEnter($event)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                                placeholder="Optional" 
                              />
                           </td>
                           <td class="px-2 py-1.5">
                              <input 
                                type="number" 
                                step="any" 
                                v-model="batch.qty" 
                                required 
                                @keydown.enter.prevent="onInputEnter($event)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                              />
                           </td>
                           <td class="px-2 py-1.5">
                              <input 
                                type="number" 
                                step="any" 
                                v-model="batch.rate" 
                                required 
                                @keydown.enter.prevent="onInputEnter($event)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                              />
                           </td>
                           <td class="px-2 py-1.5">
                              <input 
                                type="number" 
                                step="any" 
                                v-model="batch.grate" 
                                required 
                                @keydown.enter.prevent="onInputEnter($event)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                              />
                           </td>
                           <td class="px-2 py-1.5">
                              <input 
                                type="number" 
                                step="any" 
                                v-model="batch.mrp" 
                                @keydown.enter.prevent="onInputEnter($event)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                              />
                           </td>
                           <td class="px-2 py-1.5">
                              <input 
                                type="date" 
                                v-model="batch.expiry" 
                                @keydown.enter.prevent="onExpiryEnter($event, index)"
                                @keydown.backspace="onInputBackspace($event)"
                                class="w-full px-2 py-1.5 border-b border-transparent focus:border-blue-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" 
                              />
                           </td>
                           <td class="px-2 py-1.5 text-center">
                              <button type="button" @click="removeBatch(index)" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" :disabled="form.batches.length <= 1">
                                 <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
            </div>
         </form>
       </div>

       <footer class="p-6 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center shrink-0 bg-slate-50 dark:bg-zinc-900">
          <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
             Shortcut: Press <kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200 rounded font-mono font-bold">F8</kbd> to Update Item
          </div>
          <div class="flex gap-2">
             <button type="button" @click="$emit('update:modelValue', false)" class="px-5 py-2.5 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Cancel (ESC)</button>
             <button type="submit" form="edit-stock-form" :disabled="loading" class="px-8 py-2.5 bg-blue-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-700 transition-all flex items-center gap-2">
                <span v-if="loading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Update Item (F8)
             </button>
          </div>
       </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref, nextTick } from 'vue';
import { useInventory } from '@/composables/useInventory';
import { useKeyboardNavigation } from '@/composables/useKeyboardNavigation';

const props = defineProps<{
  modelValue: boolean;
  stock: any;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const { updateStock } = useInventory();
const { handleEnterKey, handleBackspaceKey, focusFirstInput } = useKeyboardNavigation();

const modalContainerRef = ref<HTMLElement | null>(null);
const loading = ref(false);

const form = reactive({
  item: '',
  pno: '',
  oem: '',
  hsn: '',
  uom: 'PCS',
  grate: 18,
  mrp: 0,
  batches: [] as any[]
});

watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      focusFirstInput(modalContainerRef.value);
    });
  }
});

watch(() => props.stock, (newVal) => {
  if (newVal) {
    form.item = newVal.item || '';
    form.pno = newVal.pno || '';
    form.oem = newVal.oem || '';
    form.hsn = newVal.hsn || '';
    form.uom = newVal.uom || 'PCS';
    form.grate = newVal.grate || 18;
    form.mrp = newVal.mrp || 0;
    form.batches = newVal.batches ? JSON.parse(JSON.stringify(newVal.batches)) : [];
    
    form.batches.forEach(b => {
      if (b.expiry) {
        try {
          const dateObj = new Date(b.expiry);
          if (!isNaN(dateObj.getTime())) {
            b.expiry = dateObj.toISOString().split('T')[0];
          } else {
            b.expiry = '';
          }
        } catch (e) {
          b.expiry = '';
        }
      }
    });
  }
}, { immediate: true });

function handleModalKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    emit('update:modelValue', false);
  } else if (e.key === 'F8' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's')) {
    e.preventDefault();
    e.stopPropagation();
    saveChanges();
  } else if (e.key === 'Insert' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n')) {
    e.preventDefault();
    e.stopPropagation();
    addBatch();
  }
}

function onInputEnter(e: KeyboardEvent) {
  if (modalContainerRef.value) {
    handleEnterKey(e, modalContainerRef.value, () => {
      saveChanges();
    });
  }
}

function onInputBackspace(e: KeyboardEvent) {
  if (modalContainerRef.value) {
    handleBackspaceKey(e, modalContainerRef.value);
  }
}

function onExpiryEnter(e: KeyboardEvent, index: number) {
  if (index === form.batches.length - 1) {
    saveChanges();
  } else {
    onInputEnter(e);
  }
}

function addBatch() {
  form.batches.push({ batch: '', qty: 0, uom: form.uom, rate: 0, grate: form.grate, mrp: 0, expiry: '' });
  nextTick(() => {
    const lastRowIndex = form.batches.length - 1;
    const batchInput = modalContainerRef.value?.querySelector(`[data-batch-row="${lastRowIndex}"] input`) as HTMLElement;
    if (batchInput) {
      batchInput.focus();
      (batchInput as HTMLInputElement).select();
    }
  });
}

function removeBatch(index: number) {
  form.batches.splice(index, 1);
}

async function saveChanges() {
  if (!form.item.trim()) return;
  if (form.batches.length === 0) {
    alert('At least one batch is required');
    return;
  }
  loading.value = true;
  try {
    const res = await updateStock(props.stock.id || props.stock._id, form);
    if (res.success) {
      emit('saved');
      emit('update:modelValue', false);
    }
  } catch (err: any) {
    alert(err.message || 'Failed to update stock item');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.animate-scale-in {
  animation: scaleIn 0.2s ease-out;
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
