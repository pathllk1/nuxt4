<template>
  <div class="max-w-4xl mx-auto p-6 animate-fadeIn pt-12">
    <div class="bg-white/80 backdrop-blur-md rounded-2xl p-8 border border-slate-200/50 shadow-xl">
      <h1 class="text-3xl font-black mb-4 text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-indigo-600">About BusinessPro Suite</h1>
      <p class="text-slate-600 leading-relaxed mb-6">
        BusinessPro Suite is an advanced full-stack workspace designed to empower enterprises to streamline operational databases, audit payroll ledger records, track assets inventory, manage worker rolls, and generate AI insights securely.
      </p>
      <div class="grid grid-cols-2 gap-4 mt-6">
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 class="font-bold text-slate-700 mb-1">State of the Art Security</h3>
          <p class="text-xs text-slate-500">Argon2id WASM password hashing, dual token expiration models, geographic lockouts, and sliding rate limits.</p>
        </div>
        <div class="p-4 bg-slate-50 rounded-xl border border-slate-100">
          <h3 class="font-bold text-slate-700 mb-1">Modern Nuxt 4 Architecture</h3>
          <p class="text-xs text-slate-500">Built using Nitro engine endpoints, Tailwind v4 utility grids, and Nuxt UI interactive components.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'default'
});
</script>
