<script setup lang="ts">
import { ref, onMounted, reactive, watch, computed } from 'vue'
import { useToast } from '#imports'
import { useMasterRoll } from '@/composables/useMasterRoll'
import { useAuth } from '@/composables/useAuth'
import MasterRollForm from '@/components/master-roll/MasterRollForm.vue'
import MasterRollImport from '@/components/master-roll/MasterRollImport.vue'
import BulkEditModal from '@/components/master-roll/BulkEditModal.vue'
import ActivityLog from '@/components/master-roll/ActivityLog.vue'
import ICardFilterModal from '@/components/master-roll/ICardFilterModal.vue'
import DataQualityAuditModal from '@/components/master-roll/DataQualityAuditModal.vue'
import WagesSummaryModal from '@/components/master-roll/WagesSummaryModal.vue'

definePageMeta({
  layout: 'default'
})

const { 
  loading, employees, stats, 
  fetchEmployees, fetchStats,
  exportExcel, exportICards, downloadTemplate,
  exportQualityReport, downloadAppointmentLetter,
  fetchUniqueFields
} = useMasterRoll()

const { selectedFirmId } = useAuth()
const toast = useToast()

const currentPage = ref(1)
const itemsPerPageOptions = ['10', '25', '50', '100']
const itemsPerPageString = ref('10')
const itemsPerPage = computed(() => parseInt(itemsPerPageString.value, 10) || 10)

watch(itemsPerPage, () => {
  currentPage.value = 1
})

const filters = reactive({
  q: '',
  status: '',
  project: '',
  site: '',
  category: '',
  bank: '',
  doj_start: '',
  doj_end: '',
  sortBy: '',
  sortOrder: ''
})

const filteredEmployees = computed(() => {
  const query = (filters.q || '').trim().toLowerCase()
  if (!query) return employees.value

  return employees.value.filter(emp => {
    return (
      (emp.employee_name && emp.employee_name.toLowerCase().includes(query)) ||
      (emp.aadhar && emp.aadhar.toLowerCase().includes(query)) ||
      (emp.phone_no && emp.phone_no.toLowerCase().includes(query)) ||
      (emp.project && emp.project.toLowerCase().includes(query)) ||
      (emp.site && emp.site.toLowerCase().includes(query))
    )
  })
})

const paginatedEmployees = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  const end = start + itemsPerPage.value
  return filteredEmployees.value.slice(start, end)
})

const displayStart = computed(() => {
  if (filteredEmployees.value.length === 0) return 0
  return (currentPage.value - 1) * itemsPerPage.value + 1
})

const displayEnd = computed(() => {
  const end = currentPage.value * itemsPerPage.value
  return end > filteredEmployees.value.length ? filteredEmployees.value.length : end
})

watch(employees, () => {
  currentPage.value = 1
})

watch(() => filters.q, () => {
  currentPage.value = 1
})

const sorting = ref<any[]>([])
const selectedRows = ref<any[]>([])

const showFilterPanel = ref(false)
const uniqueOptions = ref({
  projects: [] as string[],
  sites: [] as string[],
  categories: [] as string[],
  banks: [] as string[]
})

const fetchOptions = async () => {
  try {
    const res = await fetchUniqueFields()
    if (res.success) {
      uniqueOptions.value = res.data
    }
  } catch (err) {
    console.error('Failed to fetch filter options', err)
  }
}

const statusOptions = ['All Status', 'Active', 'Inactive', 'Left']
const projectOptions = computed(() => ['All Projects', ...uniqueOptions.value.projects])
const siteOptions = computed(() => ['All Sites', ...uniqueOptions.value.sites])
const categoryOptions = computed(() => ['All Categories', ...uniqueOptions.value.categories])
const bankOptions = computed(() => ['All Banks', ...uniqueOptions.value.banks])

const handleFilterUpdate = (key: string, value: string) => {
  if (value.startsWith('All ')) {
    (filters as any)[key] = ''
  } else {
    (filters as any)[key] = value
  }
}

watch(sorting, (newVal) => {
  if (newVal && newVal.length > 0) {
    filters.sortBy = newVal[0].id
    filters.sortOrder = newVal[0].desc ? 'desc' : 'asc'
  } else {
    filters.sortBy = ''
    filters.sortOrder = ''
  }
})

watch(
  [
    () => [
      filters.status,
      filters.project,
      filters.site,
      filters.category,
      filters.bank,
      filters.doj_start,
      filters.doj_end,
      filters.sortBy,
      filters.sortOrder
    ],
    selectedFirmId
  ],
  () => {
    if (selectedFirmId.value) fetchData()
  }
)

const fetchData = async () => {
  const apiParams = {
    status: filters.status,
    project: filters.project,
    site: filters.site,
    category: filters.category,
    bank: filters.bank,
    doj_start: filters.doj_start,
    doj_end: filters.doj_end,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  }
  await Promise.all([
    fetchEmployees(apiParams),
    fetchStats()
  ])
  selectedRows.value = []
}

onMounted(() => {
  if (selectedFirmId.value) {
    fetchData()
    fetchOptions()
  }
})

const showColumnPanel = ref(false)
const allColumns = [
  { key: 'select', label: 'Select' },
  { key: 'employee_name', label: 'Employee' },
  { key: 'father_husband_name', label: 'Father/Husband' },
  { key: 'date_of_birth', label: 'DOB' },
  { key: 'aadhar', label: 'Aadhar' },
  { key: 'pan', label: 'PAN' },
  { key: 'phone_no', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'bank', label: 'Bank' },
  { key: 'account_no', label: 'Account No' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'branch', label: 'Branch' },
  { key: 'uan', label: 'UAN' },
  { key: 'esic_no', label: 'ESIC' },
  { key: 's_kalyan_no', label: 'S. Kalyan' },
  { key: 'category', label: 'Category' },
  { key: 'p_day_wage', label: 'Wage' },
  { key: 'project', label: 'Project' },
  { key: 'site', label: 'Site' },
  { key: 'date_of_joining', label: 'Joining' },
  { key: 'date_of_exit', label: 'Exit' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' }
]

const visibleColumns = ref(['select', 'employee_name', 'aadhar', 'phone_no', 'category', 'project', 'status', 'actions'])

const toggleColumn = (key: string, val: boolean) => {
  if (val) {
    if (!visibleColumns.value.includes(key)) visibleColumns.value.push(key)
  } else {
    visibleColumns.value = visibleColumns.value.filter(k => k !== key)
  }
}

const columns = computed(() => {
  return allColumns
    .filter(col => visibleColumns.value.includes(col.key))
    .map(col => {
      if (col.key === 'select' || col.key === 'actions') {
        return { id: col.key, header: col.key === 'select' ? '' : col.label, enableSorting: false }
      }
      return { id: col.key, accessorKey: col.key, header: col.label, enableSorting: true }
    })
})

const isOpen = ref(false)
const isImportOpen = ref(false)
const isActivityOpen = ref(false)
const isICardModalOpen = ref(false)
const isQualityModalOpen = ref(false)
const isBulkEditOpen = ref(false)
const selectedEmployee = ref<any>(null)
const isWagesSummaryOpen = ref(false)
const selectedEmployeeForWages = ref<any>(null)

const openModal = (emp: any = null) => {
  selectedEmployee.value = emp
  isOpen.value = true
}

const openWagesSummary = (emp: any) => {
  selectedEmployeeForWages.value = emp
  isWagesSummaryOpen.value = true
}

const openActivity = (emp: any) => {
  selectedEmployee.value = emp
  isActivityOpen.value = true
}

const onDownloadLetter = async (emp: any) => {
  try {
    await downloadAppointmentLetter(emp._id, emp.employee_name)
    toast.add({ title: 'Success', description: 'Appointment letter downloaded', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const onDownloadICard = async (emp: any, format: 'pdf' | 'xlsx' = 'pdf') => {
  try {
    await exportICards({ employeeId: emp._id }, format)
    toast.add({ title: 'Success', description: `I-Card (${format.toUpperCase()}) downloaded for ${emp.employee_name}`, color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const onExportSelected = async () => {
  const ids = selectedRows.value.map(row => row._id)
  try {
    await exportExcel(ids)
    toast.add({ title: 'Success', description: `Exported ${ids.length} employees`, color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const isAllSelected = computed(() => {
  if (paginatedEmployees.value.length === 0) return false
  return paginatedEmployees.value.every(emp => selectedRows.value.some(r => r._id === emp._id))
})

const toggleSelectAll = (checked: boolean) => {
  if (checked) {
    paginatedEmployees.value.forEach(emp => {
      if (!selectedRows.value.some(r => r._id === emp._id)) {
        selectedRows.value.push(emp)
      }
    })
  } else {
    const pageIds = paginatedEmployees.value.map(emp => emp._id)
    selectedRows.value = selectedRows.value.filter(r => !pageIds.includes(r._id))
  }
}

const toggleRowSelection = (emp: any, checked: boolean) => {
  if (checked) {
    if (!selectedRows.value.some(r => r._id === emp._id)) {
      selectedRows.value.push(emp)
    }
  } else {
    selectedRows.value = selectedRows.value.filter(r => r._id !== emp._id)
  }
}

const statCards = computed(() => {
  const s = stats.value || {}
  return [
    {
      label: 'Total Employees',
      value: s.total_employees || 0,
      colorClass: 'text-indigo-500',
      bgGradient: 'bg-indigo-500/5',
      icon: 'i-heroicons-users'
    },
    {
      label: 'Active Employees',
      value: s.total_active || 0,
      colorClass: 'text-emerald-500',
      bgGradient: 'bg-emerald-500/5',
      icon: 'i-heroicons-user-plus'
    },
    {
      label: 'Left Employees',
      value: s.left_employees || 0,
      colorClass: 'text-rose-500',
      bgGradient: 'bg-rose-500/5',
      icon: 'i-heroicons-user-minus'
    },
    {
      label: 'Total Projects',
      value: s.total_projects || 0,
      colorClass: 'text-amber-500',
      bgGradient: 'bg-amber-500/5',
      icon: 'i-heroicons-briefcase'
    },
    {
      label: 'Active Sites',
      value: s.total_sites || 0,
      colorClass: 'text-violet-500',
      bgGradient: 'bg-violet-500/5',
      icon: 'i-heroicons-map-pin'
    }
  ]
})

const headerActions = [
  [
    { label: 'Template', icon: 'i-heroicons-arrow-down-tray', onSelect: downloadTemplate },
    { label: 'Import', icon: 'i-heroicons-cloud-arrow-up', onSelect: () => isImportOpen.value = true },
    { label: 'Bulk Edit', icon: 'i-heroicons-pencil-square', onSelect: () => isBulkEditOpen.value = true }
  ]
]
</script>

<template>
  <div class="h-full flex flex-col space-y-4 overflow-hidden p-2 md:p-4">
    <!-- Header: Optimized for mobile -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 px-1">
      <div class="flex items-center gap-3">
        <div class="p-2 bg-primary/10 rounded-xl">
          <UIcon name="i-heroicons-users" class="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 class="text-xl font-black tracking-tight uppercase text-slate-900 leading-none">Master Roll</h1>
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Enterprise Employee Management</p>
        </div>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Desktop Actions -->
        <div class="hidden lg:flex items-center gap-2">
          <UTooltip text="Download Import Template">
            <UButton color="neutral" variant="outline" size="xs" icon="i-heroicons-arrow-down-tray" label="Template" @click="downloadTemplate" />
          </UTooltip>
          <UTooltip text="Bulk Import from Excel">
            <UButton color="neutral" variant="outline" size="xs" icon="i-heroicons-cloud-arrow-up" label="Import" @click="isImportOpen = true" />
          </UTooltip>
          <UTooltip text="Bulk Edit Spreadsheet View">
            <UButton color="neutral" variant="outline" size="xs" icon="i-heroicons-pencil-square" label="Bulk Edit" @click="isBulkEditOpen = true" />
          </UTooltip>
        </div>

        <!-- Mobile/Tablet Actions Dropdown -->
        <div class="lg:hidden">
          <UDropdownMenu :items="headerActions">
            <UButton color="neutral" variant="outline" size="sm" icon="i-heroicons-ellipsis-horizontal" />
          </UDropdownMenu>
        </div>

        <UButton icon="i-heroicons-plus" size="sm" label="Add New" class="sm:hidden" @click="openModal()" />
        <UButton icon="i-heroicons-plus" size="sm" label="Add New Employee" class="hidden sm:flex" @click="openModal()" />
      </div>
    </div>

    <!-- Stats Summary - Scrollable on mobile -->
    <div class="flex overflow-x-auto pb-2 sm:pb-0 sm:grid sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0 px-1 no-scrollbar">
      <div v-for="card in statCards" :key="card.label" 
           class="min-w-[140px] sm:min-w-0 relative overflow-hidden bg-white rounded-xl border border-slate-200 p-3 shadow-sm group hover:shadow-md transition-shadow">
        <!-- Accent corner overlay -->
        <div class="absolute top-0 right-0 w-16 h-16 rounded-bl-full transition-all duration-300" :class="card.bgGradient"></div>
        
        <!-- Corner floating icon -->
        <div class="absolute top-3 right-3 opacity-15 group-hover:opacity-30 transition-opacity">
          <UIcon :name="card.icon" class="w-5 h-5" :class="card.colorClass" />
        </div>

        <p class="text-[9px] font-black uppercase tracking-widest leading-none" :class="card.colorClass">
          {{ card.label }}
        </p>
        <p class="text-xl font-black text-slate-900 leading-none mt-1.5 font-mono">
          {{ card.value }}
        </p>
        
        <!-- Record detail indicator -->
        <div class="flex items-center gap-1 mt-1 text-[8px] font-bold text-slate-400 uppercase tracking-wider">
          <span class="w-1.5 h-1.5 rounded-full bg-current" :class="card.colorClass"></span>
          <span>Record Count</span>
        </div>
      </div>
    </div>

    <UCard class="flex-1 min-h-0 flex flex-col" :ui="{ body: 'flex-1 overflow-hidden p-0 flex flex-col', root: 'overflow-hidden border border-slate-200 shadow-sm rounded-2xl bg-white' }">
      <!-- Toolbar -->
      <div class="p-3 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="filters.q" size="sm" icon="i-heroicons-magnifying-glass" placeholder="Search..." class="flex-1 lg:flex-none lg:w-64 bg-white" variant="outline" />
          <USelect v-model="filters.status" size="sm" :items="['Active', 'Inactive', 'Left']" placeholder="All Status" class="w-full sm:w-32 bg-white" />
          <div v-if="selectedRows.length > 0" class="hidden sm:block h-6 w-px bg-slate-200 mx-1" />
          <UButton v-if="selectedRows.length > 0" color="primary" variant="soft" size="sm" icon="i-heroicons-arrow-up-tray" :label="`Export Selected (${selectedRows.length})`" @click="onExportSelected" />
        </div>
        <div class="flex items-center justify-between lg:justify-end gap-1.5 overflow-x-auto no-scrollbar py-1 lg:py-0">
          <UTooltip text="Quality Audit">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-shield-check" @click="isQualityModalOpen = true" />
          </UTooltip>
          <UTooltip text="Export Excel">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-table-cells" @click="() => exportExcel()" />
          </UTooltip>
          <UTooltip text="I-Cards">
            <UButton color="neutral" variant="ghost" size="sm" icon="i-heroicons-identification" @click="isICardModalOpen = true" />
          </UTooltip>
          <UTooltip text="Filters">
            <UButton color="neutral" variant="ghost" size="sm" :icon="showFilterPanel ? 'i-heroicons-funnel-slash' : 'i-heroicons-funnel'" @click="showFilterPanel = !showFilterPanel" />
          </UTooltip>
          <UTooltip text="Columns" class="hidden sm:block">
            <UButton color="neutral" variant="ghost" size="sm" :icon="showColumnPanel ? 'i-heroicons-chevron-up' : 'i-heroicons-view-columns'" @click="showColumnPanel = !showColumnPanel" />
          </UTooltip>
        </div>
      </div>

      <!-- Advanced Filter Panel -->
      <div v-if="showFilterPanel" class="p-4 bg-slate-50 border-b border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-funnel" class="w-4 h-4 text-primary" />
            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-500">Advanced Filters</h3>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" variant="soft" color="neutral" label="Clear" @click="Object.assign(filters, { status: '', project: '', site: '', category: '', bank: '', doj_start: '', doj_end: '' })" />
            <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="showFilterPanel = false" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Status</label>
            <USelect 
              :model-value="filters.status || 'All Status'" 
              @update:model-value="(val: any) => handleFilterUpdate('status', val)"
              size="sm" :items="statusOptions" variant="outline" class="bg-white" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Project</label>
            <USelect 
              :model-value="filters.project || 'All Projects'" 
              @update:model-value="(val: any) => handleFilterUpdate('project', val)"
              size="sm" :items="projectOptions" variant="outline" class="bg-white" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Site</label>
            <USelect 
              :model-value="filters.site || 'All Sites'" 
              @update:model-value="(val: any) => handleFilterUpdate('site', val)"
              size="sm" :items="siteOptions" variant="outline" class="bg-white" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Category</label>
            <USelect 
              :model-value="filters.category || 'All Categories'" 
              @update:model-value="(val: any) => handleFilterUpdate('category', val)"
              size="sm" :items="categoryOptions" variant="outline" class="bg-white" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Bank</label>
            <USelect 
              :model-value="filters.bank || 'All Banks'" 
              @update:model-value="(val: any) => handleFilterUpdate('bank', val)"
              size="sm" :items="bankOptions" variant="outline" class="bg-white" />
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 px-1">Joining Date Range</label>
            <div class="flex items-center gap-2">
              <UInput v-model="filters.doj_start" type="date" size="sm" class="flex-1 bg-white" />
              <span class="text-slate-300">-</span>
              <UInput v-model="filters.doj_end" type="date" size="sm" class="flex-1 bg-white" />
            </div>
          </div>
        </div>
      </div>

      <!-- Column Selection Panel -->
      <div v-if="showColumnPanel" class="p-4 bg-slate-50 border-b border-slate-200 animate-in fade-in slide-in-from-top-2 duration-200">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4 text-primary" />
            <h3 class="text-[10px] font-black uppercase tracking-widest text-slate-500">Display Settings: Toggle Columns</h3>
          </div>
          <div class="flex gap-2">
            <UButton size="xs" variant="soft" color="neutral" label="Reset Defaults" @click="visibleColumns = ['select', 'employee_name', 'aadhar', 'phone_no', 'category', 'project', 'status', 'actions']" />
            <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="showColumnPanel = false" />
          </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          <div v-for="col in allColumns" :key="col.key" class="flex items-center gap-2">
            <UCheckbox 
              :model-value="visibleColumns.includes(col.key)" 
              @update:model-value="(val: any) => toggleColumn(col.key, !!val)"
              :label="col.label" 
              size="sm" 
              :disabled="col.key === 'employee_name' || col.key === 'actions' || col.key === 'select'"
              :ui="{ label: 'text-[11px] font-bold uppercase tracking-tighter text-slate-600 cursor-pointer' }" />
          </div>
        </div>
      </div>

      <!-- Table Container (Desktop) / Card View (Mobile) -->
      <div class="flex-1 overflow-auto custom-scrollbar relative">
        <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-[2px] transition-all duration-300">
          <div class="flex flex-col items-center gap-4 bg-white p-8 rounded-3xl shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
            <div class="relative">
              <UIcon name="i-heroicons-arrow-path" class="w-12 h-12 animate-spin text-primary" />
              <div class="absolute inset-0 flex items-center justify-center">
                <UIcon name="i-heroicons-users" class="w-5 h-5 text-primary/40" />
              </div>
            </div>
            <div class="flex flex-col items-center gap-1">
              <p class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Synchronizing</p>
              <p class="text-[9px] font-bold uppercase tracking-widest text-primary animate-pulse">Master Roll Engine</p>
            </div>
          </div>
        </div>

        <!-- Desktop Table View -->
        <div class="hidden lg:block">
          <UTable 
            :data="paginatedEmployees" 
            :columns="columns" 
            :loading="loading" 
            v-model:sorting="sorting"
            class="w-full text-xs sticky-header-enterprise"
            :ui="{ 
              td: 'py-2.5 px-4 text-slate-800 border-b border-slate-100',
              th: 'py-3 px-4 text-slate-600 font-black uppercase tracking-wider bg-slate-100 border-b border-slate-200',
              tr: 'hover:bg-indigo-50/40 transition-colors'
            }"
          >
            <!-- Header Slots -->
            <template v-for="col in columns.filter(c => c.id !== 'select')" :key="col.id" #[`${col.id}-header`]="{ column }">
              <div v-if="column.getCanSort()" 
                   class="flex items-center gap-1 cursor-pointer select-none hover:text-primary transition-colors"
                   @click="column.getToggleSortingHandler()?.($event)">
                <span>{{ col.header }}</span>
                <UIcon 
                  v-if="column.getIsSorted() === 'asc'" 
                  name="i-heroicons-bars-arrow-up" 
                  class="w-4 h-4 text-primary" 
                />
                <UIcon 
                  v-else-if="column.getIsSorted() === 'desc'" 
                  name="i-heroicons-bars-arrow-down" 
                  class="w-4 h-4 text-primary" 
                />
                <UIcon 
                  v-else 
                  name="i-heroicons-arrows-up-down" 
                  class="w-3.5 h-3.5 text-slate-400" 
                />
              </div>
              <span v-else>{{ col.header }}</span>
            </template>

            <!-- Select Header Slot -->
            <template #select-header>
              <UCheckbox 
                :model-value="isAllSelected" 
                @update:model-value="(val: any) => toggleSelectAll(!!val)" 
                class="flex items-center justify-center"
              />
            </template>

            <!-- Select Cell Slot -->
            <template #select-cell="{ row }">
              <UCheckbox 
                :model-value="selectedRows.some(r => r._id === row.original._id)" 
                @update:model-value="(val: any) => toggleRowSelection(row.original, !!val)" 
                class="flex items-center justify-center"
              />
            </template>

            <!-- Employee Name Cell -->
            <template #employee_name-cell="{ row }">
              <div class="flex items-center gap-3 py-1">
                <UAvatar :alt="row.original.employee_name" size="sm" class="ring-2 ring-slate-200" />
                <div class="min-w-0">
                  <p class="font-black text-slate-900 truncate leading-tight">{{ row.original.employee_name }}</p>
                  <p class="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tighter">{{ row.original.father_husband_name }}</p>
                </div>
              </div>
            </template>

            <template #category-cell="{ row }">
              <span class="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                {{ row.original.category }}
              </span>
            </template>

            <template #status-cell="{ row }">
              <UBadge 
                :color="row.original.status === 'Active' ? 'success' : 'error'" 
                size="sm" 
                variant="subtle" 
                class="px-2 py-0.5 font-black uppercase tracking-widest text-[9px] rounded-md"
              >
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center gap-1 justify-end">
                <UTooltip text="Quick Edit">
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="openModal(row.original)" />
                </UTooltip>
                <UDropdownMenu 
                  :items="[[
                    { label: 'View Activity Log', icon: 'i-heroicons-clock', onSelect: () => openActivity(row.original) },
                    { label: 'Download Letter', icon: 'i-heroicons-document-text', onSelect: () => onDownloadLetter(row.original) },
                    { label: 'Download PDF I-Card', icon: 'i-heroicons-identification', onSelect: () => onDownloadICard(row.original, 'pdf') },
                    { label: 'Download Excel I-Card', icon: 'i-heroicons-table-cells', onSelect: () => onDownloadICard(row.original, 'xlsx') },
                    { label: 'Wages Summary', icon: 'i-heroicons-document-chart-bar', onSelect: () => openWagesSummary(row.original) }
                  ]]"
                >
                  <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-ellipsis-vertical" />
                </UDropdownMenu>
              </div>
            </template>
          </UTable>
        </div>

        <!-- Mobile/Tablet Card View -->
        <div class="lg:hidden flex flex-col divide-y divide-slate-100">
          <div v-if="filteredEmployees.length === 0 && !loading" class="flex flex-col items-center justify-center py-24 gap-4 opacity-40">
            <UIcon name="i-heroicons-circle-stack" class="w-16 h-16 text-slate-400" />
            <p class="text-sm font-bold uppercase tracking-widest text-slate-500">No Employee Records Found</p>
          </div>
          <div v-for="emp in paginatedEmployees" :key="emp._id" class="p-4 hover:bg-indigo-50/50 transition-colors">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-3">
                <UCheckbox 
                  :model-value="selectedRows.some(r => r._id === emp._id)" 
                  @update:model-value="(val: any) => toggleRowSelection(emp, !!val)" 
                />
                <UAvatar :alt="emp.employee_name" size="md" />
                <div>
                  <h4 class="font-black text-slate-900 leading-tight">{{ emp.employee_name }}</h4>
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{{ emp.category }} • {{ emp.project || 'No Project' }}</p>
                </div>
              </div>
              <UBadge 
                :color="emp.status === 'Active' ? 'success' : 'error'" 
                size="sm" 
                variant="subtle" 
                class="px-2 py-0.5 font-black uppercase tracking-widest text-[8px] rounded-md"
              >
                {{ emp.status }}
              </UBadge>
            </div>
            
            <div class="mt-3 grid grid-cols-2 gap-y-2 gap-x-4">
              <div>
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest">Aadhar</p>
                <p class="text-xs font-bold text-slate-700">{{ emp.aadhar || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest">Phone</p>
                <p class="text-xs font-bold text-slate-700">{{ emp.phone_no || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest">Joining Date</p>
                <p class="text-xs font-bold text-slate-700">{{ emp.date_of_joining || 'N/A' }}</p>
              </div>
              <div>
                <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest">Site</p>
                <p class="text-xs font-bold text-slate-700 truncate">{{ emp.site || 'N/A' }}</p>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-end gap-2">
              <UButton size="xs" variant="soft" color="neutral" icon="i-heroicons-pencil-square" label="Edit" @click="openModal(emp)" />
              <UDropdownMenu 
                :items="[[
                  { label: 'View Activity Log', icon: 'i-heroicons-clock', onSelect: () => openActivity(emp) },
                  { label: 'Download Letter', icon: 'i-heroicons-document-text', onSelect: () => onDownloadLetter(emp) },
                  { label: 'Download PDF I-Card', icon: 'i-heroicons-identification', onSelect: () => onDownloadICard(emp, 'pdf') },
                  { label: 'Download Excel I-Card', icon: 'i-heroicons-table-cells', onSelect: () => onDownloadICard(emp, 'xlsx') },
                  { label: 'Wages Summary', icon: 'i-heroicons-document-chart-bar', onSelect: () => openWagesSummary(emp) }
                ]]"
              >
                <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-ellipsis-horizontal" />
              </UDropdownMenu>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Entries Container / Pagination -->
      <div class="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 bg-white">
        <div class="flex flex-wrap items-center gap-4">
          <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
            Showing {{ displayStart }} - {{ displayEnd }} of {{ filteredEmployees.length }} Employees
          </p>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Per Page:</span>
            <USelect 
              v-model="itemsPerPageString" 
              :items="itemsPerPageOptions" 
              size="xs" 
              class="w-16" 
            />
          </div>
        </div>
        
        <UPagination 
          v-if="filteredEmployees.length > 0"
          v-model:page="currentPage" 
          :total="filteredEmployees.length" 
          :items-per-page="itemsPerPage" 
          :show-edges="true" 
          size="sm"
        />
      </div>
    </UCard>

    <!-- Enterprise Modals -->
    <UModal v-model:open="isOpen" :title="selectedEmployee ? 'Employee File: ' + selectedEmployee.employee_name : 'New Employee Onboarding'" 
            :ui="{ content: 'w-full sm:max-w-7xl h-full sm:h-auto' }">
      <template #body>
        <div class="max-h-full sm:max-h-[85vh] overflow-y-auto custom-scrollbar px-2 py-4">
          <MasterRollForm :employee="selectedEmployee" @success="fetchData" @close="isOpen = false" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isImportOpen" title="Enterprise Bulk Import Engine" :ui="{ content: 'w-full sm:max-w-2xl' }">
      <template #body>
        <div class="p-2">
          <MasterRollImport @success="fetchData" @close="isImportOpen = false" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="isActivityOpen" :title="'System Audit Log: ' + selectedEmployee?.employee_name" :ui="{ content: 'w-full sm:max-w-md' }">
      <template #body>
        <ActivityLog v-if="selectedEmployee" :employee-id="selectedEmployee._id" />
      </template>
    </UModal>

    <UModal v-model:open="isICardModalOpen" :ui="{ content: 'w-full sm:max-w-md' }">
      <template #body>
        <ICardFilterModal @close="isICardModalOpen = false" />
      </template>
    </UModal>

    <UModal v-model:open="isQualityModalOpen" fullscreen>
      <template #body>
        <DataQualityAuditModal 
          :employees="employees" 
          @close="isQualityModalOpen = false" 
          @edit="(emp) => {
            isQualityModalOpen = false;
            openModal(emp);
          }"
        />
      </template>
    </UModal>

    <BulkEditModal :is-open="isBulkEditOpen" @close="isBulkEditOpen = false" @saved="fetchData" />

    <UModal v-model:open="isWagesSummaryOpen" :title="'Wages Statement: ' + selectedEmployeeForWages?.employee_name" :ui="{ content: 'w-full sm:max-w-4xl' }">
      <template #body>
        <WagesSummaryModal v-if="selectedEmployeeForWages" :employee="selectedEmployeeForWages" @close="isWagesSummaryOpen = false" />
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.sticky-header-enterprise :deep(thead) {
  position: sticky;
  top: 0;
  z-index: 20;
}
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #374151;
}
</style>
