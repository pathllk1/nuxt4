<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'
import { useAiChat } from '../composables/useAiChat'

import FirmsManagement from '../components/admin/FirmsManagement.vue'
import UserDirectory from '../components/admin/UserDirectory.vue'
import SecurityLogs from '../components/admin/SecurityLogs.vue'
import SystemMetrics from '../components/admin/SystemMetrics.vue'
import PostgresConsole from '../components/admin/PostgresConsole.vue'
import MongoConsole from '../components/admin/MongoConsole.vue'
import AiDataAnalyzer from '../components/admin/AiDataAnalyzer.vue'
import SystemSettings from '../components/admin/SystemSettings.vue'
import FirmFormModal from '../components/admin/FirmFormModal.vue'
import UserFormModal from '../components/admin/UserFormModal.vue'
import SettingsDialog from './ai-chat/components/SettingsDialog.vue'

definePageMeta({
  layout: 'default'
})

const { user, selectFirm, selectedFirmId } = useAuth()
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

// Component Refs
const firmsRef = ref<any>(null)
const usersRef = ref<any>(null)
const logsRef = ref<any>(null)
const metricsRef = ref<any>(null)
const pgRef = ref<any>(null)
const mongoRef = ref<any>(null)
const settingsRef = ref<any>(null)

// Stats
const stats = ref([
  { label: 'Total Firms', value: '0', icon: 'i-heroicons-building-office-2', color: 'indigo' },
  { label: 'Total Users', value: '0', icon: 'i-heroicons-user-group', color: 'emerald' },
  { label: 'System Status', value: 'Healthy', icon: 'i-heroicons-heart', color: 'teal' }
])

// Modals State
const isFirmModalOpen = ref(false)
const selectedFirmForEdit = ref<any>(null)
const isUserModalOpen = ref(false)
const selectedUserForEdit = ref<any>(null)
const isAiSettingsOpen = ref(false)

const firmSelectOptions = computed(() => {
  return firmsRef.value?.firms ? firmsRef.value.firms.map((f: any) => ({
    label: `${f.name} (${f.code || 'FIRM'})`,
    value: f.id || f._id
  })) : []
})

const openFirmModal = (firm: any = null) => {
  selectedFirmForEdit.value = firm
  isFirmModalOpen.value = true
}

const openUserModal = (usr: any = null) => {
  selectedUserForEdit.value = usr
  isUserModalOpen.value = true
}

const refreshAllData = () => {
  firmsRef.value?.fetchFirms()
  usersRef.value?.fetchUsers()
  logsRef.value?.fetchLogs()
  metricsRef.value?.fetchMetrics()
  pgRef.value?.fetchPgTables()
  mongoRef.value?.fetchMongoCollections()
  settingsRef.value?.fetchSystemConfig()
}

// Auto firm context assignment for superadmin
const onFirmsCountUpdated = (count: number) => {
  stats.value[0]!.value = count.toString()
  const firmsList = firmsRef.value?.firms || []
  if (firmsList.length > 0 && (!selectedFirmId.value || selectedFirmId.value === 'undefined' || selectedFirmId.value === 'null')) {
    const defaultFirmId = firmsList[0].id || firmsList[0]._id
    if (defaultFirmId) {
      selectFirm(defaultFirmId)
    }
  }
}

const onUsersCountUpdated = (count: number) => {
  stats.value[1]!.value = count.toString()
}
</script>

<template>
  <div class="space-y-6 p-4 md:p-6 w-full max-w-none">
    <!-- Header Title -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 gap-3">
      <div>
        <div class="flex items-center gap-2">
          <span class="text-2xl">👑</span>
          <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">SuperAdmin Control Board</h1>
        </div>
        <p class="text-xs text-slate-500 mt-0.5">System-wide administration, firm provisioning, user management, and DB analytics</p>
      </div>
      <div class="flex items-center gap-2">
        <div v-if="firmSelectOptions.length > 0" class="flex items-center gap-1.5">
          <span class="text-[10px] uppercase font-bold text-slate-400">Active Context:</span>
          <USelect 
            :model-value="selectedFirmId || undefined" 
            :items="firmSelectOptions" 
            placeholder="Select Active Firm..."
            size="xs" 
            class="w-48"
            @update:model-value="(val: string) => selectFirm(val)"
          />
        </div>
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

    <!-- TAB COMPONENTS -->
    <FirmsManagement v-if="activeTab === 'firms'" ref="firmsRef" @open-firm-modal="openFirmModal" @update-stats="onFirmsCountUpdated" />
    <UserDirectory v-else-if="activeTab === 'users'" ref="usersRef" @open-user-modal="openUserModal" @update-stats="onUsersCountUpdated" />
    <SecurityLogs v-else-if="activeTab === 'logs'" ref="logsRef" />
    <SystemMetrics v-else-if="activeTab === 'metrics'" ref="metricsRef" />
    <PostgresConsole v-else-if="activeTab === 'postgres'" ref="pgRef" />
    <MongoConsole v-else-if="activeTab === 'mongodb'" ref="mongoRef" />
    <AiDataAnalyzer v-else-if="activeTab === 'analyzer'" @open-settings="isAiSettingsOpen = true" />
    <SystemSettings v-else-if="activeTab === 'settings'" ref="settingsRef" @open-ai-settings="isAiSettingsOpen = true" />

    <!-- Modals -->
    <FirmFormModal :open="isFirmModalOpen" :firm="selectedFirmForEdit" @close="isFirmModalOpen = false" @success="firmsRef?.fetchFirms()" />
    <UserFormModal :open="isUserModalOpen" :user="selectedUserForEdit" :available-firms="firmsRef?.firms || []" @close="isUserModalOpen = false" @success="usersRef?.fetchUsers()" />
    <SettingsDialog :open="isAiSettingsOpen" :providers="providers" @close-event="isAiSettingsOpen = false" />
  </div>
</template>
