<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useAdvances } from '~/composables/useAdvances'
import AdvanceFormModal from './AdvanceFormModal.vue'
import AdvanceHistoryModal from './AdvanceHistoryModal.vue'

const { loading, fetchAllEmployeeBalances } = useAdvances()
const toast = useToast()

const balances = ref<any[]>([])
const searchTerm = ref('')
const showFormModal = ref(false)
const showHistoryModal = ref(false)
const selectedEmployee = ref<any>(null)

const loadBalances = async () => {
  try {
    const response = await fetchAllEmployeeBalances()
    if (response && response.success) {
      balances.value = Array.isArray(response.data) ? response.data : (response.data?.data || [])
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading balances', description: err.message, color: 'error' })
  }
}

const filteredBalances = computed(() => {
  if (!searchTerm.value) return balances.value
  const term = searchTerm.value.toLowerCase()
  return balances.value.filter(b => 
    (b.employee_name && b.employee_name.toLowerCase().includes(term)) || 
    (b.project && b.project.toLowerCase().includes(term)) ||
    (b.site && b.site.toLowerCase().includes(term))
  )
})

const openForm = (employee?: any) => {
  selectedEmployee.value = employee || null
  showFormModal.value = true
}

const viewHistory = (employee: any) => {
  selectedEmployee.value = employee
  showHistoryModal.value = true
}

onMounted(() => {
  loadBalances()
})
</script>

<template>
  <div class="flex flex-col h-full gap-2">
    <!-- Toolbar -->
    <div class="bg-white dark:bg-gray-900 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
      <div class="flex items-center gap-4">
        <UButton size="xs" icon="i-heroicons-plus-circle" @click="openForm()">Record Advance/Recovery</UButton>
        <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" :loading="loading" @click="loadBalances">Refresh</UButton>
      </div>

      <div class="flex items-center gap-2">
        <input type="text" v-model="searchTerm" placeholder="Search staff..." class="px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs w-48" />
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[2px]">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div class="overflow-auto h-full scrollbar-thin">
        <table class="w-full text-left border-collapse table-fixed">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800">
              <th class="p-2 w-48">Employee</th>
              <th class="p-2 w-32 text-right">Total Advance</th>
              <th class="p-2 w-32 text-right">Total Recovery</th>
              <th class="p-2 w-32 text-right bg-primary/10 text-primary-400 italic">Net Balance</th>
              <th class="p-2 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="b in filteredBalances" :key="b.master_roll_id || b._id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
              <td class="p-2 border-r border-gray-50 dark:border-gray-800">
                <div class="text-[11px] font-bold text-gray-900 dark:text-gray-100 truncate">{{ b.employee_name }}</div>
                <div class="text-[9px] text-gray-500 uppercase font-medium truncate">{{ b.project }} • {{ b.site }}</div>
              </td>
              <td class="p-2 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono text-rose-600">
                ₹{{ (b.totalAdvance ?? 0).toLocaleString() }}
              </td>
              <td class="p-2 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono text-emerald-600">
                ₹{{ (b.totalRecovery ?? 0).toLocaleString() }}
              </td>
              <td class="p-2 text-right bg-primary/5 font-black text-primary-600 dark:text-primary-400 font-mono text-[12px] italic">
                ₹{{ (b.balance ?? 0).toLocaleString() }}
              </td>
              <td class="p-2 text-center flex items-center justify-center gap-1">
                <UButton size="xs" variant="ghost" icon="i-heroicons-clock" @click="viewHistory(b)" />
                <UButton size="xs" variant="ghost" icon="i-heroicons-plus-circle" color="success" @click="openForm(b)" />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredBalances.length === 0 && !loading" class="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
          No records found.
        </div>
      </div>
    </div>

    <!-- Modals -->
    <AdvanceFormModal v-if="showFormModal" :employee="selectedEmployee" @close="showFormModal = false" @saved="loadBalances" />
    <AdvanceHistoryModal v-if="showHistoryModal" :employee="selectedEmployee" @close="showHistoryModal = false" @updated="loadBalances" />
  </div>
</template>
