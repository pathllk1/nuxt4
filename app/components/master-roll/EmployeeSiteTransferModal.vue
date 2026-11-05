<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useToast } from '#imports';
import { useMasterRoll } from '@/composables/useMasterRoll';

const props = defineProps<{
  employee: any;
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
  { label: 'Permanent Relocation', value: 'PERMANENT' },
  { label: 'Temporary Deployment', value: 'TEMPORARY' },
  { label: 'Site Rotation', value: 'ROTATION' },
];

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

  if (form.value.toSite.trim().toLowerCase() === (props.employee.site || '').trim().toLowerCase()) {
    toast.add({
      title: 'Redundant Transfer',
      description: 'Employee is already stationed at this site',
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
        description: res.message || 'Site transfer recorded successfully',
        color: 'success',
      });
      emit('transferred', res.data?.employee);
      emit('close');
    }
  } catch (err: any) {
    toast.add({
      title: 'Transfer Failed',
      description: err.message || 'Error executing site transfer',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};

const formatDate = (val: string) => {
  if (!val) return 'N/A';
  return new Date(val).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};
</script>

<template>
  <div class="flex flex-col max-h-[85vh]">
    <!-- Header Summary Card -->
    <div class="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700/80">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Stationing</span>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-xs font-black uppercase text-slate-800 dark:text-slate-100">
              {{ props.employee.project || 'General Project' }}
            </span>
            <span class="text-slate-400">•</span>
            <span class="text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              Site: {{ props.employee.site || 'Unassigned' }}
            </span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Category / Status</span>
          <div class="flex items-center gap-1.5 justify-end mt-0.5">
            <UBadge size="xs" variant="subtle" color="neutral">{{ props.employee.category || 'Worker' }}</UBadge>
            <UBadge size="xs" variant="subtle" :color="props.employee.status === 'Active' ? 'success' : 'error'">
              {{ props.employee.status }}
            </UBadge>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Body: Tabs or Form + Timeline -->
    <div class="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
      <!-- Transfer Form -->
      <form @submit.prevent="submitTransfer" class="space-y-3">
        <h4 class="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
          Execute Location Transfer
        </h4>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UFormField label="Target Site Name" required>
            <UInput
              v-model="form.toSite"
              placeholder="e.g. Site B, Metro Station-3"
              class="w-full font-bold"
              size="sm"
            />
          </UFormField>

          <UFormField label="Target Project">
            <UInput
              v-model="form.toProject"
              placeholder="e.g. Line 3 Extension"
              class="w-full"
              size="sm"
            />
          </UFormField>

          <UFormField label="Effective Transfer Date" required>
            <UInput
              v-model="form.effectiveDate"
              type="date"
              class="w-full font-mono text-xs"
              size="sm"
            />
          </UFormField>

          <UFormField label="Transfer Nature">
            <select
              v-model="form.transferType"
              class="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold outline-none"
            >
              <option v-for="t in transferTypes" :key="t.value" :value="t.value">
                {{ t.label }}
              </option>
            </select>
          </UFormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <UFormField label="Transfer Order / Ref No (Optional)">
            <UInput
              v-model="form.transferOrderNo"
              placeholder="e.g. TO/2026/041"
              class="w-full font-mono text-xs"
              size="sm"
            />
          </UFormField>

          <UFormField label="Remarks / Justification">
            <UInput
              v-model="form.remarks"
              placeholder="e.g. Special excavation assignment"
              class="w-full text-xs"
              size="sm"
            />
          </UFormField>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <UButton size="xs" variant="ghost" color="neutral" @click="emit('close')">Cancel</UButton>
          <UButton
            size="xs"
            color="primary"
            icon="i-heroicons-arrow-right-circle"
            :loading="loading"
            type="submit"
          >
            Confirm Site Transfer
          </UButton>
        </div>
      </form>

      <!-- Past Movement History -->
      <div class="pt-3 border-t border-slate-200 dark:border-slate-700">
        <div class="flex items-center justify-between mb-2">
          <h4 class="text-[10px] font-black uppercase tracking-widest text-slate-500">
            Movement & Deployment History ({{ transfers.length }})
          </h4>
          <span class="text-[9px] text-slate-400 font-medium">Chronological Audit Log</span>
        </div>

        <div v-if="historyLoading" class="flex justify-center py-6">
          <UIcon name="i-heroicons-arrow-path" class="w-5 h-5 animate-spin text-primary" />
        </div>

        <div v-else-if="transfers.length === 0" class="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">
          No previous transfers on record.
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="tr in transfers"
            :key="tr._id"
            class="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-1 text-xs"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 font-bold">
                <span class="text-slate-600 dark:text-slate-300">{{ tr.from_site || 'Initial' }}</span>
                <UIcon name="i-heroicons-arrow-right" class="w-3 h-3 text-slate-400" />
                <span class="text-indigo-600 dark:text-indigo-400">{{ tr.to_site }}</span>
              </div>
              <UBadge size="xs" variant="subtle" color="neutral" class="text-[8px] uppercase">
                {{ tr.transfer_type }}
              </UBadge>
            </div>

            <div class="flex items-center justify-between text-[10px] text-slate-400">
              <span>Effective: <strong class="font-mono text-slate-700 dark:text-slate-300">{{ formatDate(tr.effective_date) }}</strong></span>
              <span v-if="tr.transfer_order_no" class="font-mono">Ref: {{ tr.transfer_order_no }}</span>
            </div>

            <div v-if="tr.remarks" class="text-[10px] italic text-slate-500 dark:text-slate-400 pt-0.5">
              "{{ tr.remarks }}"
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

