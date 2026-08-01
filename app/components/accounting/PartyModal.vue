<script setup lang="ts">
import { ref, reactive } from 'vue';

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const form = reactive({
  name: '',
  contact: '',
  pan: '',
  partyType: 'CUSTOMER',
  gstin: 'UNREGISTERED',
  state: '',
  stateCode: '',
  address: '',
  pin: '',
  openingBalance: 0,
  balanceType: 'DR',
  gstLocations: [] as any[],
});

const addLocation = () => {
  form.gstLocations.push({
    gstin: '',
    state: '',
    stateCode: '',
    address: '',
    pincode: '',
    isPrimary: form.gstLocations.length === 0,
  });
};

const setPrimary = (index: number) => {
  form.gstLocations.forEach((loc, i) => {
    loc.isPrimary = (i === index);
  });
};

const removeLocation = (index: number) => {
  form.gstLocations.splice(index, 1);
  if (form.gstLocations.length > 0 && !form.gstLocations.some(l => l.isPrimary)) {
    form.gstLocations[0].isPrimary = true;
  }
};

const saving = ref(false);
const saveParty = async () => {
  if (!form.name.trim()) return;
  saving.value = true;
  try {
    const res = await $fetch<{ success: boolean; data: any }>('/api/accounting/parties', {
      method: 'POST',
      body: form,
    });
    if (res.success) {
      emit('saved', res.data);
      emit('update:modelValue', false);
    }
  } catch (err: any) {
    alert(err.data?.message || err.message || 'Failed to create party');
  } finally {
    saving.value = false;
  }
};
</script>

<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
    <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
      <header class="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-white flex justify-between items-center shrink-0">
        <div>
          <h2 class="text-lg font-black uppercase tracking-tight">Create New Party</h2>
          <p class="text-xs opacity-80">Register customer or supplier with GST details</p>
        </div>
        <button @click="$emit('update:modelValue', false)" class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
          ✕
        </button>
      </header>

      <div class="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
        <form @submit.prevent="saveParty" id="party-modal-form" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="md:col-span-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Party / Firm Name *</label>
              <input type="text" v-model="form.name" required class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contact Number</label>
              <input type="text" v-model="form.contact" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">PAN Number</label>
              <input type="text" v-model="form.pan" maxlength="10" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold uppercase outline-none" />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Party Type</label>
              <select v-model="form.partyType" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none">
                <option value="CUSTOMER">Customer</option>
                <option value="SUPPLIER">Supplier</option>
                <option value="BOTH">Both (Customer & Supplier)</option>
              </select>
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Primary GSTIN</label>
              <input type="text" v-model="form.gstin" placeholder="UNREGISTERED or GSTIN" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold uppercase outline-none" />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">State</label>
              <input type="text" v-model="form.state" placeholder="State name" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none" />
            </div>

            <div>
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">State Code (2 digits)</label>
              <input type="text" v-model="form.stateCode" maxlength="2" placeholder="e.g. 27" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-mono font-bold outline-none" />
            </div>

            <div class="md:col-span-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Billing Address</label>
              <textarea v-model="form.address" rows="2" placeholder="Complete address" class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl font-bold outline-none"></textarea>
            </div>
          </div>
        </form>
      </div>

      <footer class="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-2">
        <button type="button" @click="$emit('update:modelValue', false)" class="px-4 py-2 bg-slate-200 dark:bg-zinc-700 hover:bg-slate-300 text-slate-800 dark:text-zinc-200 rounded-xl font-bold text-xs transition-colors">
          Cancel
        </button>
        <button type="submit" form="party-modal-form" :disabled="saving" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors shadow-sm">
          {{ saving ? 'Saving...' : 'Register Party' }}
        </button>
      </footer>
    </div>
  </div>
</template>
