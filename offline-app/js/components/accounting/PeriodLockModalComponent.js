// js/components/accounting/PeriodLockModalComponent.js
(function (global) {
  'use strict';

  const { ref, watch, onMounted, onUnmounted } = Vue;

  const PeriodLockModalComponent = {
    name: 'PeriodLockModalComponent',
    props: {
      modelValue: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'lock-updated'],
    setup(props, { emit }) {
      const loading = ref(false);
      const locks = ref([]);
      const newLockDate = ref('');
      const newReason = ref('Statutory Audit Freeze');
      const saving = ref(false);

      const fetchLocks = async () => {
        loading.value = true;
        try {
          if (global.ledgerService) {
            locks.value = await global.ledgerService.getPeriodLocks();
          }
        } catch (err) {
          console.error('Failed to load period locks:', err);
        } finally {
          loading.value = false;
        }
      };

      watch(() => props.modelValue, (newVal) => {
        if (newVal) {
          fetchLocks();
          newLockDate.value = new Date().toISOString().split('T')[0];
        }
      });

      const handleKeydown = (e) => {
        if (e.key === 'Escape' && props.modelValue) {
          emit('update:modelValue', false);
        }
      };

      onMounted(() => window.addEventListener('keydown', handleKeydown));
      onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

      const handleSetLock = async () => {
        if (!newLockDate.value) return;
        saving.value = true;
        try {
          await global.ledgerService.setPeriodLock(newLockDate.value, '', newReason.value);
          await fetchLocks();
          emit('lock-updated');
        } catch (err) {
          alert('Failed to set lock: ' + err.message);
        } finally {
          saving.value = false;
        }
      };

      const handleRemoveLock = async (id) => {
        if (!confirm('Are you sure you want to remove this fiscal period lock? Book updates prior to this date will be allowed.')) return;
        try {
          await global.ledgerService.removePeriodLock(id);
          await fetchLocks();
          emit('lock-updated');
        } catch (err) {
          alert('Failed to remove lock: ' + err.message);
        }
      };

      return {
        loading,
        locks,
        newLockDate,
        newReason,
        saving,
        fetchLocks,
        handleSetLock,
        handleRemoveLock
      };
    },
    template: `
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs">
        <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-zinc-800 animate-scale-in">
          <!-- Header -->
          <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center text-lg shadow-md font-bold">
                <span>📅</span>
              </div>
              <div>
                <h3 class="text-base font-black uppercase tracking-wider">Fiscal Period Lock Manager</h3>
                <p class="text-xs text-slate-300">Prevent historical book tampering & freeze finalized GST audit periods</p>
              </div>
            </div>
            <button 
              @click="$emit('update:modelValue', false)" 
              class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition font-bold"
            >
              ✕
            </button>
          </div>

          <!-- Body -->
          <div class="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
            <!-- Add Lock Form -->
            <div class="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-850/50 space-y-3">
              <h4 class="font-black uppercase tracking-wider text-slate-800 dark:text-white">Freeze Books Up To Date</h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Lock Cutoff Date</label>
                  <input 
                    type="date" 
                    v-model="newLockDate" 
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                  />
                </div>
                <div>
                  <label class="block text-[10px] font-bold text-slate-500 uppercase mb-1">Freeze Reason / Notes</label>
                  <input 
                    type="text" 
                    v-model="newReason" 
                    placeholder="e.g. Q3 GST Returns Filed"
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-bold"
                  />
                </div>
              </div>
              <div class="flex justify-end">
                <button 
                  @click="handleSetLock" 
                  :disabled="saving || !newLockDate"
                  class="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold uppercase tracking-wider cursor-pointer shadow-sm transition disabled:opacity-50"
                >
                  {{ saving ? 'Locking...' : 'Apply Period Lock 🔒' }}
                </button>
              </div>
            </div>

            <!-- Active Locks Table -->
            <div class="space-y-2">
              <h4 class="font-black uppercase tracking-wider text-slate-800 dark:text-white">Active Period Locks</h4>
              <div v-if="loading" class="py-6 text-center text-slate-400">Loading period locks...</div>
              <div v-else-if="locks.length === 0" class="py-6 text-center text-slate-400 border border-dashed rounded-xl">
                No active period locks. Accounting entries are open for all dates.
              </div>
              <div v-else class="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                <table class="w-full text-left">
                  <thead class="bg-slate-50 dark:bg-zinc-800 text-[10px] font-black uppercase text-slate-500">
                    <tr>
                      <th class="p-2.5">Locked Up To</th>
                      <th class="p-2.5">Fiscal Year</th>
                      <th class="p-2.5">Reason</th>
                      <th class="p-2.5">Locked By</th>
                      <th class="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-zinc-800">
                    <tr v-for="l in locks" :key="l.id" class="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                      <td class="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{{ l.lockDate }}</td>
                      <td class="p-2.5 font-bold">{{ l.financialYear || 'N/A' }}</td>
                      <td class="p-2.5 text-slate-600 dark:text-zinc-400">{{ l.reason || 'Period Closed' }}</td>
                      <td class="p-2.5 text-slate-500">{{ l.lockedBy || 'Admin' }}</td>
                      <td class="p-2.5 text-center">
                        <button 
                          @click="handleRemoveLock(l.id)" 
                          class="px-2 py-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[10px] cursor-pointer"
                        >
                          Unlock 🔓
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-3 border-t border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900 flex justify-end shrink-0">
            <button 
              @click="$emit('update:modelValue', false)" 
              class="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    `
  };

  global.PeriodLockModalComponent = PeriodLockModalComponent;
})(typeof window !== 'undefined' ? window : this);
