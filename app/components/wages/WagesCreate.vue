<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWages } from '~/composables/useWages'

const { 
  loading, 
  fetchEligibleEmployees, 
  createWagesBulk, 
  fetchBankAccounts, 
  downloadBankReport, 
  downloadEPFESICReport, 
  exportWages, 
  getJobStatus 
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
const employees = ref<any[]>([])
const bankAccounts = ref<any[]>([])
const selectedEmployeeIds = ref<Set<string>>(new Set())
const wageData = ref<Record<string, any>>({})

// Background Job processing state
const isProcessingJob = ref(false)
const jobProgress = ref(0)
const jobStatusText = ref('')
const processedWagesCount = ref(0)
const totalWagesCount = ref(0)

const commonPaymentData = ref({
  paid_date: '',
  cheque_no: '',
  payment_mode: 'CASH',
  bank_account_id: '',
  remarks: ''
})

const searchTerm = ref('')
const filters = ref({
  project: 'all',
  site: 'all',
  bank: 'all'
})

const uniqueProjects = computed(() => ['all', ...new Set(employees.value.map(e => e.project).filter(Boolean))].sort())
const uniqueSites = computed(() => ['all', ...new Set(employees.value.map(e => e.site).filter(Boolean))].sort())
const uniqueBanks = computed(() => ['all', ...new Set(employees.value.map(e => e.bank).filter(Boolean))].sort())

const filteredEmployees = computed(() => {
  return employees.value.filter(emp => {
    const term = searchTerm.value.toLowerCase()
    const matchesSearch = !term || 
      emp.employee_name.toLowerCase().includes(term) || 
      emp.project?.toLowerCase().includes(term) ||
      emp.site?.toLowerCase().includes(term)
    
    const matchesProject = filters.value.project === 'all' || emp.project === filters.value.project
    const matchesSite = filters.value.site === 'all' || emp.site === filters.value.site
    const matchesBank = filters.value.bank === 'all' || emp.bank === filters.value.bank
    
    return matchesSearch && matchesProject && matchesSite && matchesBank
  })
})

const isAllSelected = computed(() => {
  if (filteredEmployees.value.length === 0) return false
  return filteredEmployees.value.every(e => selectedEmployeeIds.value.has(e.master_roll_id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    filteredEmployees.value.forEach(e => selectedEmployeeIds.value.delete(e.master_roll_id))
  } else {
    filteredEmployees.value.forEach(e => selectedEmployeeIds.value.add(e.master_roll_id))
  }
}

const totals = computed(() => {
  let gross = 0, epf = 0, esic = 0, adv = 0, net = 0
  selectedEmployeeIds.value.forEach(id => {
    const w = wageData.value[id]
    if (w) {
      gross += w.gross_salary || 0
      epf += w.epf_deduction || 0
      esic += w.esic_deduction || 0
      adv += w.advance_deduction || 0
      net += w.net_salary || 0
    }
  })
  return { gross, epf, esic, adv, net }
})

const calculateEmployeeWages = (masterRollId: string, item: any) => {
  const pDayWage = item.p_day_wage || 0
  const wageDays = item.wage_days || 0
  item.gross_salary = Math.round(pDayWage * wageDays)
  
  const epf = item.epf_deduction || 0
  const esic = item.esic_deduction || 0
  const otherDed = item.other_deduction || 0
  const advDed = item.advance_deduction || 0
  const otherBen = item.other_benefit || 0
  
  item.net_salary = item.gross_salary - (epf + esic + otherDed + advDed) + otherBen
}

const loadData = async () => {
  try {
    const bankRes = await fetchBankAccounts()
    if (bankRes && bankRes.success) {
      bankAccounts.value = bankRes.data || []
    }
    await loadEmployees()
  } catch (err: any) {
    toast.add({ title: 'Error loading initial data', description: err.message, color: 'error' })
  }
}

const loadEmployees = async () => {
  if (!month.value) return
  try {
    const response = await fetchEligibleEmployees(month.value)
    const list = response && response.success ? response.data : (Array.isArray(response) ? response : (response?.data || []))
    employees.value = list
    const data: Record<string, any> = {}
    list.forEach((emp: any) => {
      data[emp.master_roll_id] = {
        master_roll_id: emp.master_roll_id,
        p_day_wage: emp.last_p_day_wage || emp.p_day_wage || 0,
        wage_days: emp.last_wage_days || 26,
        gross_salary: 0,
        epf_deduction: 0,
        esic_deduction: 0,
        other_deduction: 0,
        other_benefit: 0,
        advance_deduction: 0,
        net_salary: 0,
        advance_balance: emp.advance_balance || 0
      }
      calculateEmployeeWages(emp.master_roll_id, data[emp.master_roll_id])
    })
    wageData.value = data
    selectedEmployeeIds.value.clear()
  } catch (err: any) {
    toast.add({ title: 'Error loading eligible staff', description: err.message, color: 'error' })
  }
}

const onExportExcel = async () => {
  if (!month.value) return
  const exportData = filteredEmployees.value.map(emp => {
    const w = wageData.value[emp.master_roll_id] || {}
    return {
      master_roll_id: emp,
      p_day_wage: w.p_day_wage,
      wage_days: w.wage_days,
      gross_salary: w.gross_salary,
      epf_deduction: w.epf_deduction,
      esic_deduction: w.esic_deduction,
      advance_deduction: w.advance_deduction,
      other_deduction: w.other_deduction,
      other_benefit: w.other_benefit,
      net_salary: w.net_salary,
      payment_mode: commonPaymentData.value.payment_mode,
      paid_date: commonPaymentData.value.paid_date,
      cheque_no: commonPaymentData.value.cheque_no
    }
  })
  try {
    await exportWages(month.value, exportData)
    toast.add({ title: 'Success', description: 'Wages Excel download started', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Export failed', description: err.message, color: 'error' })
  }
}

const onExportBank = () => {
  if (!month.value) return
  downloadBankReport(month.value, commonPaymentData.value.cheque_no || undefined)
}

const onExportEPF = () => {
  if (!month.value) return
  downloadEPFESICReport(month.value)
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const pollJobStatus = async (jobId: string) => {
  isProcessingJob.value = true
  jobProgress.value = 5
  jobStatusText.value = 'Starting batch calculation...'

  const interval = setInterval(async () => {
    try {
      const res = await getJobStatus(jobId)
      if (res && res.success) {
        const job = res.data
        if (job) {
          totalWagesCount.value = job.total_records || 0
          processedWagesCount.value = job.processed_records || 0
          jobProgress.value = job.progress || 0
          jobStatusText.value = `Processing (${job.processed_records}/${job.total_records})`

          if (job.status === 'COMPLETED') {
            clearInterval(interval)
            isProcessingJob.value = false
            toast.add({ title: 'Success', description: 'Batch wages processed cleanly', color: 'success' })
            await loadEmployees()
          } else if (job.status === 'FAILED') {
            clearInterval(interval)
            isProcessingJob.value = false
            toast.add({ title: 'Job Failed', description: job.error_message || 'Processing failed', color: 'error' })
          }
        }
      }
    } catch (err: any) {
      clearInterval(interval)
      isProcessingJob.value = false
    }
  }, 1500)
}

const handleSubmitBulkWages = async () => {
  if (selectedEmployeeIds.value.size === 0) {
    toast.add({ title: 'Validation Warning', description: 'Please select at least one employee', color: 'warning' })
    return
  }

  const wagesToSubmit: any[] = []
  for (const empId of selectedEmployeeIds.value) {
    const data = wageData.value[empId]
    if (!data) continue

    wagesToSubmit.push({
      ...data,
      paid_date: commonPaymentData.value.paid_date || undefined,
      cheque_no: commonPaymentData.value.cheque_no || undefined,
      payment_mode: commonPaymentData.value.payment_mode || undefined,
      bank_account_id: commonPaymentData.value.bank_account_id || undefined,
      remarks: commonPaymentData.value.remarks || undefined
    })
  }

  try {
    const res = await createWagesBulk(month.value, wagesToSubmit)
    if (res && res.success) {
      if (res.jobId) {
        pollJobStatus(res.jobId)
      } else {
        toast.add({ title: 'Success', description: 'Wages created successfully', color: 'success' })
        await loadEmployees()
      }
    } else {
      toast.add({ title: 'Error', description: res?.message || 'Failed to submit wages', color: 'error' })
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Submission error', color: 'error' })
  }
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex flex-col h-full gap-2.5">
    <!-- Top Bar / Controls -->
    <div class="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-xs font-bold text-gray-500 uppercase">Salary Month</label>
          <input type="month" v-model="month" @change="loadEmployees" class="px-2.5 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-bold" />
        </div>
        <UButton size="xs" variant="ghost" icon="i-heroicons-arrow-path" :loading="loading" @click="loadEmployees">Reload Staff</UButton>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <!-- Export Actions Dropdown -->
        <UButton size="xs" color="success" icon="i-heroicons-arrow-up-tray" @click="onExportExcel">
          Export Excel
        </UButton>
        <UButton size="xs" color="primary" variant="outline" icon="i-heroicons-building-library" @click="onExportBank">
          Bank Advice
        </UButton>
        <UButton size="xs" color="neutral" variant="outline" icon="i-heroicons-document-text" @click="onExportEPF">
          EPF/ESIC
        </UButton>
        <input type="text" v-model="searchTerm" placeholder="Search staff name..." class="px-3 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs w-44" />
      </div>
    </div>

    <!-- Filter & Payment Details Bar -->
    <div class="flex flex-col md:flex-row gap-2 shrink-0">
      <div class="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-2 rounded-lg flex flex-wrap items-center gap-2.5 flex-1">
        <select v-model="filters.project" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none">
          <option v-for="p in uniqueProjects" :key="p" :value="p">{{ p === 'all' ? 'All Projects' : p }}</option>
        </select>
        <select v-model="filters.site" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none">
          <option v-for="s in uniqueSites" :key="s" :value="s">{{ s === 'all' ? 'All Sites' : s }}</option>
        </select>

        <div class="h-4 w-px bg-indigo-200 dark:bg-indigo-800 hidden sm:block"></div>

        <input type="date" v-model="commonPaymentData.paid_date" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none" title="Paid Date" />
        <select v-model="commonPaymentData.bank_account_id" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none max-w-[130px]">
          <option value="">Select Bank</option>
          <option v-for="bank in bankAccounts" :key="bank._id" :value="bank._id">{{ bank.bank_name }}</option>
        </select>
        <select v-model="commonPaymentData.payment_mode" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none">
          <option value="CASH">CASH</option>
          <option value="CHEQUE">CHEQUE</option>
          <option value="NEFT">NEFT</option>
          <option value="RTGS">RTGS</option>
          <option value="IMPS">IMPS</option>
          <option value="UPI">UPI</option>
        </select>
        <input type="text" v-model="commonPaymentData.cheque_no" placeholder="Ref/Cheque No" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none w-28" />
      </div>

      <!-- Real-time Selection Totals -->
      <div class="bg-gray-900 dark:bg-black p-2 rounded-lg text-white border border-gray-800 flex items-center justify-end gap-3 px-4 shrink-0 font-mono">
        <div class="flex flex-col"><span class="text-[8px] text-gray-400 uppercase font-sans">Gross</span><span class="text-[11px] font-bold">{{ formatCurrency(totals.gross) }}</span></div>
        <div class="flex flex-col"><span class="text-[8px] text-amber-400 uppercase font-sans">Deduction</span><span class="text-[11px] font-bold text-amber-400">{{ formatCurrency(totals.epf + totals.esic + totals.adv) }}</span></div>
        <div class="w-px h-4 bg-gray-700"></div>
        <div class="flex flex-col items-end"><span class="text-[8px] text-emerald-400 uppercase font-black font-sans">Net Payout</span><span class="text-sm font-black text-emerald-400 italic">{{ formatCurrency(totals.net) }}</span></div>
      </div>
    </div>

    <!-- Job Progress Banner -->
    <div v-if="isProcessingJob" class="bg-primary/10 border border-primary/30 p-3 rounded-lg flex items-center justify-between animate-pulse">
      <div class="flex items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary" />
        <div>
          <div class="text-xs font-bold text-primary">{{ jobStatusText }}</div>
          <div class="text-[10px] text-gray-500">Processed {{ processedWagesCount }} of {{ totalWagesCount }} records</div>
        </div>
      </div>
      <div class="w-48 bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
        <div class="bg-primary h-full transition-all duration-300" :style="{ width: `${jobProgress}%` }"></div>
      </div>
    </div>

    <!-- Main Table Container -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[2px]">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div class="overflow-auto h-full scrollbar-thin">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="sticky top-0 z-10 bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800">
            <tr>
              <th class="p-2 w-10 text-center">
                <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="rounded text-primary" />
              </th>
              <th class="p-2 w-52">Employee</th>
              <th class="p-2 w-20 text-right">Daily Rate</th>
              <th class="p-2 w-20 text-right">Wage Days</th>
              <th class="p-2 w-24 text-right">Gross Salary</th>
              <th class="p-2 w-20 text-right">EPF</th>
              <th class="p-2 w-20 text-right">ESIC</th>
              <th class="p-2 w-28 text-right text-rose-400">Adv. Deduction</th>
              <th class="p-2 w-24 text-right text-emerald-400">Net Salary</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800 font-mono">
            <tr v-for="emp in filteredEmployees" :key="emp.master_roll_id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td class="p-2 text-center">
                <input 
                  type="checkbox" 
                  :value="emp.master_roll_id" 
                  :checked="selectedEmployeeIds.has(emp.master_roll_id)" 
                  @change="(e: any) => e.target.checked ? selectedEmployeeIds.add(emp.master_roll_id) : selectedEmployeeIds.delete(emp.master_roll_id)" 
                  class="rounded text-primary" 
                />
              </td>
              <td class="p-2 font-sans">
                <div class="flex items-center gap-1.5">
                  <div class="font-bold text-gray-900 dark:text-gray-100 truncate">{{ emp.employee_name }}</div>
                  <!-- Outstanding Advance UI Indicator Badge -->
                  <span v-if="emp.advance_balance > 0" class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 shrink-0" :title="'Outstanding Advance Balance: ' + formatCurrency(emp.advance_balance)">
                    Adv: ₹{{ emp.advance_balance }}
                  </span>
                </div>
                <div class="text-[9px] text-gray-500 uppercase">{{ emp.project }} • {{ emp.site }}</div>
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="wageData[emp.master_roll_id].p_day_wage" @input="calculateEmployeeWages(emp.master_roll_id, wageData[emp.master_roll_id])" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="wageData[emp.master_roll_id].wage_days" @input="calculateEmployeeWages(emp.master_roll_id, wageData[emp.master_roll_id])" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded font-bold" />
              </td>
              <td class="p-2 text-right font-bold text-gray-900 dark:text-white">
                ₹{{ (wageData[emp.master_roll_id]?.gross_salary || 0).toLocaleString() }}
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="wageData[emp.master_roll_id].epf_deduction" @input="calculateEmployeeWages(emp.master_roll_id, wageData[emp.master_roll_id])" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" />
              </td>
              <td class="p-2 text-right">
                <input type="number" v-model.number="wageData[emp.master_roll_id].esic_deduction" @input="calculateEmployeeWages(emp.master_roll_id, wageData[emp.master_roll_id])" class="w-16 px-1 text-right bg-gray-50 dark:bg-gray-800 border rounded" />
              </td>
              <!-- Highlighted Advance Deduction Cell with Outstanding Balance Placeholder -->
              <td class="p-2 text-right" :class="{'bg-rose-50/30 dark:bg-rose-950/20': emp.advance_balance > 0}">
                <input 
                  type="number" 
                  v-model.number="wageData[emp.master_roll_id].advance_deduction" 
                  @input="calculateEmployeeWages(emp.master_roll_id, wageData[emp.master_roll_id])" 
                  class="w-20 px-1 text-right bg-gray-50 dark:bg-gray-800 border border-rose-200 dark:border-rose-800 rounded font-bold text-rose-600 focus:ring-1 focus:ring-rose-500 outline-none" 
                  :placeholder="emp.advance_balance ? 'Bal: ' + emp.advance_balance : '0'" 
                />
              </td>
              <td class="p-2 text-right font-black text-emerald-600 dark:text-emerald-400 text-xs">
                ₹{{ (wageData[emp.master_roll_id]?.net_salary || 0).toLocaleString() }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredEmployees.length === 0 && !loading" class="p-8 text-center text-gray-400 font-bold uppercase tracking-widest">
          No eligible staff found for this month.
        </div>
      </div>
    </div>

    <!-- Bottom Actions Bar -->
    <div class="bg-white dark:bg-gray-900 p-3 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
      <div class="text-xs font-bold text-gray-500">
        Selected: <span class="text-primary font-black">{{ selectedEmployeeIds.size }}</span> of {{ employees.length }} staff
      </div>
      <div class="flex items-center gap-2">
        <UButton color="success" icon="i-heroicons-check-circle" :disabled="selectedEmployeeIds.size === 0" :loading="loading || isProcessingJob" @click="handleSubmitBulkWages">
          Submit Selected Wages ({{ selectedEmployeeIds.size }})
        </UButton>
      </div>
    </div>
  </div>
</template>
