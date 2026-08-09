<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const { apiFetch } = useAuth()
const toast = useToast()

const mongoCollections = ref<string[]>([])
const selectedMongoCollection = ref('')
const mongoCollectionData = ref<any[]>([])
const mongoCollectionTotal = ref(0)
const mongoLoading = ref(false)
const mongoLimit = ref(25)
const mongoSkip = ref(0)

const dynamicMongoColumns = computed(() => {
  if (mongoCollectionData.value.length === 0) return []
  const firstDoc = mongoCollectionData.value[0] || {}
  return Object.keys(firstDoc).map(k => ({
    accessorKey: k,
    header: k
  }))
})

const mongoAction = ref('find')
const mongoFilterJson = ref('{}')
const mongoQueryResult = ref<any>(null)
const mongoQueryLoading = ref(false)

const fetchMongoCollections = async () => {
  try {
    const res: any = await apiFetch('/api/mongo/database/collections')
    if (res.success) {
      mongoCollections.value = res.collections || []
      if (mongoCollections.value.length > 0 && !selectedMongoCollection.value) {
        selectedMongoCollection.value = mongoCollections.value[0]!
        loadMongoCollectionData()
      }
    }
  } catch (err: any) {
    toast.add({ title: 'Mongo Error', description: err.message, color: 'error' })
  }
}

const loadMongoCollectionData = async () => {
  if (!selectedMongoCollection.value) return
  mongoLoading.value = true
  try {
    const res: any = await apiFetch(`/api/mongo/database/${selectedMongoCollection.value}?limit=${mongoLimit.value}&skip=${mongoSkip.value}`)
    if (res.success) {
      mongoCollectionData.value = res.data || []
      mongoCollectionTotal.value = res.total || 0
    }
  } catch (err: any) {
    toast.add({ title: 'Collection Error', description: err.message, color: 'error' })
  } finally {
    mongoLoading.value = false
  }
}

const runMongoQuery = async () => {
  if (!selectedMongoCollection.value) return
  mongoQueryLoading.value = true
  try {
    let parsedFilter = {}
    try {
      parsedFilter = JSON.parse(mongoFilterJson.value || '{}')
    } catch {
      throw new Error('Invalid JSON filter')
    }

    const res: any = await apiFetch('/api/mongo/database/query', {
      method: 'POST',
      body: {
        collection: selectedMongoCollection.value,
        action: mongoAction.value,
        filter: parsedFilter
      }
    })

    if (res.success) {
      mongoQueryResult.value = res.data
      toast.add({ title: 'Query Success', description: `Executed in ${res.executionTimeMs}ms`, color: 'success' })
    }
  } catch (err: any) {
    toast.add({ title: 'Query Error', description: err.message, color: 'error' })
  } finally {
    mongoQueryLoading.value = false
  }
}

onMounted(() => {
  fetchMongoCollections()
})

defineExpose({ fetchMongoCollections })
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Collection Explorer -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">MongoDB Collections</h3>
            <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" @click="fetchMongoCollections" />
          </div>
        </template>

        <div class="space-y-2">
          <USelect v-model="selectedMongoCollection" :items="mongoCollections.map(c => ({ label: c, value: c }))" placeholder="Select Collection..." class="w-full" @update:model-value="loadMongoCollectionData" />
        </div>
      </UCard>

      <!-- Mongo Query Runner -->
      <UCard class="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">MongoDB Query Console</h3>
        </template>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <USelect v-model="mongoAction" :items="['find', 'aggregate', 'countDocuments', 'stats']" class="w-full" />
            <UInput v-model="mongoFilterJson" placeholder='Filter JSON e.g. {"status":"active"}' class="w-full font-mono text-xs" />
          </div>
          <div class="flex justify-end">
            <UButton size="xs" color="primary" icon="i-heroicons-play" label="Run Mongo Query" :loading="mongoQueryLoading" @click="runMongoQuery" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Collection Table View -->
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
          Collection: {{ selectedMongoCollection }} ({{ mongoCollectionTotal }} documents)
        </h3>
      </template>

      <UTable :data="mongoCollectionData" :columns="dynamicMongoColumns" :loading="mongoLoading" class="max-h-96 overflow-auto">
        <template v-for="col in dynamicMongoColumns" :key="col.accessorKey" #[`${col.accessorKey}-cell`]="{ row }">
          <span class="text-[11px] truncate max-w-[200px] inline-block font-mono text-slate-700 dark:text-slate-300">
            {{ typeof row.original[col.accessorKey] === 'object' ? JSON.stringify(row.original[col.accessorKey]) : String(row.original[col.accessorKey] ?? '') }}
          </span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
