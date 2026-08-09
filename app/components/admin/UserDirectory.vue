<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const emit = defineEmits<{
  (e: 'open-user-modal', user?: any): void
  (e: 'update-stats', count: number): void
}>()

const { user: currentUser, apiFetch } = useAuth()
const toast = useToast()

const users = ref<any[]>([])
const usersLoading = ref(false)
const userSearch = ref('')
const userRoleFilter = ref('all')

const fetchUsers = async () => {
  usersLoading.value = true
  try {
    const res: any = await apiFetch('/api/admin/users')
    if (res.success) {
      users.value = res.data || []
      emit('update-stats', users.value.length)
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    usersLoading.value = false
  }
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

onMounted(() => {
  fetchUsers()
})

defineExpose({ fetchUsers })
</script>

<template>
  <div class="space-y-4">
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div class="flex items-center gap-3 flex-1">
            <UInput v-model="userSearch" placeholder="Search name or email..." icon="i-heroicons-magnifying-glass" size="xs" class="w-64" />
            <USelect v-model="userRoleFilter" :items="[{ label: 'All Roles', value: 'all' }, { label: 'Superadmin', value: 'superadmin' }, { label: 'Standard', value: 'standard' }]" size="xs" class="w-36" />
          </div>
          <UButton icon="i-heroicons-user-plus" label="Create User" color="primary" size="xs" class="font-bold" @click="emit('open-user-modal')" />
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
            <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-pencil-square" @click="emit('open-user-modal', row.original)" />
            <UButton v-if="row.original._id !== currentUser?.id" size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="deleteUser(row.original._id || row.original.id)" />
          </div>
        </template>
      </UTable>
    </UCard>
  </div>
</template>
