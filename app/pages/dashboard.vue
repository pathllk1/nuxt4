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

const gstEnabled = ref(true)
const updatingGst = ref(false)

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

const stats = ref([
  { label: 'Inventory Value', value: '₹0', icon: 'i-heroicons-cube', bgClass: 'bg-teal-50 text-teal-600 border-teal-100', textClass: 'text-teal-700' },
  { label: 'Active Bills', value: '0', icon: 'i-heroicons-document-text', bgClass: 'bg-indigo-50 text-indigo-600 border-indigo-100', textClass: 'text-indigo-700' },
  { label: 'Security Logs', value: '0', icon: 'i-heroicons-shield-check', bgClass: 'bg-amber-50 text-amber-600 border-amber-100', textClass: 'text-amber-700' },
])

const activity = ref<any[]>([])
const loading = ref(false)

// Member CRUD state
const members = ref<any[]>([])
const membersLoading = ref(false)
const isMemberModalOpen = ref(false)
const savingMember = ref(false)
const selectedMember = ref<any>(null)

const memberForm = reactive({
  name: '',
  email: '',
  password: '',
  grade: 'Staff',
  status: 'active',
  role: 'standard'
})

const getFirmId = (firmObj: any) => {
  if (!firmObj) return ''
  if (typeof firmObj === 'string') return firmObj
  return firmObj.id || firmObj._id || ''
}

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
    { label: 'Staff', value: 'Staff' }
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
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'grade', header: 'Grade' },
  { accessorKey: 'role', header: 'System Role' },
  { accessorKey: 'status', header: 'Status' },
  { id: 'actions', header: 'Actions' }
]

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

const fetchData = async () => {
  if (!selectedFirmId.value) return
  
  loading.value = true
  try {
    const [stockRes, billsRes, logsRes] = await Promise.all([
      api.get('/inventory/stock'),
      api.get('/accounting/bills?limit=1'),
      api.get('/auth/security-logs?limit=5')
    ])

    const totalStockValue = stockRes.data?.reduce((sum: number, s: any) => sum + (s.total || 0), 0) || 0;
    stats.value[0]!.value = `₹${totalStockValue.toLocaleString()}`
    stats.value[1]!.value = billsRes.data?.length.toString() || '0'
    stats.value[2]!.value = logsRes.logs?.length.toString() || '0'

    activity.value = logsRes.logs || []

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

onMounted(fetchData)

watch([selectedFirmId, isOwnerOrAdmin], () => {
  if (selectedFirmId.value) {
    fetchData()
  } else {
    members.value = []
  }
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString()
}

const openMemberModal = (member: any = null) => {
  selectedMember.value = member
  if (member) {
    memberForm.name = member.name
    memberForm.email = member.email
    memberForm.password = ''
    memberForm.grade = member.grade
    memberForm.status = member.status || 'active'
    memberForm.role = member.role || 'standard'
  } else {
    memberForm.name = ''
    memberForm.email = ''
    memberForm.password = ''
    memberForm.grade = 'Staff'
    memberForm.status = 'active'
    memberForm.role = 'standard'
  }
  isMemberModalOpen.value = true
}

const onMemberSubmit = async () => {
  savingMember.value = true
  try {
    if (selectedMember.value) {
      const payload = {
        name: memberForm.name,
        email: memberForm.email,
        grade: memberForm.grade,
        status: memberForm.status,
        role: memberForm.role
      }
      const res = await api.put(`/firms/${selectedFirmId.value}/members/${selectedMember.value.userId}`, payload)
      toast.add({ title: 'Success', description: res.message || 'Member updated successfully', color: 'success' })
    } else {
      const payload = {
        email: memberForm.email,
        grade: memberForm.grade,
        name: memberForm.name,
        password: memberForm.password || undefined,
        status: memberForm.status,
        role: memberForm.role
      }
      const res = await api.post(`/firms/${selectedFirmId.value}/members`, payload)
      toast.add({ title: 'Success', description: res.message || 'Member added successfully', color: 'success' })
    }
    isMemberModalOpen.value = false
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
  <div class="space-y-4 p-4 md:p-6 w-full max-w-none">
    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
      <div>
        <h1 class="text-2xl font-black text-slate-800 tracking-tight">Dashboard</h1>
        <p class="text-xs text-slate-500 mt-0.5">Welcome back, <span class="font-bold text-slate-700">{{ user?.name }}</span></p>
      </div>
      <div v-if="!selectedFirmId" class="text-amber-600 bg-amber-50 border border-amber-200/60 px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
        Please select a firm to view data
      </div>
      <UButton v-else icon="i-heroicons-plus" label="New Contact" to="/contacts/new" size="sm" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold" />
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div v-for="stat in stats" :key="stat.label" class="bg-white border border-slate-200/60 shadow-sm rounded-xl p-4 flex items-center gap-4 transition hover:shadow-md hover:border-slate-300/60">
        <div :class="`p-2.5 rounded-lg border ${stat.bgClass}`">
          <UIcon :name="stat.icon" class="w-5 h-5" />
        </div>
        <div>
          <p class="text-xs font-bold text-slate-500 uppercase tracking-wider">{{ stat.label }}</p>
          <p :class="`text-xl font-black mt-0.5 ${stat.textClass}`">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <!-- Main Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Security Logs -->
      <UCard class="bg-white border border-slate-200/60 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-slate-800 uppercase tracking-wider">Security Logs</h3>
            <UButton variant="ghost" color="neutral" size="xs" label="View all" class="text-indigo-600 hover:bg-indigo-50 font-bold" />
          </div>
        </template>
        
        <div v-if="activity.length > 0" class="space-y-2">
          <div v-for="log in activity" :key="log._id" class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition border border-transparent hover:border-slate-100">
            <div class="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
              <UIcon :name="log.severity === 'high' ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-information-circle'" 
                     :class="log.severity === 'high' ? 'text-rose-500 w-4 h-4' : 'text-indigo-500 w-4 h-4'" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-slate-700 truncate capitalize">{{ log.action.replace(/_/g, ' ') }}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">{{ formatDate(log.timestamp) }}</p>
            </div>
            <UBadge variant="subtle" size="sm" :color="log.severity === 'high' ? 'error' : 'primary'" class="text-[9px] uppercase font-bold py-0 px-1.5">
              {{ log.severity }}
            </UBadge>
          </div>
        </div>
        <div v-else class="py-8 text-center text-xs text-slate-400">
          No security logs found.
        </div>
      </UCard>

      <!-- Your Firms -->
      <UCard class="bg-white border border-slate-200/60 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100' }">
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="font-bold text-sm text-slate-800 uppercase tracking-wider">Your Firms</h3>
          </div>
        </template>
        <div class="space-y-2">
          <div v-for="f in user?.firms" :key="getFirmId(f.firm)" 
               class="flex items-center justify-between p-2.5 rounded-lg border transition"
               :class="getFirmId(f.firm) === selectedFirmId 
                 ? 'border-indigo-200 bg-indigo-50/30 ring-1 ring-indigo-100' 
                 : 'border-slate-100 hover:border-slate-200 bg-slate-50/40 hover:bg-slate-50'">
            <div class="flex items-center gap-3">
              <div :class="`w-7 h-7 rounded flex items-center justify-center border ${getFirmId(f.firm) === selectedFirmId ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-500'}`">
                <UIcon name="i-heroicons-building-office-2" class="w-4 h-4" />
              </div>
              <span class="text-xs font-bold text-slate-700">{{ typeof f.firm === 'object' ? f.firm.name : 'Selected Firm' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <UBadge variant="outline" color="primary" class="text-[9px] uppercase font-bold py-0 px-1.5">{{ f.grade }}</UBadge>
              <UButton v-if="getFirmId(f.firm) !== selectedFirmId" size="xs" variant="soft" color="primary" label="Switch" @click="selectFirm(getFirmId(f.firm))" class="text-[10px] font-bold px-2 py-0.5" />
            </div>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Firm Settings (Owners/Admins only) -->
    <UCard v-if="isOwnerOrAdmin" class="bg-white border border-slate-200/60 shadow-sm rounded-xl mt-4" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100' }">
      <template #header>
        <div>
          <h3 class="font-bold text-sm text-slate-800 uppercase tracking-wider">Firm Settings</h3>
          <p class="text-[10px] text-slate-400 mt-0.5">Manage configuration and preferences for your firm</p>
        </div>
      </template>

      <div class="space-y-3 max-w-md">
        <div class="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100">
          <div>
            <h4 class="font-bold text-xs text-slate-700">GST Billing & Tax Calculation</h4>
            <p class="text-[10px] text-slate-400 mt-0.5">Enable or disable GST tax rates, HSN fields, and calculations.</p>
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

    <!-- Firm Member Management CRUD (Owners/Admins only) -->
    <UCard v-if="isOwnerOrAdmin" class="bg-white border border-slate-200/60 shadow-sm rounded-xl mt-4" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100' }">
      <template #header>
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-bold text-sm text-slate-800 uppercase tracking-wider">Firm Team Members</h3>
            <p class="text-[10px] text-slate-400 mt-0.5">Manage users, roles, and status for your firm</p>
          </div>
          <UButton icon="i-heroicons-plus" label="Add Member" size="xs" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" @click="openMemberModal()" />
        </div>
      </template>

      <div class="border border-slate-200/60 rounded-lg overflow-hidden">
        <UTable :data="members" :columns="memberColumns" :loading="membersLoading">
          <template #grade-cell="{ row }">
            <UBadge variant="subtle" color="primary" class="text-[9px] uppercase font-bold py-0.5 px-1.5">{{ row.original.grade }}</UBadge>
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
              <UButton v-if="row.original.userId !== user?.id && !(row.original.grade === 'Owner' && activeFirmGrade !== 'Owner')" 
                       size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="openMemberModal(row.original)" />
              <UButton v-if="row.original.userId !== user?.id && !(row.original.grade === 'Owner' && activeFirmGrade !== 'Owner')" 
                       size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="deleteMember(row.original.userId)" />
            </div>
          </template>
        </UTable>
      </div>
    </UCard>

    <!-- Member Add/Edit Modal -->
    <UModal v-model:open="isMemberModalOpen" 
            :title="selectedMember ? 'Edit Firm Member' : 'Add New Member to Firm'"
            :ui="{ content: 'sm:max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl' }">
      <template #body>
        <form @submit.prevent="onMemberSubmit" class="space-y-4 px-4 py-2 bg-white">
          <UFormField v-if="!selectedMember" label="Full Name" class="w-full">
            <UInput v-model="memberForm.name" placeholder="John Doe" class="w-full bg-white border-slate-200" />
          </UFormField>
          <UFormField label="Email Address" class="w-full">
            <UInput v-model="memberForm.email" type="email" placeholder="name@company.com" required :disabled="!!selectedMember" class="w-full bg-white border-slate-200" />
          </UFormField>
          <UFormField v-if="!selectedMember" label="Password (for new users)" class="w-full">
            <UInput v-model="memberForm.password" type="password" placeholder="Minimum 8 characters" class="w-full bg-white border-slate-200" />
          </UFormField>
          <UFormField label="Firm Grade" class="w-full">
            <USelect v-model="memberForm.grade" :items="gradeOptions" class="w-full bg-white border-slate-200" />
          </UFormField>
          <UFormField v-if="user?.role === 'superadmin'" label="System Role" class="w-full">
            <USelect v-model="memberForm.role" :items="roleOptions" class="w-full bg-white border-slate-200" />
          </UFormField>
          <UFormField label="Account Status" class="w-full">
            <USelect v-model="memberForm.status" :items="statusOptions" class="w-full bg-white border-slate-200" />
          </UFormField>
          <div class="flex justify-end gap-2 mt-6">
            <UButton variant="ghost" label="Cancel" @click="isMemberModalOpen = false" class="text-slate-500 font-bold" />
            <UButton type="submit" label="Save" :loading="savingMember" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold" />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
