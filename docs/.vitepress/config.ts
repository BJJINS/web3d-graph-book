import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Web3D & Graphics Book',
  description: 'A comprehensive knowledge base for graphics programming and Web3D development',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#3c8772' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/examples/' },
      { text: 'About', link: '/about' }
    ],

    sidebar: {
      '/examples/': [
        {
          text: '3D Examples',
          items: [
            { text: 'Basic Cube', link: '/examples/basic-cube' },
            { text: 'Lighting Demo', link: '/examples/lighting' },
            { text: 'Geometry Showcase', link: '/examples/geometry' },
            { text: 'Materials Demo', link: '/examples/materials' }
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-username/web3d-graph-book' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Web3D & Graphics Book'
    },

    editLink: {
      pattern: 'https://github.com/your-username/web3d-graph-book/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  },

  vite: {
    plugins: [],
    resolve: {
      alias: {
        '@': '/docs'
      }
    }
  },

  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('three-')
      }
    }
  }
})