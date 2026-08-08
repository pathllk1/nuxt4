<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useAiKeys } from '../../composables/useAiKeys'
import { useAiChat } from '../../composables/useAiChat'

const emit = defineEmits<{
  (e: 'open-settings'): void
}>()

const { apiFetch } = useAuth()
const toast = useToast()
const { getKey, hasKey } = useAiKeys()
const { getSetting, saveSetting, fetchModels: fetchAiModels, models: aiModels } = useAiChat()

const isAiSetupComplete = ref(false)
const activeProvider = ref('')
const activeModel = ref('')
const hasKeySaved = ref(false)

const loadingModels = ref(false)
const postgresTables = ref<string[]>([])
const mongodbCollections = ref<string[]>([])
const searchQuery = ref('')

const selectedType = ref<'postgres' | 'mongodb' | null>(null)
const selectedName = ref<string | null>(null)
const loadingData = ref(false)
const rawData = ref<any[]>([])

const isAnalyzing = ref(false)
const analysisResult = ref<string | null>(null)

async function checkAiConfig() {
  try {
    const provider = await getSetting('selectedProvider')
    const model = await getSetting('selectedModel')
    const hasApiKey = provider ? await hasKey(provider) : false

    activeProvider.value = provider || ''
    activeModel.value = model || ''
    hasKeySaved.value = hasApiKey
    isAiSetupComplete.value = !!(provider && model && hasApiKey)

    if (isAiSetupComplete.value && provider && model) {
      await fetchAiModels(provider)
      if (!aiModels.value.some(m => m.id === model)) {
        activeModel.value = ''
        isAiSetupComplete.value = false
        await saveSetting('selectedModel', '')
      }
    }
  } catch (err: any) {
    console.error('Failed to check AI config:', err)
  }
}

async function fetchModels() {
  loadingModels.value = true
  try {
    const res: any = await apiFetch('/api/admin/analyzer/models')
    if (res.success) {
      postgresTables.value = res.postgres || []
      mongodbCollections.value = res.mongodb || []
    }
  } catch (err: any) {
    toast.add({ title: 'Failed to load models', description: err.message, color: 'error' })
  } finally {
    loadingModels.value = false
  }
}

async function selectItem(type: 'postgres' | 'mongodb', name: string) {
  selectedType.value = type
  selectedName.value = name
  rawData.value = []
  analysisResult.value = null
  loadingData.value = true

  try {
    const res: any = await apiFetch(`/api/admin/analyzer/data?type=${type}&name=${name}`)
    if (res.success) {
      rawData.value = res.data || []
    }
  } catch (err: any) {
    toast.add({ title: 'Failed to load table data', description: err.message, color: 'error' })
  } finally {
    loadingData.value = false
  }
}

async function runAnalysis() {
  if (!selectedType.value || !selectedName.value || rawData.value.length === 0) return
  if (!isAiSetupComplete.value) {
    toast.add({ title: 'AI Not Configured', description: 'Please setup AI provider & key in Settings', color: 'warning' })
    return
  }

  isAnalyzing.value = true
  analysisResult.value = null

  try {
    const apiKey = await getKey(activeProvider.value)
    if (!apiKey) throw new Error('API Key missing for selected provider')

    const firstRow = rawData.value[0] || {}
    const headers = Object.keys(firstRow).join(',')
    const dataRows = rawData.value.map(row => {
      return Object.values(row).map(val => {
        if (val === null || val === undefined) return ''
        if (typeof val === 'object') return JSON.stringify(val).replace(/,/g, ';')
        return String(val).replace(/,/g, ';')
      }).join(',')
    })

    const payloadCsv = [headers, ...dataRows].join('\n')

    const res: any = await apiFetch('/api/admin/analyzer/analyze', {
      method: 'POST',
      body: {
        tableName: selectedName.value,
        dbType: selectedType.value,
        payload: payloadCsv,
        provider: activeProvider.value,
        model: activeModel.value,
        apiKey
      }
    })

    if (res.success && res.analysis) {
      analysisResult.value = res.analysis
      toast.add({ title: 'Analysis Complete', description: 'AI diagnostics generated successfully', color: 'success' })
    }
  } catch (err: any) {
    toast.add({ title: 'Analysis Failed', description: err.message, color: 'error' })
  } finally {
    isAnalyzing.value = false
  }
}

const filteredPgTables = computed(() => {
  if (!searchQuery.value) return postgresTables.value
  return postgresTables.value.filter(t => t.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const filteredMongoCollections = computed(() => {
  if (!searchQuery.value) return mongodbCollections.value
  return mongodbCollections.value.filter(c => c.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

onMounted(() => {
  checkAiConfig()
  fetchModels()
})
</script>

<template>
  <div class="space-y-4">
    <!-- Config Banner -->
    <div class="flex items-center justify-between p-3 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/60">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-sparkles" class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <div>
          <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">AI Diagnostics Engine</h4>
          <p class="text-[10px] text-slate-500">
            Provider: <span class="font-bold text-slate-700 dark:text-slate-300 uppercase">{{ activeProvider || 'None' }}</span> | 
            Model: <span class="font-bold text-slate-700 dark:text-slate-300">{{ activeModel || 'None' }}</span>
          </p>
        </div>
      </div>
      <UButton size="xs" variant="soft" color="primary" label="Configure AI Keys" icon="i-heroicons-cog-6-tooth" @click="emit('open-settings')" />
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Database Models List -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="space-y-2">
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Select Table / Collection</h3>
            <UInput v-model="searchQuery" placeholder="Filter tables..." icon="i-heroicons-magnifying-glass" size="xs" class="w-full" />
          </div>
        </template>

        <div v-if="loadingModels" class="py-6 text-center text-xs text-slate-400">
          Loading schema models...
        </div>
        <div v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          <!-- PostgreSQL -->
          <div>
            <span class="text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider">PostgreSQL</span>
            <div class="mt-1 space-y-1">
              <button
                v-for="tbl in filteredPgTables"
                :key="tbl"
                class="w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer border"
                :class="selectedType === 'postgres' && selectedName === tbl
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'"
                @click="selectItem('postgres', tbl)"
              >
                <span class="truncate">{{ tbl }}</span>
                <UIcon name="i-heroicons-circle-stack" class="w-3.5 h-3.5 opacity-50" />
              </button>
            </div>
          </div>

          <!-- MongoDB -->
          <div>
            <span class="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">MongoDB</span>
            <div class="mt-1 space-y-1">
              <button
                v-for="col in filteredMongoCollections"
                :key="col"
                class="w-full text-left px-2 py-1.5 rounded-lg text-xs transition flex items-center justify-between cursor-pointer border"
                :class="selectedType === 'mongodb' && selectedName === col
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'"
                @click="selectItem('mongodb', col)"
              >
                <span class="truncate">{{ col }}</span>
                <UIcon name="i-heroicons-server" class="w-3.5 h-3.5 opacity-50" />
              </button>
            </div>
          </div>
        </div>
      </UCard>

      <!-- Data Preview & AI Analysis -->
      <div class="lg:col-span-2 space-y-4">
        <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {{ selectedName ? `${selectedType?.toUpperCase()}: ${selectedName}` : 'No Table Selected' }}
                </h3>
                <p class="text-[10px] text-slate-400">{{ rawData.length }} records loaded</p>
              </div>
              <UButton
                v-if="selectedName"
                :loading="isAnalyzing"
                :disabled="rawData.length === 0"
                color="primary"
                size="xs"
                icon="i-heroicons-sparkles"
                label="Run AI Analysis"
                class="font-bold"
                @click="runAnalysis"
              />
            </div>
          </template>

          <div v-if="loadingData" class="py-12 text-center text-xs text-slate-400">
            Fetching dataset sample...
          </div>
          <div v-else-if="selectedName && rawData.length > 0" class="max-h-64 overflow-auto border border-slate-100 dark:border-slate-800 rounded-lg">
            <table class="w-full text-[11px] text-left border-collapse">
              <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
                <tr>
                  <th v-for="key in Object.keys(rawData[0])" :key="key" class="p-2 border-b font-bold truncate max-w-[120px]">
                    {{ key }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in rawData.slice(0, 15)" :key="idx" class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50">
                  <td v-for="key in Object.keys(rawData[0])" :key="key" class="p-2 truncate max-w-[120px]">
                    {{ typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="py-12 text-center text-xs text-slate-400">
            Select a database table from the left menu to preview records.
          </div>
        </UCard>

        <!-- AI Diagnostic Output -->
        <UCard v-if="analysisResult" class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-2 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">AI Diagnostic Findings</h3>
            </div>
          </template>

          <div class="prose dark:prose-invert prose-xs max-w-none text-slate-700 dark:text-slate-300" v-html="analysisResult"></div>
        </UCard>
      </div>
    </div>
  </div>
</template>
