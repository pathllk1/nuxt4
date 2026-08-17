<template>
  <PartyAccountMasterModal
    :model-value="modelValue"
    :account-id="accountId"
    :initial-data="initialData"
    :default-type="defaultType || 'SUNDRY_DEBTORS'"
    @update:model-value="$emit('update:modelValue', $event)"
    @saved="$emit('saved', $event)"
  />
</template>

<script setup lang="ts">
import PartyAccountMasterModal from './PartyAccountMasterModal.vue';

defineProps<{
  modelValue: boolean;
  accountId?: string | null;
  initialData?: any;
  defaultType?: string;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', account: any): void;
}>();
</script>
