<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useAuth } from '~/composables/useAuth'
import { useWages } from '~/composables/useWages'
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController } from 'chart.js'
import WagesSummaryModal from '~/components/master-roll/WagesSummaryModal.vue'

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ArcElement, DoughnutController)

const { apiFetch } = useAuth()
const { downloadWageSlip, downloadBulkWageSlips } = useWages()
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
const currentMonthWages = ref<any[]>([])
const previousMonthWages = ref<any[]>([])
const trendData = ref<{ month: string; gross: number; net: number }[]>([])

let barChart: Chart | null = null
let doughnutChart: Chart | null = null
const barChartRef = ref<HTMLCanvasElement | null>(null)
const doughnutChartRef = ref<HTMLCanvasElement | null>(null)
const dashboardLoading = ref(false)

const selectedEmployeeForModal = ref<any>(null)
const showHistoryModal = ref(false)

// Helpers
const getPrevMonth = (m: string) => {
  const parts = m.split('-').map(Number)
  const y = parts[0] || 0
  const mo = parts[1] || 1
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const getLast6Months = (m: string) => {
  const months: string[] = []
  const parts = m.split('-').map(Number)
  const y = parts[0] || 0
  const mo = parts[1] || 1
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, mo - 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val || 0)

const formatCompact = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`
  return `₹${val || 0}`
}

const monthLabel = (m: string) => {
  const parts = m.split('-')
  const y = parts[0] || ''
  const mo = parts[1] || '01'
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[parseInt(mo) - 1] || ''} ${y.slice(2)}`
}

// KPI computations
const currentTotals = computed(() => {
  const w = currentMonthWages.value
  return {
    count: w.length,
    gross: w.reduce((s, x) => s + (x.gross_salary || 0), 0),
    epf: w.reduce((s, x) => s + (x.epf_deduction || 0), 0),
    esic: w.reduce((s, x) => s + (x.esic_deduction || 0), 0),
    otherDed: w.reduce((s, x) => s + (x.other_deduction || 0), 0),
    otherBen: w.reduce((s, x) => s + (x.other_benefit || 0), 0),
    advance: w.reduce((s, x) => s + (x.advance_deduction || 0), 0),
    net: w.reduce((s, x) => s + (x.net_salary || 0), 0),
  }
})

const previousTotals = computed(() => {
  const w = previousMonthWages.value
  return {
    count: w.length,
    gross: w.reduce((s, x) => s + (x.gross_salary || 0), 0),
    net: w.reduce((s, x) => s + (x.net_salary || 0), 0),
    epf: w.reduce((s, x) => s + (x.epf_deduction || 0), 0),
    esic: w.reduce((s, x) => s + (x.esic_deduction || 0), 0),
    advance: w.reduce((s, x) => s + (x.advance_deduction || 0), 0),
  }
})

const totalDeductions = computed(() =>
  currentTotals.value.epf + currentTotals.value.esic + currentTotals.value.otherDed + currentTotals.value.advance
)

const employerStatutory = computed(() => {
  const w = currentMonthWages.value
  const erEpf = w.reduce((s, x) => s + (x.epf_deduction || 0), 0)
  const erEsic = w.reduce((s, x) => s + Math.ceil((x.gross_salary || 0) * 0.0325), 0)
  return erEpf + erEsic
})

const prevEmployerStatutory = computed(() => {
  const w = previousMonthWages.value
  const erEpf = w.reduce((s, x) => s + (x.epf_deduction || 0), 0)
  const erEsic = w.reduce((s, x) => s + Math.ceil((x.gross_salary || 0) * 0.0325), 0)
  return erEpf + erEsic
})

const prevTotalDeductions = computed(() =>
  previousTotals.value.epf + previousTotals.value.esic + previousTotals.value.advance
)

const delta = (curr: number, prev: number) => {
  if (prev === 0) return curr > 0 ? 100 : 0
  return ((curr - prev) / prev) * 100
}

// Breakdowns
const projectBreakdown = computed(() => {
  const map: Record<string, { gross: number; net: number; count: number }> = {}
  currentMonthWages.value.forEach(w => {
    const p = w.master_roll_id?.project || w.project || 'Unassigned'
    if (!map[p]) map[p] = { gross: 0, net: 0, count: 0 }
    map[p].gross += w.gross_salary || 0
    map[p].net += w.net_salary || 0
    map[p].count++
  })
  return Object.entries(map)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.gross - a.gross)
})

const siteBreakdown = computed(() => {
  const map: Record<string, { gross: number; net: number; count: number }> = {}
  currentMonthWages.value.forEach(w => {
    const s = w.master_roll_id?.site || w.site || 'Unassigned'
    if (!map[s]) map[s] = { gross: 0, net: 0, count: 0 }
    map[s].gross += w.gross_salary || 0
    map[s].net += w.net_salary || 0
    map[s].count++
  })
  return Object.entries(map)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.gross - a.gross)
})

const paymentModeBreakdown = computed(() => {
  const map: Record<string, { amount: number; count: number }> = {}
  currentMonthWages.value.forEach(w => {
    const mode = w.payment_mode || 'BANK'
    if (!map[mode]) map[mode] = { amount: 0, count: 0 }
    map[mode].amount += w.net_salary || 0
    map[mode].count++
  })
  return Object.entries(map)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.amount - a.amount)
})

const topEarners = computed(() => {
  return [...currentMonthWages.value]
    .sort((a, b) => (b.net_salary || 0) - (a.net_salary || 0))
    .slice(0, 5)
})

const recentActivity = computed(() => {
  return [...currentMonthWages.value]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
})

// Data fetching
const loadDashboard = async () => {
  dashboardLoading.value = true
  try {
    const [currRes, prevRes] = await Promise.all([
      apiFetch<{ success: boolean; data: any[] }>(`/api/wages/month?month=${month.value}`),
      apiFetch<{ success: boolean; data: any[] }>(`/api/wages/month?month=${getPrevMonth(month.value)}`)
    ])
    currentMonthWages.value = currRes.success ? currRes.data : []
    previousMonthWages.value = prevRes.success ? prevRes.data : []

    // Fetch 6-month trend
    const months = getLast6Months(month.value)
    const results = await Promise.all(months.map(m => apiFetch<{ success: boolean; data: any[] }>(`/api/wages/month?month=${m}`)))
    trendData.value = months.map((m, i) => {
      const data = results[i]?.success ? results[i].data : []
      return {
        month: m,
        gross: data.reduce((s: number, w: any) => s + (w.gross_salary || 0), 0),
        net: data.reduce((s: number, w: any) => s + (w.net_salary || 0), 0),
      }
    })

    await nextTick()
    renderBarChart()
    renderDoughnutChart()
  } catch (err: any) {
    toast.add({ title: 'Error loading dashboard', description: err.message, color: 'error' })
  } finally {
    dashboardLoading.value = false
  }
}

// Charts
const renderBarChart = () => {
  if (!barChartRef.value) return
  if (barChart) barChart.destroy()

  const ctx = barChartRef.value.getContext('2d')
  if (!ctx) return

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: trendData.value.map(d => monthLabel(d.month)),
      datasets: [
        {
          label: 'Gross Salary',
          data: trendData.value.map(d => d.gross),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        },
        {
          label: 'Net Salary',
          data: trendData.value.map(d => d.net),
          backgroundColor: 'rgba(16, 185, 129, 0.7)',
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 1,
          borderRadius: 6,
          barPercentage: 0.6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            usePointStyle: true,
            pointStyle: 'rectRounded',
            font: { size: 10, weight: 'bold' },
            padding: 16,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10, weight: 'bold' } }
        },
        y: {
          grid: { color: 'rgba(148, 163, 184, 0.08)' },
          ticks: {
            font: { size: 9 },
            callback: (val: any) => formatCompact(val)
          }
        }
      }
    }
  })
}

const doughnutColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

const renderDoughnutChart = () => {
  if (!doughnutChartRef.value) return
  if (doughnutChart) doughnutChart.destroy()

  const ctx = doughnutChartRef.value.getContext('2d')
  if (!ctx) return

  const data = paymentModeBreakdown.value

  doughnutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d.name),
      datasets: [{
        data: data.map(d => d.amount),
        backgroundColor: doughnutColors.slice(0, data.length),
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            font: { size: 9, weight: 'bold' },
            padding: 12,
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 10 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx: any) => {
              const sum = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0)
              const percentage = sum > 0 ? Math.round(ctx.raw / sum * 100) : 0
              return ` ${ctx.label}: ${formatCurrency(ctx.raw)} (${percentage}%)`
            }
          }
        }
      }
    }
  })
}

const onDownloadBulkWageSlips = async () => {
  try {
    await downloadBulkWageSlips(month.value)
    toast.add({ title: 'Success', description: 'Bulk wage slips ZIP download started', color: 'success' })
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Bulk download failed', color: 'error' })
  }
}

const openHistoryModal = (wage: any) => {
  if (wage.master_roll_id) {
    selectedEmployeeForModal.value = typeof wage.master_roll_id === 'object' ? wage.master_roll_id : { _id: wage.master_roll_id, employee_name: 'Employee' }
    showHistoryModal.value = true
  }
}

onMounted(() => {
  loadDashboard()
})

watch(month, () => {
  loadDashboard()
})

const formatDate = (d: string) => {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="flex flex-col h-full gap-3 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800 pr-1">
    <!-- Header -->
    <div class="flex items-center justify-between shrink-0">
      <div>
        <h2 class="text-lg font-black text-gray-900 dark:text-gray-100 tracking-tight">Payroll Dashboard</h2>
        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Workforce Analytics & Insights</p>
      </div>
      <div class="flex items-center gap-3">
        <UButton size="xs" variant="outline" icon="i-heroicons-arrow-down-tray" @click="onDownloadBulkWageSlips">
          Download All Slips (ZIP)
        </UButton>
        <div class="flex items-center gap-2 bg-white dark:bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
          <UIcon name="i-heroicons-calendar" class="w-3.5 h-3.5 text-primary" />
          <input type="month" v-model="month" class="bg-transparent border-none text-xs font-bold focus:ring-0 p-0 outline-none" />
        </div>
        <UButton size="xs" icon="i-heroicons-arrow-path" :loading="dashboardLoading" variant="ghost" color="neutral" @click="loadDashboard" />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="dashboardLoading && currentMonthWages.length === 0" class="flex-1 flex items-center justify-center py-12">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
        <span class="text-[10px] font-black uppercase tracking-widest text-gray-400 animate-pulse">Loading Analytics</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else-if="currentMonthWages.length === 0 && !dashboardLoading" class="flex-1 flex items-center justify-center py-12">
      <div class="text-center">
        <UIcon name="i-heroicons-chart-bar" class="w-16 h-16 mx-auto text-gray-200 dark:text-gray-800 mb-4" />
        <h3 class="text-sm font-black text-gray-400 uppercase tracking-wider">No Payroll Data</h3>
        <p class="text-[10px] text-gray-400 mt-1">Select a month with posted wages to see analytics</p>
      </div>
    </div>

    <template v-else>
      <!-- KPI Hero Cards -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 shrink-0">
        <!-- Employees -->
        <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-indigo-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Employees</div>
          <div class="text-xl font-black text-gray-900 dark:text-gray-100 mt-1 font-mono">{{ currentTotals.count }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(currentTotals.count, previousTotals.count) >= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(currentTotals.count, previousTotals.count) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(currentTotals.count, previousTotals.count)).toFixed(0) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>

        <!-- Gross -->
        <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-slate-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Gross Salary</div>
          <div class="text-xl font-black text-gray-900 dark:text-gray-100 mt-1 font-mono">{{ formatCompact(currentTotals.gross) }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(currentTotals.gross, previousTotals.gross) >= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(currentTotals.gross, previousTotals.gross) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(currentTotals.gross, previousTotals.gross)).toFixed(1) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>

        <!-- Deductions -->
        <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-amber-100 dark:border-amber-900/30 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-amber-600 uppercase tracking-widest">Deductions</div>
          <div class="text-xl font-black text-amber-700 dark:text-amber-400 mt-1 font-mono">{{ formatCompact(totalDeductions) }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(totalDeductions, prevTotalDeductions) <= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(totalDeductions, prevTotalDeductions) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(totalDeductions, prevTotalDeductions)).toFixed(1) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>

        <!-- Net Payable -->
        <div class="relative overflow-hidden bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/30 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Net Payable</div>
          <div class="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">{{ formatCompact(currentTotals.net) }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(currentTotals.net, previousTotals.net) >= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(currentTotals.net, previousTotals.net) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(currentTotals.net, previousTotals.net)).toFixed(1) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>

        <!-- Employer Statutory -->
        <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-violet-100 dark:border-violet-900/30 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-violet-600 uppercase tracking-widest">Employer (ER)</div>
          <div class="text-xl font-black text-violet-700 dark:text-violet-400 mt-1 font-mono">{{ formatCompact(employerStatutory) }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(employerStatutory, prevEmployerStatutory) <= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(employerStatutory, prevEmployerStatutory) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(employerStatutory, prevEmployerStatutory)).toFixed(1) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>

        <!-- Advances -->
        <div class="relative overflow-hidden bg-white dark:bg-gray-900 rounded-xl border border-rose-100 dark:border-rose-900/30 p-3 shadow-sm group hover:shadow-md transition-shadow">
          <div class="absolute top-0 right-0 w-16 h-16 bg-rose-500/5 rounded-bl-full"></div>
          <div class="text-[9px] font-black text-rose-500 uppercase tracking-widest">Advance Ded.</div>
          <div class="text-xl font-black text-rose-600 dark:text-rose-400 mt-1 font-mono">{{ formatCompact(currentTotals.advance) }}</div>
          <div class="flex items-center gap-1 mt-1">
            <span :class="delta(currentTotals.advance, previousTotals.advance) <= 0 ? 'text-emerald-500' : 'text-rose-500'" class="text-[9px] font-black">
              {{ delta(currentTotals.advance, previousTotals.advance) >= 0 ? '▲' : '▼' }} {{ Math.abs(delta(currentTotals.advance, previousTotals.advance)).toFixed(1) }}%
            </span>
            <span class="text-[8px] text-gray-400 font-bold">vs prev</span>
          </div>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
        <!-- Bar Chart -->
        <div class="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <div>
              <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">6-Month Trend</h3>
              <p class="text-[9px] text-gray-400 font-bold">Gross vs Net salary over time</p>
            </div>
          </div>
          <div class="h-52">
            <canvas ref="barChartRef"></canvas>
          </div>
        </div>

        <!-- Doughnut Chart -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
          <div class="mb-3">
            <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider">Payment Modes</h3>
            <p class="text-[9px] text-gray-400 font-bold">Distribution by net amount</p>
          </div>
          <div class="h-52 flex items-center justify-center">
            <canvas ref="doughnutChartRef"></canvas>
          </div>
        </div>
      </div>

      <!-- Breakdowns Row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 shrink-0">
        <!-- Project Breakdown -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
          <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">By Project</h3>
          <div class="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
            <div v-for="item in projectBreakdown" :key="item.name" class="group">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{{ item.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-mono font-black text-gray-500">{{ item.count }} emp</span>
                  <span class="text-[10px] font-mono font-black text-indigo-600 dark:text-indigo-400">{{ formatCompact(item.gross) }}</span>
                </div>
              </div>
              <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-indigo-500/70 rounded-full transition-all duration-500" :style="{ width: `${currentTotals.gross > 0 ? (item.gross / currentTotals.gross * 100) : 0}%` }"></div>
              </div>
            </div>
            <div v-if="projectBreakdown.length === 0" class="text-center text-[10px] text-gray-400 py-4 font-bold">No data</div>
          </div>
        </div>

        <!-- Site Breakdown -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
          <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">By Site</h3>
          <div class="space-y-2.5 max-h-48 overflow-y-auto scrollbar-thin">
            <div v-for="item in siteBreakdown" :key="item.name" class="group">
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] font-bold text-gray-700 dark:text-gray-300 truncate max-w-[60%]">{{ item.name }}</span>
                <div class="flex items-center gap-2">
                  <span class="text-[9px] font-mono font-black text-gray-500">{{ item.count }} emp</span>
                  <span class="text-[10px] font-mono font-black text-cyan-600 dark:text-cyan-400">{{ formatCompact(item.gross) }}</span>
                </div>
              </div>
              <div class="w-full h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-cyan-500/70 rounded-full transition-all duration-500" :style="{ width: `${currentTotals.gross > 0 ? (item.gross / currentTotals.gross * 100) : 0}%` }"></div>
              </div>
            </div>
            <div v-if="siteBreakdown.length === 0" class="text-center text-[10px] text-gray-400 py-4 font-bold">No data</div>
          </div>
        </div>

        <!-- Top 5 Earners -->
        <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
          <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Top 5 Earners</h3>
          <div class="space-y-2">
            <div v-for="(wage, idx) in topEarners" :key="wage._id" class="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer" @click="openHistoryModal(wage)">
              <div class="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0"
                :class="{
                  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': idx === 0,
                  'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400': idx === 1,
                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400': idx === 2,
                  'bg-gray-50 text-gray-500 dark:bg-gray-800/50 dark:text-gray-500': idx > 2,
                }">
                {{ idx + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-[10px] font-bold text-gray-900 dark:text-gray-100 truncate">{{ wage.master_roll_id?.employee_name || 'N/A' }}</div>
                <div class="text-[8px] text-gray-400 font-bold uppercase truncate">{{ wage.master_roll_id?.project || wage.project || 'N/A' }}</div>
              </div>
              <div class="text-[11px] font-black font-mono text-emerald-600 dark:text-emerald-400 shrink-0">{{ formatCompact(wage.net_salary) }}</div>
            </div>
            <div v-if="topEarners.length === 0" class="text-center text-[10px] text-gray-400 py-4 font-bold">No data</div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm shrink-0">
        <h3 class="text-xs font-black text-gray-900 dark:text-gray-100 uppercase tracking-wider mb-3">Recent Wage Activity</h3>
        <div class="grid grid-cols-1 md:grid-cols-5 gap-2">
          <div v-for="wage in recentActivity" :key="wage._id" class="flex items-center gap-2.5 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800 cursor-pointer" @click="openHistoryModal(wage)">
            <div class="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
              <UIcon name="i-heroicons-banknotes" class="w-3.5 h-3.5 text-primary" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] font-bold text-gray-900 dark:text-gray-100 truncate">{{ wage.master_roll_id?.employee_name || 'N/A' }}</div>
              <div class="text-[8px] text-gray-400 font-bold">{{ formatDate(wage.updatedAt || wage.createdAt) }} • {{ formatCompact(wage.net_salary) }}</div>
            </div>
            <span class="px-1.5 py-0.5 text-[7px] font-black uppercase rounded shrink-0"
              :class="{
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400': wage.status === 'POSTED',
                'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400': wage.status === 'DRAFT',
                'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400': wage.status === 'LOCKED',
              }">
              {{ wage.status || 'POSTED' }}
            </span>
          </div>
          <div v-if="recentActivity.length === 0" class="col-span-full text-center text-[10px] text-gray-400 py-4 font-bold">No wage records found for this month</div>
        </div>
      </div>
    </template>

    <!-- History Modal -->
    <UModal v-model="showHistoryModal">
      <div class="p-4 max-w-4xl">
        <WagesSummaryModal v-if="selectedEmployeeForModal" :employee="selectedEmployeeForModal" @close="showHistoryModal = false" />
      </div>
    </UModal>
  </div>
</template>
