<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useGlobalTools } from '~/composables/useGlobalTools'

import CalculatorModal from './CalculatorModal.vue'
import CalendarModal from './CalendarModal.vue'
import NotepadModal from './NotepadModal.vue'
import StopwatchModal from './StopwatchModal.vue'
import UnitConverterModal from './UnitConverterModal.vue'
import TextStudioModal from './TextStudioModal.vue'
import WeatherModal from './WeatherModal.vue'
import NewsModal from './NewsModal.vue'
import SettingsModal from './SettingsModal.vue'

const {
  isLauncherOpen,
  activeToolId,
  openLauncher,
  closeLauncher,
  toggleLauncher,
  openTool,
  closeTool
} = useGlobalTools()

const searchQuery = ref('')
const selectedCategory = ref<string>('all')
const activeIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)
const listContainer = ref<HTMLDivElement | null>(null)

interface ToolItem {
  id: string
  badge: string
  iconName: string
  color: string
  category: 'erp' | 'finance' | 'productivity' | 'utilities'
  categoryLabel: string
  title: string
  subtitle: string
  description: string
  keywords: string
}

const tools: ToolItem[] = [
  {
    id: 'settings',
    badge: '⚙️',
    iconName: 'i-heroicons-cog-6-tooth',
    color: 'indigo',
    category: 'erp',
    categoryLabel: 'ERP Master',
    title: 'ERP & Print Settings',
    subtitle: 'System Master Config',
    description: 'Configure invoice print templates, PDF table columns, bank defaults, themes, and global settings.',
    keywords: 'settings preferences configs options backup tools invoice bill print pdf layout bank hsn legal signature erp'
  },
  {
    id: 'calculator',
    badge: '🔢',
    iconName: 'i-heroicons-calculator',
    color: 'emerald',
    category: 'finance',
    categoryLabel: 'Finance & Math',
    title: 'Calculator Suite',
    subtitle: 'Standard & Financial',
    description: 'Standard, scientific, investments, EMI, GST, percentages, and profit & loss calculators.',
    keywords: 'calc math evaluate emi gst sip finance calculator'
  },
  {
    id: 'converter',
    badge: '💱',
    iconName: 'i-heroicons-arrows-right-left',
    color: 'teal',
    category: 'finance',
    categoryLabel: 'Finance & Math',
    title: 'Unit & Currency Forex',
    subtitle: 'Live Rates & Measures',
    description: 'Convert lengths, weights, temperatures, and live currency rates powered by Frankfurter API.',
    keywords: 'converter convert units currency forex weight mass length temperature exchange inr usd eur gbp'
  },
  {
    id: 'notepad',
    badge: '📝',
    iconName: 'i-heroicons-document-text',
    color: 'violet',
    category: 'productivity',
    categoryLabel: 'Productivity',
    title: 'Notepad Workspace',
    subtitle: 'Markdown & Scratchpad',
    description: 'Markdown-friendly text editor with local auto-save, note management, and file exports.',
    keywords: 'notepad notes write editor memo draft markdown text'
  },
  {
    id: 'calendar',
    badge: '📅',
    iconName: 'i-heroicons-calendar',
    color: 'amber',
    category: 'productivity',
    categoryLabel: 'Productivity',
    title: 'Calendar & Agenda',
    subtitle: 'Daily Schedules',
    description: 'Browse monthly calendars and log daily agenda items, schedules, or task notes.',
    keywords: 'calendar date agenda notes planner schedules events'
  },
  {
    id: 'stopwatch',
    badge: '⏱️',
    iconName: 'i-heroicons-clock',
    color: 'rose',
    category: 'productivity',
    categoryLabel: 'Productivity',
    title: 'Stopwatch & Timer',
    subtitle: 'Precision Milliseconds',
    description: 'High-precision millisecond stopwatch with split laps logging table and timer.',
    keywords: 'stopwatch time lap clock count timer splits'
  },
  {
    id: 'textstudio',
    badge: '🔤',
    iconName: 'i-heroicons-code-bracket-square',
    color: 'blue',
    category: 'utilities',
    categoryLabel: 'Utilities',
    title: 'Text Studio',
    subtitle: 'Format & Encoding',
    description: 'Casing transformations, cleaning, ROT13, base64 encoding/decoding, and live Markdown preview.',
    keywords: 'text studio rot13 base64 markdown preview uppercase titlecase string format sanitize'
  },
  {
    id: 'weather',
    badge: '🌤️',
    iconName: 'i-heroicons-cloud',
    color: 'sky',
    category: 'utilities',
    categoryLabel: 'Utilities',
    title: 'Weather Dashboard',
    subtitle: 'Forecast & AQI',
    description: 'Check real-time weather conditions, wind speeds, Air Quality Index (AQI), and 7-day forecast cards.',
    keywords: 'weather temp temperature forecast rain geocode location aqi wind air quality'
  },
  {
    id: 'news',
    badge: '📰',
    iconName: 'i-heroicons-newspaper',
    color: 'orange',
    category: 'utilities',
    categoryLabel: 'Utilities',
    title: 'Daily News Feed',
    subtitle: 'Hindi & Bengali RSS',
    description: 'Stay updated with Google RSS news articles translated in Hindi & Bengali business and tech tabs.',
    keywords: 'news updates google rss feed reader business politics hindi bengali headlines'
  }
]

const categories = [
  { id: 'all', label: 'All Utilities', icon: 'i-heroicons-squares-2x2' },
  { id: 'erp', label: 'ERP & Master', icon: 'i-heroicons-cog-6-tooth' },
  { id: 'finance', label: 'Finance & Math', icon: 'i-heroicons-calculator' },
  { id: 'productivity', label: 'Productivity', icon: 'i-heroicons-document-text' },
  { id: 'utilities', label: 'Feeds & Tools', icon: 'i-heroicons-wrench-screwdriver' }
]

const filteredTools = computed(() => {
  let list = tools
  
  if (selectedCategory.value !== 'all') {
    list = list.filter(t => t.category === selectedCategory.value)
  }

  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return list

  return list.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.categoryLabel.toLowerCase().includes(q) ||
      t.keywords.includes(q)
  )
})

// Reset active index on search or category change
watch([searchQuery, selectedCategory], () => {
  activeIndex.value = 0
})

// Focus input when opened
watch(isLauncherOpen, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    selectedCategory.value = 'all'
    activeIndex.value = 0
    await nextTick()
    searchInput.value?.focus()
  }
})

const handleKeyDown = (e: KeyboardEvent) => {
  const isCtrlOrCmd = e.ctrlKey || e.metaKey
  const isPeriod = e.key === '.' || e.code === 'Period'

  if (isCtrlOrCmd && isPeriod) {
    e.preventDefault()
    e.stopPropagation()
    toggleLauncher()
    return
  }

  if (isLauncherOpen.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closeLauncher()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (filteredTools.value.length > 0) {
        activeIndex.value = (activeIndex.value + 1) % filteredTools.value.length
        scrollActiveIntoView()
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (filteredTools.value.length > 0) {
        activeIndex.value = (activeIndex.value - 1 + filteredTools.value.length) % filteredTools.value.length
        scrollActiveIntoView()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredTools.value[activeIndex.value]
      if (selected) {
        openTool(selected.id)
      }
    }
  }
}

const scrollActiveIntoView = () => {
  nextTick(() => {
    const container = listContainer.value
    if (!container) return
    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement
    if (!activeEl) return

    const cTop = container.scrollTop
    const cBottom = cTop + container.clientHeight
    const eTop = activeEl.offsetTop
    const eBottom = eTop + activeEl.clientHeight

    if (eTop < cTop) {
      container.scrollTop = eTop
    } else if (eBottom > cBottom) {
      container.scrollTop = eBottom - container.clientHeight
    }
  })
}

function getBadgeBg(color: string) {
  switch (color) {
    case 'indigo': return 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60'
    case 'emerald': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
    case 'teal': return 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border-teal-200 dark:border-teal-800/60'
    case 'violet': return 'bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/60'
    case 'amber': return 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
    case 'rose': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
    case 'blue': return 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60'
    case 'sky': return 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/60'
    case 'orange': return 'bg-orange-50 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800/60'
    default: return 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700'
  }
}

onMounted(() => {
  if (import.meta.client) {
    window.addEventListener('keydown', handleKeyDown, true)
  }
})

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeyDown, true)
  }
})
</script>

<template>
  <div>
    <!-- Launcher Spotlight Modal -->
    <div
      v-if="isLauncherOpen"
      class="fixed inset-0 flex items-start justify-center pt-3 sm:pt-[8vh] p-2 sm:p-4 bg-slate-950/60 dark:bg-slate-950/80 backdrop-blur-md"
      style="z-index: 99999;"
      @click.self="closeLauncher"
    >
      <div
        class="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl shadow-black/40 w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
      >
        <!-- Header & Search Section -->
        <div class="p-5 sm:p-6 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/40">
          <div class="flex justify-between items-center mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <UIcon name="i-heroicons-sparkles" class="w-5 h-5" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-md">ERP Global Suite</span>
                  <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Spotlight Launcher</span>
                </div>
                <h2 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">System Utilities & Tools</h2>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-600 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700 text-xs font-mono font-bold shadow-xs">
                <span>Ctrl</span>
                <span>+</span>
                <span>.</span>
              </div>
              <button
                type="button"
                class="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition cursor-pointer"
                @click="closeLauncher"
              >
                <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
              </button>
            </div>
          </div>

          <!-- Search Input Box -->
          <div class="relative mt-4">
            <UIcon 
              name="i-heroicons-magnifying-glass" 
              class="w-5 h-5 text-slate-400 dark:text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" 
            />
            <input
              ref="searchInput"
              v-model="searchQuery"
              class="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-xs transition-all"
              type="text"
              autocomplete="off"
              placeholder="Search tools or features... (e.g. print settings, calculator, weather, forex, notepad)"
            />
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''" 
              class="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <UIcon name="i-heroicons-x-circle" class="w-4 h-4" />
            </button>
          </div>

          <!-- Category Filter Tabs -->
          <div class="flex items-center gap-1.5 mt-3.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              v-for="cat in categories"
              :key="cat.id"
              type="button"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer"
              :class="[
                selectedCategory === cat.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white dark:bg-zinc-900 text-slate-600 dark:text-zinc-400 border border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
              ]"
              @click="selectedCategory = cat.id"
            >
              <UIcon :name="cat.icon" class="w-3.5 h-3.5" />
              <span>{{ cat.label }}</span>
            </button>
          </div>
        </div>

        <!-- Tool Cards Grid (2-Column Enterprise Layout) -->
        <div
          ref="listContainer"
          class="overflow-y-auto p-4 sm:p-6 bg-slate-50/30 dark:bg-zinc-900/50 flex-1 min-h-0"
        >
          <div
            v-if="filteredTools.length === 0"
            class="text-center text-slate-400 dark:text-zinc-500 py-16 text-xs font-bold uppercase tracking-widest flex flex-col items-center gap-2"
          >
            <UIcon name="i-heroicons-magnifying-glass" class="w-8 h-8 text-slate-300 dark:text-zinc-600" />
            <span>No tools matching "{{ searchQuery }}"</span>
          </div>

          <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <button
              v-for="(tool, index) in filteredTools"
              :key="tool.id"
              type="button"
              class="group flex flex-col justify-between p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer relative"
              :class="[
                index === activeIndex
                  ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/15 text-white scale-[1.01]'
                  : 'bg-white dark:bg-zinc-850/90 border-slate-200/80 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700 hover:shadow-md text-slate-700 dark:text-zinc-300'
              ]"
              :data-active="index === activeIndex"
              @mouseenter="activeIndex = index"
              @click="openTool(tool.id)"
            >
              <!-- Card Top Header -->
              <div>
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div
                    class="w-11 h-11 rounded-2xl flex items-center justify-center text-lg shrink-0 border transition-transform group-hover:scale-105"
                    :class="index === activeIndex ? 'bg-white/20 text-white border-white/20' : getBadgeBg(tool.color)"
                  >
                    <span>{{ tool.badge }}</span>
                  </div>

                  <span
                    class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                    :class="[
                      index === activeIndex 
                        ? 'bg-white/20 text-white' 
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 font-bold'
                    ]"
                  >
                    {{ tool.categoryLabel }}
                  </span>
                </div>

                <!-- Title & Subtitle -->
                <div>
                  <h4
                    class="text-sm font-black tracking-tight"
                    :class="[index === activeIndex ? 'text-white' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400']"
                  >
                    {{ tool.title }}
                  </h4>
                  <p
                    class="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                    :class="[index === activeIndex ? 'text-indigo-200' : 'text-slate-400 dark:text-zinc-500']"
                  >
                    {{ tool.subtitle }}
                  </p>
                </div>

                <!-- Description -->
                <p
                  class="text-xs mt-2 font-medium leading-relaxed line-clamp-2"
                  :class="[index === activeIndex ? 'text-indigo-100' : 'text-slate-500 dark:text-zinc-400']"
                >
                  {{ tool.description }}
                </p>
              </div>

              <!-- Card Bottom Action Hint -->
              <div 
                class="mt-4 pt-2.5 border-t flex items-center justify-between text-[10px] font-bold"
                :class="[
                  index === activeIndex 
                    ? 'border-indigo-500/40 text-indigo-100' 
                    : 'border-slate-100 dark:border-zinc-800/80 text-slate-400 dark:text-zinc-500'
                ]"
              >
                <span>Launch Tool</span>
                <span class="flex items-center gap-1 font-mono font-bold">
                  <span>Open</span>
                  <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- Footer Instructions & Summary -->
        <div class="px-6 py-3.5 bg-slate-50/90 dark:bg-zinc-950/70 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider shrink-0">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{{ filteredTools.length }} Tools Ready</span>
          </div>

          <div class="flex items-center gap-4">
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded font-mono text-[9px]">↵</kbd> Open</span>
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded font-mono text-[9px]">↑↓</kbd> Navigate</span>
            <span class="flex items-center gap-1"><kbd class="px-1.5 py-0.5 bg-slate-200 dark:bg-zinc-800 rounded font-mono text-[9px]">Esc</kbd> Close</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals Host -->
    <CalculatorModal v-if="activeToolId === 'calculator'" @close="closeTool" />
    <CalendarModal v-if="activeToolId === 'calendar'" @close="closeTool" />
    <NotepadModal v-if="activeToolId === 'notepad'" @close="closeTool" />
    <StopwatchModal v-if="activeToolId === 'stopwatch'" @close="closeTool" />
    <UnitConverterModal v-if="activeToolId === 'converter'" @close="closeTool" />
    <TextStudioModal v-if="activeToolId === 'textstudio'" @close="closeTool" />
    <WeatherModal v-if="activeToolId === 'weather'" @close="closeTool" />
    <NewsModal v-if="activeToolId === 'news'" @close="closeTool" />
    <SettingsModal v-if="activeToolId === 'settings'" @close="closeTool" />
  </div>
</template>
