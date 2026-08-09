<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const { apiFetch } = useAuth()
const toast = useToast()

const metrics = ref<any>(null)
const metricsLoading = ref(false)

const fetchMetrics = async () => {
  metricsLoading.value = true
  try {
    const res: any = await apiFetch('/api/pg/database/metrics')
    if (res.success) {
      metrics.value = res.metrics
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    metricsLoading.value = false
  }
}

onMounted(() => {
  fetchMetrics()
})

defineExpose({ fetchMetrics })
</script>

<template>
  <div class="space-y-4">
    <div v-if="metricsLoading" class="py-12 text-center text-xs text-slate-400">Fetching metrics...</div>
    <div v-else-if="metrics" class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Node Process -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Process & Host Runtime</h3>
        </template>
        <div class="space-y-2 text-xs">
          <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span class="text-slate-400">Node Version:</span>
            <strong class="text-slate-700 dark:text-slate-300 font-mono">{{ metrics.nodeVersion }}</strong>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span class="text-slate-400">Platform / Arch:</span>
            <strong class="text-slate-700 dark:text-slate-300 uppercase">{{ metrics.platform }} ({{ metrics.arch }})</strong>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span class="text-slate-400">CPU Cores / Model:</span>
            <strong class="text-slate-700 dark:text-slate-300">{{ metrics.cpuCores }} Cores ({{ metrics.cpuModel }})</strong>
          </div>
          <div class="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
            <span class="text-slate-400">Uptime:</span>
            <strong class="text-slate-700 dark:text-slate-300 font-mono">{{ Math.round(metrics.uptime / 60) }} mins</strong>
          </div>
          <div class="flex justify-between py-1">
            <span class="text-slate-400">Heap Used / RSS:</span>
            <strong class="text-indigo-600 font-mono">{{ (metrics.memory?.process?.heapUsed / 1024 / 1024).toFixed(1) }} MB / {{ (metrics.memory?.process?.rss / 1024 / 1024).toFixed(1) }} MB</strong>
          </div>
        </div>
      </UCard>

      <!-- Database Status -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Databases Connections</h3>
        </template>
        <div class="space-y-4">
          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-xs text-indigo-600 dark:text-indigo-400">PostgreSQL Database</h4>
              <p class="text-[10px] text-slate-400">Database Size: {{ metrics.databases?.postgres?.size }}</p>
            </div>
            <UBadge :color="metrics.databases?.postgres?.status === 'connected' ? 'success' : 'error'" variant="subtle" size="xs" class="uppercase font-bold">
              {{ metrics.databases?.postgres?.status }}
            </UBadge>
          </div>

          <div class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h4 class="font-bold text-xs text-emerald-600 dark:text-emerald-400">MongoDB Database</h4>
              <p class="text-[10px] text-slate-400">Size: {{ metrics.databases?.mongodb?.size }} | Collections: {{ metrics.databases?.mongodb?.collectionsCount }}</p>
            </div>
            <UBadge :color="metrics.databases?.mongodb?.status === 'connected' ? 'success' : 'error'" variant="subtle" size="xs" class="uppercase font-bold">
              {{ metrics.databases?.mongodb?.status }}
            </UBadge>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
