<script setup lang="ts">
import { reactive, onMounted, ref, watch } from 'vue'
import { useAuth } from '../../composables/useAuth'

const props = defineProps<{
  open?: boolean;
  firm?: any;
}>()

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success'): void;
}>()

const { apiFetch } = useAuth()
const toast = useToast()
const loading = ref(false)
const fetchingGst = ref<Record<number, boolean>>({})

const form = reactive({
  name: '',
  legal_name: '',
  code: '',
  description: '',
  phone_number: '',
  secondary_phone: '',
  email: '',
  website: '',
  business_type: 'Private Limited',
  industry_type: '',
  establishment_year: new Date().getFullYear(),
  employee_count: 0,
  registration_number: '',
  registration_date: '',
  cin_number: '',
  pan_number: '',
  status: 'approved',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  enable_e_invoice: false,
  
  city: '',
  state: '',
  pincode: '',
  address: '',

  bank_name: '',
  bank_account_number: '',
  bank_branch: '',
  ifsc_code: '',
  payment_terms: '',

  locations: [
    {
      gst_number: '',
      state: '',
      state_code: '',
      registration_type: 'PPOB',
      address: '',
      city: '',
      pincode: '',
      is_default: true
    }
  ],

  admin_account: {
    name: '',
    email: '',
    password: ''
  }
})

const populateForm = () => {
  if (props.firm) {
    Object.assign(form, props.firm)
    if (props.firm.locations && props.firm.locations.length > 0) {
      form.locations = JSON.parse(JSON.stringify(props.firm.locations))
    }
  } else {
    form.name = ''
    form.legal_name = ''
    form.code = ''
    form.description = ''
    form.phone_number = ''
    form.secondary_phone = ''
    form.email = ''
    form.website = ''
    form.business_type = 'Private Limited'
    form.industry_type = ''
    form.establishment_year = new Date().getFullYear()
    form.pan_number = ''
    form.cin_number = ''
    form.registration_number = ''
    form.status = 'approved'
    form.bank_name = ''
    form.bank_account_number = ''
    form.bank_branch = ''
    form.ifsc_code = ''
    form.locations = [
      {
        gst_number: '',
        state: '',
        state_code: '',
        registration_type: 'PPOB',
        address: '',
        city: '',
        pincode: '',
        is_default: true
      }
    ]
    form.admin_account = { name: '', email: '', password: '' }
  }
}

onMounted(populateForm)
watch(() => props.firm, populateForm)

const fetchGstDetails = async (index: number) => {
  const gstin = form.locations[index]?.gst_number
  if (!gstin || gstin.length !== 15) {
    toast.add({ title: 'Invalid GSTIN', description: 'Please enter a valid 15-character GST number', color: 'error' })
    return
  }

  fetchingGst.value[index] = true
  try {
    const res: any = await apiFetch(`/api/admin/firms/lookup-gst?gstin=${gstin}`)
    if (res.success && res.data) {
      const data = res.data
      const loc = form.locations[index]!
      
      const businessName = data.trade_name || data.bnm || data.tradeName || ''
      const legalName = data.legal_name || data.lgnm || data.legalName || businessName
      
      if (loc.is_default || !form.name) {
        form.name = businessName || form.name
        form.legal_name = legalName || form.legal_name
        form.pan_number = gstin.substring(2, 12)
        
        if (data.registration_date) {
          const parts = data.registration_date.split('/')
          const year = parts[parts.length - 1]
          if (year && !isNaN(Number(year))) {
            form.establishment_year = Number(year)
          }
        }

        form.business_type = data.business_constitution || form.business_type

        if (Array.isArray(data.business_activity_nature)) {
          form.industry_type = data.business_activity_nature.join(', ')
        }
      }

      const addrObj = data.place_of_business_principal?.address || data.pradr?.addr || data.principalAddress || data.address || {}
      loc.state = addrObj.state || addrObj.stcd || data.state || loc.state
      loc.city = addrObj.district || addrObj.dst || data.city || loc.city
      loc.pincode = addrObj.pin_code || addrObj.pncd || data.pincode || loc.pincode

      const addrParts = [
        addrObj.door_num || addrObj.bno, 
        addrObj.building_name || addrObj.bnm, 
        addrObj.street || addrObj.st,  
        addrObj.location || addrObj.loc, 
        addrObj.district || addrObj.dst, 
        addrObj.state || addrObj.stcd 
      ].filter(Boolean)

      if (addrParts.length > 0) {
        loc.address = addrParts.join(', ')
      } else if (typeof addrObj === 'string') {
        loc.address = addrObj
      }

      toast.add({ 
        title: 'GST Verified', 
        description: `Successfully populated details for ${legalName || businessName}.`, 
        color: 'success' 
      })
    }
  } catch (err: any) {
    toast.add({ title: 'Lookup Failed', description: err.message, color: 'error' })
  } finally {
    fetchingGst.value[index] = false
  }
}

const addLocation = () => {
  form.locations.push({
    gst_number: '',
    state: '',
    state_code: '',
    registration_type: 'APOB',
    address: '',
    city: '',
    pincode: '',
    is_default: false
  })
}

const removeLocation = (index: number) => {
  if (form.locations[index]?.is_default) {
    toast.add({ title: 'Error', description: 'Cannot remove default location', color: 'error' })
    return
  }
  form.locations.splice(index, 1)
}

const setDefaultLocation = (index: number) => {
  form.locations.forEach((loc, i) => {
    loc.is_default = i === index
  })
}

const onSubmit = async () => {
  loading.value = true
  try {
    let res: any
    if (props.firm?._id || props.firm?.id) {
      const targetId = props.firm._id || props.firm.id
      res = await apiFetch(`/api/admin/firms/${targetId}`, {
        method: 'PUT',
        body: form
      })
    } else {
      res = await apiFetch('/api/admin/firms', {
        method: 'POST',
        body: form
      })
    }

    if (res.success) {
      toast.add({ title: 'Success', description: res.message || 'Firm saved successfully', color: 'success' })
      emit('success')
      emit('close')
    }
  } catch (err: any) {
    toast.add({ title: 'Error', description: err.message || 'Failed to save firm', color: 'error' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UModal :open="open"
          @update:open="(val) => { if (!val) emit('close'); }"
          :title="firm ? 'Edit Registered Firm' : 'Register New Tenant Firm'"
          :ui="{ content: 'sm:max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl' }">
    <template #body>
      <form @submit.prevent="onSubmit" class="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
        <!-- Section 1: Core Identity -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <UIcon name="i-heroicons-building-office-2" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Core Identity</h3>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormField label="Firm Display Name" required>
              <UInput v-model="form.name" placeholder="Acme Corp" required class="w-full" />
            </UFormField>

            <UFormField label="Legal Name">
              <UInput v-model="form.legal_name" placeholder="Acme International Pvt Ltd" class="w-full" />
            </UFormField>

            <UFormField label="Unique Code">
              <UInput v-model="form.code" placeholder="ACME01" class="w-full" />
            </UFormField>

            <UFormField label="Establishment Year">
              <UInput v-model="form.establishment_year" type="number" class="w-full" />
            </UFormField>

            <UFormField label="Business Type">
              <USelect v-model="form.business_type" :items="['Private Limited', 'Public Limited', 'Partnership', 'Proprietorship', 'LLP']" class="w-full" />
            </UFormField>

            <UFormField label="Industry">
              <UInput v-model="form.industry_type" placeholder="Manufacturing, Services..." class="w-full" />
            </UFormField>
          </div>

          <UFormField label="Firm Description">
            <UTextarea v-model="form.description" placeholder="Brief description..." class="w-full" :rows="2" />
          </UFormField>
        </div>

        <!-- Section 2: Contact & Compliance -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <UIcon name="i-heroicons-shield-check" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Contact & Compliance</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormField label="Primary Phone" required>
              <UInput v-model="form.phone_number" placeholder="+91..." required class="w-full" />
            </UFormField>

            <UFormField label="Official Email" required>
              <UInput v-model="form.email" type="email" placeholder="contact@acme.com" required class="w-full" />
            </UFormField>

            <UFormField label="Website">
              <UInput v-model="form.website" placeholder="https://..." class="w-full" />
            </UFormField>

            <UFormField label="PAN Number">
              <UInput v-model="form.pan_number" placeholder="10 chars" class="w-full" />
            </UFormField>

            <UFormField label="CIN Number">
              <UInput v-model="form.cin_number" placeholder="21 chars" class="w-full" />
            </UFormField>

            <UFormField label="Registration No">
              <UInput v-model="form.registration_number" placeholder="Registration ID" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- Section 3: GST & Locations -->
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-map-pin" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">GST & Locations</h3>
            </div>
            <UButton size="xs" variant="outline" icon="i-heroicons-plus" label="Add Location" @click="addLocation" />
          </div>

          <div v-for="(loc, index) in form.locations" :key="index" 
               class="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UBadge :color="loc.is_default ? 'primary' : 'neutral'" variant="subtle" size="xs">
                  {{ loc.is_default ? 'Principal Place (PPOB)' : 'Additional Place (APOB)' }}
                </UBadge>
                <UButton v-if="!loc.is_default" size="xs" variant="ghost" label="Make Default" @click="setDefaultLocation(index)" />
              </div>
              <UButton v-if="form.locations.length > 1" size="xs" variant="ghost" color="error" icon="i-heroicons-trash" @click="removeLocation(index)" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <UFormField label="GSTIN">
                <div class="flex items-center gap-1">
                  <UInput v-model="loc.gst_number" placeholder="07AAAAA0000A1Z5" class="w-full" />
                  <UButton size="xs" variant="soft" color="primary" icon="i-heroicons-magnifying-glass" :loading="fetchingGst[index]" @click="fetchGstDetails(index)" />
                </div>
              </UFormField>
              
              <UFormField label="State">
                <UInput v-model="loc.state" placeholder="State" class="w-full" />
              </UFormField>

              <UFormField label="City">
                <UInput v-model="loc.city" placeholder="City" class="w-full" />
              </UFormField>

              <UFormField label="Pincode">
                <UInput v-model="loc.pincode" placeholder="110001" class="w-full" />
              </UFormField>
            </div>

            <UFormField label="Full Address">
              <UInput v-model="loc.address" placeholder="Address..." class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- Section 4: Banking -->
        <div class="space-y-4">
          <div class="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <UIcon name="i-heroicons-banknotes" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 class="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">Banking & Finance</h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <UFormField label="Bank Name">
              <UInput v-model="form.bank_name" class="w-full" />
            </UFormField>

            <UFormField label="Account No">
              <UInput v-model="form.bank_account_number" class="w-full" />
            </UFormField>

            <UFormField label="IFSC Code">
              <UInput v-model="form.ifsc_code" class="w-full" />
            </UFormField>

            <UFormField label="Currency">
              <USelect v-model="form.currency" :items="['INR', 'USD', 'EUR', 'GBP']" class="w-full" />
            </UFormField>
          </div>
        </div>

        <!-- Section 5: Owner Account (Create only) -->
        <div v-if="!firm" class="space-y-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900">
          <div class="flex items-center gap-2 pb-1">
            <UIcon name="i-heroicons-user-plus" class="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 class="font-bold text-xs uppercase tracking-wider text-indigo-700 dark:text-indigo-300">Initial Owner Account</h3>
          </div>
          <p class="text-xs text-indigo-600 dark:text-indigo-400">Optional: Create the initial user account for this firm with Owner privileges.</p>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UFormField label="Owner Full Name">
              <UInput v-model="form.admin_account.name" placeholder="Firm Owner" class="w-full" />
            </UFormField>

            <UFormField label="Owner Email">
              <UInput v-model="form.admin_account.email" type="email" placeholder="owner@firm.com" class="w-full" />
            </UFormField>

            <UFormField label="Temporary Password">
              <UInput v-model="form.admin_account.password" type="password" placeholder="••••••••" class="w-full" />
            </UFormField>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="emit('close')" />
          <UButton type="submit" :loading="loading" color="primary" :label="firm ? 'Update Firm' : 'Register Firm'" class="px-8 font-bold" />
        </div>
      </form>
    </template>
  </UModal>
</template>
