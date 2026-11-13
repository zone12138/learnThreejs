<!--
 * @FileDescription: 相机与基础网格演示（AxesHelper + Box + lookAt）
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
import { Vector3, AxesHelper, BoxGeometry, MeshBasicMaterial, Mesh } from 'three'
import { BasicThreejs } from '@/threejs/core'

const mapCanvas = ref(null)
let map = null

onMounted(() => {
  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: false,
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
})
onUnmounted(() => {
  map?.destroy()
})

const cleanup = () => {
  map?.destroy()
}
</script>
