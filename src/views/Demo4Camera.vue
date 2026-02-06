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
import { Vector3, AxesHelper, BoxGeometry, MeshBasicMaterial, Mesh } from 'three'
import { BasicThreejs } from '@/threejs/core'
import { useThreejsGUI } from '@/hooks/GUI'

const mapCanvas = ref(null)
let map = null
onMounted(() => {
  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: true,
      position: new Vector3(-20, 0, -10),
    },
  })

  const axesHelper = new AxesHelper(100)
  map.scene.add(axesHelper)

  const geometry = new BoxGeometry(10, 10, 10)
  const material = new MeshBasicMaterial({
    color: 'red',
  })
  const cube = new Mesh(geometry, material)
  cube.position.set(0, 0, 0)

  map.camera.lookAt(cube.position)
  map.scene.add(cube)

  useThreejsGUI({ camera: map.camera })
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
