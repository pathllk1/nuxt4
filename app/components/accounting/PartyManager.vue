<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  state: any;
  title: string;
  emptySubtitle: string;
}>();

const emit = defineEmits(['open-modal', 'create-party', 'location-change']);

const handleConsigneeToggle = () => {
  if (props.state.consigneeSameAsBillTo && props.state.selectedParty) {
    const party = props.state.selectedParty;
    const loc = props.state.selectedPartyLocation;
    props.state.selectedConsignee = {
      name: party.name || party.firm,
      gstin: loc?.gstin || party.gstin || 'UNREGISTERED',
      address: loc?.address || party.address || '',
      state: loc?.state || party.state || '',
      stateCode: loc?.stateCode || party.stateCode || '',
      pin: loc?.pincode || party.pin || '',
    };
  }
};

const onPartyGstinChange = (e: Event) => {
  const selectedGstin = (e.target as HTMLSelectElement).value;
  const party = props.state.selectedParty;
  if (!party || !party.gstLocations) return;

  const loc = party.gstLocations.find((l: any) => l.gstin === selectedGstin);
  if (loc) {
    props.state.selectedPartyLocation = loc;
    props.state.selectedPartyGstin = loc.gstin;
    emit('location-change', loc);
  }
};
</script>

<template>
  <section class="bg-white dark:bg-zinc-900/80 rounded-2xl p-5 border border-slate-200 dark:border-zinc-800 shadow-sm space-y-4">
    <header class="flex justify-between items-center">
      <div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Party</p>
        <h2 class="text-base font-bold text-slate-900 dark:text-white">{{ title }}</h2>
      </div>
      <button v-if="!state.isReturnMode" class="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline" type="button" @click="$emit('create-party')">
        + New
      </button>
    </header>

    <button v-if="!state.selectedParty" class="w-full py-6 px-4 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center text-slate-500 dark:text-zinc-400 hover:border-indigo-500 transition-colors" type="button" @click="$emit('open-modal')">
      <span class="font-bold text-sm text-slate-800 dark:text-zinc-200">Select party</span>
      <small class="text-xs text-slate-400 dark:text-zinc-500 mt-1">{{ emptySubtitle }}</small>
    </button>

    <div v-else class="space-y-3">
      <div class="flex justify-between items-start">
        <div class="min-w-0">
          <h3 class="font-bold text-sm text-slate-900 dark:text-white truncate">{{ state.selectedParty.name }}</h3>
          <p class="text-xs font-mono text-indigo-600 dark:text-indigo-400 font-bold mt-0.5">{{ state.selectedPartyGstin || 'UNREGISTERED' }}</p>
        </div>
        <button v-if="!state.isReturnMode" class="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors px-2 py-1 bg-slate-100 dark:bg-zinc-800 rounded-lg" type="button" @click="$emit('open-modal')">
          Change
        </button>
      </div>

      <div v-if="state.gstEnabled && state.selectedParty?.gstLocations?.length > 1" class="space-y-1">
        <label class="block text-[10px] font-black text-slate-400 uppercase">
          <span>Billing to GSTIN</span>
          <select 
            :value="state.selectedPartyLocation?.gstin || state.selectedPartyGstin || ''" 
            @change="onPartyGstinChange" 
            class="w-full mt-1 px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs font-bold"
          >
            <option 
              v-for="loc in state.selectedParty.gstLocations" 
              :key="loc.gstin || loc.stateCode || loc.state" 
              :value="loc.gstin || ''"
            >
              {{ loc.gstin || 'UNREGISTERED' }} - {{ loc.state || loc.stateCode || '' }}{{ loc.isPrimary ? ' (Primary)' : '' }}
            </option>
          </select>
        </label>
      </div>

      <dl class="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100 dark:border-zinc-800">
        <div>
          <dt class="text-[10px] text-slate-400 uppercase font-bold">State</dt>
          <dd class="font-semibold text-slate-700 dark:text-zinc-300">{{ state.selectedPartyLocation?.state || state.selectedParty.state || '-' }}</dd>
        </div>
        <div>
          <dt class="text-[10px] text-slate-400 uppercase font-bold">Address</dt>
          <dd class="font-semibold text-slate-700 dark:text-zinc-300 truncate">{{ state.selectedPartyLocation?.address || state.selectedParty.address || '-' }}</dd>
        </div>
      </dl>
    </div>

    <div class="pt-3 border-t border-slate-100 dark:border-zinc-800 space-y-3">
      <label class="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 dark:text-zinc-300">
        <input v-model="state.consigneeSameAsBillTo" type="checkbox" @change="handleConsigneeToggle" class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
        <span>Ship to billing address</span>
      </label>

      <div v-if="!state.consigneeSameAsBillTo && state.selectedConsignee" class="space-y-2 pt-2 text-xs">
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Consignee Name</label>
          <input v-model="state.selectedConsignee.name" type="text" placeholder="Consignee name" class="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold" />
        </div>
        <div>
          <label class="block text-[10px] font-bold text-slate-400 uppercase">Delivery Address</label>
          <textarea v-model="state.selectedConsignee.address" rows="2" placeholder="Delivery address" class="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold"></textarea>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div v-if="state.gstEnabled">
            <label class="block text-[10px] font-bold text-slate-400 uppercase">Consignee GSTIN</label>
            <input v-model="state.selectedConsignee.gstin" type="text" maxlength="15" placeholder="GSTIN" class="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-mono font-bold uppercase" />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase">State</label>
            <input v-model="state.selectedConsignee.state" type="text" placeholder="State" class="w-full px-3 py-1.5 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg font-bold" />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
