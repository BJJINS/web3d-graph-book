<template>
  <div class="three-container" ref="container">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <span>Loading 3D Scene...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'

// Refs
const container = ref<HTMLElement>()
const loading = ref(true)

// Three.js variables
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let cube: THREE.Mesh
let animationId: number

// Initialize Three.js scene
const initScene = () => {
  if (!container.value) return

  // Create scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  // Create camera
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
  camera.position.z = 5

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  container.value.appendChild(renderer.domElement)

  // Add lights
  const ambientLight = new THREE.AmbientLight(0x404040, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)

  // Create cube
  const geometry = new THREE.BoxGeometry(2, 2, 2)
  const material = new THREE.MeshPhongMaterial({
    color: 0x00ff00,
    shininess: 100
  })
  cube = new THREE.Mesh(geometry, material)
  scene.add(cube)

  loading.value = false
}

// Animation loop
const animate = () => {
  animationId = requestAnimationFrame(animate)

  if (cube) {
    cube.rotation.x += 0.01
    cube.rotation.y += 0.01
  }

  renderer.render(scene, camera)
}

// Handle window resize
const handleResize = () => {
  if (!container.value || !camera || !renderer) return

  const width = container.value.clientWidth
  const height = container.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// Lifecycle hooks
onMounted(() => {
  initScene()
  animate()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  window.removeEventListener('resize', handleResize)

  if (renderer && container.value) {
    container.value.removeChild(renderer.domElement)
    renderer.dispose()
  }
})
</script>

<style scoped>
.three-container {
  position: relative;
  width: 100%;
  height: 400px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.2rem;
  gap: 1rem;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top: 4px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
