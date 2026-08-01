<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['close'])

interface DocumentItem {
  id: string
  title: string
  content: string
  modified: string
}

const docs = ref<DocumentItem[]>([])
const activeDocId = ref<string>('')
const showSidebar = ref(false)

const fontNameSelect = ref('Segoe UI')
const fontSizeSelect = ref('3')
const blockFormatSelect = ref('p')

const status = ref<'saved' | 'saving' | 'editing'>('saved')
const statusLabel = ref('Saved')

const activePanel = ref<null | 'find' | 'table' | 'link' | 'image' | 'code'>(null)
const findForm = ref({ find: '', replace: '' })
const tableForm = ref({ rows: 3, cols: 3 })
const linkForm = ref({ text: '', url: '' })
const imageForm = ref({ url: '', alt: 'Inserted image' })
const codeForm = ref({ language: 'javascript', content: '' })

const editorRef = ref<HTMLDivElement | null>(null)
const documentTitle = ref('')

const wordCount = ref(0)
const charCount = ref(0)
const lineCount = ref(1)

const savedRange = ref<Range | null>(null)
const autoSaveTimer = ref<any>(null)
let isSyncingEditor = false

const DEFAULT_DOC_HTML = `
  <h1 class="mb-4 text-3xl font-bold text-slate-900 dark:text-white">Enterprise Notepad Pro</h1>
  <p class="mb-3 text-sm leading-7 text-slate-700 dark:text-slate-350">Begin your documentation here.</p>
  <p class="text-sm leading-7 text-slate-700 dark:text-slate-350">Use the toolbar to format text, insert links, tables, images, and code blocks, then save documents in the directory panel.</p>
`

const getActiveDoc = (): DocumentItem | null => {
  return docs.value.find((doc) => doc.id === activeDocId.value) || docs.value[0] || null
}

const loadDocuments = () => {
  try {
    const raw = localStorage.getItem('enterprise-notepad-docs')
    const parsed = raw ? JSON.parse(raw) : {}
    docs.value = Array.isArray(parsed.docs) ? parsed.docs : []
    activeDocId.value = parsed.activeDocId || ''

    if (docs.value.length === 0) {
      const initial = createDocument('Workspace Document')
      docs.value = [initial]
      activeDocId.value = initial.id
    }

    if (!docs.value.some((doc) => doc.id === activeDocId.value)) {
      const firstDoc = docs.value[0]
      if (firstDoc) activeDocId.value = firstDoc.id
    }
  } catch (e) {
    const initial = createDocument('Workspace Document')
    docs.value = [initial]
    activeDocId.value = initial.id
  }
}

const saveDocuments = () => {
  localStorage.setItem('enterprise-notepad-docs', JSON.stringify({
    docs: docs.value,
    activeDocId: activeDocId.value
  }))
}

const createDocument = (title = `Document ${new Date().toLocaleString()}`): DocumentItem => {
  return {
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    content: DEFAULT_DOC_HTML.trim(),
    modified: new Date().toISOString()
  }
}

const syncEditorFromState = () => {
  const activeDoc = getActiveDoc()
  if (!activeDoc) return

  isSyncingEditor = true
  documentTitle.value = activeDoc.title
  if (editorRef.value) {
    editorRef.value.innerHTML = stripInlineStyles(activeDoc.content || DEFAULT_DOC_HTML.trim())
  }
  isSyncingEditor = false
  updateCounts()
}

const updateCounts = () => {
  const editor = editorRef.value
  if (!editor) return

  const text = editor.innerText || ''
  wordCount.value = text.trim() ? text.trim().split(/\s+/).length : 0
  charCount.value = text.length
  lineCount.value = text ? text.split(/\n/).length : 1
}

const setStatus = (tone: 'saved' | 'saving' | 'editing', label: string) => {
  status.value = tone
  statusLabel.value = label
}

const queueSave = (label = 'Saving') => {
  setStatus('saving', label)
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
  autoSaveTimer.value = setTimeout(() => {
    const activeDoc = getActiveDoc()
    if (!activeDoc || !editorRef.value) return

    activeDoc.title = documentTitle.value.trim() || 'Untitled document'
    activeDoc.content = editorRef.value.innerHTML
    activeDoc.modified = new Date().toISOString()

    saveDocuments()
    setStatus('saved', 'Saved')
  }, 300)
}

const handleEditorInput = () => {
  if (isSyncingEditor) return
  const activeDoc = getActiveDoc()
  if (!activeDoc) return
  activeDoc.content = editorRef.value?.innerHTML || ''
  activeDoc.modified = new Date().toISOString()
  updateCounts()
  setStatus('editing', 'Editing')
  queueSave()
}

const handleTitleInput = () => {
  const activeDoc = getActiveDoc()
  if (!activeDoc) return
  activeDoc.title = documentTitle.value.trim() || 'Untitled document'
  activeDoc.modified = new Date().toISOString()
  setStatus('editing', 'Editing')
  queueSave()
}

const saveSelection = () => {
  const editor = editorRef.value
  const selection = window.getSelection()
  if (!editor || !selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return
  savedRange.value = range.cloneRange()
}

const restoreSelection = () => {
  const editor = editorRef.value
  if (!editor || !savedRange.value) return false

  const selection = window.getSelection()
  if (selection) {
    selection.removeAllRanges()
    selection.addRange(savedRange.value)
    return true
  }
  return false
}

const focusEditor = () => {
  const editor = editorRef.value
  if (!editor) return null
  editor.focus()
  restoreSelection()
  return editor
}

const exec = (command: string, value: string | null = null) => {
  focusEditor()
  document.execCommand(command, false, value || undefined)
  saveSelection()
  updateCounts()
  queueSave()
}

const insertHtml = (html: string) => {
  focusEditor()
  document.execCommand('insertHTML', false, html)
  saveSelection()
  updateCounts()
  queueSave()
}

const insertInlineCode = () => {
  const editor = focusEditor()
  if (!editor) return

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  const range = selection.getRangeAt(0)
  if (range.collapsed) {
    insertHtml('<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[13px] text-rose-600 dark:text-rose-400">code</code>')
    return
  }

  const fragmentText = escapeHtml(range.toString())
  insertHtml(`<code class="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[13px] text-rose-600 dark:text-rose-400">${fragmentText}</code>`)
}

const createNewDoc = () => {
  const doc = createDocument(`Document ${docs.value.length + 1}`)
  docs.value.unshift(doc)
  activeDocId.value = doc.id
  saveDocuments()
  syncEditorFromState()
  focusEditor()
}

const duplicateDoc = (docId: string) => {
  const source = docs.value.find((d) => d.id === docId)
  if (!source) return

  const duplicate: DocumentItem = {
    ...source,
    id: `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: `${source.title} copy`,
    modified: new Date().toISOString()
  }
  docs.value.unshift(duplicate)
  activeDocId.value = duplicate.id
  saveDocuments()
  syncEditorFromState()
}

const deleteDoc = (docId: string) => {
  if (confirm('Delete this document?')) {
    if (docs.value.length === 1) {
      const initial = createDocument('Workspace Document')
      docs.value = [initial]
      activeDocId.value = initial.id
      saveDocuments()
      syncEditorFromState()
      return
    }

    docs.value = docs.value.filter((d) => d.id !== docId)
    if (activeDocId.value === docId) {
      const firstDoc = docs.value[0]
      if (firstDoc) activeDocId.value = firstDoc.id
    }
    saveDocuments()
    syncEditorFromState()
  }
}

const exportDoc = (format: 'txt' | 'html') => {
  const doc = getActiveDoc()
  const editor = editorRef.value
  if (!doc || !editor) return

  const content = format === 'html' ? editor.innerHTML : editor.innerText
  const mime = format === 'html' ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8'
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeFilename(doc.title)}.${format}`
  link.click()
  URL.revokeObjectURL(url)
}

const printDoc = () => {
  const editor = editorRef.value
  if (!editor) return

  const printWindow = window.open('', '_blank', 'noopener,noreferrer')
  if (!printWindow) return

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map(style => style.outerHTML)
    .join('\n')

  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Print Document</title>
        ${styles}
      </head>
      <body class="bg-white p-8 text-slate-900">
        <div class="prose max-w-none">${editor.innerHTML}</div>
      </body>
    </html>
  `)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

const findNext = () => {
  const term = findForm.value.find.trim()
  if (!term) return

  focusEditor()
  const found = (window as any).find(term, false, false, true, false, false, false)
  if (!found) {
    window.getSelection()?.removeAllRanges()
    ;(window as any).find(term, false, false, true, false, false, false)
  }
  saveSelection()
}

const replaceCurrent = () => {
  const term = findForm.value.find.trim()
  const rep = findForm.value.replace
  const selected = window.getSelection()?.toString() || ''
  if (selected.toLowerCase() === term.toLowerCase()) {
    document.execCommand('insertText', false, rep)
    queueSave()
    updateCounts()
  } else {
    findNext()
  }
}

const replaceAll = () => {
  const editor = editorRef.value
  const term = findForm.value.find.trim()
  const rep = findForm.value.replace
  if (!editor || !term) return

  const regex = new RegExp(escapeRegExp(term), 'gi')
  editor.innerHTML = editor.innerHTML.replace(regex, escapeHtml(rep))
  saveSelection()
  updateCounts()
  queueSave()
}

const insertTable = () => {
  const { rows, cols } = tableForm.value
  if (rows < 1 || cols < 1) return

  let html = '<table class="my-4 w-full border-collapse text-sm"><thead><tr>'
  for (let col = 0; col < cols; col += 1) {
    html += `<th class="border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold">Header ${col + 1}</th>`
  }
  html += '</tr></thead><tbody>'
  for (let row = 0; row < rows; row += 1) {
    html += '<tr>'
    for (let col = 0; col < cols; col += 1) {
      html += '<td class="border border-slate-300 dark:border-slate-700 px-3 py-2">&nbsp;</td>'
    }
    html += '</tr>'
  }
  html += '</tbody></table><p></p>'
  insertHtml(html)
  closePanels()
}

const insertLink = () => {
  const { text, url } = linkForm.value
  if (!url) return

  const label = text || url
  insertHtml(
    `<a class="text-sky-655 dark:text-sky-400 underline" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  )
  closePanels()
}

const insertImage = () => {
  const { url, alt } = imageForm.value
  if (!url) return

  insertHtml(
    `<img class="my-4 max-w-full rounded-lg border border-slate-200 dark:border-slate-800" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" />`
  )
  closePanels()
}

const insertCodeBlock = () => {
  const { language, content } = codeForm.value
  if (!content.trim()) return

  insertHtml(
    `<pre class="my-4 overflow-x-auto rounded-xl bg-slate-900 p-4 font-mono text-[13px] leading-6 text-slate-100" data-lang="${escapeHtml(language)}"><code class="bg-transparent p-0 text-slate-100">${escapeHtml(content)}</code></pre><p></p>`
  )
  closePanels()
}

const applySpanClass = (cls: string) => {
  const editor = focusEditor()
  if (!editor) return

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return

  const tmp = document.createElement('div')
  tmp.appendChild(range.cloneContents())
  insertHtml(`<span class="${cls}">${tmp.innerHTML}</span>`)
}

const applyAlignment = (cls: string) => {
  const editor = editorRef.value
  if (!editor) return

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return

  let node = selection.getRangeAt(0).commonAncestorContainer as HTMLElement | null
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement

  const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'PRE'])
  while (node && node !== editor && !blockTags.has(node.nodeName)) {
    node = node.parentElement
  }

  if (!node || node === editor) return

  node.classList.remove('text-left', 'text-center', 'text-right', 'text-justify')
  if (cls) node.classList.add(cls)

  const activeDoc = getActiveDoc()
  if (activeDoc) {
    activeDoc.content = editor.innerHTML
    activeDoc.modified = new Date().toISOString()
  }
  saveSelection()
  queueSave()
}

const applyFontName = (fontName: string) => {
  const editor = focusEditor()
  if (!editor) return

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    document.execCommand('fontName', false, fontName)
    return
  }

  const range = selection.getRangeAt(0)
  if (!editor.contains(range.commonAncestorContainer)) return

  const tmp = document.createElement('div')
  tmp.appendChild(range.cloneContents())
  insertHtml(`<font face="${escapeHtml(fontName)}">${tmp.innerHTML}</font>`)
}

const getBlockNode = () => {
  const editor = editorRef.value
  if (!editor) return null

  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  let node = selection.getRangeAt(0).commonAncestorContainer as HTMLElement | null
  if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement

  const blockTags = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'PRE'])
  while (node && node !== editor && !blockTags.has(node.nodeName)) {
    node = node.parentElement
  }

  return node && node !== editor ? node : null
}

const INDENT_CLASSES = ['pl-8', 'pl-16', 'pl-24', 'pl-32']

const applyIndent = () => {
  const node = getBlockNode()
  if (!node) return

  const level = Math.min(4, Number(node.dataset.indent || 0) + 1)
  node.dataset.indent = String(level)
  node.classList.remove(...INDENT_CLASSES)
  const cls = INDENT_CLASSES[level - 1]
  if (cls) node.classList.add(cls)

  const activeDoc = getActiveDoc()
  if (activeDoc && editorRef.value) {
    activeDoc.content = editorRef.value.innerHTML
    activeDoc.modified = new Date().toISOString()
  }
  saveSelection()
  queueSave()
}

const applyOutdent = () => {
  const node = getBlockNode()
  if (!node) return

  const level = Math.max(0, Number(node.dataset.indent || 0) - 1)
  node.dataset.indent = String(level)
  node.classList.remove(...INDENT_CLASSES)
  if (level > 0) {
    const cls = INDENT_CLASSES[level - 1]
    if (cls) node.classList.add(cls)
  }

  const activeDoc = getActiveDoc()
  if (activeDoc && editorRef.value) {
    activeDoc.content = editorRef.value.innerHTML
    activeDoc.modified = new Date().toISOString()
  }
  saveSelection()
  queueSave()
}

const handleFontChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  applyFontName(val)
}

const handleSizeChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  exec('fontSize', val)
}

const handleBlockChange = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value
  exec('formatBlock', val)
}

const closePanels = () => {
  activePanel.value = null
}

const escapeHtml = (value = '') => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const sanitizeFilename = (value = 'document') => {
  return String(value).trim().replace(/[^a-z0-9-_]+/gi, '_') || 'document'
}

const stripInlineStyles = (html: string) => {
  return html.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
}

const escapeRegExp = (value: string) => {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const formatTimestamp = (value: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

const handleKeyDown = (event: KeyboardEvent) => {
  if (!(event.ctrlKey || event.metaKey)) return

  const key = event.key.toLowerCase()
  if (key === 's') {
    event.preventDefault()
    queueSave('Saving')
  } else if (key === 'n') {
    event.preventDefault()
    createNewDoc()
  } else if (key === 'p') {
    event.preventDefault()
    printDoc()
  } else if (key === 'f') {
    event.preventDefault()
    activePanel.value = 'find'
    nextTick(() => {
      const input = document.querySelector('[data-find-input]') as HTMLInputElement | null
      input?.focus()
    })
  } else if (key === '`') {
    event.preventDefault()
    insertInlineCode()
  }
}

watch(activeDocId, () => {
  syncEditorFromState()
  closePanels()
})

onMounted(() => {
  loadDocuments()
  window.addEventListener('keydown', handleKeyDown)
  nextTick(() => {
    syncEditorFromState()
    focusEditor()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value)
})
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/40 dark:bg-slate-950/80 backdrop-blur-md" style="z-index: 100000;">
    <div
      class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[95vh] sm:h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
    >
      <!-- Top Menu Bar -->
      <div class="flex items-center gap-4 sm:gap-5 border-b border-slate-200 dark:border-slate-800 bg-slate-900 px-4 sm:px-5 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 shrink-0">
        <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white cursor-pointer" @click="createNewDoc">File</button>
        <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white cursor-pointer" @click="activePanel = 'find'">Edit</button>
        <button type="button" class="relative rounded-lg px-2 py-1 text-left transition hover:bg-white/10 hover:text-white cursor-pointer" @click="activePanel = 'table'">Insert</button>
        <span class="ml-auto text-sky-400">Text Studio Pro</span>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
          @click="emit('close')"
        >
          ✕
        </button>
      </div>

      <!-- Formatting Toolbar -->
      <div class="flex overflow-x-auto whitespace-nowrap scrollbar-hide py-2 px-4 gap-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
        <!-- Document Operations -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="createNewDoc">New</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="queueSave('Saving')">Save</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="printDoc">Print</button>
        </div>

        <!-- History Operations -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('undo')">Undo</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-355 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('redo')">Redo</button>
        </div>

        <!-- Typography Selection -->
        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <!-- Font Dropdown -->
          <select 
            v-model="fontNameSelect" 
            @change="handleFontChange" 
            class="h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <optgroup label="Sans-serif" class="bg-white dark:bg-slate-900">
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Segoe UI">Segoe UI</option>
              <option value="Tahoma">Tahoma</option>
              <option value="Verdana">Verdana</option>
            </optgroup>
            <optgroup label="Serif" class="bg-white dark:bg-slate-900">
              <option value="Georgia">Georgia</option>
              <option value="Times New Roman">Times New Roman</option>
            </optgroup>
            <optgroup label="Monospace" class="bg-white dark:bg-slate-900">
              <option value="Consolas">Consolas</option>
              <option value="Courier New">Courier New</option>
            </optgroup>
          </select>

          <!-- Size Dropdown -->
          <select 
            v-model="fontSizeSelect" 
            @change="handleSizeChange"
            class="h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="2">10pt</option>
            <option value="3">12pt</option>
            <option value="4">14pt</option>
            <option value="5">18pt</option>
            <option value="6">24pt</option>
          </select>

          <!-- Block Format Dropdown -->
          <select 
            v-model="blockFormatSelect" 
            @change="handleBlockChange"
            class="h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 outline-none cursor-pointer"
          >
            <option value="p">Normal</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="blockquote">Quote</option>
          </select>
        </div>

        <!-- Text formatting -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2 py-1 rounded-lg text-xs font-black text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('bold')">B</button>
          <button type="button" class="px-2 py-1 rounded-lg text-xs font-semibold italic text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('italic')">I</button>
          <button type="button" class="px-2 py-1 rounded-lg text-xs font-semibold underline text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('underline')">U</button>
          <button type="button" class="px-2 py-1 rounded-lg text-xs font-semibold line-through text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('strikeThrough')">S</button>
          <button type="button" class="px-2 py-1 font-mono text-xs font-semibold text-slate-800 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="insertInlineCode">&lt;/&gt;</button>
        </div>

        <!-- Colors & Highlights -->
        <div class="flex items-center gap-1.5 bg-white dark:bg-slate-950 px-2.5 py-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">A</span>
          <button type="button" class="h-4 w-4 rounded-full bg-slate-900 dark:bg-white border border-slate-300 dark:border-slate-700 cursor-pointer" @click="applySpanClass('text-slate-900 dark:text-white')" title="Black/White"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-rose-600 cursor-pointer" @click="applySpanClass('text-rose-600')" title="Red"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-sky-600 cursor-pointer" @click="applySpanClass('text-sky-600')" title="Blue"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-emerald-600 cursor-pointer" @click="applySpanClass('text-emerald-600')" title="Green"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-amber-500 cursor-pointer" @click="applySpanClass('text-amber-500')" title="Amber"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-purple-600 cursor-pointer" @click="applySpanClass('text-purple-600')" title="Purple"></button>

          <span class="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-800"></span>

          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">H</span>
          <button type="button" class="h-4 w-4 rounded-full bg-yellow-300 border border-yellow-400 cursor-pointer" @click="applySpanClass('bg-yellow-200 dark:bg-yellow-900/50')" title="Yellow highlight"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-emerald-300 border border-emerald-400 cursor-pointer" @click="applySpanClass('bg-emerald-200 dark:bg-emerald-900/50')" title="Green highlight"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-sky-300 border border-sky-400 cursor-pointer" @click="applySpanClass('bg-sky-200 dark:bg-sky-900/50')" title="Blue highlight"></button>
          <button type="button" class="h-4 w-4 rounded-full bg-pink-300 border border-pink-400 cursor-pointer" @click="applySpanClass('bg-pink-200 dark:bg-pink-900/50')" title="Pink highlight"></button>

          <span class="mx-1 h-3.5 w-px bg-slate-200 dark:bg-slate-800"></span>
          <button type="button" class="rounded-lg px-1.5 py-1 text-[10px] font-black text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('removeFormat')">Clear</button>
        </div>

        <!-- Alignment -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-955 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyAlignment('text-left')">Left</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyAlignment('text-center')">Center</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyAlignment('text-right')">Right</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyAlignment('text-justify')">Justify</button>
        </div>

        <!-- Lists & Indent -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-955 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('insertUnorderedList')">Bullets</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('insertOrderedList')">Numbered</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyIndent">Indent</button>
          <button type="button" class="px-2 py-1 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="applyOutdent">Outdent</button>
        </div>

        <!-- Insert Operations -->
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-955 p-1 border border-slate-200 dark:border-slate-800 rounded-xl">
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="activePanel = 'link'">Link</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="activePanel = 'image'">Image</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="activePanel = 'table'">Table</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="activePanel = 'code'">Code</button>
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" @click="exec('insertText', new Date().toLocaleString())">Date</button>
        </div>
      </div>

      <!-- Main workspace -->
      <div class="relative flex min-h-0 flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950">
        <!-- Editor Content Area -->
        <div class="flex min-h-0 flex-1 flex-col p-3 sm:p-5">
          <!-- Document Title & Status -->
          <div class="flex items-center gap-3 rounded-t-[1.5rem] border border-b-0 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-5 py-4 shrink-0">
            <input 
              type="text" 
              v-model="documentTitle" 
              @input="handleTitleInput"
              class="flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-55 dark:bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-900 dark:text-white outline-none transition focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" 
              placeholder="Document title" 
            />
            <!-- Desktop Status -->
            <div class="hidden sm:flex items-center gap-2">
              <span class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" :class="[status === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : status === 'saving' ? 'text-amber-500 dark:text-amber-400' : 'text-sky-600 dark:text-sky-400']">
                <span class="h-2 w-2 rounded-full animate-pulse" :class="[status === 'saved' ? 'bg-emerald-500' : status === 'saving' ? 'bg-amber-500' : 'bg-sky-500']"></span>
                {{ statusLabel }}
              </span>
            </div>
            
            <!-- Mobile Sidebar Toggle -->
            <button 
              type="button" 
              class="md:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 rounded-xl text-xs font-black transition cursor-pointer"
              @click="showSidebar = !showSidebar"
            >
              📁 Docs
            </button>
          </div>

          <!-- The editor frame -->
          <div class="min-h-0 flex-1 rounded-b-[1.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div
              ref="editorRef"
              class="prose dark:prose-invert max-w-none h-full min-h-full p-6 sm:p-8 outline-none overflow-y-auto text-sm leading-7 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 [&_a]:text-sky-600 dark:[&_a]:text-sky-400 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-sky-500 [&_blockquote]:pl-4 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-rose-600 dark:[&_code]:text-rose-400 [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-slate-100 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-slate-100 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 dark:[&_th]:border-slate-700 [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border [&_td]:border-slate-300 dark:[&_td]:border-slate-700 [&_td]:px-3 [&_td]:py-2 [&_img]:max-w-full [&_img]:rounded-lg"
              contenteditable="true"
              spellcheck="true"
              @mouseup="saveSelection"
              @keyup="saveSelection"
              @input="handleEditorInput"
            ></div>
          </div>
        </div>

        <!-- Document Directory Sidebar -->
        <aside 
          class="absolute md:relative right-0 top-0 bottom-0 z-40 w-72 shrink-0 flex flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-transform duration-300 md:translate-x-0"
          :class="[showSidebar ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0']"
        >
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-4 shrink-0 bg-slate-100/50 dark:bg-slate-950/40">
            <div>
              <p class="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">Directory</p>
              <h3 class="mt-1 text-sm font-bold text-slate-900 dark:text-white">Documents</h3>
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-white transition cursor-pointer" @click="createNewDoc">New</button>
              <button type="button" class="md:hidden w-8 h-8 flex items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-755 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white font-black text-xs cursor-pointer" @click="showSidebar = false">✕</button>
            </div>
          </div>
          <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shrink-0 bg-slate-50 dark:bg-slate-950/20">
            <button type="button" class="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer" @click="exportDoc('txt')">TXT</button>
            <button type="button" class="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 transition cursor-pointer" @click="exportDoc('html')">HTML</button>
          </div>
          
          <!-- Doc List scroll area -->
          <div class="flex-1 space-y-2.5 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-950/10">
            <div 
              v-for="doc in docs" 
              :key="doc.id" 
              class="group rounded-2xl border transition overflow-hidden"
              :class="[
                doc.id === activeDocId 
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-950/10' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/30 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-850'
              ]"
            >
              <button type="button" class="flex w-full items-start gap-3 px-3 py-3 text-left cursor-pointer" @click="activeDocId = doc.id">
                <span class="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-xs" :class="[doc.id === activeDocId ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400']">Tx</span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-xs font-bold leading-normal">{{ doc.title || 'Untitled' }}</span>
                  <span class="block truncate text-[10px] font-medium font-mono mt-1" :class="[doc.id === activeDocId ? 'text-indigo-200' : 'text-slate-400 dark:text-slate-500']">{{ formatTimestamp(doc.modified) }}</span>
                </span>
              </button>
              <div class="flex items-center justify-end gap-1.5 px-3 pb-3">
                <button type="button" class="rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition cursor-pointer" :class="[doc.id === activeDocId ? 'bg-white/10 text-white hover:bg-white/25' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700']" @click.stop="duplicateDoc(doc.id)">Copy</button>
                <button type="button" class="rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider transition cursor-pointer" :class="[doc.id === activeDocId ? 'bg-rose-500/25 text-white hover:bg-rose-500/40' : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40']" @click.stop="deleteDoc(doc.id)">Delete</button>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <!-- Dialogue/Panels overlay containers -->
      <div v-if="activePanel" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/20 p-4 backdrop-blur-sm">
        <div class="absolute inset-0" @click="closePanels"></div>
        
        <!-- 1. Find panel -->
        <div v-if="activePanel === 'find'" class="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Find and Replace</h4>
          <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Search within the active document and replace selected matches or all matches.</p>
          <div class="mt-5 space-y-3">
            <input type="text" v-model="findForm.find" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Find text" />
            <input type="text" v-model="findForm.replace" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Replace with" />
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <button type="button" class="rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="findNext">Find</button>
            <button type="button" class="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="replaceCurrent">Replace</button>
            <button type="button" class="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="replaceAll">Replace All</button>
            <button type="button" class="ml-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer" @click="closePanels">Close</button>
          </div>
        </div>

        <!-- 2. Table panel -->
        <div v-if="activePanel === 'table'" class="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-905 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Insert Table</h4>
          <div class="mt-5 grid grid-cols-2 gap-3">
            <label class="space-y-2 text-xs font-semibold text-slate-500">
              <span>Rows</span>
              <input type="number" min="1" max="20" v-model.number="tableForm.rows" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" />
            </label>
            <label class="space-y-2 text-xs font-semibold text-slate-500">
              <span>Columns</span>
              <input type="number" min="1" max="10" v-model.number="tableForm.cols" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" />
            </label>
          </div>
          <div class="mt-5 flex items-center gap-2">
            <button type="button" class="rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="insertTable">Insert</button>
            <button type="button" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer" @click="closePanels">Close</button>
          </div>
        </div>

        <!-- 3. Link panel -->
        <div v-if="activePanel === 'link'" class="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Insert Link</h4>
          <div class="mt-5 space-y-3">
            <input type="text" v-model="linkForm.text" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Link text" />
            <input type="url" v-model="linkForm.url" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="https://example.com" />
          </div>
          <div class="mt-5 flex items-center gap-2">
            <button type="button" class="rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="insertLink">Insert</button>
            <button type="button" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer" @click="closePanels">Close</button>
          </div>
        </div>

        <!-- 4. Image panel -->
        <div v-if="activePanel === 'image'" class="relative w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Insert Image</h4>
          <div class="mt-5 space-y-3">
            <input type="url" v-model="imageForm.url" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Image URL" />
            <input type="text" v-model="imageForm.alt" class="w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Alt text" />
          </div>
          <div class="mt-5 flex items-center gap-2">
            <button type="button" class="rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="insertImage">Insert</button>
            <button type="button" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer" @click="closePanels">Close</button>
          </div>
        </div>

        <!-- 5. Code panel -->
        <div v-if="activePanel === 'code'" class="relative w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
          <h4 class="text-sm font-bold text-slate-900 dark:text-white">Insert Code Block</h4>
          <div class="mt-5 space-y-3">
            <select v-model="codeForm.language" class="h-10 w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-55 dark:bg-slate-950 px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900 cursor-pointer">
              <option value="javascript">JavaScript</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="json">JSON</option>
              <option value="sql">SQL</option>
              <option value="bash">Bash</option>
              <option value="text">Plain text</option>
            </select>
            <textarea v-model="codeForm.content" class="min-h-[200px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 font-mono text-sm text-slate-900 dark:text-white outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-slate-900" placeholder="Paste code here"></textarea>
          </div>
          <div class="mt-5 flex items-center gap-2">
            <button type="button" class="rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-850 dark:hover:bg-slate-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white cursor-pointer" @click="insertCodeBlock">Insert</button>
            <button type="button" class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 cursor-pointer" @click="closePanels">Close</button>
          </div>
        </div>
      </div>

      <!-- Footer stats / status -->
      <div class="px-4 sm:px-5 py-2.5 bg-slate-900 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
        <div class="flex flex-wrap items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          <span>Words: <span class="text-white font-bold ml-1 font-mono">{{ wordCount }}</span></span>
          <span>Chars: <span class="text-white font-bold ml-1 font-mono">{{ charCount }}</span></span>
          <span>Lines: <span class="text-white font-bold ml-1 font-mono">{{ lineCount }}</span></span>
        </div>
        
        <!-- Mobile status indicator -->
        <div class="sm:hidden">
          <span class="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em]" :class="[status === 'saved' ? 'text-emerald-400' : status === 'saving' ? 'text-amber-400' : 'text-sky-400']">
            <span class="h-2 w-2 rounded-full" :class="[status === 'saved' ? 'bg-emerald-500' : status === 'saving' ? 'bg-amber-500' : 'bg-sky-500']"></span>
            {{ statusLabel }}
          </span>
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
