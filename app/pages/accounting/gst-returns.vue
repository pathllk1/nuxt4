<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useGst } from '@/composables/useGst';
import { useApi } from '@/utils/api';
import Gstr2aImport from '@/components/accounting/Gstr2aImport.vue';

const router = useRouter();
const route = useRoute();
const api = useApi();
const {
  loading,
  error,
  currentGSTR1,
  currentGSTR3B,
  validationReport,
  fetchGSTR1,
  fetchGSTR3B,
  validateGSTR1,
  exportGSTR1JSON,
  exportGSTR1Excel,
  exportGSTR1PDF,
  exportGSTR3BPDF,
} = useGst();

const reportMonth = ref('');
const firmGstin = ref('');
const firmGstins = ref<any[]>([]);
const activeMainTab = ref(route.query.tab === 'gstr2a' ? 'gstr2a' : 'gstr1');
const activeGSTR1Tab = ref('b2b');
const showValidationModal = ref(false);

watch(() => route.query.tab, (newTab) => {
  if (newTab === 'gstr2a' || newTab === 'gstr1' || newTab === 'gstr3b') {
    activeMainTab.value = newTab as string;
  }
});

const setDefaultDates = () => {
  const today = new Date();
  reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const loadFirmGstins = async () => {
  try {
    const res = await api.get('/firms/current');
    if (res.success && res.data) {
      const firm = res.data;
      const locations = firm.locations || [];
      const tempGstins: any[] = [];
      
      if (firm.gst_number) {
        tempGstins.push({
          gst_number: firm.gst_number,
          label: `${firm.gst_number} (Principal) - ${firm.state || ''}`
        });
      }
      
      locations.forEach((loc: any) => {
        if (loc.gst_number && !tempGstins.some(g => g.gst_number === loc.gst_number)) {
          tempGstins.push({
            gst_number: loc.gst_number,
            label: `${loc.gst_number} (${loc.is_default ? 'Principal' : 'Additional'}) - ${loc.state || ''}`
          });
        }
      });

      firmGstins.value = tempGstins;
      if (tempGstins.length > 0) {
        firmGstin.value = tempGstins[0].gst_number;
      }
    }
  } catch (err) {
    console.error('Error loading firm GSTINs:', err);
  }
};

const getDates = () => {
  const [year, month] = reportMonth.value.split('-');
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`
  };
};

const generateActiveReport = async () => {
  if (!reportMonth.value || !firmGstin.value) {
    alert('Please select a Month/Year and Firm GSTIN');
    return;
  }
  const dates = getDates();
  const params = {
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  };

  if (activeMainTab.value === 'gstr1') {
    await fetchGSTR1(params);
  } else {
    await fetchGSTR3B(params);
  }
};

const onValidate = async () => {
  const dates = getDates();
  await validateGSTR1({
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  });
  showValidationModal.value = true;
};

const onExportJSON = async () => {
  const dates = getDates();
  await exportGSTR1JSON({
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  });
};

const onExportExcel = async () => {
  const dates = getDates();
  await exportGSTR1Excel({
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  });
};

const onExportPDF = async () => {
  const dates = getDates();
  await exportGSTR1PDF({
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  });
};

const onExport3BPDF = async () => {
  const dates = getDates();
  await exportGSTR3BPDF({
    startDate: dates.startDate,
    endDate: dates.endDate,
    firmGstin: firmGstin.value
  });
};

const switchMainTab = (tab: string) => {
  activeMainTab.value = tab;
};

const switchGSTR1Tab = (tab: string) => {
  activeGSTR1Tab.value = tab;
};

const formatCurrency = (val: number | undefined | null) => {
  if (typeof val !== 'number') return '₹0.00';
  return '₹' + val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

onMounted(async () => {
  setDefaultDates();
  await loadFirmGstins();
  if (firmGstin.value) {
    await generateActiveReport();
  }
});

const gstr1TabConfig = computed(() => {
  if (!currentGSTR1.value) return null;
  const configs: Record<string, { title: string; cols: string[]; data: any[] }> = {
    'b2b': { 
      title: 'Table 4A: B2B Supplies', 
      cols: ['invoice_no', 'invoice_date', 'customer_gstin', 'taxable_value', 'igst', 'cgst', 'sgst', 'invoice_value'],
      data: currentGSTR1.value.table_4a_b2b_supplies || []
    },
    'b2b-rc': { 
      title: 'Table 4B: B2B Supplies (Reverse Charge)', 
      cols: ['invoice_no', 'invoice_date', 'customer_gstin', 'taxable_value', 'place_of_supply'],
      data: currentGSTR1.value.table_4b_b2b_reverse_charge || []
    },
    'b2cl': { 
      title: 'Table 5: B2CL (Inter-state > ₹1 Lakh)', 
      cols: ['invoice_no', 'invoice_date', 'state_code', 'taxable_value', 'igst', 'invoice_value'],
      data: currentGSTR1.value.table_5_b2cl_supplies || []
    },
    'exports': { 
      title: 'Table 6: Exports', 
      cols: ['export_type', 'invoice_no', 'invoice_date', 'taxable_value', 'igst', 'invoice_value'],
      data: currentGSTR1.value.table_6_exports || []
    },
    'b2cs': { 
      title: 'Table 7: B2CS (Small B2C)', 
      cols: ['state_code', 'rate', 'taxable_value', 'igst', 'cgst', 'sgst'],
      data: currentGSTR1.value.table_7_b2cs_supplies || []
    },
    'nil-rated': { 
      title: 'Table 8: Nil Rated Supplies', 
      cols: ['description', 'inter_state', 'intra_state'],
      data: currentGSTR1.value.table_8_nil_rated || []
    },
    'amendments': { 
      title: 'Table 9: Amendments', 
      cols: ['amendment_type', 'original_invoice_no', 'amendment_invoice_no', 'taxable_value', 'igst', 'cgst', 'sgst'],
      data: currentGSTR1.value.table_9_amendments || []
    },
    'advances': { 
      title: 'Table 11: Advances Received', 
      cols: ['place_of_supply', 'rate', 'gross_advance_received', 'igst', 'cgst', 'sgst'],
      data: currentGSTR1.value.table_11_advances || []
    },
    'hsn-b2b': { 
      title: 'Table 12: HSN Summary (B2B)', 
      cols: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax'],
      data: currentGSTR1.value.table_12_hsn_b2b || []
    },
    'hsn-b2c': { 
      title: 'Table 12: HSN Summary (B2C)', 
      cols: ['hsn', 'description', 'uqc', 'total_quantity', 'taxable_value', 'integrated_tax'],
      data: currentGSTR1.value.table_12_hsn_b2c || []
    },
    'documents': { 
      title: 'Table 13: Document Summary', 
      cols: ['nature_of_document', 'sr_no_from', 'sr_no_to', 'total_number', 'cancelled'],
      data: currentGSTR1.value.table_13_document_summary || []
    }
  };
  return configs[activeGSTR1Tab.value];
});
</script>

<template>
  <div class="p-4 py-3 max-w-[1600px] mx-auto space-y-4">
    <!-- Header Block -->
    <div class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
      <div>
        <div class="flex items-center gap-2 mb-0.5">
          <span class="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
          <span class="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest leading-none">Tax Compliance Dashboard</span>
        </div>
        <h1 class="text-2xl font-black tracking-tight uppercase text-gray-900 dark:text-white leading-none">GST Returns System</h1>
        <p class="text-[10px] text-slate-500 dark:text-zinc-400 font-bold mt-1">GSTR-1 & GSTR-3B Statutory Summary</p>
      </div>
      
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-arrow-left"
          label="Back"
          size="sm"
          class="font-bold text-xs h-8"
          @click="router.push('/accounting')"
        />
        
        <template v-if="activeMainTab === 'gstr1'">
          <UButton
            color="warning"
            variant="soft"
            icon="i-heroicons-check-circle"
            label="Validate"
            size="sm"
            class="font-bold text-xs h-8"
            :disabled="!currentGSTR1 || loading"
            @click="onValidate"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-heroicons-document-text"
            label="JSON"
            size="sm"
            class="font-bold text-xs h-8"
            :disabled="!currentGSTR1 || loading"
            @click="onExportJSON"
          />
          <UButton
            color="success"
            variant="outline"
            icon="i-heroicons-table-cells"
            label="Excel"
            size="sm"
            class="font-bold text-xs h-8"
            :disabled="!currentGSTR1 || loading"
            @click="onExportExcel"
          />
          <UButton
            color="error"
            variant="solid"
            icon="i-heroicons-document-arrow-down"
            label="PDF"
            size="sm"
            class="font-bold text-xs h-8"
            :disabled="!currentGSTR1 || loading"
            @click="onExportPDF"
          />
        </template>
        
        <template v-else-if="activeMainTab === 'gstr3b'">
          <UButton
            color="error"
            variant="solid"
            icon="i-heroicons-document-arrow-down"
            label="Download PDF"
            size="sm"
            class="font-bold text-xs h-8"
            :disabled="!currentGSTR3B || loading"
            @click="onExport3BPDF"
          />
        </template>
      </div>
    </div>

    <!-- Primary Tabs -->
    <div class="flex gap-4 border-b border-gray-200 dark:border-zinc-800">
      <button 
        class="px-6 py-3 font-bold text-sm border-b-2 transition"
        :class="activeMainTab === 'gstr1' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="switchMainTab('gstr1')"
      >
        GSTR-1 (Outward Supplies)
      </button>
      <button 
        class="px-6 py-3 font-bold text-sm border-b-2 transition"
        :class="activeMainTab === 'gstr3b' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="switchMainTab('gstr3b')"
      >
        GSTR-3B (Summary Return)
      </button>
      <button 
        class="px-6 py-3 font-bold text-sm border-b-2 transition flex items-center gap-2"
        :class="activeMainTab === 'gstr2a' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700'"
        @click="switchMainTab('gstr2a')"
      >
        <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4" />
        <span>GSTR-2A (Inward Import)</span>
      </button>
    </div>

    <!-- GSTR-2A Inward Import View -->
    <div v-if="activeMainTab === 'gstr2a'">
      <Gstr2aImport :initial-firm-gstin="firmGstin" />
    </div>

    <!-- Shared Filters (For GSTR-1 and GSTR-3B) -->
    <div v-if="activeMainTab !== 'gstr2a'" class="bg-white dark:bg-zinc-900 shadow-sm rounded-2xl p-4 border border-gray-100 dark:border-zinc-800">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label class="block text-[10px] font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Select Month & Year</label>
          <UInput type="month" v-model="reportMonth" size="sm" class="w-full" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">Firm GSTIN</label>
          <USelect
            v-model="firmGstin"
            :items="firmGstins.map(g => ({ label: g.label, value: g.gst_number }))"
            class="w-full"
            size="sm"
          />
        </div>
        <div>
          <UButton 
            color="primary" 
            label="Generate Report" 
            icon="i-heroicons-arrow-path"
            size="sm" 
            class="w-full font-bold text-xs h-9 justify-center"
            :loading="loading"
            @click="generateActiveReport"
          />
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-if="error && activeMainTab !== 'gstr2a'" class="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 rounded-xl flex items-center justify-between">
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4 text-rose-500" />
        <p class="text-xs font-bold">{{ error }}</p>
      </div>
    </div>

    <!-- GSTR-1 View -->
    <div v-if="activeMainTab === 'gstr1'" class="space-y-4">
      <!-- Summary Cards -->
      <div v-if="currentGSTR1" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 rounded-2xl p-4 shadow-sm">
          <div class="text-xs text-blue-700 dark:text-blue-400 font-bold uppercase tracking-wider">Total Invoices</div>
          <div class="text-2xl font-black text-blue-900 dark:text-white mt-1">{{ currentGSTR1.summary.total_invoices }}</div>
        </div>
        <div class="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 shadow-sm">
          <div class="text-xs text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Total Taxable Value</div>
          <div class="text-2xl font-black text-emerald-900 dark:text-white mt-1 font-mono">{{ formatCurrency(currentGSTR1.summary.total_taxable_value) }}</div>
        </div>
        <div class="bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 rounded-2xl p-4 shadow-sm">
          <div class="text-xs text-purple-700 dark:text-purple-400 font-bold uppercase tracking-wider">Total GST Amount</div>
          <div class="text-2xl font-black text-purple-900 dark:text-white mt-1 font-mono">{{ formatCurrency(currentGSTR1.summary.total_gst) }}</div>
        </div>
        <div class="bg-orange-50/50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/50 rounded-2xl p-4 shadow-sm">
          <div class="text-xs text-orange-700 dark:text-orange-400 font-bold uppercase tracking-wider">Total Invoice Value</div>
          <div class="text-2xl font-black text-orange-900 dark:text-white mt-1 font-mono">{{ formatCurrency(currentGSTR1.summary.total_invoice_value) }}</div>
        </div>
      </div>

      <!-- GSTR-1 Sub Tabs & Tables -->
      <div v-if="currentGSTR1" class="bg-white dark:bg-zinc-900 shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div class="flex flex-wrap gap-1 border-b border-gray-150 dark:border-zinc-800 p-3 bg-gray-50/50 dark:bg-zinc-850/50 overflow-x-auto">
          <button 
            v-for="(config, key) in {
              'b2b': '4A. B2B',
              'b2b-rc': '4B. B2B (RC)',
              'b2cl': '5. B2CL',
              'exports': '6. Exports',
              'b2cs': '7. B2CS',
              'nil-rated': '8. Nil Rated',
              'amendments': '9. Amendments',
              'advances': '11. Advances',
              'hsn-b2b': '12. HSN (B2B)',
              'hsn-b2c': '12. HSN (B2C)',
              'documents': '13. Documents'
            }"
            :key="key"
            class="px-3 py-1.5 font-bold text-[10px] uppercase tracking-wider border rounded-lg transition"
            :class="activeGSTR1Tab === key 
              ? 'bg-indigo-600 text-white border-indigo-600' 
              : 'bg-white dark:bg-zinc-900 text-gray-600 border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800 dark:text-zinc-400'"
            @click="switchGSTR1Tab(key)"
          >
            {{ config }}
          </button>
        </div>

        <div class="p-6">
          <div v-if="gstr1TabConfig" class="space-y-4">
            <h3 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wider border-b pb-2 border-gray-100 dark:border-zinc-800">{{ gstr1TabConfig.title }}</h3>
            
            <div v-if="gstr1TabConfig.data.length === 0" class="py-12 text-center text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest text-xs">
              No transactions recorded for this table
            </div>
            
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
                <thead>
                  <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider bg-gray-50/80 dark:bg-zinc-800/80">
                    <th v-for="c in gstr1TabConfig.cols" :key="c" class="py-2 px-3">
                      {{ c.replace(/_/g, ' ').toUpperCase() }}
                    </th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-zinc-800">
                  <tr v-for="(row, idx) in gstr1TabConfig.data" :key="idx" class="hover:bg-gray-50/50 dark:hover:bg-zinc-800/20">
                    <td v-for="c in gstr1TabConfig.cols" :key="c" class="py-2.5 px-3">
                      <span v-if="typeof row[c] === 'number' && (c.includes('value') || c.includes('tax') || c.includes('cgst') || c.includes('sgst') || c.includes('igst'))" class="font-mono font-bold">
                        {{ formatCurrency(row[c]) }}
                      </span>
                      <span v-else class="font-medium text-slate-800 dark:text-zinc-300">
                        {{ row[c] ?? '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- GSTR-3B View -->
    <div v-if="activeMainTab === 'gstr3b'" class="space-y-6">
      <div v-if="currentGSTR3B" class="space-y-6">
        <!-- 3.1 Outward & Inward liable to RC -->
        <UCard class="w-full shadow-sm rounded-2xl border border-gray-100 dark:border-zinc-800" :ui="{ body: 'p-0 overflow-hidden' }">
          <div class="p-4 py-3 bg-gray-50/80 dark:bg-zinc-800/80 border-b border-gray-100 dark:border-zinc-800">
            <h3 class="font-black text-sm text-gray-900 dark:text-white uppercase tracking-tight">3.1 Outward Supplies & Inward Supplies liable to Reverse Charge</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs divide-y divide-gray-100 dark:divide-zinc-800">
              <thead>
                <tr class="text-[10px] font-bold text-gray-500 dark:text-zinc-400 uppercase bg-gray-100/50 dark:bg-zinc-850/50">
                  <th class="py-2 px-3">Nature of Supplies</th>
                  <th class="py-2 px-3 text-right">Total Taxable Value</th>
                  <th class="py-2 px-3 text-right">IGST</th>
                  <th class="py-2 px-3 text-right">CGST</th>
                  <th class="py-2 px-3 text-right">SGST/UTGST</th>
                  <th class="py-2 px-3 text-right">Cess</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-zinc-800 font-medium">
                <tr v-for="(v, k) in {
                  a: '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
                  b: '(b) Outward taxable supplies (zero rated)',
                  c: '(c) Other outward supplies (Nil rated, exempted)',
                  d: '(d) Inward supplies (liable to reverse charge)',
                  e: '(e) Non-GST outward supplies'
                }" :key="k" class="hover:bg-gray-50/50">
                  <td class="py-3 px-3 font-bold text-gray-900 dark:text-white">{{ v }}</td>
                  <td class="py-3 px-3 text-right font-mono">{{ formatCurrency(currentGSTR3B.table_3_1[k]?.taxable_value) }}</td>
                  <td class="py-3 px-3 text-right font-mono text-indigo-600 dark:text-indigo-400">{{ formatCurrency(currentGSTR3B.table_3_1[k]?.igst) }}</td>
                  <td class="py-3 px-3 text-right font-mono text-blue-600 dark:text-blue-400">{{ formatCurrency(currentGSTR3B.table_3_1[k]?.cgst) }}</td>
                  <td class="py-3 px-3 text-right font-mono text-purple-600 dark:text-purple-400">{{ formatCurrency(currentGSTR3B.table_3_1[k]?.sgst) }}</td>
                  <td class="py-3 px-3 text-right font-mono text-gray-500">{{ formatCurrency(currentGSTR3B.table_3_1[k]?.cess) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Validation Modal -->
    <UModal v-model:open="showValidationModal" title="Statutory GSTR-1 Validation Report">
      <template #body>
        <div class="py-3 space-y-4 max-h-[60vh] overflow-y-auto p-4">
          <div v-if="validationReport" class="space-y-3">
            <div class="flex items-center gap-2 p-3.5 rounded-xl" :class="validationReport.valid ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'">
              <UIcon :name="validationReport.valid ? 'i-heroicons-check-circle' : 'i-heroicons-x-circle'" class="w-6 h-6 shrink-0" />
              <div>
                <p class="text-xs font-bold uppercase tracking-wider leading-none">{{ validationReport.valid ? 'Data Validated Successfully' : 'Validation Issues Detected' }}</p>
                <p class="text-[9px] font-medium mt-1 leading-none">Total Bills Checked: {{ validationReport.total_bills || 0 }} | Items Checked: {{ validationReport.total_items || 0 }}</p>
              </div>
            </div>

            <!-- Errors -->
            <div v-if="validationReport.errors && validationReport.errors.length > 0" class="space-y-2">
              <h4 class="text-[10px] font-black text-rose-500 uppercase tracking-widest leading-none">Critical Errors ({{ validationReport.errors.length }})</h4>
              <ul class="space-y-1">
                <li v-for="(err, i) in validationReport.errors" :key="i" class="text-xs font-semibold text-rose-700 py-1.5 flex items-start gap-1.5">
                  <span class="shrink-0 font-bold">•</span>
                  <span>{{ err }}</span>
                </li>
              </ul>
            </div>

            <!-- Warnings -->
            <div v-if="validationReport.warnings && validationReport.warnings.length > 0" class="space-y-2">
              <h4 class="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Warnings ({{ validationReport.warnings.length }})</h4>
              <ul class="space-y-1">
                <li v-for="(warn, i) in validationReport.warnings" :key="i" class="text-xs font-semibold text-amber-700 py-1.5 flex items-start gap-1.5">
                  <span class="shrink-0 font-bold">•</span>
                  <span>{{ warn }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
