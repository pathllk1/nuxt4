<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
    <div class="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-200 dark:border-zinc-800 animate-scale-in flex flex-col">
       <header class="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white flex justify-between items-center shrink-0">
          <div>
             <h2 class="text-2xl font-black uppercase tracking-tighter">Create New Party</h2>
             <p class="text-xs font-bold opacity-80 uppercase tracking-widest mt-1">Register a new customer or supplier with multiple locations</p>
          </div>
          <button @click="$emit('update:modelValue', false)" class="w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
             </svg>
          </button>
       </header>

       <div class="overflow-y-auto p-8 flex-1">
         <form @submit.prevent="saveParty" id="party-form" class="space-y-8">
            <!-- Basic Info -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div class="md:col-span-2">
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Party / Firm Name *</label>
                  <input type="text" v-model="form.name" required class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-800 focus:border-emerald-500 outline-none transition-all font-bold text-slate-900 dark:text-white" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Contact Number</label>
                  <input type="text" v-model="form.contact" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-800 focus:border-emerald-500 outline-none transition-all font-bold text-slate-900 dark:text-white" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">PAN Number</label>
                  <input type="text" v-model="form.pan" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-800 focus:border-emerald-500 outline-none transition-all font-mono font-bold uppercase text-slate-900 dark:text-white" maxlength="10" />
               </div>

               <div>
                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Party Type</label>
                  <select v-model="form.partyType" class="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border-2 border-transparent rounded-xl focus:bg-white dark:focus:bg-zinc-800 focus:border-emerald-500 outline-none transition-all font-bold appearance-none text-slate-900 dark:text-white">
                     <option value="CUSTOMER">Customer</option>
                     <option value="SUPPLIER">Supplier</option>
                     <option value="BOTH">Both (Customer & Supplier)</option>
                  </select>
               </div>
            </div>

            <!-- GST Locations Section -->
            <div class="space-y-4">
               <div class="flex items-center justify-between">
                  <h3 class="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">GST Registrations & Locations</h3>
                  <button type="button" @click="addLocation" class="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest hover:text-emerald-700 flex items-center gap-1">
                     <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4.5v15m7.5-7.5h-15"/></svg>
                     Add Location
                  </button>
               </div>

               <div class="space-y-4">
                  <div v-for="(loc, index) in form.gstLocations" :key="index" class="bg-slate-50 dark:bg-zinc-800/60 rounded-2xl border border-slate-200 dark:border-zinc-700 overflow-hidden p-6 relative transition-all" :class="{ 'ring-2 ring-emerald-500 ring-offset-2': loc.isPrimary }">
                     <div class="absolute top-4 right-4 flex items-center gap-3">
                        <label class="flex items-center gap-2 cursor-pointer">
                           <input type="radio" name="primaryGst" :checked="loc.isPrimary" @change="setPrimary(index)" class="w-4 h-4 text-emerald-600 focus:ring-emerald-500" />
                           <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Primary</span>
                        </label>
                        <button v-if="form.gstLocations.length > 1" type="button" @click="removeLocation(index)" class="p-2 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/40 rounded-lg transition-colors">
                           <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                     </div>

                     <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="md:col-span-1">
                           <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                              GSTIN
                              <span v-if="loc.fetchStatus === 'success'" class="text-[8px] text-emerald-600 font-black uppercase">Verified</span>
                              <span v-if="loc.fetchStatus === 'failed'" class="text-[8px] text-rose-600 font-black uppercase">Failed</span>
                           </label>
                           <div class="flex gap-2">
                              <input type="text" v-model="loc.gstin" maxlength="15" class="flex-1 px-3 py-2 bg-white dark:bg-zinc-800 border rounded-xl focus:ring-2 outline-none transition-all font-mono font-bold uppercase text-xs text-slate-900 dark:text-white" :class="loc.fetchStatus === 'success' ? 'border-emerald-500 ring-emerald-100' : (loc.fetchStatus === 'failed' ? 'border-rose-500 ring-rose-100' : 'border-slate-200 dark:border-zinc-700 focus:border-emerald-500')" placeholder="27ABCDE1234F1Z5" />
                              <button type="button" @click="fetchGstForLocation(index)" :disabled="loc.gstin.length !== 15 || fetchingGstIndices.has(index)" class="px-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl font-black text-[10px] uppercase tracking-widest border border-emerald-100 dark:border-emerald-900 hover:bg-emerald-100 disabled:opacity-50 min-w-[60px] flex items-center justify-center">
                                 <span v-if="fetchingGstIndices.has(index)" class="w-3 h-3 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></span>
                                 <span v-else>{{ loc.fetchStatus === 'success' ? 'Refresh' : 'Fetch' }}</span>
                              </button>
                           </div>
                        </div>
                        <div>
                           <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">State</label>
                           <input type="text" v-model="loc.state" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none transition-all font-bold text-xs text-slate-900 dark:text-white" />
                        </div>
                        <div>
                           <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pincode</label>
                           <input type="text" v-model="loc.pincode" maxlength="6" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none transition-all font-bold text-xs text-slate-900 dark:text-white" />
                        </div>
                        <div class="md:col-span-3">
                           <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</label>
                           <textarea v-model="loc.address" rows="2" class="w-full px-3 py-2 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl focus:border-emerald-500 outline-none transition-all font-medium text-xs resize-none text-slate-900 dark:text-white"></textarea>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </form>
       </div>

       <footer class="p-8 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-3 shrink-0">
          <button type="button" @click="$emit('update:modelValue', false)" class="px-6 py-3 text-slate-400 font-black uppercase text-xs tracking-widest hover:text-slate-600 transition-colors">Discard</button>
          <button type="submit" form="party-form" :disabled="saving" class="px-10 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2">
             <span v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
             Register Party
          </button>
       </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useApi } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);
const api = useApi();

const form = reactive({
  name: '',
  contact: '',
  pan: '',
  partyType: 'CUSTOMER',
  gstLocations: [
    { gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: true, fetchStatus: 'none' as 'none'|'success'|'failed' }
  ],
  openingBalance: 0,
  balanceType: 'DR'
});

const fetchingGstIndices = ref(new Set<number>());
const saving = ref(false);

watch(() => form.gstLocations, (locs) => {
  locs.forEach(loc => {
    const v = loc.gstin.toUpperCase();
    if (v.length >= 2 && /^\d{2}/.test(v)) {
      loc.stateCode = v.substring(0, 2);
    }
    if (v.length >= 12 && !form.pan) {
      form.pan = v.substring(2, 12);
    }
  });
}, { deep: true });

function addLocation() {
  form.gstLocations.push({ gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: false, fetchStatus: 'none' });
}

function removeLocation(index: number) {
  form.gstLocations.splice(index, 1);
  if (!form.gstLocations.some(l => l.isPrimary) && form.gstLocations.length > 0) {
    const firstLoc = form.gstLocations[0];
    if (firstLoc) firstLoc.isPrimary = true;
  }
}

function setPrimary(index: number) {
  form.gstLocations.forEach((l, i) => l.isPrimary = i === index);
}

async function fetchGstForLocation(index: number) {
  const loc = form.gstLocations[index];
  if (!loc || !loc.gstin || loc.gstin.length !== 15) return;
  
  fetchingGstIndices.value.add(index);
  loc.fetchStatus = 'none';

  try {
    const res = await api.get(`/accounting/gst/lookup?gstin=${loc.gstin}`);
    if (res.success && res.data) {
      const data = res.data;
      
      if (!form.name) {
        form.name = data.trade_name || data.legal_name || data.lgnm || data.tradeName || '';
      }
      
      let stateName = data.place_of_business_principal?.address?.state || 
                      data.state_jurisdiction || 
                      data.pradr?.addr?.stcd || 
                      data.stj || '';
      
      stateName = String(stateName).trim();
      if (stateName.includes(' - ')) stateName = stateName.split(' - ')[0].trim();
      loc.state = stateName;
      
      const addrObj = data.place_of_business_principal?.address || data.pradr?.addr || data.address;
      if (addrObj) {
        loc.address = [
          addrObj.door_num || addrObj.bnm || addrObj.bno, 
          addrObj.building_name || addrObj.loc || addrObj.dst, 
          addrObj.floor_num || addrObj.st,
          addrObj.street || addrObj.vtc, 
          addrObj.location, 
          addrObj.city, 
          addrObj.district
        ].filter(p => p && String(p).trim()).join(', ');
        
        const pinCode = addrObj.pin_code || addrObj.pncd || addrObj.pin || '';
        loc.pincode = /^\d{6}$/.test(String(pinCode).trim()) ? pinCode : '';
      }

      if (loc.gstin.length >= 2) loc.stateCode = loc.gstin.substring(0, 2);
      if (loc.gstin.length >= 12 && !form.pan) form.pan = loc.gstin.substring(2, 12);
      
      loc.fetchStatus = 'success';
    } else {
      loc.fetchStatus = 'failed';
    }
  } catch (err) {
    console.error('GST lookup failed', err);
    loc.fetchStatus = 'failed';
  } finally {
    fetchingGstIndices.value.delete(index);
  }
}

async function saveParty() {
  saving.value = true;
  try {
    const res = await api.post('/accounting/parties', form);
    if (res.success) {
      emit('saved', res.data);
      emit('update:modelValue', false);
      resetForm();
    }
  } catch (err: any) {
    alert(err.data?.error || err.message || 'Failed to save party');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    name: '',
    contact: '',
    pan: '',
    partyType: 'CUSTOMER',
    gstLocations: [
      { gstin: '', state: '', stateCode: '', address: '', pincode: '', contact: '', isPrimary: true, fetchStatus: 'none' }
    ],
    openingBalance: 0,
    balanceType: 'DR'
  });
}
</script>
