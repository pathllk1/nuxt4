<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const emit = defineEmits(['close'])

interface Note {
  id: string
  title: string
  body: string
  updatedAt: string
}

const notes = ref<Note[]>([])
const activeNoteId = ref<string | null>(null)
const searchQuery = ref('')
const showListOnMobile = ref(true)

const activeNote = computed(() => {
  return notes.value.find(n => n.id === activeNoteId.value) || null
})

const filteredNotes = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return notes.value
  return notes.value.filter(
    n => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)
  )
})

const wordCount = computed(() => {
  if (!activeNote.value) return 0
  const text = activeNote.value.body.trim()
  if (!text) return 0
  return text.split(/\s+/).length
})

const charCount = computed(() => {
  return activeNote.value ? activeNote.value.body.length : 0
})

const formattedUpdateDate = computed(() => {
  if (!activeNote.value) return ''
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(activeNote.value.updatedAt))
})

const createNote = (title = 'Untitled note', body = '') => {
  const newNote: Note = {
    id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    updatedAt: new Date().toISOString()
  }
  notes.value.unshift(newNote)
  activeNoteId.value = newNote.id
  showListOnMobile.value = false
  saveWorkspace()
}

const duplicateNote = () => {
  if (!activeNote.value) return
  createNote(`${activeNote.value.title} copy`, activeNote.value.body)
}

const deleteNote = () => {
  if (!activeNoteId.value) return
  notes.value = notes.value.filter(n => n.id !== activeNoteId.value)
  if (notes.value.length === 0) {
    createNote('Workspace note')
  } else {
    activeNoteId.value = notes.value[0]?.id || null
  }
  showListOnMobile.value = true
  saveWorkspace()
}

const exportNote = () => {
  if (!activeNote.value) return
  const blob = new Blob([activeNote.value.body], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${(activeNote.value.title || 'note').replace(/[^a-z0-9-_]+/gi, '_')}.txt`
  link.click()
  URL.revokeObjectURL(url)
}

const saveWorkspace = () => {
  localStorage.setItem(
    'global-tool-notepad-workspace',
    JSON.stringify({
      notes: notes.value,
      activeNoteId: activeNoteId.value
    })
  )
}

const updateActiveNote = () => {
  if (activeNote.value) {
    activeNote.value.updatedAt = new Date().toISOString()
    saveWorkspace()
  }
}

const loadWorkspace = () => {
  try {
    const raw = localStorage.getItem('global-tool-notepad-workspace')
    if (raw) {
      const saved = JSON.parse(raw)
      if (Array.isArray(saved.notes) && saved.notes.length) {
        notes.value = saved.notes
        activeNoteId.value = saved.activeNoteId || saved.notes[0].id
        return
      }
    }
  } catch (e) {
    console.error('Failed to load notepad workspace', e)
  }
  createNote('Workspace note')
}

const selectNote = (id: string) => {
  activeNoteId.value = id
  showListOnMobile.value = false
}

onMounted(() => {
  loadWorkspace()
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-955/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[90vh] sm:h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
    >
      <!-- Header -->
      <div class="border-b border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/40 shrink-0">
        <div>
          <p class="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Notepad Workspace</p>
          <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tracking-tight italic">Multi-Note Editor</h2>
        </div>
        <button
          type="button"
          class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Main body -->
      <div class="flex-1 flex overflow-hidden min-h-0 bg-white dark:bg-slate-900">
        <!-- Sidebar: Notes list -->
        <aside
          :class="[showListOnMobile ? 'w-full flex' : 'hidden sm:flex w-64']"
          class="border-r border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 flex-col shrink-0"
        >
          <div class="p-4 border-b border-slate-200 dark:border-slate-800 flex gap-2">
            <button
              type="button"
              class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] py-2.5 rounded-xl font-black uppercase tracking-widest transition shadow-lg shadow-indigo-900/20 cursor-pointer"
              @click="createNote('New Note')"
            >
              New
            </button>
            <button
              type="button"
              class="flex-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white text-[10px] py-2.5 rounded-xl font-black uppercase tracking-widest transition border border-slate-250 dark:border-slate-700/50 cursor-pointer"
              @click="duplicateNote"
            >
              Dup
            </button>
          </div>
          <div class="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <input
              v-model="searchQuery"
              class="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              type="text"
              placeholder="Search notes..."
            />
          </div>
          <div class="flex-1 overflow-y-auto p-2 space-y-1">
            <button
              v-for="note in filteredNotes"
              :key="note.id"
              type="button"
              class="w-full text-left p-3 rounded-xl transition cursor-pointer flex flex-col gap-1"
              :class="[
                note.id === activeNoteId
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-50 dark:bg-slate-950/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 border border-slate-150 dark:border-slate-900/20'
              ]"
              @click="selectNote(note.id)"
            >
              <span class="font-bold text-xs truncate w-full">{{ note.title || 'Untitled note' }}</span>
              <span
                class="text-[9px] font-mono tracking-tight"
                :class="[note.id === activeNoteId ? 'text-indigo-200' : 'text-slate-450 dark:text-slate-500']"
              >
                {{ new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(note.updatedAt)) }}
              </span>
            </button>
            <div
              v-if="filteredNotes.length === 0"
              class="text-xs text-slate-400 dark:text-slate-600 text-center py-8 font-black uppercase tracking-widest"
            >
              No matching notes
            </div>
          </div>
        </aside>

        <!-- Main Editor Section -->
        <section
          v-if="activeNote"
          :class="[!showListOnMobile ? 'flex' : 'hidden sm:flex']"
          class="flex-1 bg-white dark:bg-slate-900 flex flex-col overflow-hidden relative"
        >
          <!-- Editor Title Header -->
          <div class="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between gap-4 bg-slate-50/20 dark:bg-slate-950/10 shrink-0">
            <button
              v-if="!showListOnMobile"
              type="button"
              class="sm:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white transition cursor-pointer shrink-0"
              @click="showListOnMobile = true"
            >
              ←
            </button>
            <input
              v-model="activeNote.title"
              class="flex-1 bg-transparent border-none text-slate-900 dark:text-white font-black text-base sm:text-lg focus:outline-none placeholder:text-slate-405 dark:placeholder:text-slate-700"
              type="text"
              placeholder="Note title"
              @input="updateActiveNote"
            />
            <div class="flex gap-2">
              <button
                type="button"
                class="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] px-3 sm:px-4 py-2.5 rounded-xl font-black uppercase tracking-widest transition border border-slate-200 dark:border-slate-700/50 cursor-pointer"
                @click="exportNote"
              >
                Export
              </button>
              <button
                type="button"
                class="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-white text-[10px] px-3 sm:px-4 py-2.5 rounded-xl font-black uppercase tracking-widest transition border border-rose-200 dark:border-rose-955/40 cursor-pointer"
                @click="deleteNote"
              >
                Delete
              </button>
            </div>
          </div>

          <!-- Note Stats Bar -->
          <div class="px-6 py-2 text-[9px] font-black uppercase tracking-widest text-slate-450 dark:text-slate-500 border-b border-slate-200 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
            {{ wordCount }} words  |  {{ charCount }} chars  |  Updated {{ formattedUpdateDate }}
          </div>

          <!-- Note Body Textarea -->
          <textarea
            v-model="activeNote.body"
            class="flex-1 bg-transparent border-0 px-6 py-6 text-slate-800 dark:text-slate-300 text-sm leading-relaxed focus:outline-none resize-none overflow-y-auto placeholder:text-slate-400 dark:placeholder:text-slate-700"
            placeholder="Start typing your note here..."
            @input="updateActiveNote"
          ></textarea>
        </section>
        <section
          v-else
          class="hidden sm:flex flex-1 items-center justify-center text-slate-400 dark:text-slate-500 text-xs font-black uppercase tracking-widest bg-white dark:bg-slate-900"
        >
          Select or create a note to begin
        </section>
      </div>
    </div>
  </div>
</template>
