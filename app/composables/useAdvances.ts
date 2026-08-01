import { ref } from 'vue'
import { useAuth } from './useAuth'

export const useAdvances = () => {
  const { apiFetch } = useAuth()
  const loading = ref(false)

  const buildUrl = (path: string) => `/api${path}`

  const fetchAllEmployeeBalances = async () => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/advances/balances'))
    } finally {
      loading.value = false
    }
  }

  const fetchEmployeeBalance = async (masterRollId: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/advances/balance/${masterRollId}`))
    } finally {
      loading.value = false
    }
  }

  const fetchEmployeeAdvanceHistory = async (masterRollId: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/advances/history/${masterRollId}`))
    } finally {
      loading.value = false
    }
  }

  const recordAdvance = async (data: {
    master_roll_id: string;
    amount: number;
    type: 'ADVANCE' | 'RECOVERY';
    date: string;
    payment_mode: string;
    bank_account_id?: string;
    cheque_no?: string;
    remarks?: string;
  }) => {
    loading.value = true
    try {
      const payload = {
        masterRollId: data.master_roll_id,
        amount: data.amount,
        type: data.type === 'RECOVERY' ? 'REPAYMENT' : 'ADVANCE',
        date: data.date,
        paymentMode: data.payment_mode === 'CASH' ? 'CASH' : 'BANK',
        bankAccountId: data.bank_account_id || undefined,
        chequeNo: data.cheque_no || undefined,
        remarks: data.remarks
      }
      return await apiFetch(buildUrl('/advances'), { method: 'POST', body: payload })
    } finally {
      loading.value = false
    }
  }

  const deleteAdvance = async (id: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/advances/${id}`), { method: 'DELETE' })
    } finally {
      loading.value = false
    }
  }

  const fetchBankAccounts = async () => {
    return await apiFetch(buildUrl('/banking'))
  }

  const fetchEligibleEmployees = async () => {
    return await apiFetch(buildUrl('/master-rolls'))
  }

  return {
    loading,
    fetchAllEmployeeBalances,
    fetchEmployeeBalance,
    fetchEmployeeAdvanceHistory,
    recordAdvance,
    deleteAdvance,
    fetchBankAccounts,
    fetchEligibleEmployees
  }
}
