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
const activeIndex = ref(0)
const searchInput = ref<HTMLInputElement | null>(null)
const listContainer = ref<HTMLDivElement | null>(null)

const tools = [
  {
    id: 'calculator',
    badge: 'Calc',
    title: 'Calculator Suite',
    subtitle: 'Standard & Scientific',
    description: 'Standard, scientific, investments, EMI, GST, percentages, and profit & loss calculators.',
    keywords: 'calc math evaluate emi gst sip finance calculator'
  },
  {
    id: 'calendar',
    badge: 'Date',
    title: 'Calendar & Agenda',
    subtitle: 'Daily Planner',
    description: 'Browse monthly calendars and log daily agenda items or notes.',
    keywords: 'calendar date agenda notes planner schedules'
  },
  {
    id: 'notepad',
    badge: 'Note',
    title: 'Notepad Workspace',
    subtitle: 'Multi-Note Editor',
    description: 'Markdown-friendly text editor with local auto-save, note management, and file exports.',
    keywords: 'notepad notes write editor memo draft markdown'
  },
  {
    id: 'stopwatch',
    badge: 'Time',
    title: 'Stopwatch & Timer',
    subtitle: 'Precision Milliseconds',
    description: 'High-precision millisecond stopwatch with lap splits logging table.',
    keywords: 'stopwatch time lap clock count stopwatch'
  },
  {
    id: 'converter',
    badge: 'Unit',
    title: 'Unit & Currency',
    subtitle: 'Forex & Measures',
    description: 'Convert lengths, weights, temperatures, and live currency rates powered by Frankfurter API.',
    keywords: 'converter convert units currency forex weight mass length temperature exchange'
  },
  {
    id: 'textstudio',
    badge: 'Text',
    title: 'Text Studio',
    subtitle: 'Formatting Tools',
    description: 'Casing transformations, cleaning, ROT13, base64 encoding/decoding, and live Markdown preview.',
    keywords: 'text studio rot13 base64 markdown preview uppercase titlecase string format'
  },
  {
    id: 'weather',
    badge: '🌤️',
    title: 'Weather Dashboard',
    subtitle: 'Forecast & AQI',
    description: 'Check real-time conditions, wind speeds, Air Quality Index (AQI), and 7-day forecast cards.',
    keywords: 'weather temp temperature forecast rain geocode location aqi wind'
  },
  {
    id: 'news',
    badge: '📰',
    title: 'Daily News Feed',
    subtitle: 'Hindi & Bengali',
    description: 'Stay updated with Google RSS news articles translated or in Hindi/Bengali business & politics tabs.',
    keywords: 'news updates google rss feed reader business politics hindi bengali'
  },
  {
    id: 'settings',
    badge: '⚙️',
    title: 'Utility Settings',
    subtitle: 'Preferences',
    description: 'Manage general utility configurations, local backups, and app settings.',
    keywords: 'settings preferences configs options backup tools'
  }
]

const filteredTools = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.subtitle.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.keywords.includes(q)
  )
})

// Reset active index on search
watch(searchQuery, () => {
  activeIndex.value = 0
})

// Focus input when opened
watch(isLauncherOpen, async (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    activeIndex.value = 0
    await nextTick()
    searchInput.value?.focus()
  }
})

const handleKeyDown = (e: KeyboardEvent) => {
  // Global Ctrl + . shortcut (also supports Cmd + .)
  const isCtrlOrCmd = e.ctrlKey || e.metaKey
  const isPeriod = e.key === '.' || e.code === 'Period'

  if (isCtrlOrCmd && isPeriod) {
    e.preventDefault()
    e.stopPropagation()
    toggleLauncher()
    return
  }

  // Handle keys when launcher is open
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
      class="fixed inset-0 flex items-start justify-center pt-2 sm:pt-[12vh] p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-md"
      style="z-index: 99999;"
      @click.self="closeLauncher"
    >
      <div
        class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black/50 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        <!-- Header & Input -->
        <div class="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div class="flex justify-between items-center mb-3">
            <div>
              <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Global Tools</p>
              <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">Utility Launcher</h2>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 border border-slate-205 dark:border-slate-700 text-[10px] font-bold">
              <span>Ctrl</span>
              <span>+</span>
              <span>.</span>
            </div>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium">Quickly launch system utilities and helper tools.</p>
          <div class="relative mt-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
            </svg>
            <input
              ref="searchInput"
              v-model="searchQuery"
              class="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl sm:rounded-2xl text-slate-900 dark:text-white text-sm font-bold placeholder:text-slate-450 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all"
              type="text"
              autocomplete="off"
              placeholder="Search tools... (e.g. calculator, weather, notepad)"
            />
          </div>
        </div>

        <!-- Results List -->
        <div
          ref="listContainer"
          class="overflow-y-auto p-2 sm:p-4 space-y-2 bg-slate-50/10 dark:bg-slate-900/60"
          style="max-height: 380px;"
        >
          <div
            v-if="filteredTools.length === 0"
            class="text-center text-slate-450 dark:text-slate-500 py-12 text-xs font-bold uppercase tracking-widest"
          >
            No matching tools found
          </div>
          <button
            v-for="(tool, index) in filteredTools"
            :key="tool.id"
            type="button"
            class="w-full group flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-150 cursor-pointer"
            :class="[
              index === activeIndex
                ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-600/10 text-white'
                : 'bg-slate-50/50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 hover:border-slate-350 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
            ]"
            :data-active="index === activeIndex"
            @mouseenter="activeIndex = index"
            @click="openTool(tool.id)"
          >
            <!-- Badge Icon -->
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-tighter shrink-0 transition-colors duration-150"
              :class="[
                index === activeIndex
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
              ]"
            >
              {{ tool.badge }}
            </div>
            <!-- Text Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-baseline justify-between gap-2">
                <h4
                  class="text-sm font-black truncate"
                  :class="[index === activeIndex ? 'text-white' : 'text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400']"
                >
                  {{ tool.title }}
                </h4>
                <span
                  class="text-[9px] font-black uppercase tracking-widest"
                  :class="[index === activeIndex ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500']"
                >
                  {{ tool.subtitle }}
                </span>
              </div>
              <p
                class="text-xs mt-1 font-medium leading-relaxed line-clamp-2"
                :class="[index === activeIndex ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400']"
              >
                {{ tool.description }}
              </p>
            </div>
          </button>
        </div>

        <!-- Footer Instructions -->
        <div class="px-4 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-950 border-t border-slate-205 dark:border-slate-800 flex gap-5 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
          <span>↵ Enter to open</span>
          <span>↑↓ Navigate</span>
          <span>Esc to close</span>
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
