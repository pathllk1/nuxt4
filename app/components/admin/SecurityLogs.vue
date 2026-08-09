<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const { apiFetch } = useAuth()
const toast = useToast()

const logs = ref<any[]>([])
const logsLoading = ref(false)
const logSeverityFilter = ref('all')

const fetchLogs = async () => {
  logsLoading.value = true
  try {
    const res: any = await apiFetch('/api/auth/security-logs?limit=50')
    logs.value = res.logs || []
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    logsLoading.value = false
  }
}

const filteredLogs = computed(() => {
  if (logSeverityFilter.value === 'all') return logs.value
  return logs.value.filter(l => l.severity === logSeverityFilter.value)
})

const logColumns = [
  { accessorKey: 'action', header: 'Action' },
  { accessorKey: 'severity', header: 'Severity' },
  { accessorKey: 'email', header: 'User Email' },
  { accessorKey: 'ip', header: 'IP Address' },
  { accessorKey: 'timestamp', header: 'Timestamp' }
]

const formatDate = (d: string) => {
  if (!d) return ''
  try { return new Date(d).toLocaleString() } catch { return d }
}

onMounted(() => {
  fetchLogs()
})

defineExpose({ fetchLogs })
</script>

<template>
  <div class="space-y-4">
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">System Security Events</h3>
          <USelect v-model="logSeverityFilter" :items="[{ label: 'All Severities', value: 'all' }, { label: 'Critical', value: 'critical' }, { label: 'High', value: 'high' }, { label: 'Medium', value: 'medium' }, { label: 'Low', value: 'low' }]" size="xs" class="w-40" />
        </div>
      </template>

      <UTable :data="filteredLogs" :columns="logColumns" :loading="logsLoading">
        <template #action-cell="{ row }">
          <span class="font-bold text-xs text-slate-700 dark:text-slate-300 capitalize">{{ row.original.action?.replace(/_/g, ' ') }}</span>
        </template>
        <template #severity-cell="{ row }">
          <UBadge :color="row.original.severity === 'high' || row.original.severity === 'critical' ? 'error' : row.original.severity === 'medium' ? 'warning' : 'primary'" variant="subtle" size="xs" class="uppercase font-bold">
            {{ row.original.severity }}
          </UBadge>
        </template>
        <template #email-cell="{ row }">
          <span class="text-xs font-mono text-slate-600 dark:text-slate-400">{{ row.original.email || 'System' }}</span>
        </template>
        <template #ip-cell="{ row }">
          <span class="text-xs font-mono text-slate-500">{{ row.original.ip || '127.0.0.1' }}</span>
        </template>
        <template #timestamp-cell="{ row }">
          <span class="text-xs text-slate-400">{{ formatDate(row.original.timestamp) }}</span>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
