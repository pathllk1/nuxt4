<template>
  <ItemStockMasterModal
    :model-value="modelValue"
    :stock="stock"
    :initial-data="stock"
    @update:model-value="$emit('update:modelValue', $event)"
    @saved="$emit('saved', $event)"
  />
</template>

<script setup lang="ts">
import ItemStockMasterModal from './ItemStockMasterModal.vue';

defineProps<{
  modelValue: boolean;
  stock?: any;
}>();

defineEmits<{
  (e: 'update:modelValue', val: boolean): void;
  (e: 'saved', data?: any): void;
}>();
</script>
