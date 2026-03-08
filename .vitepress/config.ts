import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "My Awesome Project",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: 'WebGPU', link: '/WebGPU/introduction' },
    ],

    sidebar: {
      '/WebGPU': [
        {
          text: 'WebGPU',
          items: [
            { text: '介绍', link: '/WebGPU/introduction' },
            {
              text: '图形渲染', link: '/WebGPU/graphicsRendering',
              items: [
                { text: '绘制一个三角形', link: '/WebGPU/triangleExample' },
              ]
            },
          ]
        },
      ],
    },

    outline: {
      label: "目录",
      level: "deep"
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
});
