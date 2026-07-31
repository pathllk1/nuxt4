<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'

const props = defineProps<{
  employeeId: string
}>()

const { getActivityLog } = useMasterRoll()
const activities = ref<any[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await getActivityLog(props.employeeId)
    if (res.success) {
      activities.value = res.data
    }
  } finally {
    loading.value = false
  }
})

const formatDate = (date: string) => {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div class="p-4">
    <div v-if="loading" class="flex justify-center py-8">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
    </div>
    <div v-else-if="activities.length === 0" class="text-center py-8 text-slate-500 font-bold uppercase tracking-widest text-xs">
      No activity recorded yet.
    </div>
    <div v-else class="space-y-6">
      <div v-for="(activity, index) in activities" :key="index" class="relative pl-6 border-l-2 border-slate-200 pb-2">
        <div class="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2" 
             :class="activity.action === 'created' ? 'border-emerald-500' : 'border-indigo-500'">
        </div>
        <div class="flex flex-col">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold uppercase tracking-wider" 
                  :class="activity.action === 'created' ? 'text-emerald-600' : 'text-indigo-600'">
              {{ activity.action }}
            </span>
            <span class="text-[10px] text-slate-400 font-medium">{{ formatDate(activity.timestamp) }}</span>
          </div>
          <div class="mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 text-slate-400" />
              <span class="text-xs font-bold text-slate-800">{{ activity.user_name }}</span>
              <UBadge v-if="activity.user_role" size="xs" variant="subtle" color="neutral" class="ml-auto px-1 py-0 text-[8px] uppercase">
                {{ activity.user_role }}
              </UBadge>
            </div>
            <p class="text-[10px] text-slate-500 mt-0.5 ml-5.5">{{ activity.user_email }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
