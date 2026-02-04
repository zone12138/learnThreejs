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
import { TextureLoader, Vector3, AxesHelper } from 'three'
import { simplify } from '@turf/turf'
import { BasicThreejs } from '@/threejs/core'
import { Map2D, Grid, FlowLine } from '@/threejs/components/index'
import { getFeatureCoordinates } from '@/threejs/libs/index'
import map1Data from '@/geoJson/广东省.json'

const mapSimplified = simplify(map1Data, { tolerance: 0.01, highQuality: true })

const mapCanvas = ref(null)
let map = null
onMounted(() => {
  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: true,
      position: new Vector3(0, 0, 25),
    },
  })

  const grid = new Grid(map, {
    gridSize: 50,
    gridDivision: 20,
    gridColor: 0x1b4b70,
    shapeSize: 0.5,
    shapeColor: 0x2a5f8a,
    pointSize: 0.1,
    pointColor: 0x154d7d,
  })
  grid.rotation.x = -Math.PI / 2

  const map2D = new Map2D(map, {
    projection: {
      center: [113.280637, 23.125178],
      scale: 150,
    },
    position: new Vector3(0, 0.3, 0),
    data: mapSimplified,
    mergeAll: false,
    flowLine: {
      show: true,
      opts: {
        radius: 0.08,
      },
    },
  })

  console.log(map2D)

  const polygons = getFeatureCoordinates(mapSimplified, { filter: [0, 9] })

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
