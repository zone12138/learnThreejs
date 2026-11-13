<!--
 * @FileDescription: 2D地图组合演示（Map2D + FlyLine + ReflectTexture + Heatmap3D）
 * @Date: 2026-01-19 14:37:11
-->
<template>
  <div class="demo-stage">
    <canvas ref="mapCanvas"></canvas>
    <button class="demo-reset-btn" @click="cleanup">cleanup</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Vector3 } from 'three'
import { simplify } from '@turf/simplify'
import { BasicThreejs } from '@/threejs/core'
import { Map2D, Grid, FlyLine, ReflectTexture, Heatmap3D } from '@/threejs/components/index'
import { PROJECTION } from '@/threejs/config/geo'
import { loadGeoJson } from '@/utils/geoLoader'

const mapCanvas = ref(null)
let map = null

onMounted(async () => {
  const mapData = await loadGeoJson('guangdong')
  // 数据简化放在加载后执行（原先在模块顶层，阻塞且依赖静态 import）
  const mapSimplified = simplify(mapData, { tolerance: 0.01, highQuality: true })

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

  new Map2D(map, {
    projection: PROJECTION.guangdongLarge,
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

  const reflectTexture = new ReflectTexture({
    text: '广东省',
    fontSize: 200,
    fontFamily: 'Arial',
    textColor: '#00ffff',
    shadowColor: 'rgba(0, 255, 255, 0.6)',
    gap: 20,
    reflectionOpacity: 0.5,
  })

  reflectTexture.position.set(0, -8, 0)
  reflectTexture.rotation.x = Math.PI / 2

  map.scene.add(reflectTexture)

  const heatmap3D = new Heatmap3D({
    projection: PROJECTION.guangdongLarge,
    data: Array.from({ length: 10 }, () => ({
      x: parseInt(Math.random() * 512),
      y: parseInt(Math.random() * 512),
      value: parseInt(Math.random() * 100),
    })),
  })
  heatmap3D.position.z = 0.5

  map.scene.add(heatmap3D)
})
onUnmounted(() => {
  map?.destroy()
})

const cleanup = () => {
  map?.destroy()
}
</script>
