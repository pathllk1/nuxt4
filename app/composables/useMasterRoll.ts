import { ref } from 'vue'
import { useAuth } from './useAuth'

export const useMasterRoll = () => {
  const { apiFetch, selectedFirmId } = useAuth()
  const loading = ref(false)
  const employees = ref<any[]>([])
  const stats = ref<any>(null)
  const total = ref(0)

  const buildUrl = (path: string) => `/api${path}`

  const fetchEmployees = async (params: any = {}) => {
    loading.value = true
    try {
      const query = new URLSearchParams(params).toString()
      const response = await apiFetch(buildUrl(`/master-rolls?${query}`))
      if (response.success) {
        employees.value = response.data
        total.value = response.pagination?.total || 0
      }
      return response
    } finally {
      loading.value = false
    }
  }

  const fetchStats = async () => {
    try {
      const response = await apiFetch(buildUrl('/master-rolls/stats'))
      if (response.success) {
        stats.value = response.data
      }
      return response
    } catch (err) {
      console.error('Stats fetch error', err)
    }
  }

  const fetchUniqueFields = async () => {
    try {
      return await apiFetch(buildUrl('/master-rolls/unique-fields'))
    } catch (err) {
      console.error('Unique fields fetch error', err)
    }
  }

  const createEmployee = async (data: any) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/master-rolls'), { method: 'POST', body: data })
    } finally {
      loading.value = false
    }
  }

  const updateEmployee = async (id: string, data: any) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/master-rolls/${id}`), { method: 'PUT', body: data })
    } finally {
      loading.value = false
    }
  }

  const deleteEmployee = async (id: string) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl(`/master-rolls/${id}`), { method: 'DELETE' })
    } finally {
      loading.value = false
    }
  }

  const bulkImport = async (empList: any[]) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/master-rolls/import'), { method: 'POST', body: { employees: empList } })
    } finally {
      loading.value = false
    }
  }

  const bulkDeleteEmployees = async (ids: string[]) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/master-rolls/bulk'), { method: 'DELETE', body: { ids } })
    } finally {
      loading.value = false
    }
  }

  const bulkUpdateEmployees = async (updates: { id: string; data: any }[]) => {
    loading.value = true
    try {
      return await apiFetch(buildUrl('/master-rolls/bulk'), { method: 'PUT', body: { updates } })
    } finally {
      loading.value = false
    }
  }

  const getActivityLog = async (id: string) => {
    return await apiFetch(buildUrl(`/master-rolls/${id}/activity`))
  }

  const downloadAppointmentLetter = async (id: string, name: string) => {
    const blob = await apiFetch<Blob>(buildUrl(`/master-rolls/${id}/appointment-letter`), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Appointment_Letter_${name}.docx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportQualityReport = async () => {
    const blob = await apiFetch<Blob>(buildUrl('/master-rolls/export/quality-report'), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Data_Quality_Report.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadTemplate = async () => {
    const blob = await apiFetch<Blob>(buildUrl('/master-rolls/export/template'), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'MasterRoll_Template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportExcel = async (selectedIds?: string[]) => {
    let path = '/master-rolls/export?format=xlsx'
    if (selectedIds && selectedIds.length > 0) {
      path += `&selectedIds=${selectedIds.join(',')}`
    }
    const blob = await apiFetch<Blob>(buildUrl(path), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'MasterRoll_Export.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportICards = async (params: any = {}, format: 'pdf' | 'xlsx' = 'pdf') => {
    const searchParams = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value))
      }
    })
    searchParams.append('format', format)
    const query = searchParams.toString()
    const extension = format === 'xlsx' ? 'xlsx' : 'pdf'
    const blob = await apiFetch<Blob>(buildUrl(`/master-rolls/export/icards?${query}`), { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Employee_ICards.${extension}`
    a.click()
    URL.revokeObjectURL(url)
  }

  return {
    loading,
    employees,
    stats,
    total,
    fetchEmployees,
    fetchStats,
    fetchUniqueFields,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    bulkImport,
    bulkDeleteEmployees,
    bulkUpdateEmployees,
    getActivityLog,
    downloadAppointmentLetter,
    exportQualityReport,
    downloadTemplate,
    exportExcel,
    exportICards
  }
}
