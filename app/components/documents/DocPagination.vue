<template>
  <div class="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs text-xs font-semibold text-gray-500 dark:text-gray-400">
    <!-- Info -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div>
        Showing <span class="font-bold text-gray-700 dark:text-gray-200">{{ startRange }}–{{ endRange }}</span> of 
        <span class="font-bold text-gray-700 dark:text-gray-200">{{ totalItems }}</span> records
      </div>
      
      <!-- Rows per page selector -->
      <div class="flex items-center gap-1.5">
        <span>Rows per page:</span>
        <USelect 
          v-model="localPageSize" 
          :items="pageSizeOptions"
          size="xs"
          class="w-16 font-bold cursor-pointer"
        />
      </div>
    </div>

    <!-- Pagination Controls -->
    <div class="flex items-center gap-1">
      <!-- First Page -->
      <UButton 
        @click="goToPage(1)" 
        :disabled="currentPage === 1"
        icon="i-lucide-chevrons-left"
        size="xs"
        color="neutral"
        variant="ghost"
        class="cursor-pointer disabled:cursor-not-allowed"
        title="First Page"
      />

      <!-- Prev -->
      <UButton 
        @click="goToPage(currentPage - 1)" 
        :disabled="currentPage === 1"
        icon="i-lucide-chevron-left"
        size="xs"
        color="neutral"
        variant="ghost"
        class="cursor-pointer disabled:cursor-not-allowed"
        title="Previous Page"
      />

      <!-- Page Numbers -->
      <UButton 
        v-for="page in visiblePages" 
        :key="page"
        @click="goToPage(page)"
        size="xs"
        :color="currentPage === page ? 'primary' : 'neutral'"
        :variant="currentPage === page ? 'solid' : 'ghost'"
        class="font-bold cursor-pointer"
      >
        {{ page }}
      </UButton>

      <!-- Next -->
      <UButton 
        @click="goToPage(currentPage + 1)" 
        :disabled="currentPage === totalPages"
        icon="i-lucide-chevron-right"
        size="xs"
        color="neutral"
        variant="ghost"
        class="cursor-pointer disabled:cursor-not-allowed"
        title="Next Page"
      />

      <!-- Last Page -->
      <UButton 
        @click="goToPage(totalPages)" 
        :disabled="currentPage === totalPages"
        icon="i-lucide-chevrons-right"
        size="xs"
        color="neutral"
        variant="ghost"
        class="cursor-pointer disabled:cursor-not-allowed"
        title="Last Page"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  totalItems: number
  currentPage: number
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'update:currentPage', page: number): void
  (e: 'update:pageSize', size: number): void
}>()

const pageSizeOptions = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 }
]

const totalPages = computed(() => {
  return Math.ceil(props.totalItems / props.pageSize) || 1
})

const startRange = computed(() => {
  if (props.totalItems === 0) return 0
  return (props.currentPage - 1) * props.pageSize + 1
})

const endRange = computed(() => {
  return Math.min(props.currentPage * props.pageSize, props.totalItems)
})

const localPageSize = computed({
  get: () => props.pageSize,
  set: (val) => {
    emit('update:pageSize', Number(val))
    emit('update:currentPage', 1)
  }
})

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('update:currentPage', page)
  }
}

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, props.currentPage - Math.floor(maxVisible / 2))
  let end = Math.min(totalPages.value, start + maxVisible - 1)
  
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1)
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})
</script>
