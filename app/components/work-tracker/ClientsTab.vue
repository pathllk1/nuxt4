<script setup lang="ts">
import { useWorkTracker } from '~/composables/useWorkTracker';

const state = useWorkTracker();
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- Header -->
    <div class="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
      <div>
        <h2 class="text-xs font-black uppercase tracking-tight text-gray-800">Clients & Account Statements</h2>
        <p class="text-[9px] text-gray-400 font-bold">Ledger breakdowns, contract balances, and billing rates</p>
      </div>
      <button
        @click="state.openAddClientModal()"
        class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
      >
        ➕ New Client
      </button>
    </div>

    <!-- Clients Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="c in state.clients.value"
        :key="c.id"
        class="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
      >
        <div>
          <div class="flex items-start justify-between pb-1.5">
            <div>
              <h3 class="text-xs font-black text-gray-900 leading-tight">{{ c.name }}</h3>
              <span class="text-[9px] text-gray-400 block font-mono">{{ c.phone || c.email || 'No contact specified' }}</span>
            </div>
            <span class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
              {{ c.billingType || 'per_work' }}
            </span>
          </div>

          <!-- Client summary metrics -->
          <div
            v-if="true"
            class="grid grid-cols-3 gap-1.5 my-2.5 p-2 bg-gray-50 rounded-lg border border-gray-200/80 text-center font-mono"
          >
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Billed</span>
              <span class="text-xs font-black text-gray-900">₹{{ state.getClientSummary(c.id).totalBilled.toLocaleString('en-IN') }}</span>
            </div>
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Paid</span>
              <span class="text-xs font-black text-emerald-600">₹{{ state.getClientSummary(c.id).totalPaid.toLocaleString('en-IN') }}</span>
            </div>
            <div>
              <span class="text-[8px] text-gray-400 uppercase block">Dues</span>
              <span class="text-xs font-black" :class="state.getClientSummary(c.id).outstanding > 0 ? 'text-amber-600' : 'text-gray-400'">
                ₹{{ state.getClientSummary(c.id).outstanding.toLocaleString('en-IN') }}
              </span>
            </div>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <button
              @click="state.openClientLedger(c)"
              class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-[10px] font-bold border border-indigo-200 transition cursor-pointer"
            >
              📖 Statement
            </button>
            <button
              v-if="state.getClientSummary(c.id).outstanding > 0"
              @click="state.openBulkSettlementModal(c.id)"
              title="Bulk Settle Dues"
              class="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-[10px] font-bold border border-amber-200 transition cursor-pointer"
            >
              ⚡ Settle
            </button>
          </div>
          <div class="flex items-center gap-1">
            <button @click="state.openAddWorkModal(c.id)" title="Assign Work" class="p-1 text-gray-400 hover:text-blue-600 bg-transparent border-0 cursor-pointer text-xs">
              ➕
            </button>
            <button @click="state.openEditClientModal(c)" title="Edit Client" class="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-xs">
              ✏️
            </button>
            <button @click="state.deleteClient(c.id)" title="Delete Client" class="p-1 text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div v-if="state.clients.value.length === 0" class="col-span-full text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
        No Clients Registered
      </div>
    </div>
  </div>
</template>
