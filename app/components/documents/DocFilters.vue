<template>
  <div class="bg-white dark:bg-gray-900 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 flex flex-row items-center justify-between gap-3 shadow-xs shrink-0">
    <!-- Quick Search Input -->
    <div class="relative flex-1 max-w-xs">
      <UInput 
        v-model="localSearchQuery"
        type="text" 
        icon="i-lucide-search"
        placeholder="Quick search documents..." 
        size="xs"
        class="w-full font-semibold"
      />
    </div>

    <!-- Export Excel Button -->
    <UButton 
      @click="$emit('download')" 
      icon="i-lucide-download"
      size="xs"
      color="warning"
      variant="solid"
      class="font-bold shadow-xs cursor-pointer shrink-0"
    >
      Export Excel
    </UButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  searchQuery: string
}>()

const emit = defineEmits<{
  (e: 'update:searchQuery', val: string): void
  (e: 'download'): void
}>()

const localSearchQuery = computed({
  get: () => props.searchQuery,
  set: (val) => emit('update:searchQuery', val)
})
</script>
