import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "My Awesome Project",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: 'WebGPU', link: '/WebGPU/markdown-examples' },
    ],

    sidebar: {
      '/WebGPU': [
        {
          text: 'Examples',
          items: [
            { text: 'Markdown Examples', link: '/WebGPU/markdown-examples' },
          ]
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
});
