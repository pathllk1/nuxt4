<template>
  <div class="max-w-4xl mx-auto p-6 animate-fadeIn pt-12">
    <div class="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-slate-200/50 shadow-xl">
      <h1 class="text-3xl font-black mb-4 text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-indigo-600">☀️ Weather Forecast</h1>
      <p class="text-slate-600 leading-relaxed mb-6">
        Weather monitoring system integrating Open-Meteo geo-coordinates datasets to retrieve local temperature, wind velocities, and relative humidity.
      </p>
      <div class="p-6 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
        <div>
          <h3 class="font-bold text-slate-700">Weather API</h3>
          <p class="text-xs text-slate-500">Live coordinates fetching and weather dashboard module coming soon.</p>
        </div>
        <span class="text-4xl">🌤️</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
});
</script>
