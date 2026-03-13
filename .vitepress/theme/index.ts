import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import Layout from './Layout.vue';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
  }
} satisfies Theme;
