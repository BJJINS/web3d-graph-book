---
layout: doc
title: Basic Cube Example
description: Learn the fundamentals of Three.js with a simple rotating cube
---

# Basic Cube Example

This example demonstrates the fundamental concepts of Three.js by creating a simple rotating cube. It covers scene setup, camera configuration, lighting, and basic animation.

<BasicScene />

<script setup>
   import Basic from "../components/BasicScene.vue"
</script>

## Code Explanation

Here's the complete code for our basic cube scene:

```typescript
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

// Three.js scene setup
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xf0f0f0)

// Camera setup
const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
camera.position.z = 5

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(width, height)

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
directionalLight.position.set(1, 1, 1)
scene.add(directionalLight)

// Create cube geometry and material
const geometry = new THREE.BoxGeometry(2, 2, 2)
const material = new THREE.MeshPhongMaterial({ 
  color: 0x00ff00,
  shininess: 100
})
const cube = new THREE.Mesh(geometry, material)
scene.add(cube)

// Animation loop
function animate() {
  requestAnimationFrame(animate)
  cube.rotation.x += 0.01
  cube.rotation.y += 0.01
  renderer.render(scene, camera)
}
animate()
```

## Key Concepts

### 1. Scene Graph
Three.js uses a scene graph structure where all 3D objects are added to a scene. The scene acts as a container for all your 3D objects, lights, and cameras.

### 2. Camera
The `PerspectiveCamera` simulates how the human eye sees the world. Key parameters:
- **Field of View**: 75 degrees (wider angles = more distortion)
- **Aspect Ratio**: width/height of the viewport
- **Near/Far Planes**: Objects closer than 0.1 or farther than 1000 won't be rendered

### 3. Renderer
The WebGL renderer converts your 3D scene into 2D pixels on the screen. We enable antialiasing for smoother edges.

### 4. Geometry & Materials
- **Geometry**: Defines the shape (BoxGeometry for cubes)
- **Material**: Defines appearance (MeshPhongMaterial for shiny surfaces)

### 5. Lighting
- **Ambient Light**: Provides base illumination to all objects
- **Directional Light**: Simulates sunlight with specific direction

## Try It Yourself

Experiment with these modifications:

1. **Change cube color**: Replace `0x00ff00` with other hex colors like `0xff0000` (red)
2. **Adjust rotation speed**: Modify the values in `cube.rotation.x` and `cube.rotation.y`
3. **Change camera position**: Try different values for `camera.position.z`
4. **Add more lights**: Experiment with different light types and positions

## Next Steps

Ready for more complex examples? Check out:
- [Lighting Demo](/examples/lighting) - Explore different lighting techniques
- [Geometry Showcase](/examples/geometry) - Learn about various 3D shapes
- [Materials Demo](/examples/materials) - Discover different material types

Remember to always clean up your Three.js resources when the component unmounts to prevent memory leaks!
