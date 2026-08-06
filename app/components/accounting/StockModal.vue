<script setup lang="ts">
import StockModal from '../inventory/StockModal.vue';
</script>

<template>
  <StockModal v-bind="($attrs as any)" />
</template>
