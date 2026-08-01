<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'

const emit = defineEmits(['close'])

const mode = ref<'stopwatch' | 'timer'>('stopwatch')
const running = ref(false)
const startedAt = ref<number | null>(null)
const elapsed = ref(0)
const timerDurationMin = ref(5)
const timerRemaining = ref(5 * 60 * 1000)
const laps = ref<number[]>([])

const displayTime = ref(0)
let tickerId: any = null

const formatDuration = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0')
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  const centiseconds = String(Math.floor((ms % 1000) / 10)).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}.${centiseconds}`
}

const startTicker = () => {
  if (running.value) return
  running.value = true
  startedAt.value = Date.now()
  tickerId = setInterval(tick, 33)
}

const pauseTicker = () => {
  if (!running.value) return
  running.value = false
  if (startedAt.value) {
    const diff = Date.now() - startedAt.value
    if (mode.value === 'stopwatch') {
      elapsed.value += diff
    } else {
      timerRemaining.value = Math.max(0, timerRemaining.value - diff)
    }
  }
  startedAt.value = null
  if (tickerId) {
    clearInterval(tickerId)
    tickerId = null
  }
}

const tick = () => {
  if (!startedAt.value) return
  const diff = Date.now() - startedAt.value
  if (mode.value === 'stopwatch') {
    displayTime.value = elapsed.value + diff
  } else {
    const remaining = timerRemaining.value - diff
    if (remaining <= 0) {
      displayTime.value = 0
      pauseTicker()
      timerRemaining.value = 0
    } else {
      displayTime.value = remaining
    }
  }
}

const resetTicker = () => {
  pauseTicker()
  elapsed.value = 0
  timerRemaining.value = timerDurationMin.value * 60 * 1000
  displayTime.value = mode.value === 'stopwatch' ? 0 : timerRemaining.value
  laps.value = []
}

const recordLap = () => {
  if (mode.value !== 'stopwatch') return
  laps.value.unshift(displayTime.value)
  if (laps.value.length > 20) {
    laps.value.pop()
  }
}

const changeMode = (newMode: 'stopwatch' | 'timer') => {
  pauseTicker()
  mode.value = newMode
  resetTicker()
}

const handleTimerDurationChange = () => {
  const min = Math.max(1, Number(timerDurationMin.value || 1))
  timerDurationMin.value = min
  if (!running.value && mode.value === 'timer') {
    timerRemaining.value = min * 60 * 1000
    displayTime.value = timerRemaining.value
  }
}

onUnmounted(() => {
  if (tickerId) {
    clearInterval(tickerId)
  }
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col"
    >
      <!-- Header -->
      <div class="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Time Utility</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Precision Timer</h2>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-550 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Main Workspace -->
      <div class="p-4 sm:p-8 space-y-6 bg-white dark:bg-slate-900 overflow-y-auto">
        <!-- Mode Switcher -->
        <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-inner">
          <div class="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest ml-4">
            {{ mode === 'stopwatch' ? 'Stopwatch' : 'Countdown timer' }}
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer"
              :class="[mode === 'stopwatch' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700']"
              @click="changeMode('stopwatch')"
            >
              Stopwatch
            </button>
            <button
              type="button"
              class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition cursor-pointer"
              :class="[mode === 'timer' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 dark:text-slate-400 bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700']"
              @click="changeMode('timer')"
            >
              Timer
            </button>
          </div>
        </div>

        <!-- Large Digital Clock Display -->
        <div class="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white text-center py-8 sm:py-10 font-mono tracking-tighter tabular-nums bg-slate-50 dark:bg-slate-955 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-inner">
          {{ formatDuration(displayTime) }}
        </div>

        <!-- Buttons Grid -->
        <div class="grid grid-cols-2 gap-4">
          <button
            v-if="!running"
            type="button"
            class="bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-emerald-950/20 cursor-pointer"
            @click="startTicker"
          >
            Start
          </button>
          <button
            v-else
            type="button"
            class="bg-amber-600 hover:bg-amber-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition shadow-lg shadow-amber-900/20 cursor-pointer"
            @click="pauseTicker"
          >
            Pause
          </button>
          
          <button
            type="button"
            class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-705 dark:text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition cursor-pointer"
            @click="resetTicker"
          >
            Reset
          </button>

          <button
            v-if="mode === 'stopwatch'"
            type="button"
            class="col-span-2 bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800/80 text-indigo-600 dark:text-indigo-400 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition cursor-pointer"
            :disabled="!running"
            :class="[!running ? 'opacity-40 cursor-not-allowed' : '']"
            @click="recordLap"
          >
            Record Lap Split
          </button>
        </div>

        <!-- Timer Minutes Input -->
        <div v-if="mode === 'timer'" class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80">
          <label class="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest shrink-0">Target Duration (Minutes)</label>
          <input
            type="number"
            min="1"
            step="1"
            v-model.number="timerDurationMin"
            class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white font-black text-center focus:outline-none focus:border-indigo-500 font-mono"
            @input="handleTimerDurationChange"
          />
        </div>

        <!-- Lap History -->
        <div v-if="mode === 'stopwatch'" class="max-h-48 overflow-y-auto space-y-2 pr-1">
          <div
            v-for="(lap, index) in laps"
            :key="index"
            class="flex justify-between items-center p-3.5 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-slate-200 dark:border-slate-800/80"
          >
            <span class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Lap {{ laps.length - index }}</span>
            <span class="font-mono font-black text-slate-900 dark:text-white text-sm tracking-tighter">{{ formatDuration(lap) }}</span>
          </div>
          <div
            v-if="laps.length === 0"
            class="text-[9px] font-black text-slate-400 dark:text-slate-600 text-center py-4 uppercase tracking-widest"
          >
            No laps recorded
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
