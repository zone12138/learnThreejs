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
import {
  TextureLoader,
  DoubleSide,
  MeshBasicMaterial,
  AdditiveBlending,
  Vector3,
  AxesHelper,
  Group,
} from 'three'
import { BasicThreejs } from '@/threejs/core'
import { Grid } from '@/threejs/components/Grid'
import { Plane } from '@/threejs/components/Plane'
import image1 from '@/assets/textures/image.png'
import { Map3D } from '@/threejs/components/Map3D'
import map1Data from '@/geoJson/广东省.json'
import gsap from 'gsap'

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
  const grid = new Grid(map, {
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
    projection: {
      center: [113.280637, 23.125178],
      scale: 85,
      translate: [0, 0],
    },
    position: new Vector3(0, 0.3, 0),
    data: map1Data,
  })
  map3D.instance.rotation.x = -Math.PI / 2
  map3D.instance.scale.set(1, 1, 0)
  map3D.lineGroup.visible = false
  map3D.labelGroup.visible = false

  const axesHelper = new AxesHelper(100)
  map.scene.add(axesHelper)

  const tl = gsap.timeline({
    defaults: {
      duration: 2.5,
      ease: 'power2.out',
    },
  })

  tl.to(map.camera.instance.position, {
    x: 0,
    y: 10,
    z: 12,
    onUpdate: () => {
      console.log(map.camera.instance.position)
      map.camera.update()
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
      console.log(map3D.lineGroup)
      console.log(map3D.labelGroup)
    },
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
