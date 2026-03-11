import { defineConfig } from 'vitepress';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: "zh-CN",
  title: "WebGPU与图形渲染",
  description: "一个基于WebGPU的图形渲染的指南",
  titleTemplate: "WebGPU与图形渲染",
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'description', content: '一个基于WebGPU的图形渲染的指南' }],
    ['meta', { name: 'keywords', content: 'WebGPU, 图形渲染, WGSL, GPU, 渲染管线, Web3D' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'WebGPU与图形渲染' }],
    ['meta', { property: 'og:description', content: '一个基于WebGPU的图形渲染的指南' }],
    ['meta', { property: 'og:image', content: '/favicon.svg' }],
    ['meta', { property: 'og:locale', content: 'zh_CN' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'WebGPU与图形渲染' }],
    ['meta', { name: 'twitter:description', content: '一个基于WebGPU的图形渲染的指南' }],
    ['meta', { name: 'theme-color', content: '#6366f1' }],
  ],
  themeConfig: {
    logo: '/favicon.svg',
    nav: [
      { text: '主页', link: '/index' },
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
                { text: 'Inter-stage 变量', link: '/WebGPU/inter-stage' },
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
