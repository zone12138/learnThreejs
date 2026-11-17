<!--
 * @FileDescription: 地图热力图演示（Map2D + Heatmap3D，经纬度数据对齐地图）
-->
<template>
  <div class="demo-stage">
    <canvas ref="mapCanvas"></canvas>
    <div class="heatmap-toolbar">
      <button class="toolbar-btn" @click="generateRandomData">随机数据</button>
      <button class="toolbar-btn" @click="showTopCities">聚焦珠三角</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Vector3, MeshBasicMaterial } from 'three'
import { BasicThreejs } from '@/threejs/core'
import { Map2D, Heatmap3D } from '@/threejs/components/index'
import { PROJECTION } from '@/threejs/config/geo'
import { loadGeoJson } from '@/utils/geoLoader'

/** 广东省 21 个市中心经纬度（[lng, lat, 名称]） */
const CITIES = [
  [113.264, 23.129, '广州'],
  [114.058, 22.543, '深圳'],
  [113.549, 22.271, '珠海'],
  [116.681, 23.354, '汕头'],
  [113.122, 23.029, '佛山'],
  [113.594, 24.805, '韶关'],
  [110.359, 21.271, '湛江'],
  [112.465, 23.085, '肇庆'],
  [113.078, 22.579, '江门'],
  [110.919, 21.659, '茂名'],
  [114.416, 23.112, '惠州'],
  [116.123, 24.289, '梅州'],
  [115.369, 22.786, '汕尾'],
  [114.697, 23.743, '河源'],
  [111.982, 21.859, '阳江'],
  [113.051, 23.685, '清远'],
  [113.752, 23.02, '东莞'],
  [113.393, 22.517, '中山'],
  [116.622, 23.657, '潮州'],
  [116.373, 22.916, '揭阳'],
  [112.044, 22.915, '云浮'],
]

/** 珠三角核心城市（聚焦模式下高值） */
const PRD_CITY_NAMES = ['广州', '深圳', '珠海', '佛山', '东莞', '中山', '江门', '惠州', '肇庆']

const mapCanvas = ref(null)
let map = null
let heatmap3D = null

/** 按模式生成热力数据：random 全省随机，prd 珠三角高值、其余低值 */
function buildHeatData(mode) {
  return CITIES.map(([lng, lat, name]) => {
    const value =
      mode === 'prd'
        ? PRD_CITY_NAMES.includes(name)
          ? Math.round(70 + Math.random() * 30)
          : Math.round(Math.random() * 30)
        : Math.round(Math.random() * 100)
    return { lng, lat, value }
  })
}

function generateRandomData() {
  heatmap3D?.setData(buildHeatData('random'))
}

function showTopCities() {
  heatmap3D?.setData(buildHeatData('prd'))
}

onMounted(async () => {
  const mapData = await loadGeoJson('guangdong')

  map = new BasicThreejs(mapCanvas.value, {
    cameraOpts: {
      helper: false,
      position: new Vector3(0, 0, 25),
    },
  })

  // 广东底图（与 FlatMapDemo 同投影，保证坐标系一致）
  new Map2D(map, {
    projection: PROJECTION.guangdongLarge,
    position: new Vector3(0, 0, 0),
    data: mapData,
    mergeAll: true,
    material: new MeshBasicMaterial({ color: 0x14324f }),
    mapLine: {
      show: true,
      opts: { color: 0x4fd6ff },
    },
  })

  // 热力图平面：worldSize 需覆盖 guangdongLarge 投影后的省份范围
  heatmap3D = new Heatmap3D({
    projection: PROJECTION.guangdongLarge,
    worldSize: 26,
    radius: 1.6,
    maxOpacity: 0.85,
    blur: 0.8,
    gradient: {
      0.3: '#1fc2e1',
      0.5: '#24d560',
      0.6: '#9cd521',
      0.75: '#f1e12a',
      0.85: '#ffbf3a',
      1.0: '#ff0000',
    },
    data: buildHeatData('random'),
  })
  // 抬高半个身位，叠在地图之上
  heatmap3D.position.z = 0.5

  map.scene.add(heatmap3D)
})

onUnmounted(() => {
  heatmap3D?.dispose()
  heatmap3D = null
  map?.destroy()
  map = null
})
</script>

<style scoped>
.heatmap-toolbar {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 10px;
}

.toolbar-btn {
  padding: 6px 16px;
  border: 1px solid rgba(79, 214, 255, 0.5);
  border-radius: 6px;
  background: rgba(10, 30, 50, 0.75);
  color: #cfeaff;
  cursor: pointer;
  font-size: 14px;
}

.toolbar-btn:hover {
  background: rgba(24, 60, 90, 0.9);
}
</style>
