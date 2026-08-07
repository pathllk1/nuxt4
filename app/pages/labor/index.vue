<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 w-full mx-auto space-y-4 animate-fadeIn">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 shrink-0">
      <div>
        <h1 class="text-xl font-bold text-gray-900 dark:text-white tracking-tight uppercase flex items-center gap-1.5">
          <span>👷</span> Labor Management
        </h1>
        <p class="text-gray-500 dark:text-gray-400 font-medium text-xs mt-0.5">
          Track work batches, worker attendance matrix, and double-entry ledger payouts.
        </p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <UButton 
          icon="i-lucide-user-plus" 
          label="New Leader" 
          color="neutral" 
          variant="outline" 
          size="xs" 
          class="font-bold cursor-pointer"
          @click="openLeaderModal()" 
        />
        <UButton 
          icon="i-lucide-calendar-days" 
          label="Start Work Period" 
          color="primary" 
          size="xs" 
          class="font-bold cursor-pointer"
          @click="openPeriodModal()" 
        />
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
      <div class="p-3 bg-gradient-to-r from-teal-600 to-cyan-600 rounded-xl text-white shadow-sm flex items-center justify-between">
        <div>
          <p class="text-[9px] font-bold uppercase tracking-wider opacity-90">Total Labor Leaders</p>
          <p class="text-xl font-black mt-0.5">{{ leaders.length }}</p>
        </div>
        <div class="p-2 bg-white/10 rounded-lg">
          <UIcon name="i-lucide-users" class="w-5 h-5" />
        </div>
      </div>
      <div class="p-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white shadow-sm flex items-center justify-between">
        <div>
          <p class="text-[9px] font-bold uppercase tracking-wider opacity-90">Active Open Periods</p>
          <p class="text-xl font-black mt-0.5">{{ openPeriodsCount }}</p>
        </div>
        <div class="p-2 bg-white/10 rounded-lg">
          <UIcon name="i-lucide-clock" class="w-5 h-5" />
        </div>
      </div>
      <div class="p-3 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl text-white shadow-sm flex items-center justify-between">
        <div>
          <p class="text-[9px] font-bold uppercase tracking-wider opacity-90">Total Batches</p>
          <p class="text-xl font-black mt-0.5">{{ periods.length }}</p>
        </div>
        <div class="p-2 bg-white/10 rounded-lg">
          <UIcon name="i-lucide-archive" class="w-5 h-5" />
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Recent Work Periods -->
      <div class="lg:col-span-2 space-y-3">
        <div class="flex justify-between items-center">
          <h2 class="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
            <UIcon name="i-lucide-list-checks" class="w-4 h-4 text-teal-500" />
            Recent Work Periods
          </h2>
          <div class="flex items-center gap-1.5">
            <span class="text-[9px] font-bold uppercase text-gray-400 dark:text-gray-500 tracking-wider">Filter:</span>
            <USelect 
              v-model="leaderFilter"
              :items="leaderFilterOptions" 
              size="xs"
              class="w-36 font-semibold cursor-pointer" 
            />
          </div>
        </div>

        <div v-if="loading && periods.length === 0" class="flex justify-center py-12 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-teal-500" />
        </div>

        <div v-else-if="filteredPeriods.length === 0" class="bg-white dark:bg-gray-900 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-10 text-center">
          <div class="w-12 h-12 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
            <UIcon name="i-lucide-calendar" class="w-6 h-6 text-gray-400 dark:text-gray-600" />
          </div>
          <h3 class="text-gray-900 dark:text-white font-bold text-xs mb-0.5">No work periods found</h3>
          <p class="text-gray-500 dark:text-gray-400 text-[11px] max-w-xs mx-auto">Start a new work period to track worker attendance and settle payments.</p>
        </div>

        <div v-else class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th class="px-3.5 py-2.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leader / Batch ID</th>
                  <th class="px-3.5 py-2.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Date Range</th>
                  <th class="px-3.5 py-2.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-3.5 py-2.5 text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr 
                  v-for="p in filteredPeriods" 
                  :key="p.id" 
                  class="hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition cursor-pointer group"
                  @click="navigateTo(`/labor/period/${p.id}`)"
                >
                  <td class="px-3.5 py-2.5">
                    <div class="font-bold text-xs text-gray-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">{{ p.leader_name }}</div>
                    <div class="text-[9px] text-gray-400 dark:text-gray-500 font-mono">ID: {{ p.id.substring(0, 8) }}</div>
                  </td>
                  <td class="px-3.5 py-2.5 font-semibold text-xs text-gray-600 dark:text-gray-300">
                    {{ formatDate(p.start_date) }} - {{ formatDate(p.end_date) }}
                  </td>
                  <td class="px-3.5 py-2.5">
                    <UBadge 
                      :color="p.status === 'Open' ? 'success' : 'neutral'" 
                      variant="subtle" 
                      size="xs"
                      class="uppercase font-bold tracking-wider text-[8px] px-1.5 py-0.5"
                    >
                      {{ p.status }}
                    </UBadge>
                  </td>
                  <td class="px-3.5 py-2.5 text-right" @click.stop>
                    <div class="flex items-center justify-end gap-1.5">
                      <UButton 
                        v-if="p.status === 'Open'"
                        icon="i-lucide-trash-2" 
                        variant="ghost" 
                        color="error" 
                        size="xs" 
                        class="cursor-pointer"
                        @click="handleDeletePeriod(p.id)"
                      />
                      <UButton 
                        label="Worksheet" 
                        size="xs" 
                        color="primary" 
                        variant="solid"
                        class="font-bold cursor-pointer text-[10px] py-1 px-2.5" 
                        :to="`/labor/period/${p.id}`" 
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Leaders Sidebar -->
      <div class="space-y-3">
        <h2 class="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
          <UIcon name="i-lucide-users" class="w-4 h-4 text-teal-500" />
          Labor Leaders
        </h2>
        <div class="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-2 divide-y divide-gray-100 dark:divide-gray-800">
          <div v-if="leaders.length === 0" class="text-gray-400 dark:text-gray-500 text-xs text-center py-8 italic font-medium">
            No leaders registered yet.
          </div>
          <div 
            v-else 
            v-for="l in leaders" 
            :key="l.id" 
            class="p-2.5 flex flex-col group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition rounded-lg"
          >
            <div class="flex justify-between items-center mb-0.5">
              <div class="font-bold text-xs text-gray-900 dark:text-white">{{ l.name }}</div>
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <UButton 
                  icon="i-lucide-edit-3" 
                  variant="ghost" 
                  color="neutral" 
                  size="xs" 
                  class="cursor-pointer p-1"
                  @click="openLeaderModal(l)" 
                />
                <UButton 
                  icon="i-lucide-trash-2" 
                  variant="ghost" 
                  color="error" 
                  size="xs" 
                  class="cursor-pointer p-1"
                  @click="handleDeleteLeader(l.id, l.name)" 
                />
              </div>
            </div>
            
            <div class="flex justify-between items-center mb-1.5">
              <div class="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{{ l.phone || 'No phone recorded' }}</div>
              <UBadge 
                :color="l.status === 'Active' ? 'primary' : 'neutral'" 
                variant="subtle" 
                size="xs"
                class="uppercase font-bold text-[8px] px-1 py-0.2"
              >
                {{ l.status }}
              </UBadge>
            </div>

            <div v-if="l.bank_name" class="bg-gray-50 dark:bg-gray-800/40 p-2 rounded-md border border-gray-100 dark:border-gray-800 space-y-0.5">
              <div class="flex items-center gap-1 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                <UIcon name="i-lucide-landmark" class="w-3 h-3 text-teal-500" />
                {{ l.bank_name }}
              </div>
              <div class="text-[8px] font-mono text-gray-400 pl-4">
                {{ l.account_number || 'No A/C' }} • {{ l.ifsc_code || 'No IFSC' }}
              </div>
            </div>
            <div v-else class="text-[8px] text-gray-400 dark:text-gray-600 italic">No bank details added</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Leader Modal -->
    <UModal v-model:open="isLeaderModalOpen" :title="editingLeader ? 'Edit Labor Leader' : 'Register Labor Leader'">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <div class="border-b border-gray-100 dark:border-gray-800 pb-3 flex justify-between items-center">
            <h3 class="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {{ editingLeader ? 'Edit Labor Leader' : 'Register Labor Leader' }}
            </h3>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="isLeaderModalOpen = false" />
          </div>

          <form @submit.prevent="submitLeader" class="space-y-4 text-xs">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Leader Name*</label>
              <UInput v-model="leaderForm.name" placeholder="Enter leader/contractor name" size="sm" class="w-full font-semibold" required />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Phone Number</label>
              <UInput v-model="leaderForm.phone" placeholder="Enter contact phone" size="sm" class="w-full font-semibold" />
            </div>
            <div v-if="editingLeader" class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Status</label>
              <USelect v-model="leaderForm.status" :items="['Active', 'Inactive']" size="sm" class="w-full font-semibold cursor-pointer" />
            </div>

            <div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
              <h4 class="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Bank Details (Optional)</h4>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Bank Name</label>
                <UInput v-model="leaderForm.bank_name" placeholder="e.g. HDFC Bank" size="sm" class="w-full font-semibold" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Account Number</label>
                  <UInput v-model="leaderForm.account_number" placeholder="000000000000" size="sm" class="w-full font-semibold" />
                </div>
                <div class="space-y-1">
                  <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">IFSC Code</label>
                  <UInput v-model="leaderForm.ifsc_code" placeholder="HDFC0001234" size="sm" class="w-full font-semibold uppercase" />
                </div>
              </div>
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <UButton label="Cancel" variant="ghost" color="neutral" size="sm" @click="isLeaderModalOpen = false" />
              <UButton type="submit" label="Save Leader" color="primary" variant="solid" size="sm" class="font-bold cursor-pointer" :loading="savingLeader" />
            </div>
          </form>
        </div>
      </template>
    </UModal>

    <!-- Period Modal -->
    <UModal v-model:open="isPeriodModalOpen" :title="editingPeriod ? 'Edit Work Period' : 'Start Work Period'">
      <template #content>
        <div class="bg-white dark:bg-gray-900 rounded-xl overflow-hidden shadow-xl border border-gray-100 dark:border-gray-800 p-6 space-y-4">
          <div class="border-b border-gray-100 dark:border-gray-800 pb-3 flex justify-between items-center">
            <h3 class="text-base font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              Start New Work Period
            </h3>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" @click="isPeriodModalOpen = false" />
          </div>

          <form @submit.prevent="submitPeriod" class="space-y-4 text-xs">
            <div class="space-y-1">
              <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Select Labor Leader*</label>
              <USelect 
                v-model="periodForm.leader_id" 
                :items="leaderSelectOptions" 
                size="sm"
                class="w-full font-semibold cursor-pointer" 
              />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Start Date*</label>
                <UInput v-model="periodForm.start_date" type="date" size="sm" class="w-full font-semibold cursor-pointer" required />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">End Date*</label>
                <UInput v-model="periodForm.end_date" type="date" size="sm" class="w-full font-semibold cursor-pointer" required />
              </div>
            </div>

            <div class="flex justify-end gap-2.5 pt-3 border-t border-gray-100 dark:border-gray-800">
              <UButton label="Cancel" variant="ghost" color="neutral" size="sm" @click="isPeriodModalOpen = false" />
              <UButton type="submit" label="Initialize Period" color="primary" variant="solid" size="sm" class="font-bold cursor-pointer" :loading="savingPeriod" />
            </div>
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { useLabor } from '~/composables/useLabor';

definePageMeta({
  layout: 'default'
});

const { 
  loading, 
  leaders, 
  periods, 
  fetchLeaders, 
  createLeader, 
  updateLeader, 
  deleteLeader, 
  fetchPeriods, 
  createPeriod, 
  deletePeriod 
} = useLabor();

const leaderFilter = ref('All Leaders');
const isLeaderModalOpen = ref(false);
const editingLeader = ref<any>(null);
const savingLeader = ref(false);

const leaderForm = reactive({
  name: '',
  phone: '',
  bank_name: '',
  account_number: '',
  ifsc_code: '',
  status: 'Active'
});

const isPeriodModalOpen = ref(false);
const editingPeriod = ref<any>(null);
const savingPeriod = ref(false);

const periodForm = reactive({
  leader_id: '',
  start_date: new Date().toISOString().split('T')[0],
  end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
});

onMounted(async () => {
  await Promise.all([
    fetchLeaders(),
    fetchPeriods()
  ]);
});

const openPeriodsCount = computed(() => {
  return periods.value.filter((p: any) => p.status === 'Open').length;
});

const leaderFilterOptions = computed(() => {
  return ['All Leaders', ...leaders.value.map((l: any) => l.name)];
});

const leaderSelectOptions = computed(() => {
  return leaders.value
    .filter((l: any) => l.status === 'Active')
    .map((l: any) => ({ label: l.name, value: l.id }));
});

const filteredPeriods = computed(() => {
  if (!leaderFilter.value || leaderFilter.value === 'All Leaders') {
    return periods.value;
  }
  return periods.value.filter((p: any) => p.leader_name === leaderFilter.value);
});

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

const openLeaderModal = (leader: any = null) => {
  editingLeader.value = leader;
  if (leader) {
    leaderForm.name = leader.name || '';
    leaderForm.phone = leader.phone || '';
    leaderForm.bank_name = leader.bank_name || '';
    leaderForm.account_number = leader.account_number || '';
    leaderForm.ifsc_code = leader.ifsc_code || '';
    leaderForm.status = leader.status || 'Active';
  } else {
    leaderForm.name = '';
    leaderForm.phone = '';
    leaderForm.bank_name = '';
    leaderForm.account_number = '';
    leaderForm.ifsc_code = '';
    leaderForm.status = 'Active';
  }
  isLeaderModalOpen.value = true;
};

const submitLeader = async () => {
  if (!leaderForm.name.trim()) return;
  savingLeader.value = true;
  try {
    if (editingLeader.value) {
      await updateLeader(editingLeader.value.id, leaderForm);
    } else {
      await createLeader(leaderForm);
    }
    isLeaderModalOpen.value = false;
    await fetchLeaders();
  } catch (err: any) {
    alert(err.message || 'Error saving leader');
  } finally {
    savingLeader.value = false;
  }
};

const handleDeleteLeader = async (id: string, name: string) => {
  if (confirm(`Are you sure you want to delete leader "${name}"?`)) {
    try {
      await deleteLeader(id);
      await fetchLeaders();
    } catch (err: any) {
      alert(err.message || 'Failed to delete leader');
    }
  }
};

const openPeriodModal = (period: any = null) => {
  editingPeriod.value = period;
  if (period) {
    periodForm.leader_id = period.leader_id;
    periodForm.start_date = period.start_date.split('T')[0];
    periodForm.end_date = period.end_date.split('T')[0];
  } else {
    periodForm.leader_id = leaderSelectOptions.value[0]?.value || '';
    periodForm.start_date = new Date().toISOString().split('T')[0];
    periodForm.end_date = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  }
  isPeriodModalOpen.value = true;
};

const submitPeriod = async () => {
  if (!periodForm.leader_id || !periodForm.start_date || !periodForm.end_date) return;
  savingPeriod.value = true;
  try {
    await createPeriod(periodForm);
    isPeriodModalOpen.value = false;
    await fetchPeriods();
  } catch (err: any) {
    alert(err.message || 'Error creating work period');
  } finally {
    savingPeriod.value = false;
  }
};

const handleDeletePeriod = async (id: string) => {
  if (confirm('Are you sure you want to delete this open work period?')) {
    try {
      await deletePeriod(id);
      await fetchPeriods();
    } catch (err: any) {
      alert(err.message || 'Failed to delete work period');
    }
  }
};
</script>
