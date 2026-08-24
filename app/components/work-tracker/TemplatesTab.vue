<script setup lang="ts">
import { useWorkTracker } from '~/composables/useWorkTracker';

const state = useWorkTracker();

const getClientName = (clientId: number) => {
  const c = state.clients.value.find(item => item.id === clientId);
  return c ? c.name : 'Unknown Client';
};
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- Toolbar -->
    <div class="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
      <div>
        <h2 class="text-xs font-black uppercase tracking-tight text-gray-800">Recurring Contract Retainers</h2>
        <p class="text-[9px] text-gray-400 font-bold">Auto-generate routine monthly retainers and recurring billing</p>
      </div>

      <div class="flex items-center gap-2">
        <input
          v-model="state.selectedMonthForGeneration.value"
          type="month"
          class="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 outline-none"
        />
        <button
          @click="state.generateWorksFromTemplates()"
          class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
        >
          ⚡ Generate Month
        </button>
        <button
          @click="state.openAddTemplateModal()"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
        >
          ➕ New Template
        </button>
      </div>
    </div>

    <!-- Templates Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="tmpl in state.recurringTemplates.value"
        :key="tmpl.id"
        class="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
      >
        <div>
          <div class="flex items-center justify-between mb-1.5 pb-1 border-b border-gray-100">
            <span class="text-xs font-black text-gray-900">{{ tmpl.workType }}</span>
            <span
              class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase"
              :class="tmpl.isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500'"
            >
              {{ tmpl.isActive ? 'Active' : 'Paused' }}
            </span>
          </div>
          <span class="text-[10px] text-gray-500 font-bold block">{{ getClientName(tmpl.clientId) }}</span>
          <span class="text-lg font-black font-mono text-emerald-600 block my-2">₹{{ tmpl.fixedAmount.toLocaleString('en-IN') }}</span>
          <p class="text-[10px] text-gray-400 font-normal">{{ tmpl.description || 'Monthly recurring contract' }}</p>
        </div>

        <div class="pt-2 mt-2 border-t border-gray-100 flex items-center justify-end gap-1">
          <button @click="state.openEditTemplateModal(tmpl)" class="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-xs">
            ✏️
          </button>
          <button @click="state.deleteTemplate(tmpl.id)" class="p-1 text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs">
            🗑️
          </button>
        </div>
      </div>

      <div v-if="state.recurringTemplates.value.length === 0" class="col-span-full text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
        No Recurring Retainers Configured
      </div>
    </div>
  </div>
</template>
