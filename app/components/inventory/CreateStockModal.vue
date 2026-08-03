<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col">
       <header class="bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-6 text-white flex justify-between items-center shrink-0">
          <div>
             <h2 class="text-2xl font-black uppercase tracking-tighter">Create New Stock Item</h2>
             <p class="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">Add a new physical item with batch tracking</p>
          </div>
          <button @click="$emit('update:modelValue', false)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="overflow-y-auto p-8 flex-1">
         <form @submit.prevent="saveStock" id="stock-form" class="space-y-8">
            <!-- Basic Info -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div class="md:col-span-3">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Item Name *</label>
                  <input type="text" v-model="form.item" required class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" placeholder="e.g. Engine Oil 5W-30" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Part Number</label>
                  <input type="text" v-model="form.pno" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" placeholder="SKU/Part No" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">OEM / Brand</label>
                  <input type="text" v-model="form.oem" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white" placeholder="Manufacturer" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">HSN Code *</label>
                  <input type="text" v-model="form.hsn" required class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:border-indigo-500 outline-none transition-all font-mono font-bold uppercase text-gray-900 dark:text-white" />
               </div>
            </div>

            <!-- Batches Section -->
            <div class="space-y-4">
               <div class="flex items-center justify-between">
                  <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Opening Batches</h3>
                  <button type="button" @click="addBatch" class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                     Add Batch
                  </button>
               </div>

               <div class="bg-slate-50 dark:bg-zinc-800 rounded-2xl border border-slate-100 dark:border-zinc-700 overflow-hidden">
                  <table class="w-full text-left text-xs">
                     <thead>
                        <tr class="bg-slate-100 dark:bg-zinc-800 text-[10px] font-black text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                           <th class="px-4 py-3">Batch No</th>
                           <th class="px-4 py-3">Qty *</th>
                           <th class="px-4 py-3">UOM *</th>
                           <th class="px-4 py-3">Rate *</th>
                           <th class="px-4 py-3">GST % *</th>
                           <th class="px-4 py-3">MRP</th>
                           <th class="px-4 py-3">Expiry</th>
                           <th class="px-4 py-3 text-center">Action</th>
                        </tr>
                     </thead>
                     <tbody class="divide-y divide-slate-100 dark:divide-zinc-700">
                        <tr v-for="(batch, index) in form.batches" :key="index" class="bg-white dark:bg-zinc-900">
                           <td class="px-2 py-2">
                              <input type="text" v-model="batch.batch" class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" placeholder="Optional" />
                           </td>
                           <td class="px-2 py-2 w-20">
                              <input type="number" step="any" v-model="batch.qty" required class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" />
                           </td>
                           <td class="px-2 py-2 w-28">
                              <select v-model="batch.uom" required class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent">
                                 <option value="PCS">PCS</option>
                                 <option value="NOS">NOS</option>
                                 <option value="SET">SET</option>
                                 <option value="BOX">BOX</option>
                                 <option value="MTR">MTR</option>
                                 <option value="LTR">LTR</option>
                                 <option value="KGS">KGS</option>
                              </select>
                           </td>
                           <td class="px-2 py-2 w-24">
                              <input type="number" step="any" v-model="batch.rate" required class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" />
                           </td>
                           <td class="px-2 py-2 w-20">
                              <input type="number" step="any" v-model="batch.grate" required class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" />
                           </td>
                           <td class="px-2 py-2 w-24">
                              <input type="number" step="any" v-model="batch.mrp" class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" />
                           </td>
                           <td class="px-2 py-2 w-32">
                              <input type="date" v-model="batch.expiry" class="w-full px-2 py-2 border-b border-transparent focus:border-indigo-500 outline-none transition-all font-bold text-gray-900 dark:text-white bg-transparent" />
                           </td>
                           <td class="px-2 py-2 text-center">
                              <button type="button" @click="removeBatch(index)" class="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" :disabled="form.batches.length <= 1">
                                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                              </button>
                           </td>
                        </tr>
                     </tbody>
                  </table>
               </div>
               <p v-if="form.batches.length === 0" class="text-center py-8 text-slate-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-2xl">At least one batch is required for opening stock</p>
            </div>
         </form>
       </div>

       <footer class="p-8 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button type="button" @click="$emit('update:modelValue', false)" class="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Discard</button>
          <button type="submit" form="stock-form" :disabled="saving" class="px-10 py-3 bg-indigo-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
             <span v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
             Save Stock Item
          </button>
       </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);
const api = useApi();

const form = reactive({
  item: '',
  pno: '',
  oem: '',
  hsn: '',
  batches: [
    { batch: '', qty: 0, uom: 'PCS', rate: 0, grate: 18, mrp: 0, expiry: '' }
  ]
});

const saving = ref(false);

function addBatch() {
  form.batches.push({ batch: '', qty: 0, uom: 'PCS', rate: 0, grate: 18, mrp: 0, expiry: '' });
}

function removeBatch(index: number) {
  form.batches.splice(index, 1);
}

async function saveStock() {
  if (form.batches.length === 0) {
    alert('At least one batch is required');
    return;
  }

  saving.value = true;
  try {
    const res = await api.post('/inventory/movements', {
       type: 'OPENING',
       item: form.item,
       pno: form.pno,
       oem: form.oem,
       hsn: form.hsn,
       batches: form.batches
    });

    if (res.success) {
      emit('saved');
      emit('update:modelValue', false);
      resetForm();
    }
  } catch (err: any) {
    alert(err.message || 'Failed to create stock item');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    item: '',
    pno: '',
    oem: '',
    hsn: '',
    batches: [
      { batch: '', qty: 0, uom: 'PCS', rate: 0, grate: 18, mrp: 0, expiry: '' }
    ]
  });
}
</script>
