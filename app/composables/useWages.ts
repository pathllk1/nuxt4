import { ref } from 'vue'
import { useAuth } from './useAuth'

export const useWages = () => {
  const { apiFetch } = useAuth()
  const loading = ref(false)
  const wages = ref<any[]>([])

  const buildUrl = (path: string) => `/api${path}`

  const fetchEligibleEmployees = async (month: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/wages/eligible-employees'), { method: 'POST', body: { month } })
    } finally {
      loading.value = false
    }
  }

  const fetchWagesByMonth = async (month: string) => {
    loading.value = true
    try {
      const response = await apiFetch(buildUrl(`/wages/month?month=${month}`))
      if (response.success) {
        wages.value = response.data
      }
      return response
    } finally {
      loading.value = false
    }
  }

  const createWagesBulk = async (month: string, wageData: any[]) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/wages/bulk'), { method: 'POST', body: { month, wages: wageData } })
    } finally {
      loading.value = false
    }
  }

  const updateWage = async (id: string, data: any) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/wages/${id}`), { method: 'PUT', body: data })
    } finally {
      loading.value = false
    }
  }

  const deleteWage = async (id: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/wages/${id}`), { method: 'DELETE' })
    } finally {
      loading.value = false
    }
  }

  const getJobStatus = async (jobId: string) => {
    return await apiFetch(buildUrl(`/wages/job/${jobId}`))
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportWages = async (month: string, data: any[]) => {
    const blob = await apiFetch<Blob>(buildUrl('/wages/export'), { method: 'POST', body: { month, data }, responseType: 'blob' })
    downloadBlob(blob, `Wages_${month}.xlsx`)
  }

  const downloadBankReport = async (month: string, chequeNo?: string, paymentMode?: string) => {
    let path = `/wages/bank-report?month=${month}`
    if (chequeNo && chequeNo !== 'all') path += `&chequeNo=${encodeURIComponent(chequeNo)}`
    if (paymentMode && paymentMode !== 'all') path += `&paymentMode=${encodeURIComponent(paymentMode)}`
    const blob = await apiFetch<Blob>(buildUrl(path), { responseType: 'blob' })
    downloadBlob(blob, `Bank_Report_${month}.xlsx`)
  }

  const downloadEPFESICReport = async (month: string) => {
    const blob = await apiFetch<Blob>(buildUrl(`/wages/epf-esic-report?month=${month}`), { responseType: 'blob' })
    downloadBlob(blob, `EPF_ESIC_Report_${month}.xlsx`)
  }

  const downloadWageSlip = async (id: string, name: string) => {
    const blob = await apiFetch<Blob>(buildUrl(`/wages/slip/${id}`), { responseType: 'blob' })
    downloadBlob(blob, `WageSlip_${name}.pdf`)
  }

  const downloadBulkWageSlips = async (month: string) => {
    const blob = await apiFetch<Blob>(buildUrl(`/wages/bulk-slips?month=${month}`), { responseType: 'blob' })
    downloadBlob(blob, `WageSlips_${month}.zip`)
  }

  const fetchBankAccounts = async () => {
    return await apiFetch(buildUrl('/banking'))
  }

  const fetchChequeNumbers = async (month?: string) => {
    let path = '/wages/cheques'
    if (month) path += `?month=${month}`
    return await apiFetch(buildUrl(path))
  }

  const fetchEmployeeWageHistory = async (masterRollId: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/wages/history/${masterRollId}`))
    } finally {
      loading.value = false
    }
  }

  const exportEmployeeWageHistory = async (masterRollId: string, name: string) => {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_')
    const blob = await apiFetch<Blob>(buildUrl(`/wages/history/${masterRollId}/export`), { responseType: 'blob' })
    downloadBlob(blob, `Wages_Statement_${safeName}.xlsx`)
  }

  return {
    loading,
    wages,
    fetchEligibleEmployees,
    fetchWagesByMonth,
    createWagesBulk,
    updateWage,
    deleteWage,
    getJobStatus,
    exportWages,
    downloadBankReport,
    downloadEPFESICReport,
    downloadWageSlip,
    downloadBulkWageSlips,
    fetchBankAccounts,
    fetchChequeNumbers,
    fetchEmployeeWageHistory,
    exportEmployeeWageHistory
  }
}
