<script setup lang="ts">
import { reactive, onMounted, ref, computed, watch } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '#imports'

const props = withDefaults(defineProps<{
  employee?: any
  uniqueOptions?: {
    projects?: string[]
    sites?: string[]
    categories?: string[]
    banks?: string[]
  }
}>(), {})

const emit = defineEmits(['success', 'close'])
const { createEmployee, updateEmployee, fetchUniqueFields } = useMasterRoll()
const { apiFetch } = useAuth()
const toast = useToast()

const getTodayDateString = (): string => new Date().toISOString().slice(0, 10)

interface EmployeeFormData {
  employee_name: string
  father_husband_name: string
  date_of_birth: string
  aadhar: string
  pan: string
  phone_no: string
  address: string
  bank: string
  account_no: string
  ifsc: string
  branch: string
  uan: string
  esic_no: string
  s_kalyan_no: string
  category: string
  p_day_wage: number
  project: string
  site: string
  date_of_joining: string
  date_of_exit: string
  doe_rem: string
  resignation_notice_period: number
  card_valid_until: string
  status: string
}

const form = reactive<EmployeeFormData>({
  employee_name: '',
  father_husband_name: '',
  date_of_birth: '',
  aadhar: '',
  pan: '',
  phone_no: '',
  address: '',
  bank: '',
  account_no: '',
  ifsc: '',
  branch: '',
  uan: '',
  esic_no: '',
  s_kalyan_no: '',
  category: 'UNSKILLED',
  p_day_wage: 0,
  project: '',
  site: '',
  date_of_joining: getTodayDateString(),
  date_of_exit: '',
  doe_rem: '',
  resignation_notice_period: 30,
  card_valid_until: '',
  status: 'Active'
})

const errors = reactive<Record<string, string>>({})
const loading = ref(false)
const loadingUnique = ref(false)

const uniqueProjects = ref<string[]>([])
const uniqueSites = ref<string[]>([])
const uniqueCategories = ref<string[]>([])
const uniqueBanks = ref<string[]>([])

const DEFAULT_CATEGORIES = [
  'UNSKILLED',
  'SEMI-SKILLED',
  'SKILLED',
  'HIGHLY-SKILLED',
  'SUPERVISOR',
  'ENGINEER',
  'TECHNICIAN',
  'HELPER',
  'FOREMAN',
  'FITTER',
  'WELDER',
  'ELECTRICIAN',
  'MASON',
  'CARPENTER',
  'DRIVER',
  'OPERATOR',
  'SECURITY',
  'STAFF'
]

const quickCategories = ['UNSKILLED', 'SEMI-SKILLED', 'SKILLED', 'HIGHLY-SKILLED']

const allCategories = computed(() => {
  const set = new Set([...DEFAULT_CATEGORIES, ...uniqueCategories.value])
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
})

const loadUniqueData = async () => {
  if (props.uniqueOptions && (props.uniqueOptions.projects?.length || props.uniqueOptions.sites?.length)) {
    uniqueProjects.value = props.uniqueOptions.projects || []
    uniqueSites.value = props.uniqueOptions.sites || []
    uniqueCategories.value = props.uniqueOptions.categories || []
    uniqueBanks.value = props.uniqueOptions.banks || []
    return
  }

  loadingUnique.value = true
  try {
    const res = await fetchUniqueFields()
    if (res?.success && res.data) {
      uniqueProjects.value = res.data.projects || []
      uniqueSites.value = res.data.sites || []
      uniqueCategories.value = res.data.categories || []
      uniqueBanks.value = res.data.banks || []
    }
  } catch (err) {
    console.error('Failed to load autocomplete options', err)
  } finally {
    loadingUnique.value = false
  }
}

onMounted(() => {
  loadUniqueData()
})

watch(() => props.uniqueOptions, (newVal) => {
  if (newVal) {
    if (newVal.projects) uniqueProjects.value = newVal.projects
    if (newVal.sites) uniqueSites.value = newVal.sites
    if (newVal.categories) uniqueCategories.value = newVal.categories
    if (newVal.banks) uniqueBanks.value = newVal.banks
  }
}, { deep: true })

const resetForm = () => {
  Object.keys(errors).forEach(k => delete errors[k])
  ifscLookupState.value = { status: 'idle' }
  if (props.employee) {
    Object.assign(form, {
      resignation_notice_period: 30,
      card_valid_until: '',
      ...props.employee
    })
  } else {
    Object.assign(form, {
      employee_name: '',
      father_husband_name: '',
      date_of_birth: '',
      aadhar: '',
      pan: '',
      phone_no: '',
      address: '',
      bank: '',
      account_no: '',
      ifsc: '',
      branch: '',
      uan: '',
      esic_no: '',
      s_kalyan_no: '',
      category: 'UNSKILLED',
      p_day_wage: 0,
      project: '',
      site: '',
      date_of_joining: getTodayDateString(),
      date_of_exit: '',
      doe_rem: '',
      resignation_notice_period: 30,
      card_valid_until: '',
      status: 'Active'
    })
  }
}

watch(() => props.employee, () => {
  resetForm()
}, { immediate: true })

// Input Cleaners & Formatters
const onAadharInput = (e: any) => {
  const val = typeof e === 'string' ? e : e?.target?.value || ''
  form.aadhar = val.replace(/\D/g, '').slice(0, 12)
  if (errors.aadhar && form.aadhar.length === 12) {
    delete errors.aadhar
  }
}

const onPhoneInput = (e: any) => {
  const val = typeof e === 'string' ? e : e?.target?.value || ''
  form.phone_no = val.replace(/\D/g, '').slice(0, 10)
  if (errors.phone_no && form.phone_no.length === 10) {
    delete errors.phone_no
  }
}

const onPanInput = (e: any) => {
  const val = typeof e === 'string' ? e : e?.target?.value || ''
  form.pan = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
  if (errors.pan && (!form.pan || /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan))) {
    delete errors.pan
  }
}

const onIfscInput = (e: any) => {
  const val = typeof e === 'string' ? e : e?.target?.value || ''
  form.ifsc = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)
  if (errors.ifsc && form.ifsc.length === 11) {
    delete errors.ifsc
  }
}

const onUanInput = (e: any) => {
  const val = typeof e === 'string' ? e : e?.target?.value || ''
  form.uan = val.replace(/\D/g, '').slice(0, 12)
}

// IFSC Auto-Lookup
const ifscLookupState = ref<{
  status: 'idle' | 'loading' | 'success' | 'error'
  message?: string
}>({ status: 'idle' })

watch(() => form.ifsc, async (newVal) => {
  if (!newVal) {
    ifscLookupState.value = { status: 'idle' }
    return
  }
  if (newVal.length === 11) {
    ifscLookupState.value = { status: 'loading' }
    try {
      const res = await apiFetch(`/api/master-rolls/lookup/ifsc/${newVal}`)
      if (res?.success && res.data) {
        form.bank = res.data.BANK || form.bank
        form.branch = res.data.BRANCH || form.branch
        ifscLookupState.value = {
          status: 'success',
          message: `${res.data.BANK}${res.data.BRANCH ? ' • ' + res.data.BRANCH : ''}`
        }
        if (errors.bank) delete errors.bank
      } else {
        ifscLookupState.value = { status: 'error', message: 'Bank details not found for this IFSC' }
      }
    } catch {
      ifscLookupState.value = { status: 'error', message: 'Could not lookup IFSC' }
    }
  } else if (newVal.length < 11) {
    ifscLookupState.value = { status: 'idle' }
  }
})

// Exit date & Status sync
watch(() => form.date_of_exit, (exitDate) => {
  if (exitDate && form.status === 'Active') {
    form.status = 'Left'
  }
})

watch(() => form.status, (newStatus) => {
  if (newStatus === 'Left' && !form.date_of_exit) {
    form.date_of_exit = getTodayDateString()
  } else if (newStatus === 'Active') {
    form.date_of_exit = ''
    form.doe_rem = ''
  }
})

const validate = (): boolean => {
  Object.keys(errors).forEach(k => delete errors[k])

  if (!form.employee_name?.trim()) {
    errors.employee_name = 'Employee name is required'
  }
  if (!form.father_husband_name?.trim()) {
    errors.father_husband_name = 'Father / Husband name is required'
  }
  if (!form.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required'
  }
  if (!form.aadhar?.trim()) {
    errors.aadhar = 'Aadhar number is required'
  } else if (form.aadhar.trim().length !== 12) {
    errors.aadhar = 'Aadhar must be exactly 12 digits'
  }
  if (!form.phone_no?.trim()) {
    errors.phone_no = 'Phone number is required'
  } else if (form.phone_no.trim().length !== 10) {
    errors.phone_no = 'Phone number must be exactly 10 digits'
  }
  if (!form.address?.trim()) {
    errors.address = 'Permanent address is required'
  }
  if (!form.date_of_joining) {
    errors.date_of_joining = 'Date of joining is required'
  }
  if (form.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(form.pan)) {
    errors.pan = 'Invalid PAN format (e.g. ABCDE1234F)'
  }
  if (form.ifsc && form.ifsc.length !== 11) {
    errors.ifsc = 'IFSC code must be 11 characters'
  }
  if (!form.bank?.trim() && (form.account_no || form.ifsc)) {
    errors.bank = 'Bank name is required when bank details are provided'
  }

  return Object.keys(errors).length === 0
}

const onSubmit = async () => {
  if (!validate()) {
    const errorCount = Object.keys(errors).length
    toast.add({
      title: 'Missing Required Fields',
      description: `Please review and fix the ${errorCount} highlighted field${errorCount > 1 ? 's' : ''}.`,
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    let res
    if (props.employee?._id) {
      res = await updateEmployee(props.employee._id, form)
    } else {
      res = await createEmployee(form)
    }

    if (res.success) {
      toast.add({ title: 'Success', description: res.message || 'Record saved successfully', color: 'success' })
      emit('success')
      emit('close')
    } else {
      toast.add({ title: 'Save Failed', description: res.message || 'Could not save employee', color: 'error' })
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.data?.message || err.message || 'An error occurred', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-6 p-2 md:p-4 text-slate-800 dark:text-slate-200">
    <!-- Section 1: Personal & Identity -->
    <div class="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 md:p-6 shadow-xs">
      <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm">
            1
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Personal & Identity Details</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Basic identification, Aadhar, PAN, and contact information</p>
          </div>
        </div>
        <span class="text-[11px] font-semibold text-rose-500 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200/60 dark:border-rose-900/40">
          * Required fields
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <UFormField label="Employee Name" required :error="errors.employee_name">
          <UInput 
            v-model="form.employee_name" 
            placeholder="e.g. Ramesh Kumar" 
            required 
            class="w-full" 
            icon="i-heroicons-user"
          />
        </UFormField>
        
        <UFormField label="Father / Husband Name" required :error="errors.father_husband_name">
          <UInput 
            v-model="form.father_husband_name" 
            placeholder="e.g. Suresh Kumar" 
            required 
            class="w-full" 
            icon="i-heroicons-user-group"
          />
        </UFormField>

        <UFormField label="Date of Birth" required :error="errors.date_of_birth">
          <UInput 
            v-model="form.date_of_birth" 
            type="date" 
            required 
            class="w-full" 
            icon="i-heroicons-calendar"
          />
        </UFormField>

        <UFormField 
          label="Aadhar Number" 
          required 
          :error="errors.aadhar" 
          :help="form.aadhar ? `${form.aadhar.length}/12 digits` : '12-digit UIDAI number'"
        >
          <UInput 
            v-model="form.aadhar" 
            placeholder="12-digit number" 
            required 
            class="w-full font-mono tracking-wider" 
            maxlength="12"
            icon="i-heroicons-identification"
            @input="onAadharInput"
          />
        </UFormField>

        <UFormField 
          label="PAN Number" 
          :error="errors.pan" 
          :help="form.pan ? `${form.pan.length}/10 chars` : '10-character alphanumeric (e.g. ABCDE1234F)'"
        >
          <UInput 
            v-model="form.pan" 
            placeholder="ABCDE1234F" 
            class="w-full font-mono uppercase tracking-wider" 
            maxlength="10"
            icon="i-heroicons-credit-card"
            @input="onPanInput"
          />
        </UFormField>

        <UFormField 
          label="Phone Number" 
          required 
          :error="errors.phone_no" 
          :help="form.phone_no ? `${form.phone_no.length}/10 digits` : '10-digit mobile number'"
        >
          <UInput 
            v-model="form.phone_no" 
            placeholder="10-digit number" 
            required 
            class="w-full font-mono tracking-wide" 
            maxlength="10"
            icon="i-heroicons-phone"
            @input="onPhoneInput"
          />
        </UFormField>
      </div>

      <div class="mt-4">
        <UFormField label="Permanent Address" required :error="errors.address">
          <UTextarea 
            v-model="form.address" 
            placeholder="Village/Street, Post Office, Police Station, District, State, PIN code..." 
            required 
            class="w-full" 
            :rows="2" 
          />
        </UFormField>
      </div>
    </div>

    <!-- Section 2: Work, Role & Deployment -->
    <div class="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 md:p-6 shadow-xs">
      <div class="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
          2
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Employment & Site Deployment</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Project, site location, skill category, wages, and tenure</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <!-- Category with Quick Chips & Datalist -->
        <UFormField label="Skill Category / Designation" :error="errors.category">
          <div class="space-y-1.5">
            <UInput 
              v-model="form.category" 
              list="employee-category-list" 
              placeholder="Select or enter category..." 
              class="w-full" 
              icon="i-heroicons-wrench-screwdriver" 
            />
            <datalist id="employee-category-list">
              <option v-for="cat in allCategories" :key="cat" :value="cat" />
            </datalist>
            <!-- Quick Chips for Standard 4 Categories -->
            <div class="flex flex-wrap gap-1">
              <button 
                v-for="qc in quickCategories" 
                :key="qc" 
                type="button" 
                @click="form.category = qc"
                class="text-[10px] font-semibold px-2 py-0.5 rounded transition-colors border"
                :class="form.category === qc 
                  ? 'bg-primary text-white border-primary shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'"
              >
                {{ qc }}
              </button>
            </div>
          </div>
        </UFormField>

        <!-- Daily Wage -->
        <UFormField label="Daily Wage Rate (₹ / day)" :error="errors.p_day_wage">
          <UInput 
            v-model.number="form.p_day_wage" 
            type="number" 
            step="0.01" 
            min="0"
            placeholder="0.00" 
            class="w-full" 
            icon="i-heroicons-banknotes" 
          />
        </UFormField>

        <!-- Status -->
        <UFormField label="Employment Status">
          <div class="flex items-center gap-2">
            <USelect 
              v-model="form.status" 
              :items="['Active', 'Inactive', 'Left']" 
              class="w-full" 
            />
            <span 
              class="text-xs px-2.5 py-1 rounded-md font-bold uppercase tracking-wider shrink-0"
              :class="{
                'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300': form.status === 'Active',
                'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300': form.status === 'Inactive',
                'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300': form.status === 'Left'
              }"
            >
              {{ form.status }}
            </span>
          </div>
        </UFormField>

        <!-- Project with Database Autocomplete -->
        <UFormField 
          label="Project" 
          :error="errors.project" 
          :help="uniqueProjects.length > 0 ? `${uniqueProjects.length} existing project(s) available` : 'Select or type a new project'"
        >
          <div class="space-y-1.5">
            <UInput 
              v-model="form.project" 
              list="employee-project-list" 
              placeholder="Select or enter project..." 
              class="w-full" 
              icon="i-heroicons-building-office-2" 
            />
            <datalist id="employee-project-list">
              <option v-for="proj in uniqueProjects" :key="proj" :value="proj" />
            </datalist>
            <!-- Quick Chips for Top 5 Projects -->
            <div v-if="uniqueProjects.length > 0" class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              <button 
                v-for="proj in uniqueProjects.slice(0, 5)" 
                :key="proj" 
                type="button" 
                @click="form.project = proj"
                class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors border"
                :class="form.project === proj 
                  ? 'bg-primary text-white border-primary shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'"
              >
                {{ proj }}
              </button>
              <span v-if="uniqueProjects.length > 5" class="text-[10px] text-slate-400 self-center">
                +{{ uniqueProjects.length - 5 }} more in list
              </span>
            </div>
          </div>
        </UFormField>

        <!-- Site Location with Database Autocomplete -->
        <UFormField 
          label="Site / Location" 
          :error="errors.site" 
          :help="uniqueSites.length > 0 ? `${uniqueSites.length} existing site(s) available` : 'Select or type a new site'"
        >
          <div class="space-y-1.5">
            <UInput 
              v-model="form.site" 
              list="employee-site-list" 
              placeholder="Select or enter site location..." 
              class="w-full" 
              icon="i-heroicons-map-pin" 
            />
            <datalist id="employee-site-list">
              <option v-for="st in uniqueSites" :key="st" :value="st" />
            </datalist>
            <!-- Quick Chips for Top 5 Sites -->
            <div v-if="uniqueSites.length > 0" class="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
              <button 
                v-for="st in uniqueSites.slice(0, 5)" 
                :key="st" 
                type="button" 
                @click="form.site = st"
                class="text-[10px] font-medium px-2 py-0.5 rounded transition-colors border"
                :class="form.site === st 
                  ? 'bg-primary text-white border-primary shadow-xs' 
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'"
              >
                {{ st }}
              </button>
              <span v-if="uniqueSites.length > 5" class="text-[10px] text-slate-400 self-center">
                +{{ uniqueSites.length - 5 }} more in list
              </span>
            </div>
          </div>
        </UFormField>

        <!-- Date of Joining -->
        <UFormField label="Date of Joining" required :error="errors.date_of_joining">
          <UInput 
            v-model="form.date_of_joining" 
            type="date" 
            required 
            class="w-full" 
            icon="i-heroicons-calendar-days"
          />
        </UFormField>

        <!-- Card Valid Until -->
        <UFormField label="I-Card Valid Until" :error="errors.card_valid_until">
          <UInput 
            v-model="form.card_valid_until" 
            type="date" 
            class="w-full" 
            icon="i-heroicons-shield-check" 
          />
        </UFormField>

        <!-- Notice Period -->
        <UFormField label="Resignation Notice Period (Days)" :error="errors.resignation_notice_period">
          <UInput 
            v-model.number="form.resignation_notice_period" 
            type="number" 
            min="0"
            placeholder="30" 
            class="w-full" 
            icon="i-heroicons-clock" 
          />
        </UFormField>
      </div>
    </div>

    <!-- Section 3: Banking & Statutory Compliance -->
    <div class="bg-white dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 md:p-6 shadow-xs">
      <div class="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3 mb-5">
        <div class="w-8 h-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
          3
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Bank Details & Statutory Accounts</h3>
          <p class="text-xs text-slate-500 dark:text-slate-400">Direct salary disbursement, PF UAN, ESIC, and Welfare number</p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <!-- IFSC Code with Live Verification -->
        <UFormField label="IFSC Code" :error="errors.ifsc" help="11 characters (auto-looks up bank & branch)">
          <div class="space-y-1.5">
            <UInput 
              v-model="form.ifsc" 
              placeholder="e.g. SBIN0001234" 
              class="w-full uppercase font-mono tracking-wider" 
              :loading="ifscLookupState.status === 'loading'" 
              icon="i-heroicons-magnifying-glass" 
              maxlength="11"
              @input="onIfscInput"
            />
            <!-- Verification Feedback Badge -->
            <div 
              v-if="ifscLookupState.status === 'success'" 
              class="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-200 dark:border-emerald-800"
            >
              <UIcon name="i-heroicons-check-circle" class="w-4 h-4 shrink-0 text-emerald-600" />
              <span class="font-medium truncate">{{ ifscLookupState.message }}</span>
            </div>
            <div 
              v-else-if="ifscLookupState.status === 'error'" 
              class="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded border border-rose-200 dark:border-rose-800"
            >
              <UIcon name="i-heroicons-exclamation-circle" class="w-4 h-4 shrink-0 text-rose-600" />
              <span class="font-medium">{{ ifscLookupState.message }}</span>
            </div>
          </div>
        </UFormField>

        <!-- Bank Name with Autocomplete -->
        <UFormField label="Bank Name" :error="errors.bank" help="Select or auto-filled via IFSC">
          <UInput 
            v-model="form.bank" 
            list="employee-bank-list" 
            placeholder="e.g. State Bank of India" 
            class="w-full" 
            icon="i-heroicons-building-library" 
          />
          <datalist id="employee-bank-list">
            <option v-for="bk in uniqueBanks" :key="bk" :value="bk" />
          </datalist>
        </UFormField>

        <!-- Account Number -->
        <UFormField label="Account Number" :error="errors.account_no">
          <UInput 
            v-model="form.account_no" 
            placeholder="Bank account number" 
            class="w-full font-mono tracking-wide" 
            icon="i-heroicons-credit-card" 
          />
        </UFormField>

        <!-- Branch Name -->
        <UFormField label="Branch Name" :error="errors.branch">
          <UInput 
            v-model="form.branch" 
            placeholder="Branch name or city" 
            class="w-full" 
            icon="i-heroicons-map" 
          />
        </UFormField>

        <!-- UAN Number -->
        <UFormField label="UAN (Provident Fund)" :error="errors.uan" :help="form.uan ? `${form.uan.length}/12 digits` : '12-digit PF Universal Account No'">
          <UInput 
            v-model="form.uan" 
            placeholder="e.g. 100123456789" 
            class="w-full font-mono tracking-wide" 
            maxlength="12"
            icon="i-heroicons-document-text" 
            @input="onUanInput"
          />
        </UFormField>

        <!-- ESIC Number -->
        <UFormField label="ESIC Number" :error="errors.esic_no">
          <UInput 
            v-model="form.esic_no" 
            placeholder="e.g. 31001234560001001" 
            class="w-full font-mono tracking-wide" 
            icon="i-heroicons-heart" 
          />
        </UFormField>

        <!-- Shramik Kalyan No -->
        <UFormField label="Shramik Kalyan / Welfare No" :error="errors.s_kalyan_no">
          <UInput 
            v-model="form.s_kalyan_no" 
            placeholder="Welfare Card Number" 
            class="w-full" 
            icon="i-heroicons-ticket" 
          />
        </UFormField>
      </div>
    </div>

    <!-- Section 4: Exit & Separation Details (Shows always, highlighted if status is Left) -->
    <div 
      class="rounded-xl border p-4 md:p-6 shadow-xs transition-colors"
      :class="form.status === 'Left' || form.date_of_exit 
        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50' 
        : 'bg-white dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'"
    >
      <div class="flex items-center justify-between border-b pb-3 mb-5" :class="form.status === 'Left' || form.date_of_exit ? 'border-rose-100 dark:border-rose-900/40' : 'border-slate-100 dark:border-slate-800'">
        <div class="flex items-center gap-2.5">
          <div 
            class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
            :class="form.status === 'Left' || form.date_of_exit 
              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' 
              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'"
          >
            4
          </div>
          <div>
            <h3 class="text-base font-bold text-slate-900 dark:text-white leading-tight">Exit & Separation (Optional)</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Fill only when employee resigns, leaves, or is relieved</p>
          </div>
        </div>
        <span 
          v-if="form.status === 'Left'"
          class="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/40 px-2.5 py-0.5 rounded-full"
        >
          Employee Marked as Left
        </span>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
        <UFormField label="Date of Exit" :error="errors.date_of_exit" help="Setting an exit date will set status to 'Left'">
          <UInput 
            v-model="form.date_of_exit" 
            type="date" 
            class="w-full" 
            icon="i-heroicons-arrow-right-on-rectangle" 
          />
        </UFormField>

        <UFormField label="Reason for Leaving / Remarks" :error="errors.doe_rem">
          <UInput 
            v-model="form.doe_rem" 
            placeholder="e.g. Resigned, Project completed, Relocated" 
            class="w-full" 
            icon="i-heroicons-chat-bubble-bottom-center-text" 
          />
        </UFormField>
      </div>
    </div>

    <!-- Sticky Bottom Form Actions -->
    <div class="sticky bottom-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 -mx-2 px-4 md:-mx-4 md:px-6">
      <div class="flex items-center gap-2 w-full sm:w-auto">
        <UButton 
          type="button" 
          variant="ghost" 
          color="neutral" 
          size="sm" 
          icon="i-heroicons-arrow-path" 
          label="Reset Form" 
          @click="resetForm" 
        />
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto justify-end">
        <UButton 
          type="button" 
          variant="outline" 
          color="neutral" 
          size="md" 
          label="Cancel" 
          @click="emit('close')" 
          class="w-1/2 sm:w-auto px-5" 
        />
        <UButton 
          type="submit" 
          :loading="loading" 
          size="md" 
          color="primary" 
          :icon="employee ? 'i-heroicons-check' : 'i-heroicons-user-plus'"
          :label="employee ? 'Update Employee File' : 'Save New Employee'" 
          class="w-1/2 sm:w-auto px-6 font-semibold shadow-sm" 
        />
      </div>
    </div>
  </form>
</template>
