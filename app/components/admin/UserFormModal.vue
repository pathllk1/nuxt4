<script setup lang="ts">
import { reactive, onMounted, ref, watch } from 'vue'
import { useAuth } from '../../composables/useAuth'

const props = defineProps<{
  open?: boolean;
  user?: any;
  availableFirms?: any[];
}>()

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>()

const { apiFetch } = useAuth()
const toast = useToast()
const loading = ref(false)

const form = reactive({
  name: '',
  email: '',
  password: '',
  role: 'standard',
  status: 'active',
  firmAssignments: [] as Array<{ firmId: string; grade: string }>
})

const populateForm = () => {
  if (props.user) {
    form.name = props.user.name || ''
    form.email = props.user.email || ''
    form.password = ''
    form.role = props.user.role || 'standard'
    form.status = props.user.status || 'active'
    form.firmAssignments = Array.isArray(props.user.firms)
      ? props.user.firms.map((f: any) => ({
          firmId: f.firmId || f.firm?._id || f.firm || '',
          grade: f.grade || 'Staff'
        }))
      : []
  } else {
    form.name = ''
    form.email = ''
    form.password = 'Welcome@123'
    form.role = 'standard'
    form.status = 'active'
    form.firmAssignments = []
  }
}

onMounted(populateForm)
watch(() => props.user, populateForm)

const addFirmAssignment = () => {
  const firstAvailable = props.availableFirms?.[0]?.id || props.availableFirms?.[0]?._id || ''
  form.firmAssignments.push({
    firmId: firstAvailable,
    grade: 'Staff'
  })
}

const removeFirmAssignment = (index: number) => {
  form.firmAssignments.splice(index, 1)
}

const onSubmit = async () => {
  loading.value = true
  try {
    let res: any
    if (props.user?._id || props.user?.id) {
      const targetId = props.user._id || props.user.id
      res = await apiFetch(`/api/admin/users/${targetId}`, {
        method: 'PUT',
        body: form
      })
    } else {
      res = await apiFetch('/api/admin/users', {
        method: 'POST',
        body: form
      })
    }

    if (res.success) {
      toast.add({ title: 'Success', description: res.message || 'User saved successfully', color: 'success' })
      emit('success')
      emit('close')
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Failed to save user', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open"
          @update:open="(val) => { if (!val) emit('close'); }"
          :title="user ? 'Edit System User' : 'Create System User'"
          :ui="{ content: 'sm:max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl' }">
    <template #body>
      <form @submit.prevent="onSubmit" class="space-y-4">
        <UFormField label="Full Name" required>
          <UInput v-model="form.name" placeholder="John Doe" required class="w-full" />
        </UFormField>

        <UFormField label="Email Address" required>
          <UInput v-model="form.email" type="email" placeholder="user@domain.com" required class="w-full" />
        </UFormField>

        <UFormField v-if="!user" label="Temporary Password" required>
          <UInput v-model="form.password" type="password" placeholder="••••••••" required class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-4">
          <UFormField label="System Role">
            <USelect v-model="form.role" :items="[{ label: 'Standard User', value: 'standard' }, { label: 'Superadmin', value: 'superadmin' }]" class="w-full" />
          </UFormField>

          <UFormField label="Account Status">
            <USelect v-model="form.status" :items="[{ label: 'Active', value: 'active' }, { label: 'Pending', value: 'pending' }, { label: 'Suspended', value: 'suspended' }]" class="w-full" />
          </UFormField>
        </div>

        <!-- Firm Assignments Section -->
        <div class="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between">
            <h4 class="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">Firm Access & Roles</h4>
            <UButton size="xs" variant="outline" icon="i-heroicons-plus" label="Assign Firm" @click="addFirmAssignment" />
          </div>

          <div v-if="form.firmAssignments.length > 0" class="space-y-2 max-h-48 overflow-y-auto pr-1">
            <div v-for="(fa, idx) in form.firmAssignments" :key="idx" class="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
              <USelect
                v-model="fa.firmId"
                :items="(availableFirms || []).map(f => ({ label: f.name, value: f.id || f._id }))"
                placeholder="Select Firm..."
                class="flex-1"
              />
              <USelect
                v-model="fa.grade"
                :items="['Owner', 'Admin', 'Manager', 'Staff']"
                class="w-28"
              />
              <UButton size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="removeFirmAssignment(idx)" />
            </div>
          </div>
          <div v-else class="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
            No firms assigned to this user yet.
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="emit('close')" />
          <UButton type="submit" :loading="loading" color="primary" :label="user ? 'Update User' : 'Create User'" class="px-6 font-bold" />
        </div>
      </form>
    </template>
  </UModal>
</template>
