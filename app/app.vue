<script setup lang="ts">
import { onMounted } from 'vue';

const colorMode = useColorMode();
colorMode.preference = 'light';

onMounted(() => {
  if (import.meta.client) {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    document.documentElement.style.colorScheme = 'light';
  }
});
</script>

<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
