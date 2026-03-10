import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "WebGPU与图形渲染",
  description: "一个基于WebGPU的图形渲染的指南",
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
  ],
  themeConfig: {
    logo: '/favicon.svg',
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
                  { text: '顶点缓冲区', link: '/WebGPU/vertexBuffer' },
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

  }
});
