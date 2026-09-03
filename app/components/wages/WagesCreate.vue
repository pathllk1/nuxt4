<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useWages } from '~/composables/useWages'
import { wagePersistence } from '~/utils/wagePersistence'
import { calculateWBProfessionalTax } from '~/utils/taxCalculations'

const { loading, fetchEligibleEmployees, createWagesBulk, fetchBankAccounts, downloadBankReport, downloadEPFESICReport, exportWages } = useWages()
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
const sessionMetadata = ref<any>(null)



const commonPaymentData = ref({
  paid_date: '',
  cheque_no: '',
  payment_mode: '',
  bank_account_id: '',
  remarks: ''
})

const searchTerm = ref('')
const calculatePT = ref(false)
const filters = ref({
  project: 'all',
  site: 'all',
  bank: 'all'
})

// Persistence logic
let skipPersist = false

const persistState = () => {
  if (skipPersist) return
  
  wagePersistence.save('CREATE', {
    month: month.value,
    employees: employees.value,
    selectedEmployeeIds: Array.from(selectedEmployeeIds.value),
    wageData: wageData.value,
    commonPaymentData: commonPaymentData.value,
    filters: filters.value,
    calculatePT: calculatePT.value
  })
  updateMetadata()
}

watch([month, employees, selectedEmployeeIds, wageData, commonPaymentData, filters, calculatePT], () => {
  persistState()
}, { deep: true })

watch(calculatePT, () => {
  Object.keys(wageData.value).forEach(empId => {
    calculateEmployeeWages(empId)
  })
})

const updateMetadata = () => {
  sessionMetadata.value = wagePersistence.getMetadata('CREATE')
}

const restoreState = () => {
  const saved = wagePersistence.load('CREATE')
  if (saved) {
    month.value = saved.month || month.value
    employees.value = saved.employees || []
    selectedEmployeeIds.value = new Set(saved.selectedEmployeeIds || [])
    wageData.value = saved.wageData || {}
    commonPaymentData.value = saved.commonPaymentData || commonPaymentData.value
    filters.value = saved.filters || filters.value
    calculatePT.value = saved.calculatePT ?? false
    updateMetadata()
    return true
  }
  return false
}

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

const handleMonthChange = async () => {
  skipPersist = true
  wagePersistence.clear('CREATE')
  sessionMetadata.value = null
  selectedEmployeeIds.value.clear()
  employees.value = []
  wageData.value = {}
  setTimeout(() => { skipPersist = false }, 100)

  await loadEmployees()
}

watch(month, (newMonth, oldMonth) => {
  if (newMonth && newMonth !== oldMonth) {
    handleMonthChange()
  }
})

const loadData = async () => {
  try {
    const bankRes = await fetchBankAccounts()
    if (bankRes && bankRes.success) {
      bankAccounts.value = bankRes.data
    }
    
    restoreState()
    await loadEmployees()
  } catch (err: any) {
    toast.add({ title: 'Error loading initial data', description: err.message, color: 'error' })
  }
}

const loadEmployees = async () => {
  if (!month.value) return
  try {
    const response = await fetchEligibleEmployees(month.value)
    if (response && response.success) {
      const serverEligibleList: any[] = response.data || []
      const eligibleIdSet = new Set(serverEligibleList.map((e: any) => String(e.master_roll_id)))

      // Reconcile: Keep user modifications ONLY for employees who are STILL eligible (unpaid on server)
      const reconciledEmployees: any[] = []
      const reconciledData: Record<string, any> = {}
      const reconciledSelectedIds = new Set<string>()

      serverEligibleList.forEach((serverEmp: any) => {
        const empId = String(serverEmp.master_roll_id)
        reconciledEmployees.push(serverEmp)
        
        if (wageData.value[empId]) {
          reconciledData[empId] = wageData.value[empId]
        } else {
          reconciledData[empId] = {
            master_roll_id: serverEmp.master_roll_id,
            p_day_wage: serverEmp.last_p_day_wage || serverEmp.p_day_wage || 0,
            wage_days: serverEmp.last_wage_days || 26,
            gross_salary: 0,
            epf_deduction: 0,
            esic_deduction: 0,
            other_deduction: 0,
            other_benefit: 0,
            advance_deduction: 0,
            net_salary: 0
          }
          calculateEmployeeWages(empId, reconciledData[empId])
        }

        if (selectedEmployeeIds.value.has(empId)) {
          reconciledSelectedIds.add(empId)
        }
      })

      employees.value = reconciledEmployees
      wageData.value = reconciledData
      selectedEmployeeIds.value = reconciledSelectedIds

      if (reconciledEmployees.length === 0) {
        skipPersist = true
        wagePersistence.clear('CREATE')
        sessionMetadata.value = null
        setTimeout(() => { skipPersist = false }, 100)
      } else if (sessionMetadata.value) {
        updateMetadata()
      }
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading employees', description: err.message, color: 'error' })
  }
}

const calculateEmployeeWages = (empId: string, data?: any) => {
  const wage = data || wageData.value[empId]
  if (!wage) return

  const gross = parseFloat((wage.p_day_wage * wage.wage_days).toFixed(2))
  wage.gross_salary = gross
  
  // EPF: 12% of gross, max 1800
  wage.epf_deduction = Math.min(Math.round(gross * 0.12), 1800)
  
  // ESIC: 0.75% of gross, rounded up
  wage.esic_deduction = Math.ceil(gross * 0.0075)
  
  // Professional Tax (West Bengal Slab) -> mapped to other_deduction when toggle is enabled
  if (calculatePT.value) {
    wage.other_deduction = calculateWBProfessionalTax(gross)
  }

  updateNetSalary(empId, data)
}

const updateNetSalary = (empId: string, data?: any) => {
  const wage = data || wageData.value[empId]
  if (!wage) return

  const totalDeductions = (wage.epf_deduction || 0) + 
                         (wage.esic_deduction || 0) + 
                         (wage.other_deduction || 0) + 
                         (wage.advance_deduction || 0)
  
  wage.net_salary = parseFloat((wage.gross_salary - totalDeductions + (wage.other_benefit || 0)).toFixed(2))
}

const toggleSelectAll = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.checked) {
    filteredEmployees.value.forEach(emp => selectedEmployeeIds.value.add(emp.master_roll_id))
  } else {
    filteredEmployees.value.forEach(emp => selectedEmployeeIds.value.delete(emp.master_roll_id))
  }
}

const toggleEmployeeSelection = (id: string, event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.checked) {
    selectedEmployeeIds.value.add(id)
  } else {
    selectedEmployeeIds.value.delete(id)
  }
}

const isAllSelected = computed(() => {
  return filteredEmployees.value.length > 0 && 
         filteredEmployees.value.every(emp => selectedEmployeeIds.value.has(emp.master_roll_id))
})

const totals = computed(() => {
  let gross = 0, epf = 0, esic = 0, otherDed = 0, adv = 0, net = 0
  selectedEmployeeIds.value.forEach(id => {
    const w = wageData.value[id]
    if (w) {
      gross += w.gross_salary
      epf += w.epf_deduction
      esic += w.esic_deduction
      otherDed += (w.other_deduction || 0)
      adv += w.advance_deduction
      net += w.net_salary
    }
  })
  return { gross, epf, esic, otherDed, adv, net }
})

const finalizeSave = async () => {
  skipPersist = true
  wagePersistence.clear('CREATE')
  sessionMetadata.value = null
  
  commonPaymentData.value = {
    paid_date: '',
    cheque_no: '',
    payment_mode: '',
    bank_account_id: '',
    remarks: ''
  }
  
  await loadEmployees()
  
  setTimeout(() => { skipPersist = false }, 100)
}

const saveWages = async () => {
  if (selectedEmployeeIds.value.size === 0) return
  
  const wagesToSave = Array.from(selectedEmployeeIds.value).map(id => {
    const w = { ...wageData.value[id] }
    return {
      ...w,
      month: month.value,
      paid_date: commonPaymentData.value.paid_date,
      cheque_no: commonPaymentData.value.cheque_no,
      payment_mode: commonPaymentData.value.payment_mode,
      bank_account_id: commonPaymentData.value.bank_account_id,
      remarks: commonPaymentData.value.remarks
    }
  })

  try {
    const response = await createWagesBulk(month.value, wagesToSave)
    if (response.success) {
      toast.add({ title: 'Success', description: `Wages saved for ${wagesToSave.length} employees`, color: 'success' })
      await finalizeSave()
    }
  } catch (err: any) {
    toast.add({ title: 'Error saving wages', description: err.message, color: 'error' })
  }
}

const resetSession = async () => {
  if (confirm('Are you sure you want to clear all unsaved work and reset?')) {
    skipPersist = true
    wagePersistence.clear('CREATE')
    sessionMetadata.value = null
    
    commonPaymentData.value = {
      paid_date: '',
      cheque_no: '',
      payment_mode: '',
      bank_account_id: '',
      remarks: ''
    }
    
    await loadEmployees()
    toast.add({ title: 'Session Cleared', color: 'neutral' })
    
    setTimeout(() => { skipPersist = false }, 100)
  }
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
}

const onExportExcel = async () => {
  if (!month.value) return
  
  const employeesToExport = filteredEmployees.value.filter(emp => 
    selectedEmployeeIds.value.size > 0 ? selectedEmployeeIds.value.has(emp.master_roll_id) : true
  )

  if (employeesToExport.length === 0) {
    toast.add({ title: 'No employees to export', color: 'warning' })
    return
  }

  const exportData = employeesToExport.map(emp => {
    const wage = wageData.value[emp.master_roll_id] || {}
    return {
      employee_name: emp.employee_name,
      project: emp.project || '',
      site: emp.site || '',
      bank: emp.bank || '',
      account_no: emp.account_no || '',
      p_day_wage: Number(wage.p_day_wage ?? emp.p_day_wage ?? 0),
      wage_days: Number(wage.wage_days ?? 0),
      gross_salary: Number(wage.gross_salary ?? 0),
      epf_deduction: Number(wage.epf_deduction ?? 0),
      esic_deduction: Number(wage.esic_deduction ?? 0),
      other_deduction: Number(wage.other_deduction ?? 0),
      other_benefit: Number(wage.other_benefit ?? 0),
      advance_deduction: Number(wage.advance_deduction ?? 0),
      net_salary: Number(wage.net_salary ?? 0),
      date_of_joining: emp.date_of_joining || '',
      date_of_exit: emp.date_of_exit || ''
    }
  })

  try {
    await exportWages(month.value, exportData)
    toast.add({ title: 'Success', description: 'Export started', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Export failed', description: err.message, color: 'error' })
  }
}

const onExportBank = () => {
  if (!month.value) return
  if (!commonPaymentData.value.cheque_no) {
    toast.add({
      title: 'Cheque / Ref No Required',
      description: 'Please specify a Cheque / Ref No in payment details to export the Bank Report.',
      color: 'warning'
    })
    return
  }
  downloadBankReport(month.value, commonPaymentData.value.cheque_no, commonPaymentData.value.payment_mode || undefined)
}

const onExportEPF = () => {
  if (!month.value) return
  downloadEPFESICReport(month.value)
}

onMounted(() => {
  loadData()
})
</script>

<template>
  <div class="flex flex-col h-full gap-2 p-2 sm:p-0">
    <!-- Session Indicator -->
    <div v-if="sessionMetadata" class="bg-primary-50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900 px-3 py-2 rounded-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
      <div class="flex items-center gap-2 sm:gap-3">
        <div class="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded-md shrink-0">
          <UIcon name="i-heroicons-circle-stack" class="w-4 h-4 text-primary-600 dark:text-primary-400" />
        </div>
        <div class="flex flex-col overflow-hidden">
          <span class="text-[9px] sm:text-[10px] font-black text-primary-700 dark:text-primary-300 uppercase tracking-wider truncate">Active Session Restored</span>
          <span class="text-[8px] sm:text-[9px] text-primary-600/70 dark:text-primary-400/70 font-bold truncate">
            {{ sessionMetadata.selectedCount }} selected • {{ sessionMetadata.employeeCount }} staff • Saved {{ sessionMetadata.ageMinutes }}m ago
          </span>
        </div>
      </div>
      <UButton size="xs" variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="resetSession" class="shrink-0" />
    </div>

    <!-- Toolbar -->
    <div class="bg-white dark:bg-gray-900 p-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 shrink-0">
      <div class="flex flex-wrap items-center gap-2 sm:gap-3">
        <div class="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700">
          <label class="text-[9px] font-bold text-gray-500 uppercase">Month</label>
          <input type="month" v-model="month" @change="handleMonthChange" class="bg-transparent border-none text-xs font-bold focus:ring-0 p-0" />
        </div>
        <UButton size="xs" icon="i-heroicons-arrow-path" :loading="loading" @click="loadEmployees" class="flex-1 sm:flex-none">Load Staff</UButton>
        
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

        <!-- Total Unpaid Staff & Selected Employees Badge -->
        <div class="flex items-center gap-3 px-3 py-1 bg-gray-50 dark:bg-gray-800 rounded-md border border-gray-100 dark:border-gray-700">
          <div class="flex flex-col items-center">
            <span class="text-[8px] text-gray-400 uppercase font-black">Staff</span>
            <span class="text-xs font-black text-gray-700 dark:text-gray-200">{{ employees.length }}</span>
          </div>
          <div class="w-px h-4 bg-gray-200 dark:bg-gray-700"></div>
          <div class="flex flex-col items-center">
            <span class="text-[8px] text-primary-400 uppercase font-black">Selected</span>
            <span class="text-xs font-black text-primary-600 dark:text-primary-400">{{ selectedEmployeeIds.size }}</span>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UDropdownMenu :items="[[
          { label: 'Export Excel', icon: 'i-heroicons-table-cells', onSelect: onExportExcel },
          { label: 'Bank Report', icon: 'i-heroicons-building-library', onSelect: onExportBank },
          { label: 'EPF/ESIC Report', icon: 'i-heroicons-document-text', onSelect: onExportEPF }
        ]]" class="flex-1 sm:flex-none">
          <UButton size="xs" color="neutral" variant="outline" icon="i-heroicons-document-arrow-down" block>Export</UButton>
        </UDropdownMenu>

        <UButton v-if="employees.length > 0" size="xs" color="neutral" variant="ghost" icon="i-heroicons-trash" @click="resetSession" class="hidden sm:inline-flex">
          Clear
        </UButton>
        
        <div class="relative flex-1 sm:flex-none min-w-[120px]">
          <UIcon name="i-heroicons-magnifying-glass" class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
          <input type="text" v-model="searchTerm" placeholder="Search..." class="pl-7 pr-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs w-full focus:ring-1 focus:ring-primary-500 outline-none" />
        </div>

        <UButton size="xs" color="success" icon="i-heroicons-check-circle" :disabled="selectedEmployeeIds.size === 0" @click="saveWages" class="flex-1 sm:flex-none">
          Save ({{ selectedEmployeeIds.size }})
        </UButton>
      </div>
    </div>

    <!-- Filter & Totals Bar -->
    <div class="flex flex-col md:flex-row gap-2 shrink-0">
      <!-- Filter Bar -->
      <div class="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-2 rounded-lg flex flex-wrap items-center gap-3 flex-1 overflow-x-auto scrollbar-none">
        <div class="flex items-center gap-2 border-r border-indigo-100 dark:border-indigo-900 pr-2">
          <select v-model="filters.project" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none min-w-[90px]">
            <option v-for="p in uniqueProjects" :key="p" :value="p">{{ p === 'all' ? 'All Projects' : p }}</option>
          </select>
          <select v-model="filters.site" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none min-w-[90px]">
            <option v-for="s in uniqueSites" :key="s" :value="s">{{ s === 'all' ? 'All Sites' : s }}</option>
          </select>
          <select v-model="filters.bank" class="px-2 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none min-w-[90px]">
            <option v-for="b in uniqueBanks" :key="b" :value="b">{{ b === 'all' ? 'All Banks' : b }}</option>
          </select>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input type="date" v-model="commonPaymentData.paid_date" class="px-1 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none" title="Paid Date" />
          <select v-model="commonPaymentData.bank_account_id" class="px-1 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none max-w-[120px]">
            <option value="">Bank</option>
            <option v-for="bank in bankAccounts" :key="bank._id" :value="bank._id">{{ bank.bank_name }}</option>
          </select>
          <select v-model="commonPaymentData.payment_mode" class="px-1 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none">
            <option value="">Mode</option>
            <option v-for="m in ['CASH', 'NEFT', 'RTGS', 'UPI', 'CHEQUE']" :key="m" :value="m">{{ m }}</option>
          </select>
          <input type="text" v-model="commonPaymentData.cheque_no" placeholder="Ref/Cheque" class="px-1 py-1 bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 rounded text-[10px] font-bold outline-none w-20" />
        </div>
      </div>

      <!-- Totals Bar -->
      <div class="bg-gray-900 dark:bg-black p-2 rounded-lg text-white border border-gray-800 flex items-center justify-between md:justify-end gap-3 sm:gap-4 px-4 overflow-x-auto scrollbar-none">
        <div class="flex flex-col"><span class="text-[8px] text-gray-400 uppercase">Gross</span><span class="text-[11px] font-mono font-bold">{{ formatCurrency(totals.gross) }}</span></div>
        <div class="flex flex-col"><span class="text-[8px] text-amber-500 uppercase">Ded.</span><span class="text-[11px] font-mono font-bold text-amber-500">{{ formatCurrency(totals.epf + totals.esic + totals.otherDed + totals.adv) }}</span></div>
        <div class="w-px h-4 bg-gray-700 hidden sm:block"></div>
        <div class="flex flex-col items-end"><span class="text-[8px] text-emerald-500 uppercase font-black">Net Total</span><span class="text-sm font-mono font-black text-emerald-400 italic">{{ formatCurrency(totals.net) }}</span></div>
      </div>
    </div>

    <!-- Table / List View -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
      <!-- Standard Loading Overlay -->
      <div v-if="loading" class="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-gray-950/60 backdrop-blur-[2px]">
        <div class="flex flex-col items-center gap-4 bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800">
          <UIcon name="i-heroicons-arrow-path" class="w-10 h-10 animate-spin text-primary" />
          <p class="text-[10px] font-black uppercase tracking-widest text-primary animate-pulse">Processing Payroll</p>
        </div>
      </div>




      <!-- Mobile List View -->
      <div class="lg:hidden h-full overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800 p-2">
        <div v-for="emp in filteredEmployees" :key="emp.master_roll_id" 
             class="bg-white dark:bg-gray-900 mb-2 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
             :class="{'border-primary-200 dark:border-primary-800 ring-1 ring-primary-500/20 bg-primary-50/30': selectedEmployeeIds.has(emp.master_roll_id)}">
          <div class="p-3 flex items-start gap-3">
            <input type="checkbox" :value="emp.master_roll_id" :checked="selectedEmployeeIds.has(emp.master_roll_id)" @change="toggleEmployeeSelection(emp.master_roll_id, $event)" class="mt-1 rounded accent-primary w-4 h-4" />
            
            <div class="flex-1 min-w-0">
              <div class="flex justify-between items-start">
                <div class="truncate">
                  <h4 class="text-xs font-black text-gray-900 dark:text-gray-100 leading-none flex items-center gap-1.5 flex-wrap">
                    {{ emp.employee_name }}
                    <span v-if="emp.advance_balance > 0" class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 shrink-0">
                      Adv: ₹{{ emp.advance_balance }}
                    </span>
                  </h4>
                  <p class="text-[10px] text-gray-500 font-bold uppercase mt-1">{{ emp.project }} • {{ emp.site }}</p>
                </div>
                <div class="text-right">
                  <div class="text-xs font-black text-primary-600 dark:text-primary-400 font-mono italic">{{ formatCurrency(wageData[emp.master_roll_id]?.net_salary || 0) }}</div>
                  <div class="text-[9px] text-gray-400 uppercase font-black tracking-tighter">Net Payable</div>
                </div>
              </div>

              <!-- Compact Inputs -->
              <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 pt-3 border-t border-gray-50 dark:border-gray-800">
                <div class="flex flex-col gap-1">
                  <label class="text-[9px] font-black text-indigo-400 uppercase">Wage Rate</label>
                  <div class="flex items-center gap-1 bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded border border-gray-100 dark:border-gray-700">
                    <span class="text-[9px] text-gray-400 font-bold">₹</span>
                    <input type="number" v-model.number="wageData[emp.master_roll_id].p_day_wage" @input="calculateEmployeeWages(emp.master_roll_id)" class="w-full bg-transparent border-none text-[11px] font-black focus:ring-0 p-0" />
                  </div>
                </div>
                <div class="flex flex-col gap-1">
                  <label class="text-[9px] font-black text-indigo-400 uppercase">Paid Days</label>
                  <div class="flex items-center gap-1 bg-indigo-50/50 dark:bg-indigo-900/20 px-2 py-1 rounded border border-indigo-100 dark:border-indigo-900">
                    <UIcon name="i-heroicons-calendar" class="w-3 h-3 text-indigo-400" />
                    <input type="number" v-model.number="wageData[emp.master_roll_id].wage_days" @input="calculateEmployeeWages(emp.master_roll_id)" class="w-full bg-transparent border-none text-[11px] font-black text-indigo-600 dark:text-indigo-400 focus:ring-0 p-0" />
                  </div>
                </div>
              </div>

              <!-- Deductions Row -->
              <div class="mt-2 flex flex-wrap gap-2 pt-2 border-t border-dashed border-gray-100 dark:border-gray-800">
                <div class="flex flex-col gap-0.5">
                  <span class="text-[8px] text-amber-500 uppercase font-bold">EPF</span>
                  <input type="number" v-model.number="wageData[emp.master_roll_id].epf_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-12 bg-transparent border-none text-[10px] font-black text-amber-600 p-0 focus:ring-0" />
                </div>
                <div class="flex flex-col gap-0.5">
                  <span class="text-[8px] text-amber-500 uppercase font-bold">ESIC</span>
                  <input type="number" v-model.number="wageData[emp.master_roll_id].esic_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-12 bg-transparent border-none text-[10px] font-black text-amber-600 p-0 focus:ring-0" />
                </div>
                <div class="flex flex-col gap-0.5" :class="{'bg-rose-50/20 dark:bg-rose-950/10 px-1 rounded': emp.advance_balance > 0}">
                  <span class="text-[8px] text-rose-500 uppercase font-bold">Adv.</span>
                  <input type="number" v-model.number="wageData[emp.master_roll_id].advance_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-12 bg-transparent border-none text-[10px] font-black text-rose-600 p-0 focus:ring-0" :placeholder="emp.advance_balance ? 'Bal: ' + emp.advance_balance : '0'" />
                </div>
                <div class="ml-auto flex flex-col items-end gap-0.5">
                  <span class="text-[8px] text-gray-400 uppercase font-bold">Gross</span>
                  <span class="text-[10px] font-black font-mono">₹{{ Math.round(wageData[emp.master_roll_id]?.gross_salary || 0) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="filteredEmployees.length === 0" class="p-12 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest leading-loose">
          <UIcon name="i-heroicons-user-group" class="w-12 h-12 mb-4 mx-auto opacity-20" />
          No employees found<br/>Load staff to begin
        </div>
      </div>

      <!-- Desktop Table View -->
      <div class="hidden lg:block h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
        <table class="w-full text-left border-collapse table-fixed">
          <thead class="sticky top-0 z-10">
            <tr class="bg-gray-900 text-gray-400 text-[10px] font-bold uppercase tracking-wider border-b border-gray-800">
              <th class="p-2 w-8 text-center"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" class="rounded accent-primary" /></th>
              <th class="p-2 w-48">Employee</th>
              <th class="p-2 w-40">Bank / Account</th>
              <th class="p-2 w-16 text-center">Rate</th>
              <th class="p-2 w-12 text-center">Days</th>
              <th class="p-2 w-20 text-right">Gross</th>
              <th class="p-2 w-16 text-center">EPF</th>
              <th class="p-2 w-16 text-center">ESIC</th>
              <th class="p-2 w-16 text-center" :class="{'text-amber-400 font-bold': calculatePT}">{{ calculatePT ? 'PT / Other' : 'Other Ded' }}</th>
              <th class="p-2 w-16 text-center">Benefit</th>
              <th class="p-2 w-16 text-center text-rose-400">Advance</th>
              <th class="p-2 w-24 text-right bg-primary/10 text-primary-400 italic">Net Salary</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            <tr v-for="emp in filteredEmployees" :key="emp.master_roll_id" class="hover:bg-gray-50 dark:hover:bg-gray-800/50 group transition-colors" :class="{'bg-primary/5': selectedEmployeeIds.has(emp.master_roll_id)}">
              <td class="p-2 text-center border-r border-gray-50 dark:border-gray-800">
                <input type="checkbox" :value="emp.master_roll_id" :checked="selectedEmployeeIds.has(emp.master_roll_id)" @change="toggleEmployeeSelection(emp.master_roll_id, $event)" class="rounded accent-primary" />
              </td>
              <td class="p-2 border-r border-gray-50 dark:border-gray-800">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <div class="text-[11px] font-black text-gray-900 dark:text-gray-100 truncate">{{ emp.employee_name }}</div>
                  <span v-if="emp.advance_balance > 0" class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-black bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/50 shrink-0" :title="'Outstanding Advance: ' + formatCurrency(emp.advance_balance)">
                    Adv: ₹{{ emp.advance_balance }}
                  </span>
                </div>
                <div class="text-[9px] text-gray-500 uppercase font-black truncate opacity-60">{{ emp.project }} • {{ emp.site }}</div>
              </td>
              <td class="p-2 border-r border-gray-50 dark:border-gray-800">
                <div class="text-[10px] text-gray-600 dark:text-gray-400 truncate font-bold">{{ emp.bank }}</div>
                <div class="text-[9px] font-mono text-gray-400 truncate tracking-tighter">{{ emp.account_no }}</div>
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800">
                <input type="number" v-model.number="wageData[emp.master_roll_id].p_day_wage" @input="calculateEmployeeWages(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[11px] font-black focus:ring-0" />
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800">
                <input type="number" v-model.number="wageData[emp.master_roll_id].wage_days" @input="calculateEmployeeWages(emp.master_roll_id)" class="w-full bg-gray-50 dark:bg-gray-800 border-none rounded text-center text-[11px] font-black text-indigo-600 dark:text-indigo-400 focus:ring-0" />
              </td>
              <td class="p-2 text-right border-r border-gray-50 dark:border-gray-800 text-[11px] font-black font-mono">
                {{ Math.round(wageData[emp.master_roll_id]?.gross_salary || 0) }}
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800">
                <input type="number" v-model.number="wageData[emp.master_roll_id].epf_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[10px] font-black text-amber-600 focus:ring-0" />
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800">
                <input type="number" v-model.number="wageData[emp.master_roll_id].esic_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[10px] font-black text-amber-600 focus:ring-0" />
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800" :class="{'bg-amber-500/10 dark:bg-amber-500/20': calculatePT}">
                <input type="number" v-model.number="wageData[emp.master_roll_id].other_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[10px] font-black focus:ring-0" :class="calculatePT ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-orange-600'" :placeholder="calculatePT ? 'PT' : '0'" />
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800">
                <input type="number" v-model.number="wageData[emp.master_roll_id].other_benefit" @input="updateNetSalary(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[10px] font-black text-emerald-600 focus:ring-0" />
              </td>
              <td class="p-1 border-r border-gray-50 dark:border-gray-800" :class="{'bg-rose-50/20 dark:bg-rose-950/10': emp.advance_balance > 0}">
                <input type="number" v-model.number="wageData[emp.master_roll_id].advance_deduction" @input="updateNetSalary(emp.master_roll_id)" class="w-full bg-transparent border-none text-center text-[10px] font-black text-rose-600 focus:ring-0" :placeholder="emp.advance_balance ? 'Bal: ' + emp.advance_balance : '0'" />
              </td>
              <td class="p-2 text-right bg-primary/5 font-black text-primary-600 dark:text-primary-400 font-mono text-[12px] italic">
                {{ Math.round(wageData[emp.master_roll_id]?.net_salary || 0) }}
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredEmployees.length === 0" class="p-12 text-center text-gray-400 text-[10px] font-black uppercase tracking-widest leading-loose">
          <UIcon name="i-heroicons-user-group" class="w-12 h-12 mb-4 mx-auto opacity-20" />
          No employees found<br/>Load staff for the selected month
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Hide spin buttons for number inputs */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
}
</style>
