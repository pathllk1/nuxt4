<template>
  <header class="w-full fixed top-0 bg-gradient-to-r from-teal-400 via-indigo-500 to-teal-400 shadow py-2 px-6 z-50 text-white">
    <nav class="container mx-auto flex justify-between items-center">
      <!-- Brand / Logo -->
      <div class="font-bold text-xl text-white drop-shadow flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        <NuxtLink to="/" class="text-white hover:text-teal-100 transition duration-300 no-underline">
          BusinessPro Suite
        </NuxtLink>
      </div>

      <!-- Session / Token Timer (Desktop) -->
      <div v-if="isAuthenticated" class="hidden lg:flex items-center space-x-3 text-xs text-white/90 bg-white/10 px-3 py-1 rounded-full border border-white/20">
        <span>User: <strong class="text-white">{{ user?.name || user?.email }}</strong></span>
        <span class="text-white/40">|</span>
        <span>Role: <strong class="text-yellow-200 uppercase">{{ user?.role || 'user' }}</strong></span>
        <span class="text-white/40">|</span>
        <!-- Countdown Timer -->
        <div 
          class="text-[11px] font-mono px-2.5 py-0.5 rounded-full flex items-center gap-1.5 transition-all duration-300"
          :class="[
            remainingTime <= 120 
              ? 'bg-amber-500/30 text-amber-200 border border-amber-400/50' 
              : 'bg-teal-500/30 text-teal-100 border border-teal-300/40'
          ]"
          title="Access Token Expiry Countdown"
        >
          <UIcon 
            name="i-heroicons-clock" 
            class="w-3.5 h-3.5"
            :class="{ 'animate-pulse text-amber-300': remainingTime <= 120 }" 
          />
          <span>Token: {{ formatTime(remainingTime) }}</span>
        </div>
      </div>

      <!-- Desktop Navigation Links -->
      <div class="hidden md:flex items-center space-x-4">
        <button @click="openGlobalTools" class="text-white hover:text-teal-200 transition duration-300 bg-transparent border-0 cursor-pointer text-sm font-medium flex items-center gap-1">
          🛠️ Tools
        </button>

        <template v-if="isAuthenticated">
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
          <div 
            class="text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1 border shrink-0 transition-colors"
            :class="[
              remainingTime <= 120 
                ? 'bg-amber-500/30 text-amber-200 border-amber-400/50' 
                : 'bg-teal-500/30 text-teal-100 border-teal-300/40'
            ]"
          >
            <UIcon name="i-heroicons-clock" class="w-3 h-3" :class="{ 'animate-pulse text-amber-300': remainingTime <= 120 }" />
            <span>{{ formatTime(remainingTime) }}</span>
          </div>
        </div>

        <NuxtLink v-if="user?.role === 'superadmin'" to="/superadmin" @click="isMobileMenuOpen = false" class="block px-3 py-1.5 rounded text-yellow-200 font-bold bg-white/20 no-underline text-sm">👑 Admin Panel</NuxtLink>
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
import { ref, watch, onUnmounted } from 'vue';
import { useAuth } from '~/composables/useAuth';
import { decodeTokenPayload } from '~/utils/api';

import { useGlobalTools } from '~/composables/useGlobalTools';

const { user, accessToken, isAuthenticated, logout } = useAuth();
const { openLauncher } = useGlobalTools();
const isMobileMenuOpen = ref(false);

// Countdown Timer logic for Access Token
const remainingTime = ref(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

const formatTime = (seconds: number) => {
  if (seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const updateTimer = (exp: number) => {
  const now = Math.floor(Date.now() / 1000);
  remainingTime.value = Math.max(0, exp - now);
};

const startTimer = () => {
  stopTimer();
  
  const token = accessToken.value;
  if (!token) {
    remainingTime.value = 0;
    return;
  }

  const payload = decodeTokenPayload(token);
  if (!payload || !payload.exp) {
    remainingTime.value = 0;
    return;
  }

  const exp = payload.exp;
  updateTimer(exp);

  timerInterval = setInterval(() => {
    updateTimer(exp);
    if (remainingTime.value <= 0) {
      stopTimer();
    }
  }, 1000);
};

const stopTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
};

// Watch token changes (login, logout, proactive/reactive refreshes)
watch(() => accessToken.value, () => {
  startTimer();
}, { immediate: true });

onUnmounted(() => {
  stopTimer();
});

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const openGlobalTools = () => {
  openLauncher();
};
</script>
