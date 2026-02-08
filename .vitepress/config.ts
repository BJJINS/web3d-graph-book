import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "My Awesome Project",
  description: "A VitePress Site",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/examples/markdown-examples' },
      { text: 'Rust', link: '/rust/api-examples' }
    ],

    sidebar: {
      '/examples': [
        {
          text: 'Examples',
          items: [
            { text: 'Markdown Examples', link: '/examples/markdown-examples' },
          ]
        },
      ],
      "/rust": [{
        text: 'rust',
        items: [
          { text: 'Runtime API Examples', link: '/api-examples' }
        ]
      }]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/vuejs/vitepress' }
    ]
  }
});
