<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'

const emit = defineEmits(['close'])

const activeCategory = ref<'length' | 'weight' | 'temperature' | 'currency'>('length')

const inputValue = ref<number>(1)
const fromUnit = ref('')
const toUnit = ref('')

const currencyRates = ref<Record<string, number>>({})
const loadingRates = ref(false)

const UNIT_DEFS = {
  length: {
    label: 'Length',
    units: {
      km: 1000,
      m: 1,
      cm: 0.01,
      mm: 0.001,
      mi: 1609.344,
      yd: 0.9144,
      ft: 0.3048,
      in: 0.0254
    },
    names: {
      km: 'Kilometers',
      m: 'Meters',
      cm: 'Centimeters',
      mm: 'Millimeters',
      mi: 'Miles',
      yd: 'Yards',
      ft: 'Feet',
      in: 'Inches'
    }
  },
  weight: {
    label: 'Mass / Weight',
    units: {
      t: 1000,
      kg: 1,
      g: 0.001,
      mg: 0.000001,
      lb: 0.453592,
      oz: 0.028349
    },
    names: {
      t: 'Metric Tons',
      kg: 'Kilograms',
      g: 'Grams',
      mg: 'Milligrams',
      lb: 'Pounds',
      oz: 'Ounces'
    }
  },
  temperature: {
    label: 'Temperature',
    units: {
      C: 1,
      F: 1,
      K: 1
    },
    names: {
      C: 'Celsius (°C)',
      F: 'Fahrenheit (°F)',
      K: 'Kelvin (K)'
    }
  },
  currency: {
    label: 'Currency (Forex)',
    units: {},
    names: {
      USD: 'US Dollar',
      INR: 'Indian Rupee',
      EUR: 'Euro',
      GBP: 'British Pound',
      JPY: 'Japanese Yen',
      AED: 'UAE Dirham',
      SGD: 'Singapore Dollar',
      AUD: 'Australian Dollar',
      CAD: 'Canadian Dollar',
      CHF: 'Swiss Franc',
      CNY: 'Chinese Yuan'
    }
  }
}

const unitOptions = computed(() => {
  if (activeCategory.value === 'currency') {
    return Object.keys(UNIT_DEFS.currency.names)
  }
  return Object.keys(UNIT_DEFS[activeCategory.value].units)
})

const getUnitName = (code: string) => {
  const cat = UNIT_DEFS[activeCategory.value] as any
  return cat.names[code] || code
}

const convertedValue = computed(() => {
  const val = Number(inputValue.value)
  if (isNaN(val)) return '0'
  
  const from = fromUnit.value
  const to = toUnit.value
  if (!from || !to) return '0'
  if (from === to) return String(val)

  if (activeCategory.value === 'temperature') {
    let c = val
    if (from === 'F') c = ((val - 32) * 5) / 9
    else if (from === 'K') c = val - 273.15
    
    if (to === 'C') return String(Number(c.toFixed(4)))
    if (to === 'F') return String(Number((c * 9/5 + 32).toFixed(4)))
    if (to === 'K') return String(Number((c + 273.15).toFixed(4)))
  }
  
  if (activeCategory.value === 'currency') {
    if (Object.keys(currencyRates.value).length === 0) return 'Loading rates...'
    const fromRate = currencyRates.value[from] || 1
    const toRate = currencyRates.value[to] || 1
    const converted = (val / fromRate) * toRate
    return String(Number(converted.toFixed(4)))
  }

  // Length or Weight standard conversions
  const units = UNIT_DEFS[activeCategory.value].units as Record<string, number>
  const fromFactor = units[from] || 1
  const toFactor = units[to] || 1
  const baseValue = val * fromFactor
  const converted = baseValue / toFactor
  return String(Number(converted.toFixed(6)))
})

const loadCurrencyRates = async () => {
  loadingRates.value = true
  try {
    const data = await $fetch<{ success: boolean; rates: Record<string, number> }>('/api/tools/currency-rates', { query: { base: 'USD' } }).catch(() => null)
    if (data && data.success) {
      currencyRates.value = data.rates
    } else {
      useFallbackRates()
    }
  } catch (e) {
    console.error('Failed to load currency rates, using fallbacks.', e)
    useFallbackRates()
  } finally {
    loadingRates.value = false
  }
}

const useFallbackRates = () => {
  currencyRates.value = {
    USD: 1,
    INR: 83.15,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 154.2,
    AED: 3.67,
    SGD: 1.35,
    AUD: 1.52,
    CAD: 1.37,
    CHF: 0.91,
    CNY: 7.24
  }
}

const syncUnits = () => {
  const opts = unitOptions.value
  fromUnit.value = opts[0] || ''
  toUnit.value = opts[1] || opts[0] || ''
}

watch(activeCategory, () => {
  syncUnits()
  if (activeCategory.value === 'currency' && Object.keys(currencyRates.value).length === 0) {
    loadCurrencyRates()
  }
})

const swapUnits = () => {
  const temp = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = temp
}

onMounted(() => {
  syncUnits()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Conversion Tool</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Unit Converter</h2>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-555 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Main Workspace -->
      <div class="p-4 sm:p-6 space-y-6 bg-white dark:bg-slate-900">
        <!-- Category Selector tabs -->
        <div class="space-y-1.5">
          <label class="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Measure Category</label>
          <div class="grid grid-cols-4 gap-1 bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 p-1 rounded-2xl">
            <button
              v-for="cat in (['length', 'weight', 'temperature', 'currency'] as const)"
              :key="cat"
              type="button"
              class="py-2 rounded-xl text-[9px] font-black uppercase tracking-wider text-center transition cursor-pointer"
              :class="[
                activeCategory === cat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              ]"
              @click="activeCategory = cat"
            >
              {{ cat === 'temperature' ? 'Temp' : cat }}
            </button>
          </div>
        </div>

        <!-- Input Quantity -->
        <div class="space-y-1.5">
          <label class="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Input Quantity</label>
          <input
            v-model.number="inputValue"
            type="number"
            step="any"
            class="w-full bg-slate-50 dark:bg-slate-955 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-4 text-slate-900 dark:text-white text-2xl font-black focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-center font-mono"
            placeholder="Enter quantity"
          />
        </div>

        <!-- From/To selection -->
        <div class="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 p-4 border border-slate-200 dark:border-slate-800/80 rounded-2xl">
          <div class="w-full sm:flex-1 space-y-1">
            <label class="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">From</label>
            <select
              v-model="fromUnit"
              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-slate-900 dark:text-white text-xs font-bold focus:outline-none text-center cursor-pointer"
            >
              <option v-for="opt in unitOptions" :key="opt" :value="opt">{{ getUnitName(opt) }}</option>
            </select>
          </div>
          <div class="flex justify-center pt-2 sm:pt-4">
            <button
              type="button"
              class="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition font-black text-sm cursor-pointer rotate-90 sm:rotate-0"
              @click="swapUnits"
            >
              ⇄
            </button>
          </div>
          <div class="w-full sm:flex-1 space-y-1">
            <label class="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">To</label>
            <select
              v-model="toUnit"
              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-2 text-slate-900 dark:text-white text-xs font-bold focus:outline-none text-center cursor-pointer"
            >
              <option v-for="opt in unitOptions" :key="opt" :value="opt">{{ getUnitName(opt) }}</option>
            </select>
          </div>
        </div>

        <!-- Resulting Value -->
        <div class="space-y-1.5">
          <label class="block text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Resulting Value</label>
          <div
            class="w-full bg-emerald-50 dark:bg-emerald-955/20 border border-emerald-205 dark:border-emerald-900/30 rounded-2xl px-4 py-4 text-emerald-600 dark:text-emerald-400 text-2xl font-black text-center font-mono shadow-inner truncate"
          >
            {{ convertedValue }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
