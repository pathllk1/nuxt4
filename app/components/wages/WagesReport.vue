<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useWages } from '~/composables/useWages'

const { 
  loading, 
  fetchWagesByMonth, 
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

const availableChequeNos = computed(() => {
  const set = new Set<string>(serverChequeNos.value)
  reportWages.value.forEach(w => {
    if (w.cheque_no) set.add(w.cheque_no)
  })
  return Array.from(set).filter(Boolean).sort()
})

const filteredWages = computed(() => {
  let result = reportWages.value
  if (paymentModeFilter.value !== 'all') {
    result = result.filter(w => (w.payment_mode || 'CASH') === paymentModeFilter.value)
  }
  if (chequeNoFilter.value && chequeNoFilter.value !== 'all') {
    result = result.filter(w => w.cheque_no === chequeNoFilter.value)
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
    t.esic_er += Math.ceil((w.gross_salary || 0) * 0.0325)
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
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading report', description: err.message, color: 'error' })
  }
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)
}

const onDownloadWagesExcel = () => exportWages(month.value, filteredWages.value)
const onDownloadBankReport = () => downloadBankReport(
  month.value, 
  chequeNoFilter.value !== 'all' ? chequeNoFilter.value : undefined,
  paymentModeFilter.value !== 'all' ? paymentModeFilter.value : undefined
)
const onDownloadEPFESICReport = () => downloadEPFESICReport(month.value)
const onDownloadAllSlips = () => downloadBulkWageSlips(month.value)
const onDownloadSlip = (wage: any) => downloadWageSlip(wage._id, wage.master_roll_id?.employee_name || 'Employee')

onMounted(() => {
  loadReport()
})
</script>

<template>
  <div class="flex flex-col h-full gap-4">
    <!-- Filters & Actions -->
    <div class="bg-white dark:bg-gray-900 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-end justify-between shrink-0 flex-wrap gap-4">
      <div class="flex flex-wrap items-center gap-4">
        <!-- Month Picker -->
        <div class="flex flex-col gap-1.5 min-w-[150px]">
          <label class="text-xs font-bold text-gray-500 uppercase">Select Month</label>
          <input type="month" v-model="month" @change="loadReport" class="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium outline-none bg-gray-50 dark:bg-gray-800" />
        </div>

        <!-- Payment Mode Dropdown -->
        <div class="flex flex-col gap-1.5 min-w-[150px]">
          <label class="text-xs font-bold text-gray-500 uppercase">Payment Mode</label>
          <select v-model="paymentModeFilter" class="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium outline-none bg-gray-50 dark:bg-gray-800">
            <option value="all">All Modes</option>
            <option value="CASH">CASH</option>
            <option value="CHEQUE">CHEQUE</option>
            <option value="NEFT">NEFT</option>
            <option value="RTGS">RTGS</option>
            <option value="IMPS">IMPS</option>
            <option value="UPI">UPI</option>
          </select>
        </div>

        <!-- Cheque / Ref No Dropdown (Server Fetched) -->
        <div class="flex flex-col gap-1.5 min-w-[170px]">
          <label class="text-xs font-bold text-gray-500 uppercase">Cheque / Ref No</label>
          <select v-model="chequeNoFilter" class="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium outline-none bg-gray-50 dark:bg-gray-800">
            <option value="all">All Ref Nos</option>
            <option v-for="no in availableChequeNos" :key="no" :value="no">{{ no }}</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <UButton color="success" icon="i-heroicons-arrow-up-tray" @click="onDownloadWagesExcel">
          Export Wages Excel
        </UButton>
        <UButton color="primary" icon="i-heroicons-building-library" @click="onDownloadBankReport">
          Bank Payout Report
        </UButton>
        <UButton color="neutral" icon="i-heroicons-document-text" @click="onDownloadEPFESICReport">
          EPF & ESIC Report
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-heroicons-folder-arrow-down" @click="onDownloadAllSlips">
          All Slips (ZIP)
        </UButton>
      </div>
    </div>

    <!-- Summary KPI Cards -->
    <div class="grid grid-cols-2 md:grid-cols-7 gap-3 shrink-0">
      <div class="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
        <div class="text-[10px] font-bold text-gray-500 uppercase">Count</div>
        <div class="text-lg font-black">{{ filteredWages.length }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
        <div class="text-[10px] font-bold text-gray-500 uppercase">Gross</div>
        <div class="text-lg font-black font-mono text-gray-900 dark:text-gray-100">{{ formatCurrency(totals.gross) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
        <div class="text-[10px] font-bold text-amber-600 uppercase">EPF (E)</div>
        <div class="text-lg font-black font-mono text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.epf_e) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
        <div class="text-[10px] font-bold text-amber-600 uppercase">ESIC (E)</div>
        <div class="text-lg font-black font-mono text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.esic_e) }}</div>
      </div>
      <div class="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900 shadow-sm">
        <div class="text-[10px] font-bold text-indigo-600 uppercase">Total (ER)</div>
        <div class="text-lg font-black font-mono text-indigo-700 dark:text-indigo-300">{{ formatCurrency(totals.epf_er + totals.esic_er) }}</div>
      </div>
      <div class="bg-white dark:bg-gray-900 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-sm">
        <div class="text-[10px] font-bold text-rose-500 uppercase">Advance</div>
        <div class="text-lg font-black font-mono text-rose-600 dark:text-rose-400">{{ formatCurrency(totals.adv) }}</div>
      </div>
      <div class="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900 shadow-sm">
        <div class="text-[10px] font-bold text-emerald-600 uppercase">Net Pay</div>
        <div class="text-lg font-black font-mono text-emerald-700 dark:text-emerald-400">{{ formatCurrency(totals.net) }}</div>
      </div>
    </div>

    <!-- Main Table -->
    <div class="flex-1 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden min-h-0 relative">
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
              <td colspan="4" class="p-3 text-right uppercase font-sans">Total Summary:</td>
              <td class="p-3 text-right">{{ formatCurrency(totals.gross) }}</td>
              <td class="p-3 text-right text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.epf_e) }}</td>
              <td class="p-3 text-right text-amber-700 dark:text-amber-400">{{ formatCurrency(totals.esic_e) }}</td>
              <td class="p-3 text-right text-rose-600 dark:text-rose-400">{{ formatCurrency(totals.adv) }}</td>
              <td class="p-3 text-right text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 italic">{{ formatCurrency(totals.net) }}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div v-if="filteredWages.length === 0 && !loading" class="p-8 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
          No records found matching filters for {{ month }}.
        </div>
      </div>
    </div>
  </div>
</template>
