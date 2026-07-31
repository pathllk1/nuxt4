<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'

const emit = defineEmits(['close'])
const { exportICards, fetchUniqueFields } = useMasterRoll()

const form = reactive({
  category: '',
  project: '',
  site: ''
})

const uniqueData = reactive({
  projects: [] as string[],
  sites: [] as string[],
  categories: [] as string[]
})

const loading = ref(false)
const fetchingFields = ref(true)

onMounted(async () => {
  try {
    const res = await fetchUniqueFields()
    if (res?.success) {
      uniqueData.projects = res.data.projects
      uniqueData.sites = res.data.sites
      uniqueData.categories = res.data.categories
    }
  } finally {
    fetchingFields.value = false
  }
})

const onGenerate = async (format: 'pdf' | 'xlsx' = 'pdf') => {
  loading.value = true
  try {
    await exportICards(form, format)
    emit('close')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center gap-3 border-b border-slate-200 pb-4">
      <div class="p-2 bg-indigo-50 rounded-lg">
        <UIcon name="i-heroicons-identification" class="w-6 h-6 text-indigo-600" />
      </div>
      <div>
        <h3 class="text-lg font-bold text-slate-900">Generate Employee I-Cards</h3>
        <p class="text-xs text-slate-500">Filter by project, site or category to generate specific cards.</p>
      </div>
    </div>

    <div v-if="fetchingFields" class="flex flex-col items-center justify-center py-12 gap-3">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      <p class="text-xs text-gray-500 font-medium">Fetching available locations...</p>
    </div>
    
    <div v-else class="grid grid-cols-1 gap-5">
      <UFormField label="Filter by Category" help="Leave empty for all categories">
        <USelect 
          v-model="form.category" 
          :items="uniqueData.categories.length > 0 ? uniqueData.categories : ['UNSKILLED', 'SEMI-SKILLED', 'SKILLED', 'HIGHLY-SKILLED']" 
          placeholder="Select Category"
          class="w-full"
          size="lg"
        />
      </UFormField>

      <UFormField label="Filter by Project">
        <USelect 
          v-model="form.project" 
          :items="uniqueData.projects" 
          placeholder="Select Project" 
          class="w-full" 
          size="lg" 
          icon="i-heroicons-briefcase" 
        />
      </UFormField>

      <UFormField label="Filter by Site">
        <USelect 
          v-model="form.site" 
          :items="uniqueData.sites" 
          placeholder="Select Site/Location" 
          class="w-full" 
          size="lg" 
          icon="i-heroicons-map-pin" 
        />
      </UFormField>
    </div>

    <div class="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-slate-200 gap-4">
      <p class="text-[10px] text-gray-400 max-w-full sm:max-w-[200px] text-center sm:text-left">
        Note: Only 'Active' employees will be included in the generation process.
      </p>
      <div class="flex flex-wrap justify-center sm:justify-end gap-3 w-full sm:w-auto">
        <UButton variant="ghost" color="neutral" label="Cancel" @click="emit('close')" class="flex-1 sm:flex-none" />
        <UButton :loading="loading" :disabled="fetchingFields" icon="i-heroicons-table-cells" label="Excel" @click="onGenerate('xlsx')" class="flex-1 sm:flex-none" />
        <UButton :loading="loading" :disabled="fetchingFields" icon="i-heroicons-arrow-down-tray" label="Generate PDF" @click="onGenerate('pdf')" class="flex-1 sm:flex-none px-6" />
      </div>
    </div>
  </div>
</template>
