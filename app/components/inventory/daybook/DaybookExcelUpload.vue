<template>
  <div class="space-y-4">
    <!-- Dual Upload Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- Slot 1: DayBook Excel Upload (Primary) -->
      <div
        class="border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative"
        :class="[
          excelFile
            ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
            : isDraggingExcel
            ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
            : 'border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-850/50 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
        ]"
        @dragover.prevent="isDraggingExcel = true"
        @dragleave.prevent="isDraggingExcel = false"
        @drop.prevent="handleExcelDrop"
        @click="triggerExcelInput"
      >
        <input
          ref="excelInputRef"
          type="file"
          accept=".xlsx, .xls, .csv"
          class="hidden"
          @change="handleExcelChange"
        />

        <div class="flex flex-col items-center justify-center space-y-2.5">
          <div
            class="p-2.5 rounded-2xl"
            :class="excelFile ? 'bg-emerald-500 text-white' : 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'"
          >
            <UIcon :name="excelFile ? 'i-heroicons-check-circle' : 'i-heroicons-table-cells'" class="w-8 h-8" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
              <span>1. DayBook / Sales Register Excel</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 font-bold uppercase">Required</span>
            </h4>
            <p v-if="excelFile" class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              ✓ {{ excelFile.name }} ({{ (excelFile.size / 1024).toFixed(1) }} KB)
            </p>
            <p v-else class="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              Items, quantities, selling rates, purchase costs, margins & godowns.
            </p>
          </div>
        </div>
      </div>

      <!-- Slot 2: GSTR-1 JSON Upload (Tax Enrichment & Reconciliation) -->
      <div
        class="border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer relative"
        :class="[
          jsonFileContent
            ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
            : isDraggingJson
            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
            : 'border-slate-300 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-850/50 hover:bg-slate-50 dark:hover:bg-zinc-800/80'
        ]"
        @dragover.prevent="isDraggingJson = true"
        @dragleave.prevent="isDraggingJson = false"
        @drop.prevent="handleJsonDrop"
        @click="triggerJsonInput"
      >
        <input
          ref="jsonInputRef"
          type="file"
          accept=".json"
          class="hidden"
          @change="handleJsonChange"
        />

        <div class="flex flex-col items-center justify-center space-y-2.5">
          <div
            class="p-2.5 rounded-2xl"
            :class="jsonFileContent ? 'bg-indigo-500 text-white' : 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'"
          >
            <UIcon :name="jsonFileContent ? 'i-heroicons-check-circle' : 'i-heroicons-document-currency-rupee'" class="w-8 h-8" />
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-800 dark:text-white flex items-center justify-center gap-1.5">
              <span>2. GSTR-1 Return JSON</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 font-bold uppercase">Recommended</span>
            </h4>
            <p v-if="jsonFileName" class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              ✓ {{ jsonFileName }} (Tax verification active)
            </p>
            <p v-else class="text-xs text-slate-500 dark:text-zinc-400 mt-1">
              B2B statutory invoices, B2CS retail, and filed CGST/SGST/IGST taxes.
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Analyze Button if Excel is selected -->
    <div v-if="excelBuffer" class="flex justify-center pt-1">
      <UButton
        color="primary"
        size="md"
        icon="i-heroicons-sparkles"
        :label="jsonFileContent ? 'Analyze DayBook + GSTR-1 (Complete 360° Matrix)' : 'Analyze DayBook Excel'"
        class="font-black px-6 py-2.5 shadow-md cursor-pointer text-sm"
        @click="runAnalysis"
      />
    </div>

    <!-- Sample Data Loaders Strip -->
    <div class="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 dark:bg-zinc-800/80 rounded-xl border border-slate-200/80 dark:border-zinc-700/80 text-xs">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-sparkles" class="w-4 h-4 text-amber-500" />
        <span class="text-slate-700 dark:text-zinc-300 font-bold">One-Click Sample Data Demos:</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          variant="solid"
          size="xs"
          icon="i-heroicons-bolt"
          label="⚡ Load Both Sample Files (Full 360° Bill & Tax Engine)"
          class="font-black cursor-pointer text-xs"
          :loading="loadingBoth"
          @click="loadBothSamples"
        />

        <UButton
          color="neutral"
          variant="outline"
          size="xs"
          label="Excel Only"
          class="font-bold cursor-pointer"
          :loading="loadingExcelSample"
          @click="loadExcelOnlySample"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { parseDaybookExcel, type DaybookParsedData } from '@/utils/daybook-parser';

const emit = defineEmits<{
  'data-loaded': [data: DaybookParsedData];
}>();

const excelInputRef = ref<HTMLInputElement | null>(null);
const jsonInputRef = ref<HTMLInputElement | null>(null);
const isDraggingExcel = ref(false);
const isDraggingJson = ref(false);

const excelFile = ref<File | null>(null);
const excelBuffer = ref<ArrayBuffer | null>(null);
const jsonFileName = ref<string>('');
const jsonFileContent = ref<string>('');

const loadingBoth = ref(false);
const loadingExcelSample = ref(false);

function triggerExcelInput() {
  excelInputRef.value?.click();
}

function triggerJsonInput() {
  jsonInputRef.value?.click();
}

function handleExcelChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processExcelFile(target.files[0]);
  }
}

function handleExcelDrop(e: DragEvent) {
  isDraggingExcel.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    processExcelFile(e.dataTransfer.files[0]);
  }
}

async function processExcelFile(file: File) {
  excelFile.value = file;
  excelBuffer.value = await file.arrayBuffer();
  // If JSON is already loaded, automatically run analysis
  if (jsonFileContent.value) {
    runAnalysis();
  }
}

function handleJsonChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processJsonFile(target.files[0]);
  }
}

function handleJsonDrop(e: DragEvent) {
  isDraggingJson.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    processJsonFile(e.dataTransfer.files[0]);
  }
}

async function processJsonFile(file: File) {
  jsonFileName.value = file.name;
  jsonFileContent.value = await file.text();
  // If Excel is already loaded, auto run
  if (excelBuffer.value) {
    runAnalysis();
  }
}

function runAnalysis() {
  if (!excelBuffer.value) return;
  try {
    const parsed = parseDaybookExcel(
      excelBuffer.value,
      excelFile.value?.name || 'DayBook.xlsx',
      jsonFileContent.value || undefined
    );
    emit('data-loaded', parsed);
  } catch (err: any) {
    alert('Failed to parse data: ' + err.message);
  }
}

async function loadBothSamples() {
  loadingBoth.value = true;
  try {
    const [resExcel, resJson] = await Promise.all([
      fetch('/DayBook.xlsx'),
      fetch('/19BJKPP3718A1Z8_GSTR1_JUL-2026_20082026_145611.json')
    ]);

    if (!resExcel.ok) throw new Error('Could not load /DayBook.xlsx');
    if (!resJson.ok) throw new Error('Could not load GSTR-1 sample JSON');

    const buffer = await resExcel.arrayBuffer();
    const jsonText = await resJson.text();

    const parsed = parseDaybookExcel(buffer, 'DayBook.xlsx', jsonText);
    emit('data-loaded', parsed);
  } catch (err: any) {
    alert('Failed to load demo samples: ' + err.message);
  } finally {
    loadingBoth.value = false;
  }
}

async function loadExcelOnlySample() {
  loadingExcelSample.value = true;
  try {
    const res = await fetch('/DayBook.xlsx');
    if (!res.ok) throw new Error('Could not load /DayBook.xlsx');
    const buffer = await res.arrayBuffer();
    const parsed = parseDaybookExcel(buffer, 'DayBook.xlsx');
    emit('data-loaded', parsed);
  } catch (err: any) {
    alert('Failed to load sample Excel: ' + err.message);
  } finally {
    loadingExcelSample.value = false;
  }
}
</script>
