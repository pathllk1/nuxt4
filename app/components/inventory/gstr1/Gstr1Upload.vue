<template>
  <div class="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-zinc-800 shadow-sm space-y-6">
    <!-- Header info -->
    <div class="text-center max-w-xl mx-auto space-y-2">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 text-xs font-black uppercase tracking-wider">
        <UIcon name="i-heroicons-sparkles" class="w-3.5 h-3.5" />
        <span>100% Client-Side In-Browser Analysis</span>
      </div>
      <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
        Upload GSTR-1 JSON Return File
      </h2>
      <p class="text-xs sm:text-sm text-slate-500 dark:text-zinc-400">
        Upload official GST portal GSTR-1 JSON export to analyze outward supplies, HSN stock quantities, B2B invoices & consumer sales.
      </p>
    </div>

    <!-- Drag & Drop Zone -->
    <div
      class="border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group relative"
      :class="[
        isDragging
          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/30 scale-[1.01]'
          : 'border-slate-300 dark:border-zinc-700 hover:border-primary-400 dark:hover:border-primary-600 bg-slate-50/50 dark:bg-zinc-850/40'
      ]"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
      @click="triggerFileInput"
    >
      <input
        ref="fileInputRef"
        type="file"
        accept=".json"
        class="hidden"
        @change="handleFileChange"
      />

      <div class="space-y-4 max-w-sm mx-auto">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
          <UIcon name="i-heroicons-arrow-up-tray" class="w-8 h-8" />
        </div>
        <div>
          <p class="text-sm font-black text-slate-800 dark:text-zinc-100">
            {{ isDragging ? 'Drop GSTR-1 JSON File Here' : 'Click to Upload or Drag & Drop' }}
          </p>
          <p class="text-xs text-slate-400 dark:text-zinc-500 mt-1 font-mono">
            Accepts official GSTR-1 JSON (<span class="font-bold">*.json</span>)
          </p>
        </div>
      </div>
    </div>

    <!-- Sample Data Quick Load Button -->
    <div class="flex flex-wrap items-center justify-center gap-3 pt-2">
      <span class="text-xs text-slate-400 dark:text-zinc-500 font-semibold">Or test with bundled sample:</span>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-heroicons-document-text"
        size="sm"
        label="Load Sample July 2026 GSTR-1 JSON (21 B2B Invoices, 55 HSN Lines)"
        class="font-bold text-xs h-8 cursor-pointer"
        :loading="loadingSample"
        @click="loadSampleJson"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const emit = defineEmits<{
  'file-loaded': [jsonText: string, filename: string];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);
const loadingSample = ref(false);

function triggerFileInput() {
  fileInputRef.value?.click();
}

function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    readFile(target.files[0]);
  }
}

function handleDrop(e: DragEvent) {
  isDragging.value = false;
  if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
    readFile(e.dataTransfer.files[0]);
  }
}

async function readFile(file: File) {
  if (!file.name.toLowerCase().endsWith('.json')) {
    alert('Please upload a valid .json file exported from the GST portal.');
    return;
  }
  try {
    const text = await file.text();
    emit('file-loaded', text, file.name);
  } catch (err: any) {
    alert(`Error reading JSON file: ${err.message}`);
  }
}

// Sample JSON inline payload for offline / live testing
async function loadSampleJson() {
  loadingSample.value = true;
  try {
    // Import the sample JSON or fetch it
    const response = await fetch('/19BJKPP3718A1Z8_GSTR1_JUL-2026_20082026_145611.json');
    if (response.ok) {
      const text = await response.text();
      emit('file-loaded', text, '19BJKPP3718A1Z8_GSTR1_JUL-2026.json');
      return;
    }
  } catch (err) {
    // Fallback: use built-in sample JSON string
  } finally {
    loadingSample.value = false;
  }

  // Built-in hardcoded fallback sample if fetch fails
  const sampleJsonStr = `{"gstin":"19BJKPP3718A1Z8","fp":"072026","b2b":[{"ctin":"19AAYCA9302L1ZX","inv":[{"inum":"175","idt":"01-07-2026","val":15550,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":13178,"rt":18,"iamt":0,"camt":1186.02,"samt":1186.02,"csamt":0}}]},{"inum":"205","idt":"14-07-2026","val":39925,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":19800,"rt":5,"iamt":0,"camt":495,"samt":495,"csamt":0}},{"num":2,"itm_det":{"txval":16216,"rt":18,"iamt":0,"camt":1459.44,"samt":1459.44,"csamt":0}}]},{"inum":"223","idt":"27-07-2026","val":40677,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":34472,"rt":18,"iamt":0,"camt":3102.48,"samt":3102.48,"csamt":0}}]},{"inum":"231","idt":"30-07-2026","val":46155,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":13200,"rt":5,"iamt":0,"camt":330,"samt":330,"csamt":0}},{"num":2,"itm_det":{"txval":27369,"rt":18,"iamt":0,"camt":2463.21,"samt":2463.21,"csamt":0}}]}]},{"ctin":"19EGQPB9646P1ZA","inv":[{"inum":"176","idt":"01-07-2026","val":22680,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":19220.34,"rt":18,"iamt":0,"camt":1729.83,"samt":1729.83,"csamt":0}}]},{"inum":"232","idt":"30-07-2026","val":2125,"pos":"19","rchrg":"N","inv_typ":"R","itms":[{"num":1,"itm_det":{"txval":2023.81,"rt":5,"iamt":0,"camt":50.60,"samt":50.60,"csamt":0}}]}]}],"b2cs":[{"typ":"OE","sply_ty":"INTRA","rt":5,"pos":"19","txval":197796.36,"camt":4944.92,"samt":4944.92,"csamt":0},{"typ":"OE","sply_ty":"INTRA","rt":18,"pos":"19","txval":126988.72,"camt":11428.98,"samt":11428.98,"csamt":0}],"hsn":{"hsn_b2b":[{"num":1,"hsn_sc":"33074900","txval":19220.34,"iamt":0,"camt":1729.83,"samt":1729.83,"csamt":0,"desc":"","user_desc":"","uqc":"NOS","qty":108,"rt":18},{"num":2,"hsn_sc":"33074900","txval":3849.40,"iamt":0,"camt":346.45,"samt":346.45,"csamt":0,"desc":"","user_desc":"","uqc":"PCS","qty":75,"rt":18}],"hsn_b2c":[{"num":1,"hsn_sc":"04022990","txval":5900,"iamt":0,"camt":147.50,"samt":147.50,"csamt":0,"desc":"","user_desc":"","uqc":"PAC","qty":2000,"rt":5}]},"doc_issue":{"doc_det":[{"doc_num":1,"docs":[{"cancel":0,"from":"175","net_issue":61,"num":1,"to":"235","totnum":61}]}]}}`;
  emit('file-loaded', sampleJsonStr, 'Sample_GSTR1_JUL-2026.json');
}
</script>
