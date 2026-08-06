<script setup lang="ts">
import CreateStockModal from '../inventory/CreateStockModal.vue';
</script>

<template>
  <CreateStockModal v-bind="($attrs as any)" />
</template>
