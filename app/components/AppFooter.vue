<template>
  <footer class="fixed inset-x-0 bottom-0 w-full bg-gradient-to-r from-teal-400 via-indigo-500 to-teal-400 shadow-lg py-1 px-6 z-50 flex items-center justify-between text-white">
    <!-- Left-Aligned Links -->
    <div class="space-x-4">
      <NuxtLink to="/privacy" class="text-white hover:text-teal-200 transition duration-300 no-underline text-xs font-medium">
        Privacy Policy
      </NuxtLink>
      <NuxtLink to="/terms" class="text-white hover:text-teal-200 transition duration-300 no-underline text-xs font-medium">
        Terms of Service
      </NuxtLink>
    </div>

    <!-- Center Text -->
    <p class="text-white text-xs font-bold my-0">
      &copy; {{ currentYear }} BusinessPro Suite. All rights reserved.
    </p>

    <!-- Right-Aligned Links & Guidelines Shortcut -->
    <div class="flex items-center gap-4">
      <button 
        type="button" 
        @click="openGuidelines" 
        class="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all transform active:scale-95 shadow-sm"
      >
        <span>📖</span>
        <span>Guidelines (Ctrl + ,)</span>
      </button>
      <NuxtLink to="/contact" class="text-white hover:text-teal-200 transition duration-300 no-underline text-xs font-medium">
        Contact Us
      </NuxtLink>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const currentYear = computed(() => new Date().getFullYear());

function openGuidelines() {
  if (import.meta.client) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
  }
}
</script>
