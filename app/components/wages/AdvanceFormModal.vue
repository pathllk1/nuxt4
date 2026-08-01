<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { useAdvances } from '~/composables/useAdvances'

const props = defineProps<{
  employee?: any
}>()

const emit = defineEmits(['close', 'saved'])

const { loading, recordAdvance, fetchBankAccounts, fetchEligibleEmployees, fetchAllEmployeeBalances } = useAdvances()
const toast = useToast()

const bankAccounts = ref<any[]>([])
const employees = ref<any[]>([])

const form = reactive({
  master_roll_id: props.employee?.master_roll_id || props.employee?._id || '',
  amount: 0,
  type: 'ADVANCE' as 'ADVANCE' | 'RECOVERY',
  date: new Date().toISOString().slice(0, 10),
  payment_mode: 'CASH',
  bank_account_id: '',
  cheque_no: '',
  remarks: ''
})

const isDropdownOpen = ref(false)
const searchTerm = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)

const employeeBalances = ref<any[]>([])
const balanceSearchTerm = ref('')

const filteredEmployeeBalances = computed(() => {
  const query = balanceSearchTerm.value.toLowerCase().trim()
  if (!query) return employeeBalances.value
  return employeeBalances.value.filter(b => 
    (b.employee_name && b.employee_name.toLowerCase().includes(query)) ||
    (b.project && b.project.toLowerCase().includes(query)) ||
    (b.site && b.site.toLowerCase().includes(query))
  )
})

const sortedEmployees = computed(() => {
  return [...employees.value].sort((a, b) => {
    return (a.employee_name || '').localeCompare(b.employee_name || '')
  })
})

const filteredEmployees = computed(() => {
  const query = searchTerm.value.toLowerCase().trim()
  if (!query) return sortedEmployees.value
  return sortedEmployees.value.filter(emp => {
    return (
      (emp.employee_name && emp.employee_name.toLowerCase().includes(query)) ||
      (emp.project && emp.project.toLowerCase().includes(query)) ||
      (emp.site && emp.site.toLowerCase().includes(query))
    )
  })
})

const selectedEmployeeName = computed(() => {
  if (props.employee) return props.employee.employee_name
  const emp = employees.value.find(e => e._id === form.master_roll_id)
  return emp ? `${emp.employee_name} (${emp.project || 'No Project'})` : ''
})

const selectEmployee = (emp: any) => {
  form.master_roll_id = emp._id
  isDropdownOpen.value = false
  searchTerm.value = ''
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isDropdownOpen.value = false
  }
}

watch(isDropdownOpen, (val) => {
  if (val) {
    document.addEventListener('click', handleClickOutside)
    setTimeout(() => {
      searchInputRef.value?.focus()
    }, 50)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

const loadInitialData = async () => {
  try {
    const [bankRes, empRes, balRes] = await Promise.all([
      fetchBankAccounts(),
      fetchEligibleEmployees(),
      fetchAllEmployeeBalances()
    ])
    if (bankRes && bankRes.success) bankAccounts.value = bankRes.data
    if (empRes && empRes.success) employees.value = Array.isArray(empRes.data) ? empRes.data : (empRes.data?.data || [])
    if (balRes && balRes.success) employeeBalances.value = Array.isArray(balRes.data) ? balRes.data : (balRes.data?.data || [])
  } catch (err: any) {
    console.error('Failed to load modal data', err)
  }
}

const handleSubmit = async () => {
  if (!form.master_roll_id) {
    toast.add({ title: 'Validation Error', description: 'Please select an employee', color: 'error' })
    return
  }
  if (!form.amount || form.amount <= 0) {
    toast.add({ title: 'Validation Error', description: 'Amount must be greater than 0', color: 'error' })
    return
  }
  if (form.payment_mode === 'BANK' && !form.bank_account_id) {
    toast.add({ title: 'Validation Error', description: 'Bank account is required for Bank payment mode', color: 'error' })
    return
  }

  try {
    const res = await recordAdvance({
      master_roll_id: form.master_roll_id,
      amount: form.amount,
      type: form.type,
      date: form.date,
      payment_mode: form.payment_mode,
      bank_account_id: form.payment_mode === 'BANK' ? form.bank_account_id : undefined,
      cheque_no: form.cheque_no || undefined,
      remarks: form.remarks || undefined
    })

    if (res && res._id) {
      toast.add({ title: 'Success', description: 'Transaction recorded successfully', color: 'success' })
      emit('saved')
      emit('close')
    } else {
      toast.add({ title: 'Error', description: res?.message || 'Failed to record transaction', color: 'error' })
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Transaction failed', color: 'error' })
  }
}

onMounted(() => {
  loadInitialData()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-[850px] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 shrink-0">
        <h3 class="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Record Advance / Recovery</h3>
        <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="emit('close')" />
      </div>

      <div class="flex-1 overflow-auto flex flex-col md:flex-row min-h-0">
        <!-- Form Container -->
        <form @submit.prevent="handleSubmit" class="p-6 space-y-4 flex-1 overflow-auto">
          <!-- Type Selection -->
          <div class="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <button
              type="button"
              class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200"
              :class="form.type === 'ADVANCE' ? 'bg-rose-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              @click="form.type = 'ADVANCE'"
            >
              Give Advance (Debit)
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 text-xs font-bold rounded-md transition-all duration-200"
              :class="form.type === 'RECOVERY' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              @click="form.type = 'RECOVERY'"
            >
              Receive Repayment (Credit)
            </button>
          </div>

          <!-- Employee Select -->
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-gray-400">Employee *</label>
            <div v-if="props.employee" class="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-bold border border-gray-200 dark:border-gray-700">
              {{ props.employee.employee_name }}
            </div>
            <div v-else class="relative" ref="dropdownRef">
              <div 
                @click="isDropdownOpen = !isDropdownOpen"
                class="p-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold cursor-pointer flex items-center justify-between hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
              >
                <span :class="selectedEmployeeName ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'">
                  {{ selectedEmployeeName || 'Select Employee...' }}
                </span>
                <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 text-gray-400 transition-transform" :class="isDropdownOpen ? 'rotate-180' : ''" />
              </div>

              <!-- Dropdown Menu -->
              <div 
                v-if="isDropdownOpen" 
                class="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col max-h-60"
              >
                <div class="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <input
                    ref="searchInputRef"
                    type="text"
                    v-model="searchTerm"
                    placeholder="Type to search staff..."
                    class="w-full px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none focus:border-primary"
                    @click.stop
                  />
                </div>
                <div class="overflow-y-auto flex-1 p-1 scrollbar-thin">
                  <div
                    v-for="emp in filteredEmployees"
                    :key="emp._id"
                    @click="selectEmployee(emp)"
                    class="px-3 py-2 text-xs rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-between transition-colors"
                    :class="form.master_roll_id === emp._id ? 'bg-primary/10 text-primary font-bold' : 'text-gray-700 dark:text-gray-300'"
                  >
                    <div>
                      <span class="font-bold">{{ emp.employee_name }}</span>
                      <span class="text-[10px] text-gray-400 ml-2">({{ emp.project || 'No Project' }})</span>
                    </div>
                    <UIcon v-if="form.master_roll_id === emp._id" name="i-heroicons-check" class="w-4 h-4 text-primary" />
                  </div>
                  <div v-if="filteredEmployees.length === 0" class="p-4 text-center text-xs text-gray-400">
                    No employees found
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Amount and Date -->
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-black uppercase text-gray-400">Amount (₹) *</label>
              <input type="number" v-model.number="form.amount" min="1" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold font-mono" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black uppercase text-gray-400">Transaction Date *</label>
              <input type="date" v-model="form.date" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold" />
            </div>
          </div>

          <!-- Payment Mode -->
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-gray-400">Payment Mode</label>
            <div class="flex gap-4">
              <label class="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input type="radio" v-model="form.payment_mode" value="CASH" class="text-primary" /> Cash
              </label>
              <label class="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input type="radio" v-model="form.payment_mode" value="BANK" class="text-primary" /> Bank Transfer
              </label>
            </div>
          </div>

          <!-- Bank Selection -->
          <div v-if="form.payment_mode === 'BANK'" class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-black uppercase text-gray-400">Bank Account *</label>
              <select v-model="form.bank_account_id" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold">
                <option value="" disabled>Select Bank Account</option>
                <option v-for="b in bankAccounts" :key="b._id" :value="b._id">
                  {{ b.bank_name }} - {{ b.account_number }}
                </option>
              </select>
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black uppercase text-gray-400">Cheque / Ref No.</label>
              <input type="text" v-model="form.cheque_no" placeholder="Txn Ref #" class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs font-bold" />
            </div>
          </div>

          <!-- Remarks -->
          <div class="space-y-1">
            <label class="text-[10px] font-black uppercase text-gray-400">Remarks</label>
            <input type="text" v-model="form.remarks" placeholder="Optional notes..." class="w-full p-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs" />
          </div>

          <!-- Action Buttons -->
          <div class="pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="emit('close')">Cancel</UButton>
            <UButton type="submit" color="primary" :loading="loading">Save Transaction</UButton>
          </div>
        </form>

        <!-- Right Side: Live Balances Panel -->
        <div v-if="!props.employee" class="w-full md:w-72 bg-gray-50 dark:bg-gray-900/50 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 p-4 flex flex-col shrink-0">
          <h4 class="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-2">Live Staff Balances</h4>
          <input
            type="text"
            v-model="balanceSearchTerm"
            placeholder="Filter staff list..."
            class="w-full px-2.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs mb-2"
          />
          <div class="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin max-h-60 md:max-h-none">
            <div
              v-for="b in filteredEmployeeBalances"
              :key="b.master_roll_id"
              @click="form.master_roll_id = b.master_roll_id"
              class="p-2 rounded-lg border text-xs cursor-pointer transition-all duration-150 flex justify-between items-center"
              :class="form.master_roll_id === b.master_roll_id
                ? 'bg-primary/10 border-primary shadow-xs'
                : 'bg-white dark:bg-gray-800 border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300'"
            >
              <div class="truncate mr-2">
                <div class="font-bold text-gray-900 dark:text-gray-100 truncate">{{ b.employee_name }}</div>
                <div class="text-[9px] text-gray-400 truncate">{{ b.project || 'No Project' }}</div>
              </div>
              <div class="text-right shrink-0 font-mono font-bold" :class="b.balance > 0 ? 'text-rose-500' : 'text-emerald-500'">
                ₹{{ (b.balance || 0).toLocaleString() }}
              </div>
            </div>
            <div v-if="filteredEmployeeBalances.length === 0" class="text-center py-4 text-[10px] text-gray-400 uppercase font-bold">
              No balances found
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
