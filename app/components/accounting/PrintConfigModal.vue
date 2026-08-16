<template>
  <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity" @click="close"></div>

    <!-- Modal Box -->
    <div class="relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-in fade-in zoom-in-95 duration-150">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-slate-100 dark:border-zinc-800 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-800/30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <UIcon name="i-heroicons-printer" class="w-6 h-6" />
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">Print & Export Configuration</h3>
            <p class="text-xs text-slate-500 dark:text-zinc-400 font-medium">
              {{ bill?.bno ? `Invoice: ${bill.bno}` : 'Custom Invoice Layout Settings' }}
            </p>
          </div>
        </div>
        <button 
          @click="close"
          class="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Body Tabs / Sections -->
      <div class="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
        <!-- 1. Copy Type & Bank Account Selection -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Copy Type -->
          <div class="space-y-1.5">
            <label class="block font-bold text-slate-700 dark:text-zinc-300">Invoice Copy Title</label>
            <select 
              v-model="localConfig.copyType" 
              class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ORIGINAL FOR RECIPIENT">ORIGINAL FOR RECIPIENT</option>
              <option value="DUPLICATE FOR TRANSPORTER">DUPLICATE FOR TRANSPORTER</option>
              <option value="TRIPLICATE FOR SUPPLIER">TRIPLICATE FOR SUPPLIER</option>
              <option value="OFFICE COPY">OFFICE COPY</option>
              <option value="">NO COPY LABEL (BLANK)</option>
            </select>
          </div>

          <!-- Bank Account Selector -->
          <div class="space-y-1.5">
            <label class="block font-bold text-slate-700 dark:text-zinc-300">Bank Account to Print</label>
            <select 
              v-model="localConfig.bankAccountId" 
              class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Default Firm Account</option>
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

        <!-- 2. Column Visibility Toggles -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="font-black uppercase tracking-wider text-[10px] text-slate-400 dark:text-zinc-500">Table Columns to Print</span>
            <span class="text-[10px] text-slate-400">Toggle columns on/off</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-slate-100 dark:border-zinc-800">
            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showHsn" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>HSN / SAC</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showQty" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Quantity</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showUom" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>UOM</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showRate" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Unit Rate</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showDisc" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Discount %</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showGst" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>GST %</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showBatch" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Batch No</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700 dark:text-zinc-300">
              <input type="checkbox" v-model="localConfig.showNarration" class="rounded text-indigo-600 focus:ring-indigo-500" />
              <span>Item Narration</span>
            </label>
          </div>
        </div>

        <!-- 3. Legal & Statutory Overrides -->
        <div class="space-y-3">
          <span class="font-black uppercase tracking-wider text-[10px] text-slate-400 dark:text-zinc-500">Legal & Statutory Footers</span>

          <div class="space-y-3">
            <div class="space-y-1">
              <label class="block font-bold text-slate-700 dark:text-zinc-300">Jurisdiction Statement</label>
              <input 
                v-model="localConfig.jurisdiction" 
                type="text" 
                placeholder="e.g. Subject to Kolkata Jurisdiction only."
                class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div class="space-y-1">
              <label class="block font-bold text-slate-700 dark:text-zinc-300">Authorised Signatory Designation</label>
              <input 
                v-model="localConfig.signatoryTitle" 
                type="text" 
                placeholder="e.g. For TECH SOLUTIONS LTD — Authorised Signatory"
                class="w-full bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Footer Action Buttons -->
      <div class="px-6 py-4 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 flex items-center justify-between gap-3">
        <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-600 dark:text-zinc-400 text-xs">
          <input type="checkbox" v-model="saveAsDefault" class="rounded text-indigo-600 focus:ring-indigo-500" />
          <span>Save as default for future bills</span>
        </label>

        <div class="flex items-center gap-2">
          <UButton 
            color="neutral" 
            variant="ghost" 
            label="Cancel (Esc)" 
            size="sm" 
            class="text-xs font-bold rounded-xl cursor-pointer"
            @click="close"
          />
          <UButton 
            color="primary" 
            icon="i-heroicons-arrow-down-tray" 
            :loading="downloading"
            label="Download PDF (Enter)" 
            size="sm" 
            class="text-xs font-black px-4 rounded-xl shadow-md cursor-pointer"
            @click="handlePrintOrDownload"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue';
import { usePrintSettings } from '@/composables/usePrintSettings';
import { api } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  bill?: any;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'printed'): void;
}>();

const { printConfig, bankAccounts, fetchPrintSettings, savePrintSettings, buildPdfQueryParams } = usePrintSettings();

const downloading = ref(false);
const saveAsDefault = ref(false);

const localConfig = reactive({
  copyType: 'ORIGINAL FOR RECIPIENT',
  bankAccountId: '',
  showHsn: true,
  showQty: true,
  showUom: true,
  showRate: true,
  showDisc: true,
  showGst: true,
  showBatch: true,
  showNarration: true,
  showBank: true,
  jurisdiction: '',
  signatoryTitle: ''
});

function syncFromMaster() {
  localConfig.copyType = printConfig.defaultCopyType || 'ORIGINAL FOR RECIPIENT';
  localConfig.bankAccountId = printConfig.defaultBankAccountId || '';
  localConfig.showHsn = printConfig.showHsn;
  localConfig.showQty = printConfig.showQty;
  localConfig.showUom = printConfig.showUom;
  localConfig.showRate = printConfig.showRate;
  localConfig.showDisc = printConfig.showDisc;
  localConfig.showGst = printConfig.showGst;
  localConfig.showBatch = printConfig.showBatch;
  localConfig.showNarration = printConfig.showNarration;
  localConfig.showBank = printConfig.showBank;
  localConfig.jurisdiction = printConfig.jurisdiction;
  localConfig.signatoryTitle = printConfig.signatoryTitle;
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    fetchPrintSettings().then(() => syncFromMaster());
  }
});

function close() {
  emit('update:modelValue', false);
}

async function handlePrintOrDownload() {
  if (!props.bill?._id) return;
  downloading.value = true;

  try {
    if (saveAsDefault.value) {
      await savePrintSettings({
        showHsn: localConfig.showHsn,
        showQty: localConfig.showQty,
        showUom: localConfig.showUom,
        showRate: localConfig.showRate,
        showDisc: localConfig.showDisc,
        showGst: localConfig.showGst,
        showBatch: localConfig.showBatch,
        showNarration: localConfig.showNarration,
        showBank: localConfig.showBank,
        defaultBankAccountId: localConfig.bankAccountId,
        jurisdiction: localConfig.jurisdiction,
        signatoryTitle: localConfig.signatoryTitle,
        defaultCopyType: localConfig.copyType
      });
    }

    const queryParams = buildPdfQueryParams({
      showHsn: localConfig.showHsn,
      showQty: localConfig.showQty,
      showUom: localConfig.showUom,
      showRate: localConfig.showRate,
      showDisc: localConfig.showDisc,
      showGst: localConfig.showGst,
      showBatch: localConfig.showBatch,
      showNarration: localConfig.showNarration,
      showBank: localConfig.showBank,
      bankAccountId: localConfig.bankAccountId,
      jurisdiction: localConfig.jurisdiction,
      signatoryTitle: localConfig.signatoryTitle,
      copyType: localConfig.copyType
    });

    const res = await api.get(`/accounting/bills/${props.bill._id}/pdf`, {
      params: queryParams,
      responseType: 'blob'
    });

    const url = window.URL.createObjectURL(res);
    const link = document.createElement('a');
    link.href = url;
    const copySuffix = localConfig.copyType ? `_${localConfig.copyType.replace(/ /g, '_')}` : '';
    link.download = `Invoice_${props.bill.bno || props.bill._id}${copySuffix}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);

    emit('printed');
    close();
  } catch (err) {
    console.error('Failed to generate PDF with custom config:', err);
  } finally {
    downloading.value = false;
  }
}

onMounted(() => {
  fetchPrintSettings();
});
</script>
