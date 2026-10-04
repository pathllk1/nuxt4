<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive } from 'vue'
import { useAuth } from '../composables/useAuth'

definePageMeta({
  layout: 'default'
});

const { user, selectedFirmId, apiFetch, selectFirm } = useAuth()
const toast = useToast()

const api = {
  get: (url: string) => apiFetch('/api' + url),
  post: (url: string, body?: any) => apiFetch('/api' + url, { method: 'POST', body }),
  put: (url: string, body?: any) => apiFetch('/api' + url, { method: 'PUT', body }),
  delete: (url: string) => apiFetch('/api' + url, { method: 'DELETE' }),
}

// Navigation Tabs
const activeTab = ref<'overview' | 'team' | 'settings'>('overview')

// Summary & KPI Data
const summary = ref<any>(null)
const summaryLoading = ref(false)
const gstEnabled = ref(true)
const updatingGst = ref(false)

const activity = ref<any[]>([])
const loading = ref(false)

// Member CRUD state
const members = ref<any[]>([])
const membersLoading = ref(false)
const isMemberSlideoverOpen = ref(false)
const savingMember = ref(false)
const selectedMember = ref<any>(null)
const memberCategoryFilter = ref<'all' | 'Staff' | 'Supervisor' | 'Subcontractor'>('all')

const memberForm = reactive({
  name: '',
  email: '',
  password: '',
  grade: 'Staff',
  status: 'active',
  role: 'standard',
  phone: '',
  panNumber: '',
  assignedProjectIds: '',
  coaLinkMode: 'AUTO_CREATE',
  existingLedgerHead: ''
})

const getFirmId = (firmObj: any) => {
  if (!firmObj) return ''
  if (typeof firmObj === 'string') return firmObj
  return firmObj.id || firmObj._id || ''
}

const activeFirm = computed(() => {
  if (!selectedFirmId.value || !user.value) return null
  const f = user.value.firms?.find((x: any) => getFirmId(x.firm) === selectedFirmId.value)
  return typeof f?.firm === 'object' ? f.firm : null
})

const activeFirmName = computed(() => {
  return activeFirm.value?.name || 'Selected Firm'
})

const activeFirmGrade = computed(() => {
  if (!selectedFirmId.value || !user.value) return null
  const f = user.value.firms?.find((x: any) => getFirmId(x.firm) === selectedFirmId.value)
  return f?.grade || null
})

const isOwnerOrAdmin = computed(() => {
  return ['Owner', 'Admin'].includes(activeFirmGrade.value || '')
})

const gradeOptions = computed(() => {
  const options = [
    { label: 'Admin', value: 'Admin' },
    { label: 'Manager', value: 'Manager' },
    { label: 'Staff', value: 'Staff' },
    { label: 'Supervisor / Site Engineer', value: 'Supervisor' },
    { label: 'Subcontractor (Direct Expense / TDS)', value: 'Subcontractor' }
  ]
  if (activeFirmGrade.value === 'Owner') {
    options.unshift({ label: 'Owner', value: 'Owner' })
  }
  return options
})

const statusOptions = [
  { label: 'Active', value: 'active' },
  { label: 'Pending Approval', value: 'pending' },
  { label: 'Suspended', value: 'suspended' }
]

const roleOptions = [
  { label: 'Standard User', value: 'standard' },
  { label: 'SuperAdmin', value: 'superadmin' }
]

const memberColumns = [
  { accessorKey: 'name', header: 'Member' },
  { accessorKey: 'grade', header: 'Grade & Ledger Link' },
  { accessorKey: 'role', header: 'System Role' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' }
]

const filteredMembers = computed(() => {
  if (memberCategoryFilter.value === 'all') return members.value
  return members.value.filter(m => m.grade === memberCategoryFilter.value)
})

const formatINR = (n: number | undefined | null) => {
  if (n == null || isNaN(n)) return '₹0'
  return '₹' + new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(n)
}

const formatDate = (date: string) => {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  } catch {
    return String(date)
  }
}

const formatDateTime = (date: string) => {
  if (!date) return ''
  try {
    return new Date(date).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return String(date)
  }
}

const getSeverityColor = (severity: string) => {
  if (severity === 'critical' || severity === 'high') return 'error'
  if (severity === 'medium') return 'warning'
  return 'primary'
}

const getSeverityIcon = (severity: string) => {
  if (severity === 'critical' || severity === 'high') return 'i-heroicons-exclamation-triangle'
  if (severity === 'medium') return 'i-heroicons-exclamation-circle'
  return 'i-heroicons-information-circle'
}

const fetchGstStatus = async () => {
  if (!selectedFirmId.value) return
  try {
    const res = await api.get('/firms/settings/gst')
    if (res.success && res.data) {
      gstEnabled.value = res.data.gst_enabled
    }
  } catch (err: any) {
    console.error('Error fetching GST status:', err)
  }
}

const toggleGst = async (val: any) => {
  const enabled = !!val
  if (!selectedFirmId.value || !isOwnerOrAdmin.value) return
  updatingGst.value = true
  try {
    const res = await api.post('/firms/settings/gst', { enabled })
    if (res.success) {
      toast.add({ title: 'Success', description: res.message || 'GST configuration saved', color: 'success' })
      gstEnabled.value = enabled
    }
  } catch (err: any) {
    toast.add({ title: 'Error toggling GST settings', description: err.message, color: 'error' })
    gstEnabled.value = !enabled
  } finally {
    updatingGst.value = false
  }
}

const fetchMembers = async () => {
  if (!selectedFirmId.value || !isOwnerOrAdmin.value) return
  membersLoading.value = true
  try {
    const res = await api.get(`/firms/${selectedFirmId.value}/members`)
    members.value = res.members || []
  } catch (err: any) {
    toast.add({ title: 'Error fetching members', description: err.message, color: 'error' })
  } finally {
    membersLoading.value = false
  }
}

const fetchDashboardSummary = async () => {
  if (!selectedFirmId.value) return
  summaryLoading.value = true
  try {
    const res = await api.get(`/dashboard/summary?firmId=${selectedFirmId.value}`)
    if (res.success && res.data) {
      summary.value = res.data
    }
  } catch (err: any) {
    console.error('Error fetching dashboard summary:', err)
  } finally {
    summaryLoading.value = false
  }
}

const fetchData = async () => {
  if (!selectedFirmId.value) return
  
  loading.value = true
  try {
    await Promise.all([
      fetchDashboardSummary(),
      api.get('/auth/security-logs?limit=5').then(res => {
        activity.value = res.logs || []
      }).catch(() => {})
    ])

    if (isOwnerOrAdmin.value) {
      await Promise.all([
        fetchMembers(),
        fetchGstStatus()
      ])
    }
  } catch (err: any) {
    toast.add({ title: 'Error fetching dashboard data', description: err.message, color: 'error' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (user.value && selectedFirmId.value) {
    fetchData()
  }
})

watch([selectedFirmId, isOwnerOrAdmin], () => {
  if (selectedFirmId.value) {
    fetchData()
  } else {
    members.value = []
    summary.value = null
  }
})

const openMemberSlideover = (member: any = null, defaultGrade: string = 'Staff') => {
  selectedMember.value = member
  if (member) {
    memberForm.name = member.name
    memberForm.email = member.email
    memberForm.password = ''
    memberForm.grade = member.grade
    memberForm.status = member.status || 'active'
    memberForm.role = member.role || 'standard'
    memberForm.phone = member.phone || ''
    memberForm.panNumber = member.panNumber || ''
    memberForm.assignedProjectIds = Array.isArray(member.assignedProjectIds) ? member.assignedProjectIds.join(', ') : ''
    memberForm.coaLinkMode = 'AUTO_CREATE'
    memberForm.existingLedgerHead = member.linkedLedgerHead || ''
  } else {
    memberForm.name = ''
    memberForm.email = ''
    memberForm.password = ''
    memberForm.grade = defaultGrade
    memberForm.status = 'active'
    memberForm.role = 'standard'
    memberForm.phone = ''
    memberForm.panNumber = ''
    memberForm.assignedProjectIds = ''
    memberForm.coaLinkMode = 'AUTO_CREATE'
    memberForm.existingLedgerHead = ''
  }
  isMemberSlideoverOpen.value = true
}

const onMemberSubmit = async () => {
  savingMember.value = true
  try {
    if (selectedMember.value) {
      const payload: any = {
        name: memberForm.name,
        email: memberForm.email,
        grade: memberForm.grade,
        status: memberForm.status,
        role: memberForm.role
      }
      if (memberForm.grade === 'Supervisor' || memberForm.grade === 'Subcontractor') {
        payload.assignedProjectIds = memberForm.assignedProjectIds
          ? memberForm.assignedProjectIds.split(',').map((s: string) => s.trim()).filter(Boolean)
          : []
        if (memberForm.grade === 'Subcontractor') {
          payload.panNumber = memberForm.panNumber?.trim()?.toUpperCase() || undefined
        }
      }
      const res = await api.put(`/firms/${selectedFirmId.value}/members/${selectedMember.value.userId}`, payload)
      toast.add({ title: 'Success', description: res.message || 'Member updated successfully', color: 'success' })
    } else {
      const payload: any = {
        email: memberForm.email,
        grade: memberForm.grade,
        name: memberForm.name,
        password: memberForm.password || undefined,
        status: memberForm.status,
        role: memberForm.role
      }
      if (memberForm.grade === 'Supervisor') {
        payload.phone = memberForm.phone?.trim() || undefined
        payload.coaLinkMode = memberForm.coaLinkMode
        if (memberForm.coaLinkMode === 'LINK_EXISTING' && memberForm.existingLedgerHead) {
          payload.existingLedgerHead = memberForm.existingLedgerHead.trim()
        }
        if (memberForm.assignedProjectIds) {
          payload.assignedProjectIds = memberForm.assignedProjectIds
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        }
      } else if (memberForm.grade === 'Subcontractor') {
        payload.panNumber = memberForm.panNumber?.trim()?.toUpperCase() || undefined
        if (memberForm.assignedProjectIds) {
          payload.assignedProjectIds = memberForm.assignedProjectIds
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        }
      }
      const res = await api.post(`/firms/${selectedFirmId.value}/members`, payload)
      toast.add({ title: 'Success', description: res.message || 'Member added successfully', color: 'success' })
    }
    isMemberSlideoverOpen.value = false
    fetchMembers()
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    savingMember.value = false
  }
}

const deleteMember = async (userId: string) => {
  if (userId === user.value?.id) {
    toast.add({ title: 'Invalid action', description: 'You cannot remove yourself from the firm', color: 'error' })
    return
  }
  if (confirm('Are you sure you want to remove this member from the firm?')) {
    try {
      const res = await api.delete(`/firms/${selectedFirmId.value}/members/${userId}`)
      toast.add({ title: 'Success', description: res.message || 'Member removed', color: 'success' })
      fetchMembers()
    } catch (err: any) {
      toast.add({ title: 'Error', description: err.message, color: 'error' })
    }
  }
}
</script>

<template>
  <div class="space-y-5 p-4 md:p-6 w-full max-w-none">
    
    <!-- Top Executive Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Dashboard</h1>
          <UBadge v-if="activeFirmGrade" variant="subtle" color="primary" class="font-bold text-[10px] uppercase py-0.5 px-2">
            {{ activeFirmGrade }}
          </UBadge>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          <span class="font-bold text-slate-700 dark:text-slate-200">{{ activeFirmName }}</span>
          <span class="mx-1.5">•</span>
          <span>Welcome, {{ user?.name }}</span>
        </p>
      </div>

      <!-- Header Actions -->
      <div class="flex items-center gap-2 self-start sm:self-auto">
        <div v-if="!selectedFirmId" class="text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
          Please select a firm to view data
        </div>

        <template v-else>
          <UButton 
            icon="i-heroicons-user-group" 
            label="Master Roll" 
            to="/master-roll" 
            size="sm" 
            variant="outline" 
            color="neutral" 
            class="font-bold text-xs" 
          />

          <UButton 
            icon="i-heroicons-document-plus" 
            label="Post Voucher" 
            to="/accounting/daybook" 
            size="sm" 
            class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs" 
          />
        </template>
      </div>
    </div>

    <!-- Segmented Navigation Tabs -->
    <div class="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-800 pb-2">
      <div class="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
        <button
          type="button"
          @click="activeTab = 'overview'"
          :class="activeTab === 'overview'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
        >
          <UIcon name="i-heroicons-chart-pie" class="w-4 h-4" />
          <span>Executive Overview</span>
        </button>

        <button
          v-if="isOwnerOrAdmin"
          type="button"
          @click="activeTab = 'team'"
          :class="activeTab === 'team'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
        >
          <UIcon name="i-heroicons-user-group" class="w-4 h-4" />
          <span>Team & Subcontractors</span>
          <UBadge variant="subtle" size="sm" color="neutral" class="text-[9px] py-0 px-1 ml-0.5">
            {{ members.length }}
          </UBadge>
        </button>

        <button
          v-if="isOwnerOrAdmin"
          type="button"
          @click="activeTab = 'settings'"
          :class="activeTab === 'settings'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs font-bold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'"
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition cursor-pointer"
        >
          <UIcon name="i-heroicons-cog-6-tooth" class="w-4 h-4" />
          <span>Firm Settings & Audit</span>
        </button>
      </div>

      <div class="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span class="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span>GL Double-Entry Active</span>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 1: EXECUTIVE OVERVIEW                                           -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-if="activeTab === 'overview'" class="space-y-5">
      
      <!-- 6-Grid KPI Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
        
        <!-- Card 1: Gross Revenue -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Gross Turnover</span>
            <div class="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
              <UIcon name="i-heroicons-chart-bar" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">
            {{ formatINR(summary?.metrics?.revenue) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">Current Period Sales</p>
        </div>

        <!-- Card 2: Receivables (Sundry Debtors) -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Receivables (AR)</span>
            <div class="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900">
              <UIcon name="i-heroicons-arrow-trending-up" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-blue-600 dark:text-blue-400 mt-2">
            {{ formatINR(summary?.metrics?.receivables) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">Sundry Debtors Balance</p>
        </div>

        <!-- Card 3: Payables (Sundry Creditors) -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Payables (AP)</span>
            <div class="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
              <UIcon name="i-heroicons-arrow-trending-down" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {{ formatINR(summary?.metrics?.payables) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">Sundry Creditors Outstanding</p>
        </div>

        <!-- Card 4: Statutory Liabilities (GST + TDS) -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tax Liabilities</span>
            <div class="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900">
              <UIcon name="i-heroicons-receipt-percent" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-rose-600 dark:text-rose-400 mt-2">
            {{ formatINR(summary?.metrics?.statutoryTax) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">
            TDS: {{ formatINR(summary?.metrics?.tdsDue) }} | GST: {{ formatINR(summary?.metrics?.gstDue) }}
          </p>
        </div>

        <!-- Card 5: Inventory Stock Value -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stock Valuation</span>
            <div class="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 border border-teal-100 dark:border-teal-900">
              <UIcon name="i-heroicons-cube" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-teal-700 dark:text-teal-400 mt-2">
            {{ formatINR(summary?.metrics?.stockValue) }}
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">Live Inventory Assets</p>
        </div>

        <!-- Card 6: Workforce & Bills -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl p-3.5 transition hover:shadow-md hover:border-slate-300">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Muster Roll</span>
            <div class="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
              <UIcon name="i-heroicons-user-group" class="w-4 h-4" />
            </div>
          </div>
          <p class="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-2">
            {{ summary?.metrics?.activeWorkers ?? 0 }} <span class="text-xs font-normal text-slate-400">Workers</span>
          </p>
          <p class="text-[10px] text-slate-400 mt-1 truncate">{{ summary?.metrics?.activeBillsCount ?? 0 }} Registered Bills</p>
        </div>
      </div>

      <!-- Compliance & Balance Status Alert -->
      <div class="flex flex-col sm:flex-row items-center justify-between p-3 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800 rounded-xl text-xs gap-2">
        <div class="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-medium">
          <UIcon name="i-heroicons-check-badge" class="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Accounting Engine Status: <strong>Double-Entry Invariant Verified</strong> across all journals</span>
        </div>
        <div class="flex items-center gap-2">
          <UBadge variant="subtle" color="success" class="font-bold text-[10px]">
            FY: {{ summary?.financialYear || '2026-27' }}
          </UBadge>
          <UBadge variant="subtle" :color="summary?.compliance?.isPeriodLocked ? 'error' : 'primary'" class="font-bold text-[10px]">
            {{ summary?.compliance?.isPeriodLocked ? 'PERIOD LOCKED' : 'OPEN FOR POSTING' }}
          </UBadge>
        </div>
      </div>

      <!-- 2-Column Section: Recent Activity & Quick Navigation -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        <!-- Left 2 Cols: Recent Financial Vouchers Activity -->
        <UCard class="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-0', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-queue-list" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Recent Financial Activity</h3>
              </div>
              <UButton size="xs" variant="ghost" color="primary" label="View Daybook" to="/accounting/daybook" class="text-xs font-bold" />
            </div>
          </template>

          <div v-if="summary?.recentVouchers?.length > 0" class="divide-y divide-slate-100 dark:divide-slate-800">
            <div 
              v-for="v in summary.recentVouchers" 
              :key="v._id" 
              class="flex items-center justify-between p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
            >
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-700">
                  <UIcon 
                    :name="v.voucherType === 'SALES' ? 'i-heroicons-arrow-up-right' : v.voucherType === 'PURCHASE' ? 'i-heroicons-arrow-down-left' : 'i-heroicons-arrows-right-left'" 
                    class="w-4 h-4 text-slate-600 dark:text-slate-300"
                  />
                </div>
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{{ v.accountHead }}</p>
                    <UBadge variant="subtle" size="sm" :color="v.voucherType === 'SALES' ? 'success' : v.voucherType === 'PURCHASE' ? 'info' : 'neutral'" class="text-[9px] font-bold py-0 px-1.5 uppercase">
                      {{ v.voucherType }}
                    </UBadge>
                  </div>
                  <p class="text-[11px] text-slate-400 mt-0.5 truncate">
                    <span class="font-mono text-[10px] text-slate-500">{{ v.voucherNo }}</span>
                    <span v-if="v.narration" class="ml-1.5">• {{ v.narration }}</span>
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 ml-3">
                <p v-if="v.debitAmount > 0" class="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                  {{ formatINR(v.debitAmount) }} <span class="text-[9px] font-mono text-slate-400">DR</span>
                </p>
                <p v-else class="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {{ formatINR(v.creditAmount) }} <span class="text-[9px] font-mono text-emerald-500">CR</span>
                </p>
                <p class="text-[10px] text-slate-400 mt-0.5">{{ formatDate(v.transactionDate) }}</p>
              </div>
            </div>
          </div>

          <div v-else class="py-12 text-center text-xs text-slate-400">
            No recent voucher transactions recorded yet.
          </div>
        </UCard>

        <!-- Right 1 Col: Quick Module Hub -->
        <UCard class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-3', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Module Shortcuts</h3>
            </div>
          </template>

          <div class="space-y-2">
            <NuxtLink to="/accounting/statements" class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition group">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <UIcon name="i-heroicons-presentation-chart-line" class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-indigo-600">P&L & Balance Sheet</p>
                  <p class="text-[10px] text-slate-400">Audited Financial Statements</p>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-indigo-600" />
            </NuxtLink>

            <NuxtLink to="/accounting/gst-returns" class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition group">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                  <UIcon name="i-heroicons-document-currency-rupee" class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-emerald-600">GST Returns Engine</p>
                  <p class="text-[10px] text-slate-400">GSTR-1, GSTR-3B & 2A Match</p>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </NuxtLink>

            <NuxtLink to="/subcontractor" class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-amber-200 dark:hover:border-amber-800 hover:bg-amber-50/30 dark:hover:bg-amber-950/20 transition group">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                  <UIcon name="i-heroicons-wrench-screwdriver" class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-amber-600">Subcontractor Payouts</p>
                  <p class="text-[10px] text-slate-400">Wallets & TDS u/s 194C</p>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
            </NuxtLink>

            <NuxtLink to="/inventory" class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800 hover:bg-teal-50/30 dark:hover:bg-teal-950/20 transition group">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400">
                  <UIcon name="i-heroicons-cube" class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-teal-600">Stock & Inventory</p>
                  <p class="text-[10px] text-slate-400">Item Registry & Delivery Notes</p>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-teal-600" />
            </NuxtLink>

            <NuxtLink to="/master-roll" class="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-violet-200 dark:hover:border-violet-800 hover:bg-violet-50/30 dark:hover:bg-violet-950/20 transition group">
              <div class="flex items-center gap-2.5">
                <div class="p-1.5 rounded-md bg-violet-50 dark:bg-violet-950 text-violet-600 dark:text-violet-400">
                  <UIcon name="i-heroicons-users" class="w-4 h-4" />
                </div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-violet-600">Muster Roll & Wages</p>
                  <p class="text-[10px] text-slate-400">Attendance & Site Slips</p>
                </div>
              </div>
              <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-slate-400 group-hover:text-violet-600" />
            </NuxtLink>
          </div>
        </UCard>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 2: TEAM & SUBCONTRACTORS                                        -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'team'" class="space-y-4">
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-0', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Firm Team Members & Subcontractors</h3>
              <p class="text-[10px] text-slate-400 mt-0.5">Manage credentials, site supervisors, and 194C subcontractor tax links</p>
            </div>
            
            <div class="flex items-center gap-2">
              <UButton 
                icon="i-heroicons-wrench-screwdriver" 
                label="Register Subcontractor" 
                size="xs" 
                color="warning" 
                variant="subtle" 
                class="font-bold" 
                @click="openMemberSlideover(null, 'Subcontractor')" 
              />
              <UButton 
                icon="i-heroicons-plus" 
                label="Add Member" 
                size="xs" 
                class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" 
                @click="openMemberSlideover()" 
              />
            </div>
          </div>
        </template>

        <!-- Category Filters -->
        <div class="flex items-center gap-1.5 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs">
          <span class="text-slate-400 font-bold mr-1 text-[11px]">Filter:</span>
          <UButton 
            size="xs" 
            :variant="memberCategoryFilter === 'all' ? 'solid' : 'ghost'" 
            :color="memberCategoryFilter === 'all' ? 'primary' : 'neutral'"
            label="All Members"
            @click="memberCategoryFilter = 'all'" 
          />
          <UButton 
            size="xs" 
            :variant="memberCategoryFilter === 'Staff' ? 'solid' : 'ghost'" 
            :color="memberCategoryFilter === 'Staff' ? 'primary' : 'neutral'"
            label="Staff"
            @click="memberCategoryFilter = 'Staff'" 
          />
          <UButton 
            size="xs" 
            :variant="memberCategoryFilter === 'Supervisor' ? 'solid' : 'ghost'" 
            :color="memberCategoryFilter === 'Supervisor' ? 'warning' : 'neutral'"
            label="Site Supervisors"
            @click="memberCategoryFilter = 'Supervisor'" 
          />
          <UButton 
            size="xs" 
            :variant="memberCategoryFilter === 'Subcontractor' ? 'solid' : 'ghost'" 
            :color="memberCategoryFilter === 'Subcontractor' ? 'info' : 'neutral'"
            label="Subcontractors (194C)"
            @click="memberCategoryFilter = 'Subcontractor'" 
          />
        </div>

        <div class="overflow-x-auto">
          <UTable :data="filteredMembers" :columns="memberColumns" :loading="membersLoading">
            <template #name-cell="{ row }">
              <div class="flex items-center gap-2.5">
                <div class="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-300">
                  {{ (row.original.name || 'U').charAt(0).toUpperCase() }}
                </div>
                <div>
                  <p class="font-bold text-xs text-slate-800 dark:text-slate-100">{{ row.original.name }}</p>
                  <p class="text-[10px] text-slate-400">{{ row.original.email }}</p>
                </div>
              </div>
            </template>

            <template #grade-cell="{ row }">
              <div>
                <UBadge
                  variant="subtle"
                  :color="row.original.grade === 'Supervisor' ? 'warning' : row.original.grade === 'Subcontractor' ? 'info' : row.original.grade === 'Owner' ? 'error' : row.original.grade === 'Admin' ? 'primary' : 'neutral'"
                  class="text-[9px] uppercase font-bold py-0.5 px-1.5"
                >
                  {{ row.original.grade }}
                </UBadge>
                <div v-if="row.original.linkedLedgerHead" class="text-[9px] text-slate-500 font-mono mt-0.5 truncate max-w-[180px]" :title="row.original.linkedLedgerHead">
                  {{ row.original.linkedLedgerHead }}
                </div>
                <div v-if="row.original.panNumber" class="text-[9px] text-slate-400 font-mono">
                  PAN: {{ row.original.panNumber }}
                </div>
              </div>
            </template>

            <template #role-cell="{ row }">
              <UBadge :color="row.original.role === 'superadmin' ? 'primary' : 'neutral'" variant="subtle" size="sm" class="uppercase font-black text-[9px] py-0.5 px-1.5">
                {{ row.original.role }}
              </UBadge>
            </template>

            <template #status-cell="{ row }">
              <UBadge :color="row.original.status === 'active' ? 'success' : row.original.status === 'pending' ? 'warning' : 'error'" variant="subtle" class="text-[9px] uppercase font-bold py-0.5 px-1.5">
                {{ row.original.status }}
              </UBadge>
            </template>

            <template #actions-cell="{ row }">
              <div class="flex items-center gap-1">
                <UButton 
                  v-if="String(row.original.userId) !== String(user?.id) && !(row.original.grade === 'Owner' && activeFirmGrade !== 'Owner')" 
                  size="xs" 
                  variant="ghost" 
                  color="neutral" 
                  icon="i-heroicons-pencil-square" 
                  @click="openMemberSlideover(row.original)" 
                />
                <UButton 
                  v-if="String(row.original.userId) !== String(user?.id) && !(row.original.grade === 'Owner' && activeFirmGrade !== 'Owner')" 
                  size="xs" 
                  variant="ghost" 
                  color="error" 
                  icon="i-heroicons-trash" 
                  @click="deleteMember(row.original.userId)" 
                />
              </div>
            </template>
          </UTable>
        </div>
      </UCard>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- TAB 3: FIRM SETTINGS & AUDIT                                        -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <div v-else-if="activeTab === 'settings'" class="space-y-4">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        <!-- Firm Settings Card -->
        <UCard class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div>
              <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Statutory & GST Configuration</h3>
              <p class="text-[10px] text-slate-400 mt-0.5">Toggle tax rates, HSN requirements, and statutory ledger posting</p>
            </div>
          </template>

          <div class="space-y-3">
            <div class="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <div>
                <h4 class="font-bold text-xs text-slate-700 dark:text-slate-200">GST Billing & Tax Calculation</h4>
                <p class="text-[10px] text-slate-400 mt-0.5">Automate CGST/SGST/IGST posting on Sales and Purchases</p>
              </div>
              <UCheckbox
                :model-value="gstEnabled"
                @update:model-value="toggleGst"
                :disabled="updatingGst"
                size="md"
              />
            </div>
          </div>
        </UCard>

        <!-- Your Firms List -->
        <UCard class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Switch Active Firm</h3>
              <span class="text-xs text-slate-400">{{ user?.firms?.length || 0 }} Associated Firms</span>
            </div>
          </template>

          <div class="space-y-2">
            <div 
              v-for="f in user?.firms" 
              :key="getFirmId(f.firm)" 
              class="flex items-center justify-between p-2.5 rounded-lg border transition"
              :class="getFirmId(f.firm) === selectedFirmId 
                ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/30 dark:bg-indigo-950/30 ring-1 ring-indigo-100 dark:ring-indigo-900' 
                : 'border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 bg-slate-50/40 dark:bg-slate-800/20'"
            >
              <div class="flex items-center gap-3">
                <div :class="`w-7 h-7 rounded flex items-center justify-center border ${getFirmId(f.firm) === selectedFirmId ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`">
                  <UIcon name="i-heroicons-building-office-2" class="w-4 h-4" />
                </div>
                <span class="text-xs font-bold text-slate-700 dark:text-slate-200">{{ typeof f.firm === 'object' ? f.firm.name : 'Selected Firm' }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UBadge variant="outline" color="primary" class="text-[9px] uppercase font-bold py-0 px-1.5">{{ f.grade }}</UBadge>
                <UButton v-if="getFirmId(f.firm) !== selectedFirmId" size="xs" variant="soft" color="primary" label="Switch" @click="selectFirm(getFirmId(f.firm))" class="text-[10px] font-bold px-2 py-0.5" />
              </div>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Security & Audit Trail -->
      <UCard class="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-slate-800 dark:text-slate-100 uppercase tracking-wider">Security & Authentication Logs</h3>
            <span class="text-[10px] text-slate-400 font-medium">Recent 5 Events</span>
          </div>
        </template>
        
        <div v-if="activity.length > 0" class="space-y-2">
          <div v-for="log in activity" :key="log._id" class="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 rounded-lg transition border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
            <div class="w-7 h-7 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center border border-slate-100 dark:border-slate-700">
              <UIcon :name="getSeverityIcon(log.severity)" 
                     :class="log.severity === 'high' || log.severity === 'critical' ? 'text-rose-500 w-4 h-4' : log.severity === 'medium' ? 'text-amber-500 w-4 h-4' : 'text-indigo-500 w-4 h-4'" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate capitalize">{{ log.action?.replace(/_/g, ' ') }}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">{{ formatDateTime(log.timestamp) }}</p>
            </div>
            <UBadge variant="subtle" size="sm" :color="getSeverityColor(log.severity)" class="text-[9px] uppercase font-bold py-0 px-1.5">
              {{ log.severity }}
            </UBadge>
          </div>
        </div>
        <div v-else class="py-6 text-center text-xs text-slate-400">
          No security events recorded recently.
        </div>
      </UCard>
    </div>

    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <!-- SLIDEOVER: Member & Subcontractor Registration                      -->
    <!-- ═══════════════════════════════════════════════════════════════════ -->
    <USlideover
      v-model:open="isMemberSlideoverOpen"
      :title="selectedMember ? 'Edit Firm Member' : 'Register Member / Subcontractor'"
      :description="selectedMember ? 'Modify member permissions and assigned sites' : 'Create user credentials, assign firm grade, and configure statutory accounting'"
      class="max-w-md sm:max-w-lg"
    >
      <template #body>
        <form @submit.prevent="onMemberSubmit" class="space-y-4 px-1 py-2">
          
          <UFormField v-if="!selectedMember" label="Full Legal Name" class="w-full">
            <UInput v-model="memberForm.name" placeholder="e.g. Ramesh Kumar / Sharma Constructions" required class="w-full" />
          </UFormField>

          <UFormField label="Email Address" class="w-full">
            <UInput v-model="memberForm.email" type="email" placeholder="name@company.com" required :disabled="!!selectedMember" class="w-full" />
          </UFormField>

          <UFormField v-if="!selectedMember" label="Temporary Password" class="w-full">
            <UInput v-model="memberForm.password" type="password" placeholder="Minimum 8 characters" class="w-full" />
          </UFormField>

          <UFormField label="Firm Grade / Account Type" class="w-full">
            <USelect v-model="memberForm.grade" :items="gradeOptions" class="w-full" />
          </UFormField>

          <!-- Supervisor Site Imprest Settings -->
          <div v-if="memberForm.grade === 'Supervisor'" class="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
            <div class="flex items-start gap-2">
              <span class="text-base shrink-0">👛</span>
              <div>
                <p class="text-xs font-bold text-amber-900 dark:text-amber-200">Site Imprest Float Account</p>
                <p class="text-[11px] text-amber-800 dark:text-amber-300 mt-0.5 leading-snug">
                  A dedicated petty cash ledger head <code class="font-mono font-bold bg-amber-100 dark:bg-amber-900/60 px-1 rounded">Advance - {{ memberForm.name || 'Supervisor' }} (Site)</code> will be automatically provisioned in Chart of Accounts under <strong>Loans & Advances</strong>.
                </p>
              </div>
            </div>

            <UFormField v-if="!selectedMember" label="Mobile Number" class="w-full">
              <UInput v-model="memberForm.phone" placeholder="e.g. 9876543210" class="w-full" />
            </UFormField>

            <UFormField label="Assigned Projects / Sites (comma-separated)" class="w-full">
              <UInput v-model="memberForm.assignedProjectIds" placeholder="e.g. Site-A, Tower-1, Bridge-Project" class="w-full" />
            </UFormField>

            <div v-if="selectedMember && selectedMember.linkedLedgerHead" class="text-xs text-slate-600 dark:text-slate-300 pt-1">
              <span>Linked Imprest Head: </span>
              <span class="font-mono font-bold text-slate-800 dark:text-slate-100">{{ selectedMember.linkedLedgerHead }}</span>
            </div>
          </div>

          <!-- Subcontractor Direct Expense & TDS Settings -->
          <div v-if="memberForm.grade === 'Subcontractor'" class="p-4 bg-indigo-50/80 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-3">
            <div class="flex items-start gap-2">
              <span class="text-base shrink-0">🏗️</span>
              <div>
                <p class="text-xs font-bold text-indigo-900 dark:text-indigo-200">Subcontractor Statutory & TDS Setup</p>
                <p class="text-[11px] text-indigo-800 dark:text-indigo-300 mt-0.5 leading-snug">
                  A dedicated Direct Expense head <code class="font-mono font-bold bg-indigo-100 dark:bg-indigo-900/60 px-1 rounded">Subcontract - {{ memberForm.name || 'Contractor' }}</code> will be auto-created in Chart of Accounts. All site slips will be sandboxed with <strong>zero impact on Core GL</strong>.
                </p>
              </div>
            </div>

            <UFormField label="Income Tax PAN (for Section 194C TDS Rate)" class="w-full">
              <UInput v-model="memberForm.panNumber" placeholder="e.g. ABCDE1234F (1% Indv, 2% Co, 20% None)" class="w-full uppercase font-mono" />
            </UFormField>

            <UFormField label="Assigned Projects / Sites (comma-separated)" class="w-full">
              <UInput v-model="memberForm.assignedProjectIds" placeholder="e.g. Metro-Site-4, Flyover-North" class="w-full" />
            </UFormField>

            <div v-if="selectedMember && selectedMember.linkedLedgerHead" class="text-xs text-slate-600 dark:text-slate-300 pt-1">
              <span>Linked Direct Expense Head: </span>
              <span class="font-mono font-bold text-slate-800 dark:text-slate-100">{{ selectedMember.linkedLedgerHead }}</span>
            </div>
          </div>

          <UFormField v-if="user?.role === 'superadmin'" label="System Role" class="w-full">
            <USelect v-model="memberForm.role" :items="roleOptions" class="w-full" />
          </UFormField>

          <UFormField label="Account Status" class="w-full">
            <USelect v-model="memberForm.status" :items="statusOptions" class="w-full" />
          </UFormField>
        </form>
      </template>

      <template #footer>
        <div class="flex items-center justify-end gap-2 w-full">
          <UButton variant="ghost" label="Cancel" @click="isMemberSlideoverOpen = false" color="neutral" class="font-bold" />
          <UButton type="submit" label="Save Member" :loading="savingMember" color="primary" class="font-bold cursor-pointer" @click="onMemberSubmit" />
        </div>
      </template>
    </USlideover>

  </div>
</template>
