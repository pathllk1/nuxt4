<script setup lang="ts">
import CartManager from '../inventory/CartManager.vue';
defineProps<Record<string, any>>();
</script>

<template>
  <CartManager v-bind="($attrs as any)" />
</template>
