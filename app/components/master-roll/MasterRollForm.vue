<script setup lang="ts">
import { reactive, onMounted, ref, watch } from 'vue'
import { useMasterRoll } from '@/composables/useMasterRoll'
import { useAuth } from '@/composables/useAuth'
import { useToast } from '#imports'

const props = defineProps<{
  employee?: any
}>()

const emit = defineEmits(['success', 'close'])
const { createEmployee, updateEmployee } = useMasterRoll()
const { apiFetch } = useAuth()
const toast = useToast()

const form = reactive({
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
  date_of_joining: new Date().toISOString().split('T')[0],
  date_of_exit: '',
  doe_rem: '',
  resignation_notice_period: 30,
  card_valid_until: '',
  status: 'Active'
})

watch(() => props.employee, (newVal) => {
  if (newVal) {
    Object.assign(form, {
      resignation_notice_period: 30,
      card_valid_until: '',
      ...newVal
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
      date_of_joining: new Date().toISOString().split('T')[0],
      date_of_exit: '',
      doe_rem: '',
      resignation_notice_period: 30,
      card_valid_until: '',
      status: 'Active'
    })
  }
}, { immediate: true })

const loading = ref(false)
const fetchingIfsc = ref(false)

watch(() => form.ifsc, async (newVal) => {
  if (newVal && newVal.length === 11) {
    fetchingIfsc.value = true
    try {
      const res = await apiFetch(`/api/master-rolls/lookup/ifsc/${newVal}`)
      if (res.success) {
        form.bank = res.data.BANK
        form.branch = res.data.BRANCH
        toast.add({ title: 'IFSC Verified', description: `${res.data.BANK}, ${res.data.BRANCH}`, color: 'success' })
      }
    } catch (err) {
      toast.add({ title: 'IFSC Error', description: 'Invalid or unreachable IFSC code', color: 'error' })
    } finally {
      fetchingIfsc.value = false
    }
  }
})

const onSubmit = async () => {
  loading.value = true
  try {
    let res
    if (props.employee?._id) {
      res = await updateEmployee(props.employee._id, form)
    } else {
      res = await createEmployee(form)
    }

    if (res.success) {
      toast.add({ title: 'Success', description: res.message, color: 'success' })
      emit('success')
      emit('close')
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message, color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form @submit.prevent="onSubmit" class="space-y-8 p-2 md:p-4">
    <!-- Section 1: Basic Information -->
    <div>
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-user" class="w-5 h-5 text-primary" />
        <h3 class="font-bold text-slate-900 underline decoration-primary/30 underline-offset-4">Basic Information</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <UFormField label="Employee Name" required>
          <UInput v-model="form.employee_name" placeholder="Full Name" required class="w-full" />
        </UFormField>
        
        <UFormField label="Father/Husband Name" required>
          <UInput v-model="form.father_husband_name" placeholder="Name" required class="w-full" />
        </UFormField>

        <UFormField label="Date of Birth" required>
          <UInput v-model="form.date_of_birth" type="date" required class="w-full" />
        </UFormField>

        <UFormField label="Aadhar Number" required>
          <UInput v-model="form.aadhar" placeholder="12-digit number" required class="w-full" />
        </UFormField>

        <UFormField label="PAN Number">
          <UInput v-model="form.pan" placeholder="ABCDE1234F" class="w-full" />
        </UFormField>

        <UFormField label="Phone Number" required>
          <UInput v-model="form.phone_no" placeholder="10-digit number" required class="w-full" />
        </UFormField>
      </div>
      <div class="mt-4">
        <UFormField label="Permanent Address" required>
          <UTextarea v-model="form.address" placeholder="Full address details..." required class="w-full" :rows="2" />
        </UFormField>
      </div>
    </div>

    <!-- Section 2: Employment Details -->
    <div class="pt-6 border-t border-slate-200">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-briefcase" class="w-5 h-5 text-primary" />
        <h3 class="font-bold text-slate-900 underline decoration-primary/30 underline-offset-4">Employment Details</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <UFormField label="Category">
          <UInput 
            v-model="form.category" 
            list="category-list" 
            placeholder="Select or type Category..." 
            class="w-full" 
            icon="i-heroicons-chevron-down" 
            trailing 
          />
          <datalist id="category-list">
            <option value="UNSKILLED" />
            <option value="SEMI-SKILLED" />
            <option value="SKILLED" />
            <option value="HIGHLY-SKILLED" />
            <option value="Engineer" />
            <option value="Technician" />
            <option value="Helper" />
            <option value="Supervisor" />
          </datalist>
        </UFormField>

        <UFormField label="Daily Wage">
          <UInput v-model="form.p_day_wage" type="number" step="0.01" placeholder="0.00" class="w-full" icon="i-heroicons-banknotes" />
        </UFormField>

        <UFormField label="Status">
          <USelect v-model="form.status" :items="['Active', 'Inactive', 'Left']" class="w-full" />
        </UFormField>

        <UFormField label="Project">
          <UInput v-model="form.project" placeholder="Project Name" class="w-full" />
        </UFormField>

        <UFormField label="Site/Location">
          <UInput v-model="form.site" placeholder="Site Name" class="w-full" />
        </UFormField>

        <UFormField label="Date of Joining" required>
          <UInput v-model="form.date_of_joining" type="date" required class="w-full" />
        </UFormField>

        <UFormField label="Card Valid Until">
          <UInput v-model="form.card_valid_until" type="date" class="w-full" icon="i-heroicons-calendar-days" />
        </UFormField>

        <UFormField label="UAN Number">
          <UInput v-model="form.uan" placeholder="PF Account" class="w-full" />
        </UFormField>

        <UFormField label="ESIC Number">
          <UInput v-model="form.esic_no" placeholder="ESIC ID" class="w-full" />
        </UFormField>

        <UFormField label="S. Kalyan No">
          <UInput v-model="form.s_kalyan_no" placeholder="Welfare No" class="w-full" />
        </UFormField>

        <UFormField label="Date of Exit">
          <UInput v-model="form.date_of_exit" type="date" class="w-full" />
        </UFormField>

        <UFormField label="Exit Remarks">
          <UInput v-model="form.doe_rem" placeholder="Reason for leaving..." class="w-full" />
        </UFormField>

        <UFormField label="Notice Period (Days)">
          <UInput v-model="form.resignation_notice_period" type="number" placeholder="30" class="w-full" icon="i-heroicons-clock" />
        </UFormField>
      </div>
    </div>

    <!-- Section 3: Banking & Statutory -->
    <div class="pt-6 border-t border-slate-200">
      <div class="flex items-center gap-2 mb-4">
        <UIcon name="i-heroicons-building-library" class="w-5 h-5 text-primary" />
        <h3 class="font-bold text-slate-900 underline decoration-primary/30 underline-offset-4">Bank Details</h3>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
        <UFormField label="IFSC Code" required>
          <UInput v-model="form.ifsc" placeholder="11 characters" required class="w-full" :loading="fetchingIfsc" icon="i-heroicons-magnifying-glass" />
        </UFormField>

        <UFormField label="Bank Name" required>
          <UInput v-model="form.bank" placeholder="Fetched from IFSC" required class="w-full" />
        </UFormField>

        <UFormField label="Account Number" required>
          <UInput v-model="form.account_no" placeholder="Bank account number" required class="w-full" />
        </UFormField>

        <UFormField label="Branch Name" class="sm:col-span-2 lg:col-span-3">
          <UInput v-model="form.branch" placeholder="Branch location" class="w-full" />
        </UFormField>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row justify-end gap-3 pt-8 mt-4 border-t border-slate-200">
      <UButton variant="ghost" color="neutral" size="lg" label="Cancel" @click="emit('close')" class="order-2 sm:order-1" />
      <UButton type="submit" :loading="loading" size="lg" :label="employee ? 'Update Record' : 'Create Record'" class="px-8 order-1 sm:order-2" />
    </div>
  </form>
</template>
