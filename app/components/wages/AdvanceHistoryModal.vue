<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdvances } from '~/composables/useAdvances'

const props = defineProps<{
  employee: any
}>()

const emit = defineEmits(['close', 'updated'])

const { loading, fetchEmployeeAdvanceHistory, deleteAdvance } = useAdvances()
const toast = useToast()

const history = ref<any[]>([])

const loadHistory = async () => {
  try {
    const response = await fetchEmployeeAdvanceHistory(props.employee.master_roll_id || props.employee._id)
    if (response.success) {
      history.value = response.data
    }
  } catch (err: any) {
    toast.add({ title: 'Error loading history', description: err.message, color: 'error' })
  }
}

const removeTransaction = async (id: string) => {
  if (!confirm('Delete this transaction?')) return
  try {
    const response = await deleteAdvance(id)
    if (response.success) {
      toast.add({ title: 'Success', description: 'Transaction deleted', color: 'success' })
      loadHistory()
      emit('updated')
    }
  } catch (err: any) {
    toast.add({ title: 'Error deleting', description: err.message, color: 'error' })
  }
}

onMounted(() => {
  loadHistory()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 h-[80vh] flex flex-col">
      <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 shrink-0">
        <div>
          <h3 class="text-sm font-black uppercase tracking-widest text-gray-900 dark:text-white">Advance History</h3>
          <p class="text-[10px] font-bold text-gray-500 uppercase">{{ props.employee.employee_name }}</p>
        </div>
        <UButton variant="ghost" color="neutral" icon="i-heroicons-x-mark" @click="emit('close')" />
      </div>

      <div class="flex-1 overflow-auto p-4 scrollbar-thin">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="text-[9px] font-black uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <th class="p-2">Date</th>
              <th class="p-2">Type</th>
              <th class="p-2">Mode</th>
              <th class="p-2 text-right">Amount</th>
              <th class="p-2">Remarks</th>
              <th class="p-2 text-center">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 dark:divide-gray-800">
            <tr v-for="h in history" :key="h._id" class="text-xs">
              <td class="p-2 font-mono">{{ new Date(h.date).toLocaleDateString('en-IN') }}</td>
              <td class="p-2 font-bold" :class="h.type === 'ADVANCE' ? 'text-rose-500' : 'text-emerald-500'">{{ h.type }}</td>
              <td class="p-2">{{ h.payment_mode }}</td>
              <td class="p-2 text-right font-bold font-mono">₹{{ (h.amount || 0).toLocaleString() }}</td>
              <td class="p-2 text-gray-500 italic max-w-[200px] truncate">{{ h.remarks || '-' }}</td>
              <td class="p-2 text-center">
                <UButton size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="removeTransaction(h._id)" />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="history.length === 0 && !loading" class="p-8 text-center text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">
          No history found
        </div>
      </div>

      <div class="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-between shrink-0">
        <div class="flex gap-4">
          <div class="flex flex-col"><span class="text-[8px] uppercase text-gray-400">Total Advance</span><span class="text-xs font-black text-rose-500">₹{{ (props.employee.totalAdvance || 0).toLocaleString() }}</span></div>
          <div class="flex flex-col"><span class="text-[8px] uppercase text-gray-400">Total Recovery</span><span class="text-xs font-black text-emerald-500">₹{{ (props.employee.totalRecovery || 0).toLocaleString() }}</span></div>
        </div>
        <div class="flex flex-col items-end"><span class="text-[8px] uppercase text-gray-400">Current Balance</span><span class="text-sm font-black text-primary">₹{{ (props.employee.balance || 0).toLocaleString() }}</span></div>
      </div>
    </div>
  </div>
</template>
