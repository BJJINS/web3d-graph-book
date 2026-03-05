import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "My Awesome Project",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '主页', link: '/' },
      { text: 'WebGPU', link: '/WebGPU/fundamentals' },
    ],

    sidebar: {
      '/WebGPU': [
        {
          text: 'WebGPU',
          items: [
            { text: '基础知识', link: '/WebGPU/fundamentals' },
          ]
        },
      ],
    },

    outline: {
      level: "deep",
      label: '页面目录'
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
});
