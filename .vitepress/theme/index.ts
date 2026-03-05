import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

// import TriangleGridCanvas from '../../components/TriangleGridCanvas.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    // app.component('TriangleGridCanvas', TriangleGridCanvas);
  }
} satisfies Theme;
