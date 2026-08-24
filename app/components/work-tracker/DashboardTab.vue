<script setup lang="ts">
import { computed } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';

const state = useWorkTracker();

const attentionWorks = computed(() => {
  return state.works.value
    .filter(w => w.paymentStatusObj?.status !== 'paid')
    .slice(0, 10);
});

const recentActivities = computed(() => {
  const acts: { title: string; subtitle: string; date: string }[] = [];

  for (const p of state.payments.value.slice(0, 4)) {
    acts.push({
      title: `Payment Received: ₹${Number(p.amount).toLocaleString('en-IN')}`,
      subtitle: `${p.clientName || 'Client'} • via ${p.method}`,
      date: p.date
    });
  }

  for (const w of state.works.value.slice(0, 4)) {
    acts.push({
      title: `Work Order: ${w.workType}`,
      subtitle: `${w.clientName || 'Client'} • Assigned ${w.dateAssigned}`,
      date: w.dateAssigned
    });
  }

  return acts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6);
});
</script>

<template>
  <div class="space-y-3 font-sans text-xs">
    <!-- KPI Metric Row -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-emerald-500 hover:shadow-sm transition">
        <span class="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Income Inflows</span>
        <span class="text-lg sm:text-xl font-black font-mono text-emerald-600">₹{{ state.dashboardStats.value.income.toLocaleString('en-IN') }}</span>
        <span class="text-[9px] font-bold text-gray-400 block mt-0.5">Payments & Inflows</span>
      </div>

      <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-rose-500 hover:shadow-sm transition">
        <span class="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Total Expenses</span>
        <span class="text-lg sm:text-xl font-black font-mono text-rose-600">₹{{ state.dashboardStats.value.expenses.toLocaleString('en-IN') }}</span>
        <span class="text-[9px] font-bold text-gray-400 block mt-0.5">Operational Costs</span>
      </div>

      <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-blue-500 hover:shadow-sm transition">
        <span class="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Net Profit Margin</span>
        <span class="text-lg sm:text-xl font-black font-mono" :class="state.dashboardStats.value.netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'">
          ₹{{ state.dashboardStats.value.netProfit.toLocaleString('en-IN') }}
        </span>
        <span class="text-[9px] font-bold text-gray-400 block mt-0.5">Net Operating Margin</span>
      </div>

      <div class="bg-white p-3 rounded-xl border border-gray-200 shadow-xs border-l-4 border-l-amber-500 hover:shadow-sm transition">
        <span class="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-0.5">Outstanding Dues</span>
        <span class="text-lg sm:text-xl font-black font-mono text-amber-600">₹{{ state.dashboardStats.value.outstanding.toLocaleString('en-IN') }}</span>
        <span class="text-[9px] font-bold text-gray-400 block mt-0.5">Pending Client Balances</span>
      </div>
    </div>

    <!-- Secondary Row: Vault Reserves & Attention Required -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
      <!-- Vault Reserves -->
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs flex flex-col">
        <div class="flex items-center justify-between pb-2 border-b border-gray-100 mb-2.5">
          <div>
            <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Vault & Cash Reserves</h3>
            <span class="text-[9px] text-gray-400 font-bold">Total Liquid Positions</span>
          </div>
          <span class="text-sm font-black font-mono text-emerald-600">₹{{ state.dashboardStats.value.vaultBalance.toLocaleString('en-IN') }}</span>
        </div>

        <div class="space-y-1.5 flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
          <div
            v-for="w in state.wallets.value"
            :key="w.id"
            class="p-2 bg-gray-50 border border-gray-200/80 rounded-lg flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: w.color }"></span>
              <div>
                <span class="text-xs font-bold text-gray-800 block leading-tight">{{ w.name }}</span>
                <span class="text-[8px] text-gray-400 uppercase font-mono">{{ w.type }}</span>
              </div>
            </div>
            <span class="text-xs font-black font-mono" :class="(w.currentBalance || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'">
              ₹{{ (w.currentBalance || 0).toLocaleString('en-IN') }}
            </span>
          </div>
          <div v-if="state.wallets.value.length === 0" class="text-center py-6 text-gray-400 text-[10px] font-bold">
            No vaults registered.
          </div>
        </div>

        <div class="pt-2 mt-2 border-t border-gray-100 flex gap-2">
          <button
            @click="state.openAddWalletModal()"
            class="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[10px] font-black uppercase tracking-wider transition border-0 cursor-pointer"
          >
            + New Vault
          </button>
          <button
            @click="state.openTransferModal()"
            class="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer"
          >
            Transfer
          </button>
        </div>
      </div>

      <!-- Attention Required Works -->
      <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs lg:col-span-2 flex flex-col">
        <div class="flex items-center justify-between pb-2 border-b border-gray-100 mb-2.5">
          <div>
            <h3 class="text-xs font-black uppercase tracking-wider text-gray-800">Pending & Attention Required</h3>
            <span class="text-[9px] text-gray-400 font-bold">Unpaid or Amount TBD Contracts</span>
          </div>
          <button
            @click="state.activeTab.value = 'works'"
            class="text-[10px] font-bold text-blue-600 hover:underline bg-transparent border-0 cursor-pointer"
          >
            View All Works →
          </button>
        </div>

        <div class="space-y-1.5 flex-1 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
          <div
            v-for="w in attentionWorks"
            :key="w.id"
            class="p-2 bg-gray-50 border border-gray-200/80 rounded-lg flex items-center justify-between gap-2 hover:bg-gray-100/60 transition"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-black text-gray-800 truncate">{{ w.workType }}</span>
                <span
                  class="text-[8px] px-1.5 py-0.2 rounded font-black uppercase"
                  :class="w.paymentStatusObj?.status === 'unpaid' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-gray-200 text-gray-700'"
                >
                  {{ w.paymentStatusObj?.label }}
                </span>
              </div>
              <span class="text-[9px] text-gray-500 block truncate">{{ w.clientName }} • Assigned {{ w.dateAssigned }}</span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="text-xs font-mono font-black text-amber-600">
                ₹{{ (w.pendingAmount || w.totalAmount || 0).toLocaleString('en-IN') }}
              </span>
              <button
                @click="state.openAddPaymentModal(w.clientId, w.id)"
                class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-black uppercase cursor-pointer"
              >
                Receive
              </button>
            </div>
          </div>
          <div v-if="attentionWorks.length === 0" class="text-center py-8 text-gray-400 text-xs font-bold">
            ✨ All work contracts are fully settled!
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Timeline Activity -->
    <div class="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
      <h3 class="text-xs font-black uppercase tracking-wider text-gray-800 mb-2">Recent Activity Feed</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        <div
          v-for="(act, idx) in recentActivities"
          :key="idx"
          class="p-2 bg-gray-50 border border-gray-200/80 rounded-lg flex items-center justify-between gap-2"
        >
          <div class="min-w-0">
            <span class="text-xs font-bold text-gray-800 block truncate">{{ act.title }}</span>
            <span class="text-[9px] text-gray-500 block truncate">{{ act.subtitle }}</span>
          </div>
          <span class="text-[8px] font-mono text-gray-400 shrink-0">{{ act.date }}</span>
        </div>
        <div v-if="recentActivities.length === 0" class="col-span-full text-center py-4 text-gray-400 text-[10px] font-bold">
          No recent activity recorded.
        </div>
      </div>
    </div>
  </div>
</template>
