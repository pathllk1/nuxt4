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

    <!-- Right-Aligned Links -->
    <div class="space-x-4">
      <NuxtLink to="/contact" class="text-white hover:text-teal-200 transition duration-300 no-underline text-xs font-medium">
        Contact Us
      </NuxtLink>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const currentYear = computed(() => new Date().getFullYear());
</script>
