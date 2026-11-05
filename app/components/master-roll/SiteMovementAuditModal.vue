<script setup lang="ts">
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useToast } from '#imports';
import { useMasterRoll } from '@/composables/useMasterRoll';

const props = defineProps<{
  uniqueOptions?: {
    projects: string[];
    sites: string[];
    categories: string[];
    banks: string[];
  };
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { fetchAllTransfers, exportTransfersExcel, fetchUniqueFields } = useMasterRoll();
const toast = useToast();

const loading = ref(false);
const exportLoading = ref(false);
const transfers = ref<any[]>([]);
const totalCount = ref(0);
const currentPage = ref(1);
const itemsPerPageString = ref('20');
const itemsPerPageOptions = ['10', '20', '50', '100'];

const summary = reactive({
  totalTransfers: 0,
  permanent: 0,
  temporary: 0,
  rotation: 0,
  totalAdvanceTransferred: 0,
  uniqueWorkersCount: 0,
});

const filters = reactive({
  search: '',
  startDate: '',
  endDate: '',
});

const selectedFromSite = ref('All Source Sites');
const selectedToSite = ref('All Destination Sites');
const selectedType = ref('All Types');

const siteList = ref<string[]>([]);
const projectList = ref<string[]>([]);

const sourceSiteOptions = computed(() => ['All Source Sites', ...siteList.value]);
const destinationSiteOptions = computed(() => ['All Destination Sites', ...siteList.value]);
const transferTypeOptions = ['All Types', 'Permanent', 'Temporary', 'Rotation'];

const loadUniqueOptions = async () => {
  if (props.uniqueOptions && props.uniqueOptions.sites?.length) {
    siteList.value = props.uniqueOptions.sites;
    projectList.value = props.uniqueOptions.projects;
    return;
  }
  try {
    const res = await fetchUniqueFields();
    if (res?.success && res.data) {
      siteList.value = res.data.sites || [];
      projectList.value = res.data.projects || [];
    }
  } catch (err) {
    console.error('Failed to load site list:', err);
  }
};

const hasActiveFilters = computed(() => {
  return (
    filters.search.trim() !== '' ||
    selectedFromSite.value !== 'All Source Sites' ||
    selectedToSite.value !== 'All Destination Sites' ||
    selectedType.value !== 'All Types' ||
    Boolean(filters.startDate) ||
    Boolean(filters.endDate)
  );
});

const buildQueryParams = () => {
  const params: Record<string, any> = {};

  if (filters.search.trim()) params.search = filters.search.trim();
  if (selectedFromSite.value !== 'All Source Sites') params.fromSite = selectedFromSite.value;
  if (selectedToSite.value !== 'All Destination Sites') params.toSite = selectedToSite.value;
  if (selectedType.value !== 'All Types') params.transferType = selectedType.value.toUpperCase();
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;

  return params;
};

const fetchData = async () => {
  loading.value = true;
  try {
    const params = {
      ...buildQueryParams(),
      page: currentPage.value,
      limit: parseInt(itemsPerPageString.value, 10) || 20,
    };

    const res = await fetchAllTransfers(params);
    if (res?.success && res.data) {
      transfers.value = res.data.transfers || [];
      totalCount.value = res.data.pagination?.total || 0;
      if (res.data.summary) {
        Object.assign(summary, res.data.summary);
      }
    }
  } catch (err: any) {
    console.error('Failed to load transfers:', err);
    toast.add({
      title: 'Fetch Error',
      description: err?.message || 'Failed to load site movements',
      color: 'error',
    });
  } finally {
    loading.value = false;
  }
};

const handleResetFilters = () => {
  filters.search = '';
  selectedFromSite.value = 'All Source Sites';
  selectedToSite.value = 'All Destination Sites';
  selectedType.value = 'All Types';
  filters.startDate = '';
  filters.endDate = '';
  currentPage.value = 1;
  fetchData();
};

const handleExport = async () => {
  exportLoading.value = true;
  try {
    const params = buildQueryParams();
    await exportTransfersExcel(params);
    toast.add({
      title: 'Export Generated',
      description: 'Site Movement Register downloaded successfully.',
      color: 'success',
    });
  } catch (err: any) {
    toast.add({
      title: 'Export Failed',
      description: err?.message || 'Could not export site movements',
      color: 'error',
    });
  } finally {
    exportLoading.value = false;
  }
};

watch([selectedFromSite, selectedToSite, selectedType], () => {
  currentPage.value = 1;
  fetchData();
});

watch(itemsPerPageString, () => {
  currentPage.value = 1;
  fetchData();
});

watch(currentPage, () => {
  fetchData();
});

onMounted(async () => {
  await loadUniqueOptions();
  await fetchData();
});

const formatDate = (val: string) => {
  if (!val) return '-';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const getTransferTypeBadge = (type: string) => {
  switch (type) {
    case 'PERMANENT':
      return { label: 'Permanent', color: 'primary' as const };
    case 'TEMPORARY':
      return { label: 'Temporary', color: 'warning' as const };
    case 'ROTATION':
      return { label: 'Rotation', color: 'info' as const };
    default:
      return { label: type || 'Transfer', color: 'neutral' as const };
  }
};
</script>

<template>
  <div class="flex flex-col max-h-[85vh] text-slate-800 dark:text-slate-100">
    <!-- Top Summary Banner -->
    <div class="p-4 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Moves</span>
          <p class="text-lg font-black text-slate-800 dark:text-slate-100 mt-0.5">
            {{ summary.totalTransfers }}
          </p>
        </div>

        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Unique Workers</span>
          <p class="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
            {{ summary.uniqueWorkersCount }}
          </p>
        </div>

        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Permanent</span>
          <p class="text-lg font-black text-blue-600 dark:text-blue-400 mt-0.5">
            {{ summary.permanent }}
          </p>
        </div>

        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Temporary</span>
          <p class="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
            {{ summary.temporary }}
          </p>
        </div>

        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Rotations</span>
          <p class="text-lg font-black text-teal-600 dark:text-teal-400 mt-0.5">
            {{ summary.rotation }}
          </p>
        </div>

        <div class="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs">
          <span class="text-[9px] font-black uppercase tracking-widest text-slate-400">Advance Carried</span>
          <p class="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
            {{ formatCurrency(summary.totalAdvanceTransferred) }}
          </p>
        </div>
      </div>
    </div>

    <!-- Filter & Action Controls: Clean 2-Row Layout -->
    <div class="p-3.5 bg-slate-50/70 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 space-y-3">
      <!-- Row 1: Primary Search & Dropdowns -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
        <div>
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Search Worker / Order</label>
          <UInput
            v-model="filters.search"
            placeholder="Name, phone, Aadhaar, ref no..."
            icon="i-heroicons-magnifying-glass"
            size="sm"
            class="w-full bg-white dark:bg-slate-800"
            @keyup.enter="() => { currentPage = 1; fetchData(); }"
          />
        </div>

        <div>
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Source Site</label>
          <USelect
            v-model="selectedFromSite"
            :items="sourceSiteOptions"
            size="sm"
            class="w-full bg-white dark:bg-slate-800"
          />
        </div>

        <div>
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Destination Site</label>
          <USelect
            v-model="selectedToSite"
            :items="destinationSiteOptions"
            size="sm"
            class="w-full bg-white dark:bg-slate-800"
          />
        </div>

        <div>
          <label class="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Transfer Nature</label>
          <USelect
            v-model="selectedType"
            :items="transferTypeOptions"
            size="sm"
            class="w-full bg-white dark:bg-slate-800"
          />
        </div>
      </div>

      <!-- Row 2: Date Range & Action Buttons -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
        <!-- Date Range Filter -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Effective Date:</span>
          <div class="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1 shadow-xs">
            <input
              v-model="filters.startDate"
              type="date"
              class="text-xs bg-transparent border-0 outline-none font-mono text-slate-700 dark:text-slate-200 w-32 cursor-pointer"
            />
            <span class="text-slate-300 dark:text-slate-600 font-bold text-xs">to</span>
            <input
              v-model="filters.endDate"
              type="date"
              class="text-xs bg-transparent border-0 outline-none font-mono text-slate-700 dark:text-slate-200 w-32 cursor-pointer"
            />
          </div>
          <UButton
            v-if="filters.startDate || filters.endDate"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            title="Clear Date Range"
            @click="() => { filters.startDate = ''; filters.endDate = ''; currentPage = 1; fetchData(); }"
          />
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <UButton
            v-if="hasActiveFilters"
            size="sm"
            variant="ghost"
            color="neutral"
            icon="i-heroicons-x-mark"
            label="Reset"
            @click="handleResetFilters"
          />
          <UButton
            size="sm"
            color="primary"
            icon="i-heroicons-funnel"
            label="Apply Filter"
            :loading="loading"
            @click="() => { currentPage = 1; fetchData(); }"
          />
          <UButton
            size="sm"
            variant="soft"
            color="success"
            icon="i-heroicons-table-cells"
            label="Export Excel"
            :loading="exportLoading"
            @click="handleExport"
          />
        </div>
      </div>
    </div>

    <!-- Data Table Container -->
    <div class="flex-1 overflow-y-auto custom-scrollbar p-3">
      <div v-if="loading && transfers.length === 0" class="flex flex-col items-center justify-center py-16 gap-3">
        <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-primary" />
        <p class="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Movement Register...</p>
      </div>

      <div v-else-if="transfers.length === 0" class="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div class="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
          <UIcon name="i-heroicons-arrows-right-left" class="w-6 h-6" />
        </div>
        <div>
          <p class="text-sm font-bold text-slate-700 dark:text-slate-200">No Site Movements Found</p>
          <p class="text-xs text-slate-400 mt-0.5">Try adjusting search keywords, site selections, or date range.</p>
        </div>
        <UButton size="xs" variant="soft" color="neutral" @click="handleResetFilters">
          Reset All Filters
        </UButton>
      </div>

      <div v-else class="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
        <table class="w-full text-left text-xs border-collapse">
          <thead>
            <tr class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-500">
              <th class="p-2.5 w-10 text-center">#</th>
              <th class="p-2.5 min-w-[160px]">Employee</th>
              <th class="p-2.5 min-w-[200px]">Movement Route</th>
              <th class="p-2.5 min-w-[110px]">Effective Date</th>
              <th class="p-2.5 min-w-[100px]">Nature</th>
              <th class="p-2.5 min-w-[110px]">Order Ref</th>
              <th class="p-2.5 min-w-[110px] text-right">Advance Bal</th>
              <th class="p-2.5 min-w-[160px]">Remarks</th>
              <th class="p-2.5 min-w-[110px]">Recorded By</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
            <tr
              v-for="(tr, idx) in transfers"
              :key="tr._id"
              class="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
            >
              <td class="p-2.5 text-center font-mono text-[10px] text-slate-400">
                {{ (currentPage - 1) * parseInt(itemsPerPageString, 10) + idx + 1 }}
              </td>

              <td class="p-2.5">
                <div class="font-bold text-slate-800 dark:text-slate-100">
                  {{ tr.master_roll_id?.employee_name || 'N/A' }}
                </div>
                <div class="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                  <UBadge size="xs" variant="subtle" color="neutral" class="text-[8px] py-0 px-1">
                    {{ tr.master_roll_id?.category || 'Worker' }}
                  </UBadge>
                  <span v-if="tr.master_roll_id?.phone_no" class="font-mono">
                    {{ tr.master_roll_id.phone_no }}
                  </span>
                </div>
              </td>

              <td class="p-2.5">
                <div class="flex items-center gap-1.5 font-bold">
                  <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ tr.from_site || 'Initial' }}
                  </span>
                  <UIcon name="i-heroicons-arrow-right" class="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span class="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {{ tr.to_site }}
                  </span>
                </div>
                <div class="text-[9px] text-slate-400 mt-0.5">
                  {{ tr.to_project || 'General Project' }}
                </div>
              </td>

              <td class="p-2.5 font-mono text-slate-700 dark:text-slate-300">
                {{ formatDate(tr.effective_date) }}
              </td>

              <td class="p-2.5">
                <UBadge
                  size="xs"
                  variant="subtle"
                  :color="getTransferTypeBadge(tr.transfer_type).color"
                  class="text-[9px] font-bold"
                >
                  {{ getTransferTypeBadge(tr.transfer_type).label }}
                </UBadge>
              </td>

              <td class="p-2.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                {{ tr.transfer_order_no || '-' }}
              </td>

              <td class="p-2.5 text-right font-mono font-bold" :class="tr.advance_balance_at_transfer > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'">
                {{ formatCurrency(tr.advance_balance_at_transfer) }}
              </td>

              <td class="p-2.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate" :title="tr.remarks">
                {{ tr.remarks || '-' }}
              </td>

              <td class="p-2.5 text-[10px] text-slate-400">
                <span class="font-medium text-slate-600 dark:text-slate-300">
                  {{ tr.created_by?.name || tr.created_by?.username || 'Admin' }}
                </span>
                <span class="block text-[9px]">{{ formatDate(tr.createdAt) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Footer: Pagination & Actions -->
    <div class="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Total: {{ totalCount }} Movements
        </span>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] font-bold uppercase tracking-wider text-slate-400">Rows:</span>
          <select
            v-model="itemsPerPageString"
            class="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold outline-none"
          >
            <option v-for="opt in itemsPerPageOptions" :key="opt" :value="opt">{{ opt }}</option>
          </select>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <UPagination
          v-if="totalCount > parseInt(itemsPerPageString, 10)"
          v-model:page="currentPage"
          :total="totalCount"
          :items-per-page="parseInt(itemsPerPageString, 10)"
          :show-edges="true"
          size="xs"
        />
        <UButton size="xs" variant="ghost" color="neutral" @click="emit('close')">
          Close
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 8px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
}
</style>
