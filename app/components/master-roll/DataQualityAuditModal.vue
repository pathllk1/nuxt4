<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'

const emit = defineEmits(['close', 'edit'])
const { exportQualityReport, fetchEmployees } = useMasterRoll()

const loading = ref(true)
const exportLoading = ref(false)
const currentTab = ref<'missing' | 'invalid'>('missing')
const allActiveEmployees = ref<any[]>([])

const fetchAllActive = async () => {
  loading.value = true
  try {
    const res = await fetchEmployees({ status: 'Active', activeOnly: 'true', limit: 2000 })
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

const REQUIRED_FIELDS = [
  { key: 'phone_no', label: 'Phone' },
  { key: 'pan', label: 'PAN' },
  { key: 'aadhar', label: 'Aadhar' },
  { key: 'uan', label: 'UAN' },
  { key: 'project', label: 'Project' },
  { key: 'site', label: 'Site' }
]

const isFieldValMissing = (key: string, value: any): boolean => {
  if (value === undefined || value === null) return true
  const str = value.toString().trim()
  if (str === '') return true

  const lower = str.toLowerCase()
  if (lower === 'n/a' || lower === 'none' || lower === 'null' || lower === 'undefined') return true

  if (key === 'phone_no') {
    if (str === '0' || /^0+$/.test(str)) return true
    if (/^(\d)\1{9}$/.test(str)) return true
    if ('0123456789876543210'.includes(str)) return true
  }

  if (key === 'aadhar') {
    if (str === '0' || /^0+$/.test(str)) return true
    if (/^(\d)\1{11}$/.test(str)) return true
  }

  if (key === 'uan') {
    if (str === '0' || /^0+$/.test(str)) return true
  }

  return false
}

const missingDataReport = computed(() => {
  return allActiveEmployees.value.map(emp => {
    const missing = REQUIRED_FIELDS.filter(f => isFieldValMissing(f.key, emp[f.key]))
    return missing.length > 0 ? {
      ...emp,
      missingFields: missing
    } : null
  }).filter(Boolean) as any[]
})

const invalidDataReport = computed(() => {
  const report: any[] = []
  allActiveEmployees.value.forEach(emp => {
    if (emp.phone_no && !isFieldValMissing('phone_no', emp.phone_no)) {
      const val = emp.phone_no.toString().trim()
      if (!/^\d{10}$/.test(val)) {
        report.push({ ...emp, targetField: 'Phone', value: val, issue: 'Must be 10 digits' })
      } else {
        const allSame = /^(\d)\1{9}$/.test(val)
        const sequential = '0123456789876543210'.includes(val)
        if (allSame || sequential) {
          report.push({ ...emp, targetField: 'Phone', value: val, issue: 'FAKE/PATTERN DETECTED' })
        }
      }
    }

    if (emp.aadhar && !isFieldValMissing('aadhar', emp.aadhar)) {
      const val = emp.aadhar.toString().trim()
      if (!/^\d{12}$/.test(val)) {
        report.push({ ...emp, targetField: 'Aadhar', value: val, issue: 'Must be 12 digits' })
      } else if (/^(\d)\1{11}$/.test(val)) {
        report.push({ ...emp, targetField: 'Aadhar', value: val, issue: 'FAKE PATTERN' })
      }
    }

    if (emp.pan && !isFieldValMissing('pan', emp.pan)) {
      const val = emp.pan.toString().trim().toUpperCase()
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(val)) {
        report.push({ ...emp, targetField: 'PAN', value: val, issue: 'Invalid Format (ABCDE1234F)' })
      }
    }
  })
  return report
})

const auditStats = computed(() => {
  const total = allActiveEmployees.value.length
  const missingCount = missingDataReport.value.length
  const invalidIds = new Set(invalidDataReport.value.map(r => r._id || r.id))
  const totalIssueIds = new Set([
    ...missingDataReport.value.map(r => r._id || r.id),
    ...Array.from(invalidIds)
  ])

  return {
    total,
    complete: total - totalIssueIds.size,
    missing: missingCount,
    invalid: invalidIds.size
  }
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
  <div class="bg-white rounded-2xl shadow-2xl w-full h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-300">
    <!-- Enterprise Header -->
    <div class="bg-gradient-to-r from-emerald-500 via-teal-600 to-indigo-600 px-8 py-5 flex justify-between items-center shrink-0">
      <div class="flex items-center gap-4">
        <div class="bg-white/20 p-2.5 rounded-xl shadow-lg">
          <UIcon name="i-heroicons-shield-check" class="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 class="text-2xl font-black text-white tracking-tight leading-tight">Active Force Intelligence</h2>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="w-2 h-2 bg-emerald-200 rounded-full animate-pulse"></span>
            <p class="text-emerald-100 text-[10px] font-black uppercase tracking-[0.2em]">Auditing Active Personnel Only</p>
          </div>
        </div>
      </div>
      <button @click="emit('close')" class="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-xl transition-all duration-200">
        <UIcon name="i-heroicons-x-mark" class="w-7 h-7" />
      </button>
    </div>

    <!-- Main Layout -->
    <div class="flex-1 overflow-hidden flex flex-col bg-slate-50 relative">
      <!-- Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 z-50 bg-slate-50/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
        <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin text-primary" />
        <p class="text-sm font-black text-slate-500 uppercase tracking-widest">Scanning Workforce Intelligence...</p>
      </div>

      <!-- Summary Dashboard -->
      <div class="p-8 pb-0 shrink-0">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Active Employees</div>
            <div class="text-4xl font-black text-slate-900 tabular-nums">{{ auditStats.total }}</div>
          </div>
          <div class="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Verified Records</div>
            <div class="text-4xl font-black text-emerald-700 tabular-nums">{{ auditStats.complete }}</div>
          </div>
          <div class="bg-amber-50 border border-amber-100 rounded-3xl p-6 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Action Required</div>
            <div class="text-4xl font-black text-amber-700 tabular-nums">{{ auditStats.missing }}</div>
          </div>
          <div class="bg-rose-50 border border-rose-100 rounded-3xl p-6 shadow-sm transition-transform duration-300 hover:scale-[1.02]">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Data Failures</div>
            <div class="text-4xl font-black text-rose-700 tabular-nums">{{ auditStats.invalid }}</div>
          </div>
        </div>
      </div>

      <!-- Tab Container -->
      <div class="px-8 mt-8 flex-1 overflow-hidden flex flex-col">
        <div class="flex gap-2 bg-slate-200/50 p-1.5 rounded-2xl w-fit shrink-0">
          <button 
            @click="currentTab = 'missing'"
            class="px-8 py-3 rounded-xl font-black text-sm transition-all duration-200"
            :class="currentTab === 'missing' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'"
          >
            MISSING DATA AUDIT
          </button>
          <button 
            @click="currentTab = 'invalid'"
            class="px-8 py-3 rounded-xl font-black text-sm transition-all duration-200"
            :class="currentTab === 'invalid' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-500 hover:text-slate-700'"
          >
            VALIDATION FAILURES
          </button>
        </div>

        <!-- Table Viewports -->
        <div class="mt-6 flex-1 overflow-hidden bg-white rounded-3xl border border-slate-200 shadow-inner flex flex-col mb-8">
          <!-- Missing Tab -->
          <div v-if="currentTab === 'missing'" class="flex-1 flex flex-col overflow-hidden">
            <div class="overflow-auto flex-1 custom-scrollbar">
              <table class="w-full text-sm border-collapse">
                <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Employee</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Project / Site</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Missing Attributes</th>
                    <th class="px-8 py-4 text-center font-black text-slate-500 uppercase tracking-widest text-[11px]">Severity</th>
                    <th class="px-8 py-4 text-right font-black text-slate-500 uppercase tracking-widest text-[11px] w-20">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-if="missingDataReport.length === 0">
                    <td colspan="5" class="px-8 py-20 text-center text-emerald-500 font-black tracking-widest uppercase">Perfect Data Completeness</td>
                  </tr>
                  <tr v-for="emp in missingDataReport" :key="emp._id" class="hover:bg-slate-50 transition-colors">
                    <td class="px-8 py-5 font-black text-slate-800">{{ emp.employee_name }}</td>
                    <td class="px-8 py-5">
                      <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-600">{{ emp.project || 'N/A' }}</span>
                        <span class="text-[10px] text-slate-400 uppercase tracking-tighter">{{ emp.site || 'N/A' }}</span>
                      </div>
                    </td>
                    <td class="px-8 py-5">
                      <div class="flex flex-wrap gap-2">
                        <span v-for="field in emp.missingFields" :key="field.key" class="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-amber-200">
                          {{ field.label }}
                        </span>
                      </div>
                    </td>
                    <td class="px-8 py-5 text-center">
                      <span class="px-3 py-1 bg-amber-500 text-white rounded-lg text-[10px] font-black">{{ emp.missingFields.length }}</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                      <UButton variant="ghost" color="neutral" size="sm" icon="i-heroicons-pencil-square" @click="onEdit(emp)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Invalid Tab -->
          <div v-else class="flex-1 flex flex-col overflow-hidden">
            <div class="overflow-auto flex-1 custom-scrollbar">
              <table class="w-full text-sm border-collapse">
                <thead class="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Employee</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Project / Site</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Target Field</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Detected Value</th>
                    <th class="px-8 py-4 text-left font-black text-slate-500 uppercase tracking-widest text-[11px]">Validation Logic</th>
                    <th class="px-8 py-4 text-right font-black text-slate-500 uppercase tracking-widest text-[11px] w-20">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr v-if="invalidDataReport.length === 0">
                    <td colspan="6" class="px-8 py-20 text-center text-emerald-500 font-black tracking-widest uppercase">All Formats Validated</td>
                  </tr>
                  <tr v-for="(r, idx) in invalidDataReport" :key="idx" class="hover:bg-slate-50 transition-colors">
                    <td class="px-8 py-5 font-black text-slate-800">{{ r.employee_name }}</td>
                    <td class="px-8 py-5">
                      <div class="flex flex-col">
                        <span class="text-xs font-bold text-slate-600">{{ r.project || 'N/A' }}</span>
                        <span class="text-[10px] text-slate-400 uppercase tracking-tighter">{{ r.site || 'N/A' }}</span>
                      </div>
                    </td>
                    <td class="px-8 py-5">
                      <span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-black border border-indigo-100 uppercase">{{ r.targetField }}</span>
                    </td>
                    <td class="px-8 py-5 font-mono text-xs text-rose-600 font-black">{{ r.value }}</td>
                    <td class="px-8 py-5">
                      <span class="text-xs font-black text-rose-500 italic uppercase">{{ r.issue }}</span>
                    </td>
                    <td class="px-8 py-5 text-right">
                      <UButton variant="ghost" color="neutral" size="sm" icon="i-heroicons-pencil-square" @click="onEdit(r)" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Enterprise Footer -->
    <div class="bg-white border-t border-slate-200 px-10 py-6 flex justify-between items-center shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
      <div class="flex items-center gap-6">
        <div class="flex flex-col">
          <span class="text-slate-400 text-[10px] font-black uppercase tracking-tighter leading-none">Audit Scope</span>
          <span class="text-emerald-600 text-xs font-bold uppercase tracking-widest mt-1">Active Personnel Only</span>
        </div>
        <div class="w-px h-8 bg-slate-200"></div>
        <p class="text-xs text-slate-400 max-w-md leading-relaxed">
          Inactive, suspended, or exited employees are automatically excluded from this intelligence report.
        </p>
      </div>
      <div class="flex gap-4">
        <UButton size="xl" variant="ghost" color="neutral" label="DISMISS" @click="emit('close')" class="px-8 py-4 rounded-2xl font-black" />
        <UButton 
          :loading="exportLoading" 
          size="xl" 
          color="primary" 
          icon="i-heroicons-arrow-down-tray" 
          label="EXPORT ACTIVE FORCE AUDIT" 
          @click="onDownload" 
          class="px-10 py-4 rounded-2xl font-black shadow-2xl shadow-primary/40" 
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e2e8f0;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
}
</style>
