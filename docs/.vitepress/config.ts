import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Web3D & Graphics Book",
  description: "图形编程与 Web3D 开发的综合知识库",
  lastUpdated: true,
  cleanUrls: true,

  head: [["link", { rel: "icon", href: "/images/avatar.png" }]],

  themeConfig: {
    logo: "/images/avatar.png",

    nav: [
      { text: "首页", link: "/" },
      { text: "着色器", link: "/shader/" },
    ],

    sidebar: {
      "/shader/": [
        {
          text: "GLSL",
          items: [
            { text: "Basic Shader", link: "/shader/basic-shader" },
            { text: "Lighting Shader", link: "/shader/lighting-shader" },
            { text: "Geometry Shader", link: "/shader/geometry-shader" },
            { text: "Materials Shader", link: "/shader/materials-shader" },
          ],
        },
        {
          text: "WGSL",
          items: [
            { text: "Basic Shader", link: "/shader/basic-shader" },
            { text: "Lighting Shader", link: "/shader/lighting-shader" },
            { text: "Geometry Shader", link: "/shader/geometry-shader" },
            { text: "Materials Shader", link: "/shader/materials-shader" },
          ],
        },
        {
          text: "案例",
          items: [
            { text: "Basic Shader", link: "/shader/basic-shader" },
            { text: "Lighting Shader", link: "/shader/lighting-shader" },
            { text: "Geometry Shader", link: "/shader/geometry-shader" },
            { text: "Materials Shader", link: "/shader/materials-shader" },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: "github", link: "https://github.com/BJJINS/web3d-graph-book.git" },
      { icon: "gitee", link: "https://gitee.com/bjjin/web3d-graph-book.git" },
    ],

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2024 Web3D & Graphics Book",
    },

    search: {
      provider: "local",
    },
  },

  vite: {
    plugins: [],
    resolve: {
      alias: {
        "@": "/docs",
      },
    },
  },

  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith("three-"),
      },
    },
  },
});
