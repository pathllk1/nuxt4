<template>
  <div class="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans antialiased text-slate-900 dark:text-slate-100 flex flex-col">
    <!-- Top Responsive Portal Header (Desktop & Mobile) -->
    <header class="bg-gradient-to-r from-indigo-800 via-indigo-700 to-purple-800 text-white shadow-md z-30 sticky top-0">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <!-- Left: Branding & Member Profile -->
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/subcontractor/wallet"
            class="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center text-lg backdrop-blur-sm border border-white/20 shadow-xs hover:bg-white/25 transition no-underline text-white"
            title="Subcontractor Home"
          >
            🏗️
          </NuxtLink>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-sm sm:text-base font-black tracking-tight leading-tight truncate">
                {{ user?.name || 'Subcontractor' }}
              </span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-xs">
                Site Portal
              </span>
            </div>
            <p class="text-[11px] text-indigo-200 font-medium flex items-center gap-1.5 mt-0.5 truncate">
              <span>Direct Expense & Float</span>
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span class="text-emerald-300 font-bold">Online</span>
            </p>
          </div>
        </div>

        <!-- Center: Desktop Navigation Bar (Hidden on mobile; mobile uses bottom navigation) -->
        <nav class="hidden md:flex items-center gap-1.5 bg-white/10 p-1.5 rounded-2xl border border-white/15 backdrop-blur-sm shadow-xs">
          <NuxtLink
            to="/subcontractor/wallet"
            class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 no-underline"
            :class="route.path === '/subcontractor/wallet' ? 'bg-white text-indigo-900 shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/15'"
          >
            <span>👛</span>
            <span>Wallet & Balance</span>
          </NuxtLink>

          <NuxtLink
            to="/subcontractor/expenses"
            class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 no-underline"
            :class="route.path === '/subcontractor/expenses' ? 'bg-white text-indigo-900 shadow-sm' : 'text-white/85 hover:text-white hover:bg-white/15'"
          >
            <span>📋</span>
            <span>Site Slips</span>
          </NuxtLink>

          <NuxtLink
            to="/subcontractor/expense"
            class="px-4 py-2 rounded-xl text-xs font-extrabold transition flex items-center gap-2 no-underline bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm"
          >
            <span>➕</span>
            <span>Record Slip</span>
          </NuxtLink>
        </nav>

        <!-- Right: Actions -->
        <div class="flex items-center gap-2.5">
          <button
            @click="handleLogout"
            class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border border-white/20 shadow-xs"
            title="Logout from portal"
          >
            <span>Exit Portal</span>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content Area: Responsive Container -->
    <main class="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 md:pb-10">
      <slot />
    </main>

    <!-- Dedicated Bottom Mobile Navigation Bar (Mobile Only: hidden on md:) -->
    <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800/80 z-40 px-6 py-2 shadow-2xl">
      <div class="flex items-center justify-around relative max-w-md mx-auto">
        <!-- Wallet Tab -->
        <NuxtLink
          to="/subcontractor/wallet"
          class="flex flex-col items-center py-1 px-3 rounded-xl transition text-[10px] font-bold no-underline"
          :class="route.path === '/subcontractor/wallet' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
        >
          <span class="text-xl">👛</span>
          <span>Wallet</span>
        </NuxtLink>

        <!-- Floating Center Action: Add Slip -->
        <NuxtLink
          to="/subcontractor/expense"
          class="flex flex-col items-center -mt-6 bg-gradient-to-tr from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black p-3.5 rounded-full shadow-lg shadow-amber-500/40 border-4 border-slate-50 dark:border-slate-900 active:scale-95 transition no-underline"
          title="Log Site Expense Slip"
        >
          <span class="text-xl leading-none">➕</span>
        </NuxtLink>

        <!-- Site Slips Tab -->
        <NuxtLink
          to="/subcontractor/expenses"
          class="flex flex-col items-center py-1 px-3 rounded-xl transition text-[10px] font-bold no-underline"
          :class="route.path === '/subcontractor/expenses' ? 'text-indigo-600 dark:text-indigo-400 font-black' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'"
        >
          <span class="text-xl">📋</span>
          <span>Site Slips</span>
        </NuxtLink>
      </div>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from '../composables/useAuth';

const route = useRoute();
const router = useRouter();
const { user, logout } = useAuth();

const handleLogout = () => {
  if (confirm('Log out from Subcontractor Portal?')) {
    logout({ redirect: true });
    router.push('/login');
  }
};
</script>
