<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAuth } from '../../composables/useAuth'

const { apiFetch } = useAuth()
const toast = useToast()

const pgTables = ref<string[]>([])
const selectedPgTable = ref('')
const pgTableData = ref<any[]>([])
const pgTableTotal = ref(0)
const pgLoading = ref(false)
const pgLimit = ref(25)
const pgSkip = ref(0)

const pgCustomQuery = ref('SELECT * FROM "User" LIMIT 10;')
const pgQueryResult = ref<any[]>([])
const pgQueryLoading = ref(false)
const pgQueryTime = ref('')
const selectedPgTemplate = ref<string>()

const gridIframeRef = ref<HTMLIFrameElement | null>(null)

const pgTemplates = [
  { label: 'Get All Users', value: 'SELECT * FROM "User" LIMIT 10;' },
  { label: 'Count Users by Role', value: 'SELECT COUNT(*), role FROM "User" GROUP BY role;' },
  { label: 'Get All Firms', value: 'SELECT * FROM "Firm" LIMIT 10;' },
  { label: 'Get Cash Registers', value: 'SELECT * FROM cash_registers LIMIT 10;' }
]

const activePgRows = computed(() => {
  return pgQueryResult.value.length > 0 ? pgQueryResult.value : pgTableData.value
})

const dynamicPgColumns = computed(() => {
  if (activePgRows.value.length === 0) return []
  const firstRow = activePgRows.value[0] || {}
  return Object.keys(firstRow).map(k => ({
    accessorKey: k,
    header: k
  }))
})

const sendGridDataToIframe = () => {
  if (!gridIframeRef.value || !gridIframeRef.value.contentWindow) return
  try {
    const plainRows = JSON.parse(JSON.stringify(activePgRows.value || []))
    const plainCols = JSON.parse(JSON.stringify(dynamicPgColumns.value || []))

    gridIframeRef.value.contentWindow.postMessage({
      type: 'SET_GRID_DATA',
      rowData: plainRows,
      columnDefs: plainCols
    }, '*')
  } catch (err) {
    console.error('Error sending grid data via postMessage:', err)
  }
}

watch(activePgRows, () => {
  sendGridDataToIframe()
})

const fetchPgTables = async () => {
  try {
    const res: any = await apiFetch('/api/pg/database/tables')
    if (res.success) {
      pgTables.value = res.tables || []
      if (pgTables.value.length > 0 && !selectedPgTable.value) {
        selectedPgTable.value = pgTables.value[0]!
        loadPgTableData()
      }
    }
  } catch (err: any) {
    toast.add({ title: 'PG Error', description: err.message, color: 'error' })
  }
}

const loadPgTableData = async () => {
  if (!selectedPgTable.value) return
  pgLoading.value = true
  try {
    const res: any = await apiFetch(`/api/pg/database/${selectedPgTable.value}?limit=${pgLimit.value}&skip=${pgSkip.value}`)
    if (res.success) {
      pgQueryResult.value = []
      pgTableData.value = res.data || []
      pgTableTotal.value = res.total || 0
      sendGridDataToIframe()
    }
  } catch (err: any) {
    toast.add({ title: 'Table Error', description: err.message, color: 'error' })
  } finally {
    pgLoading.value = false
  }
}

const runPgQuery = async () => {
  if (!pgCustomQuery.value) return
  pgQueryLoading.value = true
  try {
    const res: any = await apiFetch('/api/pg/database/query', {
      method: 'POST',
      body: { query: pgCustomQuery.value }
    })
    if (res.success) {
      pgQueryResult.value = res.data || []
      pgQueryTime.value = res.executionTimeMs || '0'
      sendGridDataToIframe()
      toast.add({ title: 'Query Executed', description: `${res.count} rows returned in ${res.executionTimeMs}ms`, color: 'success' })
    }
  } catch (err: any) {
    toast.add({ title: 'Query Error', description: err.message, color: 'error' })
  } finally {
    pgQueryLoading.value = false
  }
}

const exportPgData = async (format: 'json' | 'excel') => {
  try {
    const res: any = await apiFetch('/api/pg/database/export', {
      method: 'POST',
      body: { table: selectedPgTable.value, format },
      responseType: format === 'excel' ? 'blob' : 'json'
    })

    const blob = format === 'excel' ? res : new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pg_export_${selectedPgTable.value}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'json'}`
    a.click()
  } catch (err: any) {
    toast.add({ title: 'Export Failed', description: err.message, color: 'error' })
  }
}

onMounted(() => {
  fetchPgTables()

  // Listen for iframe ready message
  window.addEventListener('message', (event) => {
    if (event.data?.type === 'GRID_READY') {
      sendGridDataToIframe()
    }
  })
})

defineExpose({ fetchPgTables })
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Table Explorer -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Postgres Tables</h3>
            <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" @click="fetchPgTables" />
          </div>
        </template>

        <div class="space-y-2">
          <USelect v-model="selectedPgTable" :items="pgTables.map(t => ({ label: t, value: t }))" placeholder="Select Table..." class="w-full" @update:model-value="loadPgTableData" />
          <div class="flex items-center gap-2 pt-2">
            <UButton size="xs" variant="outline" label="Export JSON" @click="exportPgData('json')" />
            <UButton size="xs" variant="outline" label="Export Excel" @click="exportPgData('excel')" />
          </div>
        </div>
      </UCard>

      <!-- SQL Query Terminal -->
      <UCard class="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Raw SQL Query Terminal</h3>
            <USelect v-model="selectedPgTemplate" :items="pgTemplates" placeholder="Select SQL Template..." size="xs" class="w-48" @update:model-value="(val) => { if (val) pgCustomQuery = val }" />
          </div>
        </template>

        <div class="space-y-3">
          <UTextarea v-model="pgCustomQuery" :rows="3" font-mono class="w-full font-mono text-xs" />
          <div class="flex justify-end">
            <UButton size="xs" color="primary" icon="i-heroicons-play" label="Execute SQL" :loading="pgQueryLoading" @click="runPgQuery" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- AG Grid Enterprise Compact View Display Container -->
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-2', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            📊 AG Grid Enterprise Console: {{ pgQueryResult.length > 0 ? 'Query Output' : `Table: ${selectedPgTable}` }} ({{ activePgRows.length }} rows)
          </h3>
          <UBadge variant="subtle" color="primary" size="xs" class="font-mono text-[10px]">Compact Enterprise Grid</UBadge>
        </div>
      </template>

      <div class="relative w-full h-[520px] rounded-lg overflow-hidden border border-slate-200/60 dark:border-slate-800 bg-slate-900">
        <div v-if="pgLoading || pgQueryLoading" class="absolute inset-0 bg-slate-900/80 backdrop-blur-xs z-10 flex items-center justify-center">
          <div class="flex items-center gap-2 text-xs font-bold text-slate-200">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading database records into AG Grid...</span>
          </div>
        </div>
        
        <!-- Isolated Iframe hosting local AG Grid Enterprise (ZERO network API calls inside iframe) -->
        <iframe
          ref="gridIframeRef"
          src="/vendor/ag-grid-iframe.html"
          class="w-full h-full border-0"
          @load="sendGridDataToIframe"
        ></iframe>
      </div>
    </UCard>
  </div>
</template>
