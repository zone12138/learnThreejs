<!--
 * @FileDescription: 
 * @Date: 2026-01-19 14:37:11
-->
<template>
  <div class="map-container">
    <canvas ref="mapCanvas"></canvas>
    <button @click="cleanup">cleanup</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  TextureLoader,
  DoubleSide,
  MeshBasicMaterial,
  AdditiveBlending,
  Vector3,
  AxesHelper,
  Group,
} from 'three'
import gsap from 'gsap'
import { BasicThreejs } from '@/threejs/core'
import { Map2D } from '@/threejs/components/index'
import { changeMeshMaterial } from '@/threejs/utils/index'
import image1 from '@/assets/textures/image.png'
import map1Data from '@/geoJson/广东省.json'

const mapCanvas = ref(null)
let map = null,
  loader = new TextureLoader()
onMounted(() => {
  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: true,
      // position: new Vector3(0, 10, 12),
    },
  })

  const map2D = new Map2D(map, {
    projection: {
      center: [113.280637, 23.125178],
      scale: 50,
    },
    position: new Vector3(0, 0.3, 0),
    data: map1Data,
  })

  const axesHelper = new AxesHelper(100)
  map.scene.add(axesHelper)
})
onUnmounted(() => {
  map?.destroy()
})

const cleanup = () => {
  map?.destroy()
}
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
}

button {
  position: absolute;
  top: 10px;
  left: 10px;
}
</style>
