<script setup lang="ts">
import { onMounted } from 'vue';
import { useWorkTracker } from '~/composables/useWorkTracker';
import DashboardTab from '~/components/work-tracker/DashboardTab.vue';
import WorksTab from '~/components/work-tracker/WorksTab.vue';
import PaymentsTab from '~/components/work-tracker/PaymentsTab.vue';
import ExpensesTab from '~/components/work-tracker/ExpensesTab.vue';
import ReceiptsTab from '~/components/work-tracker/ReceiptsTab.vue';
import WalletsTab from '~/components/work-tracker/WalletsTab.vue';
import ClientsTab from '~/components/work-tracker/ClientsTab.vue';
import ReportsTab from '~/components/work-tracker/ReportsTab.vue';
import TemplatesTab from '~/components/work-tracker/TemplatesTab.vue';
import BudgetsTab from '~/components/work-tracker/BudgetsTab.vue';
import SettingsTab from '~/components/work-tracker/SettingsTab.vue';
import ModalsContainer from '~/components/work-tracker/ModalsContainer.vue';

definePageMeta({
  layout: 'default'
});

useSeoMeta({
  title: 'Work vs Payment Tracker — Accounting Suite'
});

const state = useWorkTracker();

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'works', label: 'Work Orders', icon: '📋' },
  { id: 'payments', label: 'Payments', icon: '💰' },
  { id: 'expenses', label: 'Expenses', icon: '💸' },
  { id: 'receipts', label: 'Receipts', icon: '📥' },
  { id: 'wallets', label: 'Vaults', icon: '🏦' },
  { id: 'clients', label: 'Clients', icon: '👥' },
  { id: 'reports', label: 'Reports', icon: '📈' },
  { id: 'templates', label: 'Retainers', icon: '🔄' },
  { id: 'budgets', label: 'Budgets', icon: '🎯' },
  { id: 'settings', label: 'Settings', icon: '⚙️' }
];

onMounted(() => {
  state.loadAllData();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col pb-10 w-full">
    <!-- Toast Stack -->
    <div class="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      <div
        v-for="toast in state.toasts.value"
        :key="toast.id"
        class="pointer-events-auto px-3.5 py-2.5 rounded-xl shadow-lg border text-xs font-bold flex items-center justify-between gap-2 transition-all"
        :class="{
          'bg-emerald-50 text-emerald-800 border-emerald-300': toast.type === 'success',
          'bg-rose-50 text-rose-800 border-rose-300': toast.type === 'error',
          'bg-amber-50 text-amber-800 border-amber-300': toast.type === 'warning',
          'bg-blue-50 text-blue-800 border-blue-300': toast.type === 'info'
        }"
      >
        <span>{{ toast.message }}</span>
      </div>
    </div>

    <!-- Top Action Header -->
    <header class="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
      <div class="flex items-center gap-3">
        <NuxtLink
          to="/accounting"
          title="Back to Accounting Hub"
          class="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-black border border-blue-200 transition"
        >
          ←
        </NuxtLink>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-sm sm:text-base font-black tracking-tight uppercase text-gray-900 leading-none">
              Work vs Payment Tracker
            </h1>
            <span class="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
              FIREBASE SERVER
            </span>
          </div>
          <p class="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
            Contract Billing, Ledger & Cash Hub
          </p>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-2">
        <button
          @click="state.openAddWorkModal()"
          class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition border-0 cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <span>➕</span>
          <span class="hidden sm:inline">New Work</span>
        </button>

        <button
          @click="state.openAddPaymentModal()"
          class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition border-0 cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <span>💰</span>
          <span class="hidden sm:inline">Record Payment</span>
        </button>

        <button
          @click="state.openBulkSettlementModal()"
          class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-lg transition border-0 cursor-pointer shadow-xs flex items-center gap-1.5"
        >
          <span>⚡</span>
          <span class="hidden sm:inline">Bulk Settlement</span>
        </button>
      </div>
    </header>

    <!-- Navigation Tab Bar -->
    <nav class="bg-white border-b border-gray-200 px-4 sm:px-6 overflow-x-auto custom-scrollbar flex items-center gap-1 py-1.5 shrink-0 shadow-xs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="state.activeTab.value = tab.id"
        class="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition border-0 cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
        :class="state.activeTab.value === tab.id
          ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs font-black'
          : 'bg-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100'"
      >
        <span>{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Tab Content Views -->
    <main class="flex-1 p-3 sm:p-4 w-full">
      <DashboardTab v-if="state.activeTab.value === 'dashboard'" />
      <WorksTab v-else-if="state.activeTab.value === 'works'" />
      <PaymentsTab v-else-if="state.activeTab.value === 'payments'" />
      <ExpensesTab v-else-if="state.activeTab.value === 'expenses'" />
      <ReceiptsTab v-else-if="state.activeTab.value === 'receipts'" />
      <WalletsTab v-else-if="state.activeTab.value === 'wallets'" />
      <ClientsTab v-else-if="state.activeTab.value === 'clients'" />
      <ReportsTab v-else-if="state.activeTab.value === 'reports'" />
      <TemplatesTab v-else-if="state.activeTab.value === 'templates'" />
      <BudgetsTab v-else-if="state.activeTab.value === 'budgets'" />
      <SettingsTab v-else-if="state.activeTab.value === 'settings'" />
    </main>

    <!-- Modals Container -->
    <ModalsContainer />
  </div>
</template>
