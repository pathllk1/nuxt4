<template>
  <PartyAccountMasterModal
    :model-value="modelValue"
    :initial-data="editData"
    :default-type="'BANK'"
    @update:model-value="$emit('update:modelValue', $event)"
    @saved="$emit('saved', $event)"
  />
</template>

<script setup lang="ts">
import PartyAccountMasterModal from './PartyAccountMasterModal.vue';

defineProps<{
  modelValue: boolean;
  editData?: any;
}>();

defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'saved', account?: any): void;
}>();
</script>
