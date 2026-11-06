<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useToast } from '#imports';
import { useMasterRoll } from '@/composables/useMasterRoll';

const props = defineProps<{
  employee: any;
  uniqueProjects?: string[];
  uniqueSites?: string[];
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'transferred', updatedEmployee: any): void;
}>();

const { transferEmployee, getEmployeeTransfers } = useMasterRoll();
const toast = useToast();

const loading = ref(false);
const historyLoading = ref(true);
const transfers = ref<any[]>([]);

const form = ref({
  toSite: '',
  toProject: props.employee?.project || '',
  effectiveDate: new Date().toISOString().split('T')[0] || '',
  transferType: 'PERMANENT',
  transferOrderNo: '',
  remarks: '',
});

const transferTypes = [
  { 
    label: 'Permanent Relocation', 
    value: 'PERMANENT',
    desc: 'Indefinite stationing transfer to destination site',
    icon: 'i-heroicons-arrow-right-circle'
  },
  { 
    label: 'Temporary Deployment', 
    value: 'TEMPORARY',
    desc: 'Short-term site assistance / interim operational task',
    icon: 'i-heroicons-clock'
  },
  { 
    label: 'Site Rotation', 
    value: 'ROTATION',
    desc: 'Routine operational shift or periodic crew rotation',
    icon: 'i-heroicons-arrow-path'
  },
];

const availableProjects = computed(() => {
  const set = new Set([...(props.uniqueProjects || [])]);
  if (props.employee?.project) set.add(props.employee.project);
  return Array.from(set).filter(Boolean);
});

const availableSites = computed(() => {
  const set = new Set([...(props.uniqueSites || [])]);
  return Array.from(set).filter(Boolean);
});

// Quick suggestion sites excluding current site
const suggestedSites = computed(() => {
  const currentSite = (props.employee?.site || '').trim().toLowerCase();
  return availableSites.value
    .filter(s => s.trim().toLowerCase() !== currentSite)
    .slice(0, 6);
});

const fetchHistory = async () => {
  if (!props.employee?._id) return;
  historyLoading.value = true;
  try {
    const res = await getEmployeeTransfers(props.employee._id);
    if (res?.success && res.data?.transfers) {
      transfers.value = res.data.transfers;
    }
  } catch (err: any) {
    console.error('Failed to fetch transfers:', err);
  } finally {
    historyLoading.value = false;
  }
};

onMounted(() => {
  fetchHistory();
});

const submitTransfer = async () => {
  if (!form.value.toSite.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Destination site name is required',
      color: 'error',
    });
    return;
  }

  if (form.value.toSite.trim().toLowerCase() === (props.employee?.site || '').trim().toLowerCase()) {
    toast.add({
      title: 'Redundant Transfer',
      description: `Employee is already stationed at "${props.employee?.site || 'this site'}"`,
      color: 'warning',
    });
    return;
  }

  loading.value = true;
  try {
    const res = await transferEmployee({
      masterRollId: props.employee._id,
      toSite: form.value.toSite.trim(),
      toProject: form.value.toProject.trim() || undefined,
      effectiveDate: form.value.effectiveDate,
      transferType: form.value.transferType,
      transferOrderNo: form.value.transferOrderNo.trim() || undefined,
      remarks: form.value.remarks.trim() || undefined,
    });

    if (res?.success) {
      toast.add({
        title: 'Transfer Executed',
        description: res.message || `${props.employee.employee_name} successfully transferred to ${form.value.toSite.trim()}.`,
        color: 'success',
      });
      emit('transferred', res.data?.employee);
      emit('close');
    } else {
      toast.add({
        title: 'Transfer Failed',
        description: res?.message || 'Could not record site transfer',
        color: 'error',
      });
    }
  } catch (err: any) {
    toast.add({
      title: 'Transfer Failed',
      description: err.data?.message || err.message || 'Error executing site transfer',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};

const formatDate = (val?: string) => {
  if (!val) return 'N/A';
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
</script>

<template>
  <div class="flex flex-col h-full max-h-[82vh] space-y-4">
    <!-- Executive Top Banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 border border-slate-800 p-4 text-white shadow-lg shrink-0">
      <div class="absolute -right-8 -bottom-8 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <!-- Worker Snapshot -->
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center font-black text-white text-base shadow-inner border border-white/20">
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
                Status: {{ employee?.status || 'Active' }}
              </UBadge>
              <UBadge size="xs" variant="outline" color="neutral" class="text-[10px] font-mono">
                {{ employee?.category || 'Worker' }}
              </UBadge>
              <span class="text-xs text-sky-300 font-mono">
                Aadhaar: {{ maskAadhaar(employee?.aadhar) }}
              </span>
            </div>
            <!-- Current Stationing display -->
            <div class="flex items-center gap-2.5 text-xs text-slate-300 mt-1 flex-wrap">
              <span class="text-slate-400 font-medium">Current Deployment:</span>
              <span class="font-bold text-white font-mono">{{ employee?.project || 'General Project' }}</span>
              <span class="text-slate-500">•</span>
              <span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-400/30 font-bold">
                Site: {{ employee?.site || 'Unassigned' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Transfer Status Pill -->
        <div class="flex items-center gap-3 shrink-0">
          <div class="bg-sky-500/20 border border-sky-500/30 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
            <span class="relative flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
            </span>
            <span class="text-xs font-black tracking-wide text-sky-200 uppercase">
              Location Transfer Mode
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Main Dual-Pane Body -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 min-h-0 overflow-y-auto pr-1">
      
      <!-- LEFT COLUMN: Movement & Deployment History (5 Cols) -->
      <div class="lg:col-span-5 flex flex-col space-y-3.5">
        <div class="bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col flex-1 shadow-xs">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-arrow-path-rounded-square" class="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Movement & Deployment History
              </h4>
            </div>
            <UBadge size="xs" color="neutral" variant="subtle" class="font-bold font-mono">
              {{ transfers.length }} Mobilization(s)
            </UBadge>
          </div>

          <!-- Loading State -->
          <div v-if="historyLoading" class="flex flex-col items-center justify-center py-12 flex-1">
            <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 animate-spin text-sky-600" />
            <span class="text-xs text-slate-400 mt-2 font-medium">Fetching mobilization records...</span>
          </div>

          <!-- Empty State -->
          <div v-else-if="transfers.length === 0" class="flex flex-col items-center justify-center py-10 px-4 text-center flex-1">
            <div class="w-12 h-12 rounded-full bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <UIcon name="i-heroicons-map-pin" class="w-6 h-6" />
            </div>
            <h5 class="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
              No Previous Transfers on Record
            </h5>
            <p class="text-[11px] text-slate-400 mt-1 max-w-[240px] leading-relaxed">
              Worker has been continuously deployed at initial stationing ({{ employee?.site || 'Unassigned' }}) since onboarding.
            </p>
          </div>

          <!-- History Timeline -->
          <div v-else class="space-y-3 overflow-y-auto max-h-[52vh] pr-1 flex-1">
            <div 
              v-for="(tr, idx) in transfers" 
              :key="tr._id || idx"
              class="relative pl-4 border-l-2 border-sky-400/40 dark:border-sky-600/40 pb-2 last:pb-0"
            >
              <!-- Timeline node dot -->
              <div class="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-sky-500 ring-4 ring-sky-500/20" />

              <!-- Card -->
              <div class="bg-white dark:bg-slate-800/90 rounded-xl p-3 border border-slate-200/90 dark:border-slate-700/80 shadow-2xs hover:border-sky-300 dark:hover:border-sky-600 transition-all">
                <div class="flex items-center justify-between mb-1.5">
                  <div class="flex items-center gap-1.5 font-extrabold text-xs">
                    <span class="text-slate-600 dark:text-slate-300">{{ tr.from_site || 'Initial' }}</span>
                    <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 text-sky-500" />
                    <span class="text-sky-600 dark:text-sky-400">{{ tr.to_site }}</span>
                  </div>
                  <UBadge size="xs" variant="subtle" color="primary" class="text-[9px] uppercase font-bold">
                    {{ tr.transfer_type }}
                  </UBadge>
                </div>

                <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Effective: <strong class="font-mono text-slate-800 dark:text-slate-200">{{ formatDate(tr.effective_date) }}</strong></span>
                  <span v-if="tr.transfer_order_no" class="font-mono text-[10px]">Ref: {{ tr.transfer_order_no }}</span>
                </div>

                <div v-if="tr.to_project" class="text-[10px] text-slate-400 font-mono mt-0.5">
                  Project: {{ tr.to_project }}
                </div>

                <div v-if="tr.remarks" class="text-[11px] italic text-slate-500 dark:text-slate-400 pt-1 mt-1 border-t border-slate-100 dark:border-slate-700/60">
                  "{{ tr.remarks }}"
                </div>
              </div>
            </div>
          </div>

          <!-- Statutory Compliance Callout -->
          <div class="mt-3 p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-900/50 text-[11px] text-sky-900 dark:text-sky-200 flex items-start gap-2.5">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
            <p class="leading-relaxed">
              <strong class="font-bold">CLRA Audit Trail:</strong> Inter-site transfers are automatically registered in the muster movement roll to ensure full statutory compliance during principal employer audits.
            </p>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Location Transfer Workstation (7 Cols) -->
      <div class="lg:col-span-7 flex flex-col space-y-4">
        <form @submit.prevent="submitTransfer" class="bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs flex flex-col flex-1 space-y-5">
          
          <!-- Section 1: Destination Deployment -->
          <div class="space-y-3.5">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  1. Target Site & Project Destination
                </h4>
              </div>
              <span class="text-[10px] text-slate-400 font-medium">Autocompletes enabled</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <!-- Target Site Name (Autocomplete) -->
              <div class="sm:col-span-2">
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Target Site Name <span class="text-rose-500">*</span>
                  </label>
                  <span class="text-[10px] text-slate-400">Type or select destination</span>
                </div>
                <UInputMenu 
                  v-model="form.toSite" 
                  mode="autocomplete"
                  :items="availableSites"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="e.g. Site B, Metro Station-3"
                  icon="i-heroicons-map-pin"
                  class="w-full font-bold"
                />

                <!-- Quick Suggested Sites Chips -->
                <div v-if="suggestedSites.length > 0" class="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span class="text-[10px] text-slate-400 font-medium">Suggested Sites:</span>
                  <button 
                    v-for="site in suggestedSites" 
                    :key="site"
                    type="button"
                    class="text-[10px] px-2 py-0.5 rounded-md font-semibold transition-colors"
                    :class="form.toSite === site 
                      ? 'bg-sky-600 text-white shadow-2xs' 
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'"
                    @click="form.toSite = site"
                  >
                    {{ site }}
                  </button>
                </div>
              </div>

              <!-- Target Project (Autocomplete) -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Project
                </label>
                <UInputMenu 
                  v-model="form.toProject" 
                  mode="autocomplete"
                  :items="availableProjects"
                  :trailing-icon="false"
                  :content="{ hideWhenEmpty: true }"
                  placeholder="e.g. Line 3 Extension"
                  icon="i-heroicons-briefcase"
                  class="w-full"
                />
              </div>

              <!-- Effective Transfer Date -->
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Effective Transfer Date <span class="text-rose-500">*</span>
                </label>
                <UInput 
                  v-model="form.effectiveDate" 
                  type="date" 
                  required 
                  class="w-full font-mono text-xs"
                  icon="i-heroicons-calendar"
                />
              </div>
            </div>
          </div>

          <!-- Section 2: Mobilization Classification -->
          <div class="space-y-3.5 pt-1">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-tag" class="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  2. Mobilization Classification & Reference
                </h4>
              </div>
              <span class="text-[10px] text-slate-400 font-medium">Select nature</span>
            </div>

            <!-- Transfer Nature Rich Interactive Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                v-for="t in transferTypes"
                :key="t.value"
                type="button"
                class="p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between"
                :class="form.transferType === t.value 
                  ? 'border-sky-600 bg-sky-50/80 dark:bg-sky-950/40 text-sky-950 dark:text-sky-100 ring-1 ring-sky-500 shadow-2xs' 
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'"
                @click="form.transferType = t.value"
              >
                <div class="flex items-center justify-between w-full mb-1">
                  <span class="text-xs font-bold">{{ t.label }}</span>
                  <UIcon :name="t.icon" class="w-4 h-4" :class="form.transferType === t.value ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'" />
                </div>
                <span class="text-[10px] text-slate-400 leading-tight">
                  {{ t.desc }}
                </span>
              </button>
            </div>

            <!-- Reference & Remarks -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Transfer Order / Ref No (Optional)
                </label>
                <UInput 
                  v-model="form.transferOrderNo" 
                  placeholder="e.g. TO/2026/041" 
                  class="w-full font-mono text-xs"
                  icon="i-heroicons-hashtag"
                />
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Remarks / Justification
                </label>
                <UInput 
                  v-model="form.remarks" 
                  placeholder="e.g. Special excavation assignment" 
                  class="w-full text-xs"
                  icon="i-heroicons-chat-bubble-bottom-center-text"
                />
              </div>
            </div>
          </div>

          <!-- Section 3: Live Mobilization Movement Preview -->
          <div class="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Mobilization Movement Preview
              </span>
              <UBadge size="xs" variant="subtle" color="primary" class="font-mono text-[9px] uppercase font-bold">
                {{ form.transferType }}
              </UBadge>
            </div>

            <div class="flex items-center gap-3 py-1 flex-wrap">
              <!-- Origin Station -->
              <div class="bg-white dark:bg-slate-900 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 flex-1 min-w-[150px]">
                <span class="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Origin Station</span>
                <span class="font-bold text-slate-800 dark:text-slate-100 text-xs">
                  {{ employee?.site || 'Unassigned' }}
                </span>
                <span class="text-[10px] text-slate-400 block font-mono">
                  {{ employee?.project || 'Current Project' }}
                </span>
              </div>

              <!-- Animated Arrow & Effective Date -->
              <div class="flex flex-col items-center justify-center text-sky-500 px-1">
                <UIcon name="i-heroicons-arrow-right" class="w-5 h-5 animate-pulse" />
                <span class="text-[10px] font-mono text-slate-400 font-bold mt-0.5">
                  {{ formatDate(form.effectiveDate) }}
                </span>
              </div>

              <!-- Destination Station -->
              <div class="bg-sky-50/70 dark:bg-sky-950/40 px-3.5 py-2 rounded-xl border border-sky-200/80 dark:border-sky-800 flex-1 min-w-[150px]">
                <span class="text-[9px] text-sky-600 dark:text-sky-400 block uppercase font-bold tracking-wider">Target Destination</span>
                <span class="font-black text-sky-700 dark:text-sky-300 text-xs">
                  {{ form.toSite || 'Type or select destination site...' }}
                </span>
                <span class="text-[10px] text-sky-500 dark:text-sky-400 block font-mono">
                  {{ form.toProject || employee?.project || 'Target Project' }}
                </span>
              </div>
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
              icon="i-heroicons-arrow-right-circle" 
              :loading="loading" 
              :disabled="!form.toSite.trim()"
              label="Confirm Location Transfer"
              class="font-extrabold px-5 shadow-sm"
            />
          </div>
        </form>
      </div>

    </div>
  </div>
</template>
