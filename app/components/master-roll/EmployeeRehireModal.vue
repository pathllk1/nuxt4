<script setup lang="ts">
import { ref, computed } from 'vue';
import { useToast } from '#imports';
import { useMasterRoll } from '@/composables/useMasterRoll';

const props = defineProps<{
  employee: any;
  uniqueProjects?: string[];
  uniqueSites?: string[];
  uniqueCategories?: string[];
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
          message: `${data.BANK} - ${data.BRANCH || ''}`
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
];

const availableCategories = computed(() => {
  const set = new Set([...(props.uniqueCategories || []), ...defaultCategories]);
  return Array.from(set).filter(Boolean);
});

// Computed existing tenures list
const existingTenures = computed(() => {
  if (props.employee?.tenures && Array.isArray(props.employee.tenures) && props.employee.tenures.length > 0) {
    return props.employee.tenures;
  }
  // Synthetic Tenure 1 for display
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
      appointment_ref_no: `APPT/${(props.employee?.date_of_joining || '2026').slice(0, 4)}/${String(props.employee?._id || '').slice(-6).toUpperCase()}-T1`,
    },
  ];
});

const nextTenureNumber = computed(() => existingTenures.value.length + 1);

const onDownloadTenureLetter = async (tenureNo: number) => {
  downloadingTenure.value = tenureNo;
  try {
    await downloadAppointmentLetter(props.employee._id, props.employee.employee_name, tenureNo);
    toast.add({
      title: 'Letter Downloaded',
      description: `Appointment Letter for Tenure #${tenureNo} generated successfully.`,
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
        title: 'Re-hire Successful',
        description: `${props.employee.employee_name} has been engaged under Tenure #${nextTenureNumber.value}.`,
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
  <div class="space-y-6">
    <!-- Header banner -->
    <div class="bg-gradient-to-r from-emerald-900 to-slate-900 p-4 rounded-xl text-white shadow-sm flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
          <UIcon name="i-heroicons-user-plus" class="w-6 h-6" />
        </div>
        <div>
          <h3 class="font-black text-sm tracking-wide">{{ employee?.employee_name }}</h3>
          <p class="text-xs text-emerald-300 font-mono">
            Aadhaar: XXXX-XXXX-{{ String(employee?.aadhar || '').slice(-4) }} • Currently {{ employee?.status }}
          </p>
        </div>
      </div>
      <UBadge color="primary" variant="solid" class="font-bold text-[10px] tracking-wider uppercase">
        New Contract: Tenure #{{ nextTenureNumber }}
      </UBadge>
    </div>

    <!-- Prior Employment Tenures Summary -->
    <div class="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-clock" class="w-4 h-4 text-slate-500" />
          <h4 class="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Employment Tenures History ({{ existingTenures.length }})
          </h4>
        </div>
        <span class="text-[10px] text-slate-400 font-medium">All prior appointment letters preserved</span>
      </div>

      <div class="space-y-2 max-h-48 overflow-y-auto pr-1">
        <div 
          v-for="t in existingTenures" 
          :key="t.tenure_no"
          class="flex items-center justify-between bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-xs shadow-2xs"
        >
          <div class="space-y-0.5">
            <div class="flex items-center gap-2">
              <span class="font-black text-slate-800 dark:text-slate-200">Tenure #{{ t.tenure_no }}</span>
              <UBadge size="xs" :color="t.status === 'Active' ? 'success' : 'neutral'" variant="subtle">
                {{ t.status }}
              </UBadge>
              <span class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 font-mono">{{ t.category }}</span>
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400">
              <span class="font-bold text-slate-700 dark:text-slate-300">{{ t.project }}</span> ({{ t.site }}) • 
              <span class="font-mono text-emerald-600 dark:text-emerald-400 font-bold">₹{{ t.p_day_wage }}/day</span> • 
              Joined: {{ t.date_of_joining }} <span v-if="t.date_of_exit">→ Left: {{ t.date_of_exit }}</span>
            </p>
            <p v-if="t.bank || t.account_no" class="text-[10px] text-slate-400 font-mono">
              Bank: {{ t.bank || 'N/A' }} • A/C: {{ t.account_no || 'N/A' }} ({{ t.ifsc || 'N/A' }})
            </p>
          </div>

          <UButton 
            size="xs" 
            variant="soft" 
            color="primary" 
            icon="i-heroicons-document-arrow-down" 
            :loading="downloadingTenure === t.tenure_no"
            label="Letter"
            @click="onDownloadTenureLetter(t.tenure_no)"
          />
        </div>
      </div>
    </div>

    <!-- Re-hire Form -->
    <form @submit.prevent="submitRehire" class="space-y-5">
      <!-- Section 1: Work & Deployment -->
      <div class="space-y-3">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
          <h4 class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            1. Contract & Deployment (Tenure #{{ nextTenureNumber }})
          </h4>
          <span class="text-[10px] text-slate-400 font-medium">New assignment details</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Re-joining Date <span class="text-rose-500">*</span>
            </label>
            <UInput 
              v-model="form.date_of_joining" 
              type="date" 
              required 
              class="w-full"
              icon="i-heroicons-calendar"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              New Category / Trade <span class="text-rose-500">*</span>
            </label>
            <UInput 
              v-model="form.category" 
              placeholder="e.g. SKILLED, CARPENTER" 
              required 
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              New Project <span class="text-rose-500">*</span>
            </label>
            <UInput 
              v-model="form.project" 
              placeholder="e.g. Project A" 
              required 
              class="w-full"
              icon="i-heroicons-briefcase"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              New Site Deployment <span class="text-rose-500">*</span>
            </label>
            <UInput 
              v-model="form.site" 
              placeholder="e.g. Site B" 
              required 
              class="w-full"
              icon="i-heroicons-map-pin"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              New Daily Wage Rate (₹) <span class="text-rose-500">*</span>
            </label>
            <UInput 
              v-model.number="form.p_day_wage" 
              type="number" 
              step="0.01" 
              min="1" 
              required 
              class="w-full"
              icon="i-heroicons-currency-rupee"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Prior Tenure Exit Date (Record if missing)
            </label>
            <UInput 
              v-model="form.previous_exit_date" 
              type="date" 
              placeholder="Optional exit date" 
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Section 2: Banking & Contact Verification -->
      <div class="space-y-3 pt-2">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-1.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-heroicons-building-library" class="w-4 h-4 text-emerald-600" />
            <h4 class="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              2. Banking & Contact Verification (Review or Update if Changed)
            </h4>
          </div>
          <span class="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded font-bold">
            Pre-filled with last known details
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              IFSC Code
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
              <span>Verifying bank code...</span>
            </div>
            <div v-else-if="ifscLookupState.status === 'success'" class="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-bold">
              <UIcon name="i-heroicons-check-circle" class="w-3 h-3" />
              <span>{{ ifscLookupState.message }}</span>
            </div>
            <div v-else-if="ifscLookupState.status === 'error'" class="text-[10px] text-rose-500 mt-1 flex items-center gap-1">
              <UIcon name="i-heroicons-exclamation-triangle" class="w-3 h-3" />
              <span>{{ ifscLookupState.message }}</span>
            </div>
          </div>

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

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Bank Name
            </label>
            <UInput 
              v-model="form.bank" 
              placeholder="e.g. STATE BANK OF INDIA" 
              class="w-full"
              icon="i-heroicons-building-library"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Bank Branch
            </label>
            <UInput 
              v-model="form.branch" 
              placeholder="e.g. Main Branch" 
              class="w-full"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Mobile Phone Number
            </label>
            <UInput 
              v-model="form.phone_no" 
              placeholder="10-digit mobile number" 
              maxlength="10"
              class="w-full font-mono"
              icon="i-heroicons-phone"
            />
          </div>

          <div>
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Engagement Remarks / Order Reference
            </label>
            <UInput 
              v-model="form.remarks" 
              placeholder="e.g. Re-engaged for Phase 2 finishing works" 
              class="w-full"
            />
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <UButton color="neutral" variant="ghost" label="Cancel" @click="emit('close')" />
        <UButton 
          type="submit" 
          color="primary" 
          icon="i-heroicons-check-circle" 
          :loading="loading" 
          label="Confirm & Execute Re-Hire" 
        />
      </div>
    </form>
  </div>
</template>
