<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWages } from '~/composables/useWages'
import { computeEmployerEsic } from '~~/shared/utils/statutory-rates'

const { 
  loading, 
  fetchWagesByMonth, 
  fetchAvailableMonths,
  fetchChequeNumbers, 
  downloadBankReport, 
  downloadEPFESICReport, 
  downloadBulkWageSlips, 
  downloadWageSlip, 
  exportWages 
} = useWages()
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
const reportWages = ref<any[]>([])
const serverChequeNos = ref<string[]>([])
const paymentModeFilter = ref('all')
const chequeNoFilter = ref('all')
const projectFilter = ref('all')
const siteFilter = ref('all')
const statusFilter = ref('all')
const searchQuery = ref('')

const availableChequeNos = computed(() => {
  const set = new Set<string>(serverChequeNos.value)
  reportWages.value.forEach(w => {
    if (w.cheque_no) set.add(w.cheque_no)
  })
  return Array.from(set).filter(Boolean).sort()
})

const availableProjects = computed(() => {
  const set = new Set<string>()
  reportWages.value.forEach(w => {
    const p = w.project || w.master_roll_id?.project
    if (p) set.add(p)
  })
  return ['all', ...Array.from(set).sort()]
})

const availableSites = computed(() => {
  const set = new Set<string>()
  reportWages.value.forEach(w => {
    const p = w.project || w.master_roll_id?.project
    if (projectFilter.value === 'all' || p === projectFilter.value) {
      const s = w.site || w.master_roll_id?.site
      if (s) set.add(s)
    }
  })
  return ['all', ...Array.from(set).sort()]
})

watch(projectFilter, () => {
  if (siteFilter.value !== 'all' && !availableSites.value.includes(siteFilter.value)) {
    siteFilter.value = 'all'
  }
})

const hasActiveFilters = computed(() => {
  return (
    projectFilter.value !== 'all' ||
    siteFilter.value !== 'all' ||
    paymentModeFilter.value !== 'all' ||
    chequeNoFilter.value !== 'all' ||
    statusFilter.value !== 'all' ||
    searchQuery.value.trim().length > 0
  )
})

const activeFilterCount = computed(() => {
  let count = 0
  if (projectFilter.value !== 'all') count++
  if (siteFilter.value !== 'all') count++
  if (paymentModeFilter.value !== 'all') count++
  if (chequeNoFilter.value !== 'all') count++
  if (statusFilter.value !== 'all') count++
  if (searchQuery.value.trim().length > 0) count++
  return count
})

const resetFilters = () => {
  projectFilter.value = 'all'
  siteFilter.value = 'all'
  paymentModeFilter.value = 'all'
  chequeNoFilter.value = 'all'
  statusFilter.value = 'all'
  searchQuery.value = ''
}

const stepMonth = (offset: number) => {
  const parts = month.value.split('-').map(Number)
  const y = parts[0] || new Date().getFullYear()
  const mo = parts[1] || 1
  const d = new Date(y, mo - 1 + offset, 1)
  month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  loadReport()
}

const filteredWages = computed(() => {
  let result = reportWages.value

  if (projectFilter.value !== 'all') {
    result = result.filter(w => (w.project || w.master_roll_id?.project) === projectFilter.value)
  }

  if (siteFilter.value !== 'all') {
    result = result.filter(w => (w.site || w.master_roll_id?.site) === siteFilter.value)
  }

  if (paymentModeFilter.value !== 'all') {
    result = result.filter(w => (w.payment_mode || 'CASH') === paymentModeFilter.value)
  }

  if (chequeNoFilter.value && chequeNoFilter.value !== 'all') {
    result = result.filter(w => w.cheque_no === chequeNoFilter.value)
  }

  if (statusFilter.value !== 'all') {
    result = result.filter(w => (w.status || 'POSTED') === statusFilter.value)
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.trim().toLowerCase()
    result = result.filter(w => {
      const name = (w.master_roll_id?.employee_name || '').toLowerCase()
      const acc = (w.master_roll_id?.account_no || '').toLowerCase()
      const aadhar = (w.master_roll_id?.aadhar || '').toLowerCase()
      const remarks = (w.remarks || '').toLowerCase()
      return name.includes(q) || acc.includes(q) || aadhar.includes(q) || remarks.includes(q)
    })
  }

  return result
})

const totals = computed(() => {
  const t = {
    gross: 0,
    epf_e: 0,
    esic_e: 0,
    epf_er: 0,
    esic_er: 0,
    adv: 0,
    net: 0
  }
  filteredWages.value.forEach(w => {
    t.gross += w.gross_salary || 0
    t.epf_e += w.epf_deduction || 0
    t.esic_e += w.esic_deduction || 0
    t.epf_er += w.epf_deduction || 0
    t.esic_er += computeEmployerEsic(w.gross_salary || 0, w.salary_month || month.value)
    t.adv += w.advance_deduction || 0
    t.net += w.net_salary || 0
  })
  return t
})

const loadReport = async () => {
  if (!month.value) return
  try {
    const [wagesRes, chequesRes] = await Promise.all([
      fetchWagesByMonth(month.value),
      fetchChequeNumbers(month.value)
    ])
    if (wagesRes && wagesRes.success) {
      reportWages.value = wagesRes.data || []
    }
    if (chequesRes && chequesRes.success) {
      serverChequeNos.value = chequesRes.data || []
      // Auto-select first available cheque number if none currently selected
      if (serverChequeNos.value.length > 0 && (chequeNoFilter.value === 'all' || !serverChequeNos.value.includes(chequeNoFilter.value))) {
        chequeNoFilter.value = serverChequeNos.value[0] ?? 'all'
      }
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading report', description: err.message, color: 'error' })
  }
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
}

const onDownloadWagesExcel = () => exportWages(month.value, filteredWages.value)
const onDownloadBankReport = () => {
  if (!chequeNoFilter.value || chequeNoFilter.value === 'all') {
    toast.add({
      title: 'Cheque / Ref No Required',
      description: 'Please select a specific Cheque / Ref No to generate the Bank Payout Report.',
      color: 'warning'
    })
    return
  }
  downloadBankReport(
    month.value, 
    chequeNoFilter.value,
    paymentModeFilter.value !== 'all' ? paymentModeFilter.value : undefined
  )
}
const onDownloadEPFESICReport = () => downloadEPFESICReport(month.value)
const onDownloadAllSlips = () => downloadBulkWageSlips(month.value)
const onDownloadSlip = (wage: any) => downloadWageSlip(wage._id, wage.master_roll_id?.employee_name || 'Employee')

onMounted(async () => {
  try {
    const res = await fetchAvailableMonths()
    if (res?.success && res.data?.latestMonth) {
      month.value = res.data.latestMonth
    }
  } catch (err) {
    // fallback to initial month
  }
  loadReport()
})
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-hidden">
    <!-- Filters & Actions Header Container -->
    <div class="bg-white dark:bg-gray-900 p-3.5 rounded-xl shadow-xs border border-gray-200 dark:border-gray-800 flex flex-col gap-3 shrink-0">
      <!-- Row 1: Filters Bar -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Month Stepper & Input -->
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Payroll Month</label>
          <div class="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
            <button
              type="button"
              class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
              title="Previous Month"
              @click="stepMonth(-1)"
            >
              <UIcon name="i-heroicons-chevron-left" class="w-3.5 h-3.5" />
            </button>
            <input
              type="month"
              v-model="month"
              @change="loadReport"
              class="px-2 py-1 bg-transparent border-none text-xs font-bold focus:ring-0 outline-none cursor-pointer text-gray-800 dark:text-gray-200"
            />
            <button
              type="button"
              class="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors cursor-pointer"
              title="Next Month"
              @click="stepMonth(1)"
            >
              <UIcon name="i-heroicons-chevron-right" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="flex flex-col gap-1 flex-1 min-w-[180px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Search Worker</label>
          <div class="relative flex items-center">
            <UIcon name="i-heroicons-magnifying-glass" class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Name, Account, Aadhar..."
              class="w-full pl-8 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <UIcon name="i-heroicons-x-mark" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <!-- Project Filter -->
        <div class="flex flex-col gap-1 min-w-[140px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Project</label>
          <select
            v-model="projectFilter"
            class="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Projects</option>
            <option v-for="p in availableProjects.filter(x => x !== 'all')" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>

        <!-- Site Filter (Cascading) -->
        <div class="flex flex-col gap-1 min-w-[130px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Site</label>
          <select
            v-model="siteFilter"
            class="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Sites</option>
            <option v-for="s in availableSites.filter(x => x !== 'all')" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- Payment Mode Dropdown -->
        <div class="flex flex-col gap-1 min-w-[110px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Payment Mode</label>
          <select
            v-model="paymentModeFilter"
            class="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="CHEQUE">CHEQUE</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="UPI">UPI</option>
          </select>
        </div>

        <!-- Cheque / Ref No Dropdown -->
        <div class="flex flex-col gap-1 min-w-[130px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Cheque / Ref No</label>
          <select
            v-model="chequeNoFilter"
            class="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Ref Nos</option>
            <option v-for="no in availableChequeNos" :key="no" :value="no">{{ no }}</option>
          </select>
        </div>

        <!-- Status Filter -->
        <div class="flex flex-col gap-1 min-w-[100px]">
          <label class="text-[10px] font-black text-gray-500 uppercase tracking-wider">Status</label>
          <select
            v-model="statusFilter"
            class="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-primary cursor-pointer text-gray-800 dark:text-gray-200"
          >
            <option value="all">All Status</option>
            <option value="POSTED">POSTED</option>
            <option value="DRAFT">DRAFT</option>
            <option value="LOCKED">LOCKED</option>
          </select>
        </div>

        <!-- Clear Filters Button -->
        <div v-if="hasActiveFilters" class="flex flex-col gap-1 justify-end">
          <label class="text-[10px] font-black text-transparent select-none">&nbsp;</label>
          <UButton
            size="xs"
            variant="soft"
            color="rose"
            icon="i-heroicons-x-mark"
            @click="resetFilters"
            title="Reset all active filters"
          >
            Clear ({{ activeFilterCount }})
          </UButton>
        </div>
      </div>

      <!-- Row 2: Action Buttons & Filter Summary -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div class="flex items-center gap-2 text-xs text-gray-500">
          <span class="font-bold">Showing:</span>
          <span class="font-mono font-black text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            {{ filteredWages.length }} / {{ reportWages.length }} workers
          </span>
          <span v-if="projectFilter !== 'all'" class="text-[10px] font-bold bg-primary-50 dark:bg-primary-950/40 text-primary border border-primary/20 px-2 py-0.5 rounded">
            Project: {{ projectFilter }}
          </span>
          <span v-if="siteFilter !== 'all'" class="text-[10px] font-bold bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded">
            Site: {{ siteFilter }}
          </span>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <UButton
            size="xs"
            color="success"
            icon="i-heroicons-arrow-up-tray"
            :disabled="filteredWages.length === 0"
            @click="onDownloadWagesExcel"
          >
            Export Excel ({{ filteredWages.length }})
          </UButton>
          <UButton
            size="xs"
            color="primary"
            icon="i-heroicons-building-library"
            :disabled="filteredWages.length === 0"
            @click="onDownloadBankReport"
          >
            Bank Payout Report
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            icon="i-heroicons-document-text"
            :disabled="filteredWages.length === 0"
            @click="onDownloadEPFESICReport"
          >
            EPF & ESIC Report
          </UButton>
          <UButton
            size="xs"
            color="neutral"
            variant="outline"
            icon="i-heroicons-folder-arrow-down"
            :disabled="filteredWages.length === 0"
            @click="onDownloadAllSlips"
          >
            All Slips (ZIP)
          </UButton>
        </div>
      </div>
    </div>

    <!-- Summary KPI Cards (Reactively Computed Based on Active Filters) -->
    <div class="grid grid-cols-2 md:grid-cols-7 gap-2 shrink-0">
      <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xs">
        <div class="text-[9px] font-black text-gray-500 uppercase tracking-wider">Filtered Count</div>
        <div class="text-base font-black font-mono mt-0.5">{{ filteredWages.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xs">
        <div class="text-[9px] font-black text-gray-500 uppercase tracking-wider">Gross Salary</div>
        <div class="text-base font-black font-mono text-gray-900 dark:text-gray-100 mt-0.5">{{ formatCurrency(totals.gross) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xs">
        <div class="text-[9px] font-black text-amber-600 uppercase tracking-wider">EPF (Employee)</div>
        <div class="text-base font-black font-mono text-amber-700 dark:text-amber-400 mt-0.5">{{ formatCurrency(totals.epf_e) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xs">
        <div class="text-[9px] font-black text-amber-600 uppercase tracking-wider">ESIC (Employee)</div>
        <div class="text-base font-black font-mono text-amber-700 dark:text-amber-400 mt-0.5">{{ formatCurrency(totals.esic_e) }}</div>
      </div>
      <div class="bg-indigo-50/50 dark:bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/40 shadow-xs">
        <div class="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Total (Employer)</div>
        <div class="text-base font-black font-mono text-indigo-700 dark:text-indigo-300 mt-0.5">{{ formatCurrency(totals.epf_er + totals.esic_er) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xs">
        <div class="text-[9px] font-black text-rose-500 uppercase tracking-wider">Advance Ded.</div>
        <div class="text-base font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">{{ formatCurrency(totals.adv) }}</div>
      </div>
      <div class="bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 shadow-xs">
        <div class="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Net Payout</div>
        <div class="text-base font-black font-mono text-emerald-700 dark:text-emerald-400 mt-0.5">{{ formatCurrency(totals.net) }}</div>
      </div>
    </div>

    <!-- Main Table -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-xl shadow-xs border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[2px]">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div class="overflow-auto h-full scrollbar-thin">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th class="p-3 w-48">Employee</th>
              <th class="p-3 w-40">Project / Site</th>
              <th class="p-3 w-24 text-center">Paid Date</th>
              <th class="p-3 w-28 text-center">Mode / Ref</th>
              <th class="p-3 w-24 text-right">Gross</th>
              <th class="p-3 w-20 text-right text-amber-500">EPF (E)</th>
              <th class="p-3 w-20 text-right text-amber-500">ESIC (E)</th>
              <th class="p-3 w-20 text-right text-rose-400">Adv Recovery</th>
              <th class="p-3 w-28 text-right text-emerald-400 font-black">Net Salary</th>
              <th class="p-3 w-16 text-center">Slip</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            <tr v-for="wage in filteredWages" :key="wage._id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="p-3 border-r border-gray-50 dark:border-gray-800 font-sans">
                <div class="text-[11px] font-bold text-gray-900 dark:text-gray-100">{{ wage.master_roll_id?.employee_name || 'N/A' }}</div>
                <div class="text-[9px] text-gray-500 font-mono">{{ wage.master_roll_id?.account_no || 'No A/c' }}</div>
              </td>
              <td class="p-3 border-r border-gray-50 dark:border-gray-800 font-sans">
                <div class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate">{{ wage.project || wage.master_roll_id?.project || 'N/A' }}</div>
                <div class="text-[9px] font-black uppercase text-gray-400 truncate">{{ wage.site || wage.master_roll_id?.site || 'N/A' }}</div>
              </td>
              <td class="p-3 text-center border-r border-gray-50 dark:border-gray-800 text-[10px] font-bold">
                {{ wage.paid_date ? wage.paid_date.slice(0, 10) : '-' }}
              </td>
              <td class="p-3 text-center border-r border-gray-50 dark:border-gray-800 font-sans">
                <span class="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-[9px] font-black rounded uppercase block mb-1">
                  {{ wage.payment_mode || 'CASH' }}
                </span>
                <span v-if="wage.cheque_no" class="text-[9px] text-gray-500 font-mono block font-bold">{{ wage.cheque_no }}</span>
              </td>
              <td class="p-3 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono">
                {{ formatCurrency(wage.gross_salary) }}
              </td>
              <td class="p-3 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono text-amber-700 dark:text-amber-400">
                {{ formatCurrency(wage.epf_deduction) }}
              </td>
              <td class="p-3 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono text-amber-700 dark:text-amber-400">
                {{ formatCurrency(wage.esic_deduction) }}
              </td>
              <td class="p-3 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-bold font-mono text-rose-600 dark:text-rose-400">
                {{ formatCurrency(wage.advance_deduction) }}
              </td>
              <td class="p-3 text-right bg-emerald-50 dark:bg-emerald-900/10 font-black text-emerald-700 dark:text-emerald-400 font-mono text-[12px] italic">
                {{ formatCurrency(wage.net_salary) }}
              </td>
              <td class="p-3 text-center font-sans">
                <UButton size="xs" variant="ghost" color="primary" icon="i-heroicons-document-text" title="Download Slip" @click="onDownloadSlip(wage)" />
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-gray-50 dark:bg-gray-800/50 border-t-2 border-gray-200 dark:border-gray-700 font-mono">
            <tr class="font-black text-gray-900 dark:text-gray-100 text-[11px]">
              <td colspan="4" class="p-3 text-right uppercase font-sans">Filtered Summary:</td>
              <td class="p-3 text-right">{{ formatCurrency(totals.gross) }}</td>
              <td class="p-3 text-right text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.epf_e) }}</td>
              <td class="p-3 text-right text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.esic_e) }}</td>
              <td class="p-3 text-right text-rose-600 dark:text-rose-400">{{ formatCurrency(totals.adv) }}</td>
              <td class="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 italic">{{ formatCurrency(totals.net) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div v-if="filteredWages.length === 0 && !loading" class="p-10 text-center flex flex-col items-center justify-center gap-2">
          <UIcon name="i-heroicons-magnifying-glass" class="w-10 h-10 text-gray-300 dark:text-gray-700 mb-1" />
          <span class="text-xs font-black text-gray-500 uppercase tracking-wider">No matching wage records found</span>
          <span class="text-[11px] text-gray-400">Try adjusting your project, site, payment mode, or search terms.</span>
          <UButton v-if="hasActiveFilters" size="xs" variant="soft" color="neutral" icon="i-heroicons-arrow-path" class="mt-2" @click="resetFilters">
            Reset All Filters
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
