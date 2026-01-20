<!--
 * @FileDescription: 
 * @Date: 2026-01-19 14:37:11
-->
<template>
  <div class="map-container">
    <canvas ref="mapCanvas"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { TextureLoader, DoubleSide, MeshBasicMaterial, AdditiveBlending } from 'three'
import { BasicThreejs } from '@/threejs/core'
import { Grid } from '@/threejs/components/Grid'
import { Plane } from '@/threejs/components/Plane'
import image1 from '@/assets/textures/image.png'
import { Map3D } from '@/threejs/components/Map3D'
import map1Data from '@/geoJson/广东省.json'

const mapCanvas = ref(null)
let map = null,
  loader = new TextureLoader()
onMounted(() => {
  map = new BasicThreejs(mapCanvas.value)
  new Grid(map, {
    gridSize: 50,
    gridDivision: 20,
    gridColor: 0x1b4b70,
    shapeSize: 0.5,
    shapeColor: 0x2a5f8a,
    pointSize: 0.1,
    pointColor: 0x154d7d,
  })
  const plane1 = new Plane(map, {
    width: 10,
    scale: 1,
    position: { x: 0, y: 0.8, z: 0 },
    material: new MeshBasicMaterial({
      map: loader.load(image1),
      color: 0x48afff,
      side: DoubleSide,
      transparent: true,
      opacity: 0.4,
      depthTest: false,
      blending: AdditiveBlending,
    }),
  })
  plane1.instance.rotation.x = -Math.PI / 2
  plane1.instance.renderOrder = 6
  // plane1.instance.scale.set(0, 0, 0)
  new Map3D(map, {
    data: map1Data,
  })
})
onUnmounted(() => {
  map?.destroy()
})
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}
</style>
