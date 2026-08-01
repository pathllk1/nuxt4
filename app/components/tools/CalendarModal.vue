<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits(['close'])

const today = new Date()
const selectedDate = ref<Date>(new Date())
const calendarDate = ref<Date>(new Date(today.getFullYear(), today.getMonth(), 1))

// Events state
const events = ref<Record<string, string[]>>({})
const newEventText = ref('')

const getMonthLabel = computed(() => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric'
  }).format(calendarDate.value)
})

const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate()
}

const getCalendarCells = computed(() => {
  const year = calendarDate.value.getFullYear()
  const month = calendarDate.value.getMonth()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const daysCount = getDaysInMonth(year, month)
  
  const cells = []
  
  // Empty offset cells for previous month
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push({ day: null, isMuted: true, dateKey: '' })
  }
  
  // Month cells
  for (let day = 1; day <= daysCount; day++) {
    const date = new Date(year, month, day)
    const key = formatDateKey(date)
    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
      
    cells.push({
      day,
      isMuted: false,
      isToday,
      dateKey: key,
      date
    })
  }
  
  // Fill remaining cells for full week grid alignment
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, isMuted: true, dateKey: '' })
  }
  
  return cells
})

const formatDateKey = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const selectedDateKey = computed(() => {
  return formatDateKey(selectedDate.value)
})

const selectedDateLabel = computed(() => {
  return selectedDate.value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
})

const activeEvents = computed(() => {
  return events.value[selectedDateKey.value] || []
})

const navMonth = (offset: number) => {
  calendarDate.value = new Date(
    calendarDate.value.getFullYear(),
    calendarDate.value.getMonth() + offset,
    1
  )
}

const selectCell = (cell: any) => {
  if (cell.date) {
    selectedDate.value = cell.date
  }
}

const addEvent = () => {
  const text = newEventText.value.trim()
  if (!text) return
  
  const key = selectedDateKey.value
  if (!events.value[key]) {
    events.value[key] = []
  }
  events.value[key].push(text)
  newEventText.value = ''
  saveEvents()
}

const deleteEvent = (index: number) => {
  const key = selectedDateKey.value
  if (events.value[key]) {
    events.value[key].splice(index, 1)
    if (events.value[key].length === 0) {
      delete events.value[key]
    }
    saveEvents()
  }
}

const loadEvents = () => {
  try {
    const raw = localStorage.getItem('global-tools-calendar-events')
    if (raw) {
      events.value = JSON.parse(raw)
    }
  } catch (e) {
    console.error('Failed to load calendar events', e)
  }
}

const saveEvents = () => {
  localStorage.setItem('global-tools-calendar-events', JSON.stringify(events.value))
}

const hasEvents = (key: string) => {
  return events.value[key] && events.value[key].length > 0
}

onMounted(() => {
  loadEvents()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl h-[95vh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="border-b border-slate-205 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Calendar utility</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Monthly Planner & Agenda</h2>
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
      <div class="flex-1 flex flex-col sm:flex-row overflow-y-auto sm:overflow-hidden min-h-0 bg-white dark:bg-slate-900">
        
        <!-- Calendar Grid Panel -->
        <div class="flex-1 p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-y-auto">
          <!-- Calendar Nav -->
          <div class="flex justify-between items-center bg-slate-50 dark:bg-slate-950/50 p-2 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <button
              type="button"
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white transition font-black cursor-pointer border border-slate-200 dark:border-slate-700"
              @click="navMonth(-1)"
            >
              ←
            </button>
            <div class="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">
              {{ getMonthLabel }}
            </div>
            <button
              type="button"
              class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white transition font-black cursor-pointer border border-slate-200 dark:border-slate-700"
              @click="navMonth(1)"
            >
              →
            </button>
          </div>

          <!-- Week headers -->
          <div class="grid grid-cols-7 gap-2">
            <div
              v-for="d in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
              :key="d"
              class="text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest"
            >
              {{ d }}
            </div>
          </div>

          <!-- Day Cells Grid -->
          <div class="grid grid-cols-7 gap-2 flex-1 min-h-[220px]">
            <button
              v-for="(cell, idx) in getCalendarCells"
              :key="idx"
              type="button"
              class="aspect-square relative flex flex-col items-center justify-center rounded-xl text-xs font-bold transition cursor-pointer group"
              :class="[
                cell.isMuted
                  ? 'text-slate-300 dark:text-slate-700 pointer-events-none'
                  : 'text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800',
                cell.dateKey === selectedDateKey
                  ? 'bg-indigo-600 hover:bg-indigo-500 text-white font-black'
                  : cell.isToday
                    ? 'bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-black'
                    : 'bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/40'
              ]"
              @click="selectCell(cell)"
            >
              <span>{{ cell.day || '' }}</span>
              
              <!-- Event dot indicator -->
              <span
                v-if="cell.day && hasEvents(cell.dateKey)"
                class="absolute bottom-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"
                :class="[cell.dateKey === selectedDateKey ? 'bg-white' : '']"
              ></span>
            </button>
          </div>
        </div>

        <!-- Sidebar Agenda Pane -->
        <div class="w-full sm:w-80 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30 flex flex-col shrink-0 min-h-0">
          <div class="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40">
            <p class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Selected Date</p>
            <h3 class="text-sm font-black text-slate-900 dark:text-white mt-1 font-mono">{{ selectedDateLabel }}</h3>
          </div>

          <!-- New Event Input -->
          <div class="p-4 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/20 dark:bg-slate-950/10">
            <form @submit.prevent="addEvent" class="flex gap-2">
              <input
                v-model="newEventText"
                type="text"
                placeholder="Add agenda note..."
                class="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                class="px-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                +
              </button>
            </form>
          </div>

          <!-- Agenda List -->
          <div class="flex-1 overflow-y-auto p-4 space-y-2 min-h-[150px] sm:min-h-0">
            <div
              v-for="(item, idx) in activeEvents"
              :key="idx"
              class="group/item flex items-start justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <p class="text-xs text-slate-700 dark:text-slate-300 font-semibold leading-normal break-words flex-1 pr-1">
                {{ item }}
              </p>
              <button
                type="button"
                class="text-[10px] text-slate-400 hover:text-rose-500 transition opacity-0 group-hover/item:opacity-100 cursor-pointer"
                @click="deleteEvent(idx)"
              >
                ✕
              </button>
            </div>
            
            <div
              v-if="activeEvents.length === 0"
              class="text-center py-12 text-slate-400 dark:text-slate-600 text-xs font-black uppercase tracking-widest"
            >
              No agenda for today
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
