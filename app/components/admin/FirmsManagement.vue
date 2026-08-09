<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const emit = defineEmits<{
  (e: 'open-firm-modal', firm?: any): void
  (e: 'update-stats', count: number): void
}>()

const { apiFetch, selectFirm } = useAuth()
const toast = useToast()

const firms = ref<any[]>([])
const firmsLoading = ref(false)
const firmSearch = ref('')
const firmStatusFilter = ref('all')

const fetchFirms = async () => {
  firmsLoading.value = true
  try {
    const res: any = await apiFetch('/api/admin/firms')
    if (res.success) {
      firms.value = res.data || []
      emit('update-stats', firms.value.length)
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    firmsLoading.value = false
  }
}

const toggleFirmStatus = async (firmId: string, currentStatus: string) => {
  const nextStatus = currentStatus === 'approved' ? 'suspended' : 'approved'
  try {
    const res: any = await apiFetch(`/api/admin/firms/${firmId}/status`, {
      method: 'PATCH',
      body: { status: nextStatus }
    })
    if (res.success) {
      toast.add({ title: 'Success', description: res.message, color: 'success' })
      fetchFirms()
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const filteredFirms = computed(() => {
  return firms.value.filter((f: any) => {
    const matchesSearch = !firmSearch.value || 
      f.name?.toLowerCase().includes(firmSearch.value.toLowerCase()) || 
      f.code?.toLowerCase().includes(firmSearch.value.toLowerCase())
    const matchesStatus = firmStatusFilter.value === 'all' || f.status === firmStatusFilter.value
    return matchesSearch && matchesStatus
  })
})

const firmColumns = [
  { accessorKey: 'name', header: 'Firm Name' },
  { accessorKey: 'code', header: 'Code' },
  { accessorKey: 'owner', header: 'Owner' },
  { accessorKey: 'memberCount', header: 'Members' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' }
]

onMounted(() => {
  fetchFirms()
})

defineExpose({ fetchFirms, firms })
</script>

<template>
  <div class="space-y-4">
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-1">
            <UInput v-model="firmSearch" placeholder="Search firm name or code..." icon="i-heroicons-magnifying-glass" size="xs" class="w-64" />
            <USelect v-model="firmStatusFilter" :items="[{ label: 'All Statuses', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Suspended', value: 'suspended' }]" size="xs" class="w-36" />
          </div>
          <UButton icon="i-heroicons-plus" label="Register New Firm" color="primary" size="xs" class="font-bold" @click="emit('open-firm-modal')" />
        </div>
      </template>

      <UTable :data="filteredFirms" :columns="firmColumns" :loading="firmsLoading">
        <template #name-cell="{ row }">
          <div>
            <p class="font-bold text-xs text-slate-800 dark:text-slate-100">{{ row.original.name }}</p>
            <p class="text-[10px] text-slate-400">{{ row.original.legal_name || row.original.email }}</p>
          </div>
        </template>
        <template #code-cell="{ row }">
          <UBadge variant="subtle" color="primary" size="xs" class="font-mono">{{ row.original.code || 'N/A' }}</UBadge>
        </template>
        <template #owner-cell="{ row }">
          <div class="text-xs">
            <p class="font-semibold text-slate-700 dark:text-slate-300">{{ row.original.owner?.name || 'No Owner' }}</p>
            <p class="text-[10px] text-slate-400">{{ row.original.owner?.email }}</p>
          </div>
        </template>
        <template #memberCount-cell="{ row }">
          <UBadge variant="outline" color="neutral" size="xs">{{ row.original.memberCount }} Users</UBadge>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="row.original.status === 'approved' ? 'success' : row.original.status === 'pending' ? 'warning' : 'error'" variant="subtle" size="xs" class="uppercase font-bold">
            {{ row.original.status }}
          </UBadge>
        </template>
        <template #actions-cell="{ row }">
          <div class="flex items-center gap-1">
            <UButton size="xs" variant="soft" color="primary" label="Switch" @click="selectFirm(row.original._id || row.original.id)" />
            <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="emit('open-firm-modal', row.original)" />
            <UButton size="xs" variant="ghost" :color="row.original.status === 'approved' ? 'error' : 'success'" :icon="row.original.status === 'approved' ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'" @click="toggleFirmStatus(row.original._id || row.original.id, row.original.status)" />
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
