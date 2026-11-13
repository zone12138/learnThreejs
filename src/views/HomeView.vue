<!--
 * @FileDescription: 首页演示（Grid + Plane + Map3D（广东） + Map2D（中国省级底图））
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
import {
  TextureLoader,
  DoubleSide,
  MeshBasicMaterial,
  AdditiveBlending,
  Vector3,
  AxesHelper,
} from 'three'
import gsap from 'gsap'
import { BasicThreejs } from '@/threejs/core'
import { Grid, Map3D, Map2D, Plane } from '@/threejs/components/index'
import { PROJECTION } from '@/threejs/config/geo'
import { loadGeoJson } from '@/utils/geoLoader'
import image1 from '@/assets/textures/image.png'

const mapCanvas = ref(null)
let map = null,
  loader = new TextureLoader(),
  tl = null

onMounted(async () => {
  const [mapData, mapChinaData] = await Promise.all([
    loadGeoJson('guangdong'),
    loadGeoJson('china-provinces'),
  ])

  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: true,
    },
  })
  new Grid(map, {
    gridSize: 50,
    gridDivision: 20,
    gridColor: 0x1b4b70,
    shapeSize: 0.5,
    shapeColor: 0x2a5f8a,
    pointSize: 0.1,
  })
  const plane1 = new Plane(map, {
    width: 10,
    scale: 1,
    position: { x: 0, y: 0.2, z: 0 },
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
  plane1.rotation.x = -Math.PI / 2
  plane1.renderOrder = 6

  const map3D = new Map3D(map, {
    projection: PROJECTION.guangdong,
    position: new Vector3(0, 0.3, 0),
    data: mapData,
  })
  map3D.instance.rotation.x = -Math.PI / 2
  map3D.instance.scale.set(1, 1, 0)
  map3D.lineGroup.visible = false
  map3D.labelGroup.visible = false

  const map2D = new Map2D(map, {
    projection: PROJECTION.guangdong,
    position: new Vector3(0, 0.31, 0),
    data: mapChinaData,
  })
  map2D.instance.rotation.x = -Math.PI / 2

  const axesHelper = new AxesHelper(100)
  map.scene.add(axesHelper)

  tl = gsap.timeline({
    defaults: {
      duration: 2.5,
      ease: 'power2.out',
    },
  })

  tl.to(map.camera.position, {
    x: 0,
    y: 10,
    z: 12,
    onUpdate: () => {
      map.controls.update()
    },
  })

  tl.to(map3D.instance.scale, {
    duration: 1,
    x: 1,
    y: 1,
    z: 1,
    ease: 'circ.out',
    onComplete: () => {
      map3D.lineGroup.visible = true
      map3D.labelGroup.visible = true
    },
  })
})

onUnmounted(() => {
  // 入场动画必须先终止，避免 destroy 后继续驱动已销毁的相机/缩放对象
  tl?.kill()
  tl = null
  map?.destroy()
})

const cleanup = () => {
  map?.destroy()
}
</script>
