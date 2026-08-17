<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { usePrintSettings, type PrintConfig } from '@/composables/usePrintSettings'

const emit = defineEmits(['close'])

// Active tab in Settings Modal
const activeTab = ref<'invoice' | 'interface' | 'utility' | 'data'>('invoice')

// Global Utility Preferences
const preferences = ref({
  theme: 'light',
  defaultCurrency: 'INR',
  defaultTempUnit: 'C',
  defaultNewsLang: 'hi',
  defaultNewsTopic: 'business',
  notepadFontSize: 14,
  defaultCity: 'New Delhi, India',
  defaultCityLat: 28.6139,
  defaultCityLon: 77.2090
})

// ERP Print Settings Composable
const { 
  printConfig, 
  bankAccounts, 
  loading: printLoading, 
  saving: printSaving, 
  fetchPrintSettings, 
  savePrintSettings 
} = usePrintSettings()

// Editable ERP Local Config
const localPrintConfig = reactive<PrintConfig>({
  showHsn: true,
  showQty: true,
  showUom: true,
  showRate: true,
  showDisc: true,
  showGst: true,
  showBatch: true,
  showNarration: true,
  showBank: true,
  defaultBankAccountId: '',
  jurisdiction: 'Subject to local jurisdiction only.',
  terms: [
    '1. Goods once sold will not be taken back.',
    '2. Subject to local jurisdiction only.',
    '3. E. & O.E.'
  ],
  declaration: 'Certified that the particulars given above are true and correct.',
  signatoryTitle: 'Authorised Signatory',
  defaultCopyType: 'ORIGINAL FOR RECIPIENT'
})

const saveSuccessMessage = ref('')

const loadPreferences = () => {
  try {
    const raw = localStorage.getItem('global-tools-preferences')
    if (raw) {
      preferences.value = { ...preferences.value, ...JSON.parse(raw) }
    } else {
      applyTheme('light')
    }
  } catch (e) {
    console.error('Failed to load preferences', e)
  }
}

const savePreferences = () => {
  localStorage.setItem('global-tools-preferences', JSON.stringify(preferences.value))
}

const updatePreference = (key: string, val: any) => {
  (preferences.value as any)[key] = val
  savePreferences()

  if (key === 'theme') {
    applyTheme(val)
  }
}

const applyTheme = (theme: string) => {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

function syncPrintStateFromMaster() {
  Object.assign(localPrintConfig, printConfig)
}

async function handleSaveErpPrintConfig() {
  const success = await savePrintSettings(localPrintConfig)
  if (success) {
    saveSuccessMessage.value = 'ERP Print layout saved successfully!'
    setTimeout(() => {
      saveSuccessMessage.value = ''
    }, 3000)
  } else {
    alert('Failed to save print settings to server. Saved to local cache.')
  }
}

const resetDefaults = () => {
  if (confirm('Reset all tool preferences and ERP print settings to defaults?')) {
    preferences.value = {
      theme: 'light',
      defaultCurrency: 'INR',
      defaultTempUnit: 'C',
      defaultNewsLang: 'hi',
      defaultNewsTopic: 'business',
      notepadFontSize: 14,
      defaultCity: 'New Delhi, India',
      defaultCityLat: 28.6139,
      defaultCityLon: 77.2090
    }
    savePreferences()
    applyTheme('light')

    localPrintConfig.showHsn = true
    localPrintConfig.showQty = true
    localPrintConfig.showUom = true
    localPrintConfig.showRate = true
    localPrintConfig.showDisc = true
    localPrintConfig.showGst = true
    localPrintConfig.showBatch = true
    localPrintConfig.showNarration = true
    localPrintConfig.showBank = true
    localPrintConfig.defaultBankAccountId = ''
    localPrintConfig.jurisdiction = 'Subject to local jurisdiction only.'
    localPrintConfig.declaration = 'Certified that the particulars given above are true and correct.'
    localPrintConfig.signatoryTitle = 'Authorised Signatory'
    localPrintConfig.defaultCopyType = 'ORIGINAL FOR RECIPIENT'

    handleSaveErpPrintConfig()
  }
}

const exportPrefs = () => {
  const bundle = {
    preferences: preferences.value,
    printConfig: localPrintConfig,
    exportedAt: new Date().toISOString()
  }
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `erp-system-config-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const triggerImport = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: any) => {
    try {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      const parsed = JSON.parse(text)
      
      if (parsed.preferences) {
        preferences.value = { ...preferences.value, ...parsed.preferences }
        savePreferences()
        applyTheme(preferences.value.theme)
      } else if (!parsed.printConfig) {
        // Flat legacy preference file
        preferences.value = { ...preferences.value, ...parsed }
        savePreferences()
        applyTheme(preferences.value.theme)
      }

      if (parsed.printConfig) {
        Object.assign(localPrintConfig, parsed.printConfig)
        handleSaveErpPrintConfig()
      }

      alert('Configuration bundle imported successfully!')
    } catch (err) {
      alert('Failed to parse configuration file.')
    }
  }
  input.click()
}

// Summary stats for active print columns
const activeColumnsCount = computed(() => {
  const keys = ['showHsn', 'showQty', 'showUom', 'showRate', 'showDisc', 'showGst', 'showBatch', 'showNarration'] as const
  return keys.filter(k => localPrintConfig[k]).length
})

onMounted(async () => {
  loadPreferences()
  await fetchPrintSettings()
  syncPrintStateFromMaster()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/50 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl h-[92vh] max-h-[850px] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
    >
      <!-- Top Modal Header -->
      <div class="border-b border-slate-100 dark:border-zinc-800 px-6 py-4 flex justify-between items-center bg-slate-50/80 dark:bg-zinc-900/90 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shadow-xs">
            <UIcon name="i-heroicons-cog-6-tooth" class="w-6 h-6" />
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">ERP Hub</span>
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Global Configuration</span>
            </div>
            <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">System & Utility Settings</h2>
          </div>
        </div>

        <button
          type="button"
          class="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Main Layout Body (Tabs Nav + Content Area) -->
      <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <!-- Sidebar Navigation Tabs -->
        <div class="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/30 p-3 flex md:flex-col gap-1.5 shrink-0 overflow-x-auto md:overflow-y-auto">
          
          <!-- Tab 1: Invoice & Print Layout -->
          <button
            type="button"
            class="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-xs font-bold transition cursor-pointer shrink-0 md:shrink"
            :class="[
              activeTab === 'invoice'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
            ]"
            @click="activeTab = 'invoice'"
          >
            <div 
              class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              :class="activeTab === 'invoice' ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'"
            >
              <UIcon name="i-heroicons-printer" class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate font-black">Invoice & Print Layout</div>
              <div class="text-[10px] opacity-80 font-medium truncate">PDF columns, bank & legal</div>
            </div>
          </button>

          <!-- Tab 2: Appearance & Theme -->
          <button
            type="button"
            class="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-xs font-bold transition cursor-pointer shrink-0 md:shrink"
            :class="[
              activeTab === 'interface'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
            ]"
            @click="activeTab = 'interface'"
          >
            <div 
              class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              :class="activeTab === 'interface' ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'"
            >
              <UIcon name="i-heroicons-swatch" class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate font-black">Appearance & Theme</div>
              <div class="text-[10px] opacity-80 font-medium truncate">Theme styling & mode</div>
            </div>
          </button>

          <!-- Tab 3: Utility Defaults -->
          <button
            type="button"
            class="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-xs font-bold transition cursor-pointer shrink-0 md:shrink"
            :class="[
              activeTab === 'utility'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
            ]"
            @click="activeTab = 'utility'"
          >
            <div 
              class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              :class="activeTab === 'utility' ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'"
            >
              <UIcon name="i-heroicons-wrench-screwdriver" class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate font-black">Utility Tools</div>
              <div class="text-[10px] opacity-80 font-medium truncate">Currency, news & notepad</div>
            </div>
          </button>

          <!-- Tab 4: Backup & Data Sync -->
          <button
            type="button"
            class="flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left text-xs font-bold transition cursor-pointer shrink-0 md:shrink"
            :class="[
              activeTab === 'data'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/60 hover:text-slate-900 dark:hover:text-white'
            ]"
            @click="activeTab = 'data'"
          >
            <div 
              class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              :class="activeTab === 'data' ? 'bg-white/20 text-white' : 'bg-slate-200/70 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400'"
            >
              <UIcon name="i-heroicons-circle-stack" class="w-4 h-4" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="truncate font-black">Backup & Sync</div>
              <div class="text-[10px] opacity-80 font-medium truncate">Export & import bundle</div>
            </div>
          </button>
        </div>

        <!-- Scrollable Tab Content View -->
        <div class="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 bg-white dark:bg-zinc-900 min-h-0">

          <!-- ================= TAB 1: INVOICE & PRINT CONFIGURATION ================= -->
          <div v-if="activeTab === 'invoice'" class="space-y-6 animate-in fade-in duration-150">
            <!-- Header Summary Banner -->
            <div class="flex items-center justify-between p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
              <div>
                <h3 class="text-sm font-black text-indigo-950 dark:text-indigo-200 uppercase tracking-tight">ERP Invoice Print Master</h3>
                <p class="text-xs text-indigo-700/80 dark:text-indigo-300 font-medium mt-0.5">
                  Universal configuration applied to all Sales Invoices, Purchase Bills, and Delivery Notes.
                </p>
              </div>
              <div class="text-right shrink-0">
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-zinc-800 rounded-xl text-indigo-600 dark:text-indigo-400 text-xs font-black shadow-xs border border-indigo-100 dark:border-zinc-700">
                  <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                  {{ activeColumnsCount }} Columns Active
                </span>
              </div>
            </div>

            <!-- Group 1: Copy Title & Bank Account -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800">
                1. Header & Financial Details
              </h4>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Copy Type -->
                <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-black text-slate-800 dark:text-zinc-200">Default Copy Title</label>
                    <span class="text-[10px] text-slate-400 font-medium">Header label</span>
                  </div>
                  <select 
                    v-model="localPrintConfig.defaultCopyType"
                    class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ORIGINAL FOR RECIPIENT">ORIGINAL FOR RECIPIENT</option>
                    <option value="DUPLICATE FOR TRANSPORTER">DUPLICATE FOR TRANSPORTER</option>
                    <option value="TRIPLICATE FOR SUPPLIER">TRIPLICATE FOR SUPPLIER</option>
                    <option value="OFFICE COPY">OFFICE COPY</option>
                    <option value="">NO COPY LABEL (BLANK)</option>
                  </select>
                </div>

                <!-- Bank Account Selector -->
                <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-black text-slate-800 dark:text-zinc-200">Default Bank for Invoices</label>
                    <label class="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 cursor-pointer">
                      <input type="checkbox" v-model="localPrintConfig.showBank" class="rounded text-indigo-600" />
                      <span>Show Bank</span>
                    </label>
                  </div>
                  <select 
                    v-model="localPrintConfig.defaultBankAccountId"
                    class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Default Firm Account (Primary)</option>
                    <option 
                      v-for="b in bankAccounts" 
                      :key="b._id" 
                      :value="b._id"
                    >
                      {{ b.bank_name }} - {{ b.account_number }} {{ b.is_default ? '(Default)' : '' }}
                    </option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Group 2: Table Columns Visibility -->
            <div class="space-y-3">
              <div class="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-zinc-800">
                <h4 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                  2. Table Column Visibility Toggles
                </h4>
                <span class="text-[10px] text-slate-400 font-medium">Included in printed invoice tables</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <!-- HSN -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showHsn ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showHsn" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">HSN / SAC</span>
                </label>

                <!-- Qty -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showQty ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showQty" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">Quantity</span>
                </label>

                <!-- UOM -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showUom ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showUom" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">UOM (Unit)</span>
                </label>

                <!-- Rate -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showRate ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showRate" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">Unit Rate</span>
                </label>

                <!-- Disc -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showDisc ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showDisc" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">Discount %</span>
                </label>

                <!-- GST -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showGst ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showGst" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">GST %</span>
                </label>

                <!-- Batch -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showBatch ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showBatch" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">Batch No</span>
                </label>

                <!-- Narration -->
                <label 
                  class="flex items-center gap-2.5 p-3 rounded-2xl border transition cursor-pointer"
                  :class="localPrintConfig.showNarration ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60 text-indigo-950 dark:text-indigo-200' : 'bg-slate-50 dark:bg-zinc-800/40 border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400'"
                >
                  <input type="checkbox" v-model="localPrintConfig.showNarration" class="rounded text-indigo-600 focus:ring-indigo-500" />
                  <span class="text-xs font-bold">Item Note</span>
                </label>
              </div>
            </div>

            <!-- Group 3: Legal & Signatory -->
            <div class="space-y-3">
              <h4 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800">
                3. Legal & Statutory Footers
              </h4>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">Jurisdiction Statement</label>
                  <input 
                    v-model="localPrintConfig.jurisdiction"
                    type="text"
                    placeholder="e.g. Subject to Kolkata Jurisdiction only."
                    class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div class="space-y-1.5">
                  <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">Authorised Signatory Designation</label>
                  <input 
                    v-model="localPrintConfig.signatoryTitle"
                    type="text"
                    placeholder="e.g. Authorised Signatory"
                    class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs font-bold text-slate-700 dark:text-zinc-300">Statutory Declaration Note</label>
                <input 
                  v-model="localPrintConfig.declaration"
                  type="text"
                  placeholder="e.g. Certified that the particulars given above are true and correct."
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <!-- Save Action Button Area -->
            <div class="pt-2 flex items-center justify-between">
              <div v-if="saveSuccessMessage" class="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <UIcon name="i-heroicons-check-circle" class="w-4 h-4" />
                <span>{{ saveSuccessMessage }}</span>
              </div>
              <div v-else></div>

              <UButton
                color="primary"
                icon="i-heroicons-check"
                :loading="printSaving"
                label="Save ERP Print Settings"
                size="sm"
                class="font-black px-4 py-2 text-xs rounded-xl shadow-md cursor-pointer"
                @click="handleSaveErpPrintConfig"
              />
            </div>
          </div>

          <!-- ================= TAB 2: APPEARANCE & THEME ================= -->
          <div v-else-if="activeTab === 'interface'" class="space-y-6 animate-in fade-in duration-150">
            <h3 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800">
              Interface & Color Theme
            </h3>

            <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">Application Theme Mode</label>
                <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Select primary dark or light interface scheme.</p>
              </div>
              <select
                :value="preferences.theme"
                @change="updatePreference('theme', ($event.target as HTMLSelectElement).value)"
                class="w-full sm:w-auto px-3.5 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="light">☀️ Light Scheme</option>
                <option value="dark">🌙 Dark Scheme</option>
              </select>
            </div>
          </div>

          <!-- ================= TAB 3: UTILITY TOOLS DEFAULTS ================= -->
          <div v-else-if="activeTab === 'utility'" class="space-y-6 animate-in fade-in duration-150">
            <h3 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800">
              Productivity Tools Defaults
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Default Currency -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">Default Currency</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Base currency in Forex converter</p>
                </div>
                <select
                  :value="preferences.defaultCurrency"
                  @change="updatePreference('defaultCurrency', ($event.target as HTMLSelectElement).value)"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>

              <!-- Temperature Unit -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">Temperature Scale</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Weather widget unit</p>
                </div>
                <select
                  :value="preferences.defaultTempUnit"
                  @change="updatePreference('defaultTempUnit', ($event.target as HTMLSelectElement).value)"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="C">Celsius (°C)</option>
                  <option value="F">Fahrenheit (°F)</option>
                </select>
              </div>

              <!-- News Language -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">News Feed Language</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Google RSS updates feed</p>
                </div>
                <select
                  :value="preferences.defaultNewsLang"
                  @change="updatePreference('defaultNewsLang', ($event.target as HTMLSelectElement).value)"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
                >
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="bn">বাংলা (Bengali)</option>
                </select>
              </div>

              <!-- Notepad Font Size -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl space-y-2">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">Notepad Text Size</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium">Text editor typing font</p>
                </div>
                <select
                  :value="preferences.notepadFontSize"
                  @change="updatePreference('notepadFontSize', Number(($event.target as HTMLSelectElement).value))"
                  class="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer font-mono"
                >
                  <option value="12">12px (Compact)</option>
                  <option value="14">14px (Standard)</option>
                  <option value="16">16px (Medium)</option>
                  <option value="18">18px (Large)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- ================= TAB 4: BACKUP & DATA SYNC ================= -->
          <div v-else-if="activeTab === 'data'" class="space-y-6 animate-in fade-in duration-150">
            <h3 class="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800">
              Configuration Sync & Backup
            </h3>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Export -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-3">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">Export Full Config Bundle</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Download a JSON file containing all ERP print rules and tool preferences.</p>
                </div>
                <button
                  type="button"
                  class="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 transition cursor-pointer flex items-center justify-center gap-2"
                  @click="exportPrefs"
                >
                  <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
                  <span>Export JSON File</span>
                </button>
              </div>

              <!-- Import -->
              <div class="p-4 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-800 rounded-2xl flex flex-col justify-between gap-3">
                <div>
                  <label class="text-xs font-black text-slate-900 dark:text-white block">Import Configuration File</label>
                  <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-0.5">Restore previously exported settings bundle from your device.</p>
                </div>
                <button
                  type="button"
                  class="w-full px-3 py-2.5 bg-white dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-zinc-700 transition cursor-pointer flex items-center justify-center gap-2"
                  @click="triggerImport"
                >
                  <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4" />
                  <span>Choose JSON File</span>
                </button>
              </div>
            </div>

            <div class="p-4 rounded-2xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between gap-3">
              <div>
                <span class="text-xs font-black text-rose-900 dark:text-rose-300 block">Factory Reset Settings</span>
                <span class="text-[10px] text-rose-600 dark:text-rose-400 font-medium">Revert all print layout columns and tool options to system initial state.</span>
              </div>
              <button
                type="button"
                class="px-3.5 py-2 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 text-xs font-black rounded-xl transition cursor-pointer shrink-0"
                @click="resetDefaults"
              >
                Reset Defaults
              </button>
            </div>
          </div>

        </div>
      </div>

      <!-- Bottom Footer Bar -->
      <div class="px-6 py-3.5 bg-slate-50/90 dark:bg-zinc-900/90 border-t border-slate-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
        <div class="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
          <span class="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Unified ERP Configuration Hub</span>
        </div>

        <button
          type="button"
          class="px-5 py-2 bg-slate-200 dark:bg-zinc-800 hover:bg-slate-300 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition cursor-pointer"
          @click="emit('close')"
        >
          Close (Esc)
        </button>
      </div>
    </div>
  </div>
</template>
