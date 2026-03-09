import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
// import './custom.css';

import TriangleGridCanvas from '../../components/TriangleGridCanvas.vue';
import WebGpuTrianglePlayground from '../../components/WebGpuTrianglePlayground.vue';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('TriangleGridCanvas', TriangleGridCanvas);
    app.component('WebGpuTrianglePlayground', WebGpuTrianglePlayground);
  }
} satisfies Theme;
