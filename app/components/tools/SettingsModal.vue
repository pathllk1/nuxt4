<script setup lang="ts">
import { ref, onMounted } from 'vue'

const emit = defineEmits(['close'])

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

const resetDefaults = () => {
  if (confirm('Reset all tool preferences to defaults?')) {
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
  }
}

const exportPrefs = () => {
  const blob = new Blob([JSON.stringify(preferences.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tool-preferences-${new Date().toISOString().split('T')[0]}.json`
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
      preferences.value = { ...preferences.value, ...parsed }
      savePreferences()
      applyTheme(preferences.value.theme)
      alert('Preferences imported successfully!')
    } catch (err) {
      alert('Failed to parse preferences file.')
    }
  }
  input.click()
}

onMounted(() => {
  loadPreferences()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl h-[95vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Global Tools Settings</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Preferences</h2>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Settings List Content -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-white dark:bg-slate-900 min-h-0">
        
        <!-- General Preferences -->
        <div>
          <h3 class="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            Interface Preferences
          </h3>
          <div class="space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">Application Theme</label>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Select default system dashboard styling theme.</p>
              </div>
              <select
                :value="preferences.theme"
                @change="updatePreference('theme', ($event.target as HTMLSelectElement).value)"
                class="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="light">Light Theme</option>
                <option value="dark">Dark Theme</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Tool-specific Defaults -->
        <div>
          <h3 class="text-[10px] font-black text-slate-400 dark:text-slate-550 uppercase tracking-widest mb-4 pb-2 border-b border-slate-200 dark:border-slate-800">
            Utility Defaults
          </h3>
          <div class="space-y-3">
            <!-- Default Currency -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">Default Currency</label>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Pre-selected base currency in converter.</p>
              </div>
              <select
                :value="preferences.defaultCurrency"
                @change="updatePreference('defaultCurrency', ($event.target as HTMLSelectElement).value)"
                class="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer font-mono"
              >
                <option value="INR">INR (₹)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>

            <!-- Temp Unit -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">Temperature Scale</label>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Default unit for weather temperature display.</p>
              </div>
              <select
                :value="preferences.defaultTempUnit"
                @change="updatePreference('defaultTempUnit', ($event.target as HTMLSelectElement).value)"
                class="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
              </select>
            </div>

            <!-- News Lang -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">News Feed Language</label>
                <p class="text-[10px] text-slate-550 dark:text-slate-400 font-medium">Default selected language for RSS updates.</p>
              </div>
              <select
                :value="preferences.defaultNewsLang"
                @change="updatePreference('defaultNewsLang', ($event.target as HTMLSelectElement).value)"
                class="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer"
              >
                <option value="hi">हिंदी (Hindi)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>

            <!-- Notepad font -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-slate-300 dark:hover:border-slate-700 transition">
              <div>
                <label class="text-xs font-black text-slate-900 dark:text-white block mb-0.5">Notepad Font Size</label>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Set body text editor font size in Notepad.</p>
              </div>
              <select
                :value="preferences.notepadFontSize"
                @change="updatePreference('notepadFontSize', Number(($event.target as HTMLSelectElement).value))"
                class="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl text-xs font-bold focus:outline-none cursor-pointer font-mono"
              >
                <option value="12">12px</option>
                <option value="14">14px</option>
                <option value="16">16px</option>
                <option value="18">18px</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Actions -->
      <div class="px-4 py-4 sm:px-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row gap-3 sm:gap-0 justify-between items-stretch sm:items-center shrink-0">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="flex-1 sm:flex-initial px-3 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-xl uppercase tracking-widest transition cursor-pointer border border-slate-200 dark:border-slate-700"
            @click="resetDefaults"
          >
            Reset defaults
          </button>
          <button
            type="button"
            class="flex-1 sm:flex-initial px-3 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-xl uppercase tracking-widest transition cursor-pointer border border-slate-200 dark:border-slate-700"
            @click="exportPrefs"
          >
            Export
          </button>
          <button
            type="button"
            class="flex-1 sm:flex-initial px-3 py-2 bg-white dark:bg-slate-850 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black rounded-xl uppercase tracking-widest transition cursor-pointer border border-slate-200 dark:border-slate-700"
            @click="triggerImport"
          >
            Import
          </button>
        </div>
        <button
          type="button"
          class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-xl uppercase tracking-widest transition cursor-pointer shadow-lg shadow-indigo-950/20"
          @click="emit('close')"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>
