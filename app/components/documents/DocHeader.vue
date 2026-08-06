<template>
  <div class="relative overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 px-6 py-4 text-white shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <!-- Glassy decorative shapes -->
    <div class="absolute right-0 bottom-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
    <div class="absolute left-1/4 top-0 w-16 h-16 bg-teal-300/20 rounded-full blur-lg pointer-events-none"></div>
    
    <div class="relative z-10 space-y-0.5">
      <h1 class="text-xl font-bold tracking-tight flex items-center gap-2">
        <UIcon name="i-lucide-folder" class="w-5 h-5 text-white" />
        <span>Document Management</span>
      </h1>
      <p class="text-xs text-emerald-50/90 font-medium">Manage your important documents and track their validity</p>
    </div>

    <div class="relative z-10 flex items-center gap-2">
      <UButton 
        @click="$emit('add')"
        icon="i-lucide-plus"
        size="xs"
        color="neutral"
        variant="solid"
        class="bg-white/20 hover:bg-white/30 text-white border border-white/30 font-bold px-4 py-2 cursor-pointer transition shadow-xs"
      >
        Add Document
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'add'): void
}>()
</script>
