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
import { Map3D } from '@/threejs/core'
import { Grid } from '@/threejs/components/Grid'
import { Plane } from '@/threejs/components/Plane'

const mapCanvas = ref(null)
let map = null
onMounted(() => {
  map = new Map3D(mapCanvas.value)
  new Grid(map, {
    gridSize: 50,
    gridDivision: 20,
    gridColor: 0x1b4b70,
    shapeSize: 0.5,
    shapeColor: 0x2a5f8a,
    pointSize: 0.1,
    pointColor: 0x154d7d,
  })
  new Plane(map)
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
