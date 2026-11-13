<template>
  <div class="demo-stage demo-stage--viewport" @click="handleClick">
    <canvas ref="canvasRef"></canvas>
    <div ref="districtInfoRef" class="demo-tooltip"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { use3DMap } from '@/hooks/3DMap.js'
import { loadGeoJson } from '@/utils/geoLoader'

const canvasRef = ref(null)
const districtInfoRef = ref(null)

// 场景管理统一走 BasicThreejs（经 use3DMap 适配），数据异步加载后手动 initMap
const { scene, camera, renderer, controls, initMap } = use3DMap({
  canvas: canvasRef,
})

onMounted(async () => {
  const gzMapData = await loadGeoJson('guangzhou')
  initMap({ mapData: gzMapData })
})

const handleClick = () => {
  // scene/camera 等为 computed 引用，初始化后即可用
  console.log('当前场景:', scene.value, camera.value, renderer.value, controls.value)
}
</script>
