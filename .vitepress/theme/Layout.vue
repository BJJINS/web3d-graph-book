<script setup lang="ts">
import { onMounted } from 'vue';
import DefaultTheme from 'vitepress/theme';
import { inject } from '@vercel/analytics';

const { Layout } = DefaultTheme;

onMounted(() => {
  inject();
});
</script>

<template>
  <Layout />
</template>
