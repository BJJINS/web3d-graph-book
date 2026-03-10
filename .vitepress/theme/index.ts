import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';

import TriangleGridCanvas from '../../components/TriangleGridCanvas.vue';
import WebGpuTrianglePlayground from '../../components/WebGpuTrianglePlayground.vue';
import Layout from './Layout.vue';

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('TriangleGridCanvas', TriangleGridCanvas);
    app.component('WebGpuTrianglePlayground', WebGpuTrianglePlayground);
  }
} satisfies Theme;
