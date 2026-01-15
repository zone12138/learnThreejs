<template>
  <div ref="containerRef" class="guangzhou-map-container" @click="handleClick">
    <div ref="districtInfoRef" class="district-info"></div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { use3DMap } from '../hooks/3DMap.js'

import gzMapData from '../geoJson/广州市.js'
// import groundMapData from '../geoJson/广东省.js'

const containerRef = ref(null)
const districtInfoRef = ref(null)

console.log('aetup', containerRef.value)
console.time('use3DMap')

const { scene, camera, renderer, controls, cleanup } = use3DMap({
  container: containerRef,
  districtInfoRef,
  // groundMapData: chinaMapData,
  // groundMapData,
  mapData: gzMapData,
})

// 点击事件处理函数
const handleClick = (event) => {
  console.log('点击事件', scene, camera, renderer, controls)
  cleanup()
}

onMounted(() => {
  console.timeEnd('use3DMap')
})
</script>

<style scoped>
.guangzhou-map-container {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #000000;
}

.district-info {
  position: fixed;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.7);
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  user-select: none;
  pointer-events: none;
  z-index: 100;
  visibility: hidden;
  transform: translate(-50%, -100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}
</style>
