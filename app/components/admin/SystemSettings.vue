<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'

const emit = defineEmits<{
  (e: 'open-ai-settings'): void
}>()

const { apiFetch } = useAuth()
const toast = useToast()

const systemConfig = reactive({
  maintenanceMode: false,
  allowNewSignups: true,
  rateLimitStrictness: 'normal',
  systemAlertMessage: ''
})

const configLoading = ref(false)
const envProcess = ref<any>(null)

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

onMounted(() => {
  fetchSystemConfig()
})

defineExpose({ fetchSystemConfig })
</script>

<template>
  <div class="space-y-4">
    <UCard class="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm rounded-xl" :ui="{ body: 'p-4', header: 'px-4 py-3 border-b border-slate-100 dark:border-slate-800' }">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Dynamic Feature Flags & Controls</h3>
          <UButton size="xs" variant="outline" icon="i-heroicons-cog-6-tooth" label="AI Provider Keys" @click="emit('open-ai-settings')" />
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
</template>
