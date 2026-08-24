<script setup lang="ts">
import { useWorkTracker } from '~/composables/useWorkTracker';

const state = useWorkTracker();
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- Header -->
    <div class="flex items-center justify-between bg-white p-2.5 rounded-xl border border-gray-200 shadow-xs">
      <div>
        <h2 class="text-xs font-black uppercase tracking-tight text-gray-800">Vaults & Cash Hub</h2>
        <p class="text-[9px] text-gray-400 font-bold">Multi-account liquidity and vault transfer ledger</p>
      </div>
      <div class="flex items-center gap-1.5">
        <button
          @click="state.openTransferModal()"
          class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
        >
          🔁 Transfer
        </button>
        <button
          @click="state.openAddWalletModal()"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition border-0 cursor-pointer shadow-xs"
        >
          ➕ New Vault
        </button>
      </div>
    </div>

    <!-- Vault Cards Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="w in state.wallets.value"
        :key="w.id"
        class="bg-white border border-gray-200 rounded-xl p-3.5 shadow-xs hover:shadow-sm transition flex flex-col justify-between"
      >
        <div class="flex items-start justify-between pb-2 border-b border-gray-100">
          <div>
            <span class="text-[8px] font-black uppercase tracking-widest text-gray-400 block">{{ w.type }}</span>
            <h3 class="text-xs font-black text-gray-900 mt-0.5">{{ w.name }}</h3>
          </div>
          <span class="w-3.5 h-3.5 rounded-full border border-gray-200 shadow-xs" :style="{ backgroundColor: w.color }"></span>
        </div>

        <div class="my-3">
          <span class="text-[9px] text-gray-400 font-bold uppercase block mb-0.5">Current Balance</span>
          <span class="text-xl font-black font-mono" :class="(w.currentBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
            ₹{{ (w.currentBalance || 0).toLocaleString('en-IN') }}
          </span>
          <div class="flex items-center gap-2 mt-1 text-[9px] text-gray-500 font-mono">
            <span>Initial: ₹{{ (w.initialBalance || 0).toLocaleString('en-IN') }}</span>
            <span>• In: ₹{{ (w.transfersIn || 0).toLocaleString('en-IN') }}</span>
          </div>
        </div>

        <div class="pt-2 border-t border-gray-100 flex items-center justify-between">
          <button
            @click="state.openWalletDetails(w)"
            class="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-[10px] font-bold transition border-0 cursor-pointer"
          >
            📜 Ledger
          </button>
          <div class="flex items-center gap-1">
            <button @click="state.openEditWalletModal(w)" class="p-1 text-gray-400 hover:text-gray-700 bg-transparent border-0 cursor-pointer text-xs">
              ✏️
            </button>
            <button @click="state.deleteWallet(w.id)" class="p-1 text-gray-400 hover:text-rose-600 bg-transparent border-0 cursor-pointer text-xs">
              🗑️
            </button>
          </div>
        </div>
      </div>

      <div v-if="state.wallets.value.length === 0" class="col-span-full text-center py-12 text-gray-400 font-bold text-xs uppercase tracking-wider">
        No Vaults Registered
      </div>
    </div>
  </div>
</template>
