<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'
import { runMasterRollAudit, type FullAuditReport } from '@/utils/masterRollAudit'

const emit = defineEmits(['close', 'edit'])
const { exportQualityReport, fetchEmployees } = useMasterRoll()

const loading = ref(true)
const exportLoading = ref(false)
const currentTab = ref<'missing' | 'invalid' | 'compliance' | 'duplicates'>('missing')
const allActiveEmployees = ref<any[]>([])

// Filter Controls
const searchQuery = ref('')
const selectedProject = ref('All Projects')
const selectedSite = ref('All Sites')
const selectedSeverity = ref('All Severities')

const fetchAllActive = async () => {
  loading.value = true
  try {
    const res = await fetchEmployees({ status: 'Active', activeOnly: 'true', limit: 5000 })
    if (res.success) {
      allActiveEmployees.value = res.data.filter((emp: any) => !emp.date_of_exit)
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAllActive()
})

const auditReport = computed<FullAuditReport>(() => {
  return runMasterRollAudit(allActiveEmployees.value)
})

// Unique Project & Site options
const projectOptions = computed(() => {
  const set = new Set<string>()
  allActiveEmployees.value.forEach(e => {
    if (e.project) set.add(e.project)
  })
  return ['All Projects', ...Array.from(set).sort()]
})

const siteOptions = computed(() => {
  const set = new Set<string>()
  allActiveEmployees.value.forEach(e => {
    if (e.site) set.add(e.site)
  })
  return ['All Sites', ...Array.from(set).sort()]
})

const severityOptions = ['All Severities', 'CRITICAL', 'WARNING']

const hasActiveFilters = computed(() => {
  return (
    searchQuery.value.trim() !== '' ||
    selectedProject.value !== 'All Projects' ||
    selectedSite.value !== 'All Sites' ||
    selectedSeverity.value !== 'All Severities'
  )
})

const clearFilters = () => {
  searchQuery.value = ''
  selectedProject.value = 'All Projects'
  selectedSite.value = 'All Sites'
  selectedSeverity.value = 'All Severities'
}

// Filter evaluation
const matchesFilters = (emp: any, severity?: 'CRITICAL' | 'WARNING'): boolean => {
  if (selectedProject.value !== 'All Projects' && emp.project !== selectedProject.value) {
    return false
  }
  if (selectedSite.value !== 'All Sites' && emp.site !== selectedSite.value) {
    return false
  }
  if (selectedSeverity.value !== 'All Severities' && severity && selectedSeverity.value !== severity) {
    return false
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    const nameMatch = emp.employee_name && emp.employee_name.toLowerCase().includes(q)
    const aadharMatch = emp.aadhar && emp.aadhar.toLowerCase().includes(q)
    const phoneMatch = emp.phone_no && emp.phone_no.toLowerCase().includes(q)
    const projectMatch = emp.project && emp.project.toLowerCase().includes(q)
    if (!nameMatch && !aadharMatch && !phoneMatch && !projectMatch) return false
  }
  return true
}

const filteredMissingData = computed(() => {
  return auditReport.value.missingData.filter(item => {
    const itemSeverity = item.criticalCount > 0 ? 'CRITICAL' : 'WARNING'
    return matchesFilters(item.employee, itemSeverity)
  })
})

const filteredFormatFailures = computed(() => {
  return auditReport.value.formatFailures.filter(item => {
    return matchesFilters(item.employee, item.severity)
  })
})

const filteredComplianceIssues = computed(() => {
  return auditReport.value.complianceIssues.filter(item => {
    return matchesFilters(item.employee, item.severity)
  })
})

const filteredDuplicates = computed(() => {
  return auditReport.value.duplicates.filter(group => {
    if (searchQuery.value.trim()) {
      const q = searchQuery.value.trim().toLowerCase()
      const valMatch = group.value.toLowerCase().includes(q)
      const empMatch = group.employees.some(e => 
        (e.employee_name && e.employee_name.toLowerCase().includes(q)) ||
        (e.project && e.project.toLowerCase().includes(q))
      )
      if (!valMatch && !empMatch) return false
    }
    return true
  })
})

const onDownload = async () => {
  exportLoading.value = true
  try {
    await exportQualityReport()
    emit('close')
  } finally {
    exportLoading.value = false
  }
}

const onEdit = (emp: any) => {
  emit('edit', emp)
}
</script>

<template>
  <div class="space-y-3.5 p-1">
    <!-- Compact Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
      <div class="flex items-center gap-2.5">
        <div class="p-1.5 bg-primary/10 rounded-lg text-primary">
          <UIcon name="i-heroicons-shield-check" class="w-5 h-5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-black uppercase tracking-tight text-slate-900 leading-none">Quality & Compliance Audit</h3>
            <UBadge 
              :color="auditReport.healthScore >= 90 ? 'success' : auditReport.healthScore >= 70 ? 'warning' : 'error'" 
              variant="subtle" 
              size="xs" 
              class="font-mono font-bold"
            >
              {{ auditReport.healthScore }}% Health
            </UBadge>
          </div>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            Active Workforce: {{ auditReport.totalActive }} Records Audited
          </p>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-1.5 self-end sm:self-auto">
        <UButton 
          :loading="exportLoading" 
          size="xs" 
          color="primary" 
          variant="solid" 
          icon="i-heroicons-arrow-down-tray" 
          label="Export Report" 
          @click="onDownload" 
        />
        <UButton 
          size="xs" 
          color="neutral" 
          variant="ghost" 
          icon="i-heroicons-x-mark" 
          @click="emit('close')" 
        />
      </div>
    </div>

    <!-- Compact Pillar Tab Strip -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <button 
        type="button"
        @click="currentTab = 'missing'" 
        class="flex items-center justify-between p-2 rounded-xl border text-left transition-all"
        :class="currentTab === 'missing' ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'"
      >
        <div>
          <p class="text-[9px] font-black uppercase tracking-tight text-amber-700">Missing Data</p>
          <p class="text-xs font-bold text-slate-600 mt-0.5">{{ auditReport.missingData.length }} records</p>
        </div>
        <UBadge :color="auditReport.missingData.length > 0 ? 'warning' : 'neutral'" size="xs" variant="subtle">
          {{ auditReport.missingData.length }}
        </UBadge>
      </button>

      <button 
        type="button"
        @click="currentTab = 'invalid'" 
        class="flex items-center justify-between p-2 rounded-xl border text-left transition-all"
        :class="currentTab === 'invalid' ? 'bg-rose-50/70 border-rose-300 ring-1 ring-rose-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'"
      >
        <div>
          <p class="text-[9px] font-black uppercase tracking-tight text-rose-700">Format Failures</p>
          <p class="text-xs font-bold text-slate-600 mt-0.5">{{ auditReport.formatFailures.length }} issues</p>
        </div>
        <UBadge :color="auditReport.formatFailures.length > 0 ? 'error' : 'neutral'" size="xs" variant="subtle">
          {{ auditReport.formatFailures.length }}
        </UBadge>
      </button>

      <button 
        type="button"
        @click="currentTab = 'compliance'" 
        class="flex items-center justify-between p-2 rounded-xl border text-left transition-all"
        :class="currentTab === 'compliance' ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'"
      >
        <div>
          <p class="text-[9px] font-black uppercase tracking-tight text-indigo-700">Compliance & Wage</p>
          <p class="text-xs font-bold text-slate-600 mt-0.5">{{ auditReport.complianceIssues.length }} flags</p>
        </div>
        <UBadge :color="auditReport.complianceIssues.length > 0 ? 'info' : 'neutral'" size="xs" variant="subtle">
          {{ auditReport.complianceIssues.length }}
        </UBadge>
      </button>

      <button 
        type="button"
        @click="currentTab = 'duplicates'" 
        class="flex items-center justify-between p-2 rounded-xl border text-left transition-all"
        :class="currentTab === 'duplicates' ? 'bg-purple-50/70 border-purple-300 ring-1 ring-purple-400' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'"
      >
        <div>
          <p class="text-[9px] font-black uppercase tracking-tight text-purple-700">Duplicate Scan</p>
          <p class="text-xs font-bold text-slate-600 mt-0.5">{{ auditReport.duplicates.length }} clashes</p>
        </div>
        <UBadge :color="auditReport.duplicates.length > 0 ? 'secondary' : 'neutral'" size="xs" variant="subtle">
          {{ auditReport.duplicates.length }}
        </UBadge>
      </button>
    </div>

    <!-- Micro Filter Toolbar -->
    <div class="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
      <UInput 
        v-model="searchQuery" 
        size="xs" 
        icon="i-heroicons-magnifying-glass" 
        placeholder="Filter employee..." 
        class="w-full sm:w-44 bg-white" 
      />
      <USelect 
        v-model="selectedProject" 
        :items="projectOptions" 
        size="xs" 
        class="w-36 bg-white" 
      />
      <USelect 
        v-model="selectedSite" 
        :items="siteOptions" 
        size="xs" 
        class="w-32 bg-white" 
      />
      <USelect 
        v-if="currentTab !== 'duplicates'"
        v-model="selectedSeverity" 
        :items="severityOptions" 
        size="xs" 
        class="w-32 bg-white" 
      />
      <UButton 
        v-if="hasActiveFilters" 
        size="xs" 
        variant="ghost" 
        color="neutral" 
        icon="i-heroicons-x-mark" 
        label="Clear" 
        @click="clearFilters" 
      />
    </div>

    <!-- Compact Data Table Container -->
    <div class="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white relative">
      <!-- Loading Indicator -->
      <div v-if="loading" class="p-8 flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
        <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin text-primary" />
        <span>Scanning workforce records...</span>
      </div>

      <div v-else class="max-h-[50vh] overflow-y-auto custom-scrollbar">
        <!-- ── TAB 1: MISSING DATA ── -->
        <table v-if="currentTab === 'missing'" class="w-full text-xs text-left border-collapse">
          <thead class="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
            <tr>
              <th class="py-2 px-3">Employee</th>
              <th class="py-2 px-3">Project / Site</th>
              <th class="py-2 px-3">Missing Attributes</th>
              <th class="py-2 px-3 text-center">Severity</th>
              <th class="py-2 px-3 text-right w-16">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="filteredMissingData.length === 0">
              <td colspan="5" class="py-10 text-center text-emerald-600 font-bold text-xs">
                Zero missing attributes detected for filtered criteria.
              </td>
            </tr>
            <tr v-for="item in filteredMissingData" :key="item.employee._id" class="hover:bg-slate-50/70 transition-colors">
              <td class="py-2 px-3 font-bold text-slate-900">
                <div class="flex items-center gap-2">
                  <UAvatar :alt="item.employee.employee_name" size="2xs" />
                  <span class="truncate max-w-[140px]">{{ item.employee.employee_name }}</span>
                </div>
              </td>
              <td class="py-2 px-3 text-slate-600">
                <span class="font-medium text-slate-800">{{ item.employee.project || '-' }}</span>
                <span class="text-[10px] text-slate-400 block">{{ item.employee.site || '-' }}</span>
              </td>
              <td class="py-2 px-3">
                <div class="flex flex-wrap gap-1">
                  <span 
                    v-for="field in item.missingFields" 
                    :key="field.key" 
                    class="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border"
                    :class="field.severity === 'CRITICAL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'"
                  >
                    {{ field.label }}
                  </span>
                </div>
              </td>
              <td class="py-2 px-3 text-center">
                <UBadge 
                  :color="item.criticalCount > 0 ? 'error' : 'warning'" 
                  size="xs" 
                  variant="subtle" 
                  class="text-[9px] font-black"
                >
                  {{ item.criticalCount > 0 ? `${item.criticalCount} Critical` : `${item.warningCount} Warn` }}
                </UBadge>
              </td>
              <td class="py-2 px-3 text-right">
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-pencil-square" label="Fix" @click="onEdit(item.employee)" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- ── TAB 2: FORMAT FAILURES ── -->
        <table v-else-if="currentTab === 'invalid'" class="w-full text-xs text-left border-collapse">
          <thead class="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
            <tr>
              <th class="py-2 px-3">Employee</th>
              <th class="py-2 px-3">Field</th>
              <th class="py-2 px-3">Detected Value</th>
              <th class="py-2 px-3">Rule Violated</th>
              <th class="py-2 px-3 text-right w-16">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="filteredFormatFailures.length === 0">
              <td colspan="5" class="py-10 text-center text-emerald-600 font-bold text-xs">
                All Phone, Aadhaar, PAN, IFSC & Bank Account formats are valid.
              </td>
            </tr>
            <tr v-for="(item, idx) in filteredFormatFailures" :key="idx" class="hover:bg-slate-50/70 transition-colors">
              <td class="py-2 px-3 font-bold text-slate-900">
                <span>{{ item.employee.employee_name }}</span>
                <span class="text-[10px] text-slate-400 block font-normal">{{ item.employee.project || '-' }}</span>
              </td>
              <td class="py-2 px-3 font-bold text-slate-700">
                <UBadge size="xs" variant="outline" color="neutral">{{ item.targetField }}</UBadge>
              </td>
              <td class="py-2 px-3 font-mono font-bold text-rose-600">
                {{ item.value }}
              </td>
              <td class="py-2 px-3 text-rose-600 text-[11px] font-medium">
                {{ item.issue }}
              </td>
              <td class="py-2 px-3 text-right">
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-pencil-square" label="Fix" @click="onEdit(item.employee)" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- ── TAB 3: STATUTORY & COMPLIANCE ── -->
        <table v-else-if="currentTab === 'compliance'" class="w-full text-xs text-left border-collapse">
          <thead class="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200 text-[10px] font-black uppercase text-slate-600">
            <tr>
              <th class="py-2 px-3">Employee</th>
              <th class="py-2 px-3">Category</th>
              <th class="py-2 px-3">Compliance Flag</th>
              <th class="py-2 px-3">Details</th>
              <th class="py-2 px-3 text-right w-16">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="filteredComplianceIssues.length === 0">
              <td colspan="5" class="py-10 text-center text-emerald-600 font-bold text-xs">
                Zero age, chronological or daily wage anomalies detected.
              </td>
            </tr>
            <tr v-for="(item, idx) in filteredComplianceIssues" :key="idx" class="hover:bg-slate-50/70 transition-colors">
              <td class="py-2 px-3 font-bold text-slate-900">
                <span>{{ item.employee.employee_name }}</span>
                <span class="text-[10px] text-slate-400 block font-normal">{{ item.employee.project || '-' }}</span>
              </td>
              <td class="py-2 px-3">
                <UBadge :color="item.category === 'AGE' ? 'error' : item.category === 'WAGE' ? 'warning' : 'info'" size="xs" variant="subtle">
                  {{ item.category }}
                </UBadge>
              </td>
              <td class="py-2 px-3 font-bold text-slate-800">
                {{ item.issue }}
              </td>
              <td class="py-2 px-3 text-slate-500 text-[11px]">
                {{ item.detail }}
              </td>
              <td class="py-2 px-3 text-right">
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-pencil-square" label="Fix" @click="onEdit(item.employee)" />
              </td>
            </tr>
          </tbody>
        </table>

        <!-- ── TAB 4: DUPLICATE RECORDS ── -->
        <div v-else-if="currentTab === 'duplicates'" class="p-3 space-y-2.5">
          <div v-if="filteredDuplicates.length === 0" class="py-10 text-center text-emerald-600 font-bold text-xs">
            Zero duplicate Aadhaar, Bank Accounts or Phones detected.
          </div>
          <div 
            v-for="(group, idx) in filteredDuplicates" 
            :key="idx" 
            class="border border-purple-200 bg-purple-50/30 rounded-xl p-2.5"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5">
                <UBadge color="secondary" size="xs" variant="solid">{{ group.field }}</UBadge>
                <span class="font-mono font-bold text-xs text-slate-800">{{ group.value }}</span>
              </div>
              <span class="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                {{ group.count }} Colliding Records
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              <div 
                v-for="emp in group.employees" 
                :key="emp._id" 
                class="bg-white border border-slate-200 px-2.5 py-1.5 rounded-lg flex items-center justify-between shadow-2xs"
              >
                <div>
                  <p class="font-bold text-slate-900 text-xs leading-tight">{{ emp.employee_name }}</p>
                  <p class="text-[9px] text-slate-400 uppercase">{{ emp.project || 'No Project' }}</p>
                </div>
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-pencil-square" @click="onEdit(emp)" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Compact Footer -->
    <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
      <div class="flex items-center gap-3">
        <span><strong class="text-emerald-600">{{ auditReport.perfectRecordsCount }}</strong> Compliant</span>
        <span>•</span>
        <span><strong class="text-rose-600">{{ auditReport.summary.affectedEmployeesCount }}</strong> Action Required</span>
      </div>
      <UButton size="xs" color="neutral" variant="outline" label="Close" @click="emit('close')" />
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}
</style>
