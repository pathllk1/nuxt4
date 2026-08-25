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

    <!-- Google OAuth Connection Banner (if not linked) -->
    <div
      v-if="!state.firebaseAuth.isLinked.value"
      class="mx-3 sm:mx-6 mt-3 bg-gradient-to-r from-blue-900 to-indigo-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-blue-700/50 flex flex-col md:flex-row items-center justify-between gap-4"
    >
      <div class="space-y-1.5 text-center md:text-left">
        <div class="flex items-center justify-center md:justify-start gap-2">
          <span class="text-xl">🔥</span>
          <h2 class="text-sm sm:text-base font-black uppercase tracking-wider text-white">
            Connect Your Google Workspace
          </h2>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-blue-500/30 text-blue-200 border border-blue-400/30">
            Cloud Sync Required
          </span>
        </div>
        <p class="text-xs text-blue-200 max-w-xl font-normal">
          Work orders, payments, vault ledgers, and expenses are encrypted and synced to your private Google Firestore database. Connect your Google account to initialize your personal workspace.
        </p>
        <p v-if="state.firebaseAuth.authError.value" class="text-xs text-rose-300 font-bold">
          ⚠️ {{ state.firebaseAuth.authError.value }}
        </p>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <button
          @click="async () => { const res = await state.firebaseAuth.signInWithGoogle(); if (res.success) state.loadAllData(); }"
          :disabled="state.firebaseAuth.isAuthenticating.value"
          class="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-900 text-xs font-black uppercase tracking-wider rounded-xl transition border-0 cursor-pointer shadow-lg flex items-center gap-2.5 disabled:opacity-50"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>{{ state.firebaseAuth.isAuthenticating.value ? 'Connecting...' : 'Sign in with Google' }}</span>
        </button>
      </div>
    </div>

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
