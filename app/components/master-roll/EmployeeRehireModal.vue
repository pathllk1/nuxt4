<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '#imports';
import { useMasterRoll } from '@/composables/useMasterRoll';

const props = defineProps<{
  employee: any;
  uniqueProjects?: string[];
  uniqueSites?: string[];
  uniqueCategories?: string[];
  uniqueBanks?: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', updatedEmployee: any): void;
}>();

const { rehireEmployee, downloadAppointmentLetter } = useMasterRoll();
const toast = useToast();

const loading = ref(false);
const downloadingTenure = ref<number | null>(null);

const form = ref({
  date_of_joining: new Date().toISOString().split('T')[0] || '',
  project: props.employee?.project || '',
  site: props.employee?.site || '',
  category: props.employee?.category || 'SKILLED',
  p_day_wage: Number(props.employee?.p_day_wage || 0),
  previous_exit_date: props.employee?.date_of_exit || '',
  previous_exit_reason: props.employee?.doe_rem || 'Completed prior contract',
  remarks: '',
  // Bank & Contact updates
  bank: props.employee?.bank || '',
  account_no: props.employee?.account_no || '',
  ifsc: props.employee?.ifsc || '',
  branch: props.employee?.branch || '',
  phone_no: props.employee?.phone_no || '',
});

const ifscLookupState = ref<{
  status: 'idle' | 'loading' | 'success' | 'error';
  message?: string;
}>({ status: 'idle' });

const onIfscChange = async (val: string) => {
  const code = (val || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
  form.value.ifsc = code;
  if (code.length === 11) {
    ifscLookupState.value = { status: 'loading' };
    try {
      const data: any = await $fetch(`/api/master-rolls/lookup/ifsc/${code}`);
      if (data && data.BANK) {
        form.value.bank = data.BANK;
        form.value.branch = data.BRANCH || '';
        ifscLookupState.value = {
          status: 'success',
          message: `${data.BANK} • ${data.BRANCH || ''}`
        };
      } else {
        ifscLookupState.value = { status: 'error', message: 'Bank details not found for this IFSC' };
      }
    } catch {
      ifscLookupState.value = { status: 'error', message: 'Could not lookup IFSC' };
    }
  } else {
    ifscLookupState.value = { status: 'idle' };
  }
};

const defaultCategories = [
  'UNSKILLED',
  'SEMI-SKILLED',
  'SKILLED',
  'HIGHLY-SKILLED',
  'SUPERVISOR',
  'FITTER',
  'WELDER',
  'ELECTRICIAN',
  'MASON',
  'CARPENTER',
  'DRIVER',
  'OPERATOR',
  'HELPER',
  'RIGGER',
  'PLUMBER',
  'PAINTER',
  'STEEL FIXER',
];

const defaultBanks = [
  'STATE BANK OF INDIA',
  'PUNJAB NATIONAL BANK',
  'BANK OF BARODA',
  'CANARA BANK',
  'UNION BANK OF INDIA',
  'HDFC BANK',
  'ICICI BANK',
  'AXIS BANK',
  'KOTAK MAHINDRA BANK',
  'INDIAN BANK',
  'CENTRAL BANK OF INDIA',
  'BANK OF INDIA',
  'UCO BANK',
  'PUNJAB & SIND BANK',
  'IDBI BANK',
  'FEDERAL BANK',
  'BANDHAN BANK',
  'INDUSIND BANK',
  'YES BANK',
];

const availableCategories = computed(() => {
  const set = new Set([...(props.uniqueCategories || []), ...defaultCategories]);
  return Array.from(set).filter(Boolean);
});

const availableProjects = computed(() => {
  const set = new Set([...(props.uniqueProjects || [])]);
  if (props.employee?.project) set.add(props.employee.project);
  return Array.from(set).filter(Boolean);
});

const availableSites = computed(() => {
  const set = new Set([...(props.uniqueSites || [])]);
  if (props.employee?.site) set.add(props.employee.site);
  return Array.from(set).filter(Boolean);
});

const availableBanks = computed(() => {
  const set = new Set([...(props.uniqueBanks || []), ...defaultBanks]);
  if (props.employee?.bank) set.add(props.employee.bank);
  return Array.from(set).filter(Boolean);
});

// Quick trade chips for fast selection
const quickTrades = ['SKILLED', 'SEMI-SKILLED', 'UNSKILLED', 'HIGHLY-SKILLED', 'FITTER', 'CARPENTER', 'WELDER', 'MASON'];

// Computed existing tenures list
const existingTenures = computed(() => {
  if (props.employee?.tenures && Array.isArray(props.employee.tenures) && props.employee.tenures.length > 0) {
    return props.employee.tenures;
  }
  // Synthetic Tenure 1 for display if legacy employee
  return [
    {
      tenure_no: 1,
      project: props.employee?.project || 'Initial Project',
      site: props.employee?.site || 'Initial Site',
      category: props.employee?.category || 'UNSKILLED',
      p_day_wage: props.employee?.p_day_wage || 0,
      date_of_joining: props.employee?.date_of_joining || 'N/A',
      date_of_exit: props.employee?.date_of_exit || undefined,
      status: props.employee?.status || 'Left',
      bank: props.employee?.bank || '',
      account_no: props.employee?.account_no || '',
      ifsc: props.employee?.ifsc || '',
      branch: props.employee?.branch || '',
      phone_no: props.employee?.phone_no || '',
      appointment_ref_no: `APPT/${(props.employee?.date_of_joining || '2026').slice(0, 4)}/${String(props.employee?._id || '').slice(-6).toUpperCase()}-T1`,
    },
  ];
});

const nextTenureNumber = computed(() => existingTenures.value.length + 1);

// Previous tenure wage comparison
const lastTenureWage = computed(() => {
  if (existingTenures.value.length > 0) {
    const last = existingTenures.value[existingTenures.value.length - 1];
    return Number(last?.p_day_wage) || 0;
  }
  return Number(props.employee?.p_day_wage) || 0;
});

const wageDifference = computed(() => {
  const current = Number(form.value.p_day_wage) || 0;
  const prev = lastTenureWage.value;
  return current - prev;
});

const formatDate = (val?: string) => {
  if (!val) return '—';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return val;
  }
};

const maskAadhaar = (val?: string) => {
  if (!val) return '•••• •••• ••••';
  const clean = String(val).replace(/\s+/g, '');
  if (clean.length >= 4) {
    return `•••• •••• ${clean.slice(-4)}`;
  }
  return clean;
};

const maskAccountNo = (val?: string) => {
  if (!val) return 'Not Provided';
  const clean = String(val).trim();
  if (clean.length > 4) {
    return `•••• ${clean.slice(-4)}`;
  }
  return clean;
};

const onDownloadTenureLetter = async (tenureNo: number) => {
  downloadingTenure.value = tenureNo;
  try {
    await downloadAppointmentLetter(props.employee._id, props.employee.employee_name, tenureNo);
    toast.add({
      title: 'Appointment Letter Downloaded',
      description: `Contract letter for Tenure #${tenureNo} generated with historical terms.`,
      color: 'success',
    });
  } catch (err: any) {
    toast.add({
      title: 'Download Failed',
      description: err.message || 'Could not generate appointment letter',
      color: 'error',
    });
  } finally {
    downloadingTenure.value = null;
  }
};

const submitRehire = async () => {
  if (!form.value.date_of_joining) {
    toast.add({ title: 'Validation Error', description: 'New Date of Joining is required', color: 'error' });
    return;
  }
  if (!form.value.project.trim()) {
    toast.add({ title: 'Validation Error', description: 'New Project name is required', color: 'error' });
    return;
  }
  if (!form.value.site.trim()) {
    toast.add({ title: 'Validation Error', description: 'New Site name is required', color: 'error' });
    return;
  }
  if (!form.value.category.trim()) {
    toast.add({ title: 'Validation Error', description: 'New Category/Trade is required', color: 'error' });
    return;
  }
  if (isNaN(Number(form.value.p_day_wage)) || Number(form.value.p_day_wage) <= 0) {
    toast.add({ title: 'Validation Error', description: 'Please enter a valid daily wage rate', color: 'error' });
    return;
  }

  loading.value = true;
  try {
    const res = await rehireEmployee(props.employee._id, {
      date_of_joining: form.value.date_of_joining,
      project: form.value.project.trim(),
      site: form.value.site.trim(),
      category: form.value.category.trim().toUpperCase(),
      p_day_wage: Number(form.value.p_day_wage),
      previous_exit_date: form.value.previous_exit_date || undefined,
      previous_exit_reason: form.value.previous_exit_reason || undefined,
      remarks: form.value.remarks.trim() || undefined,
      bank: form.value.bank.trim() || undefined,
      account_no: form.value.account_no.trim() || undefined,
      ifsc: form.value.ifsc.trim().toUpperCase() || undefined,
      branch: form.value.branch.trim() || undefined,
      phone_no: form.value.phone_no.trim() || undefined,
    });

    if (res?.success) {
      toast.add({
        title: 'Re-Hire Contract Executed',
        description: `${props.employee.employee_name} engaged under Tenure #${nextTenureNumber.value}.`,
        color: 'success',
      });
      emit('success', res.data);
      emit('close');
    } else {
      toast.add({
        title: 'Operation Failed',
        description: res?.message || 'Could not re-hire employee',
        color: 'error',
      });
    }
  } catch (err: any) {
    toast.add({
      title: 'Error',
      description: err.data?.message || err.message || 'An error occurred during re-hire',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col h-full max-h-[82vh] space-y-4">
    <!-- Executive Top Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-4 text-white shadow-lg shrink-0">
      <div class="absolute -right-8 -bottom-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
      
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Worker Identity & Snapshot -->
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center font-black text-white text-base shadow-inner border border-white/20">
            {{ (employee?.employee_name || 'E').slice(0, 2).toUpperCase() }}
          </div>
          <div>
            <div class="flex items-center gap-2.5 flex-wrap">
              <h3 class="font-extrabold text-base tracking-tight text-white">{{ employee?.employee_name }}</h3>
              <UBadge 
                size="xs" 
                :color="employee?.status === 'Active' ? 'success' : 'neutral'" 
                variant="subtle"
                class="font-semibold uppercase tracking-wider text-[10px]"
              >
                Status: {{ employee?.status || 'Left' }}
              </UBadge>
              <span class="text-xs text-indigo-300 font-mono">
                Aadhaar: {{ maskAadhaar(employee?.aadhar) }}
              </span>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-300 mt-0.5 flex-wrap">
              <span v-if="employee?.father_name" class="flex items-center gap-1">
                <UIcon name="i-heroicons-user" class="w-3.5 h-3.5 text-slate-400" />
                S/O: {{ employee?.father_name }}
              </span>
              <span v-if="employee?.gender" class="flex items-center gap-1">
                <UIcon name="i-heroicons-identification" class="w-3.5 h-3.5 text-slate-400" />
                {{ employee?.gender }}
              </span>
              <span v-if="employee?.phone_no" class="flex items-center gap-1 font-mono">
                <UIcon name="i-heroicons-phone" class="w-3.5 h-3.5 text-slate-400" />
                {{ employee?.phone_no }}
              </span>
            </div>
          </div>
        </div>

        <!-- Contract Progression Pill -->
        <div class="flex items-center gap-3 shrink-0">
          <div class="text-right hidden sm:block">
            <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Contract Progression</span>
            <span class="text-xs font-mono text-emerald-400 font-bold">
              Tenure {{ existingTenures.length }} ➔ Tenure {{ nextTenureNumber }}
            </span>
          </div>
          <div class="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center gap-2">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span class="text-xs font-black tracking-wide text-emerald-300 uppercase">
              Issuing Tenure #{{ nextTenureNumber }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Dual-Pane Body -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto pr-1">
      
      <!-- LEFT COLUMN: Tenures History & Dossier (5 Cols) -->
      <div class="lg:col-span-5 flex flex-col space-y-3.5">
        <div class="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col flex-1 shadow-xs">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-clock" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Immutable Tenures Ledger
              </h4>
            </div>
            <UBadge size="xs" color="neutral" variant="subtle" class="font-bold font-mono">
              {{ existingTenures.length }} Recorded
            </UBadge>
          </div>

          <!-- Tenures Timeline Scroll Container -->
          <div class="space-y-3 overflow-y-auto max-h-[52vh] pr-1 flex-1">
            <div 
              v-for="t in existingTenures" 
              :key="t.tenure_no"
              class="relative pl-4 border-l-2 border-indigo-400/40 dark:border-indigo-600/40 pb-2 last:pb-0"
            >
              <!-- Timeline node dot -->
              <div 
                class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full"
                :class="t.status === 'Active' ? 'bg-emerald-500 ring-4 ring-emerald-500/20' : 'bg-slate-400 dark:bg-slate-600'"
              />

              <!-- Tenure Card -->
              <div class="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-600 transition-all">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-2">
                    <span class="font-black text-xs text-slate-800 dark:text-slate-100">
                      Tenure #{{ t.tenure_no }}
                    </span>
                    <UBadge 
                      size="xs" 
                      :color="t.status === 'Active' ? 'success' : 'neutral'" 
                      variant="subtle"
                      class="text-[9px] font-bold uppercase"
                    >
                      {{ t.status }}
                    </UBadge>
                  </div>
                  <span class="text-[10px] font-mono text-slate-400">
                    {{ t.appointment_ref_no || `APPT/T${t.tenure_no}` }}
                  </span>
                </div>

                <!-- Role, Project & Site -->
                <div class="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-slate-800 dark:text-slate-200">
                      {{ t.project }} <span class="text-slate-400 font-normal">({{ t.site }})</span>
                    </span>
                    <span class="font-black text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                      ₹{{ t.p_day_wage }}/day
                    </span>
                  </div>

                  <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="font-medium bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded text-[10px]">
                      {{ t.category }}
                    </span>
                    <span>
                      {{ formatDate(t.date_of_joining) }} ➔ {{ t.date_of_exit ? formatDate(t.date_of_exit) : 'Active' }}
                    </span>
                  </div>

                  <!-- Banking snapshot for tenure -->
                  <div v-if="t.bank || t.account_no" class="pt-1 mt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                    <span class="truncate max-w-[170px]" :title="t.bank">
                      {{ t.bank || 'Bank' }}
                    </span>
                    <span>
                      A/C: {{ maskAccountNo(t.account_no) }}
                    </span>
                  </div>
                </div>

                <!-- Letter Download Action -->
                <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex justify-end">
                  <UButton 
                    size="xs" 
                    variant="soft" 
                    color="primary" 
                    icon="i-heroicons-document-arrow-down" 
                    :loading="downloadingTenure === t.tenure_no"
                    label="Download Contract Letter"
                    class="font-bold text-[10px]"
                    @click="onDownloadTenureLetter(t.tenure_no)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Legal & Statutory Protection Callout -->
          <div class="mt-3 p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-start gap-2.5">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p class="leading-relaxed">
              <strong class="font-bold">Statutory Integrity:</strong> Historical contract letters remain permanently preserved. Re-engaging with new wage or banking terms creates an isolated, immutable record.
            </p>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Re-Engagement Contract Workstation (7 Cols) -->
      <div class="lg:col-span-7 flex flex-col space-y-4">
        <form @submit.prevent="submitRehire" class="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col flex-1 space-y-5">
          
          <!-- Section 1: Work & Deployment -->
          <div class="space-y-3.5">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-briefcase" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1. New Deployment & Role Terms
                </h4>
              </div>
              <span class="text-[10px] text-slate-400 font-medium">Autocompletes enabled</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Re-joining Date -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Re-Joining Date <span class="text-rose-500">*</span>
                </label>
                <UInput 
                  v-model="form.date_of_joining" 
                  type="date" 
                  required 
                  class="w-full"
                  icon="i-heroicons-calendar"
                />
              </div>

              <!-- Daily Wage Rate with Live Wage Comparison -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Daily Wage Rate (₹) <span class="text-rose-500">*</span>
                  </label>
                  <span 
                    v-if="wageDifference > 0" 
                    class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 font-mono"
                  >
                    +₹{{ wageDifference.toFixed(2) }} vs prior
                  </span>
                  <span 
                    v-else-if="wageDifference === 0" 
                    class="text-[10px] text-slate-400 font-mono"
                  >
                    Same as prior
                  </span>
                  <span 
                    v-else 
                    class="text-[10px] font-bold text-amber-500 font-mono"
                  >
                    {{ wageDifference.toFixed(2) }} vs prior
                  </span>
                </div>
                <UInput 
                  v-model.number="form.p_day_wage" 
                  type="number" 
                  step="0.01" 
                  min="1" 
                  required 
                  class="w-full font-mono font-bold"
                  icon="i-heroicons-currency-rupee"
                />
              </div>

              <!-- Project (Autocomplete) -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Project Name <span class="text-rose-500">*</span>
                </label>
                <UInputMenu 
                  v-model="form.project" 
                  mode="autocomplete"
                  :items="availableProjects"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="Type or select Project..."
                  icon="i-heroicons-briefcase"
                  class="w-full"
                />
              </div>

              <!-- Site (Autocomplete) -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Site Deployment <span class="text-rose-500">*</span>
                </label>
                <UInputMenu 
                  v-model="form.site" 
                  mode="autocomplete"
                  :items="availableSites"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="Type or select Site..."
                  icon="i-heroicons-map-pin"
                  class="w-full"
                />
              </div>

              <!-- Category / Trade (Autocomplete with quick chip selector) -->
              <div class="sm:col-span-2">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Category / Trade Designation <span class="text-rose-500">*</span>
                  </label>
                  <span class="text-[10px] text-slate-400">Type custom or select trade</span>
                </div>
                <UInputMenu 
                  v-model="form.category" 
                  mode="autocomplete"
                  :items="availableCategories"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="e.g. SKILLED, FITTER, CARPENTER"
                  icon="i-heroicons-wrench-screwdriver"
                  class="w-full"
                />

                <!-- Quick Trade Selector Pills -->
                <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span class="text-[10px] text-slate-400 font-medium">Quick Pick:</span>
                  <button 
                    v-for="trade in quickTrades" 
                    :key="trade"
                    type="button"
                    class="text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors"
                    :class="form.category === trade 
                      ? 'bg-indigo-600 text-white shadow-2xs' 
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'"
                    @click="form.category = trade"
                  >
                    {{ trade }}
                  </button>
                </div>
              </div>

              <!-- Prior Exit Record (for contract closure record) -->
              <div class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prior Tenure Exit Date (Closure Record)
                  </label>
                  <UInput 
                    v-model="form.previous_exit_date" 
                    type="date" 
                    placeholder="Optional exit date" 
                    class="w-full"
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prior Exit Reason / Status Note
                  </label>
                  <UInput 
                    v-model="form.previous_exit_reason" 
                    placeholder="e.g. Completed prior contract" 
                    class="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- Section 2: Banking & Contact Verification -->
          <div class="space-y-3.5 pt-2">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Banking & Direct Disbursement Verification
                </h4>
              </div>
              <span class="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-bold border border-amber-200/50 dark:border-amber-900/50">
                Pre-filled from worker profile
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- IFSC with auto lookup -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  IFSC Code (Auto Lookup)
                </label>
                <UInput 
                  :model-value="form.ifsc" 
                  @update:model-value="onIfscChange"
                  placeholder="e.g. SBIN0001234" 
                  maxlength="11"
                  class="w-full uppercase font-mono"
                  icon="i-heroicons-qr-code"
                />
                <div v-if="ifscLookupState.status === 'loading'" class="text-[10px] text-blue-500 mt-1 flex items-center gap-1">
                  <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 animate-spin" />
                  <span>Verifying bank IFSC with database...</span>
                </div>
                <div v-else-if="ifscLookupState.status === 'success'" class="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-bold">
                  <UIcon name="i-heroicons-check-circle" class="w-3 h-3" />
                  <span>{{ ifscLookupState.message }}</span>
                </div>
                <div v-else-if="ifscLookupState.status === 'error'" class="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
                  <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3" />
                  <span>{{ ifscLookupState.message }}</span>
                </div>
              </div>

              <!-- Bank Account Number -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Account Number
                </label>
                <UInput 
                  v-model="form.account_no" 
                  placeholder="e.g. 38245123984" 
                  class="w-full font-mono"
                  icon="i-heroicons-credit-card"
                />
              </div>

              <!-- Bank Name (Autocomplete) -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Name
                </label>
                <UInputMenu 
                  v-model="form.bank" 
                  mode="autocomplete"
                  :items="availableBanks"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="e.g. STATE BANK OF INDIA"
                  icon="i-heroicons-building-library"
                  class="w-full"
                />
              </div>

              <!-- Bank Branch -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Bank Branch
                </label>
                <UInput 
                  v-model="form.branch" 
                  placeholder="e.g. Main Branch, Kolkata" 
                  class="w-full"
                />
              </div>

              <!-- Phone Number -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Active Mobile Phone
                </label>
                <UInput 
                  v-model="form.phone_no" 
                  placeholder="10-digit mobile" 
                  maxlength="10"
                  class="w-full font-mono"
                  icon="i-heroicons-phone"
                />
              </div>

              <!-- Engagement Remarks -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Work Order / Re-Hire Remarks
                </label>
                <UInput 
                  v-model="form.remarks" 
                  placeholder="e.g. Re-engaged for structural completion" 
                  class="w-full"
                />
              </div>
            </div>
          </div>

          <!-- Section 3: Live Contract Summary Preview Card -->
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Live Contract Preview (Tenure #{{ nextTenureNumber }})
              </span>
              <span class="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                Official Letter Issuance
              </span>
            </div>
            <p class="text-slate-700 dark:text-slate-300 leading-relaxed">
              Issuing appointment letter to <strong class="font-bold text-slate-900 dark:text-white">{{ employee?.employee_name }}</strong> as 
              <strong class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{{ form.category || 'CATEGORY' }}</strong> at 
              <strong class="font-bold text-slate-900 dark:text-white">{{ form.project || 'Project' }}</strong> ({{ form.site || 'Site' }}) 
              at daily wage rate <strong class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">₹{{ form.p_day_wage || 0 }}/day</strong>, 
              effective from <strong class="font-bold">{{ formatDate(form.date_of_joining) }}</strong>.
            </p>
            <div class="mt-1 text-[10px] text-slate-400 font-mono flex items-center gap-2">
              <span>Disbursement: {{ form.bank || 'Pending Bank' }}</span>
              <span>•</span>
              <span>A/C: {{ form.account_no ? maskAccountNo(form.account_no) : 'Pending' }}</span>
              <span v-if="form.ifsc">• IFSC: {{ form.ifsc }}</span>
            </div>
          </div>

          <!-- Action Footer -->
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 mt-auto">
            <UButton 
              color="neutral" 
              variant="ghost" 
              label="Cancel" 
              @click="emit('close')" 
            />
            <UButton 
              type="submit" 
              color="primary" 
              icon="i-heroicons-check-circle" 
              :loading="loading" 
              :label="`Confirm & Issue Contract (Tenure #${nextTenureNumber})`"
              class="font-extrabold px-5 shadow-sm"
            />
          </div>
        </form>
      </div>

    </div>
  </div>
</template>
