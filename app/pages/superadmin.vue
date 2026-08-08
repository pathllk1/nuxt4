<script setup lang="ts">
import { ref, onMounted, reactive, computed, watch } from 'vue'
import { useAuth } from '../composables/useAuth'
import FirmFormModal from '../components/admin/FirmFormModal.vue'
import UserFormModal from '../components/admin/UserFormModal.vue'
import AiDataAnalyzer from '../components/admin/AiDataAnalyzer.vue'
import SettingsDialog from './ai-chat/components/SettingsDialog.vue'
import { useAiChat } from '../composables/useAiChat'

definePageMeta({
  layout: 'default'
})

const { user, selectFirm, apiFetch } = useAuth()
const toast = useToast()
const { providers } = useAiChat()

// Active Tab
const activeTab = ref('firms')

const tabItems = [
  { value: 'firms', label: 'Firms Management', icon: 'i-heroicons-building-office-2' },
  { value: 'users', label: 'User Directory', icon: 'i-heroicons-user-group' },
  { value: 'logs', label: 'Security Audit Logs', icon: 'i-heroicons-shield-check' },
  { value: 'metrics', label: 'System Metrics', icon: 'i-heroicons-cpu-chip' },
  { value: 'postgres', label: 'Postgres Console', icon: 'i-heroicons-circle-stack' },
  { value: 'mongodb', label: 'MongoDB Console', icon: 'i-heroicons-server' },
  { value: 'analyzer', label: 'AI Data Analyzer', icon: 'i-heroicons-sparkles' },
  { value: 'settings', label: 'System Settings', icon: 'i-heroicons-cog-6-tooth' }
]

// Stats
const stats = ref([
  { label: 'Total Firms', value: '0', icon: 'i-heroicons-building-office-2', color: 'indigo' },
  { label: 'Total Users', value: '0', icon: 'i-heroicons-user-group', color: 'emerald' },
  { label: 'System Status', value: 'Healthy', icon: 'i-heroicons-heart', color: 'teal' }
])

// --- 1. FIRMS MANAGEMENT ---
const firms = ref<any[]>([])
const firmsLoading = ref(false)
const firmSearch = ref('')
const firmStatusFilter = ref('all')
const isFirmModalOpen = ref(false)
const selectedFirmForEdit = ref<any>(null)

const fetchFirms = async () => {
  firmsLoading.value = true
  try {
    const res: any = await apiFetch('/api/admin/firms')
    if (res.success) {
      firms.value = res.data || []
      stats.value[0]!.value = firms.value.length.toString()
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    firmsLoading.value = false
  }
}

const openFirmModal = (firm: any = null) => {
  selectedFirmForEdit.value = firm
  isFirmModalOpen.value = true
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

// --- 2. USER DIRECTORY ---
const users = ref<any[]>([])
const usersLoading = ref(false)
const userSearch = ref('')
const userRoleFilter = ref('all')
const isUserModalOpen = ref(false)
const selectedUserForEdit = ref<any>(null)

const fetchUsers = async () => {
  usersLoading.value = true
  try {
    const res: any = await apiFetch('/api/admin/users')
    if (res.success) {
      users.value = res.data || []
      stats.value[1]!.value = users.value.length.toString()
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    usersLoading.value = false
  }
}

const openUserModal = (usr: any = null) => {
  selectedUserForEdit.value = usr
  isUserModalOpen.value = true
}

const deleteUser = async (userId: string) => {
  if (!confirm('Are you sure you want to permanently delete this user?')) return
  try {
    const res: any = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    if (res.success) {
      toast.add({ title: 'Success', description: 'User deleted', color: 'success' })
      fetchUsers()
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const filteredUsers = computed(() => {
  return users.value.filter((u: any) => {
    const matchesSearch = !userSearch.value || 
      u.name?.toLowerCase().includes(userSearch.value.toLowerCase()) || 
      u.email?.toLowerCase().includes(userSearch.value.toLowerCase())
    const matchesRole = userRoleFilter.value === 'all' || u.role === userRoleFilter.value
    return matchesSearch && matchesRole
  })
})

const userColumns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'role', header: 'System Role' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'firms', header: 'Firm Assignments' },
  { id: 'actions', header: 'Actions' }
]

// --- 3. SECURITY LOGS ---
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

// --- 4. SYSTEM METRICS ---
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

// --- 5. POSTGRES CONSOLE ---
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
const selectedPgTemplate = ref('')

const pgTemplates = [
  { label: 'Select SQL Template...', value: '' },
  { label: 'Get All Users', value: 'SELECT * FROM "User" LIMIT 10;' },
  { label: 'Count Users by Role', value: 'SELECT COUNT(*), role FROM "User" GROUP BY role;' },
  { label: 'Get All Firms', value: 'SELECT * FROM "Firm" LIMIT 10;' },
  { label: 'Get Cash Registers', value: 'SELECT * FROM cash_registers LIMIT 10;' }
]

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
      pgTableData.value = res.data || []
      pgTableTotal.value = res.total || 0
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

// --- 6. MONGODB CONSOLE ---
const mongoCollections = ref<string[]>([])
const selectedMongoCollection = ref('')
const mongoCollectionData = ref<any[]>([])
const mongoCollectionTotal = ref(0)
const mongoLoading = ref(false)
const mongoLimit = ref(25)
const mongoSkip = ref(0)

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

// --- 8. SYSTEM SETTINGS ---
const systemConfig = reactive({
  maintenanceMode: false,
  allowNewSignups: true,
  rateLimitStrictness: 'normal',
  systemAlertMessage: ''
})
const configLoading = ref(false)
const envProcess = ref<any>(null)
const isAiSettingsOpen = ref(false)

const fetchSystemConfig = async () => {
  configLoading.value = true
  try {
    const res: any = await apiFetch('/api/pg/database/system-config')
    if (res.success && res.config) {
      Object.assign(systemConfig, res.config)
    }

    const envRes: any = await apiFetch('/api/pg/database/config')
    if (envRes.success) {
      envProcess.value = envRes.process
    }
  } catch (err: any) {
    toast.add({ title: 'Config Error', description: err.message, color: 'error' })
  } finally {
    configLoading.value = false
  }
}

const updateConfigKey = async (key: string, value: any) => {
  try {
    const res: any = await apiFetch('/api/pg/database/system-config/update', {
      method: 'POST',
      body: { key, value }
    })
    if (res.success) {
      toast.add({ title: 'Setting Updated', description: `${key} set to ${JSON.stringify(value)}`, color: 'success' })
    }
  } catch (err: any) {
    toast.add({ title: 'Update Error', description: err.message, color: 'error' })
  }
}

const refreshAllData = () => {
  fetchFirms()
  fetchUsers()
  fetchLogs()
  fetchMetrics()
  fetchPgTables()
  fetchMongoCollections()
  fetchSystemConfig()
}

// Global Init
onMounted(() => {
  refreshAllData()
})

const formatDate = (d: string) => {
  if (!d) return ''
  try { return new Date(d).toLocaleString() } catch { return d }
}
</script>

<template>
  <div class="space-y-6 p-4 md:p-6 w-full max-w-none">
    <!-- Header Title -->
    <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-2xl">👑</span>
          <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">SuperAdmin Control Board</h1>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">System-wide administration, firm provisioning, user management, and DB analytics</p>
      </div>
      <div class="flex items-center gap-2">
        <UButton icon="i-heroicons-arrow-path" size="xs" variant="outline" label="Refresh All" @click="refreshAllData" />
      </div>
    </div>

    <!-- System Stats Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="st in stats" :key="st.label" class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl p-4 flex items-center gap-4">
        <div class="p-2.5 rounded-lg border bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400">
          <UIcon :name="st.icon" class="w-5 h-5" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wider">{{ st.label }}</p>
          <p class="text-xl font-black mt-0.5 text-slate-800 dark:text-slate-100">{{ st.value }}</p>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="border-b border-slate-200 dark:border-slate-800">
      <div class="flex flex-wrap gap-1">
        <button
          v-for="t in tabItems"
          :key="t.value"
          class="flex items-center gap-2 px-3.5 py-2 text-xs font-bold border-b-2 -mb-px transition cursor-pointer"
          :class="activeTab === t.value 
            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30' 
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
          @click="activeTab = t.value"
        >
          <UIcon :name="t.icon" class="w-4 h-4" />
          <span>{{ t.label }}</span>
        </button>
      </div>
    </div>

    <!-- TAB 1: FIRMS MANAGEMENT -->
    <div v-if="activeTab === 'firms'" class="space-y-4">
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3 flex-1">
              <UInput v-model="firmSearch" placeholder="Search firm name or code..." icon="i-heroicons-magnifying-glass" size="xs" class="w-64" />
              <USelect v-model="firmStatusFilter" :items="[{ label: 'All Statuses', value: 'all' }, { label: 'Approved', value: 'approved' }, { label: 'Pending', value: 'pending' }, { label: 'Suspended', value: 'suspended' }]" size="xs" class="w-36" />
            </div>
            <UButton icon="i-heroicons-plus" label="Register New Firm" color="primary" size="xs" class="font-bold" @click="openFirmModal()" />
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
            <div text-xs>
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
              <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="openFirmModal(row.original)" />
              <UButton size="xs" variant="ghost" :color="row.original.status === 'approved' ? 'error' : 'success'" :icon="row.original.status === 'approved' ? 'i-heroicons-lock-closed' : 'i-heroicons-lock-open'" @click="toggleFirmStatus(row.original._id || row.original.id, row.original.status)" />
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <!-- TAB 2: USER DIRECTORY -->
    <div v-if="activeTab === 'users'" class="space-y-4">
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="flex items-center gap-3 flex-1">
              <UInput v-model="userSearch" placeholder="Search name or email..." icon="i-heroicons-magnifying-glass" size="xs" class="w-64" />
              <USelect v-model="userRoleFilter" :items="[{ label: 'All Roles', value: 'all' }, { label: 'Superadmin', value: 'superadmin' }, { label: 'Standard', value: 'standard' }]" size="xs" class="w-36" />
            </div>
            <UButton icon="i-heroicons-user-plus" label="Create User" color="primary" size="xs" class="font-bold" @click="openUserModal()" />
          </div>
        </template>

        <UTable :data="filteredUsers" :columns="userColumns" :loading="usersLoading">
          <template #name-cell="{ row }">
            <p class="font-bold text-xs text-slate-800 dark:text-slate-100">{{ row.original.name }}</p>
          </template>
          <template #email-cell="{ row }">
            <span class="text-xs font-mono text-slate-600 dark:text-slate-400">{{ row.original.email }}</span>
          </template>
          <template #role-cell="{ row }">
            <UBadge :color="row.original.role === 'superadmin' ? 'primary' : 'neutral'" variant="subtle" size="xs" class="uppercase font-black">
              {{ row.original.role }}
            </UBadge>
          </template>
          <template #status-cell="{ row }">
            <UBadge :color="row.original.status === 'active' ? 'success' : row.original.status === 'pending' ? 'warning' : 'error'" variant="subtle" size="xs" class="uppercase font-bold">
              {{ row.original.status }}
            </UBadge>
          </template>
          <template #firms-cell="{ row }">
            <div class="flex flex-wrap gap-1">
              <UBadge v-for="(f, idx) in row.original.firms" :key="idx" variant="outline" color="neutral" size="xs">
                {{ f.firmName }}: <strong class="text-indigo-600">{{ f.grade }}</strong>
              </UBadge>
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex items-center gap-1">
              <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="openUserModal(row.original)" />
              <UButton v-if="row.original._id !== user?.id" size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="deleteUser(row.original._id || row.original.id)" />
            </div>
          </template>
        </UTable>
      </UCard>
    </div>

    <!-- TAB 3: SECURITY LOGS -->
    <div v-if="activeTab === 'logs'" class="space-y-4">
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

    <!-- TAB 4: SYSTEM METRICS -->
    <div v-if="activeTab === 'metrics'" class="space-y-4">
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

    <!-- TAB 5: POSTGRES CONSOLE -->
    <div v-if="activeTab === 'postgres'" class="space-y-4">
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
            <USelect v-model="selectedPgTable" :items="pgTables.map(t => ({ label: t, value: t }))" class="w-full" @update:model-value="loadPgTableData" />
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
              <USelect v-model="selectedPgTemplate" :items="pgTemplates" size="xs" class="w-48" @update:model-value="(val) => { if (val) pgCustomQuery = val }" />
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

      <!-- Data Table Display -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-3', header: 'px-3 py-2 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
            {{ pgQueryResult.length > 0 ? 'Query Output' : `Table: ${selectedPgTable}` }} ({{ pgQueryResult.length || pgTableTotal }} rows)
          </h3>
        </template>

        <div v-if="pgLoading" class="py-8 text-center text-xs text-slate-400">Querying Postgres...</div>
        <div v-else-if="(pgQueryResult.length > 0 ? pgQueryResult : pgTableData).length > 0" class="max-h-96 overflow-auto border border-slate-100 dark:border-slate-800 rounded-lg">
          <table class="w-full text-[11px] text-left border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
              <tr>
                <th v-for="key in Object.keys((pgQueryResult.length > 0 ? pgQueryResult : pgTableData)[0])" :key="key" class="p-2 border-b font-bold truncate">
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in (pgQueryResult.length > 0 ? pgQueryResult : pgTableData)" :key="idx" class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50">
                <td v-for="key in Object.keys((pgQueryResult.length > 0 ? pgQueryResult : pgTableData)[0])" :key="key" class="p-2 truncate max-w-[160px]">
                  {{ typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] ?? '') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- TAB 6: MONGODB CONSOLE -->
    <div v-if="activeTab === 'mongodb'" class="space-y-4">
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
            <USelect v-model="selectedMongoCollection" :items="mongoCollections.map(c => ({ label: c, value: c }))" class="w-full" @update:model-value="loadMongoCollectionData" />
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

        <div v-if="mongoLoading" class="py-8 text-center text-xs text-slate-400">Loading documents...</div>
        <div v-else-if="mongoCollectionData.length > 0" class="max-h-96 overflow-auto border border-slate-100 dark:border-slate-800 rounded-lg">
          <table class="w-full text-[11px] text-left border-collapse">
            <thead class="bg-slate-50 dark:bg-slate-800 text-slate-500 sticky top-0">
              <tr>
                <th v-for="key in Object.keys(mongoCollectionData[0])" :key="key" class="p-2 border-b font-bold truncate max-w-[120px]">
                  {{ key }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(doc, idx) in mongoCollectionData" :key="idx" class="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50">
                <td v-for="key in Object.keys(mongoCollectionData[0])" :key="key" class="p-2 truncate max-w-[160px]">
                  {{ typeof doc[key] === 'object' ? JSON.stringify(doc[key]) : String(doc[key] ?? '') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </UCard>
    </div>

    <!-- TAB 7: AI DATA ANALYZER -->
    <div v-if="activeTab === 'analyzer'">
      <AiDataAnalyzer @open-settings="isAiSettingsOpen = true" />
    </div>

    <!-- TAB 8: SYSTEM SETTINGS -->
    <div v-if="activeTab === 'settings'" class="space-y-4">
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Dynamic Feature Flags & Controls</h3>
            <UButton size="xs" variant="outline" icon="i-heroicons-cog-6-tooth" label="AI Provider Keys" @click="isAiSettingsOpen = true" />
          </div>
        </template>

        <div class="space-y-4 max-w-lg">
          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <h4 class="font-bold text-xs text-slate-800 dark:text-slate-200">Maintenance Mode</h4>
              <p class="text-[10px] text-slate-400">Lock application access for standard users.</p>
            </div>
            <UCheckbox v-model="systemConfig.maintenanceMode" @update:model-value="(val) => updateConfigKey('maintenanceMode', val)" />
          </div>

          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <div>
              <h4 class="font-bold text-xs text-slate-800 dark:text-slate-200">Allow New User Signups</h4>
              <p class="text-[10px] text-slate-400">Enable or disable public signup registration endpoint.</p>
            </div>
            <UCheckbox v-model="systemConfig.allowNewSignups" @update:model-value="(val) => updateConfigKey('allowNewSignups', val)" />
          </div>
        </div>
      </UCard>
    </div>

    <!-- Modals -->
    <FirmFormModal :open="isFirmModalOpen" :firm="selectedFirmForEdit" @close="isFirmModalOpen = false" @success="fetchFirms" />
    <UserFormModal :open="isUserModalOpen" :user="selectedUserForEdit" :available-firms="firms" @close="isUserModalOpen = false" @success="fetchUsers" />
    <SettingsDialog :open="isAiSettingsOpen" :providers="providers" @close-event="isAiSettingsOpen = false" />
  </div>
</template>
