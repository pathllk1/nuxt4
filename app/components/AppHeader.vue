<template>
  <header class="w-full fixed top-0 bg-gradient-to-r from-teal-400 via-indigo-500 to-teal-400 shadow py-2 px-6 z-50 text-white">
    <nav class="container mx-auto flex justify-between items-center">
      <!-- Brand / Logo -->
      <div class="font-bold text-xl text-white drop-shadow flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <NuxtLink to="/" class="text-white hover:text-teal-100 transition duration-400 no-underline">
          BusinessPro Suite
        </NuxtLink>
      </div>

      <!-- Session / Token Timer (Desktop) -->
      <div v-if="isAuthenticated" class="hidden lg:flex items-center space-x-3 text-xs text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/20">
        <span>User: <strong class="text-white">{{ user?.name || user?.email }}</strong></span>
        <span class="text-white/40">|</span>
        <span>Role: <strong class="text-yellow-200 uppercase">{{ user?.role || 'user' }}</strong></span>
        <span class="text-white/40">|</span>
        <span class="inline-flex items-center gap-1.5 text-emerald-200 text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Active Session
        </span>
      </div>

      <!-- Desktop Navigation Links -->
      <div class="hidden md:flex items-center space-x-4">
        <button @click="openGlobalTools" class="text-white hover:text-teal-200 transition duration-300 bg-transparent border-0 cursor-pointer text-sm font-medium flex items-center gap-1">
          🛠️ Tools
        </button>

        <template v-if="isAuthenticated">
          <NuxtLink to="/chat" class="text-white hover:text-teal-100 font-medium bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded transition duration-300 no-underline text-sm flex items-center gap-1.5">
            💬 Chat
          </NuxtLink>

          <NuxtLink v-if="user?.role === 'superadmin'" to="/superadmin" class="text-yellow-200 hover:text-white font-bold bg-white/20 px-2.5 py-1 rounded transition duration-300 no-underline text-sm">
            👑 Admin
          </NuxtLink>
          
          <button @click="logout" class="ml-2 bg-white/20 hover:bg-white/30 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition duration-300 cursor-pointer border border-white/30">
            Logout
          </button>
        </template>

        <template v-else>
          <NuxtLink to="/login" class="bg-white/20 hover:bg-white/30 text-white px-4 py-1.5 rounded-lg text-xs font-semibold transition duration-300 border border-white/30 no-underline">
            Login
          </NuxtLink>
        </template>
      </div>

      <!-- Mobile Menu Toggle Button -->
      <button class="text-white focus:outline-none md:hidden bg-transparent border-0 cursor-pointer p-1" @click="toggleMobileMenu" aria-label="Toggle menu">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6">
          <path v-if="!isMobileMenuOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </nav>

    <!-- Mobile Dropdown Menu -->
    <div v-if="isMobileMenuOpen" class="md:hidden mt-3 pt-3 border-t border-white/20 bg-teal-600/95 backdrop-blur-md rounded-xl p-4 space-y-2 max-h-[75vh] overflow-y-auto">
      <NuxtLink to="/" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Home</NuxtLink>
      <NuxtLink to="/about" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">About</NuxtLink>
      <NuxtLink to="/weather" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">☀️ Weather</NuxtLink>
      <button @click="openGlobalTools(); isMobileMenuOpen = false" class="w-full text-left px-3 py-1.5 rounded text-white hover:bg-white/20 bg-transparent border-0 cursor-pointer text-sm">🛠️ Tools</button>

      <template v-if="isAuthenticated">
        <!-- Mobile User Session Info & Token Timer -->
        <div class="px-3 py-2 bg-white/10 rounded-lg flex items-center justify-between text-xs text-white/90 mb-2 border border-white/10">
          <div>
            <div class="font-semibold text-white">{{ user?.name || user?.email }}</div>
            <div class="text-[10px] text-yellow-200 uppercase">{{ user?.role || 'user' }}</div>
          </div>
          <span class="inline-flex items-center gap-1 text-emerald-200 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Active
          </span>
        </div>

        <NuxtLink v-if="user?.role === 'superadmin'" to="/superadmin" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-yellow-200 font-bold bg-white/20 no-underline text-sm">👑 Admin Panel</NuxtLink>
        <NuxtLink to="/chat" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm font-semibold">💬 1-on-1 Chat</NuxtLink>
        <NuxtLink to="/dashboard" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Dashboard</NuxtLink>
        <NuxtLink to="/documents" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Docs</NuxtLink>
        <NuxtLink to="/accounting/ledger" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Cash & Ledger</NuxtLink>
        <NuxtLink to="/wages" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Wages Center</NuxtLink>
        <NuxtLink to="/master-roll" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Master Roll</NuxtLink>
        <NuxtLink to="/inventory" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Stock & Items</NuxtLink>
        <NuxtLink to="/labor" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">Labor System</NuxtLink>
        <NuxtLink to="/ai-chat" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-white hover:bg-white/20 no-underline text-sm">✨ AI Assistant</NuxtLink>
        <button @click="logout(); isMobileMenuOpen = false" class="w-full text-left px-3 py-1.5 rounded text-rose-200 font-bold bg-rose-500/30 border-0 cursor-pointer mt-2 text-sm">Logout</button>
      </template>
      <template v-else>
        <NuxtLink to="/login" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-center text-white bg-white/20 font-bold mt-2 no-underline text-sm">Login</NuxtLink>
      </template>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { useGlobalTools } from '~/composables/useGlobalTools';

const { user, isAuthenticated, logout } = useAuth();
const { openLauncher } = useGlobalTools();
const isMobileMenuOpen = ref(false);

// Auto-refresh check when tab becomes visible or gains focus
const handleVisibilityOrFocus = async () => {
  if (document.visibilityState === 'visible' && isAuthenticated.value) {
    // Re-verify session with server — auth.global.ts on /api/auth/me auto-refreshes if needed
    const { initAuth } = useAuth();
    await initAuth({ force: true }).catch(() => null);
  }
};

onMounted(() => {
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
  }
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    window.removeEventListener('focus', handleVisibilityOrFocus);
  }
});

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const openGlobalTools = () => {
  openLauncher();
};
</script>
