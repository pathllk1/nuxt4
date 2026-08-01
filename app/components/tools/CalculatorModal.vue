<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'

const emit = defineEmits(['close'])

const activeTab = ref('calc')

const tabs = [
  { id: 'calc', label: 'Calc', icon: '⊞' },
  { id: 'date', label: 'Date', icon: '📅' },
  { id: 'invest', label: 'Finance', icon: '📈' },
  { id: 'emi', label: 'EMI', icon: '🏦' },
  { id: 'gst', label: 'GST', icon: '🧾' },
  { id: 'percent', label: 'Margin', icon: '%' }
]

// ==========================================
// 1. STANDARD & SCIENTIFIC CALCULATOR
// ==========================================
const expr = ref('')
const calcResult = ref('0')
const calcPreview = ref('')
const calcHistory = ref<string[]>([])
const calcMemory = ref<number | null>(null)

const evalExpr = (input: string): { ok: true; val: string } | { ok: false; msg: string } => {
  const s = input.replace(/\s+/g, '')
  if (!s) return { ok: true, val: '0' }
  if (!/^[\d+\-*/().%e]+$/i.test(s)) return { ok: false, msg: 'Invalid characters' }
  try {
    const v = new Function(`return (${s})`)()
    if (typeof v !== 'number' || !isFinite(v)) return { ok: false, msg: 'Invalid result' }
    return { ok: true, val: parseFloat(v.toFixed(12)).toString() }
  } catch {
    return { ok: false, msg: 'Invalid expression' }
  }
}

const handleCalcInput = (char: string) => {
  expr.value += char
  updatePreview()
}

const updatePreview = () => {
  const res = evalExpr(expr.value)
  if (res.ok) {
    calcPreview.value = res.val
  } else {
    calcPreview.value = ''
  }
}

const clearCalc = () => {
  expr.value = ''
  calcResult.value = '0'
  calcPreview.value = ''
}

const backspaceCalc = () => {
  expr.value = expr.value.slice(0, -1)
  updatePreview()
}

const calculateEquals = () => {
  const res = evalExpr(expr.value)
  if (res.ok) {
    const finalVal = res.val
    if (expr.value && expr.value !== finalVal) {
      calcHistory.value.unshift(`${expr.value} = ${finalVal}`)
      if (calcHistory.value.length > 20) calcHistory.value.pop()
    }
    calcResult.value = finalVal
    expr.value = finalVal
    calcPreview.value = ''
  } else {
    calcResult.value = 'Error'
  }
}

const handleMemory = (op: string) => {
  const val = parseFloat(calcResult.value) || 0
  if (op === 'mc') {
    calcMemory.value = null
  } else if (op === 'mr') {
    if (calcMemory.value !== null) {
      expr.value += calcMemory.value.toString()
      updatePreview()
    }
  } else if (op === 'm+') {
    calcMemory.value = (calcMemory.value || 0) + val
  } else if (op === 'm-') {
    calcMemory.value = (calcMemory.value || 0) - val
  } else if (op === 'toggle-sign') {
    if (expr.value.startsWith('-')) {
      expr.value = expr.value.substring(1)
    } else {
      expr.value = '-' + expr.value
    }
    updatePreview()
  } else if (op === 'sqrt') {
    const current = parseFloat(calcResult.value) || 0
    if (current >= 0) {
      const sq = Math.sqrt(current)
      expr.value = sq.toString()
      calcResult.value = sq.toString()
      calcPreview.value = ''
    } else {
      calcResult.value = 'Error'
    }
  }
}

// ==========================================
// 2. DATE CALCULATOR
// ==========================================
const dateDiffForm = reactive({
  start: new Date().toISOString().slice(0, 10),
  end: new Date().toISOString().slice(0, 10)
})
const dateDiffRes = ref<any>(null)

const calcDateDiff = () => {
  const s = new Date(dateDiffForm.start)
  const e = new Date(dateDiffForm.end)
  const diffTime = Math.abs(e.getTime() - s.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  dateDiffRes.value = {
    days: diffDays,
    weeks: (diffDays / 7).toFixed(1),
    months: (diffDays / 30.44).toFixed(1),
    years: (diffDays / 365.25).toFixed(1)
  }
}

const dateArithForm = reactive({
  start: new Date().toISOString().slice(0, 10),
  amount: 30,
  unit: 'days',
  op: 'add'
})
const dateArithRes = ref<string | null>(null)

const calcDateArith = () => {
  const d = new Date(dateArithForm.start)
  const mult = dateArithForm.op === 'add' ? 1 : -1
  const amt = dateArithForm.amount
  if (dateArithForm.unit === 'days') d.setDate(d.getDate() + amt * mult)
  else if (dateArithForm.unit === 'weeks') d.setDate(d.getDate() + amt * 7 * mult)
  else if (dateArithForm.unit === 'months') d.setMonth(d.getMonth() + amt * mult)
  else if (dateArithForm.unit === 'years') d.setFullYear(d.getFullYear() + amt * mult)
  dateArithRes.value = d.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

const ageForm = reactive({
  dob: new Date(1995, 0, 1).toISOString().slice(0, 10),
  asOf: new Date().toISOString().slice(0, 10)
})
const ageRes = ref<any>(null)

const calcAge = () => {
  const d = new Date(ageForm.dob)
  const a = new Date(ageForm.asOf)
  let years = a.getFullYear() - d.getFullYear()
  let months = a.getMonth() - d.getMonth()
  let days = a.getDate() - d.getDate()
  if (days < 0) {
    months--
    const prevMonth = new Date(a.getFullYear(), a.getMonth(), 0)
    days += prevMonth.getDate()
  }
  if (months < 0) {
    years--
    months += 12
  }
  ageRes.value = { years, months, days }
}

const workDaysForm = reactive({
  start: new Date().toISOString().slice(0, 10),
  end: new Date().toISOString().slice(0, 10)
})
const workDaysRes = ref<any>(null)

const calcWorkDays = () => {
  const s = new Date(workDaysForm.start)
  const e = new Date(workDaysForm.end)
  let count = 0
  let total = 0
  let weekends = 0
  const cur = new Date(s)
  while (cur <= e) {
    total++
    const day = cur.getDay()
    if (day === 0 || day === 6) {
      weekends++
    } else {
      count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  workDaysRes.value = { total, working: count, weekends }
}

// ==========================================
// 3. INVESTMENT CALCULATOR
// ==========================================
const investType = ref<'simple' | 'compound' | 'sip'>('simple')
const investForm = reactive({
  principal: 100000,
  rate: 12,
  time: 5,
  compounding: 12
})
const investRes = ref<any>(null)

const calcInvest = () => {
  const P = investForm.principal
  const R = investForm.rate
  const T = investForm.time

  if (investType.value === 'simple') {
    const interest = (P * R * T) / 100
    const total = P + interest
    investRes.value = { principal: P, interest, total }
  } else if (investType.value === 'compound') {
    const n = investForm.compounding
    const r = R / 100
    const total = P * Math.pow(1 + r / n, n * T)
    const interest = total - P
    investRes.value = { principal: P, interest, total }
  } else if (investType.value === 'sip') {
    const monthlyAmt = P
    const i = R / 12 / 100
    const n = T * 12
    const total = monthlyAmt * ((Math.pow(1 + i, n) - 1) / i) * (1 + i)
    const invested = monthlyAmt * n
    const gains = total - invested
    investRes.value = { principal: invested, interest: gains, total }
  }
}

// ==========================================
// 4. EMI CALCULATOR
// ==========================================
const emiForm = reactive({
  principal: 1000000,
  rate: 9,
  tenure: 60,
  startMonth: new Date().toISOString().slice(0, 7)
})
const emiRes = ref<any>(null)

const calcEMI = () => {
  const P = emiForm.principal
  const r = emiForm.rate / 12 / 100
  const n = emiForm.tenure
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  const totalPayment = emi * n
  const totalInterest = totalPayment - P

  const schedule = []
  let balance = P
  const parts = (emiForm.startMonth || '').split('-').map(Number)
  const startYear = parts[0] || new Date().getFullYear()
  const startMonthNum = parts[1] || (new Date().getMonth() + 1)

  for (let i = 1; i <= n; i++) {
    const interestVal = balance * r
    const principalVal = emi - interestVal
    balance -= principalVal

    const monthLabel = new Date(startYear, startMonthNum - 1 + (i - 1), 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })

    schedule.push({
      index: i,
      month: monthLabel,
      emi: emi.toFixed(2),
      principal: principalVal.toFixed(2),
      interest: interestVal.toFixed(2),
      balance: Math.max(0, balance).toFixed(2)
    })
  }

  emiRes.value = {
    monthly: emi.toFixed(2),
    interest: totalInterest.toFixed(2),
    total: totalPayment.toFixed(2),
    schedule
  }
}

// ==========================================
// 5. GST CALCULATOR
// ==========================================
const gstForm = reactive({
  amount: 10000,
  rate: 18,
  mode: 'exclusive' as 'exclusive' | 'inclusive',
  tx: 'intra' as 'intra' | 'inter'
})
const gstRes = ref<any>(null)

const calcGST = () => {
  const amt = gstForm.amount
  const rate = gstForm.rate
  let base = 0
  let tax = 0
  let grand = 0

  if (gstForm.mode === 'exclusive') {
    base = amt
    tax = (amt * rate) / 100
    grand = amt + tax
  } else {
    base = amt / (1 + rate / 100)
    tax = amt - base
    grand = amt
  }

  gstRes.value = {
    base: base.toFixed(2),
    tax: tax.toFixed(2),
    tax1: (tax / 2).toFixed(2),
    tax2: (tax / 2).toFixed(2),
    grand: grand.toFixed(2)
  }
}

// ==========================================
// 6. PERCENTAGE & PROFIT/LOSS MARGINS
// ==========================================
const marginForm = reactive({
  cost: 100,
  sellingPrice: 120
})
const marginRes = ref<any>(null)

const calcMargin = () => {
  const C = marginForm.cost
  const S = marginForm.sellingPrice
  const profit = S - C
  const profitPct = C > 0 ? (profit / C) * 100 : 0
  const marginPct = S > 0 ? (profit / S) * 100 : 0

  marginRes.value = {
    profit: profit.toFixed(2),
    markup: profitPct.toFixed(1) + '%',
    margin: marginPct.toFixed(1) + '%'
  }
}

const fmtCurrency = (n: any) => {
  return '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(() => {
  calcDateDiff()
  calcDateArith()
  calcAge()
  calcWorkDays()
  calcInvest()
  calcEMI()
  calcGST()
  calcMargin()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl h-[95vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Enterprise Calculator</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Multi-Calculator Suite</h2>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Content Area with Left Sidebar tabs -->
      <div class="flex-1 flex flex-col sm:flex-row overflow-hidden min-h-0 bg-white dark:bg-slate-900">
        <!-- Sidebar Navigation -->
        <div class="w-full sm:w-48 flex flex-row overflow-x-auto sm:flex-col border-b sm:border-b-0 sm:border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 py-1 sm:py-4 gap-1 shrink-0 scrollbar-hide">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            class="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2 sm:py-3 text-xs font-black uppercase tracking-widest text-left transition cursor-pointer whitespace-nowrap"
            :class="[
              activeTab === t.id
                ? 'bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border-b-2 sm:border-b-0 sm:border-r-4 border-indigo-600'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-slate-800/30'
            ]"
            @click="activeTab = t.id"
          >
            <span class="text-base">{{ t.icon }}</span>
            <span>{{ t.label }}</span>
          </button>
        </div>

        <!-- Main Workspace -->
        <div class="flex-1 overflow-y-auto p-4 sm:p-6 min-w-0 bg-white dark:bg-slate-900">
          <!-- 1. STANDARD CALCULATOR -->
          <div v-if="activeTab === 'calc'" class="h-full flex flex-col md:flex-row overflow-y-auto md:overflow-hidden gap-4">
            <div class="flex-1 flex flex-col gap-3 min-w-0">
              <!-- Display -->
              <div class="bg-slate-50 dark:bg-slate-950 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-inner shrink-0">
                <div class="flex justify-between items-center mb-1">
                  <span class="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Expression</span>
                  <div class="flex items-center gap-3">
                    <span v-if="calcMemory !== null" class="text-[9px] font-black text-indigo-600 dark:text-indigo-400 italic">M: {{ calcMemory }}</span>
                    <button type="button" class="text-[9px] font-black uppercase text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer" @click="clearCalc">Clear</button>
                  </div>
                </div>
                <input
                  v-model="expr"
                  class="w-full bg-transparent text-slate-800 dark:text-slate-300 text-sm font-mono outline-none placeholder:text-slate-300 dark:placeholder:text-slate-800"
                  type="text"
                  autocomplete="off"
                  placeholder="e.g. (2400*18)/100"
                  @input="updatePreview"
                  @keydown.enter="calculateEquals"
                />
                <div class="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white text-right font-mono tracking-tighter leading-none mt-2 truncate">
                  {{ calcResult }}
                </div>
                <div class="text-xs text-slate-450 dark:text-slate-500 text-right font-mono mt-1 min-h-[1.25em] truncate">
                  {{ calcPreview ? '= ' + calcPreview : '' }}
                </div>
              </div>

              <!-- Memory Buttons -->
              <div class="grid grid-cols-5 gap-1 shrink-0">
                <button type="button" @click="handleMemory('mc')" class="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-2 rounded-xl transition uppercase cursor-pointer">MC</button>
                <button type="button" @click="handleMemory('mr')" class="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-2 rounded-xl transition uppercase cursor-pointer">MR</button>
                <button type="button" @click="handleMemory('m+')" class="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-2 rounded-xl transition uppercase cursor-pointer">M+</button>
                <button type="button" @click="handleMemory('m-')" class="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-2 rounded-xl transition uppercase cursor-pointer">M-</button>
                <button type="button" @click="handleMemory('toggle-sign')" class="bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-[10px] font-black py-2 rounded-xl transition uppercase cursor-pointer">+/-</button>
              </div>

              <!-- Pad Buttons -->
              <div class="grid grid-cols-4 gap-1.5 flex-1 min-h-[220px]">
                <button type="button" @click="clearCalc" class="rounded-xl py-3 text-rose-600 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900 hover:text-rose-700 dark:hover:text-white border border-rose-200 dark:border-rose-900/20 font-black cursor-pointer">AC</button>
                <button type="button" @click="backspaceCalc" class="rounded-xl py-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 font-black cursor-pointer">⌫</button>
                <button type="button" @click="handleCalcInput('(')" class="rounded-xl py-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 font-black cursor-pointer">(</button>
                <button type="button" @click="handleCalcInput(')')" class="rounded-xl py-3 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 font-black cursor-pointer">)</button>

                <button type="button" @click="handleCalcInput('7')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">7</button>
                <button type="button" @click="handleCalcInput('8')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">8</button>
                <button type="button" @click="handleCalcInput('9')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">9</button>
                <button type="button" @click="handleCalcInput('/')" class="rounded-xl py-3 text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 font-black cursor-pointer">÷</button>

                <button type="button" @click="handleCalcInput('4')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">4</button>
                <button type="button" @click="handleCalcInput('5')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">5</button>
                <button type="button" @click="handleCalcInput('6')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">6</button>
                <button type="button" @click="handleCalcInput('*')" class="rounded-xl py-3 text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 font-black cursor-pointer">×</button>

                <button type="button" @click="handleCalcInput('1')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">1</button>
                <button type="button" @click="handleCalcInput('2')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">2</button>
                <button type="button" @click="handleCalcInput('3')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">3</button>
                <button type="button" @click="handleCalcInput('-')" class="rounded-xl py-3 text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 font-black cursor-pointer">−</button>

                <button type="button" @click="handleCalcInput('0')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 col-span-2 font-black cursor-pointer">0</button>
                <button type="button" @click="handleCalcInput('.')" class="rounded-xl py-3 text-slate-900 dark:text-white bg-slate-100/50 dark:bg-slate-800/40 hover:bg-slate-200/50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 font-black cursor-pointer">.</button>
                <button type="button" @click="handleCalcInput('+')" class="rounded-xl py-3 text-white bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 font-black cursor-pointer">+</button>

                <button type="button" @click="handleCalcInput('%')" class="rounded-xl py-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 font-black text-xs cursor-pointer">%</button>
                <button type="button" @click="handleMemory('sqrt')" class="rounded-xl py-2 text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/50 font-black text-xs cursor-pointer">√</button>
                <button type="button" @click="calculateEquals" class="rounded-xl py-2 text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500 col-span-2 font-black text-lg shadow-lg shadow-emerald-950/20 cursor-pointer">=</button>
              </div>
            </div>
            <!-- History panel -->
            <div class="w-full md:w-48 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col shrink-0 rounded-2xl overflow-hidden">
              <div class="px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-50/50 dark:bg-slate-950/40">History</div>
              <div class="flex-1 overflow-y-auto p-3 space-y-2 max-h-40 md:max-h-none">
                <div v-for="(h, idx) in calcHistory" :key="idx" class="text-xs font-mono text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl">
                  {{ h }}
                </div>
                <div v-if="calcHistory.length === 0" class="text-center text-[10px] text-slate-400 dark:text-slate-600 font-black mt-8">NO HISTORY</div>
              </div>
            </div>
          </div>

          <!-- 2. DATE CALCULATOR -->
          <div v-else-if="activeTab === 'date'" class="space-y-6">
            <!-- Date Diff -->
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">Date Difference</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Start Date</label>
                  <input type="date" v-model="dateDiffForm.start" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @change="calcDateDiff" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">End Date</label>
                  <input type="date" v-model="dateDiffForm.end" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @change="calcDateDiff" />
                </div>
              </div>
              <div v-if="dateDiffRes" class="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ dateDiffRes.days }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Days</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{{ dateDiffRes.weeks }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Weeks</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ dateDiffRes.months }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Months</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ dateDiffRes.years }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Years</div>
                </div>
              </div>
            </div>

            <!-- Date Add/Sub -->
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-4">Add / Subtract from Date</h3>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4 items-end">
                <div class="flex flex-col gap-1.5 sm:col-span-2">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Base Date</label>
                  <input type="date" v-model="dateArithForm.start" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @change="calcDateArith" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Amount</label>
                  <input type="number" v-model.number="dateArithForm.amount" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @input="calcDateArith" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Unit</label>
                  <select v-model="dateArithForm.unit" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none focus:border-indigo-500" @change="calcDateArith">
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>
              <div class="grid grid-cols-1 gap-4 mb-4">
                <div class="flex p-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
                  <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer" :class="[dateArithForm.op === 'add' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400']" @click="dateArithForm.op = 'add'; calcDateArith()">Add (+)</button>
                  <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition cursor-pointer" :class="[dateArithForm.op === 'sub' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400']" @click="dateArithForm.op = 'sub'; calcDateArith()">Subtract (−)</button>
                </div>
              </div>
              <div v-if="dateArithRes" class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-center">
                <div class="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono">{{ dateArithRes }}</div>
              </div>
            </div>

            <!-- Age Calculator -->
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-violet-650 dark:text-violet-400 mb-4">Age Calculator</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Date of Birth</label>
                  <input type="date" v-model="ageForm.dob" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @change="calcAge" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">As of Date</label>
                  <input type="date" v-model="ageForm.asOf" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none focus:border-indigo-500" @change="calcAge" />
                </div>
              </div>
              <div v-if="ageRes" class="grid grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ ageRes.years }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Years</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-indigo-655 dark:text-indigo-400 font-mono">{{ ageRes.months }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Months</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ ageRes.days }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Days</div>
                </div>
              </div>
            </div>

            <!-- Working Days -->
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-amber-655 dark:text-amber-400 mb-4">Working Days Between Dates</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">From Date</label>
                  <input type="date" v-model="workDaysForm.start" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @change="calcWorkDays" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">To Date</label>
                  <input type="date" v-model="workDaysForm.end" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @change="calcWorkDays" />
                </div>
              </div>
              <div v-if="workDaysRes" class="grid grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono">{{ workDaysRes.total }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Total Days</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">{{ workDaysRes.working }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Working Days</div>
                </div>
                <div class="text-center">
                  <div class="text-2xl font-black text-slate-500 dark:text-slate-400 font-mono">{{ workDaysRes.weekends }}</div>
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Weekends</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. INVESTMENT / COMPOUND / SIP -->
          <div v-else-if="activeTab === 'invest'" class="space-y-6">
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <h3 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">Investment Calculator</h3>
                <div class="flex p-0.5 bg-white dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-xl w-fit">
                  <button type="button" class="px-3 py-1 rounded-lg text-[10px] font-black transition uppercase cursor-pointer" :class="[investType === 'simple' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="investType = 'simple'; calcInvest()">Simple</button>
                  <button type="button" class="px-3 py-1 rounded-lg text-[10px] font-black transition uppercase cursor-pointer" :class="[investType === 'compound' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="investType = 'compound'; calcInvest()">Compound</button>
                  <button type="button" class="px-3 py-1 rounded-lg text-[10px] font-black transition uppercase cursor-pointer" :class="[investType === 'sip' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="investType = 'sip'; calcInvest()">SIP</button>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    {{ investType === 'sip' ? 'Monthly SIP (₹)' : 'Principal (₹)' }}
                  </label>
                  <input type="number" v-model.number="investForm.principal" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcInvest" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Rate (%)</label>
                  <input type="number" step="0.1" v-model.number="investForm.rate" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcInvest" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Time (Years)</label>
                  <input type="number" step="0.5" v-model.number="investForm.time" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcInvest" />
                </div>
              </div>

              <div v-if="investType === 'compound'" class="flex flex-col gap-1.5 mb-4">
                <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Compounding Frequency</label>
                <select v-model="investForm.compounding" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none" @change="calcInvest">
                  <option :value="1">Annually</option>
                  <option :value="2">Semi-Annually</option>
                  <option :value="4">Quarterly</option>
                  <option :value="12">Monthly</option>
                  <option :value="365">Daily</option>
                </select>
              </div>

              <div v-if="investRes" class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl mt-4">
                <div class="text-center p-2">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Invested</div>
                  <div class="text-sm font-black text-slate-900 dark:text-white font-mono">{{ fmtCurrency(investRes.principal) }}</div>
                </div>
                <div class="text-center p-2 border-y sm:border-y-0 sm:border-x border-slate-100 dark:border-slate-800">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Gains</div>
                  <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{{ fmtCurrency(investRes.interest) }}</div>
                </div>
                <div class="text-center p-2">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Maturity Value</div>
                  <div class="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">{{ fmtCurrency(investRes.total) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. EMI LOAN CALCULATOR -->
          <div v-else-if="activeTab === 'emi'" class="space-y-6">
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">EMI Calculator</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Loan Amount (₹)</label>
                  <input type="number" v-model.number="emiForm.principal" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcEMI" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Interest Rate (%)</label>
                  <input type="number" step="0.1" v-model.number="emiForm.rate" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcEMI" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Tenure (Months)</label>
                  <input type="number" v-model.number="emiForm.tenure" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcEMI" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Start Month</label>
                  <input type="month" v-model="emiForm.startMonth" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @change="calcEMI" />
                </div>
              </div>

              <div v-if="emiRes" class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl mb-6">
                <div class="text-center p-1.5">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Monthly EMI</div>
                  <div class="text-lg font-black text-slate-900 dark:text-white font-mono">{{ fmtCurrency(emiRes.monthly) }}</div>
                </div>
                <div class="text-center p-1.5 border-y sm:border-y-0 sm:border-x border-slate-100 dark:border-slate-800">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Interest</div>
                  <div class="text-lg font-black text-rose-500 dark:text-rose-400 font-mono">{{ fmtCurrency(emiRes.interest) }}</div>
                </div>
                <div class="text-center p-1.5">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Payment</div>
                  <div class="text-lg font-black text-indigo-600 dark:text-indigo-400 font-mono">{{ fmtCurrency(emiRes.total) }}</div>
                </div>
              </div>

              <!-- Amortization Table -->
              <div v-if="emiRes && emiRes.schedule" class="space-y-2">
                <div class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Amortization Schedule</div>
                <div class="overflow-x-auto overflow-y-auto max-h-60 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/20">
                  <table class="w-full text-[10px] text-slate-700 dark:text-slate-300 min-w-[500px]">
                    <thead class="bg-slate-100 dark:bg-slate-950 sticky top-0">
                      <tr class="text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                        <th class="px-3 py-2 text-left">#</th>
                        <th class="px-3 py-2 text-left">Month</th>
                        <th class="px-3 py-2 text-right">EMI</th>
                        <th class="px-3 py-2 text-right">Principal</th>
                        <th class="px-3 py-2 text-right">Interest</th>
                        <th class="px-3 py-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                      <tr v-for="s in emiRes.schedule" :key="s.index" class="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td class="px-3 py-2 text-slate-400 dark:text-slate-500">{{ s.index }}</td>
                        <td class="px-3 py-2 font-bold">{{ s.month }}</td>
                        <td class="px-3 py-2 text-right">{{ fmtCurrency(s.emi) }}</td>
                        <td class="px-3 py-2 text-right text-emerald-600 dark:text-emerald-400">{{ fmtCurrency(s.principal) }}</td>
                        <td class="px-3 py-2 text-right text-rose-500 dark:text-rose-400">{{ fmtCurrency(s.interest) }}</td>
                        <td class="px-3 py-2 text-right text-indigo-600 dark:text-indigo-400">{{ fmtCurrency(s.balance) }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <!-- 5. GST India CALCULATOR -->
          <div v-else-if="activeTab === 'gst'" class="space-y-6">
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">GST Calculator (India)</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Amount (₹)</label>
                  <input type="number" v-model.number="gstForm.amount" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcGST" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">GST Rate (%)</label>
                  <select v-model="gstForm.rate" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs outline-none" @change="calcGST">
                    <option v-for="r in [0, 3, 5, 12, 18, 28]" :key="r" :value="r">{{ r }}%</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Mode</label>
                  <div class="flex p-0.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition flex-1 cursor-pointer" :class="[gstForm.mode === 'exclusive' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="gstForm.mode = 'exclusive'; calcGST()">Add GST</button>
                    <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition flex-1 cursor-pointer" :class="[gstForm.mode === 'inclusive' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="gstForm.mode = 'inclusive'; calcGST()">Extract GST</button>
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Transaction Type</label>
                  <div class="flex p-0.5 bg-white dark:bg-slate-955 border border-slate-202 dark:border-slate-800 rounded-xl">
                    <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition flex-1 cursor-pointer" :class="[gstForm.tx === 'intra' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="gstForm.tx = 'intra'; calcGST()">Intra-State</button>
                    <button type="button" class="px-4 py-1.5 rounded-lg text-xs font-black transition flex-1 cursor-pointer" :class="[gstForm.tx === 'inter' ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400']" @click="gstForm.tx = 'inter'; calcGST()">Inter-State</button>
                  </div>
                </div>
              </div>

              <div v-if="gstRes" class="space-y-3 mt-4">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                    <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Base Value</div>
                    <div class="text-sm font-black text-slate-900 dark:text-white font-mono mt-1">{{ fmtCurrency(gstRes.base) }}</div>
                  </div>
                  <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                    <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest">Total Tax</div>
                    <div class="text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-1">{{ fmtCurrency(gstRes.tax) }}</div>
                  </div>
                </div>

                <div v-if="gstForm.tx === 'intra'" class="grid grid-cols-2 gap-3">
                  <div class="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-center">
                    <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest">CGST ({{ gstForm.rate / 2 }}%)</div>
                    <div class="text-xs font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">{{ fmtCurrency(gstRes.tax1) }}</div>
                  </div>
                  <div class="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-center">
                    <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest">SGST ({{ gstForm.rate / 2 }}%)</div>
                    <div class="text-xs font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">{{ fmtCurrency(gstRes.tax2) }}</div>
                  </div>
                </div>
                <div v-else class="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-center">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest">IGST ({{ gstForm.rate }}%)</div>
                  <div class="text-xs font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">{{ fmtCurrency(gstRes.tax) }}</div>
                </div>

                <div class="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-xl p-4 text-center">
                  <div class="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Grand Total</div>
                  <div class="text-2xl font-black text-slate-900 dark:text-white font-mono mt-1">{{ fmtCurrency(gstRes.grand) }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 6. MARGIN / PERCENTAGE / PNL -->
          <div v-else-if="activeTab === 'percent'" class="space-y-6">
            <div class="bg-slate-50/50 dark:bg-slate-950/40 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800">
              <h3 class="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-4">Profit & Loss Margins</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Cost Price (₹)</label>
                  <input type="number" v-model.number="marginForm.cost" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcMargin" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <label class="text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">Selling Price (₹)</label>
                  <input type="number" v-model.number="marginForm.sellingPrice" class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono outline-none" @input="calcMargin" />
                </div>
              </div>

              <div v-if="marginRes" class="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white dark:bg-slate-900/50 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="text-center p-2">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Net Profit</div>
                  <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{{ fmtCurrency(marginRes.profit) }}</div>
                </div>
                <div class="text-center p-2 border-y sm:border-y-0 sm:border-x border-slate-100 dark:border-slate-800">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Markup (on Cost)</div>
                  <div class="text-sm font-black text-slate-950 dark:text-white font-mono">{{ marginRes.markup }}</div>
                </div>
                <div class="text-center p-2">
                  <div class="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Margin (on Sale)</div>
                  <div class="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono">{{ marginRes.margin }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
