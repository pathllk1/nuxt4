<template>
  <UModal v-model:open="isOpen" :title="editData ? 'Edit Bank Account' : 'Register New Bank Account'">
    <template #body>
      <form @submit.prevent="saveAccount" class="space-y-4 p-4">
        <!-- Subtitle info -->
        <p class="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider -mt-2">
          Configure physical banking channel for firm transactions
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div class="md:col-span-2">
            <UFormField label="Internal Account Name" required>
              <UInput 
                v-model="form.account_name" 
                required 
                placeholder="e.g. Main Current Account" 
                class="w-full" 
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="IFSC Code" required>
              <UInput 
                v-model="form.ifsc_code" 
                required 
                maxlength="11" 
                class="w-full font-mono uppercase" 
                placeholder="SBIN0001234" 
                :loading="fetchingIfsc"
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="Bank Name" required>
              <UInput 
                v-model="form.bank_name" 
                required 
                placeholder="Fetched from IFSC" 
                class="w-full" 
              />
            </UFormField>
          </div>

          <div class="md:col-span-2">
            <UFormField label="Branch Name">
              <UInput 
                v-model="form.branch_name" 
                placeholder="Branch location" 
                class="w-full" 
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="Account Number" required>
              <UInput 
                v-model="form.account_number" 
                required 
                placeholder="Enter account number"
                class="w-full font-mono" 
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="Account Type">
              <USelect 
                v-model="form.account_type" 
                :items="[
                  { label: 'Current Account', value: 'CURRENT' },
                  { label: 'Savings Account', value: 'SAVINGS' },
                  { label: 'Overdraft (OD)', value: 'OD' },
                  { label: 'Cash Credit (CC)', value: 'CC' },
                  { label: 'Other', value: 'OTHER' }
                ]" 
                class="w-full" 
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="Status">
              <USelect 
                v-model="form.status" 
                :items="[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Inactive', value: 'INACTIVE' }
                ]" 
                class="w-full" 
              />
            </UFormField>
          </div>

          <div>
            <UFormField label="Account Holder Name">
              <UInput 
                v-model="form.account_holder_name" 
                placeholder="Holder name"
                class="w-full" 
              />
            </UFormField>
          </div>

          <div class="md:col-span-2 mt-1">
            <label class="flex items-center gap-3 p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 cursor-pointer group transition-all hover:bg-blue-100/50 dark:hover:bg-blue-950/20">
              <UCheckbox v-model="form.is_default" class="text-blue-600 focus:ring-blue-500" />
              <div>
                <p class="text-xs font-black text-blue-900 dark:text-blue-200 uppercase tracking-tight">Set as Primary Account</p>
                <p class="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase mt-0.5">Used by default for new payments and receipts</p>
              </div>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-zinc-800 mt-4">
          <UButton 
            label="Discard" 
            variant="ghost" 
            color="neutral" 
            @click="isOpen = false" 
          />
          <UButton 
            type="submit" 
            :label="editData ? 'Update Account' : 'Register Account'" 
            color="primary" 
            :loading="saving" 
            class="px-6 font-bold"
          />
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import { reactive, ref, watch, computed } from 'vue';
import { api } from '@/utils/api';

const props = defineProps<{
  modelValue: boolean;
  editData?: any;
}>();

const emit = defineEmits(['update:modelValue', 'saved']);

const isOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
});

const saving = ref(false);
const fetchingIfsc = ref(false);

const form = reactive({
  account_name: '',
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  ifsc_code: '',
  account_type: 'CURRENT',
  upi_id: '',
  notes: '',
  is_default: false,
  status: 'ACTIVE',
});

// IFSC Lookup logic
watch(() => form.ifsc_code, async (newVal) => {
  if (newVal && newVal.length === 11) {
    fetchingIfsc.value = true;
    try {
      const res = await api.get(`/master-rolls/lookup/ifsc/${newVal}`);
      if (res.success) {
        form.bank_name = res.data.BANK;
        form.branch_name = res.data.BRANCH;
        
        if (!form.account_name) {
          form.account_name = `${res.data.BANK} - ${form.account_type}`;
        }
      }
    } catch (err) {
      console.warn('IFSC lookup failed', err);
    } finally {
      fetchingIfsc.value = false;
    }
  }
});

watch(() => props.modelValue, (val) => {
  if (val) {
    if (props.editData) {
      Object.assign(form, props.editData);
    } else {
      resetForm();
    }
  }
});

async function saveAccount() {
  saving.value = true;
  try {
    const url = props.editData ? `/banking/${props.editData._id}` : '/banking';
    const method = props.editData ? 'PUT' : 'POST';
    
    const res = await (method === 'PUT' ? api.put(url, form) : api.post(url, form));
    
    if (res.success) {
      emit('saved');
      isOpen.value = false;
    }
  } catch (err: any) {
    alert(err.message || 'Failed to save bank account');
  } finally {
    saving.value = false;
  }
}

function resetForm() {
  Object.assign(form, {
    account_name: '',
    account_holder_name: '',
    bank_name: '',
    branch_name: '',
    account_number: '',
    ifsc_code: '',
    account_type: 'CURRENT',
    upi_id: '',
    notes: '',
    is_default: false,
    status: 'ACTIVE',
  });
}
</script>
