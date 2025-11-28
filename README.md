# Web3D & Graphics Book

A comprehensive knowledge website for computer graphics and Web3D development, featuring interactive 3D examples powered by Three.js, Vue 3, and TypeScript.

## 🚀 Features

- **Interactive 3D Examples**: Learn through hands-on examples with real-time 3D rendering
- **Modern Tech Stack**: Built with Vue 3, TypeScript, Three.js, and VitePress
- **Comprehensive Content**: From basic geometry to advanced shaders and WebGL programming
- **Developer Friendly**: Clean code examples with detailed explanations
- **Responsive Design**: Works perfectly on desktop and mobile devices

## 🛠️ Tech Stack

- **Frontend**: Vue 3 + TypeScript
- **3D Graphics**: Three.js + WebGL
- **Documentation**: VitePress
- **Build Tool**: Vite
- **Styling**: CSS3 with CSS Variables

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/web3d-graph-book.git
cd web3d-graph-book
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## 📖 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - Run TypeScript type checking

## 📚 Project Structure

```
web3d-graph-book/
├── docs/                    # Documentation and examples
│   ├── .vitepress/         # VitePress configuration
│   │   ├── config.ts       # Site configuration
│   │   └── theme/          # Custom theme
│   ├── components/         # Vue components
│   │   └── BasicScene.vue  # Three.js scene component
│   ├── examples/           # Interactive examples
│   │   ├── index.md        # Examples overview
│   │   └── basic-cube.md   # Basic cube example
│   └── index.md            # Homepage
├── package.json            # Project dependencies
├── tsconfig.json          # TypeScript configuration
└── vite.config.ts         # Vite configuration
```

## 🎯 Examples Included

### Beginner Level
- **Basic Cube** - Fundamentals of Three.js scene setup
- **Lighting Demo** - Different lighting techniques
- **Geometry Showcase** - Various 3D shapes and primitives
- **Materials Demo** - Different material types and properties

### Intermediate Level
- Camera controls and manipulation
- Animation systems and transitions
- Particle systems and effects
- Texture mapping and UV coordinates

### Advanced Level
- Custom GLSL shaders
- Post-processing effects
- Physics integration
- WebXR support

## 🎨 Customization

### Adding New Examples

1. Create a new markdown file in `docs/examples/`:
```markdown
---
layout: doc
title: Your Example
description: Brief description of your example
---

# Your Example Title

Your content here...

<YourComponent />
```

2. Create corresponding Vue component in `docs/components/`

3. Update sidebar navigation in `docs/.vitepress/config.ts`

### Styling

Custom CSS variables are defined in `docs/.vitepress/theme/style.css`:
```css
:root {
  --vp-c-brand: #3c8772;
  --vp-c-brand-light: #4a9c85;
  /* ... more variables */
}
```

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Contribution Guidelines

- Follow the existing code style
- Add TypeScript types where appropriate
- Include documentation for new examples
- Test your changes thoroughly
- Update the README if necessary

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Three.js](https://threejs.org/) - Powerful 3D library
- [Vue.js](https://vuejs.org/) - Progressive JavaScript framework
- [VitePress](https://vitepress.dev/) - Vite & Vue powered static site generator
- [TypeScript](https://www.typescriptlang.org/) - JavaScript with syntax for types

## 📞 Support

If you have any questions or need help:

1. Check the [documentation](https://your-domain.com)
2. Open an [issue](https://github.com/your-username/web3d-graph-book/issues)
3. Join our [community discussions](https://github.com/your-username/web3d-graph-book/discussions)

---

Happy coding! 🚀