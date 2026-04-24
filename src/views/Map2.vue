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
import { Map2D, Grid, FlowLine, FlyLine } from '@/threejs/components/index'
import { getFeatureCoordinates } from '@/threejs/libs/index'
import map1Data from '@/geoJson/广东省.json'

const mapSimplified = simplify(map1Data, { tolerance: 0.01, highQuality: true })

const mapCanvas = ref(null)
let map = null
onMounted(() => {
  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: false,
      position: new Vector3(0, 0, 25),
    },
  })

  const grid = new Grid(map, {
    gridSize: 50,
    gridDivision: 20,
    shapeSize: 0.5,
    pointSize: 0.1,
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

  const start = new Vector3(0, 1, 0) // 起点
  const end = new Vector3(10, 1, 0) // 终点
  const flyLine = new FlyLine(map, {
    start,
    end,
    color: 0x00ff00, // 绿色
    height: 8, // 弧线高度
    speed: 0.2, // 飞行速度
    radius: 0.02, // 粗细
    length: 0.2, // 线段长度占比
  })
  flyLine.mesh.rotation.x = Math.PI / 2
  map.scene.add(flyLine.mesh)

  const polygons = getFeatureCoordinates(mapSimplified, { filter: [0, 9] })
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
