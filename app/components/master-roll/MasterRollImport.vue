<script setup lang="ts">
import { ref } from 'vue'
import * as XLSX from 'xlsx'
import { useMasterRoll } from '@/composables/useMasterRoll'
import { useToast } from '#imports'

const emit = defineEmits(['success', 'close'])
const { bulkImport } = useMasterRoll()
const toast = useToast()

const file = ref<File | null>(null)
const data = ref<any[]>([])
const loading = ref(false)

const onFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const selectedFile = target.files?.[0]
  if (selectedFile) {
    file.value = selectedFile
    parseFile(selectedFile)
  }
}

const parseFile = (fileObj: File) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    const bstr = e.target?.result
    const wb = XLSX.read(bstr, { type: 'binary', cellDates: true })
    const wsname = wb.SheetNames[0]
    const ws = wb.Sheets[wsname!]
    const json = XLSX.utils.sheet_to_json(ws!)
    
    const formatDate = (val: any) => {
      if (!val) return undefined
      if (val instanceof Date) {
        return val.toISOString().split('T')[0]
      }
      if (typeof val === 'number' && val > 10000) {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000))
        return date.toISOString().split('T')[0]
      }
      return String(val)
    }

    data.value = json.map((row: any) => ({
      employee_name: row['Employee Name'] || row.employee_name,
      father_husband_name: row['Father/Husband Name'] || row.father_husband_name,
      date_of_birth: formatDate(row['Date of Birth'] || row.date_of_birth),
      aadhar: String(row['Aadhar'] || row.aadhar || ''),
      phone_no: String(row['Phone No'] || row.phone_no || ''),
      address: row['Address'] || row.address || 'N/A',
      bank: row['Bank'] || row.bank,
      account_no: String(row['Account No'] || row.account_no || ''),
      ifsc: row['IFSC'] || row.ifsc,
      date_of_joining: formatDate(row['Date of Joining'] || row.date_of_joining),
      status: row['Status'] || row.status || 'Active',
      pan: row['PAN'] || row.pan,
      branch: row['Branch'] || row.branch,
      uan: String(row['UAN'] || row.uan || ''),
      esic_no: String(row['ESIC No'] || row.esic_no || ''),
      s_kalyan_no: row['S. Kalyan No'] || row.s_kalyan_no,
      category: row['Category'] || row.category,
      p_day_wage: Number(row['Daily Wage'] || row.p_day_wage || 0),
      project: row['Project'] || row.project,
      site: row['Site'] || row.site,
      date_of_exit: formatDate(row['Date of Exit'] || row.date_of_exit),
      doe_rem: row['Remarks'] || row.doe_rem,
      resignation_notice_period: (row['Notice Period (Days)'] !== undefined && row['Notice Period (Days)'] !== '') ? Number(row['Notice Period (Days)']) : (row.resignation_notice_period ? Number(row.resignation_notice_period) : undefined)
    }))
  }
  reader.readAsBinaryString(fileObj)
}

const onImport = async () => {
  if (data.value.length === 0) return

  loading.value = true
  try {
    const res = await bulkImport(data.value)
    if (res.success) {
      toast.add({ 
        title: 'Import Complete', 
        description: `Imported ${res.data.imported} employees. ${res.data.failed} failed.`, 
        color: res.data.failed > 0 ? 'warning' : 'success' 
      })
      emit('success')
      emit('close')
    }
  } catch (err: any) {
    toast.add({ title: 'Import Failed', description: err.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 text-center">
      <input type="file" accept=".xlsx, .xls, .csv" class="hidden" id="file-upload" @change="onFileChange" />
      <label for="file-upload" class="cursor-pointer flex flex-col items-center">
        <UIcon name="i-heroicons-cloud-arrow-up" class="w-12 h-12 text-gray-400 mb-4" />
        <span class="text-sm font-medium text-gray-900 dark:text-white">
          {{ file ? file.name : 'Click to upload Excel or CSV' }}
        </span>
        <span class="text-xs text-gray-500 mt-1">Make sure to use the provided template</span>
      </label>
    </div>

    <div v-if="data.length > 0" class="max-h-64 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
      <table class="w-full text-left text-xs">
        <thead class="bg-gray-50 dark:bg-gray-900 sticky top-0">
          <tr>
            <th class="p-2">Name</th>
            <th class="p-2">Aadhar</th>
            <th class="p-2">Bank</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in data.slice(0, 10)" :key="i" class="border-t border-gray-100 dark:border-gray-800">
            <td class="p-2">{{ row.employee_name }}</td>
            <td class="p-2">{{ row.aadhar }}</td>
            <td class="p-2">{{ row.bank }}</td>
          </tr>
          <tr v-if="data.length > 10">
            <td colspan="3" class="p-2 text-center text-gray-500 font-medium italic">
              ... and {{ data.length - 10 }} more rows
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex justify-end gap-3 pt-4">
      <UButton variant="ghost" color="neutral" label="Cancel" @click="emit('close')" />
      <UButton :loading="loading" :disabled="data.length === 0" label="Start Import" @click="onImport" />
    </div>
  </div>
</template>
