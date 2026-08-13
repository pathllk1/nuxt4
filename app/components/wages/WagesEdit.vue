<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWages } from '~/composables/useWages'
import { wagePersistence } from '~/utils/wagePersistence'
import { calculateWBProfessionalTax } from '~/utils/taxCalculations'

const { loading, fetchWagesByMonth, updateWage, deleteWage, downloadWageSlip, fetchBankAccounts } = useWages()
const toast = useToast()

const getInitialMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const month = ref(getInitialMonth())
const existingWages = ref<any[]>([])
const bankAccounts = ref<any[]>([])
const selectedWageIds = ref<Set<string>>(new Set())
const editedWages = ref<Record<string, any>>({})
const searchTerm = ref('')
const calculatePT = ref(false)
const filters = ref({
  project: 'all',
  site: 'all',
  bank: 'all'
})

const uniqueProjects = computed(() => ['all', ...new Set(existingWages.value.map(w => w.project || w.master_roll_id?.project).filter(Boolean))].sort())
const uniqueSites = computed(() => ['all', ...new Set(existingWages.value.map(w => w.site || w.master_roll_id?.site).filter(Boolean))].sort())

const filteredWages = computed(() => {
  return existingWages.value.filter(wage => {
    const term = searchTerm.value.toLowerCase()
    const empName = wage.master_roll_id?.employee_name || ''
    const matchesSearch = !term || empName.toLowerCase().includes(term) || (wage.project || '').toLowerCase().includes(term)
    
    const matchesProject = filters.value.project === 'all' || wage.project === filters.value.project || wage.master_roll_id?.project === filters.value.project
    const matchesSite = filters.value.site === 'all' || wage.site === filters.value.site || wage.master_roll_id?.site === filters.value.site
    
    return matchesSearch && matchesProject && matchesSite
  })
})

const loadData = async () => {
  try {
    const bankRes = await fetchBankAccounts()
    if (bankRes && bankRes.success) bankAccounts.value = bankRes.data
    await loadWages()
  } catch (err: any) {
    toast.add({ title: 'Error loading data', description: err.message, color: 'error' })
  }
}

const loadWages = async () => {
  if (!month.value) return
  try {
    const response = await fetchWagesByMonth(month.value)
    if (response && response.success) {
      existingWages.value = response.data
      const edited: Record<string, any> = {}
      response.data.forEach((wage: any) => {
        edited[wage._id] = {
          ...wage,
          master_roll_id: wage.master_roll_id?._id || wage.master_roll_id
        }
      })
      editedWages.value = edited
      selectedWageIds.value.clear()
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading wages', description: err.message, color: 'error' })
  }
}

const calculateWageNet = (wageId: string) => {
  const item = editedWages.value[wageId]
  if (!item) return
  const gross = item.gross_salary || 0
  
  if (calculatePT.value) {
    item.other_deduction = calculateWBProfessionalTax(gross)
  }

  const epf = item.epf_deduction || 0
  const esic = item.esic_deduction || 0
  const otherDed = item.other_deduction || 0
  const advDed = item.advance_deduction || 0
  const otherBen = item.other_benefit || 0
  
  item.net_salary = gross - (epf + esic + otherDed + advDed) + otherBen
}

watch(calculatePT, () => {
  Object.keys(editedWages.value).forEach(wageId => {
    calculateWageNet(wageId)
  })
})

const handleSaveSingle = async (wageId: string) => {
  const item = editedWages.value[wageId]
  if (!item) return

  try {
    const res = await updateWage(wageId, item)
    if (res) {
      toast.add({ title: 'Success', description: 'Wage updated and ledger recalculated', color: 'success' })
      await loadWages()
    }
  } catch (err: any) {
    toast.add({ title: 'Update Error', description: err.message, color: 'error' })
  }
}

const handleDeleteSingle = async (wageId: string) => {
  if (!confirm('Are you sure you want to delete this wage record? Associated ledger entries will be removed.')) return
  try {
    const res = await deleteWage(wageId)
    if (res) {
      toast.add({ title: 'Success', description: 'Wage record deleted', color: 'success' })
      await loadWages()
    }
  } catch (err: any) {
    toast.add({ title: 'Delete Error', description: err.message, color: 'error' })
  }
}

const onDownloadSlip = async (wage: any) => {
  try {
    const name = wage.master_roll_id?.employee_name || 'Employee'
    await downloadWageSlip(wage._id, name)
    toast.add({ title: 'Success', description: 'Wage slip downloaded', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  }
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex flex-col h-full gap-2">
    <!-- Filters Toolbar -->
    <div class="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-gray-500 uppercase">Month</label>
          <input type="month" v-model="month" @change="loadWages" class="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-bold" />
        </div>
        <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" :loading="loading" @click="loadWages">Reload Wages</UButton>
        
        <!-- Toggle: Calculate PT (WB Slab) -->
        <button 
          type="button" 
          @click="calculatePT = !calculatePT" 
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold transition-all cursor-pointer"
          :class="calculatePT ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'"
          title="Toggle West Bengal Professional Tax auto-calculation on Other Deduction"
        >
          <UIcon :name="calculatePT ? 'i-heroicons-check-circle' : 'i-heroicons-minus-circle'" class="w-3.5 h-3.5" />
          <span>Calculate PT</span>
          <span class="text-[8.5px] font-black uppercase px-1 py-0.5 rounded" :class="calculatePT ? 'bg-amber-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'">WB Slab</span>
        </button>
      </div>

      <div class="flex items-center gap-2">
        <input type="text" v-model="searchTerm" placeholder="Search staff name..." class="px-3 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs w-48" />
        <select v-model="filters.project" class="px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs">
          <option v-for="p in uniqueProjects" :key="p" :value="p">{{ p === 'all' ? 'All Projects' : p }}</option>
        </select>
        <select v-model="filters.site" class="px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs">
          <option v-for="s in uniqueSites" :key="s" :value="s">{{ s === 'all' ? 'All Sites' : s }}</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[2px]">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div class="overflow-auto h-full scrollbar-thin">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th class="p-2 w-48">Employee</th>
              <th class="p-2 w-20 text-right">Wage Days</th>
              <th class="p-2 w-24 text-right">Gross Salary</th>
              <th class="p-2 w-20 text-right">EPF</th>
              <th class="p-2 w-20 text-right">ESIC</th>
              <th class="p-2 w-20 text-right" :class="{'text-amber-400 font-bold': calculatePT}">{{ calculatePT ? 'PT / Other' : 'Other Ded' }}</th>
              <th class="p-2 w-24 text-right text-rose-400">Adv. Deduction</th>
              <th class="p-2 w-24 text-right text-emerald-400 font-black">Net Salary</th>
              <th class="p-2 w-32 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            <tr v-for="wage in filteredWages" :key="wage._id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="p-2 font-sans border-r border-gray-50 dark:border-gray-800">
                <div class="font-bold text-gray-900 dark:text-gray-100 truncate">{{ wage.master_roll_id?.employee_name || 'N/A' }}</div>
                <div class="text-[9px] text-gray-500 uppercase truncate">{{ wage.project }} • {{ wage.site }}</div>
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="editedWages[wage._id].wage_days" @input="calculateWageNet(wage._id)" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded font-bold" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="editedWages[wage._id].gross_salary" @input="calculateWageNet(wage._id)" class="w-20 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded font-bold" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="editedWages[wage._id].epf_deduction" @input="calculateWageNet(wage._id)" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="editedWages[wage._id].esic_deduction" @input="calculateWageNet(wage._id)" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" />
              </td>
              <td class="p-2 text-right" :class="{'bg-amber-500/10 dark:bg-amber-500/20': calculatePT}">
                <input type="number" v-model.number="editedWages[wage._id].other_deduction" @input="calculateWageNet(wage._id)" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" :class="calculatePT ? 'text-amber-600 dark:text-amber-400 font-bold border-amber-300' : 'text-orange-600'" :placeholder="calculatePT ? 'PT' : '0'" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="editedWages[wage._id].advance_deduction" @input="calculateWageNet(wage._id)" class="w-18 px-1 text-right bg-gray-50 dark:bg-gray-800 border border-rose-200 dark:border-rose-800 rounded font-bold text-rose-600" />
              </td>
              <td class="p-2 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs border-r border-gray-50 dark:border-gray-800">
                ₹{{ (editedWages[wage._id]?.net_salary || 0).toLocaleString() }}
              </td>
              <td class="p-2 text-center font-sans flex items-center justify-center gap-1">
                <UButton size="xs" color="success" icon="i-heroicons-check" title="Save Changes" @click="handleSaveSingle(wage._id)" />
                <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-down-tray" title="Download Slip" @click="onDownloadSlip(wage)" />
                <UButton size="xs" variant="ghost" color="error" icon="i-heroicons-trash" title="Delete Wage" @click="handleDeleteSingle(wage._id)" />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredWages.length === 0 && !loading" class="p-8 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
          No wage records found for {{ month }}.
        </div>
      </div>
    </div>
  </div>
</template>
