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
import { BasicThreejs } from '@/threejs/core'
import image1 from '@/assets/textures/image.png'
import { Grid, Map3D, Plane } from '@/threejs/components/index'
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
    eventList: [
      {
        event: 'click',
        callback: function (e, mesh, properties) {
          e.stopPropagation()
          console.log('click arguments: ', e, mesh, properties)
        },
      },
    ],
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
    },
  })
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
