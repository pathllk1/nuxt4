<script setup lang="ts">
import { ref, onMounted } from 'vue'
import WagesDashboard from '~/components/wages/WagesDashboard.vue'
import WagesCreate from '~/components/wages/WagesCreate.vue'
import WagesEdit from '~/components/wages/WagesEdit.vue'
import WagesReport from '~/components/wages/WagesReport.vue'
import AdvancesManagement from '~/components/wages/AdvancesManagement.vue'
import { useAdvances } from '~/composables/useAdvances'

definePageMeta({
  layout: 'default'
})

useHead({
  title: 'Employee Wages'
})

const activeTab = ref('dashboard')
const { fetchAllEmployeeBalances } = useAdvances()
const activeAdvanceCount = ref(0)
const activeAdvanceTotal = ref(0)

const refreshAdvanceStats = async () => {
  try {
    const res = await fetchAllEmployeeBalances()
    if (res && res.success) {
      const items = Array.isArray(res.data) ? res.data : (res.data?.data || [])
      const positive = items.filter((b: any) => (b.balance || 0) > 0)
      activeAdvanceCount.value = positive.length
      activeAdvanceTotal.value = positive.reduce((sum: number, b: any) => sum + (b.balance || 0), 0)
    }
  } catch {}
}

onMounted(() => {
  refreshAdvanceStats()
})

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: 'i-heroicons-chart-bar' },
  { id: 'create', label: 'Create New Wages', icon: 'i-heroicons-plus-circle' },
  { id: 'edit', label: 'Manage & Edit', icon: 'i-heroicons-pencil-square' },
  { id: 'advance', label: 'Advances', icon: 'i-heroicons-banknotes' },
  { id: 'report', label: 'Wages Report', icon: 'i-heroicons-document-chart-bar' }
]
</script>

<template>
  <div class="h-[calc(100vh-64px)] flex flex-col p-4 bg-gray-50 dark:bg-black gap-4">
    <!-- Tab Navigation -->
    <div class="flex items-center gap-1 bg-white/75 dark:bg-gray-900/75 backdrop-blur-md border border-gray-200/80 dark:border-gray-800/80 p-1 rounded-xl w-fit self-start shadow-xs transition-all duration-300">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        @click="activeTab = tab.id"
        class="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer relative"
        :class="activeTab === tab.id 
          ? 'bg-white dark:bg-gray-800 text-primary shadow-sm border border-gray-100/50 dark:border-gray-700/50 scale-[1.02]' 
          : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50/50 dark:hover:bg-gray-800/30'"
      >
        <UIcon :name="tab.icon" class="w-4 h-4 transition-transform duration-200" :class="activeTab === tab.id ? 'scale-110' : ''" />
        {{ tab.label }}
        <span 
          v-if="tab.id === 'advance' && activeAdvanceCount > 0" 
          class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50"
          :title="`${activeAdvanceCount} employee(s) have active advances totaling ₹${activeAdvanceTotal.toLocaleString()}`"
        >
          {{ activeAdvanceCount }}
        </span>
      </button>
    </div>

    <!-- Tab Content -->
    <div class="flex-1 min-h-0">
      <Transition 
        mode="out-in" 
        enter-active-class="transition duration-200 ease-out" 
        enter-from-class="opacity-0 translate-y-1" 
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-1"
      >
        <div :key="activeTab" class="h-full">
          <WagesDashboard v-if="activeTab === 'dashboard'" @navigate="activeTab = $event" />
          <WagesCreate v-if="activeTab === 'create'" />
          <WagesEdit v-if="activeTab === 'edit'" />
          <AdvancesManagement v-if="activeTab === 'advance'" />
          <WagesReport v-if="activeTab === 'report'" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* Ensure container takes full height minus header */
</style>
